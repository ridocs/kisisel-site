/*
  İş yazışmasının canlı akışı (SSE).

  Destek akışıyla (`api/talepler/akis.js`) aynı kurallar ve aynı gerekçeler:

  OTURUM ZORUNLU, İKİ KATMAN. Ara katman bu yolu açık yollar listesine
  koymuyor, yani oturumsuz istek buraya HİÇ ULAŞMADAN 401 alıyor. Buradaki
  kontrol ikinci katman: bu dosya ileride başka bir yapılandırmadan da
  servis edilse, akış oturumsuz açılmasın.

  MÜŞTERİ YALITIMI `sunucu/is-canli.mjs` içinde, sorgunun kendisinde. Burada
  yalnızca oturumdan gelen müşteri kimliği aktarılıyor; adresten, başlıktan
  ya da gövdeden bir müşteri kimliği OKUNMUYOR.

  `?is=<id>` zorunlu ve o iş bu müşterinin değilse akış açılmıyor; cevap, iş
  hiç yokmuş gibi 404. Müşteri başkasının işinin varlığını bile öğrenemiyor.
*/

import { isAkisYaniti } from '../../../sunucu/is-canli.mjs';
import { json } from '../../../sunucu/istek.mjs';
import { panelVt } from '../../../sunucu/veritabani.mjs';

export const prerender = false;

export async function GET({ locals, request, url }) {
	const musteri = locals.musteri;
	if (!musteri) return json({ tamam: false, mesaj: 'Oturum bulunamadı.' }, 401);

	const db = panelVt();
	const isId = url.searchParams.get('is');
	const bilinen = url.searchParams.get('bilinen');
	const karma = locals.oturumKarmasi;

	const yanit = isAkisYaniti(db, {
		musteriId: musteri.id,
		isId: isId || null,
		baslangic: bilinen || null,
		iptalIsareti: request.signal,
		/*
		  Oturum hâlâ duruyor mu. `oturumOku` KULLANILMIYOR; gerekçesi
		  `api/talepler/akis.js` içinde yazılı: o işlev hareketsizlik sınırını
		  aşan kaydı siliyor ve akış `son_gorulme` damgasını tazelemiyor, yani
		  bir saat açık kalan bir sekme kendi oturumunu düşürürdü.
		*/
		oturumGecerliMi: () => {
			if (!karma) return false;
			const satir = db
				.prepare('SELECT mutlak_son FROM oturum WHERE kimlik_karmasi = ?')
				.get(karma);
			if (!satir) return false;
			return Date.parse(satir.mutlak_son) > Date.now();
		},
	});

	if (!yanit) return json({ tamam: false, mesaj: 'İş bulunamadı.' }, 404);
	return yanit;
}

/*
  Destek yazışmasının canlı akışı (SSE).

  OTURUM ZORUNLU, İKİ KATMAN. Ara katman bu yolu açık yollar listesine
  koymuyor, yani oturumsuz istek buraya HİÇ ULAŞMADAN 401 alıyor. Buradaki
  kontrol ikinci katman: bu dosya ileride başka bir yapılandırmadan da
  servis edilse, akış oturumsuz açılmasın.

  MÜŞTERİ YALITIMI `sunucu/canli.mjs` içinde, sorgunun kendisinde. Burada
  yalnızca oturumdan gelen müşteri kimliği aktarılıyor; adresten, başlıktan
  ya da gövdeden bir müşteri kimliği OKUNMUYOR.

  `?talep=<id>` verilirse akış tek talebe daraltılıyor. O talep bu müşterinin
  değilse akış açılmıyor ve cevap, talep hiç yokmuş gibi 404: müşteri
  başkasının talebinin varlığını bile öğrenemiyor.

  `?bilinen=<ISO>` istemcinin elindeki en son damga. Bundan öncesi yeniden
  akmıyor. Verilmezse akış "şu andan sonrası" ile başlıyor.
*/

import { akisYaniti } from '../../../sunucu/canli.mjs';
import { json } from '../../../sunucu/istek.mjs';
import { panelVt } from '../../../sunucu/veritabani.mjs';

export const prerender = false;

export async function GET({ locals, request, url }) {
	const musteri = locals.musteri;
	if (!musteri) return json({ tamam: false, mesaj: 'Oturum bulunamadı.' }, 401);

	const db = panelVt();
	const talepId = url.searchParams.get('talep');
	const bilinen = url.searchParams.get('bilinen');
	const karma = locals.oturumKarmasi;

	const yanit = akisYaniti(db, {
		musteriId: musteri.id,
		talepId: talepId || null,
		baslangic: bilinen || null,
		iptalIsareti: request.signal,
		/*
		  Oturum hâlâ duruyor mu. `oturumOku` KULLANILMIYOR, çünkü o işlev
		  hareketsizlik sınırını aşan kaydı siliyor ve akış `son_gorulme`
		  damgasını tazelemiyor; bir saat açık kalan bir sekme kendi oturumunu
		  düşürürdü. Burada yalnızca kaydın varlığına ve mutlak son kullanma
		  tarihine bakılıyor. Sahip masaüstünden oturumları kapattığında
		  (`musteriOturumlariniKapat`) akış bir nabız içinde sönüyor.
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

	if (!yanit) return json({ tamam: false, mesaj: 'Talep bulunamadı.' }, 404);
	return yanit;
}

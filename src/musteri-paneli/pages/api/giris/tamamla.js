/*
  Giriş imzasını doğrular ve oturumu açar.

  Kimlik avı burada protokol gereği çalışmıyor: imzanın içine tarayıcının
  kendi hesapladığı alan adı giriyor, sahte bir alan adındaki sayfa geçerli
  imza üretemiyor (§5.3). Bu dosyanın yaptığı yalnızca imzayı kütüphaneye
  doğrulatmak ve sonucu tek tip döndürmek.
*/

import { govdeOku, kapi, oturumBasla } from '../../../sunucu/akis.mjs';
import { basarisiz, GIRIS_HATASI, istemciIzleri } from '../../../sunucu/istek.mjs';
import { denemeYaz } from '../../../sunucu/oran-sinir.mjs';
import { eskimisOturumlariTemizle } from '../../../sunucu/oturum.mjs';
import { panelVt } from '../../../sunucu/veritabani.mjs';
import { girisiDogrula } from '../../../sunucu/webauthn.mjs';

export const prerender = false;

export async function POST({ request, clientAddress }) {
	const baslangicMs = Date.now();
	const db = panelVt();
	const simdiMs = baslangicMs;
	const izler = istemciIzleri(request, clientAddress);

	const kapiSonucu = await kapi(db, {
		musteriId: null,
		ipKarmasi: izler.sayacIp,
		baslangicMs,
		simdiMs,
	});
	if (!kapiSonucu.gecti) return kapiSonucu.yanit;

	const govde = await govdeOku(request);
	const sonuc = await girisiDogrula(db, { bilet: govde.bilet, cevap: govde.cevap, simdiMs });

	if (!sonuc.tamam) {
		/*
		  Sayaç uyuşmazlığı (kopyalanmış kimlik bilgisi şüphesi) da buraya
		  düşüyor ve `deneme` tablosuna yazılıyor; sahip masaüstü panelinden
		  bunu görüyor. Kullanıcıya söylenen şey yine aynı tek cümle.
		*/
		denemeYaz(db, {
			tur: 'giris',
			musteriId: sonuc.musteriId ?? null,
			ipKarmasi: izler.sayacIp,
			sonuc: 'basarisiz',
			simdiMs,
		});
		return basarisiz(baslangicMs, GIRIS_HATASI);
	}

	denemeYaz(db, {
		tur: 'giris',
		musteriId: sonuc.musteriId,
		ipKarmasi: izler.sayacIp,
		sonuc: 'basarili',
		simdiMs,
	});

	/* Ölü oturumları toplamak için doğal an: başarılı girişte, istek başına değil. */
	eskimisOturumlariTemizle(db, simdiMs);

	return oturumBasla(db, {
		istek: request,
		clientAddress,
		musteriId: sonuc.musteriId,
		simdiMs,
		baslangicMs,
	});
}

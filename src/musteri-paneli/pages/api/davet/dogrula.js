/*
  Davet anahtarını doğrular ve passkey kaydını başlatır.

  BAŞARISIZLIKTA HER ZAMAN AYNI ŞEY DÖNÜYOR: aynı mesaj (`GENEL_HATA`), aynı
  HTTP kodu (401) ve `enAzSur` sayesinde yaklaşık aynı süre. Anahtar yok mu,
  süresi mi geçmiş, kullanılmış mı, müşteri askıda mı: dışarıdan ayırt
  edilemiyor (PANEL-TASARIMI.md §8).
*/

import { davetiDogrula } from '../../../sunucu/davet.mjs';
import { govdeOku, kapi } from '../../../sunucu/akis.mjs';
import { basarisiz, enAzSur, istemciIzleri, json } from '../../../sunucu/istek.mjs';
import { denemeYaz } from '../../../sunucu/oran-sinir.mjs';
import { panelVt } from '../../../sunucu/veritabani.mjs';
import { kayitSecenekleri, meydanOkumalariTemizle } from '../../../sunucu/webauthn.mjs';

export const prerender = false;

export async function POST({ request, clientAddress }) {
	const baslangicMs = Date.now();
	const db = panelVt();
	const simdiMs = baslangicMs;
	const izler = istemciIzleri(request, clientAddress);

	const govde = await govdeOku(request);
	const sonuc = davetiDogrula(db, { girdi: govde.anahtar ?? '', simdiMs });

	const kapiSonucu = await kapi(db, {
		musteriId: sonuc.hedefMusteriId,
		ipKarmasi: izler.sayacIp,
		baslangicMs,
		simdiMs,
	});
	if (!kapiSonucu.gecti) return kapiSonucu.yanit;

	if (!sonuc.gecerli) {
		denemeYaz(db, {
			tur: 'davet',
			musteriId: sonuc.hedefMusteriId,
			ipKarmasi: izler.sayacIp,
			sonuc: 'basarisiz',
			simdiMs,
		});
		return basarisiz(baslangicMs);
	}

	meydanOkumalariTemizle(db, simdiMs);
	const { bilet, secenekler } = await kayitSecenekleri(db, {
		davet: sonuc.davet,
		musteri: sonuc.musteri,
		simdiMs,
	});

	/*
	  Davet HENÜZ kullanılmış işaretlenmiyor. Kullanıcı parmak izini
	  okutamadan vazgeçerse ya da cihaz reddederse anahtar yanmasın; işaret
	  kayıt gerçekten tamamlandığında, `tamamla` uç noktasında konuyor.
	*/
	denemeYaz(db, {
		tur: 'davet',
		musteriId: sonuc.musteri.id,
		ipKarmasi: izler.sayacIp,
		sonuc: 'basarili',
		simdiMs,
	});

	await enAzSur(baslangicMs);
	return json({ tamam: true, bilet, secenekler });
}

/*
  Passkey kaydını tamamlar: imzayı doğrular, açık anahtarı saklar, daveti
  kapatır ve oturumu açar.

  Özel anahtar müşterinin cihazının güvenli donanımından HİÇ çıkmıyor; buraya
  yalnızca açık anahtar geliyor (§5.2).
*/

import { davetiKullanildiIsaretle } from '../../../sunucu/davet.mjs';
import { govdeOku, kapi, oturumBasla } from '../../../sunucu/akis.mjs';
import { basarisiz, istemciIzleri } from '../../../sunucu/istek.mjs';
import { denemeYaz } from '../../../sunucu/oran-sinir.mjs';
import { panelVt } from '../../../sunucu/veritabani.mjs';
import { kaydiDogrula } from '../../../sunucu/webauthn.mjs';

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
	const sonuc = await kaydiDogrula(db, {
		bilet: govde.bilet,
		cevap: govde.cevap,
		simdiMs,
	});

	if (!sonuc.tamam) {
		denemeYaz(db, {
			tur: 'kayit',
			musteriId: null,
			ipKarmasi: izler.sayacIp,
			sonuc: 'basarisiz',
			simdiMs,
		});
		return basarisiz(baslangicMs);
	}

	/*
	  Tek kullanım burada kapanıyor. Kayıt ile işaretleme arasında başka bir
	  isteğin araya girmesi mümkün değil: SQLite tek yazar ve `UPDATE` koşulu
	  `kullanildi IS NULL` diyor, ikinci kez geçmiyor.
	*/
	if (sonuc.davetId) davetiKullanildiIsaretle(db, sonuc.davetId, simdiMs);

	denemeYaz(db, {
		tur: 'kayit',
		musteriId: sonuc.musteriId,
		ipKarmasi: izler.sayacIp,
		sonuc: 'basarili',
		simdiMs,
	});

	return oturumBasla(db, {
		istek: request,
		clientAddress,
		musteriId: sonuc.musteriId,
		simdiMs,
		baslangicMs,
	});
}

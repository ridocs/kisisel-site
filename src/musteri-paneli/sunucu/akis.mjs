/*
  Uç noktaların ortak iskeleti.

  Dört uç nokta da aynı sırayla çalışıyor: gövdeyi oku, oran sınırını
  değerlendir, işi yap, denemeyi kaydet, yanıtı sabit süreye tamamla.
  Sıra burada tek yerde durmasa, bir uç noktada bir adım atlanırdı.
*/

import { ayarlar } from './ayarlar.mjs';
import { basarisiz, beklet, enAzSur, istemciIzleri, json, KILIT_HATASI } from './istek.mjs';
import { denemeYaz, sinirDurumu } from './oran-sinir.mjs';
import { oturumAc } from './oturum.mjs';
import { cerezYaz } from './istek.mjs';
import { oturumKarmasi } from '../../../veri/kimlik.mjs';
import { cerezOku } from './istek.mjs';

/** JSON gövdesini güvenli okur. Bozuk gövde boş nesne sayılıyor. */
export async function govdeOku(istek) {
	try {
		const cozulen = await istek.json();
		return cozulen && typeof cozulen === 'object' ? cozulen : {};
	} catch {
		return {};
	}
}

/**
 * Oran sınırı kapısı.
 * Kilitliyse aynı kodu ve mesajı döndürüyor; gecikme varsa uyguluyor.
 */
export async function kapi(db, { musteriId, ipKarmasi, baslangicMs, simdiMs }) {
	const durum = sinirDurumu(db, { musteriId, ipKarmasi, simdiMs });
	if (durum.kilitli) {
		denemeYaz(db, { tur: 'giris', musteriId, ipKarmasi, sonuc: 'kilitli', simdiMs });
		return { gecti: false, yanit: await basarisiz(baslangicMs, KILIT_HATASI) };
	}
	/* Üstel gecikme: saldırganın deneme hızını düşürüyor. */
	await beklet(durum.gecikmeMs);
	return { gecti: true };
}

/**
 * Oturumu açar ve çerezi yazar.
 *
 * Eski çerez varsa o oturum siliniyor: oturum sabitlemeye karşı kimlik her
 * girişte YENİLENİYOR (§7).
 */
export async function oturumBasla(db, { istek, clientAddress, musteriId, simdiMs, baslangicMs }) {
	const izler = istemciIzleri(istek, clientAddress);
	const eskiCerez = cerezOku(istek.headers.get('cookie'), ayarlar.cerezAdi);
	const eskiKarma = eskiCerez ? oturumKarmasi(eskiCerez) : null;

	const oturum = oturumAc(db, {
		musteriId,
		ipKarmasi: izler.ip,
		istemciIzi: izler.izi,
		simdiMs,
		eskiKarma,
	});

	await enAzSur(baslangicMs);
	return json({ tamam: true }, 200, { 'set-cookie': cerezYaz(oturum.metin) });
}

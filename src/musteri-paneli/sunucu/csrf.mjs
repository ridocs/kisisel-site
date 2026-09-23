/*
  CSRF işlem anahtarı.

  `SameSite=Strict` tek başına yeterli değil; OWASP bunu birebir söylüyor ve
  PANEL-TASARIMI.md §7 aynı kararı veriyor. Durum değiştiren her istek ayrıca
  oturuma bağlı bir işlem anahtarı taşıyor.

  Anahtar SAKLANMIYOR, TÜRETİLİYOR: oturum karmasının sunucu gizlisiyle
  HMAC'i. Böylece şemaya sütun eklenmiyor, oturum silindiği anda anahtar da
  geçersizleşiyor ve başka bir oturumun anahtarı burada işe yaramıyor.
*/

import { createHmac } from 'node:crypto';
import { esitMi } from '../../../veri/kimlik.mjs';

/** Oturuma bağlı işlem anahtarı. Formda gizli alan olarak taşınıyor. */
export function islemAnahtari(oturumKarmasi, gizli) {
	if (!oturumKarmasi) throw new Error('İşlem anahtarı için oturum gerekli');
	if (!gizli) throw new Error('İşlem anahtarı için gizli anahtar gerekli');
	return createHmac('sha256', gizli).update(Buffer.from(oturumKarmasi)).digest('base64url');
}

/**
 * Gelen anahtarı doğrular. Karşılaştırma sabit zamanlı (`esitMi`):
 * bayt bayt erken çıkan bir karşılaştırma, doğru önek tahmin etmeyi
 * ölçülebilir biçimde kolaylaştırır.
 */
export function islemAnahtariGecerliMi(oturumKarmasi, gizli, gelen) {
	if (typeof gelen !== 'string' || gelen.length === 0) return false;
	let beklenen;
	try {
		beklenen = islemAnahtari(oturumKarmasi, gizli);
	} catch {
		return false;
	}
	return esitMi(Buffer.from(gelen, 'utf8'), Buffer.from(beklenen, 'utf8'));
}

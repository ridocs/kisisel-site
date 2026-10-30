/*
  Panel veritabanının tek açık kopyası.

  Şema `veri/sema-panel.sql`'de ve oraya DOKUNULMUYOR: bu dosya yalnızca
  veritabanını açıyor ve panelin okuduğu birkaç küçük sorguyu topluyor.
*/

import { panelAc } from '../../../veri/db.mjs';
import { ayarlar } from './ayarlar.mjs';

let acik = null;

/** Panel veritabanı. İlk çağrıda açılıyor, sonra aynı bağlantı dönüyor. */
export function panelVt() {
	if (!acik) acik = panelAc(ayarlar.vtYolu);
	return acik;
}

/** Testler ve kapanış için. */
export function vtKapat() {
	if (acik) {
		acik.close();
		acik = null;
	}
}

/** Müşterinin panelde görünen kimliği. Telefon, adres, TC burada YOK (§4). */
export function musteriGetir(db, musteriId) {
	return (
		db
			.prepare('SELECT id, gorunen_ad, durum FROM musteri WHERE id = ? AND durum = ?')
			.get(musteriId, 'etkin') ?? null
	);
}

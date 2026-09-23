/*
  Oturum: açma, okuma, tazeleme, kapatma.

  HTTP'den bağımsız. Buradaki her işlev bir veritabanı bağlantısı ve bir
  zaman damgası alıyor; böylece "13 saat sonra ne olur" sorusu bir saat
  beklemeden test edilebiliyor.

  Ham oturum kimliği veritabanına HİÇ yazılmıyor, yalnızca SHA-256 karması
  duruyor (PANEL-TASARIMI.md §6.2). Veritabanı sızsa bile çerez üretilemez.
*/

import { oturumKimligiUret, esitMi } from '../../../veri/kimlik.mjs';

/** Hareketsizlik süresi. Kullanıcı kararı, 23 Eylül (§2). */
export const HAREKETSIZLIK_MS = 60 * 60 * 1000;

/** Mutlak ömür: oturum ne kadar hareketli olursa olsun bu süreden uzun yaşamaz. */
export const MUTLAK_MS = 12 * 60 * 60 * 1000;

function zamanMs(isoMetin) {
	const ms = Date.parse(isoMetin);
	return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Yeni oturum açar.
 *
 * `eskiKarma` verilirse o kayıt önce siliniyor: oturum sabitleme saldırısına
 * karşı zorunlu kural, girişte kimlik her zaman yenilenir (§7).
 */
export function oturumAc(db, { musteriId, ipKarmasi = null, istemciIzi = null, simdiMs = Date.now(), eskiKarma = null }) {
	if (eskiKarma) db.prepare('DELETE FROM oturum WHERE kimlik_karmasi = ?').run(eskiKarma);
	const kimlik = oturumKimligiUret();
	const simdi = new Date(simdiMs).toISOString();
	const mutlakSonMs = simdiMs + MUTLAK_MS;
	db.prepare(
		`INSERT INTO oturum (kimlik_karmasi, musteri_id, ip_karmasi, istemci_izi, olusturuldu, son_gorulme, mutlak_son)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
	).run(
		kimlik.karma,
		musteriId,
		ipKarmasi,
		istemciIzi,
		simdi,
		simdi,
		new Date(mutlakSonMs).toISOString(),
	);
	return { metin: kimlik.metin, karma: kimlik.karma, mutlakSonMs };
}

/**
 * Çerezden gelen karmayı doğrular.
 *
 * Geçersiz her durumda kayıt siliniyor: ölü bir satırın tabloda beklemesinin
 * bir faydası yok ve çalınmış çerez ikinci kez denenemez.
 *
 * Dönen `sebep` yalnızca günlük için; kullanıcıya her durumda aynı şey
 * söyleniyor (§8, hesap sayımı).
 */
export function oturumOku(db, { karma, ipKarmasi = null, istemciIzi = null, simdiMs = Date.now() }) {
	if (!karma) return { gecerli: false, sebep: 'yok' };
	const satir = db.prepare('SELECT * FROM oturum WHERE kimlik_karmasi = ?').get(karma);
	if (!satir) return { gecerli: false, sebep: 'yok' };

	const dus = (sebep) => {
		db.prepare('DELETE FROM oturum WHERE kimlik_karmasi = ?').run(karma);
		return { gecerli: false, sebep };
	};

	if (simdiMs >= zamanMs(satir.mutlak_son)) return dus('mutlak');
	if (simdiMs - zamanMs(satir.son_gorulme) >= HAREKETSIZLIK_MS) return dus('hareketsizlik');
	/*
	  İstemci izi kimlik doğrulama DEĞİL: çalınmış bir çerezin başka bir
	  tarayıcıda kullanılmasını fark etme ihtimalini artıran ucuz bir katman.
	  Kayıtta iz yoksa (eski satır) kontrol atlanıyor.
	*/
	if (satir.ip_karmasi && !esitMi(satir.ip_karmasi, ipKarmasi)) return dus('ip');
	if (satir.istemci_izi && !esitMi(satir.istemci_izi, istemciIzi)) return dus('izi');

	return {
		gecerli: true,
		sebep: 'gecerli',
		karma,
		musteriId: satir.musteri_id,
		mutlakSonMs: zamanMs(satir.mutlak_son),
		sonGorulmeMs: zamanMs(satir.son_gorulme),
	};
}

/** Hareketsizlik sayacını sıfırlar. Mutlak son kullanmaya dokunmaz. */
export function oturumTazele(db, karma, simdiMs = Date.now()) {
	db.prepare('UPDATE oturum SET son_gorulme = ? WHERE kimlik_karmasi = ?').run(
		new Date(simdiMs).toISOString(),
		karma,
	);
}

/** Çıkış: kayıt siliniyor. Opak kimlik seçmemizin asıl sebebi bu (§5.4). */
export function oturumKapat(db, karma) {
	if (!karma) return 0;
	return db.prepare('DELETE FROM oturum WHERE kimlik_karmasi = ?').run(karma).changes;
}

/** Sahip, masaüstünden bir müşterinin bütün oturumlarını anında düşürebilsin diye. */
export function musteriOturumlariniKapat(db, musteriId) {
	return db.prepare('DELETE FROM oturum WHERE musteri_id = ?').run(musteriId).changes;
}

/** Süresi dolmuş oturumların toplanması. Her girişte ucuza çağrılıyor. */
export function eskimisOturumlariTemizle(db, simdiMs = Date.now()) {
	const simdi = new Date(simdiMs).toISOString();
	const hareketsizSinir = new Date(simdiMs - HAREKETSIZLIK_MS).toISOString();
	return db
		.prepare('DELETE FROM oturum WHERE mutlak_son <= ? OR son_gorulme <= ?')
		.run(simdi, hareketsizSinir).changes;
}

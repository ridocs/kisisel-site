/*
  Testler için geçici panel veritabanı.

  Dosya adı `.test.mjs` DEĞİL: `node --test src/musteri-paneli/*.test.mjs`
  bunu bir test dosyası sanıp içinde test aramasın.
*/

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { panelAc } from '../../veri/db.mjs';
import { yeniKimlik } from '../../veri/kimlik.mjs';

/** Geçici bir panel veritabanı açar. `kapat()` hem bağlantıyı hem dizini siliyor. */
export function geciciPanel() {
	const dizin = mkdtempSync(join(tmpdir(), 'musteri-paneli-test-'));
	const db = panelAc(join(dizin, 'panel.db'));
	return {
		db,
		kapat() {
			db.close();
			rmSync(dizin, { recursive: true, force: true });
		},
	};
}

export function musteriEkle(db, gorunenAd, durum = 'etkin') {
	const id = yeniKimlik();
	const simdi = new Date().toISOString();
	db.prepare(
		'INSERT INTO musteri (id, gorunen_ad, durum, olusturuldu, guncellendi) VALUES (?, ?, ?, ?, ?)',
	).run(id, gorunenAd, durum, simdi, simdi);
	return id;
}

export function davetEkle(db, { musteriId, karma, sonKullanmaMs, kullanildi = null }) {
	const id = yeniKimlik();
	db.prepare(
		`INSERT INTO davet (id, musteri_id, anahtar_karmasi, son_kullanma, kullanildi, olusturuldu)
		 VALUES (?, ?, ?, ?, ?, ?)`,
	).run(
		id,
		musteriId,
		karma,
		new Date(sonKullanmaMs).toISOString(),
		kullanildi,
		new Date().toISOString(),
	);
	return id;
}

/**
 * Sahibin yazdığı bir yanıt.
 *
 * `sunucu/talepler.mjs` yalnızca `musteri` mesajı yazıyor ve doğru olan da
 * bu: panel sahibin ağzından yazamamalı. Sahip tarafı sunucuya masaüstünden
 * eşitlemeyle geliyor. Testte o tarafı canlandırmak için doğrudan satır.
 */
export function sahipMesaji(db, { talepId, metin, simdiMs = Date.now() }) {
	const id = yeniKimlik();
	const simdi = new Date(simdiMs).toISOString();
	db.prepare(
		"INSERT INTO talep_mesaji (id, talep_id, yazan, metin, zaman) VALUES (?, ?, 'sahip', ?, ?)",
	).run(id, talepId, metin, simdi);
	db.prepare('UPDATE talep SET durum = ?, guncellendi = ? WHERE id = ?').run(
		'yanitlandi',
		simdi,
		talepId,
	);
	return id;
}

export function isEkle(
	db,
	{
		musteriId,
		ad,
		durum = 'suruyor',
		ozet = null,
		tutarKurus = 0,
		paraBirimi = 'TRY',
		teslimHedefi = null,
		guncellendi = new Date().toISOString(),
	},
) {
	const id = yeniKimlik();
	db.prepare(
		`INSERT INTO is_ozeti (id, musteri_id, ad, durum, ozet, tutar_kurus, para_birimi,
		                       teslim_hedefi, guncellendi)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(id, musteriId, ad, durum, ozet, tutarKurus, paraBirimi, teslimHedefi, guncellendi);
	return id;
}

export function odemeEkle(db, { isId, tur, tutarKurus, tarih, simdiMs = Date.now() }) {
	const id = yeniKimlik();
	db.prepare(
		'INSERT INTO is_odeme (id, is_id, tur, tutar_kurus, tarih, guncellendi) VALUES (?, ?, ?, ?, ?, ?)',
	).run(id, isId, tur, tutarKurus, tarih, new Date(simdiMs).toISOString());
	return id;
}

export function asamaEkle(
	db,
	{ isId, sira = 0, kaynak = 'elle', baslik, aciklama = null, durum = 'tamamlandi', tarih, simdiMs = Date.now() },
) {
	const id = yeniKimlik();
	db.prepare(
		`INSERT INTO is_asama (id, is_id, sira, kaynak, baslik, aciklama, durum, tarih, guncellendi)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(id, isId, sira, kaynak, baslik, aciklama, durum, tarih, new Date(simdiMs).toISOString());
	return id;
}

/**
 * Dosya künyesi. `depoAdi` verilmezse rastgele bir ad üretiliyor; testin
 * diske bir şey yazması gerekiyorsa o adı kendisi kullanıyor.
 *
 * Diskteki ad ile gösterilen adın AYRI olması bu tablonun tasarım kararı:
 * müşterinin verdiği ad dosya sistemine hiç yazılmıyor.
 */
export function dosyaEkle(
	db,
	{
		isId,
		asamaId = null,
		gosterilenAd,
		depoAdi = `${yeniKimlik()}.bin`,
		tur = 'application/pdf',
		boyut = 1024,
		gorselMi = 0,
		simdiMs = Date.now(),
	},
) {
	const id = yeniKimlik();
	db.prepare(
		`INSERT INTO is_dosya (id, is_id, asama_id, gosterilen_ad, depo_adi, tur, boyut, sha256,
		                       gorsel_mi, olusturuldu)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		id,
		isId,
		asamaId,
		gosterilenAd,
		depoAdi,
		tur,
		boyut,
		Buffer.alloc(32),
		gorselMi,
		new Date(simdiMs).toISOString(),
	);
	return { id, depoAdi };
}

/**
 * Sahibin iş yazışmasına yazdığı mesaj.
 *
 * `sunucu/isler.mjs` yalnızca `musteri` mesajı yazıyor ve doğru olan da bu:
 * panel sahibin ağzından yazamamalı. Sahip tarafı sunucuya masaüstünden
 * eşitlemeyle geliyor; testte o tarafı canlandırmak için doğrudan satır.
 */
export function isSahipMesaji(db, { isId, metin, simdiMs = Date.now() }) {
	const id = yeniKimlik();
	const simdi = new Date(simdiMs).toISOString();
	db.prepare(
		"INSERT INTO is_mesaji (id, is_id, yazan, metin, zaman) VALUES (?, ?, 'sahip', ?, ?)",
	).run(id, isId, metin, simdi);
	db.prepare('UPDATE is_ozeti SET guncellendi = ? WHERE id = ?').run(simdi, isId);
	return id;
}

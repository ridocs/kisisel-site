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

export function isEkle(db, { musteriId, ad, durum = 'suruyor' }) {
	const id = yeniKimlik();
	db.prepare('INSERT INTO is_ozeti (id, musteri_id, ad, durum, guncellendi) VALUES (?, ?, ?, ?, ?)').run(
		id,
		musteriId,
		ad,
		durum,
		new Date().toISOString(),
	);
	return id;
}

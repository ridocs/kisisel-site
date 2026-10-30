/*
  Göç testi: ESKİ şemalı, İÇİNDE VERİ OLAN bir veritabanı yeni şemaya
  taşınabiliyor mu ve taşınırken veri kayboluyor mu?

  Bu test gerçek bir riski karşılıyor: sunucuda ve sahibin bilgisayarında
  dolu veritabanları var. Göç yanlışsa kayıp geri alınamaz.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { panelAc, gocUygula, simdi } from './db.mjs';
import { PANEL_GOCLERI } from './gocler.mjs';

function geciciDizin() {
	return mkdtempSync(join(tmpdir(), 'goc-test-'));
}

/** Ödeme dökümünden ÖNCEKİ panel şemasının ilgili parçası. */
const ESKI_SEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE musteri (
	id TEXT PRIMARY KEY,
	gorunen_ad TEXT NOT NULL,
	durum TEXT NOT NULL DEFAULT 'etkin',
	olusturuldu TEXT NOT NULL,
	guncellendi TEXT NOT NULL
);
CREATE TABLE is_ozeti (
	id TEXT PRIMARY KEY,
	musteri_id TEXT NOT NULL REFERENCES musteri (id) ON DELETE CASCADE,
	ad TEXT NOT NULL,
	durum TEXT NOT NULL,
	guncellendi TEXT NOT NULL
);
`;

test('eski şemalı dolu veritabanı göçle yeni sütunları kazanıyor', () => {
	const dizin = geciciDizin();
	const yol = join(dizin, 'eski.db');
	try {
		// Ödeme dökümünden önceki hâliyle bir veritabanı kur ve içine veri koy.
		const eski = new DatabaseSync(yol);
		eski.exec(ESKI_SEMA);
		const an = simdi();
		eski.prepare(
			'INSERT INTO musteri (id, gorunen_ad, durum, olusturuldu, guncellendi) VALUES (?, ?, ?, ?, ?)',
		).run('m1', 'Var Olan Müşteri', 'etkin', an, an);
		eski.prepare(
			'INSERT INTO is_ozeti (id, musteri_id, ad, durum, guncellendi) VALUES (?, ?, ?, ?, ?)',
		).run('i1', 'm1', 'Eski iş', 'suruyor', an);
		eski.close();

		// Göç: yeni sütunlar gelmeli, var olan satır durmalı.
		const db = panelAc(yol);
		const sutunlar = db.prepare('PRAGMA table_info(is_ozeti)').all().map((s) => s.name);
		for (const beklenen of ['ozet', 'tutar_kurus', 'para_birimi', 'teslim_hedefi']) {
			assert.ok(sutunlar.includes(beklenen), `${beklenen} sütunu eklenmemiş`);
		}

		const is = db.prepare('SELECT * FROM is_ozeti WHERE id = ?').get('i1');
		assert.equal(is.ad, 'Eski iş', 'var olan kayıt korunmalı');
		assert.equal(is.tutar_kurus, 0, 'yeni sütun varsayılanla dolmalı');
		assert.equal(is.para_birimi, 'TRY');

		const musteri = db.prepare('SELECT gorunen_ad FROM musteri WHERE id = ?').get('m1');
		assert.equal(musteri.gorunen_ad, 'Var Olan Müşteri');

		// Yeni tablolar da gelmiş olmalı.
		const tablolar = db
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
			.all()
			.map((s) => s.name);
		for (const beklenen of ['is_odeme', 'is_asama', 'is_dosya', 'is_mesaji']) {
			assert.ok(tablolar.includes(beklenen), `${beklenen} tablosu gelmemiş`);
		}
		db.close();
	} finally {
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('göç iki kez çalıştırılınca bozulmuyor', () => {
	const dizin = geciciDizin();
	const yol = join(dizin, 'iki-kez.db');
	try {
		const db1 = panelAc(yol);
		db1.close();
		// İkinci açılış göçü tekrar denemeli ama hiçbir şeyi bozmamalı.
		const db2 = panelAc(yol);
		const sutunlar = db2.prepare('PRAGMA table_info(is_ozeti)').all().map((s) => s.name);
		assert.equal(
			sutunlar.filter((a) => a === 'tutar_kurus').length,
			1,
			'sütun iki kez eklenmemeli',
		);
		db2.close();
	} finally {
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('sütun zaten varsa göç onu atlıyor', () => {
	const dizin = geciciDizin();
	const yol = join(dizin, 'yarim.db');
	try {
		// Yarım göç edilmiş bir durum: sütunlardan biri elle eklenmiş.
		const eski = new DatabaseSync(yol);
		eski.exec(ESKI_SEMA);
		eski.exec("ALTER TABLE is_ozeti ADD COLUMN tutar_kurus INTEGER NOT NULL DEFAULT 0");
		eski.exec('PRAGMA user_version = 0');
		eski.close();

		const db = panelAc(yol);
		const sutunlar = db.prepare('PRAGMA table_info(is_ozeti)').all().map((s) => s.name);
		assert.equal(sutunlar.filter((a) => a === 'tutar_kurus').length, 1);
		assert.ok(sutunlar.includes('para_birimi'), 'kalan sütunlar yine de eklenmeli');
		db.close();
	} finally {
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('göç listesi boş bir veritabanında da çalışıyor', () => {
	// is_ozeti tablosu hiç yokken göç patlamamalı.
	const dizin = geciciDizin();
	const yol = join(dizin, 'bos.db');
	try {
		const db = new DatabaseSync(yol);
		assert.doesNotThrow(() => gocUygula(db, PANEL_GOCLERI));
		db.close();
	} finally {
		rmSync(dizin, { recursive: true, force: true });
	}
});

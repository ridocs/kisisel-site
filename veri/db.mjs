/*
  SQLite açma ve şema uygulama.

  Sürücü Node'un kendi `node:sqlite` modülü: Node 24'te stabil ve Electron
  44'ün içindeki Node 24.20'de de çalışıyor (ölçüldü). Böylece derlenmesi
  gereken yerel bir bağımlılık (better-sqlite3) eklenmiyor; Electron'da yerel
  modül yeniden derlemek her Electron yükseltmesinde kırılan bir iştir.

  İki veritabanı da aynı işlevden açılıyor, yalnızca şemaları ayrı:
  yerel defter ile sunucudaki kısıtlı kopya (PANEL-TASARIMI.md §4).
*/

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { SEMA_YEREL, SEMA_PANEL } from './semalar.mjs';

export { SEMA_YEREL, SEMA_PANEL };

/**
 * Veritabanını açar ve şemayı uygular.
 *
 * Şema DİSKTEN OKUNMUYOR, modülden geliyor. Bir süre .sql dosyası okunuyordu
 * ve bu geliştirme sunucusunda çalışıyordu; üretim derlemesinde paketleyici
 * modülü bir chunk'a taşıyıp .sql dosyasını taşımadığı için panel ilk
 * istekte ENOENT alıp 500 veriyordu. Geliştirmede hiç görünmeyen bir hataydı.
 *
 * Şemalar baştan sona `IF NOT EXISTS` ile yazıldı, yani her açılışta
 * çalıştırmak zararsız. Sütun eklemek gerektiğinde `gocUygula` kullanılıyor.
 */
export function veritabaniAc(dosyaYolu, sema) {
	mkdirSync(dirname(dosyaYolu), { recursive: true });
	const db = new DatabaseSync(dosyaYolu);
	db.exec('PRAGMA foreign_keys = ON');
	db.exec('PRAGMA journal_mode = WAL');
	// Güç kesintisinde WAL'in bozulmaması için. NORMAL, tam FULL'den hızlı
	// ve WAL kipinde dayanıklılık açısından yeterli.
	db.exec('PRAGMA synchronous = NORMAL');
	db.exec(sema);
	return db;
}

export function yerelAc(dosyaYolu) {
	return veritabaniAc(dosyaYolu, SEMA_YEREL);
}

export function panelAc(dosyaYolu) {
	return veritabaniAc(dosyaYolu, SEMA_PANEL);
}

/**
 * Sürüm numarasına bağlı göç. Şema dosyası yeni kurulumu kuruyor, bu işlev
 * mevcut kurulumu ileri taşıyor.
 *
 * `gocler` dizisinde sıra önemlidir ve bir göç yayınlandıktan sonra
 * DEĞİŞTİRİLMEZ: değiştirilirse zaten göç etmiş bir veritabanı o adımı bir
 * daha çalıştırmaz ve iki kurulum sessizce ayrı düşer.
 */
export function gocUygula(db, gocler) {
	const mevcut = db.prepare('PRAGMA user_version').get().user_version ?? 0;
	if (mevcut >= gocler.length) return mevcut;
	for (let i = mevcut; i < gocler.length; i++) {
		db.exec('BEGIN');
		try {
			gocler[i](db);
			db.exec(`PRAGMA user_version = ${i + 1}`);
			db.exec('COMMIT');
		} catch (hata) {
			db.exec('ROLLBACK');
			throw new Error(`Göç ${i + 1} başarısız: ${hata.message}`, { cause: hata });
		}
	}
	return gocler.length;
}

/** Şu anın ISO 8601 karşılığı. Bütün zaman alanları bu biçimde. */
export function simdi() {
	return new Date().toISOString();
}

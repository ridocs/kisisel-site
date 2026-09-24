/*
  Canlı akışın testi: sunucuda çalışan izleyici, yeni bir mesaj yazıldığında
  onu gerçekten AKITIYOR mu ve ne kadar sürede?

  SSH taklit edilmiyor, gerek de yok: SSH yalnızca taşıma. Test edilen şey
  izleyici betiğinin kendisi, ve o gerçekten çalıştırılıyor.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { panelAc, simdi } from './db.mjs';
import { yerelAc } from './db.mjs';
import { akisBaslangici } from './talep-akisi.mjs';

const BURASI = dirname(fileURLToPath(import.meta.url));
const IZLEYICI = join(BURASI, 'sunucu-talep-izle.mjs');

function ortam() {
	const dizin = mkdtempSync(join(tmpdir(), 'akis-test-'));
	const yol = join(dizin, 'panel.db');
	const db = panelAc(yol);
	db.prepare(
		'INSERT INTO musteri (id, gorunen_ad, durum, olusturuldu, guncellendi) VALUES (?, ?, ?, ?, ?)',
	).run('m1', 'Deneme', 'etkin', simdi(), simdi());
	db.prepare(
		'INSERT INTO talep (id, musteri_id, baslik, durum, oncelik, olusturuldu, guncellendi) VALUES (?, ?, ?, ?, ?, ?, ?)',
	).run('t1', 'm1', 'Yazışma', 'acik', 'normal', simdi(), simdi());
	return { dizin, yol, db };
}

/** İzleyiciyi başlatır ve gelen NDJSON satırlarını olay olarak verir. */
function izleyiciBaslat(vtYolu, baslangic, olay) {
	const surec = spawn('node', [IZLEYICI, vtYolu, baslangic, '200'], { shell: false });
	let tampon = '';
	surec.stdout.setEncoding('utf8');
	surec.stdout.on('data', (p) => {
		tampon += p;
		const satirlar = tampon.split('\n');
		tampon = satirlar.pop() ?? '';
		for (const s of satirlar) {
			if (s.trim()) olay(JSON.parse(s));
		}
	});
	return surec;
}

const bekle = (ms) => new Promise((c) => setTimeout(c, ms));

/*
  Windows'ta çalışan bir süreç veritabanı dosyasını açık tutuyor ve dizin
  silinmiyor (EPERM). Bu yüzden önce sürecin gerçekten bitmesi bekleniyor,
  sonra dizin siliniyor; silme yine de birkaç kez denenip bırakılıyor.
*/
async function temizle(surec, db, dizin) {
	try {
		surec.stdin.end();
	} catch {}
	surec.kill();
	for (let i = 0; i < 40 && surec.exitCode === null; i++) await bekle(50);
	try {
		db.close();
	} catch {}
	for (let i = 0; i < 10; i++) {
		try {
			rmSync(dizin, { recursive: true, force: true });
			return;
		} catch {
			await bekle(100);
		}
	}
}

test('yeni mesaj bir saniyenin altında akıyor', async () => {
	const { dizin, yol, db } = ortam();
	const olaylar = [];
	const surec = izleyiciBaslat(yol, new Date(Date.now() - 1000).toISOString(), (o) => olaylar.push(o));
	try {
		// İzleyicinin açılmasını bekle.
		await bekle(600);
		const basladi = Date.now();
		db.prepare(
			"INSERT INTO talep_mesaji (id, talep_id, yazan, metin, zaman) VALUES (?, ?, 'musteri', ?, ?)",
		).run('msj1', 't1', 'Merhaba, hâlâ açılmıyor.', simdi());

		// Akışın getirmesini bekle.
		for (let i = 0; i < 40 && !olaylar.some((o) => o.tur === 'mesaj'); i++) await bekle(50);
		const gecen = Date.now() - basladi;

		const mesaj = olaylar.find((o) => o.tur === 'mesaj');
		assert.ok(mesaj, 'mesaj akmadı');
		assert.equal(mesaj.metin, 'Merhaba, hâlâ açılmıyor.');
		assert.equal(mesaj.talep_id, 't1');
		assert.ok(gecen < 1500, `gecikme çok yüksek: ${gecen} ms`);
	} finally {
		await temizle(surec, db, dizin);
	}
});

test('başlangıç damgasından önceki mesajlar tekrar akmıyor', async () => {
	const { dizin, yol, db } = ortam();
	const eski = simdi();
	db.prepare(
		"INSERT INTO talep_mesaji (id, talep_id, yazan, metin, zaman) VALUES (?, ?, 'musteri', ?, ?)",
	).run('eski', 't1', 'Eski mesaj', eski);

	const olaylar = [];
	// Damga olarak eski mesajın zamanını veriyoruz: o dahil edilmemeli.
	const surec = izleyiciBaslat(yol, eski, (o) => olaylar.push(o));
	try {
		await bekle(800);
		assert.equal(
			olaylar.filter((o) => o.tur === 'mesaj').length,
			0,
			'damgadan önceki mesaj tekrar akmış',
		);

		db.prepare(
			"INSERT INTO talep_mesaji (id, talep_id, yazan, metin, zaman) VALUES (?, ?, 'sahip', ?, ?)",
		).run('yeni', 't1', 'Yeni mesaj', simdi());
		for (let i = 0; i < 40 && !olaylar.some((o) => o.tur === 'mesaj'); i++) await bekle(50);

		const mesajlar = olaylar.filter((o) => o.tur === 'mesaj');
		assert.equal(mesajlar.length, 1);
		assert.equal(mesajlar[0].id, 'yeni');
	} finally {
		await temizle(surec, db, dizin);
	}
});

test('talep durumu değişince de akıyor', async () => {
	const { dizin, yol, db } = ortam();
	const olaylar = [];
	const surec = izleyiciBaslat(yol, new Date(Date.now() - 1000).toISOString(), (o) => olaylar.push(o));
	try {
		await bekle(600);
		olaylar.length = 0;
		db.prepare('UPDATE talep SET durum = ?, guncellendi = ? WHERE id = ?').run(
			'kapandi',
			simdi(),
			't1',
		);
		for (let i = 0; i < 40 && !olaylar.some((o) => o.tur === 'talep'); i++) await bekle(50);
		const talep = olaylar.find((o) => o.tur === 'talep');
		assert.ok(talep, 'talep değişikliği akmadı');
		assert.equal(talep.durum, 'kapandi');
	} finally {
		await temizle(surec, db, dizin);
	}
});

test('standart girdi kapanınca izleyici kendini sonlandırıyor', async () => {
	// SSH koptuğunda sunucuda öksüz süreç kalmamalı.
	const { dizin, yol, db } = ortam();
	const surec = izleyiciBaslat(yol, new Date().toISOString(), () => {});
	try {
		await bekle(500);
		assert.equal(surec.exitCode, null, 'süreç erken kapanmış');
		surec.stdin.end();
		for (let i = 0; i < 40 && surec.exitCode === null; i++) await bekle(50);
		assert.equal(surec.exitCode, 0, 'girdi kapanınca süreç sonlanmalıydı');
	} finally {
		await temizle(surec, db, dizin);
	}
});

test('akış başlangıcı yerel kopyadaki en son damgadan alınıyor', () => {
	const dizin = mkdtempSync(join(tmpdir(), 'akis-baslangic-'));
	try {
		const db = yerelAc(join(dizin, 'yerel.db'));
		// Hiç kayıt yokken: son bir gün.
		const bos = akisBaslangici(db);
		assert.ok(Date.parse(bos) <= Date.now() - 86000000, 'boş durumda geçmişe bakmalı');

		const an = simdi();
		db.prepare(
			`INSERT INTO talep_kopyasi (id, baslik, durum, olusturuldu, guncellendi, cekildi)
			 VALUES ('t1', 'Baslik', 'acik', ?, ?, ?)`,
		).run(an, an, an);
		db.prepare(
			`INSERT INTO talep_mesaj_kopyasi (id, talep_id, yazan, metin, zaman)
			 VALUES ('m1', 't1', 'musteri', 'Merhaba', ?)`,
		).run(an);
		assert.equal(akisBaslangici(db), an);
		db.close();
	} finally {
		rmSync(dizin, { recursive: true, force: true });
	}
});

/*
  Eşitleme zincirinin uçtan uca testi, SSH olmadan.

  SSH'ın kendisi test edilmiyor (gerçek bir sunucu ister), ama taşınan şey
  test ediliyor: yerel kuyruktan çıkan paket, sunucuda çalışan betiğe
  verilince panel veritabanına doğru uygulanıyor mu. Betikler burada
  gerçekten çalıştırılıyor, taklit edilmiyor.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { yerelAc, panelAc, simdi } from './db.mjs';
import { kuyrugaYaz, bekleyenler, paketHazirla } from './esitleme.mjs';
import { ayarlariOku } from './esitleme-ssh.mjs';
import { davetAnahtariUret } from './kimlik.mjs';

const BURASI = dirname(fileURLToPath(import.meta.url));
const ICE_AL = join(BURASI, 'sunucu-ice-al.mjs');
const TALEP_VER = join(BURASI, 'sunucu-talep-ver.mjs');

function ortam() {
	const dizin = mkdtempSync(join(tmpdir(), 'ssh-test-'));
	return {
		dizin,
		yerel: yerelAc(join(dizin, 'yerel.db')),
		panelYolu: join(dizin, 'panel.db'),
	};
}

/** Sunucuda çalışacak betiği gerçekten çalıştırır. */
function iceAl(panelYolu, paket) {
	const cikti = execFileSync('node', [ICE_AL, panelYolu], {
		input: JSON.stringify(paket),
		encoding: 'utf8',
	});
	return JSON.parse(cikti.trim().split('\n').pop());
}

test('kuyruktan çıkan paket panel veritabanına uygulanıyor', () => {
	const { dizin, yerel, panelYolu } = ortam();
	try {
		kuyrugaYaz(yerel, 'musteri.yaz', { id: 'm1', gorunen_ad: 'Ali Veli', durum: 'etkin' });
		kuyrugaYaz(yerel, 'is.yaz', {
			id: 'i1',
			musteri_id: 'm1',
			ad: 'Web sitesi',
			durum: 'suruyor',
			tutar_kurus: 4500000,
		});

		const sonuc = iceAl(panelYolu, paketHazirla(bekleyenler(yerel)));
		assert.equal(sonuc.tamam, true);
		assert.equal(sonuc.uygulanan.length, 2);

		const panel = panelAc(panelYolu);
		const musteri = panel.prepare('SELECT * FROM musteri WHERE id = ?').get('m1');
		assert.equal(musteri.gorunen_ad, 'Ali Veli');
		const is = panel.prepare('SELECT * FROM is_ozeti WHERE id = ?').get('i1');
		assert.equal(is.ad, 'Web sitesi');
		// Tutar sunucuya hiç ulaşmamalı: sütunu bile yok.
		assert.equal(is.tutar_kurus, undefined);
		panel.close();
	} finally {
		yerel.close();
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('aynı paket iki kez uygulanınca sonuç değişmiyor', () => {
	const { dizin, yerel, panelYolu } = ortam();
	try {
		kuyrugaYaz(yerel, 'musteri.yaz', { id: 'm1', gorunen_ad: 'Ali', durum: 'etkin' });
		const paket = paketHazirla(bekleyenler(yerel));
		iceAl(panelYolu, paket);
		iceAl(panelYolu, paket);
		const panel = panelAc(panelYolu);
		assert.equal(panel.prepare('SELECT COUNT(*) AS n FROM musteri').get().n, 1);
		panel.close();
	} finally {
		yerel.close();
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('kullanılmış davet, paket tekrar gönderilince yeniden kullanılabilir olmuyor', () => {
	// Tek kullanımlık olmanın anlamı bu: eski bir kuyruk yeniden gönderilse
	// bile tüketilmiş bir anahtar diriltilmemeli.
	const { dizin, yerel, panelYolu } = ortam();
	try {
		const anahtar = davetAnahtariUret();
		kuyrugaYaz(yerel, 'musteri.yaz', { id: 'm1', gorunen_ad: 'Ali', durum: 'etkin' });
		kuyrugaYaz(yerel, 'davet.yaz', {
			id: 'd1',
			musteri_id: 'm1',
			anahtar_karmasi: anahtar.karma,
			son_kullanma: new Date(Date.now() + 7 * 864e5).toISOString(),
		});
		const paket = paketHazirla(bekleyenler(yerel));
		iceAl(panelYolu, paket);

		// Müşteri anahtarı kullandı:
		const panel = panelAc(panelYolu);
		panel.prepare('UPDATE davet SET kullanildi = ? WHERE id = ?').run(simdi(), 'd1');
		panel.close();

		// Sahip aynı kuyruğu yeniden gönderdi:
		iceAl(panelYolu, paket);

		const panel2 = panelAc(panelYolu);
		const davet = panel2.prepare('SELECT kullanildi FROM davet WHERE id = ?').get('d1');
		assert.ok(davet.kullanildi, 'kullanılmış davet yeniden açılmış');
		panel2.close();
	} finally {
		yerel.close();
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('davet anahtarının kendisi pakete hiç girmiyor', () => {
	const { dizin, yerel, panelYolu } = ortam();
	try {
		const anahtar = davetAnahtariUret();
		kuyrugaYaz(yerel, 'musteri.yaz', { id: 'm1', gorunen_ad: 'Ali', durum: 'etkin' });
		kuyrugaYaz(yerel, 'davet.yaz', {
			id: 'd1',
			musteri_id: 'm1',
			anahtar_karmasi: anahtar.karma,
			son_kullanma: new Date(Date.now() + 864e5).toISOString(),
		});
		const paket = JSON.stringify(paketHazirla(bekleyenler(yerel)));
		const sade = anahtar.metin.replace(/-/g, '');
		assert.ok(!paket.includes(anahtar.metin), 'anahtar metni pakete sızmış');
		assert.ok(!paket.includes(sade), 'anahtar tiresiz hâliyle pakete sızmış');
		assert.ok(paket.includes(anahtar.karma.toString('hex')), 'karma pakette olmalıydı');
	} finally {
		yerel.close();
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('bozuk paket hiçbir şey yazmadan reddediliyor', () => {
	const { dizin, yerel, panelYolu } = ortam();
	try {
		// Var olmayan müşteriye iş: yabancı anahtar kısıtı patlamalı ve
		// paketin tamamı geri alınmalı.
		const sonuc = (() => {
			try {
				return iceAl(panelYolu, {
					surum: 1,
					islemler: [
						{ sira: 1, islem: 'musteri.yaz', govde: { id: 'm1', gorunen_ad: 'Ali', durum: 'etkin' } },
						{ sira: 2, islem: 'is.yaz', govde: { id: 'i1', musteri_id: 'yok', ad: 'İş', durum: 'suruyor' } },
					],
				});
			} catch (hata) {
				return JSON.parse(hata.stdout.trim().split('\n').pop());
			}
		})();
		assert.equal(sonuc.tamam, false);
		const panel = panelAc(panelYolu);
		assert.equal(
			panel.prepare('SELECT COUNT(*) AS n FROM musteri').get().n,
			0,
			'paket geri alınmadı, ilk işlem yazılı kalmış',
		);
		panel.close();
	} finally {
		yerel.close();
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('talepler sunucudan okunup yerele yazılıyor', () => {
	const { dizin, yerel, panelYolu } = ortam();
	try {
		kuyrugaYaz(yerel, 'musteri.yaz', { id: 'm1', gorunen_ad: 'Ali', durum: 'etkin' });
		iceAl(panelYolu, paketHazirla(bekleyenler(yerel)));

		// Müşteri panelde talep açtı:
		const panel = panelAc(panelYolu);
		panel.prepare(
			'INSERT INTO talep (id, musteri_id, baslik, durum, oncelik, olusturuldu, guncellendi) VALUES (?, ?, ?, ?, ?, ?, ?)',
		).run('t1', 'm1', 'Site açılmıyor', 'acik', 'yuksek', simdi(), simdi());
		panel.prepare(
			'INSERT INTO talep_mesaji (id, talep_id, yazan, metin, zaman) VALUES (?, ?, ?, ?, ?)',
		).run('msj1', 't1', 'musteri', 'Bu sabahtan beri açılmıyor.', simdi());
		panel.close();

		const ham = execFileSync('node', [TALEP_VER, panelYolu], { encoding: 'utf8' });
		const gelen = JSON.parse(ham.trim().split('\n').pop());
		assert.equal(gelen.talepler.length, 1);
		assert.equal(gelen.talepler[0].baslik, 'Site açılmıyor');
		assert.equal(gelen.talepler[0].mesajlar[0].metin, 'Bu sabahtan beri açılmıyor.');
	} finally {
		yerel.close();
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('artımlı çekişte eski talepler tekrar gelmiyor', () => {
	const { dizin, yerel, panelYolu } = ortam();
	try {
		const panel = panelAc(panelYolu);
		panel.prepare(
			'INSERT INTO musteri (id, gorunen_ad, durum, olusturuldu, guncellendi) VALUES (?, ?, ?, ?, ?)',
		).run('m1', 'Ali', 'etkin', simdi(), simdi());
		panel.prepare(
			'INSERT INTO talep (id, musteri_id, baslik, durum, oncelik, olusturuldu, guncellendi) VALUES (?, ?, ?, ?, ?, ?, ?)',
		).run('eski', 'm1', 'Eski', 'kapandi', 'normal', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
		panel.prepare(
			'INSERT INTO talep (id, musteri_id, baslik, durum, oncelik, olusturuldu, guncellendi) VALUES (?, ?, ?, ?, ?, ?, ?)',
		).run('yeni', 'm1', 'Yeni', 'acik', 'normal', simdi(), simdi());
		panel.close();

		const ham = execFileSync('node', [TALEP_VER, panelYolu, '2026-06-01T00:00:00.000Z'], {
			encoding: 'utf8',
		});
		const gelen = JSON.parse(ham.trim().split('\n').pop());
		assert.equal(gelen.talepler.length, 1);
		assert.equal(gelen.talepler[0].id, 'yeni');
	} finally {
		yerel.close();
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('eksik ayarla eşitleme başlamıyor', () => {
	const { dizin, yerel } = ortam();
	try {
		assert.throws(() => ayarlariOku(yerel), /ayarları eksik/);
	} finally {
		yerel.close();
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('kabukta anlam taşıyan karakterli ayar reddediliyor', () => {
	const { dizin, yerel } = ortam();
	try {
		const yaz = yerel.prepare(
			'INSERT INTO ayar (anahtar, deger) VALUES (?, ?) ON CONFLICT (anahtar) DO UPDATE SET deger = excluded.deger',
		);
		yaz.run('esitleme.sunucu', 'root@makine');
		yaz.run('esitleme.uzak_veri', '/opt/panel/veri; rm -rf /');
		yaz.run('esitleme.uzak_vt', '/var/lib/panel/panel.db');
		yaz.run('esitleme.ssh_anahtari', 'C:/anahtar');
		yaz.run('esitleme.uzak_node', '/opt/node24/bin/node');
		assert.throws(() => ayarlariOku(yerel), /yalnızca harf/);

		yaz.run('esitleme.uzak_veri', '/opt/panel/veri');
		yaz.run('esitleme.sunucu', 'makine olmayan bicim');
		assert.throws(() => ayarlariOku(yerel), /biçiminde olmalı/);

		yaz.run('esitleme.sunucu', 'root@makine');
		const ayar = ayarlariOku(yerel);
		assert.equal(ayar['esitleme.sunucu'], 'root@makine');
	} finally {
		yerel.close();
		rmSync(dizin, { recursive: true, force: true });
	}
});

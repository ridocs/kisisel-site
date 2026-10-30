/*
  Veri katmanının duman testi: şemalar kuruluyor mu, anahtar üretip çözmek
  aynı baytları veriyor mu, bozuk girdi reddediliyor mu.

  Çalıştırma: node --test veri/
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { yerelAc, panelAc, gocUygula, simdi } from './db.mjs';
import {
	davetAnahtariUret,
	davetAnahtariniCoz,
	oturumKimligiUret,
	oturumKarmasi,
	base32Kodla,
	base32Coz,
	esitMi,
	ipKarmasi,
	yeniKimlik,
	ANAHTAR_BAYT,
} from './kimlik.mjs';

function geciciDizin() {
	return mkdtempSync(join(tmpdir(), 'panel-test-'));
}

test('yerel şema kuruluyor ve tablolar yerinde', () => {
	const dizin = geciciDizin();
	try {
		const db = yerelAc(join(dizin, 'yerel.db'));
		const tablolar = db
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
			.all()
			.map((s) => s.name);
		for (const beklenen of ['musteri', 'is_kaydi', 'odeme', 'revize', 'esitleme_kuyrugu']) {
			assert.ok(tablolar.includes(beklenen), `${beklenen} tablosu yok`);
		}
		db.close();
	} finally {
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('panel şeması kuruluyor ve kimlik bilgisi tablosu yerinde', () => {
	const dizin = geciciDizin();
	try {
		const db = panelAc(join(dizin, 'panel.db'));
		const tablolar = db
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
			.all()
			.map((s) => s.name);
		for (const beklenen of ['musteri', 'davet', 'kimlik_bilgisi', 'oturum', 'talep', 'deneme']) {
			assert.ok(tablolar.includes(beklenen), `${beklenen} tablosu yok`);
		}
		db.close();
	} finally {
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('panel veritabanında kimlik, iletişim ve işin iç yüzü YOK', () => {
	/*
	  Bu test tasarımın sınırını koruyor ve o sınır 24 Eylül 2026'da DARALDI.

	  Önce mali verinin tamamı yasaktı. Sahip müşterinin kendi ödeme dökümünü
	  panelde görmesini isteyince tutar ve ödemeler bilinçli olarak serbest
	  bırakıldı: müşterinin zaten bildiği rakam. Yasak kalan ve bu testin
	  koruduğu şey, kimlik numaraları, iletişim bilgileri ve işin iç yüzü.
	*/
	const dizin = geciciDizin();
	try {
		const db = panelAc(join(dizin, 'panel.db'));

		const isSutunlari = db.prepare('PRAGMA table_info(is_ozeti)').all().map((s) => s.name);
		for (const yasak of ['on_odeme_orani', 'maliyet_kurus', 'not_metni', 'tekrar_eden']) {
			assert.ok(!isSutunlari.includes(yasak), `is_ozeti içinde ${yasak} olmamalı`);
		}
		// Tutar ARTIK OLMALI: özellik bunun üstüne kuruldu.
		assert.ok(isSutunlari.includes('tutar_kurus'), 'ödeme dökümü için tutar gerekli');

		const odemeSutunlari = db.prepare('PRAGMA table_info(is_odeme)').all().map((s) => s.name);
		for (const yasak of ['yontem', 'not_metni']) {
			assert.ok(!odemeSutunlari.includes(yasak), `is_odeme içinde ${yasak} olmamalı`);
		}

		const musteriSutunlari = db.prepare('PRAGMA table_info(musteri)').all().map((s) => s.name);
		for (const yasak of ['tc_sifreli', 'vergi_sifreli', 'telefon', 'ilce', 'sehir']) {
			assert.ok(!musteriSutunlari.includes(yasak), `panel musteri içinde ${yasak} olmamalı`);
		}
		db.close();
	} finally {
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('yabancı anahtar kısıtı açık', () => {
	const dizin = geciciDizin();
	try {
		const db = panelAc(join(dizin, 'panel.db'));
		assert.throws(() => {
			db.prepare(
				'INSERT INTO is_ozeti (id, musteri_id, ad, durum, guncellendi) VALUES (?, ?, ?, ?, ?)',
			).run('a', 'olmayan-musteri', 'iş', 'suruyor', simdi());
		}, /FOREIGN KEY/i);
		db.close();
	} finally {
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('davet anahtarı üretilip geri çözülüyor', () => {
	for (let i = 0; i < 50; i++) {
		const anahtar = davetAnahtariUret();
		assert.equal(anahtar.baytlar.length, ANAHTAR_BAYT);
		const cozulen = davetAnahtariniCoz(anahtar.metin);
		assert.ok(cozulen, `çözülemedi: ${anahtar.metin}`);
		assert.ok(esitMi(cozulen, anahtar.baytlar));
	}
});

test('davet anahtarı boşluklu, küçük harfli ve tiresiz yazılsa da çözülüyor', () => {
	const anahtar = davetAnahtariUret();
	const bozuk = anahtar.metin.toLowerCase().replace(/-/g, ' ');
	assert.ok(esitMi(davetAnahtariniCoz(bozuk), anahtar.baytlar));
	assert.ok(esitMi(davetAnahtariniCoz(anahtar.metin.replace(/-/g, '')), anahtar.baytlar));
});

test('tek karakteri değişen anahtar kontrol karakterinde yakalanıyor', () => {
	let yakalanan = 0;
	const deneme = 200;
	for (let i = 0; i < deneme; i++) {
		const anahtar = davetAnahtariUret();
		const harfler = anahtar.metin.split('');
		// Tire olmayan rastgele bir konumu başka bir harfe çevir.
		const konumlar = harfler.map((k, j) => (k === '-' ? -1 : j)).filter((j) => j >= 0);
		const konum = konumlar[Math.floor(Math.random() * konumlar.length)];
		const alfabe = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
		let yeni;
		do {
			yeni = alfabe[Math.floor(Math.random() * alfabe.length)];
		} while (yeni === harfler[konum]);
		harfler[konum] = yeni;
		if (davetAnahtariniCoz(harfler.join('')) === null) yakalanan++;
	}
	// Kontrol karakteri 5 bit, yani yazım hatalarının yaklaşık 31/32'si yakalanır.
	assert.ok(yakalanan / deneme > 0.85, `yakalama oranı düşük: ${yakalanan}/${deneme}`);
});

test('bozuk girdiler sunucuya gitmeden reddediliyor', () => {
	for (const bozuk of ['', 'x', 'ABC', null, undefined, 'İĞÜŞÖÇ', '!!!!', 'A'.repeat(200)]) {
		assert.equal(davetAnahtariniCoz(bozuk), null, `reddedilmeliydi: ${bozuk}`);
	}
});

test('base32 gidiş dönüşü baytları koruyor', () => {
	for (let uzunluk = 1; uzunluk <= 40; uzunluk++) {
		const baytlar = Buffer.alloc(uzunluk, uzunluk);
		assert.ok(esitMi(base32Coz(base32Kodla(baytlar)).slice(0, uzunluk), baytlar));
	}
});

test('oturum kimliği çerezden karmaya geri dönüyor', () => {
	const oturum = oturumKimligiUret();
	assert.ok(esitMi(oturumKarmasi(oturum.metin), oturum.karma));
	assert.equal(oturumKarmasi('kisa'), null);
	assert.equal(oturumKarmasi(null), null);
});

test('IP karması gizli anahtar olmadan üretilmiyor', () => {
	assert.throws(() => ipKarmasi('1.2.3.4'), /gizli anahtar/);
	const a = ipKarmasi('1.2.3.4', 'tuz');
	const b = ipKarmasi('1.2.3.4', 'baska-tuz');
	assert.ok(!esitMi(a, b), 'farklı tuz farklı karma vermeli');
	assert.ok(esitMi(a, ipKarmasi('1.2.3.4', 'tuz')));
});

test('kimlikler benzersiz', () => {
	const kume = new Set();
	for (let i = 0; i < 1000; i++) kume.add(yeniKimlik());
	assert.equal(kume.size, 1000);
});

test('göç düzeneği sürümü ilerletiyor ve iki kez çalışmıyor', () => {
	const dizin = geciciDizin();
	try {
		/*
		  HAM veritabanı kullanılıyor, `panelAc` değil.

		  `panelAc` artık kendi göçlerini açılışta uyguluyor ve sürümü
		  ilerletiyor; onun üstüne test kendi göç listesini çalıştırınca
		  sürüm zaten ileride olduğu için adım atlanıyordu. Burada sınanan
		  şey düzeneğin kendisi, panelin göçleri değil.
		*/
		const db = new DatabaseSync(join(dizin, 'duzenek.db'));
		let sayac = 0;
		const gocler = [
			(d) => {
				d.exec('CREATE TABLE deneme_gocu (a TEXT)');
				sayac++;
			},
		];
		assert.equal(gocUygula(db, gocler), 1);
		assert.equal(sayac, 1);
		assert.equal(gocUygula(db, gocler), 1);
		assert.equal(sayac, 1, 'göç ikinci kez çalışmamalı');
		db.close();
	} finally {
		rmSync(dizin, { recursive: true, force: true });
	}
});

/*
  CANLI AKIŞIN TESTLERİ

  Sorulan beş soru şu:
    1. Akıştan gelen mesaj yerel kopyaya gerçekten yazılıyor mu?
    2. Aynı mesaj iki kez gelirse (bir akıştan, bir eşitlemeden) ekranda
       iki kez görünür mü? Sahibin kendi yanıtı geri döndüğünde?
    3. Akış kopunca uygulama çalışmaya devam ediyor mu?
    4. Ayarlar eksikken akış hiç başlıyor mu?
    5. Kapanışta uzaktaki izleyici süreç sonlandırılıyor mu?

  GERÇEK SSH YOK. `akisBaslat` yerine sahte bir başlatıcı veriliyor; gerçek
  sunucuya bağlanan hiçbir test burada yok. Gerçek olan tek şey SQLite:
  yerel kopyaya yazılan satır gerçekten veritabanından okunuyor.

  Çalıştırma: node --test yonetim/canli-akis.test.mjs
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { yerelAc, simdi } from '../veri/db.mjs';
import { canliAkisYoneticisiKur } from './canli-akis.mjs';
import { depoKur } from './depo.mjs';

/** Şifreleme bu testlerin konusu değil. */
const SAHTE_KASA = {
	kullanilabilir: () => true,
	sifrele: (metin) => Buffer.from(metin, 'utf8'),
	coz: (baytlar) => Buffer.from(baytlar).toString('utf8'),
};

function ortamKur() {
	const dizin = mkdtempSync(join(tmpdir(), 'akis-test-'));
	const db = yerelAc(join(dizin, 'yerel.db'));
	return {
		db,
		depo: depoKur(db, SAHTE_KASA),
		kapat() {
			try {
				db.close();
			} catch {
				// Zaten kapalıysa sorun değil.
			}
			rmSync(dizin, { recursive: true, force: true });
		},
	};
}

/** Sunucudan çekilmiş gibi bir talep. */
function ornekTalep(db, id = 't1') {
	/*
	  Damga BİR SAAT GERİDE kuruluyor, `simdi()` ile değil.

	  Önceki hâli takvime bağlıydı: test sabit bir tarih ve saat veriyordu,
	  o an gelecekte olduğu sürece geçiyor, gün ilerleyince geçmişte kalıp
	  kırılıyordu. Gerçek bir hata değildi, testin kendi kırılganlığıydı.
	*/
	const an = new Date(Date.now() - 3600_000).toISOString();
	db.prepare(
		`INSERT INTO talep_kopyasi
		 (id, musteri_id, is_id, baslik, durum, oncelik, olusturuldu, guncellendi, cekildi)
		 VALUES (?, NULL, NULL, 'Panel açılmıyor', 'acik', 'normal', ?, ?, ?)`,
	).run(id, an, an, an);
	return id;
}

const mesajlar = (db, talepId) =>
	db
		.prepare('SELECT id, yazan, metin, zaman FROM talep_mesaj_kopyasi WHERE talep_id = ? ORDER BY zaman, id')
		.all(talepId);

/**
 * Sahte akış başlatıcı.
 *
 * Gerçeğinin sözleşmesini taklit ediyor: `akisBaslat(ayar, { baslangic,
 * olay, durum })` çağrılıyor ve `{ durdur }` dönüyor. Test, dönen
 * `akit()` ve `durumBildir()` ile sunucudan veri gelmiş gibi yapıyor.
 */
function sahteAkis() {
	const kayit = { cagrildi: 0, ayarlar: [], baslangiclar: [], durduruldu: 0, acikMi: false };
	let kancalar = null;

	function akisBaslat(ayar, { baslangic, olay, durum }) {
		kayit.cagrildi += 1;
		kayit.ayarlar.push(ayar);
		kayit.baslangiclar.push(baslangic);
		kayit.acikMi = true;
		kancalar = { olay, durum };
		durum({ ad: 'baglaniyor' });
		return {
			durdur() {
				kayit.durduruldu += 1;
				kayit.acikMi = false;
				durum({ ad: 'durduruldu' });
			},
		};
	}

	return {
		akisBaslat,
		kayit,
		akit: (nesne) => kancalar.olay(nesne),
		durumBildir: (d) => kancalar.durum(d),
	};
}

const TAM_AYAR = {
	'esitleme.sunucu': 'mustafa@sunucu',
	'esitleme.uzak_veri': '/srv/panel/veri',
	'esitleme.uzak_vt': '/srv/panel/panel.db',
	'esitleme.ssh_anahtari': '/home/mustafa/.ssh/id',
	'esitleme.uzak_node': '/usr/local/bin/node',
};

/* ------------------------------------------------------------------ */
/* Yerel kopyaya yazma                                                 */
/* ------------------------------------------------------------------ */

test('akıştan gelen mesaj yerel kopyaya yazılıyor', () => {
	const o = ortamKur();
	try {
		ornekTalep(o.db);
		const mesajAni = simdi();
		const sonuc = o.depo.akisOlayiniIsle({
			tur: 'mesaj',
			id: 'm-yeni',
			talep_id: 't1',
			yazan: 'musteri',
			metin: 'Hâlâ giremiyorum.',
			zaman: mesajAni,
		});

		assert.equal(sonuc.atlandi, false);
		assert.equal(sonuc.yeni, true);
		assert.equal(sonuc.yazan, 'musteri');
		assert.equal(sonuc.talepId, 't1');

		const liste = mesajlar(o.db, 't1');
		assert.equal(liste.length, 1);
		assert.equal(liste[0].metin, 'Hâlâ giremiyorum.');

		// Talebin son hareket damgası ilerledi: liste bu alana göre sıralı.
		const talep = o.db.prepare('SELECT guncellendi FROM talep_kopyasi WHERE id = ?').get('t1');
		assert.equal(talep.guncellendi, mesajAni);
	} finally {
		o.kapat();
	}
});

test('aynı mesaj iki kez gelirse ikilenmiyor', () => {
	const o = ortamKur();
	try {
		ornekTalep(o.db);
		const olay = {
			tur: 'mesaj',
			id: 'm-1',
			talep_id: 't1',
			yazan: 'musteri',
			metin: 'Bir kez yazdım.',
			zaman: '2026-09-24T08:00:00.000Z',
		};

		const ilk = o.depo.akisOlayiniIsle(olay);
		const ikinci = o.depo.akisOlayiniIsle(olay);

		assert.equal(ilk.yeni, true);
		// İkinci gelişte "yeni" değil: okunmamış işareti buna bakıyor.
		assert.equal(ikinci.yeni, false);
		assert.equal(mesajlar(o.db, 't1').length, 1);
	} finally {
		o.kapat();
	}
});

test('sahibin kendi yanıtı akıştan geri gelince ikilenmiyor', () => {
	const o = ortamKur();
	try {
		ornekTalep(o.db);
		const yanit = o.depo.talepYanitla('t1', 'Bakıyorum, birazdan dönüyorum.');
		assert.equal(mesajlar(o.db, 't1').length, 1);

		/*
		  Sunucu yanıtı aynı kimlikle saklıyor (kuyruğa giden kimlik ile
		  yerel kopyaya yazılan kimlik aynı), akış da onu aynı kimlikle geri
		  veriyor. Ekranda ikinci bir balon çıkmamalı.
		*/
		const sonuc = o.depo.akisOlayiniIsle({
			tur: 'mesaj',
			id: yanit.id,
			talep_id: 't1',
			yazan: 'sahip',
			metin: 'Bakıyorum, birazdan dönüyorum.',
			zaman: yanit.zaman,
		});

		assert.equal(sonuc.yeni, false);
		assert.equal(mesajlar(o.db, 't1').length, 1);
	} finally {
		o.kapat();
	}
});

test('talep yerelde yokken mesaj düşmüyor, taslak satır kuruluyor', () => {
	const o = ortamKur();
	try {
		const sonuc = o.depo.akisOlayiniIsle({
			tur: 'mesaj',
			id: 'm-ilk',
			talep_id: 't-yeni',
			yazan: 'musteri',
			metin: 'Yeni bir sorun var.',
			zaman: '2026-09-24T09:00:00.000Z',
			musteri_id: 'yerelde-olmayan',
			baslik: 'Fatura görünmüyor',
		});

		assert.equal(sonuc.atlandi, false);
		assert.equal(mesajlar(o.db, 't-yeni').length, 1);

		const talep = o.db.prepare('SELECT * FROM talep_kopyasi WHERE id = ?').get('t-yeni');
		assert.equal(talep.baslik, 'Fatura görünmüyor');
		// Yerelde olmayan müşteriye BAĞLANMIYOR: sunucunun uydurduğu bir
		// kimlik yerel defterde kayıt açmasın.
		assert.equal(talep.musteri_id, null);
	} finally {
		o.kapat();
	}
});

test('talep olayı yerel kopyayı güncelliyor, müşteri bağı korunuyor', () => {
	const o = ortamKur();
	try {
		ornekTalep(o.db);
		o.db.prepare('UPDATE talep_kopyasi SET musteri_id = NULL WHERE id = ?').run('t1');

		const sonuc = o.depo.akisOlayiniIsle({
			tur: 'talep',
			id: 't1',
			musteri_id: 'yerelde-olmayan',
			baslik: 'Panel açılmıyor (güncellendi)',
			durum: 'kapandi',
			oncelik: 'yuksek',
			olusturuldu: '2026-09-20T10:00:00.000Z',
			guncellendi: '2026-09-24T10:00:00.000Z',
		});

		assert.equal(sonuc.yeni, false);
		const talep = o.db.prepare('SELECT * FROM talep_kopyasi WHERE id = ?').get('t1');
		assert.equal(talep.baslik, 'Panel açılmıyor (güncellendi)');
		assert.equal(talep.durum, 'kapandi');
		assert.equal(talep.oncelik, 'yuksek');
		assert.equal(talep.musteri_id, null);
	} finally {
		o.kapat();
	}
});

test('tanınmayan olay türü atlanıyor, hata fırlatmıyor', () => {
	const o = ortamKur();
	try {
		assert.equal(o.depo.akisOlayiniIsle({ tur: 'bilinmeyen' }).atlandi, true);
		assert.equal(o.depo.akisOlayiniIsle(null).atlandi, true);
		// Eksik alanlı mesaj da düşmüyor, atlanıyor.
		assert.equal(o.depo.akisOlayiniIsle({ tur: 'mesaj', id: 'm' }).atlandi, true);
	} finally {
		o.kapat();
	}
});

/* ------------------------------------------------------------------ */
/* Yönetici: başlama ve durma                                          */
/* ------------------------------------------------------------------ */

test('ayarlar eksikken akış hiç başlamıyor', () => {
	const sahte = sahteAkis();
	const durumlar = [];
	const yonetici = canliAkisYoneticisiKur({
		akisBaslat: sahte.akisBaslat,
		ayarlariOku: () => {
			throw new Error('Eşitleme ayarları eksik: esitleme.sunucu');
		},
		baslangicOku: () => '2026-09-24T00:00:00.000Z',
		olayGeldi: () => {},
		durumDegisti: (d) => durumlar.push(d),
	});

	yonetici.baslat();

	assert.equal(sahte.kayit.cagrildi, 0);
	assert.equal(yonetici.durum().ad, 'ayar-eksik');
	assert.equal(yonetici.durum().ayarTamam, false);
	// Hata YUTULMUYOR: eksik olanın adı durumda duruyor.
	assert.match(durumlar.at(-1).sonHata, /esitleme\.sunucu/);
});

test('ayarlar sonradan tamamlanınca akış başlıyor', () => {
	const sahte = sahteAkis();
	let ayarTamam = false;
	const yonetici = canliAkisYoneticisiKur({
		akisBaslat: sahte.akisBaslat,
		ayarlariOku: () => {
			if (!ayarTamam) throw new Error('Eşitleme ayarları eksik: esitleme.sunucu');
			return TAM_AYAR;
		},
		baslangicOku: () => '2026-09-24T00:00:00.000Z',
		olayGeldi: () => {},
	});

	yonetici.baslat();
	assert.equal(sahte.kayit.cagrildi, 0);

	ayarTamam = true;
	yonetici.ayarlariYenile();

	assert.equal(sahte.kayit.cagrildi, 1);
	assert.deepEqual(sahte.kayit.ayarlar[0], TAM_AYAR);
	assert.equal(sahte.kayit.baslangiclar[0], '2026-09-24T00:00:00.000Z');
	yonetici.durdur();
});

test('baslat çağrılmadan hiçbir bağlantı açılmıyor', () => {
	const sahte = sahteAkis();
	const yonetici = canliAkisYoneticisiKur({
		akisBaslat: sahte.akisBaslat,
		ayarlariOku: () => TAM_AYAR,
		baslangicOku: () => '2026-09-24T00:00:00.000Z',
		olayGeldi: () => {},
	});

	yonetici.ayarlariYenile();
	assert.equal(sahte.kayit.cagrildi, 0);
});

test('durdur akışı kapatıyor: sunucuda öksüz süreç kalmıyor', () => {
	const sahte = sahteAkis();
	const yonetici = canliAkisYoneticisiKur({
		akisBaslat: sahte.akisBaslat,
		ayarlariOku: () => TAM_AYAR,
		baslangicOku: () => '2026-09-24T00:00:00.000Z',
		olayGeldi: () => {},
	});

	yonetici.baslat();
	assert.equal(sahte.kayit.acikMi, true);

	yonetici.durdur();
	assert.equal(sahte.kayit.durduruldu, 1);
	assert.equal(sahte.kayit.acikMi, false);
	assert.equal(yonetici.durum().ad, 'kapali');
});

/* ------------------------------------------------------------------ */
/* Yönetici: olay ve kopma                                             */
/* ------------------------------------------------------------------ */

test('akıştan gelen olay yerel kopyaya kadar gidiyor', () => {
	const o = ortamKur();
	const sahte = sahteAkis();
	try {
		ornekTalep(o.db);
		const bildirilenler = [];
		const yonetici = canliAkisYoneticisiKur({
			akisBaslat: sahte.akisBaslat,
			ayarlariOku: () => TAM_AYAR,
			baslangicOku: () => '2026-09-24T00:00:00.000Z',
			olayGeldi: (olay) => bildirilenler.push(o.depo.akisOlayiniIsle(olay)),
		});
		yonetici.baslat();

		sahte.akit({
			tur: 'mesaj',
			id: 'm-akis',
			talep_id: 't1',
			yazan: 'musteri',
			metin: 'Cevabınızı bekliyorum.',
			zaman: '2026-09-24T11:00:00.000Z',
		});

		assert.equal(mesajlar(o.db, 't1').length, 1);
		assert.equal(bildirilenler[0].yeni, true);
		assert.ok(yonetici.durum().sonOlay, 'son olay damgası yazılmalı');
		yonetici.durdur();
	} finally {
		o.kapat();
	}
});

test('akış koptuğunda uygulama çalışmaya devam ediyor', () => {
	const o = ortamKur();
	const sahte = sahteAkis();
	try {
		ornekTalep(o.db);
		const yonetici = canliAkisYoneticisiKur({
			akisBaslat: sahte.akisBaslat,
			ayarlariOku: () => TAM_AYAR,
			baslangicOku: () => '2026-09-24T00:00:00.000Z',
			olayGeldi: (olay) => o.depo.akisOlayiniIsle(olay),
		});
		yonetici.baslat();

		// Bağlantı koptu. Yeniden bağlanma akışın kendi içinde; buranın
		// işi durumu doğru göstermek ve hiçbir şeyi çökertmemek.
		sahte.durumBildir({ ad: 'koptu', kod: 255, hata: 'Connection closed' });
		assert.equal(yonetici.durum().ad, 'koptu');
		assert.equal(yonetici.durum().sonHata, 'Connection closed');

		// Kopukken yerel defter çalışıyor: yanıt hâlâ yazılabiliyor ve
		// kuyruğa düşüyor. Akış en iyi çaba, eşitleme asıl yol.
		const yanit = o.depo.talepYanitla('t1', 'Kopukken de yazabiliyorum.');
		assert.ok(yanit.id);
		assert.equal(
			o.db.prepare('SELECT COUNT(*) AS a FROM esitleme_kuyrugu').get().a,
			1,
		);

		// Akış geri geldiğinde olaylar yine işleniyor.
		sahte.durumBildir({ ad: 'canli', zaman: '2026-09-24T11:05:00.000Z' });
		assert.equal(yonetici.durum().ad, 'canli');
		assert.equal(yonetici.durum().sonHata, null, 'canlıya dönünce eski hata siliniyor');

		sahte.akit({
			tur: 'mesaj',
			id: 'm-sonra',
			talep_id: 't1',
			yazan: 'musteri',
			metin: 'Geri geldi.',
			zaman: '2026-09-24T11:06:00.000Z',
		});
		assert.equal(mesajlar(o.db, 't1').length, 2);
		yonetici.durdur();
	} finally {
		o.kapat();
	}
});

test('tek bozuk olay akışı düşürmüyor', () => {
	const sahte = sahteAkis();
	let cagri = 0;
	const yonetici = canliAkisYoneticisiKur({
		akisBaslat: sahte.akisBaslat,
		ayarlariOku: () => TAM_AYAR,
		baslangicOku: () => '2026-09-24T00:00:00.000Z',
		olayGeldi: () => {
			cagri += 1;
			if (cagri === 1) throw new Error('Veritabanı kilitli');
		},
	});
	yonetici.baslat();

	// Fırlatan olay yönetici içinde kalıyor, çağıranı çökertmiyor.
	assert.doesNotThrow(() => sahte.akit({ tur: 'mesaj', id: 'm1' }));
	assert.equal(yonetici.durum().sonHata, 'Veritabanı kilitli');

	// Bağlantı hâlâ ayakta: sonraki olay işleniyor.
	sahte.akit({ tur: 'mesaj', id: 'm2' });
	assert.equal(cagri, 2);
	assert.equal(sahte.kayit.acikMi, true);
	yonetici.durdur();
});

test('ayar değişince açık bağlantı kapatılıp yenisi kuruluyor', () => {
	const sahte = sahteAkis();
	const yonetici = canliAkisYoneticisiKur({
		akisBaslat: sahte.akisBaslat,
		ayarlariOku: () => TAM_AYAR,
		baslangicOku: () => '2026-09-24T00:00:00.000Z',
		olayGeldi: () => {},
	});

	yonetici.baslat();
	yonetici.ayarlariYenile();

	// Eski bağlantı adres değişmiş olabileceği için kapatılıyor.
	assert.equal(sahte.kayit.durduruldu, 1);
	assert.equal(sahte.kayit.cagrildi, 2);
	yonetici.durdur();
});

test('durum bildirimi hata verse bile akış sürüyor', () => {
	const sahte = sahteAkis();
	const yonetici = canliAkisYoneticisiKur({
		akisBaslat: sahte.akisBaslat,
		ayarlariOku: () => TAM_AYAR,
		baslangicOku: () => '2026-09-24T00:00:00.000Z',
		olayGeldi: () => {},
		// Pencere kapanmışsa gerçekten böyle olabiliyor.
		durumDegisti: () => {
			throw new Error('Pencere yok');
		},
	});

	assert.doesNotThrow(() => yonetici.baslat());
	assert.equal(sahte.kayit.acikMi, true);
	yonetici.durdur();
});

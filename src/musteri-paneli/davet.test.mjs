/*
  Davet anahtarının reddi ve kabulü.

  Buradaki asıl soru şu: BOZUK bir anahtar reddediliyor mu ve reddederken
  fazladan bilgi veriyor mu. `davetiDogrula` her durumda aynı şekli döndürüyor,
  `sebep` yalnızca günlük için; uç nokta onu kullanıcıya göstermiyor.

  Ayrıca tarayıcı tarafındaki biçim denetimiyle sunucu tarafının aynı
  anahtarları kabul ettiği doğrulanıyor: iki kopya ayrı düşerse burada durur.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { davetAnahtariUret, davetAnahtariniCoz, karmala } from '../../veri/kimlik.mjs';
import { davetiDogrula, davetiKullanildiIsaretle } from './sunucu/davet.mjs';
import { anahtarBicimiGecerliMi, anahtaraBenziyorMu } from './istemci/anahtar.mjs';
import { davetEkle, geciciPanel, musteriEkle } from './test-destek.mjs';

const T0 = Date.parse('2026-09-23T09:00:00.000Z');
const GUN = 24 * 60 * 60 * 1000;

function kur({ sonKullanmaMs = T0 + 7 * GUN, kullanildi = null, musteriDurumu = 'etkin' } = {}) {
	const panel = geciciPanel();
	const musteriId = musteriEkle(panel.db, 'Davetli Müşteri', musteriDurumu);
	const anahtar = davetAnahtariUret();
	const davetId = davetEkle(panel.db, {
		musteriId,
		karma: anahtar.karma,
		sonKullanmaMs,
		kullanildi,
	});
	return { ...panel, musteriId, davetId, anahtar };
}

test('geçerli anahtar kabul ediliyor', () => {
	const { db, musteriId, davetId, anahtar, kapat } = kur();
	try {
		const sonuc = davetiDogrula(db, { girdi: anahtar.metin, simdiMs: T0 });
		assert.equal(sonuc.gecerli, true);
		assert.equal(sonuc.davet.id, davetId);
		assert.equal(sonuc.musteri.id, musteriId);
	} finally {
		kapat();
	}
});

test('boşluklu, küçük harfli ve tiresiz yazım da kabul ediliyor', () => {
	const { db, anahtar, kapat } = kur();
	try {
		const bozukYazim = anahtar.metin.toLowerCase().replace(/-/g, '  ');
		assert.equal(davetiDogrula(db, { girdi: bozukYazim, simdiMs: T0 }).gecerli, true);
	} finally {
		kapat();
	}
});

test('tek karakteri değişen anahtar reddediliyor', () => {
	const { db, anahtar, kapat } = kur();
	try {
		const govde = anahtar.metin.slice(0, -2);
		const bozuk = `${govde}${govde.at(-1) === 'A' ? 'B' : 'A'}${anahtar.metin.at(-1)}`;
		const sonuc = davetiDogrula(db, { girdi: bozuk, simdiMs: T0 });
		assert.equal(sonuc.gecerli, false);
	} finally {
		kapat();
	}
});

test('alfabede olmayan karakter taşıyan anahtar reddediliyor', () => {
	const { db, kapat } = kur();
	try {
		for (const girdi of ['', '   ', 'merhaba dünya', '!!!!', 'X'.repeat(200), null, undefined, 42]) {
			const sonuc = davetiDogrula(db, { girdi, simdiMs: T0 });
			assert.equal(sonuc.gecerli, false, `kabul edildi: ${String(girdi)}`);
			assert.equal(sonuc.davet, null);
			assert.equal(sonuc.musteri, null);
		}
	} finally {
		kapat();
	}
});

test('süresi geçmiş anahtar reddediliyor', () => {
	const { db, anahtar, kapat } = kur({ sonKullanmaMs: T0 - 1000 });
	try {
		const sonuc = davetiDogrula(db, { girdi: anahtar.metin, simdiMs: T0 });
		assert.equal(sonuc.gecerli, false);
		assert.equal(sonuc.sebep, 'sure');
	} finally {
		kapat();
	}
});

test('kullanılmış anahtar ikinci kez geçmiyor', () => {
	const { db, davetId, anahtar, kapat } = kur();
	try {
		assert.equal(davetiDogrula(db, { girdi: anahtar.metin, simdiMs: T0 }).gecerli, true);
		assert.equal(davetiKullanildiIsaretle(db, davetId, T0), 1);
		assert.equal(davetiDogrula(db, { girdi: anahtar.metin, simdiMs: T0 }).gecerli, false);
		/* İkinci işaretleme boşa düşüyor: tek kullanım kilidi `kullanildi IS NULL`. */
		assert.equal(davetiKullanildiIsaretle(db, davetId, T0), 0);
	} finally {
		kapat();
	}
});

test('askıya alınmış müşterinin daveti geçmiyor', () => {
	const { db, anahtar, kapat } = kur({ musteriDurumu: 'askida' });
	try {
		assert.equal(davetiDogrula(db, { girdi: anahtar.metin, simdiMs: T0 }).gecerli, false);
	} finally {
		kapat();
	}
});

test('kayıtlı olmayan ama biçimi doğru anahtar da reddediliyor', () => {
	const { db, kapat } = kur();
	try {
		const baskaAnahtar = davetAnahtariUret();
		const sonuc = davetiDogrula(db, { girdi: baskaAnahtar.metin, simdiMs: T0 });
		assert.equal(sonuc.gecerli, false);
		assert.equal(sonuc.sebep, 'yok');
		/* Hangi müşteriye ait olduğu bilgisi de dönmüyor. */
		assert.equal(sonuc.hedefMusteriId, null);
	} finally {
		kapat();
	}
});

test('veritabanında ham anahtar değil yalnızca karma duruyor', () => {
	const { db, anahtar, kapat } = kur();
	try {
		const satir = db.prepare('SELECT anahtar_karmasi FROM davet').get();
		const saklanan = Buffer.from(satir.anahtar_karmasi);
		assert.equal(saklanan.length, 32);
		assert.ok(saklanan.equals(karmala(davetAnahtariniCoz(anahtar.metin))));
		/* Anahtarın metni hiçbir sütunda geçmiyor. */
		const hepsi = JSON.stringify(db.prepare('SELECT * FROM davet').all());
		assert.ok(!hepsi.includes(anahtar.metin.replace(/-/g, '')));
	} finally {
		kapat();
	}
});

test('tarayıcı tarafı biçim denetimi sunucu tarafıyla aynı kararı veriyor', async () => {
	for (let i = 0; i < 25; i++) {
		const anahtar = davetAnahtariUret();
		assert.equal(await anahtarBicimiGecerliMi(anahtar.metin), true);
		assert.equal(await anahtarBicimiGecerliMi(anahtar.metin.toLowerCase()), true);
		assert.equal(await anahtarBicimiGecerliMi(anahtar.metin.replace(/-/g, '')), true);

		/* Kontrol karakteri bozulunca iki taraf da reddediyor. */
		const son = anahtar.metin.at(-1);
		const bozuk = `${anahtar.metin.slice(0, -1)}${son === 'Z' ? 'Y' : 'Z'}`;
		assert.equal(await anahtarBicimiGecerliMi(bozuk), davetAnahtariniCoz(bozuk) !== null);
		assert.equal(await anahtarBicimiGecerliMi(bozuk), false);
	}
});

test('çapadan gelen değerin anahtar olup olmadığı ucuza eleniyor', () => {
	assert.equal(anahtaraBenziyorMu(davetAnahtariUret().metin), true);
	assert.equal(anahtaraBenziyorMu('bolum-basligi'), false);
	assert.equal(anahtaraBenziyorMu(''), false);
	assert.equal(anahtaraBenziyorMu('ABC'), false);
});

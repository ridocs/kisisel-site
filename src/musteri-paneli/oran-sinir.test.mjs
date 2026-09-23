/*
  Oran sınırlama sayaçları.

  İki tür test var: saf sayım işlevleri (zaman damgası dizisi verip karar
  okuyan) ve veritabanı üzerinden çalışan birleşik `sinirDurumu`.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
	IP_ESIK,
	IP_PENCERE_MS,
	KILIT_MS,
	MUSTERI_ESIK,
	MUSTERI_KILIT_ESIGI,
	MUSTERI_PENCERE_MS,
	denemeYaz,
	ipDurumu,
	musteriDurumu,
	sinirDurumu,
} from './sunucu/oran-sinir.mjs';
import { geciciPanel, musteriEkle } from './test-destek.mjs';

const T0 = Date.parse('2026-09-23T09:00:00.000Z');
const IP_A = createHash('sha256').update('ip-a').digest();
const IP_B = createHash('sha256').update('ip-b').digest();

function ardArda(sayi, aralikMs = 1000, bitisMs = T0) {
	return Array.from({ length: sayi }, (_, i) => bitisMs - (sayi - i) * aralikMs);
}

test('eşiğin altında gecikme yok', () => {
	for (let n = 0; n < MUSTERI_ESIK; n++) {
		const durum = musteriDurumu(ardArda(n), T0);
		assert.equal(durum.gecikmeMs, 0, `${n} başarısızlıkta gecikme çıktı`);
		assert.equal(durum.kilitli, false);
	}
});

test('gecikme üstel: 1s, 4s, 16s', () => {
	assert.equal(musteriDurumu(ardArda(5), T0).gecikmeMs, 1000);
	assert.equal(musteriDurumu(ardArda(6), T0).gecikmeMs, 4000);
	assert.equal(musteriDurumu(ardArda(7), T0).gecikmeMs, 16000);
	/* Üs burada duruyor; ondan sonrası zaten kilide gidiyor. */
	assert.equal(musteriDurumu(ardArda(8), T0).gecikmeMs, 16000);
});

test('onuncu başarısızlıkta kilit, otuz dakika', () => {
	const durum = musteriDurumu(ardArda(MUSTERI_KILIT_ESIGI), T0);
	assert.equal(durum.kilitli, true);
	assert.ok(durum.kalanMs > KILIT_MS - 60 * 1000);
	assert.ok(durum.kalanMs <= KILIT_MS);
});

test('kilit süresi dolunca açılıyor', () => {
	const denemeler = ardArda(MUSTERI_KILIT_ESIGI);
	const sonra = T0 + KILIT_MS + 1000;
	assert.equal(musteriDurumu(denemeler, sonra).kilitli, false);
});

test('pencere dışındaki başarısızlıklar sayılmıyor', () => {
	const eski = ardArda(MUSTERI_KILIT_ESIGI, 1000, T0 - MUSTERI_PENCERE_MS - 1000);
	const durum = musteriDurumu(eski, T0);
	assert.equal(durum.sayi, 0);
	assert.equal(durum.kilitli, false);
	assert.equal(durum.gecikmeMs, 0);
});

test('IP sayacı kayan pencerede sınırda kilitleniyor', () => {
	assert.equal(ipDurumu(ardArda(IP_ESIK - 1), T0).kilitli, false);
	assert.equal(ipDurumu(ardArda(IP_ESIK), T0).kilitli, true);
	/* Pencere kaydıkça açılıyor. */
	assert.equal(ipDurumu(ardArda(IP_ESIK, 1000, T0 - IP_PENCERE_MS - 1), T0).kilitli, false);
});

test('veritabanı üzerinden: müşteri sayacı gecikme üretiyor', () => {
	const { db, kapat } = geciciPanel();
	try {
		const musteriId = musteriEkle(db, 'Hedef');
		for (let i = 0; i < 5; i++) {
			denemeYaz(db, {
				tur: 'giris',
				musteriId,
				ipKarmasi: IP_A,
				sonuc: 'basarisiz',
				simdiMs: T0 - (5 - i) * 1000,
			});
		}
		const durum = sinirDurumu(db, { musteriId, ipKarmasi: IP_A, simdiMs: T0 });
		assert.equal(durum.kilitli, false);
		assert.equal(durum.gecikmeMs, 1000);
	} finally {
		kapat();
	}
});

test('veritabanı üzerinden: başarılı giriş müşteri sayacını sıfırlıyor', () => {
	const { db, kapat } = geciciPanel();
	try {
		const musteriId = musteriEkle(db, 'Hedef');
		for (let i = 0; i < 8; i++) {
			denemeYaz(db, {
				tur: 'giris',
				musteriId,
				ipKarmasi: IP_A,
				sonuc: 'basarisiz',
				simdiMs: T0 - (10 - i) * 1000,
			});
		}
		assert.ok(sinirDurumu(db, { musteriId, ipKarmasi: IP_B, simdiMs: T0 }).gecikmeMs > 0);

		denemeYaz(db, {
			tur: 'giris',
			musteriId,
			ipKarmasi: IP_A,
			sonuc: 'basarili',
			simdiMs: T0 - 500,
		});
		const sonra = sinirDurumu(db, { musteriId, ipKarmasi: IP_B, simdiMs: T0 });
		assert.equal(sonra.gecikmeMs, 0);
		assert.equal(sonra.kilitli, false);
	} finally {
		kapat();
	}
});

test('veritabanı üzerinden: IP değiştirmek müşteri sayacından kurtarmıyor', () => {
	const { db, kapat } = geciciPanel();
	try {
		const musteriId = musteriEkle(db, 'Hedef');
		/* Saldırgan her denemede IP değiştiriyor. */
		for (let i = 0; i < MUSTERI_KILIT_ESIGI; i++) {
			denemeYaz(db, {
				tur: 'giris',
				musteriId,
				ipKarmasi: createHash('sha256').update(`ip-${i}`).digest(),
				sonuc: 'basarisiz',
				simdiMs: T0 - (MUSTERI_KILIT_ESIGI - i) * 1000,
			});
		}
		const yeniIp = createHash('sha256').update('bambaska-ip').digest();
		assert.equal(sinirDurumu(db, { musteriId, ipKarmasi: yeniIp, simdiMs: T0 }).kilitli, true);
	} finally {
		kapat();
	}
});

test('veritabanı üzerinden: müşteri değiştirmek IP sayacından kurtarmıyor', () => {
	const { db, kapat } = geciciPanel();
	try {
		/* Saldırgan her denemede başka bir müşteriyi hedefliyor, IP aynı. */
		for (let i = 0; i < IP_ESIK; i++) {
			denemeYaz(db, {
				tur: 'davet',
				musteriId: null,
				ipKarmasi: IP_A,
				sonuc: 'basarisiz',
				simdiMs: T0 - (IP_ESIK - i) * 1000,
			});
		}
		assert.equal(sinirDurumu(db, { musteriId: null, ipKarmasi: IP_A, simdiMs: T0 }).kilitli, true);
		/* Temiz bir IP etkilenmiyor. */
		assert.equal(sinirDurumu(db, { musteriId: null, ipKarmasi: IP_B, simdiMs: T0 }).kilitli, false);
	} finally {
		kapat();
	}
});

/*
  CSRF işlem anahtarı.

  Anahtar oturuma bağlı ve türetilmiş; bu testler "başka oturumun anahtarı
  burada geçmiyor" ve "boş değer geçerli sayılmıyor" kurallarını koruyor.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import { islemAnahtari, islemAnahtariGecerliMi } from './sunucu/csrf.mjs';

const GIZLI = randomBytes(32);
const OTURUM_A = randomBytes(32);
const OTURUM_B = randomBytes(32);

test('aynı oturum ve gizli için anahtar değişmiyor', () => {
	assert.equal(islemAnahtari(OTURUM_A, GIZLI), islemAnahtari(OTURUM_A, GIZLI));
});

test('üretilen anahtar kendi oturumunda geçerli', () => {
	const anahtar = islemAnahtari(OTURUM_A, GIZLI);
	assert.equal(islemAnahtariGecerliMi(OTURUM_A, GIZLI, anahtar), true);
});

test('başka oturumun anahtarı geçersiz', () => {
	const anahtar = islemAnahtari(OTURUM_B, GIZLI);
	assert.equal(islemAnahtariGecerliMi(OTURUM_A, GIZLI, anahtar), false);
});

test('başka gizliyle üretilen anahtar geçersiz', () => {
	const anahtar = islemAnahtari(OTURUM_A, randomBytes(32));
	assert.equal(islemAnahtariGecerliMi(OTURUM_A, GIZLI, anahtar), false);
});

test('boş, eksik ve yanlış türdeki değerler geçersiz', () => {
	for (const deger of ['', null, undefined, 0, {}, []]) {
		assert.equal(islemAnahtariGecerliMi(OTURUM_A, GIZLI, deger), false, `kabul edildi: ${String(deger)}`);
	}
});

test('tek karakteri değişen anahtar geçersiz', () => {
	const anahtar = islemAnahtari(OTURUM_A, GIZLI);
	const bozuk = `${anahtar.slice(0, -1)}${anahtar.at(-1) === 'A' ? 'B' : 'A'}`;
	assert.equal(islemAnahtariGecerliMi(OTURUM_A, GIZLI, bozuk), false);
});

test('anahtarın öneki doğru olsa bile kabul edilmiyor', () => {
	/* Sabit zamanlı karşılaştırma önce uzunluğa bakıyor: kısaltılmış anahtar geçmez. */
	const anahtar = islemAnahtari(OTURUM_A, GIZLI);
	assert.equal(islemAnahtariGecerliMi(OTURUM_A, GIZLI, anahtar.slice(0, 10)), false);
	assert.equal(islemAnahtariGecerliMi(OTURUM_A, GIZLI, `${anahtar}x`), false);
});

test('oturum ya da gizli yoksa anahtar üretilmiyor', () => {
	assert.throws(() => islemAnahtari(null, GIZLI), /oturum/i);
	assert.throws(() => islemAnahtari(OTURUM_A, null), /gizli/i);
	/* Doğrulama tarafı atmıyor, yalnızca false diyor: istek yolunda çökme olmasın. */
	assert.equal(islemAnahtariGecerliMi(null, GIZLI, 'herhangi'), false);
});

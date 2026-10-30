/*
  Oturum ömrü ve yenileme.

  Saat beklemeden test edilebilmesi için bütün işlevler `simdiMs` alıyor;
  "13 saat sonra" burada bir toplama işlemi.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { oturumKarmasi } from '../../veri/kimlik.mjs';
import {
	HAREKETSIZLIK_MS,
	MUTLAK_MS,
	eskimisOturumlariTemizle,
	musteriOturumlariniKapat,
	oturumAc,
	oturumKapat,
	oturumOku,
	oturumTazele,
} from './sunucu/oturum.mjs';
import { geciciPanel, musteriEkle } from './test-destek.mjs';

const T0 = Date.parse('2026-09-23T09:00:00.000Z');
const IZ = createHash('sha256').update('tarayici-a').digest();
const IP = createHash('sha256').update('ip-a').digest();

function kur() {
	const panel = geciciPanel();
	const musteriId = musteriEkle(panel.db, 'Deneme Müşterisi');
	return { ...panel, musteriId };
}

test('açılan oturum aynı istemciyle okunuyor', () => {
	const { db, musteriId, kapat } = kur();
	try {
		const oturum = oturumAc(db, { musteriId, ipKarmasi: IP, istemciIzi: IZ, simdiMs: T0 });
		const durum = oturumOku(db, {
			karma: oturum.karma,
			ipKarmasi: IP,
			istemciIzi: IZ,
			simdiMs: T0 + 1000,
		});
		assert.equal(durum.gecerli, true);
		assert.equal(durum.musteriId, musteriId);
	} finally {
		kapat();
	}
});

test('çerezdeki metin veritabanındaki karmayı veriyor, ham kimlik saklanmıyor', () => {
	const { db, musteriId, kapat } = kur();
	try {
		const oturum = oturumAc(db, { musteriId, simdiMs: T0 });
		assert.ok(Buffer.from(oturumKarmasi(oturum.metin)).equals(Buffer.from(oturum.karma)));

		const satirlar = db.prepare('SELECT kimlik_karmasi FROM oturum').all();
		assert.equal(satirlar.length, 1);
		/* Tabloda duran şey 32 baytlık karma; base64url metin hiçbir yerde yok. */
		assert.equal(Buffer.from(satirlar[0].kimlik_karmasi).length, 32);
		assert.notEqual(Buffer.from(satirlar[0].kimlik_karmasi).toString('base64url'), oturum.metin);
	} finally {
		kapat();
	}
});

test('bir saat hareketsizlikten sonra oturum düşüyor', () => {
	const { db, musteriId, kapat } = kur();
	try {
		const oturum = oturumAc(db, { musteriId, istemciIzi: IZ, simdiMs: T0 });

		const tamZamaninda = oturumOku(db, {
			karma: oturum.karma,
			istemciIzi: IZ,
			simdiMs: T0 + HAREKETSIZLIK_MS - 1,
		});
		assert.equal(tamZamaninda.gecerli, true);

		const gecikmis = oturumOku(db, {
			karma: oturum.karma,
			istemciIzi: IZ,
			simdiMs: T0 + HAREKETSIZLIK_MS,
		});
		assert.equal(gecikmis.gecerli, false);
		assert.equal(gecikmis.sebep, 'hareketsizlik');

		/* Düşen oturum tabloda da kalmıyor. */
		assert.equal(db.prepare('SELECT COUNT(*) AS n FROM oturum').get().n, 0);
	} finally {
		kapat();
	}
});

test('tazeleme hareketsizlik sayacını sıfırlıyor', () => {
	const { db, musteriId, kapat } = kur();
	try {
		const oturum = oturumAc(db, { musteriId, istemciIzi: IZ, simdiMs: T0 });
		/* 50 dakikada bir kullanım: oturum sürekli açık kalıyor. */
		let an = T0;
		for (let i = 0; i < 6; i++) {
			an += 50 * 60 * 1000;
			const durum = oturumOku(db, { karma: oturum.karma, istemciIzi: IZ, simdiMs: an });
			assert.equal(durum.gecerli, true, `${i}. adımda düştü`);
			oturumTazele(db, oturum.karma, an);
		}
	} finally {
		kapat();
	}
});

test('mutlak ömür tazelemeyle uzamıyor', () => {
	const { db, musteriId, kapat } = kur();
	try {
		const oturum = oturumAc(db, { musteriId, istemciIzi: IZ, simdiMs: T0 });
		/* Her yarım saatte bir kullanılsa bile 12 saatte kapanıyor. */
		let an = T0;
		while (an < T0 + MUTLAK_MS - 30 * 60 * 1000) {
			an += 30 * 60 * 1000;
			assert.equal(oturumOku(db, { karma: oturum.karma, istemciIzi: IZ, simdiMs: an }).gecerli, true);
			oturumTazele(db, oturum.karma, an);
		}
		const bitis = oturumOku(db, {
			karma: oturum.karma,
			istemciIzi: IZ,
			simdiMs: T0 + MUTLAK_MS,
		});
		assert.equal(bitis.gecerli, false);
		assert.equal(bitis.sebep, 'mutlak');
	} finally {
		kapat();
	}
});

test('tarayıcı izi değişirse oturum düşüyor', () => {
	const { db, musteriId, kapat } = kur();
	try {
		const oturum = oturumAc(db, { musteriId, ipKarmasi: IP, istemciIzi: IZ, simdiMs: T0 });
		const baskaIz = createHash('sha256').update('tarayici-b').digest();
		const durum = oturumOku(db, {
			karma: oturum.karma,
			ipKarmasi: IP,
			istemciIzi: baskaIz,
			simdiMs: T0 + 1000,
		});
		assert.equal(durum.gecerli, false);
		assert.equal(durum.sebep, 'izi');
	} finally {
		kapat();
	}
});

test('IP karması değişirse oturum düşüyor', () => {
	const { db, musteriId, kapat } = kur();
	try {
		const oturum = oturumAc(db, { musteriId, ipKarmasi: IP, istemciIzi: IZ, simdiMs: T0 });
		const durum = oturumOku(db, {
			karma: oturum.karma,
			ipKarmasi: createHash('sha256').update('ip-b').digest(),
			istemciIzi: IZ,
			simdiMs: T0 + 1000,
		});
		assert.equal(durum.gecerli, false);
		assert.equal(durum.sebep, 'ip');
	} finally {
		kapat();
	}
});

test('girişte oturum kimliği yenileniyor, eski kimlik ölüyor (oturum sabitleme)', () => {
	const { db, musteriId, kapat } = kur();
	try {
		const eski = oturumAc(db, { musteriId, istemciIzi: IZ, simdiMs: T0 });
		const yeni = oturumAc(db, {
			musteriId,
			istemciIzi: IZ,
			simdiMs: T0 + 5000,
			eskiKarma: eski.karma,
		});

		assert.notEqual(yeni.metin, eski.metin);
		assert.equal(
			oturumOku(db, { karma: eski.karma, istemciIzi: IZ, simdiMs: T0 + 6000 }).gecerli,
			false,
		);
		assert.equal(
			oturumOku(db, { karma: yeni.karma, istemciIzi: IZ, simdiMs: T0 + 6000 }).gecerli,
			true,
		);
		assert.equal(db.prepare('SELECT COUNT(*) AS n FROM oturum').get().n, 1);
	} finally {
		kapat();
	}
});

test('çıkışta kayıt siliniyor', () => {
	const { db, musteriId, kapat } = kur();
	try {
		const oturum = oturumAc(db, { musteriId, istemciIzi: IZ, simdiMs: T0 });
		assert.equal(oturumKapat(db, oturum.karma), 1);
		assert.equal(
			oturumOku(db, { karma: oturum.karma, istemciIzi: IZ, simdiMs: T0 + 1 }).gecerli,
			false,
		);
	} finally {
		kapat();
	}
});

test('sahip bir müşterinin bütün oturumlarını tek hamlede düşürüyor', () => {
	const { db, musteriId, kapat } = kur();
	try {
		const digerMusteri = musteriEkle(db, 'Başka Müşteri');
		oturumAc(db, { musteriId, simdiMs: T0 });
		oturumAc(db, { musteriId, simdiMs: T0 + 1 });
		const kalan = oturumAc(db, { musteriId: digerMusteri, simdiMs: T0 + 2 });

		assert.equal(musteriOturumlariniKapat(db, musteriId), 2);
		assert.equal(oturumOku(db, { karma: kalan.karma, simdiMs: T0 + 3 }).gecerli, true);
	} finally {
		kapat();
	}
});

test('eskimiş oturumlar toplanıyor', () => {
	const { db, musteriId, kapat } = kur();
	try {
		oturumAc(db, { musteriId, simdiMs: T0 });
		const taze = oturumAc(db, { musteriId, simdiMs: T0 + MUTLAK_MS });
		const silinen = eskimisOturumlariTemizle(db, T0 + MUTLAK_MS + 1000);
		assert.equal(silinen, 1);
		assert.equal(
			oturumOku(db, { karma: taze.karma, simdiMs: T0 + MUTLAK_MS + 1000 }).gecerli,
			true,
		);
	} finally {
		kapat();
	}
});

test('bilinmeyen karma geçerli sayılmıyor', () => {
	const { db, kapat } = kur();
	try {
		const uydurma = createHash('sha256').update('uydurma-oturum').digest();
		assert.equal(oturumOku(db, { karma: uydurma, simdiMs: T0 }).gecerli, false);
		assert.equal(oturumOku(db, { karma: null, simdiMs: T0 }).gecerli, false);
	} finally {
		kapat();
	}
});

test('bozuk çerez değeri karmaya çevrilmiyor', () => {
	assert.equal(oturumKarmasi(''), null);
	assert.equal(oturumKarmasi('kisa'), null);
	assert.equal(oturumKarmasi(null), null);
	/* Doğru uzunlukta ama 32 bayt etmeyen bir dize de reddediliyor. */
	assert.equal(oturumKarmasi('a'.repeat(41)), null);
});

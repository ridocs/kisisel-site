/*
  Destek talepleri ve müşteri yalıtımı.

  Bu dosyadaki en önemli test "bir müşteri diğerinin talebini göremiyor".
  Talep kimliği tahmin edilemez olsa bile yetki modeli "kimliği bilen görür"
  olamaz; süzgeç her sorguda.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	METIN_EN_COK,
	acikTalepSayisi,
	isDurumEtiketi,
	isleriListele,
	mesajYaz,
	talepAc,
	talepGetir,
	talepleriListele,
} from './sunucu/talepler.mjs';
import { geciciPanel, isEkle, musteriEkle } from './test-destek.mjs';

const T0 = Date.parse('2026-09-23T09:00:00.000Z');

function ikiMusteri() {
	const panel = geciciPanel();
	return {
		...panel,
		ayse: musteriEkle(panel.db, 'Ayşe Yılmaz'),
		bora: musteriEkle(panel.db, 'Bora Şahin'),
	};
}

test('talep açılıyor ve ilk mesajla birlikte kaydediliyor', () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		const sonuc = talepAc(db, {
			musteriId: ayse,
			baslik: 'Teslim tarihi',
			metin: 'Teslimin ne zaman olacağını öğrenebilir miyim?',
			simdiMs: T0,
		});
		assert.equal(sonuc.tamam, true);

		const talep = talepGetir(db, ayse, sonuc.talepId);
		assert.equal(talep.baslik, 'Teslim tarihi');
		assert.equal(talep.durum, 'acik');
		assert.equal(talep.mesajlar.length, 1);
		assert.equal(talep.mesajlar[0].yazan, 'musteri');
	} finally {
		kapat();
	}
});

test('BİR MÜŞTERİ DİĞERİNİN TALEBİNİ GÖREMİYOR', () => {
	const { db, ayse, bora, kapat } = ikiMusteri();
	try {
		const ayseninTalebi = talepAc(db, {
			musteriId: ayse,
			baslik: 'Gizli konu',
			metin: 'Bu yalnızca Ayşe ile aramızda.',
			simdiMs: T0,
		});
		assert.equal(ayseninTalebi.tamam, true);

		/* Bora talebin kimliğini bilse bile okuyamıyor. */
		assert.equal(talepGetir(db, bora, ayseninTalebi.talepId), null);

		/* Listede de görünmüyor. */
		assert.deepEqual(talepleriListele(db, bora), []);
		assert.equal(talepleriListele(db, ayse).length, 1);

		/* Sayım da sızdırmıyor. */
		assert.equal(acikTalepSayisi(db, bora), 0);
		assert.equal(acikTalepSayisi(db, ayse), 1);
	} finally {
		kapat();
	}
});

test('bir müşteri diğerinin talebine mesaj YAZAMIYOR', () => {
	const { db, ayse, bora, kapat } = ikiMusteri();
	try {
		const talep = talepAc(db, {
			musteriId: ayse,
			baslik: 'Revizyon',
			metin: 'Küçük bir düzeltme istiyorum.',
			simdiMs: T0,
		});

		const deneme = mesajYaz(db, {
			musteriId: bora,
			talepId: talep.talepId,
			metin: 'Araya giriyorum.',
			simdiMs: T0 + 1000,
		});
		assert.equal(deneme.tamam, false);

		/* Mesaj gerçekten yazılmamış. */
		const okunan = talepGetir(db, ayse, talep.talepId);
		assert.equal(okunan.mesajlar.length, 1);
	} finally {
		kapat();
	}
});

test('olmayan talep ile başkasının talebi aynı cevabı veriyor', () => {
	const { db, ayse, bora, kapat } = ikiMusteri();
	try {
		const talep = talepAc(db, { musteriId: ayse, baslik: 'Konu', metin: 'Metin', simdiMs: T0 });
		const baskasininki = mesajYaz(db, {
			musteriId: bora,
			talepId: talep.talepId,
			metin: 'Merhaba',
			simdiMs: T0,
		});
		const hicYok = mesajYaz(db, {
			musteriId: bora,
			talepId: 'boyle-bir-kimlik-yok',
			metin: 'Merhaba',
			simdiMs: T0,
		});
		assert.deepEqual(baskasininki, hicYok);
	} finally {
		kapat();
	}
});

test('kendi talebine mesaj yazınca talep yeniden açılıyor', () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		const talep = talepAc(db, { musteriId: ayse, baslik: 'Konu', metin: 'İlk mesaj', simdiMs: T0 });
		db.prepare('UPDATE talep SET durum = ? WHERE id = ?').run('yanitlandi', talep.talepId);

		const sonuc = mesajYaz(db, {
			musteriId: ayse,
			talepId: talep.talepId,
			metin: 'Teşekkürler, bir sorum daha var.',
			simdiMs: T0 + 60000,
		});
		assert.equal(sonuc.tamam, true);

		const okunan = talepGetir(db, ayse, talep.talepId);
		assert.equal(okunan.durum, 'acik');
		assert.equal(okunan.mesajlar.length, 2);
	} finally {
		kapat();
	}
});

test('kapanmış talebe mesaj yazılamıyor', () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		const talep = talepAc(db, { musteriId: ayse, baslik: 'Konu', metin: 'İlk mesaj', simdiMs: T0 });
		db.prepare('UPDATE talep SET durum = ? WHERE id = ?').run('kapandi', talep.talepId);
		const sonuc = mesajYaz(db, {
			musteriId: ayse,
			talepId: talep.talepId,
			metin: 'Bir şey daha',
			simdiMs: T0 + 1000,
		});
		assert.equal(sonuc.tamam, false);
	} finally {
		kapat();
	}
});

test('boş ve aşırı uzun girdiler reddediliyor', () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		assert.equal(talepAc(db, { musteriId: ayse, baslik: 'ab', metin: 'metin', simdiMs: T0 }).tamam, false);
		assert.equal(talepAc(db, { musteriId: ayse, baslik: 'Başlık', metin: '   ', simdiMs: T0 }).tamam, false);
		assert.equal(
			talepAc(db, {
				musteriId: ayse,
				baslik: 'Başlık',
				metin: 'x'.repeat(METIN_EN_COK + 1),
				simdiMs: T0,
			}).tamam,
			false,
		);
		/* Reddedilen talep kısmen bile yazılmıyor. */
		assert.equal(db.prepare('SELECT COUNT(*) AS n FROM talep').get().n, 0);
		assert.equal(db.prepare('SELECT COUNT(*) AS n FROM talep_mesaji').get().n, 0);
	} finally {
		kapat();
	}
});

test('başka müşterinin işine talep bağlanamıyor', () => {
	const { db, ayse, bora, kapat } = ikiMusteri();
	try {
		const boraninIsi = isEkle(db, { musteriId: bora, ad: 'Bora için katalog' });
		const sonuc = talepAc(db, {
			musteriId: ayse,
			baslik: 'Bağlama denemesi',
			metin: 'Bu işe bağlamak istiyorum.',
			isId: boraninIsi,
			simdiMs: T0,
		});
		assert.equal(sonuc.tamam, false);
		assert.equal(db.prepare('SELECT COUNT(*) AS n FROM talep').get().n, 0);
	} finally {
		kapat();
	}
});

test('iş listesi yalnızca kendi işlerini veriyor ve tutar içermiyor', () => {
	const { db, ayse, bora, kapat } = ikiMusteri();
	try {
		isEkle(db, { musteriId: ayse, ad: 'Ayşe için site', durum: 'suruyor' });
		isEkle(db, { musteriId: bora, ad: 'Bora için katalog', durum: 'teklif' });

		const ayseninkiler = isleriListele(db, ayse);
		assert.equal(ayseninkiler.length, 1);
		assert.equal(ayseninkiler[0].ad, 'Ayşe için site');

		/* Dönen satırda mali hiçbir alan yok; tabloda da yok. */
		for (const yasak of ['tutar', 'tutar_kurus', 'odenen', 'on_odeme_orani']) {
			assert.ok(!(yasak in ayseninkiler[0]), `${yasak} sızdı`);
		}
		assert.equal(isDurumEtiketi('suruyor'), 'Sürüyor');
		/* Bilinmeyen durum olduğu gibi gösteriliyor, kaybolmuyor. */
		assert.equal(isDurumEtiketi('yeni_bir_durum'), 'yeni_bir_durum');
	} finally {
		kapat();
	}
});

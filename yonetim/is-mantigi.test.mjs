/*
  Saf iş mantığının testleri. Electron gerektirmiyor, SQLite'a dokunmuyor.

  Çalıştırma: node --test yonetim/is-mantigi.test.mjs
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	ayaDusuyorMu,
	davetEsitlemeKaydi,
	isEsitlemeKaydi,
	isGirdisiHazirla,
	isHesabi,
	isinAyi,
	istatistikHesapla,
	kurusBicimle,
	kurusGirdiye,
	kuyrukGovdesiSuz,
	musteriEsitlemeKaydi,
	musteriGirdisiHazirla,
	odemeGirdisiHazirla,
	tcGecerliMi,
	tlKurusaCevir,
	vergiGecerliMi,
} from './is-mantigi.mjs';

/* ------------------------------------------------------------------ */
/* Para                                                                */
/* ------------------------------------------------------------------ */

test('TL metni kuruşa çevriliyor', () => {
	assert.equal(tlKurusaCevir('0'), 0);
	assert.equal(tlKurusaCevir(''), 0);
	assert.equal(tlKurusaCevir('100'), 10_000);
	assert.equal(tlKurusaCevir('100,50'), 10_050);
	assert.equal(tlKurusaCevir('100.50'), 10_050, 'nokta ile ondalık da kabul edilmeli');
	assert.equal(tlKurusaCevir('1.250,50'), 125_050, 'Türkçe binlik ayracı');
	assert.equal(tlKurusaCevir('1,250.50'), 125_050, 'İngilizce binlik ayracı');
	assert.equal(tlKurusaCevir('12.500'), 1_250_000, 'üç basamak ondalık değil binliktir');
	assert.equal(tlKurusaCevir('100,5'), 10_050, 'tek basamak ondalık onluk kuruş');
	assert.equal(tlKurusaCevir('1 250,75 TL'), 125_075);
	assert.equal(tlKurusaCevir('-50,25'), -5025);
});

test('okunamayan tutar sessizce sıfıra düşmüyor', () => {
	for (const bozuk of ['abc', '12a', '--5', '1,2,3,4x']) {
		assert.equal(tlKurusaCevir(bozuk), null, `reddedilmeliydi: ${bozuk}`);
	}
});

test('kuruş TL olarak biçimleniyor', () => {
	assert.equal(kurusBicimle(0), '0,00');
	assert.equal(kurusBicimle(5), '0,05');
	assert.equal(kurusBicimle(10_050), '100,50');
	assert.equal(kurusBicimle(125_050), '1.250,50');
	assert.equal(kurusBicimle(123_456_789), '1.234.567,89');
	assert.equal(kurusBicimle(-5025), '-50,25');
});

test('para gidiş dönüşte bozulmuyor', () => {
	for (const kurus of [0, 1, 99, 100, 12_345, 999_999_99, -4250]) {
		assert.equal(tlKurusaCevir(kurusGirdiye(kurus)), kurus, `bozuldu: ${kurus}`);
	}
});

/* ------------------------------------------------------------------ */
/* İş hesabı                                                           */
/* ------------------------------------------------------------------ */

const ORNEK_IS = { id: 'i1', tutar_kurus: 1_000_000, on_odeme_orani: 40, durum: 'suruyor' };

test('tahsil edilen ve kalan ödemelerden hesaplanıyor', () => {
	const hesap = isHesabi(ORNEK_IS, [
		{ tur: 'on_odeme', tutar_kurus: 400_000 },
		{ tur: 'ara_odeme', tutar_kurus: 200_000 },
	]);
	assert.equal(hesap.toplamKurus, 1_000_000);
	assert.equal(hesap.tahsilEdilenKurus, 600_000);
	assert.equal(hesap.kalanKurus, 400_000);
});

test('ön ödeme oranı işin kendi tutarından hesaplanıyor', () => {
	const hesap = isHesabi(ORNEK_IS, [{ tur: 'on_odeme', tutar_kurus: 400_000 }], [
		{ ucretli: 1, tutar_kurus: 500_000 },
	]);
	// Revize sonradan çıktı; geçmişte alınan ön ödemeyi eksik göstermemeli.
	assert.equal(hesap.onOdemeBeklenenKurus, 400_000);
	assert.equal(hesap.onOdemeAlinanKurus, 400_000);
	assert.equal(hesap.onOdemeTamamMi, true);
	// Ama toplam ve kalan revizeyi kapsamalı.
	assert.equal(hesap.toplamKurus, 1_500_000);
	assert.equal(hesap.kalanKurus, 1_100_000);
});

test('ön ödeme oranı yoksa beklenen tutar hesaplanmıyor', () => {
	const hesap = isHesabi({ ...ORNEK_IS, on_odeme_orani: null }, []);
	assert.equal(hesap.onOdemeBeklenenKurus, null);
	assert.equal(hesap.onOdemeTamamMi, null);
});

test('ön ödeme oranı kuruş artığı olsa bile tam sayı kalıyor', () => {
	// 1.234,57 TL üzerinden %45: ondalık aritmetik burada kayar.
	const hesap = isHesabi({ tutar_kurus: 123_457, on_odeme_orani: 45 }, []);
	assert.equal(hesap.onOdemeBeklenenKurus, 55_556);
	assert.ok(Number.isInteger(hesap.onOdemeBeklenenKurus));
});

test('ücretsiz revize tutara girmiyor, ücretli giriyor', () => {
	const hesap = isHesabi(ORNEK_IS, [], [
		{ ucretli: 0, tutar_kurus: 999_999 },
		{ ucretli: 1, tutar_kurus: 250_000 },
	]);
	assert.equal(hesap.revizeKurus, 250_000);
	assert.equal(hesap.toplamKurus, 1_250_000);
});

test('iade tahsilatı geri alıyor', () => {
	const hesap = isHesabi(ORNEK_IS, [
		{ tur: 'on_odeme', tutar_kurus: 400_000 },
		{ tur: 'iade', tutar_kurus: 150_000 },
	]);
	assert.equal(hesap.tahsilEdilenKurus, 250_000);
	assert.equal(hesap.kalanKurus, 750_000);
	// İade, alınmış ön ödemeyi de eksiltmemeli: o ayrı bir soru.
	assert.equal(hesap.onOdemeAlinanKurus, 400_000);
});

test('iade eksi yazılmış olsa bile iki kez eksilmiyor', () => {
	const hesap = isHesabi(ORNEK_IS, [
		{ tur: 'on_odeme', tutar_kurus: 400_000 },
		{ tur: 'iade', tutar_kurus: -150_000 },
	]);
	assert.equal(hesap.tahsilEdilenKurus, 250_000);
});

test('fazla ödeme kalanı eksiye düşürüyor', () => {
	const hesap = isHesabi(ORNEK_IS, [{ tur: 'son_odeme', tutar_kurus: 1_200_000 }]);
	assert.equal(hesap.kalanKurus, -200_000);
});

/* ------------------------------------------------------------------ */
/* Ay sınırları                                                        */
/* ------------------------------------------------------------------ */

test('ay sınırları: ilk ve son gün İÇERİDE, komşu günler dışarıda', () => {
	assert.equal(ayaDusuyorMu('2026-09-01', '2026-09'), true, 'ayın ilk günü içeride olmalı');
	assert.equal(ayaDusuyorMu('2026-09-30', '2026-09'), true, 'ayın son günü içeride olmalı');
	assert.equal(ayaDusuyorMu('2026-08-31', '2026-09'), false);
	assert.equal(ayaDusuyorMu('2026-10-01', '2026-09'), false);
	// Tam ISO damgası da aynı kuralla süzülmeli.
	assert.equal(ayaDusuyorMu('2026-09-01T00:00:00.000Z', '2026-09'), true);
	assert.equal(ayaDusuyorMu('2026-09-30T23:59:59.999Z', '2026-09'), true);
	assert.equal(ayaDusuyorMu(null, '2026-09'), false);
});

test('işin ayı teslim, yoksa başlangıç, yoksa oluşturulma', () => {
	assert.equal(isinAyi({ teslim: '2026-09-10', baslangic: '2026-07-01' }), '2026-09');
	assert.equal(isinAyi({ teslim: null, baslangic: '2026-07-01' }), '2026-07');
	assert.equal(isinAyi({ olusturuldu: '2026-05-04T10:00:00.000Z' }), '2026-05');
	assert.equal(isinAyi({}), null);
});

/* ------------------------------------------------------------------ */
/* İstatistik                                                          */
/* ------------------------------------------------------------------ */

const AY = '2026-09';

const ISLER = [
	{ id: 'i1', tur: 'Web sitesi', durum: 'teslim_edildi', tutar_kurus: 1_000_000, on_odeme_orani: 40, tekrar_eden: 0, teslim: '2026-09-01' },
	{ id: 'i2', tur: 'CAD', durum: 'suruyor', tutar_kurus: 500_000, on_odeme_orani: 50, tekrar_eden: 1, teslim: '2026-09-30' },
	{ id: 'i3', tur: 'Web sitesi', durum: 'kapandi', tutar_kurus: 300_000, on_odeme_orani: null, tekrar_eden: 0, teslim: '2026-08-31' },
	{ id: 'i4', tur: 'Bakım', durum: 'suruyor', tutar_kurus: 700_000, on_odeme_orani: null, tekrar_eden: 1, teslim: '2026-10-01' },
	{ id: 'i5', tur: 'CAD', durum: 'iptal', tutar_kurus: 900_000, on_odeme_orani: null, tekrar_eden: 0, teslim: '2026-09-15' },
];

const ODEMELER = [
	{ is_id: 'i1', tur: 'on_odeme', tutar_kurus: 400_000, tarih: '2026-09-01' },
	{ is_id: 'i2', tur: 'on_odeme', tutar_kurus: 250_000, tarih: '2026-09-30' },
	{ is_id: 'i3', tur: 'on_odeme', tutar_kurus: 100_000, tarih: '2026-08-31' },
	{ is_id: 'i4', tur: 'on_odeme', tutar_kurus: 350_000, tarih: '2026-10-01' },
	{ is_id: 'i1', tur: 'ara_odeme', tutar_kurus: 100_000, tarih: '2026-09-20' },
];

test('aylık ön ödeme toplamı yalnızca o ayın ödemelerini sayıyor', () => {
	const s = istatistikHesapla({ ay: AY, isler: ISLER, odemeler: ODEMELER });
	// 400.000 (1 Eylül) + 250.000 (30 Eylül). 31 Ağustos ve 1 Ekim dışarıda.
	assert.equal(s.aylikYapilanOnOdemeKurus, 650_000);
});

test('aylık toplam alınacak ve kalan tutar iptali saymıyor', () => {
	const s = istatistikHesapla({ ay: AY, isler: ISLER, odemeler: ODEMELER });
	// Ayın işleri: i1 ve i2. i5 iptal, i3 ile i4 başka ay.
	assert.equal(s.ayinIsSayisi, 2);
	assert.equal(s.aylikToplamAlinacakKurus, 1_500_000);
	// i1: 1.000.000 - 500.000 = 500.000, i2: 500.000 - 250.000 = 250.000
	assert.equal(s.aylikKalanKurus, 750_000);
});

test('aylık tahsilat iadeyi düşüyor', () => {
	const s = istatistikHesapla({
		ay: AY,
		isler: ISLER,
		odemeler: [...ODEMELER, { is_id: 'i1', tur: 'iade', tutar_kurus: 50_000, tarih: '2026-09-25' }],
	});
	// 400.000 + 250.000 + 100.000 - 50.000
	assert.equal(s.aylikTahsilatKurus, 700_000);
});

test('tür dağılımı ve tekrar eden işler sayılıyor', () => {
	const s = istatistikHesapla({ ay: AY, isler: ISLER, odemeler: ODEMELER });
	assert.deepEqual(s.turDagilimi, [
		{ tur: 'CAD', adet: 1 },
		{ tur: 'Web sitesi', adet: 1 },
	]);
	assert.equal(s.tekrarEdenSayisi, 1);
});

test('türü girilmemiş iş "Belirtilmemiş" altında toplanıyor', () => {
	const s = istatistikHesapla({
		ay: AY,
		isler: [{ id: 'x', tur: '  ', durum: 'suruyor', tutar_kurus: 0, teslim: '2026-09-05' }],
	});
	assert.deepEqual(s.turDagilimi, [{ tur: 'Belirtilmemiş', adet: 1 }]);
});

test('müşteri ve talep sayıları', () => {
	const s = istatistikHesapla({
		ay: AY,
		musteriler: [
			{ id: 'm1', durum: 'etkin', olusturuldu: '2026-09-02T09:00:00.000Z' },
			{ id: 'm2', durum: 'askida', olusturuldu: '2025-01-01T09:00:00.000Z' },
			{ id: 'm3', durum: 'arsiv', olusturuldu: '2026-09-29T23:00:00.000Z' },
		],
		talepler: [
			{ id: 't1', durum: 'acik' },
			{ id: 't2', durum: 'islemde' },
			{ id: 't3', durum: 'kapandi' },
		],
	});
	assert.equal(s.musteriSayisi, 2, 'arşivdekiler sayılmamalı');
	assert.equal(s.arsivMusteriSayisi, 1);
	assert.equal(s.ayinYeniMusterisi, 2);
	assert.equal(s.acikTalepSayisi, 2);
});

test('boş veriyle istatistik sıfırlarla dönüyor, çökmüyor', () => {
	const s = istatistikHesapla({ ay: AY });
	assert.equal(s.aylikToplamAlinacakKurus, 0);
	assert.equal(s.aylikKalanKurus, 0);
	assert.equal(s.aylikYapilanOnOdemeKurus, 0);
	assert.deepEqual(s.turDagilimi, []);
});

/* ------------------------------------------------------------------ */
/* Eşitleme kuyruğu: hassas veri sızmıyor                              */
/* ------------------------------------------------------------------ */

test('müşteri eşitleme kaydında yalnızca görünen ad ve durum var', () => {
	const { islem, govde } = musteriEsitlemeKaydi({
		id: 'm1',
		ad_soyad: 'Ayşe Yılmaz',
		durum: 'etkin',
	});
	assert.equal(islem, 'musteri.yaz');
	assert.deepEqual(Object.keys(govde).sort(), ['durum', 'gorunen_ad', 'id']);
});

test('arşivdeki müşteri sunucuya "kapali" olarak gidiyor', () => {
	assert.equal(musteriEsitlemeKaydi({ id: 'm', ad_soyad: 'A', durum: 'arsiv' }).govde.durum, 'kapali');
	assert.equal(musteriEsitlemeKaydi({ id: 'm', ad_soyad: 'A', durum: 'askida' }).govde.durum, 'kapali');
	assert.equal(musteriEsitlemeKaydi({ id: 'm', ad_soyad: 'A', durum: 'etkin' }).govde.durum, 'etkin');
});

test('iş eşitleme kaydında tutar ve oran YOK', () => {
	const { govde } = isEsitlemeKaydi({
		id: 'i1',
		musteri_id: 'm1',
		ad: 'Site yenileme',
		durum: 'suruyor',
	});
	assert.deepEqual(Object.keys(govde).sort(), ['ad', 'durum', 'id', 'musteri_id']);
});

test('davet kaydında anahtarın kendisi değil karması var', () => {
	const { govde } = davetEsitlemeKaydi({
		id: 'd1',
		musteriId: 'm1',
		anahtarKarmasiHex: 'a'.repeat(64),
		sonKullanma: '2026-10-01T00:00:00.000Z',
	});
	assert.equal(govde.anahtar_karmasi, 'a'.repeat(64));
	assert.ok(!('anahtar' in govde), 'ham anahtar alanı olmamalı');
	assert.ok(!('metin' in govde), 'anahtar metni olmamalı');
});

test('kuyruğa hassas alan yazılmaya çalışılırsa hata fırlıyor', () => {
	const denemeler = [
		['musteri.yaz', { id: 'm', gorunen_ad: 'A', tc: '10000000146' }],
		['musteri.yaz', { id: 'm', gorunen_ad: 'A', telefon: '05550000000' }],
		['musteri.yaz', { id: 'm', gorunen_ad: 'A', sehir: 'Ankara' }],
		/*
		  `tutar_kurus` BURADAN ÇIKARILDI: 24 Eylül 2026'dan beri izinli.
		  Müşteri kendi ödeme dökümünü panelde görüyor, dolayısıyla tutar
		  sunucuya çıkıyor. İşin iç yüzü hâlâ yasak ve aşağıdakiler onu
		  sınıyor.
		*/
		['is.yaz', { id: 'i', musteri_id: 'm', ad: 'x', durum: 'suruyor', on_odeme_orani: 40 }],
		['is.yaz', { id: 'i', musteri_id: 'm', ad: 'x', durum: 'suruyor', not_metni: 'iç not' }],
		['odeme.yaz', { id: 'o', is_id: 'i', tur: 'on_odeme', tutar_kurus: 100, tarih: '2026-09-20', yontem: 'nakit' }],
		['davet.yaz', { id: 'd', musteri_id: 'm', anahtar_karmasi: 'ab', vergi_no: '1234567890' }],
	];
	for (const [islem, govde] of denemeler) {
		assert.throws(
			() => kuyrukGovdesiSuz(islem, govde),
			/izinsiz alan|Hassas alan/,
			`sızmamalıydı: ${islem} ${JSON.stringify(govde)}`,
		);
	}
});

test('bilinmeyen işlem kuyruğa giremiyor', () => {
	/*
	  `odeme.yaz` buradan ÇIKARILDI: artık tanınan bir işlem, müşterinin ödeme
	  dökümü onunla gidiyor. Yerine hâlâ tanınmayanlar kondu: revize kaydı ve
	  istatistikler sunucuya hiç çıkmıyor.
	*/
	assert.throws(() => kuyrukGovdesiSuz('revize.yaz', { id: 'x' }), /Bilinmeyen eşitleme işlemi/);
	assert.throws(() => kuyrukGovdesiSuz('istatistik.yaz', { id: 'x' }), /Bilinmeyen eşitleme işlemi/);
	assert.throws(() => kuyrukGovdesiSuz('musteri.hepsiniVer', { id: 'x' }), /Bilinmeyen eşitleme işlemi/);
});

test('kuyruk gövdesi iç içe nesne kabul etmiyor', () => {
	// İç içe nesne, izinli bir adın altına hassas veri saklamanın en kolay yolu.
	assert.throws(
		() => kuyrukGovdesiSuz('musteri.yaz', { id: 'm', gorunen_ad: { ad: 'A', tc: '123' } }),
		/düz değer/,
	);
});

/* ------------------------------------------------------------------ */
/* Doğrulama                                                           */
/* ------------------------------------------------------------------ */

test('TC kimlik numarası algoritması', () => {
	assert.equal(tcGecerliMi('10000000146'), true);
	assert.equal(tcGecerliMi(''), true, 'boş bırakmak serbest');
	assert.equal(tcGecerliMi('10000000145'), false, 'son hane bozuk');
	assert.equal(tcGecerliMi('00000000146'), false, 'sıfırla başlayamaz');
	assert.equal(tcGecerliMi('1234567890'), false, '10 hane');
	assert.equal(tcGecerliMi('abcdefghijk'), false);
});

test('vergi numarası 10 hane ya da geçerli TC', () => {
	assert.equal(vergiGecerliMi('1234567890'), true);
	assert.equal(vergiGecerliMi('10000000146'), true);
	assert.equal(vergiGecerliMi('123456789'), false);
	assert.equal(vergiGecerliMi(''), true);
});

test('müşteri formu adsız kaydedilmiyor', () => {
	const { kayit, hatalar } = musteriGirdisiHazirla({ ad_soyad: '   ' });
	assert.equal(kayit, null);
	assert.ok(hatalar.some((h) => h.includes('Ad soyad')));
});

test('iş formu okunamayan tutarı reddediyor', () => {
	const { kayit, hatalar } = isGirdisiHazirla({
		musteri_id: 'm1',
		ad: 'İş',
		durum: 'teklif',
		tutar: 'yüz lira',
	});
	assert.equal(kayit, null);
	assert.ok(hatalar.some((h) => h.includes('Tutar')));
});

test('iş formu teslimi başlangıçtan önce olanı reddediyor', () => {
	const { hatalar } = isGirdisiHazirla({
		musteri_id: 'm1',
		ad: 'İş',
		durum: 'teklif',
		tutar: '100',
		baslangic: '2026-09-10',
		teslim: '2026-09-01',
	});
	assert.ok(hatalar.some((h) => h.includes('Teslim')));
});

test('iş formu geçerli girdiyi kuruşa çevirip kayda dönüştürüyor', () => {
	const { kayit, hatalar } = isGirdisiHazirla({
		musteri_id: 'm1',
		ad: '  Site yenileme  ',
		durum: 'suruyor',
		tutar: '12.500,75',
		on_odeme_orani: '45',
		tekrar_eden: 1,
		baslangic: '2026-09-01',
		teslim: '',
	});
	assert.deepEqual(hatalar, []);
	assert.equal(kayit.ad, 'Site yenileme');
	assert.equal(kayit.tutar_kurus, 1_250_075);
	assert.equal(kayit.on_odeme_orani, 45);
	assert.equal(kayit.tekrar_eden, 1);
	assert.equal(kayit.teslim, null);
});

test('ödeme formu sıfır tutarı ve tarihsizi reddediyor', () => {
	assert.ok(
		odemeGirdisiHazirla({ is_id: 'i1', tur: 'on_odeme', tutar: '0', tarih: '2026-09-01' })
			.hatalar.length > 0,
	);
	assert.ok(
		odemeGirdisiHazirla({ is_id: 'i1', tur: 'on_odeme', tutar: '100', tarih: '' }).hatalar.length >
			0,
	);
});

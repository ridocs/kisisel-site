/*
  İş detayı: ödeme hesabı, müşteri yalıtımı, teslim gecikmesi ve iş bazlı
  yazışmanın canlı akışı.

  Bu dosyadaki iki test ötekilerden ağır basıyor:

  1. "BİR MÜŞTERİ DİĞERİNİN İŞİNİ GÖREMİYOR". İş kimliği tahmin edilemez olsa
     bile yetki modeli "kimliği bilen görür" olamaz; süzgeç her sorguda.
  2. "ÖDENEN TUTAR SATIRLARDAN HESAPLANIYOR". Veritabanında ayrı bir "ödenen"
     sütunu yok ve olmamalı: iki yerde tutulan sayı er geç ayrışır. Test
     iadeyi de kapsıyor, çünkü işaret hatası burada sessizce yanlış bir
     borç gösterir.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	acikIsSayisi,
	asamalariListele,
	bekleyenYanitSayisi,
	isDetayGetir,
	isGetir,
	isMesajiYaz,
	isMesajlariListele,
	isleriOzetle,
	odemeDokumu,
	teslimDurumu,
} from './sunucu/isler.mjs';
import { isAkisYaniti, isSahibiMi } from './sunucu/is-canli.mjs';
import { para } from './sunucu/bicim.mjs';
import {
	asamaEkle,
	dosyaEkle,
	geciciPanel,
	isEkle,
	isSahipMesaji,
	musteriEkle,
	sahipMesaji,
	odemeEkle,
} from './test-destek.mjs';
import { talepAc } from './sunucu/talepler.mjs';

const T0 = Date.parse('2026-09-24T09:00:00.000Z');
const T0_ISO = new Date(T0).toISOString();

function ikiMusteri() {
	const panel = geciciPanel();
	return {
		...panel,
		ayse: musteriEkle(panel.db, 'Ayşe Yılmaz'),
		bora: musteriEkle(panel.db, 'Bora Şahin'),
	};
}

/* ---------- Ödeme hesabı ---------- */

test('ÖDENEN TUTAR SATIRLARDAN HESAPLANIYOR, İADE EKSİ YÖNDE', () => {
	const dokum = odemeDokumu(500000, [
		{ tur: 'on_odeme', tutar_kurus: 150000 },
		{ tur: 'ara_odeme', tutar_kurus: 200000 },
		{ tur: 'iade', tutar_kurus: 50000 },
	]);
	assert.equal(dokum.toplam, 500000);
	/* 1500 + 2000 - 500 = 3000 TL */
	assert.equal(dokum.odenen, 300000);
	assert.equal(dokum.kalan, 200000);
	assert.equal(dokum.fazla, 0);
	assert.equal(dokum.kapandiMi, false);
});

test('iade eksi tutarla yazılmış olsa da bir kez düşülüyor', () => {
	/*
	  Sahip tarafı iadeyi iki türlü kaydedebiliyor: eksi tutarla ya da artı
	  tutar artı `tur = 'iade'`. İkisi de aynı sonucu vermek zorunda; aksi
	  hâlde eksi yazılmış bir iade iki kez düşerdi.
	*/
	const artiyla = odemeDokumu(100000, [
		{ tur: 'on_odeme', tutar_kurus: 100000 },
		{ tur: 'iade', tutar_kurus: 30000 },
	]);
	const eksiyle = odemeDokumu(100000, [
		{ tur: 'on_odeme', tutar_kurus: 100000 },
		{ tur: 'iade', tutar_kurus: -30000 },
	]);
	assert.equal(artiyla.odenen, 70000);
	assert.deepEqual(eksiyle, artiyla);
});

test('ödeme yoksa kalan tutarın tamamı', () => {
	const dokum = odemeDokumu(125050, []);
	assert.equal(dokum.odenen, 0);
	assert.equal(dokum.kalan, 125050);
	assert.equal(dokum.kapandiMi, false);
});

test('tamamı ödenince kalan sıfır, fazla ödemede eksiye düşmüyor', () => {
	const tam = odemeDokumu(100000, [{ tur: 'son_odeme', tutar_kurus: 100000 }]);
	assert.equal(tam.kalan, 0);
	assert.equal(tam.fazla, 0);
	assert.equal(tam.kapandiMi, true);

	const fazla = odemeDokumu(100000, [{ tur: 'on_odeme', tutar_kurus: 130000 }]);
	assert.equal(fazla.kalan, -30000);
	assert.equal(fazla.fazla, 30000);
	assert.equal(fazla.kapandiMi, true);
});

test('kuruş TL gösterimine Türkçe biçimde çevriliyor', () => {
	/* İstenen biçim: binlik nokta, ondalık virgül, iki basamak her zaman. */
	assert.equal(para(125050), '1.250,50 ₺');
	assert.equal(para(125000), '1.250,00 ₺');
	assert.equal(para(0), '0,00 ₺');
	assert.equal(para(-30000), '-300,00 ₺');
	assert.equal(para(100000, 'EUR'), '1.000,00 €');
});

test('ödeme dökümü işin satırlarından okunuyor', () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		const isId = isEkle(db, { musteriId: ayse, ad: 'Kalıp tasarımı', tutarKurus: 450000 });
		odemeEkle(db, { isId, tur: 'on_odeme', tutarKurus: 150000, tarih: T0_ISO });
		odemeEkle(db, { isId, tur: 'iade', tutarKurus: 25000, tarih: T0_ISO });

		const detay = isDetayGetir(db, ayse, isId);
		assert.equal(detay.dokum.toplam, 450000);
		assert.equal(detay.dokum.odenen, 125000);
		assert.equal(detay.dokum.kalan, 325000);
		assert.equal(detay.odemeler.length, 2);
	} finally {
		kapat();
	}
});

/* ---------- Müşteri yalıtımı ---------- */

test('BİR MÜŞTERİ DİĞERİNİN İŞİNİ GÖREMİYOR', () => {
	const { db, ayse, bora, kapat } = ikiMusteri();
	try {
		const ayseninIsi = isEkle(db, {
			musteriId: ayse,
			ad: 'Gizli proje',
			tutarKurus: 900000,
			ozet: 'Bu yalnızca Ayşe ile aramızda.',
		});
		odemeEkle(db, { isId: ayseninIsi, tur: 'on_odeme', tutarKurus: 300000, tarih: T0_ISO });
		asamaEkle(db, { isId: ayseninIsi, baslik: 'Teklif verildi', tarih: T0_ISO });

		/* Bora işin kimliğini bilse bile okuyamıyor. */
		assert.equal(isGetir(db, bora, ayseninIsi), null);
		assert.equal(isDetayGetir(db, bora, ayseninIsi), null);

		/* Listede de görünmüyor, sayımda da. */
		assert.deepEqual(isleriOzetle(db, bora), []);
		assert.equal(isleriOzetle(db, ayse).length, 1);
		assert.equal(acikIsSayisi(db, bora), 0);
		assert.equal(acikIsSayisi(db, ayse), 1);

		/* Ayşe kendi işini eksiksiz görüyor: test yalıtımı ölçüyor, erişimi kırmıyor. */
		const detay = isDetayGetir(db, ayse, ayseninIsi);
		assert.equal(detay.is.ad, 'Gizli proje');
		assert.equal(detay.asamalar.length, 1);
	} finally {
		kapat();
	}
});

test('BAŞKA MÜŞTERİNİN İŞİNE MESAJ YAZILAMIYOR', () => {
	const { db, ayse, bora, kapat } = ikiMusteri();
	try {
		const ayseninIsi = isEkle(db, { musteriId: ayse, ad: 'Kalıp tasarımı' });

		const sonuc = isMesajiYaz(db, {
			musteriId: bora,
			isId: ayseninIsi,
			metin: 'Buraya yazamamam gerekiyor.',
			simdiMs: T0,
		});
		assert.equal(sonuc.tamam, false);
		/* Yanıt, iş hiç yokmuş gibi: varlığı bile söylenmiyor. */
		assert.equal(sonuc.hata, 'İş bulunamadı.');
		assert.deepEqual(isMesajlariListele(db, ayseninIsi), []);
	} finally {
		kapat();
	}
});

test('müşteri kendi işine mesaj yazabiliyor ve işin damgası ilerliyor', () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		const isId = isEkle(db, { musteriId: ayse, ad: 'Ölçü raporu', guncellendi: T0_ISO });
		const sonuc = isMesajiYaz(db, {
			musteriId: ayse,
			isId,
			metin: 'Ölçüleri gözden geçirebilir misiniz?',
			simdiMs: T0 + 60000,
		});
		assert.equal(sonuc.tamam, true);

		const mesajlar = isMesajlariListele(db, isId);
		assert.equal(mesajlar.length, 1);
		assert.equal(mesajlar[0].yazan, 'musteri');
		assert.equal(isGetir(db, ayse, isId).guncellendi, new Date(T0 + 60000).toISOString());
	} finally {
		kapat();
	}
});

test('boş mesaj kabul edilmiyor', () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		const isId = isEkle(db, { musteriId: ayse, ad: 'Ölçü raporu' });
		assert.equal(isMesajiYaz(db, { musteriId: ayse, isId, metin: '   ' }).tamam, false);
		assert.deepEqual(isMesajlariListele(db, isId), []);
	} finally {
		kapat();
	}
});

/* ---------- Teslim tarihi ve gecikme ---------- */

test('geçmiş teslim hedefi yalnızca AÇIK işte gecikme sayılıyor', () => {
	const gecmis = new Date(T0 - 5 * 86400000).toISOString();

	const acik = teslimDurumu({ durum: 'suruyor', teslim_hedefi: gecmis }, T0);
	assert.equal(acik.gecikti, true);
	assert.equal(acik.gunFarki, -5);

	/*
	  Teslim edilmiş bir işin geçmiş hedef tarihi bir uyarı değil, bir tarih.
	  Kapanmış işte gecikme uyarısı çıkarsa panel sürekli kırmızı olurdu.
	*/
	const kapali = teslimDurumu({ durum: 'kapandi', teslim_hedefi: gecmis }, T0);
	assert.equal(kapali.gecikti, false);
});

test('yaklaşan teslim üç gün kala işaretleniyor, hedefsiz iş işaretlenmiyor', () => {
	const ikiGunSonra = new Date(T0 + 2 * 86400000).toISOString();
	const onGunSonra = new Date(T0 + 10 * 86400000).toISOString();

	assert.equal(teslimDurumu({ durum: 'suruyor', teslim_hedefi: ikiGunSonra }, T0).yaklasti, true);
	assert.equal(teslimDurumu({ durum: 'suruyor', teslim_hedefi: onGunSonra }, T0).yaklasti, false);

	const hedefsiz = teslimDurumu({ durum: 'suruyor', teslim_hedefi: null }, T0);
	assert.equal(hedefsiz.var, false);
	assert.equal(hedefsiz.gecikti, false);
});

/* ---------- Pano özeti ---------- */

test('pano özeti her iş için kalan borcu satırlardan hesaplıyor', () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		const bir = isEkle(db, { musteriId: ayse, ad: 'İlk iş', tutarKurus: 200000 });
		const iki = isEkle(db, { musteriId: ayse, ad: 'İkinci iş', tutarKurus: 100000, durum: 'kapandi' });
		odemeEkle(db, { isId: bir, tur: 'on_odeme', tutarKurus: 50000, tarih: T0_ISO });
		odemeEkle(db, { isId: iki, tur: 'son_odeme', tutarKurus: 100000, tarih: T0_ISO });

		const ozet = isleriOzetle(db, ayse, T0);
		const birinci = ozet.find((is) => is.id === bir);
		const ikinci = ozet.find((is) => is.id === iki);
		assert.equal(birinci.dokum.kalan, 150000);
		assert.equal(ikinci.dokum.kalan, 0);
		assert.equal(ikinci.dokum.kapandiMi, true);
	} finally {
		kapat();
	}
});

test('bekleyen yanıt sayacı sahibin son sözünü sayıyor, müşterininkini değil', () => {
	const { db, ayse, bora, kapat } = ikiMusteri();
	try {
		/* Destek talebi: sahip yanıtladı, müşteri henüz dönmedi. */
		const talep = talepAc(db, {
			musteriId: ayse,
			baslik: 'Teslim tarihi',
			metin: 'Ne zaman biter?',
			simdiMs: T0,
		});
		sahipMesaji(db, { talepId: talep.talepId, metin: 'Önümüzdeki hafta.', simdiMs: T0 + 1000 });

		/* İş yazışması: sahip iki kez yazdı. */
		const isId = isEkle(db, { musteriId: ayse, ad: 'Kalıp' });
		isSahipMesaji(db, { isId, metin: 'Numune geldi.', simdiMs: T0 + 2000 });
		isSahipMesaji(db, { isId, metin: 'Fotoğrafı ekledim.', simdiMs: T0 + 3000 });

		assert.equal(bekleyenYanitSayisi(db, ayse), 3);
		/* Sayaç da sızdırmıyor. */
		assert.equal(bekleyenYanitSayisi(db, bora), 0);

		/* Müşteri dönünce sayaç sıfırlanıyor: son söz artık onda. */
		isMesajiYaz(db, { musteriId: ayse, isId, metin: 'Teşekkürler.', simdiMs: T0 + 4000 });
		assert.equal(bekleyenYanitSayisi(db, ayse), 1);
	} finally {
		kapat();
	}
});

/* ---------- Aşamalar ve dosya künyeleri ---------- */

test('aşamalar önce sıraya, sonra tarihe göre diziliyor', () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		const isId = isEkle(db, { musteriId: ayse, ad: 'Kalıp' });
		asamaEkle(db, { isId, sira: 2, baslik: 'İmalat', tarih: new Date(T0).toISOString() });
		asamaEkle(db, {
			isId,
			sira: 1,
			kaynak: 'otomatik',
			baslik: 'Ön ödeme alındı',
			/* Geçmişe dönük eklenmiş bir aşama: sıra ile tarih burada ayrışıyor. */
			tarih: new Date(T0 + 86400000).toISOString(),
		});

		const asamalar = asamalariListele(db, isId);
		assert.deepEqual(
			asamalar.map((a) => a.baslik),
			['Ön ödeme alındı', 'İmalat'],
		);
		assert.equal(asamalar[0].kaynak, 'otomatik');
		assert.equal(asamalar[1].kaynak, 'elle');
	} finally {
		kapat();
	}
});

test('dosya künyesi aşamaya bağlanabiliyor ve iş detayıyla birlikte geliyor', () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		const isId = isEkle(db, { musteriId: ayse, ad: 'Kalıp' });
		const asamaId = asamaEkle(db, { isId, baslik: 'Teknik resim', tarih: T0_ISO });
		dosyaEkle(db, {
			isId,
			asamaId,
			gosterilenAd: 'teknik-resim.pdf',
			tur: 'application/pdf',
			boyut: 204800,
		});

		const detay = isDetayGetir(db, ayse, isId);
		assert.equal(detay.dosyalar.length, 1);
		assert.equal(detay.dosyalar[0].gosterilen_ad, 'teknik-resim.pdf');
		assert.equal(detay.dosyalar[0].asama_id, asamaId);
		/*
		  Diskteki ad iş detayına ÇIKMIYOR: sayfada yalnızca kimlik ve
		  gösterilen ad var, indirme yolu sunucuda kuruluyor.
		*/
		assert.equal(detay.dosyalar[0].depo_adi, undefined);
	} finally {
		kapat();
	}
});

/* ---------- İş yazışmasının canlı akışı ---------- */

/** Kapanmış bir akışın gövdesini sonuna kadar okuyor. */
async function govdeMetni(yanit) {
	const cozucu = new TextDecoder();
	const okuyucu = yanit.body.getReader();
	let metin = '';
	while (true) {
		const { done, value } = await okuyucu.read();
		if (done) break;
		metin += cozucu.decode(value, { stream: true });
	}
	return metin + cozucu.decode();
}

/** SSE metnini olaylara ayırıyor. `retry:` satırı olay değil, eleniyor. */
function olaylariCoz(metin) {
	return metin
		.split('\n\n')
		.map((blok) => {
			const satirlar = blok.split('\n');
			const adSatiri = satirlar.find((s) => s.startsWith('event: '));
			const veriSatiri = satirlar.find((s) => s.startsWith('data: '));
			if (!adSatiri) return null;
			return {
				ad: adSatiri.slice('event: '.length),
				veri: veriSatiri ? JSON.parse(veriSatiri.slice('data: '.length)) : null,
			};
		})
		.filter(Boolean);
}

function isAkisiKur(db, secenekler) {
	const kontrolor = new AbortController();
	let geriCagirma = null;
	const yanit = isAkisYaniti(db, {
		baslangic: T0_ISO,
		iptalIsareti: kontrolor.signal,
		zamanlayiciKur(fn) {
			geriCagirma = fn;
			return 'sahte-sayac';
		},
		zamanlayiciSil() {},
		...secenekler,
	});
	return {
		yanit,
		tur() {
			assert.ok(geriCagirma, 'zamanlayıcı kurulmamış');
			geriCagirma();
		},
		kopar() {
			kontrolor.abort();
		},
		async oku() {
			return olaylariCoz(await govdeMetni(yanit));
		},
	};
}

test('BAŞKA MÜŞTERİNİN İŞİ İÇİN AKIŞ AÇILMIYOR', () => {
	const { db, ayse, bora, kapat } = ikiMusteri();
	try {
		const ayseninIsi = isEkle(db, { musteriId: ayse, ad: 'Gizli proje' });
		assert.equal(isSahibiMi(db, bora, ayseninIsi), false);
		/* `null` dönüyor; uç nokta bunu 404'e çeviriyor. */
		assert.equal(isAkisYaniti(db, { musteriId: bora, isId: ayseninIsi }), null);
		assert.equal(isAkisYaniti(db, { musteriId: ayse, isId: 'olmayan-kimlik' }), null);
	} finally {
		kapat();
	}
});

test('iş akışında yalnızca o işin mesajları var, başka müşterininki hiç akmıyor', async () => {
	const { db, ayse, bora, kapat } = ikiMusteri();
	try {
		const ayseninIsi = isEkle(db, { musteriId: ayse, ad: 'Ayşe işi', guncellendi: T0_ISO });
		const ayseninIkinciIsi = isEkle(db, { musteriId: ayse, ad: 'İkinci iş', guncellendi: T0_ISO });
		const boraninIsi = isEkle(db, { musteriId: bora, ad: 'Bora işi', guncellendi: T0_ISO });

		const akis = isAkisiKur(db, { musteriId: ayse, isId: ayseninIsi });

		isSahipMesaji(db, { isId: ayseninIsi, metin: 'Ayşe için not.', simdiMs: T0 + 1000 });
		isSahipMesaji(db, { isId: ayseninIkinciIsi, metin: 'Öteki iş.', simdiMs: T0 + 1000 });
		isSahipMesaji(db, { isId: boraninIsi, metin: 'Bora için not.', simdiMs: T0 + 1000 });

		akis.tur();
		akis.kopar();

		const mesajlar = (await akis.oku()).filter((o) => o.ad === 'mesaj').map((o) => o.veri);
		assert.deepEqual(
			mesajlar.map((m) => m.metin),
			['Ayşe için not.'],
		);
	} finally {
		kapat();
	}
});

test('işin durumu değişince akıyor ve etiketi sunucudan geliyor', async () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		const isId = isEkle(db, { musteriId: ayse, ad: 'Kalıp', guncellendi: T0_ISO });
		const akis = isAkisiKur(db, { musteriId: ayse, isId });

		db.prepare('UPDATE is_ozeti SET durum = ?, guncellendi = ? WHERE id = ?').run(
			'teslim_edildi',
			new Date(T0 + 1000).toISOString(),
			isId,
		);

		akis.tur();
		akis.kopar();

		const olaylar = (await akis.oku()).filter((o) => o.ad === 'is');
		assert.equal(olaylar.length, 1);
		assert.equal(olaylar[0].veri.durum, 'teslim_edildi');
		assert.equal(olaylar[0].veri.durum_etiketi, 'Teslim edildi');
	} finally {
		kapat();
	}
});

test('OTURUMSUZ İSTEK İŞ AKIŞINI AÇAMIYOR', async () => {
	const { GET } = await import('./pages/api/isler/akis.js');
	const yanit = await GET({
		locals: {},
		request: new Request('http://yerel/api/isler/akis'),
		url: new URL('http://yerel/api/isler/akis?is=herhangi'),
	});
	assert.equal(yanit.status, 401);
	assert.equal((await yanit.json()).tamam, false);
});

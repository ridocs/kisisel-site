/*
  Canlı akış (SSE).

  BU DOSYADAKİ EN ÖNEMLİ TEST: "bir müşteri diğerinin mesajını akışta
  GÖREMİYOR". Talep listesinde ve talep sayfasında süzgeç zaten testliydi;
  akış yeni bir kapı açtığı için aynı soru burada BAŞTAN soruluyor. Bir
  sızıntı olursa en ağır hata bu olurdu.

  Zamanlayıcılar sahte: testin gerçek saniyeleri beklemesi gerekmiyor ve
  "bağlantı kapanınca zamanlayıcı temizlendi mi" sorusu ancak böyle
  ölçülebiliyor.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { akisYaniti, pencereAc, talepSahibiMi } from './sunucu/canli.mjs';
import { mesajYaz, talepAc } from './sunucu/talepler.mjs';
import { geciciPanel, musteriEkle, sahipMesaji } from './test-destek.mjs';

const T0 = Date.parse('2026-09-24T09:00:00.000Z');
const T0_ISO = new Date(T0).toISOString();

function ikiMusteri() {
	const panel = geciciPanel();
	const ayse = musteriEkle(panel.db, 'Ayşe Yılmaz');
	const bora = musteriEkle(panel.db, 'Bora Şahin');
	return { ...panel, ayse, bora };
}

/** İki müşteri, her birinin bir talebi ve birer mesajı. */
function ikiTalep(db, ayse, bora) {
	const a = talepAc(db, {
		musteriId: ayse,
		baslik: 'Ayşe için teslim tarihi',
		metin: 'Ayşe yazdı: teslim ne zaman?',
		simdiMs: T0,
	});
	const b = talepAc(db, {
		musteriId: bora,
		baslik: 'Bora için katalog',
		metin: 'Bora yazdı: katalog hazır mı?',
		simdiMs: T0,
	});
	assert.equal(a.tamam, true);
	assert.equal(b.tamam, true);
	return { ayseninTalebi: a.talepId, boraninTalebi: b.talepId };
}

/**
 * Akışı sahte zamanlayıcıyla açar.
 * `tur()` bir yoklama turu koşturuyor, `kopar()` istemcinin gitmesini
 * canlandırıyor, `oku()` o ana kadar yazılmış olayları veriyor.
 */
function akisKur(db, secenekler = {}) {
	const kontrolor = new AbortController();
	let geriCagirma = null;
	let kurulan = 0;
	let silinen = 0;

	const yanit = akisYaniti(db, {
		baslangic: T0_ISO,
		iptalIsareti: kontrolor.signal,
		zamanlayiciKur(fn) {
			geriCagirma = fn;
			kurulan += 1;
			return 'sahte-sayac';
		},
		zamanlayiciSil() {
			silinen += 1;
		},
		...secenekler,
	});

	return {
		yanit,
		get kurulan() {
			return kurulan;
		},
		get silinen() {
			return silinen;
		},
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

const mesajlari = (olaylar) => olaylar.filter((o) => o.ad === 'mesaj').map((o) => o.veri);

test('BİR MÜŞTERİ DİĞERİNİN MESAJINI AKIŞTA GÖREMİYOR', async () => {
	const { db, ayse, bora, kapat } = ikiMusteri();
	try {
		const { ayseninTalebi, boraninTalebi } = ikiTalep(db, ayse, bora);

		/* Ayşe akışı açıyor. Talep süzgeci YOK: bütün talepleri dinliyor. */
		const akis = akisKur(db, { musteriId: ayse });

		/* İki tarafa da yeni birer mesaj düşüyor. */
		sahipMesaji(db, { talepId: boraninTalebi, metin: 'Bora için gizli yanıt', simdiMs: T0 + 1000 });
		sahipMesaji(db, { talepId: ayseninTalebi, metin: 'Ayşe için yanıt', simdiMs: T0 + 2000 });

		akis.tur();
		akis.kopar();

		const gelenler = mesajlari(await akis.oku());
		const metinler = gelenler.map((m) => m.metin);

		assert.ok(metinler.includes('Ayşe için yanıt'), 'kendi mesajı gelmeliydi');
		for (const m of gelenler) {
			assert.equal(m.talep_id, ayseninTalebi, `başka talebin mesajı sızdı: ${m.metin}`);
		}
		assert.ok(
			!metinler.some((m) => m.includes('Bora')),
			'BAŞKA MÜŞTERİNİN MESAJI SIZDI',
		);
	} finally {
		kapat();
	}
});

test('başka müşterinin talebi için akış AÇILMIYOR', () => {
	const { db, ayse, bora, kapat } = ikiMusteri();
	try {
		const { ayseninTalebi, boraninTalebi } = ikiTalep(db, ayse, bora);

		assert.equal(talepSahibiMi(db, ayse, ayseninTalebi), true);
		assert.equal(talepSahibiMi(db, ayse, boraninTalebi), false);

		/* Akış hiç kurulmuyor: dönen değer `null`, uç nokta bunu 404'e çeviriyor. */
		const yanit = akisYaniti(db, { musteriId: ayse, talepId: boraninTalebi });
		assert.equal(yanit, null);

		/* Olmayan bir talep de aynı cevabı veriyor: varlık bilgisi sızmıyor. */
		assert.equal(akisYaniti(db, { musteriId: ayse, talepId: 'yok-boyle-bir-id' }), null);

		/* Kendi talebi için açılıyor. */
		const kendi = akisYaniti(db, { musteriId: ayse, talepId: ayseninTalebi });
		assert.ok(kendi instanceof Response);
		kendi.body.cancel();
	} finally {
		kapat();
	}
});

test('talep süzgeci verilince yalnızca o talebin mesajları akıyor', async () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		const birinci = talepAc(db, {
			musteriId: ayse,
			baslik: 'Birinci talep',
			metin: 'Birinci açılış',
			simdiMs: T0,
		});
		const ikinci = talepAc(db, {
			musteriId: ayse,
			baslik: 'İkinci talep',
			metin: 'İkinci açılış',
			simdiMs: T0,
		});

		const akis = akisKur(db, { musteriId: ayse, talepId: birinci.talepId });

		sahipMesaji(db, { talepId: ikinci.talepId, metin: 'İkinciye yanıt', simdiMs: T0 + 1000 });
		sahipMesaji(db, { talepId: birinci.talepId, metin: 'Birinciye yanıt', simdiMs: T0 + 2000 });

		akis.tur();
		akis.kopar();

		const gelenler = mesajlari(await akis.oku());
		assert.deepEqual(
			gelenler.map((m) => m.metin),
			['Birinciye yanıt'],
		);
	} finally {
		kapat();
	}
});

test('damgadan öncesi akmıyor, sonrası akıyor', async () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		const talep = talepAc(db, {
			musteriId: ayse,
			baslik: 'Damga denemesi',
			metin: 'Açılış mesajı',
			simdiMs: T0,
		});
		sahipMesaji(db, { talepId: talep.talepId, metin: 'Eski yanıt', simdiMs: T0 + 1000 });

		/* Akış "eski yanıt"tan SONRASINI istiyor. */
		const akis = akisKur(db, {
			musteriId: ayse,
			baslangic: new Date(T0 + 1001).toISOString(),
		});

		sahipMesaji(db, { talepId: talep.talepId, metin: 'Yeni yanıt', simdiMs: T0 + 2000 });

		akis.tur();
		akis.kopar();

		assert.deepEqual(
			mesajlari(await akis.oku()).map((m) => m.metin),
			['Yeni yanıt'],
		);
	} finally {
		kapat();
	}
});

test('aynı milisaniyedeki iki mesajın ikincisi atlanmıyor', () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		const talep = talepAc(db, {
			musteriId: ayse,
			baslik: 'Aynı an',
			metin: 'Açılış',
			simdiMs: T0,
		});

		const pencere = pencereAc(db, { musteriId: ayse, baslangic: new Date(T0 + 1000).toISOString() });

		/*
		  Birinci tur: aynı milisaniyede iki mesajdan yalnızca biri yazılmış
		  olsun. `> damga` kullanılsaydı, aynı damgalı ikinci mesaj bir daha
		  hiç görünmezdi.
		*/
		sahipMesaji(db, { talepId: talep.talepId, metin: 'Aynı anda birinci', simdiMs: T0 + 5000 });
		const ilk = pencere.tur().filter((o) => o.tur === 'mesaj');
		assert.deepEqual(ilk.map((m) => m.metin), ['Aynı anda birinci']);

		sahipMesaji(db, { talepId: talep.talepId, metin: 'Aynı anda ikinci', simdiMs: T0 + 5000 });
		const sonra = pencere.tur().filter((o) => o.tur === 'mesaj');
		assert.deepEqual(sonra.map((m) => m.metin), ['Aynı anda ikinci']);

		/* Üçüncü turda tekrar yok: aynı mesaj iki kez akmıyor. */
		assert.deepEqual(pencere.tur().filter((o) => o.tur === 'mesaj'), []);
	} finally {
		kapat();
	}
});

test('BAĞLANTI KAPANINCA ZAMANLAYICI TEMİZLENİYOR', async () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		talepAc(db, { musteriId: ayse, baslik: 'Sayaç', metin: 'Açılış', simdiMs: T0 });

		const akis = akisKur(db, { musteriId: ayse });
		assert.equal(akis.kurulan, 1, 'zamanlayıcı kurulmalıydı');
		assert.equal(akis.silinen, 0);

		akis.kopar();
		assert.equal(akis.silinen, 1, 'kopan bağlantıda zamanlayıcı söndürülmedi');

		/*
		  Sönmüş bir akışta tur koşsa bile yazma yok: kapanmış akışa yazmak
		  hata verir ve istisna süreci düşürebilirdi.
		*/
		akis.tur();
		const olaylar = await akis.oku();
		assert.ok(olaylar.length >= 1, 'açılış olayı yazılmış olmalı');
		assert.equal(olaylar.filter((o) => o.ad === 'nabiz').length, 0);
	} finally {
		kapat();
	}
});

test('gövde iptal edilince de zamanlayıcı temizleniyor', async () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		talepAc(db, { musteriId: ayse, baslik: 'İptal', metin: 'Açılış', simdiMs: T0 });

		const akis = akisKur(db, { musteriId: ayse });
		/* Tarayıcı sekmeyi kapattığında `iptalIsareti` değil `cancel` geliyor. */
		await akis.yanit.body.cancel();
		assert.equal(akis.silinen, 1, 'iptal edilen gövdede zamanlayıcı söndürülmedi');
	} finally {
		kapat();
	}
});

test('oturum düşünce akış kapanıyor', async () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		talepAc(db, { musteriId: ayse, baslik: 'Oturum', metin: 'Açılış', simdiMs: T0 });

		let gecerli = true;
		let saat = T0;
		const akis = akisKur(db, {
			musteriId: ayse,
			nabizMs: 1000,
			oturumGecerliMi: () => gecerli,
			simdi: () => saat,
		});

		gecerli = false;
		saat = T0 + 5000;
		akis.tur();

		const olaylar = await akis.oku();
		const son = olaylar[olaylar.length - 1];
		assert.equal(son.ad, 'bitti');
		assert.equal(son.veri.sebep, 'oturum');
		assert.equal(akis.silinen, 1, 'oturum düşünce zamanlayıcı söndürülmedi');
	} finally {
		kapat();
	}
});

test('veri akmayınca nabız geliyor, akınca gelmiyor', async () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		const talep = talepAc(db, { musteriId: ayse, baslik: 'Nabız', metin: 'Açılış', simdiMs: T0 });

		let saat = T0;
		const akis = akisKur(db, { musteriId: ayse, nabizMs: 20000, simdi: () => saat });

		/* Sessiz geçen yirmi saniye: nabız. */
		saat = T0 + 21000;
		akis.tur();

		/* Mesaj akan turda nabız YOK: yazma zaten olmuş. */
		sahipMesaji(db, { talepId: talep.talepId, metin: 'Bir yanıt', simdiMs: T0 + 22000 });
		saat = T0 + 45000;
		akis.tur();

		akis.kopar();
		const olaylar = await akis.oku();
		assert.equal(olaylar.filter((o) => o.ad === 'nabiz').length, 1);
		assert.equal(olaylar.filter((o) => o.ad === 'mesaj').length, 1);
	} finally {
		kapat();
	}
});

test('en uzun ömür dolunca akış kendini kapatıyor', async () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		talepAc(db, { musteriId: ayse, baslik: 'Ömür', metin: 'Açılış', simdiMs: T0 });

		let saat = T0;
		const akis = akisKur(db, { musteriId: ayse, enCokMs: 60000, simdi: () => saat });

		saat = T0 + 61000;
		akis.tur();

		const olaylar = await akis.oku();
		const son = olaylar[olaylar.length - 1];
		assert.equal(son.ad, 'bitti');
		assert.equal(son.veri.sebep, 'sure');
		assert.equal(akis.silinen, 1);
	} finally {
		kapat();
	}
});

test('yanıt başlıkları SSE için doğru', () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		const yanit = akisYaniti(db, { musteriId: ayse });
		assert.equal(yanit.headers.get('content-type'), 'text/event-stream; charset=utf-8');
		assert.equal(yanit.headers.get('cache-control'), 'no-store');
		/* nginx bu yanıtı ara belleğe almamalı, yoksa akış anlık olmuyor. */
		assert.equal(yanit.headers.get('x-accel-buffering'), 'no');
		yanit.body.cancel();
	} finally {
		kapat();
	}
});

test('OTURUMSUZ İSTEK AKIŞ AÇAMIYOR', async () => {
	/*
	  Ara katman bu yolu açık yollar listesine koymuyor, yani oturumsuz istek
	  buraya hiç ulaşmıyor. Burada uç noktanın KENDİ kapısı ölçülüyor:
	  `locals.musteri` yoksa veritabanına bile gidilmiyor.
	*/
	const { GET } = await import('./pages/api/talepler/akis.js');
	const yanit = await GET({
		locals: {},
		request: new Request('http://yerel/api/talepler/akis'),
		url: new URL('http://yerel/api/talepler/akis'),
	});
	assert.equal(yanit.status, 401);
	assert.equal(yanit.headers.get('content-type'), 'application/json; charset=utf-8');
	const govde = await yanit.json();
	assert.equal(govde.tamam, false);
});

test('talep durumu değişince akıyor ve etiketi sunucudan geliyor', async () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		const talep = talepAc(db, { musteriId: ayse, baslik: 'Durum', metin: 'Açılış', simdiMs: T0 });

		const akis = akisKur(db, { musteriId: ayse, talepId: talep.talepId });

		sahipMesaji(db, { talepId: talep.talepId, metin: 'Sahip yanıtladı', simdiMs: T0 + 1000 });
		akis.tur();
		akis.kopar();

		const olaylar = await akis.oku();
		const talepOlayi = olaylar.find((o) => o.ad === 'talep');
		assert.ok(talepOlayi, 'talep olayı gelmeliydi');
		assert.equal(talepOlayi.veri.durum, 'yanitlandi');
		assert.equal(talepOlayi.veri.durum_etiketi, 'Yanıtlandı');
		assert.equal(talepOlayi.veri.mesaj_sayisi, 2);
	} finally {
		kapat();
	}
});

test('müşterinin kendi yazdığı mesaj kimliğiyle geliyor', async () => {
	const { db, ayse, kapat } = ikiMusteri();
	try {
		const talep = talepAc(db, { musteriId: ayse, baslik: 'Kimlik', metin: 'Açılış', simdiMs: T0 });

		const akis = akisKur(db, { musteriId: ayse, talepId: talep.talepId });
		mesajYaz(db, {
			musteriId: ayse,
			talepId: talep.talepId,
			metin: 'Bir soru daha',
			simdiMs: T0 + 1000,
		});
		akis.tur();
		akis.kopar();

		const gelen = mesajlari(await akis.oku());
		assert.equal(gelen.length, 1);
		/*
		  Kimlik OLMAK ZORUNDA: sayfa gönderimden sonra yenileniyor ve aynı
		  mesaj hem sunucudan basılı hem akıştan gelebiliyor. İstemci ikilemeyi
		  bu kimliğe bakarak eliyor.
		*/
		assert.ok(gelen[0].id, 'mesaj kimliği yok, istemci ikilemeyi ayıklayamaz');
		const basili = db
			.prepare('SELECT id FROM talep_mesaji WHERE metin = ?')
			.get('Bir soru daha');
		assert.equal(gelen[0].id, basili.id);
	} finally {
		kapat();
	}
});

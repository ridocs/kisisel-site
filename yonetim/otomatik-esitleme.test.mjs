/*
  OTOMATİK EŞİTLEMENİN TESTLERİ

  GERÇEK SSH YOK, GERÇEK SAAT YOK. `esitle` sahte bir işlev, zamanlayıcılar
  sahte bir saat. Sunucu canlı ve üzerinde gerçek müşteri kaydı var; bu
  dosyada hiçbir yol `veri/esitleme-ssh.mjs` içindeki gerçek `esitle`
  fonksiyonuna varmıyor.

  Sorulan sorular:
    - Birden çok değişiklik tek eşitlemede mi gidiyor (toplama)
    - Aynı anda iki koşu olabiliyor mu, sürerken gelen istek kayboluyor mu
    - Art arda başarısızlıkta aralık büyüyor, başarıda normale dönüyor mu
    - Ayarlar eksikken susuyor mu
    - Otomatik kapalıyken tetikleniyor mu, elle düğme hâlâ çalışıyor mu

  Çalıştırma: node --test yonetim/otomatik-esitleme.test.mjs
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	EN_COK_GERI_CEKILME_MS,
	esitlemeYoneticisiKur,
	geriCekilmeGecikmesi,
	sonucuOzetle,
} from './otomatik-esitleme.mjs';

/** Mikro görevlerin akması için. `await` zinciri bunsuz bir adım geride kalır. */
const bosla = () => new Promise((coz) => setImmediate(coz));

/**
 * Sahte saat.
 *
 * Gerçek `setTimeout` kullanılsaydı üç dakikalık aralığı sınamak için üç
 * dakika beklemek gerekirdi. Burada zaman `ilerle()` ile elle akıyor ve
 * zamanı gelen iş, o işin kurulduğu ana ayarlanmış saatle çalışıyor.
 */
function sahteSaat(baslangic = 1_700_000_000_000) {
	let an = baslangic;
	let sira = 0;
	const isler = new Map();

	return {
		simdiMs: () => an,
		zamanla(islev, ms) {
			const isaret = ++sira;
			isler.set(isaret, { an: an + ms, islev });
			return isaret;
		},
		zamaniIptal(isaret) {
			isler.delete(isaret);
		},
		async ilerle(ms) {
			const hedef = an + ms;
			for (;;) {
				const siradaki = [...isler.entries()]
					.filter(([, is]) => is.an <= hedef)
					.sort((a, b) => a[1].an - b[1].an)[0];
				if (!siradaki) break;
				isler.delete(siradaki[0]);
				an = siradaki[1].an;
				siradaki[1].islev();
				await bosla();
			}
			an = hedef;
			await bosla();
		},
		bekleyenIsSayisi: () => isler.size,
	};
}

/** Eşitlemeyi taklit eden sayaç. Aynı anda iki koşu olursa yakalıyor. */
function sahteEsitleme({ hataVer = false } = {}) {
	const kayit = {
		cagri: 0,
		enCokEszamanli: 0,
		suren: 0,
		hataVer,
		bekletme: null,
	};
	const islev = async () => {
		kayit.cagri += 1;
		kayit.suren += 1;
		kayit.enCokEszamanli = Math.max(kayit.enCokEszamanli, kayit.suren);
		try {
			if (kayit.bekletme) await kayit.bekletme;
			else await bosla();
			if (kayit.hataVer) throw new Error('SSH ulaşamadı: Connection timed out');
			return { gonderim: { gonderilen: 2, bosKuyruk: false }, cekis: { yazilan: 1, atlanan: 0 } };
		} finally {
			kayit.suren -= 1;
		}
	};
	return { kayit, islev };
}

function yoneticiKur({ saat, esitleme, ayar }) {
	const ayarDurumu = {
		otomatik: true,
		aralikMs: 3 * 60 * 1000,
		ayarTamam: true,
		eksikler: [],
		...ayar,
	};
	const bildirimler = [];
	const yonetici = esitlemeYoneticisiKur({
		esitle: esitleme.islev,
		ayarlariOku: () => ({ ...ayarDurumu }),
		durumDegisti: (d) => bildirimler.push(d),
		zamanla: saat.zamanla,
		zamaniIptal: saat.zamaniIptal,
		simdiMs: saat.simdiMs,
	});
	return { yonetici, ayarDurumu, bildirimler };
}

/* ------------------------------------------------------------------ */
/* Toplama                                                             */
/* ------------------------------------------------------------------ */

test('toplama: pencere içindeki birden çok değişiklik tek eşitlemeye düşüyor', async () => {
	const saat = sahteSaat();
	const esitleme = sahteEsitleme();
	const { yonetici } = yoneticiKur({ saat, esitleme });
	yonetici.baslat();

	yonetici.degisiklikBildir('musteri.kaydet');
	await saat.ilerle(500);
	yonetici.degisiklikBildir('is.kaydet');
	await saat.ilerle(500);
	yonetici.degisiklikBildir('talep.yanit');

	// Pencere henüz dolmadı: hiçbir eşitleme başlamamış olmalı.
	assert.equal(esitleme.kayit.cagri, 0);

	await saat.ilerle(2000);
	assert.equal(esitleme.kayit.cagri, 1, 'üç değişiklik tek koşuya düşmeliydi');

	yonetici.durdur();
});

test('toplama: pencere kaymıyor, art arda değişiklik eşitlemeyi süresiz ertelemiyor', async () => {
	const saat = sahteSaat();
	const esitleme = sahteEsitleme();
	const { yonetici } = yoneticiKur({ saat, esitleme });
	yonetici.baslat();

	yonetici.degisiklikBildir('bir');
	// Pencere dolmadan hemen önce yeni değişiklik: süre yeniden başlamamalı.
	for (let i = 0; i < 5; i += 1) {
		await saat.ilerle(400);
		yonetici.degisiklikBildir(`degisiklik-${i}`);
	}
	await saat.ilerle(600);

	assert.equal(esitleme.kayit.cagri, 1);
	yonetici.durdur();
});

test('toplama: koşu sürerken gelen değişiklik yeni bir koşuya düşüyor', async () => {
	const saat = sahteSaat();
	const esitleme = sahteEsitleme();
	let serbestBirak;
	esitleme.kayit.bekletme = new Promise((coz) => {
		serbestBirak = coz;
	});
	const { yonetici } = yoneticiKur({ saat, esitleme });
	yonetici.baslat();

	yonetici.degisiklikBildir('musteri.kaydet');
	await saat.ilerle(2500);
	assert.equal(esitleme.kayit.cagri, 1);
	assert.equal(yonetici.suruyorMu(), true);

	// Koşu sürerken yeni bir değişiklik geliyor.
	yonetici.degisiklikBildir('talep.durum');
	esitleme.kayit.bekletme = null;
	serbestBirak();
	await bosla();
	await bosla();

	// İlk koşu bitti, toplama penceresi yeniden kuruldu.
	await saat.ilerle(2500);
	assert.equal(esitleme.kayit.cagri, 2, 'sürerken gelen değişiklik kaybolmamalıydı');
	assert.equal(esitleme.kayit.enCokEszamanli, 1);

	yonetici.durdur();
});

/* ------------------------------------------------------------------ */
/* Eşzamanlılık kilidi                                                 */
/* ------------------------------------------------------------------ */

test('kilit: aynı anda iki elle çalıştırma üst üste binmiyor', async () => {
	const saat = sahteSaat();
	const esitleme = sahteEsitleme();
	let serbestBirak;
	esitleme.kayit.bekletme = new Promise((coz) => {
		serbestBirak = coz;
	});
	const { yonetici } = yoneticiKur({ saat, esitleme });
	yonetici.baslat();

	const birinci = yonetici.elleCalistir();
	const ikinci = yonetici.elleCalistir();
	const ucuncu = yonetici.elleCalistir();
	await bosla();

	assert.equal(esitleme.kayit.cagri, 1, 'ilki sürerken ikincisi başlamamalı');

	esitleme.kayit.bekletme = null;
	serbestBirak();
	await birinci;
	await ikinci;
	await ucuncu;

	// İki istek tek bir arka koşuda birleşiyor: o koşu ikisini de kapsıyor.
	assert.equal(esitleme.kayit.cagri, 2);
	assert.equal(esitleme.kayit.enCokEszamanli, 1, 'hiçbir an iki koşu olmamalı');

	yonetici.durdur();
});

test('kilit: sıraya giren istek sürenin sonucunu değil kendi koşusunun sonucunu alıyor', async () => {
	const saat = sahteSaat();
	const esitleme = sahteEsitleme();
	const { yonetici } = yoneticiKur({ saat, esitleme });
	yonetici.baslat();

	const birinci = yonetici.elleCalistir();
	const ikinci = yonetici.elleCalistir();
	const [a, b] = await Promise.all([birinci, ikinci]);

	assert.equal(a.gonderim.gonderilen, 2);
	assert.equal(b.gonderim.gonderilen, 2);
	assert.equal(esitleme.kayit.cagri, 2);

	yonetici.durdur();
});

/* ------------------------------------------------------------------ */
/* Üstel geri çekilme                                                  */
/* ------------------------------------------------------------------ */

test('geri çekilme: saf hesap hatasız aralık, sonra iki katı, tavanda duruyor', () => {
	const aralik = 3 * 60 * 1000;
	assert.equal(geriCekilmeGecikmesi(aralik, 0), aralik);
	assert.equal(geriCekilmeGecikmesi(aralik, 1), aralik * 2);
	assert.equal(geriCekilmeGecikmesi(aralik, 2), aralik * 4);
	assert.equal(geriCekilmeGecikmesi(aralik, 3), aralik * 8);
	// 3 dakikanın 16 katı 48 dakika, tavan yarım saat.
	assert.equal(geriCekilmeGecikmesi(aralik, 4), EN_COK_GERI_CEKILME_MS);
	assert.equal(geriCekilmeGecikmesi(aralik, 500), EN_COK_GERI_CEKILME_MS);
	// Üs taşması sonsuza gitmiyor.
	assert.ok(Number.isFinite(geriCekilmeGecikmesi(aralik, 5000)));
});

test('geri çekilme: art arda hatada sonraki çalışma uzaklaşıyor, başarıda normale dönüyor', async () => {
	const saat = sahteSaat();
	const esitleme = sahteEsitleme({ hataVer: true });
	const aralikMs = 3 * 60 * 1000;
	const { yonetici } = yoneticiKur({ saat, esitleme, ayar: { aralikMs } });
	yonetici.baslat();

	const siradakiUzaklik = () => {
		const d = yonetici.durum();
		return new Date(d.siradakiCalisma).getTime() - saat.simdiMs();
	};

	assert.equal(siradakiUzaklik(), aralikMs, 'hata yokken normal aralık');

	await saat.ilerle(aralikMs);
	assert.equal(esitleme.kayit.cagri, 1);
	assert.equal(yonetici.durum().ardArdaHata, 1);
	assert.equal(siradakiUzaklik(), aralikMs * 2);
	assert.equal(yonetici.durum().sonHata.mesaj, 'SSH ulaşamadı: Connection timed out');

	await saat.ilerle(aralikMs * 2);
	assert.equal(esitleme.kayit.cagri, 2);
	assert.equal(siradakiUzaklik(), aralikMs * 4);

	// Ağ geri geldi.
	esitleme.kayit.hataVer = false;
	await saat.ilerle(aralikMs * 4);
	assert.equal(esitleme.kayit.cagri, 3);
	assert.equal(yonetici.durum().ardArdaHata, 0);
	assert.equal(yonetici.durum().sonHata, null);
	assert.equal(siradakiUzaklik(), aralikMs, 'başarıdan sonra normale dönmeliydi');

	yonetici.durdur();
});

test('geri çekilme: hata döngüsüne girmiyor, aralık gelmeden yeniden denemiyor', async () => {
	const saat = sahteSaat();
	const esitleme = sahteEsitleme({ hataVer: true });
	const aralikMs = 60 * 1000;
	const { yonetici } = yoneticiKur({ saat, esitleme, ayar: { aralikMs } });
	yonetici.baslat();

	await saat.ilerle(aralikMs);
	assert.equal(esitleme.kayit.cagri, 1);
	// Bir sonraki deneme iki dakika sonra; bir dakika beklemek yetmiyor.
	await saat.ilerle(aralikMs);
	assert.equal(esitleme.kayit.cagri, 1);
	await saat.ilerle(aralikMs);
	assert.equal(esitleme.kayit.cagri, 2);

	yonetici.durdur();
});

/* ------------------------------------------------------------------ */
/* Ayar eksikken susma                                                 */
/* ------------------------------------------------------------------ */

test('ayar eksikken: hiç eşitleme denenmiyor ve sebep durumda yazıyor', async () => {
	const saat = sahteSaat();
	const esitleme = sahteEsitleme();
	const { yonetici } = yoneticiKur({
		saat,
		esitleme,
		ayar: { ayarTamam: false, eksikler: ['Sunucu adresi boş bırakılamaz.'] },
	});
	yonetici.baslat();

	yonetici.degisiklikBildir('musteri.kaydet');
	await saat.ilerle(60 * 60 * 1000);

	assert.equal(esitleme.kayit.cagri, 0, 'eksik ayarla SSH denenmemeliydi');
	assert.equal(saat.bekleyenIsSayisi(), 0, 'boşa dönen bir zamanlayıcı kalmamalı');

	const d = yonetici.durum();
	assert.equal(d.beklemeSebebi, 'ayar-eksik');
	assert.equal(d.siradakiCalisma, null);
	assert.deepEqual(d.bekleyenSebepler, ['musteri.kaydet']);
	assert.equal(d.ayarUyarisiVerildi, true, 'kullanıcı bir kez bilgilendirilmeli');

	yonetici.durdur();
});

test('ayar eksikken: ayarlar tamamlanınca bekleyen değişiklik kendiliğinden gidiyor', async () => {
	const saat = sahteSaat();
	const esitleme = sahteEsitleme();
	const { yonetici, ayarDurumu } = yoneticiKur({
		saat,
		esitleme,
		ayar: { ayarTamam: false, eksikler: ['Sunucu adresi boş bırakılamaz.'] },
	});
	yonetici.baslat();

	yonetici.degisiklikBildir('davet.uret');
	await saat.ilerle(10_000);
	assert.equal(esitleme.kayit.cagri, 0);

	ayarDurumu.ayarTamam = true;
	ayarDurumu.eksikler = [];
	yonetici.ayarlariYenile();

	await saat.ilerle(2500);
	assert.equal(esitleme.kayit.cagri, 1, 'bekleyen değişiklik ayar tamamlanınca gitmeliydi');
	assert.equal(yonetici.durum().ayarUyarisiVerildi, false);

	yonetici.durdur();
});

/* ------------------------------------------------------------------ */
/* Açma ve kapatma                                                     */
/* ------------------------------------------------------------------ */

test('kapalıyken: değişiklik tetiklemiyor, düzenli dinleme de yok', async () => {
	const saat = sahteSaat();
	const esitleme = sahteEsitleme();
	const { yonetici } = yoneticiKur({ saat, esitleme, ayar: { otomatik: false } });
	yonetici.baslat();

	yonetici.degisiklikBildir('musteri.kaydet');
	await saat.ilerle(2 * 60 * 60 * 1000);

	assert.equal(esitleme.kayit.cagri, 0);
	assert.equal(yonetici.durum().beklemeSebebi, 'kapali');
	assert.equal(yonetici.durum().siradakiCalisma, null);

	yonetici.durdur();
});

test('kapalıyken: elle çalıştırma yine de eşitliyor', async () => {
	const saat = sahteSaat();
	const esitleme = sahteEsitleme();
	const { yonetici } = yoneticiKur({ saat, esitleme, ayar: { otomatik: false } });
	yonetici.baslat();

	const sonuc = await yonetici.elleCalistir();
	assert.equal(esitleme.kayit.cagri, 1);
	assert.equal(sonuc.cekis.yazilan, 1);
	// Elle koşu, kapalı otomatiği açmıyor: yeni bir zamanlayıcı kurulmamalı.
	assert.equal(yonetici.durum().siradakiCalisma, null);

	yonetici.durdur();
});

test('açıldığında: düzenli dinleme kendiliğinden kuruluyor', async () => {
	const saat = sahteSaat();
	const esitleme = sahteEsitleme();
	const aralikMs = 5 * 60 * 1000;
	const { yonetici, ayarDurumu } = yoneticiKur({
		saat,
		esitleme,
		ayar: { otomatik: false, aralikMs },
	});
	yonetici.baslat();
	assert.equal(yonetici.durum().siradakiCalisma, null);

	ayarDurumu.otomatik = true;
	yonetici.ayarlariYenile();

	await saat.ilerle(aralikMs);
	assert.equal(esitleme.kayit.cagri, 1, 'aralık dolunca talepler çekilmeliydi');

	yonetici.durdur();
});

test('durdur: kapanıştan sonra zamanlayıcı kalmıyor', async () => {
	const saat = sahteSaat();
	const esitleme = sahteEsitleme();
	const { yonetici } = yoneticiKur({ saat, esitleme });
	yonetici.baslat();
	yonetici.degisiklikBildir('musteri.kaydet');
	yonetici.durdur();

	await saat.ilerle(60 * 60 * 1000);
	assert.equal(esitleme.kayit.cagri, 0);
	assert.equal(saat.bekleyenIsSayisi(), 0);
});

/* ------------------------------------------------------------------ */
/* Durum bildirimi                                                     */
/* ------------------------------------------------------------------ */

test('durum: koşunun başı ve sonu dışarı bildiriliyor', async () => {
	const saat = sahteSaat();
	const esitleme = sahteEsitleme();
	const { yonetici, bildirimler } = yoneticiKur({ saat, esitleme });
	yonetici.baslat();

	bildirimler.length = 0;
	await yonetici.elleCalistir();

	assert.ok(
		bildirimler.some((d) => d.suruyor === true),
		'koşu başlarken bildirilmeliydi',
	);
	const son = bildirimler.at(-1);
	assert.equal(son.suruyor, false);
	assert.equal(son.sonSonuc.gonderilen, 2);
	assert.equal(son.sonSonuc.yazilan, 1);
	assert.ok(son.sonBasari);

	yonetici.durdur();
});

test('durum: başarısız koşu ham hata mesajını saklıyor', async () => {
	const saat = sahteSaat();
	const esitleme = sahteEsitleme({ hataVer: true });
	const { yonetici } = yoneticiKur({ saat, esitleme });
	yonetici.baslat();

	await assert.rejects(() => yonetici.elleCalistir(), /Connection timed out/);
	const d = yonetici.durum();
	assert.equal(d.sonHata.mesaj, 'SSH ulaşamadı: Connection timed out');
	assert.equal(d.sonHata.sebep, 'elle');
	assert.ok(d.sonHata.an);

	yonetici.durdur();
});

test('sonucuOzetle: eksik alanlarla da çökmüyor', () => {
	assert.deepEqual(sonucuOzetle(undefined), {
		gonderilen: 0,
		bosKuyruk: false,
		yazilan: 0,
		atlanan: 0,
	});
	assert.deepEqual(sonucuOzetle({ gonderim: { gonderilen: 3, bosKuyruk: false }, cekis: { yazilan: 4, atlanan: 1 } }), {
		gonderilen: 3,
		bosKuyruk: false,
		yazilan: 4,
		atlanan: 1,
	});
});

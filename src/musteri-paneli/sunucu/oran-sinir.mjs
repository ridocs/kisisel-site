/*
  Oran sınırlama: iki ayrı sayaç (PANEL-TASARIMI.md §8).

  | Sayaç        | Neye karşı                     | Eşik                                   |
  |--------------|--------------------------------|----------------------------------------|
  | Müşteri başına | Belirli kişiyi hedefleyen saldırı | 5 başarısız sonra üstel gecikme, 10'da 30 dk kilit |
  | IP başına      | Dağıtık deneme                  | Kayan pencerede sınır                   |

  Yalnızca IP'ye bakmak yetmez, saldırgan IP değiştirir; yalnızca müşteriye
  bakmak da yetmez, saldırgan müşteri değiştirir. İkisi birden.

  Sayım işlevleri SAF: zaman damgası dizisi alıp karar döndürüyorlar.
  Veritabanı yalnızca o diziyi üretmek için kullanılıyor, böylece eşikler
  saatlerce beklemeden test edilebiliyor.
*/

/** Müşteri sayacının kayan penceresi. */
export const MUSTERI_PENCERE_MS = 30 * 60 * 1000;

/** Bu sayıdan sonra her denemeye gecikme bindiriliyor. */
export const MUSTERI_ESIK = 5;

/** Bu sayıda başarısızlıkta hesap kilitleniyor. */
export const MUSTERI_KILIT_ESIGI = 10;

/** Kilit süresi. */
export const KILIT_MS = 30 * 60 * 1000;

/** IP sayacının kayan penceresi. */
export const IP_PENCERE_MS = 15 * 60 * 1000;

/** Bir IP'nin penceredeki başarısız deneme sınırı. */
export const IP_ESIK = 30;

/*
  Üstel gecikme: 1s, 4s, 16s. Üs 2'de duruyor çünkü 10. başarısızlıkta zaten
  kilit devreye giriyor; ondan sonrası için daha büyük sayı üretmenin anlamı
  yok, yalnızca sunucuda bekleyen bağlantı biriktirirdi.
*/
const EN_BUYUK_US = 2;

function tazeler(zamanlar, simdiMs, pencereMs) {
	return zamanlar.filter((z) => Number.isFinite(z) && simdiMs - z < pencereMs && z <= simdiMs);
}

/**
 * Müşteri sayacının durumu.
 * @param {number[]} basarisizZamanlar son başarıdan sonraki başarısızlıkların ms damgaları
 */
export function musteriDurumu(basarisizZamanlar, simdiMs = Date.now()) {
	const taze = tazeler(basarisizZamanlar, simdiMs, MUSTERI_PENCERE_MS);
	const sayi = taze.length;

	if (sayi >= MUSTERI_KILIT_ESIGI) {
		const sonuncu = Math.max(...taze);
		const kalanMs = KILIT_MS - (simdiMs - sonuncu);
		if (kalanMs > 0) return { kilitli: true, kalanMs, gecikmeMs: 0, sayi };
	}

	if (sayi >= MUSTERI_ESIK) {
		const us = Math.min(sayi - MUSTERI_ESIK, EN_BUYUK_US);
		return { kilitli: false, kalanMs: 0, gecikmeMs: 1000 * 4 ** us, sayi };
	}

	return { kilitli: false, kalanMs: 0, gecikmeMs: 0, sayi };
}

/** IP sayacının durumu. Kayan pencerede sabit sınır, gecikme yok: ya geçer ya kilit. */
export function ipDurumu(basarisizZamanlar, simdiMs = Date.now()) {
	const taze = tazeler(basarisizZamanlar, simdiMs, IP_PENCERE_MS);
	if (taze.length >= IP_ESIK) {
		const sonuncu = Math.max(...taze);
		return { kilitli: true, kalanMs: Math.max(1, IP_PENCERE_MS - (simdiMs - sonuncu)), sayi: taze.length };
	}
	return { kilitli: false, kalanMs: 0, sayi: taze.length };
}

/** İki sayacın birleşimi: hangisi daha sertse o geçerli. */
export function birlestir(musteri, ip) {
	return {
		kilitli: musteri.kilitli || ip.kilitli,
		kalanMs: Math.max(musteri.kalanMs, ip.kalanMs),
		gecikmeMs: musteri.gecikmeMs,
	};
}

/** Denemeyi `deneme` tablosuna yazar. Denetim izi de buradan besleniyor (§6.2). */
export function denemeYaz(db, { tur, musteriId = null, ipKarmasi = null, sonuc, simdiMs = Date.now() }) {
	db.prepare(
		'INSERT INTO deneme (zaman, tur, musteri_id, ip_karmasi, sonuc) VALUES (?, ?, ?, ?, ?)',
	).run(new Date(simdiMs).toISOString(), tur, musteriId, ipKarmasi, sonuc);
}

/*
  Başarılı bir giriş sayacı sıfırlıyor: sorgular yalnızca SON BAŞARIDAN SONRAKİ
  başarısızlıkları topluyor. Aksi hâlde normal kullanan bir müşteri, aylar
  içinde biriken beş yanlış denemeden sonra kendi hesabına giremezdi.
*/
function sonBasariZamani(db, alan, deger) {
	if (deger === null || deger === undefined) return null;
	const satir = db
		.prepare(
			`SELECT MAX(zaman) AS zaman FROM deneme WHERE ${alan} = ? AND sonuc = 'basarili'`,
		)
		.get(deger);
	return satir?.zaman ?? null;
}

function basarisizZamanlar(db, { alan, deger, simdiMs, pencereMs }) {
	if (deger === null || deger === undefined) return [];
	const sinir = new Date(simdiMs - pencereMs).toISOString();
	const basari = sonBasariZamani(db, alan, deger);
	const alt = basari && basari > sinir ? basari : sinir;
	return db
		.prepare(
			`SELECT zaman FROM deneme WHERE ${alan} = ? AND sonuc = 'basarisiz' AND zaman > ? ORDER BY zaman`,
		)
		.all(deger, alt)
		.map((s) => Date.parse(s.zaman));
}

/**
 * Veritabanına bakarak iki sayacı birden değerlendirir.
 * `musteriId` bilinmiyorsa (davet akışı) yalnızca IP sayacı çalışır.
 */
export function sinirDurumu(db, { musteriId = null, ipKarmasi = null, simdiMs = Date.now() }) {
	const musteri = musteriDurumu(
		basarisizZamanlar(db, {
			alan: 'musteri_id',
			deger: musteriId,
			simdiMs,
			pencereMs: MUSTERI_PENCERE_MS,
		}),
		simdiMs,
	);
	const ip = ipDurumu(
		basarisizZamanlar(db, {
			alan: 'ip_karmasi',
			deger: ipKarmasi,
			simdiMs,
			pencereMs: IP_PENCERE_MS,
		}),
		simdiMs,
	);
	return birlestir(musteri, ip);
}

/*
  Tarih biçimleri. Üç sayfa da aynı biçimi kullanıyor; üç yerde ayrı ayrı
  kurulan bir `Intl.DateTimeFormat` er geç birinde başka seçeneklerle
  yazılıyor ve aynı tarih iki sayfada iki türlü görünüyor.

  Biçimlendiriciler modül düzeyinde bir kez kuruluyor: `Intl` nesnesi pahalı
  ve panelde her istek sunucuda işleniyor.
*/

const TARIH = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' });
const TARIH_SAAT = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });

const GUN_MS = 24 * 60 * 60 * 1000;

function cozumle(iso) {
	if (!iso) return null;
	const ms = Date.parse(iso);
	return Number.isNaN(ms) ? null : new Date(ms);
}

/** 23 Eyl 2026 */
export function tarih(iso) {
	const d = cozumle(iso);
	return d ? TARIH.format(d) : '';
}

/** 23 Eyl 2026 14:05 */
export function zaman(iso) {
	const d = cozumle(iso);
	return d ? TARIH_SAAT.format(d) : '';
}

/** `<time datetime="…">` için ham ISO değeri; geçersizse boş dize. */
export function makineZamani(iso) {
	const d = cozumle(iso);
	return d ? d.toISOString() : '';
}

/**
 * "bugün", "dün", "5 gün önce", "3 hafta önce", ondan eskisi için tam tarih.
 *
 * Gün farkı YEREL GECE YARISINA göre sayılıyor, 24 saatlik dilimlere göre
 * değil: dün 23:50'de yazılmış bir mesaja bugün 00:10'da "bugün" demek
 * yanlış olurdu.
 */
export function gecenSure(iso, simdiMs = Date.now()) {
	const d = cozumle(iso);
	if (!d) return '';
	const gunBasi = (t) => {
		const g = new Date(t);
		g.setHours(0, 0, 0, 0);
		return g.getTime();
	};
	const fark = Math.round((gunBasi(simdiMs) - gunBasi(d.getTime())) / GUN_MS);
	if (fark <= 0) return 'bugün';
	if (fark === 1) return 'dün';
	if (fark < 7) return `${fark} gün önce`;
	if (fark < 30) {
		const hafta = Math.floor(fark / 7);
		return hafta === 1 ? 'geçen hafta' : `${hafta} hafta önce`;
	}
	return TARIH.format(d);
}

/*
  PARA. Kuruş cinsinden tam sayı içeri, Türkçe biçimli metin dışarı.

  Tutarlar veritabanında KURUŞ ve tam sayı; ondalık sayı para tutmuyor
  (`veri/semalar.mjs` aynı gerekçeyi yazıyor). Bölme yalnızca GÖSTERİM
  anında, bir kez yapılıyor; hesap hep tam sayıyla.

  Biçim `tr-TR`: binlik ayracı nokta, ondalık ayracı virgül, iki basamak her
  zaman yazılı (1.250,50 ve 1.250,00). `style: 'currency'` kullanılmadı çünkü
  o, simgeyi sayının BAŞINA koyuyor (₺1.250,50); istenen biçim simgeyi sonda
  istiyor.
*/
const SAYI = new Intl.NumberFormat('tr-TR', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

/** Bilinen para birimlerinin simgesi. Bilinmeyen kod olduğu gibi yazılıyor. */
const SIMGELER = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' };

/** 125050 -> "1.250,50 ₺" */
export function para(kurus, paraBirimi = 'TRY') {
	const tam = Number.isFinite(kurus) ? Math.trunc(kurus) : 0;
	const simge = SIMGELER[paraBirimi] ?? paraBirimi;
	return `${SAYI.format(tam / 100)} ${simge}`;
}

/**
 * Bugünden kaç gün sonra (artı) ya da kaç gün önce (eksi).
 *
 * `gecenSure` ile aynı sebeple YEREL GECE YARISINA göre sayılıyor: teslim
 * tarihi bugün olan bir iş saat 23:50'de de "bugün teslim" olmalı, bir gün
 * gecikmiş değil. Geçersiz tarihte `null`.
 */
export function gunFarki(iso, simdiMs = Date.now()) {
	const d = cozumle(iso);
	if (!d) return null;
	const gunBasi = (t) => {
		const g = new Date(t);
		g.setHours(0, 0, 0, 0);
		return g.getTime();
	};
	return Math.round((gunBasi(d.getTime()) - gunBasi(simdiMs)) / GUN_MS);
}

/** "3 gün sonra", "bugün", "2 gün gecikti". Teslim hedefinin insan hâli. */
export function teslimCumlesi(iso, simdiMs = Date.now()) {
	const fark = gunFarki(iso, simdiMs);
	if (fark === null) return '';
	if (fark === 0) return 'bugün';
	if (fark === 1) return 'yarın';
	if (fark === -1) return 'bir gün geçti';
	if (fark > 1) return `${fark} gün sonra`;
	return `${-fark} gün geçti`;
}

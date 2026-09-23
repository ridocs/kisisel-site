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

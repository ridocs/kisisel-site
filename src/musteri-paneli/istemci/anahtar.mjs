/*
  Davet anahtarının TARAYICI tarafındaki çözümü.

  Neden `veri/kimlik.mjs` doğrudan kullanılmıyor: o dosya `node:crypto`
  kullanıyor ve SHA-256'yı EŞ ZAMANLI alıyor. Tarayıcıda karşılığı
  `crypto.subtle.digest` ve o async. Alfabe ve kontrol karakteri kuralı
  bu yüzden burada ikinci kez yazılmak zorunda kaldı.

  İKİ KOPYANIN AYRI DÜŞMESİ TESTLE ENGELLENİYOR: `davet-anahtari.test.mjs`
  bu dosyayı `veri/kimlik.mjs` ile yan yana koyup aynı anahtarlarda aynı
  sonucu verdiklerini doğruluyor. Biri değişip diğeri kalırsa test düşer.

  Bu denetimin amacı güvenlik değil, TRAFİK: biçimi bozuk bir anahtar
  sunucuya hiç gitmiyor (PANEL-TASARIMI.md §5.1 ve görev tanımı). Asıl
  doğrulama her hâlükârda sunucuda.
*/

const ALFABE = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const COZUM = new Map();
for (let i = 0; i < ALFABE.length; i++) COZUM.set(ALFABE[i], i);
/* Telefonda okunurken karışan harfler geri eşleniyor. */
COZUM.set('I', 1);
COZUM.set('L', 1);
COZUM.set('O', 0);
COZUM.set('U', COZUM.get('V'));

/** Davet anahtarının bayt uzunluğu. `veri/kimlik.mjs` ile aynı olmak zorunda. */
export const ANAHTAR_BAYT = 32;

export function temizle(girdi) {
	return String(girdi ?? '')
		.toUpperCase()
		.replace(/[\s-]/g, '');
}

function base32Coz(metin) {
	let bit = 0;
	let tampon = 0;
	const cikti = [];
	for (const karakter of metin) {
		const deger = COZUM.get(karakter);
		if (deger === undefined) return null;
		tampon = (tampon << 5) | deger;
		bit += 5;
		if (bit >= 8) {
			cikti.push((tampon >>> (bit - 8)) & 255);
			bit -= 8;
		}
	}
	return Uint8Array.from(cikti);
}

/**
 * Biçim ve kontrol karakteri doğru mu.
 * Doğruysa anahtarın kendisini değil, yalnızca `true` döndürüyor: ham
 * anahtarın bu modülden dışarı çıkmasına gerek yok.
 */
export async function anahtarBicimiGecerliMi(girdi) {
	const temiz = temizle(girdi);
	if (temiz.length < 2) return false;
	const baytlar = base32Coz(temiz.slice(0, -1));
	if (!baytlar || baytlar.length !== ANAHTAR_BAYT) return false;
	const ozet = new Uint8Array(await crypto.subtle.digest('SHA-256', baytlar));
	return ALFABE[ozet[0] & 31] === temiz.slice(-1);
}

/** Adres çapasından gelen değer anahtar gibi mi duruyor. */
export function anahtaraBenziyorMu(girdi) {
	const temiz = temizle(girdi);
	return temiz.length >= 50 && temiz.length <= 60 && /^[0-9A-Z]+$/.test(temiz);
}

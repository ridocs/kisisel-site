/*
  Davet anahtarı, oturum kimliği ve karma işleri.

  Burada kriptografik algoritma YAZILMIYOR. Yapılan tek şey, Node'un kendi
  `crypto` modülündeki hazır ve denenmiş parçaları doğru sırayla kullanmak:
  rastgelelik `randomBytes`'tan, karma `createHash`'ten, karşılaştırma
  `timingSafeEqual`'dan geliyor. Gerekçe: PANEL-TASARIMI.md §1.

  Neden davet anahtarı için Argon2 gibi yavaş bir türetme yok: 256 bit
  rastgelelik zaten tahmin edilemez. Yavaş türetme, insanların SEÇTİĞİ düşük
  entropili parolaları korumak içindir. Burada SHA-256 hem yeterli hem doğru.
*/

import { randomBytes, createHash, createHmac, timingSafeEqual } from 'node:crypto';

/** Davet anahtarının bayt uzunluğu. 32 bayt = 256 bit. */
export const ANAHTAR_BAYT = 32;

/** Oturum kimliğinin bayt uzunluğu. Aynı sebeple 256 bit. */
export const OTURUM_BAYT = 32;

/*
  Crockford base32: I, L, O ve U alfabede yok. Sebebi telefonda okunurken
  1/I/L ve 0/O karışması. Çözerken bu karışıklıklar zaten geri eşleniyor.
*/
const ALFABE = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const COZUM = new Map();
for (let i = 0; i < ALFABE.length; i++) COZUM.set(ALFABE[i], i);
COZUM.set('I', 1);
COZUM.set('L', 1);
COZUM.set('O', 0);
COZUM.set('U', COZUM.get('V'));

/** Ham baytları Crockford base32'ye çevirir (dolgu yok). */
export function base32Kodla(baytlar) {
	let bit = 0;
	let tampon = 0;
	let cikti = '';
	for (const b of baytlar) {
		tampon = (tampon << 8) | b;
		bit += 8;
		while (bit >= 5) {
			cikti += ALFABE[(tampon >>> (bit - 5)) & 31];
			bit -= 5;
		}
	}
	if (bit > 0) cikti += ALFABE[(tampon << (5 - bit)) & 31];
	return cikti;
}

/** Crockford base32 metnini baytlara çevirir. Tire ve boşluk yok sayılır. */
export function base32Coz(metin) {
	const temiz = metin.toUpperCase().replace(/[\s-]/g, '');
	let bit = 0;
	let tampon = 0;
	const cikti = [];
	for (const karakter of temiz) {
		const deger = COZUM.get(karakter);
		if (deger === undefined) throw new Error(`Tanınmayan karakter: ${karakter}`);
		tampon = (tampon << 5) | deger;
		bit += 5;
		if (bit >= 8) {
			cikti.push((tampon >>> (bit - 8)) & 255);
			bit -= 8;
		}
	}
	return Uint8Array.from(cikti);
}

/*
  Kontrol karakteri: anahtarın karmasının ilk 5 biti. Kriptografik bir koruma
  değil, yalnızca yanlış yazımı anahtarı sunucuya sormadan yakalamak için.
*/
function kontrolKarakteri(baytlar) {
	return ALFABE[createHash('sha256').update(baytlar).digest()[0] & 31];
}

/**
 * Yeni bir davet anahtarı üretir.
 * Dönen `metin` müşteriye verilen hâli, `karma` sunucuya yazılan hâli.
 * Ham baytlar hiçbir yere kaydedilmemeli.
 */
export function davetAnahtariUret() {
	const baytlar = randomBytes(ANAHTAR_BAYT);
	const govde = base32Kodla(baytlar);
	const gruplar = govde.match(/.{1,4}/g).join('-');
	return {
		baytlar,
		metin: `${gruplar}-${kontrolKarakteri(baytlar)}`,
		karma: karmala(baytlar),
	};
}

/**
 * Müşterinin girdiği metni baytlara çevirir ve kontrol karakterini doğrular.
 * Biçim bozuksa `null` döner: bu durumda sunucuya hiç gidilmez.
 */
export function davetAnahtariniCoz(girdi) {
	const temiz = String(girdi).toUpperCase().replace(/[\s-]/g, '');
	if (temiz.length < 2) return null;
	const govde = temiz.slice(0, -1);
	const kontrol = temiz.slice(-1);
	let baytlar;
	try {
		baytlar = base32Coz(govde);
	} catch {
		return null;
	}
	if (baytlar.length !== ANAHTAR_BAYT) return null;
	if (kontrolKarakteri(baytlar) !== kontrol) return null;
	return Buffer.from(baytlar);
}

/** Yeni oturum kimliği. `metin` çereze yazılır, `karma` veritabanına. */
export function oturumKimligiUret() {
	const baytlar = randomBytes(OTURUM_BAYT);
	return {
		metin: baytlar.toString('base64url'),
		karma: karmala(baytlar),
	};
}

/** Çerezden gelen oturum kimliğini karmasına çevirir. Biçim bozuksa `null`. */
export function oturumKarmasi(cerezDegeri) {
	if (typeof cerezDegeri !== 'string' || cerezDegeri.length < 40) return null;
	let baytlar;
	try {
		baytlar = Buffer.from(cerezDegeri, 'base64url');
	} catch {
		return null;
	}
	if (baytlar.length !== OTURUM_BAYT) return null;
	return karmala(baytlar);
}

/** SHA-256. Yüksek entropili sırlar için yeterli ve doğru olan karma. */
export function karmala(baytlar) {
	return createHash('sha256').update(baytlar).digest();
}

/*
  IP adresi düz metin saklanmıyor. Düz SHA-256 de yetmez: IPv4 uzayı küçük,
  bütün adresleri denemek saniyeler sürer. Bu yüzden sunucuda duran bir gizli
  anahtarla HMAC alınıyor; anahtar bilinmeden karma geri çevrilemez.
*/
export function ipKarmasi(ip, gizli) {
	if (!ip) return null;
	if (!gizli) throw new Error('IP karması için gizli anahtar gerekli');
	return createHmac('sha256', gizli).update(String(ip)).digest();
}

/**
 * İstemci izi: oturumun aynı tarayıcıda kaldığını ucuza kontrol etmek için.
 * Kimlik doğrulama değil, çalınmış çerezi fark etme ihtimalini artıran bir
 * ek katman. User-Agent değişirse oturum düşer.
 */
export function istemciIzi(userAgent, dilBasligi, gizli) {
	return createHmac('sha256', gizli)
		.update(`${userAgent ?? ''}\n${dilBasligi ?? ''}`)
		.digest();
}

/** Sabit zamanlı karşılaştırma. Uzunluk farkı da sızıntıdır, önce o bakılıyor. */
export function esitMi(a, b) {
	if (!a || !b) return false;
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	if (x.length !== y.length) return false;
	return timingSafeEqual(x, y);
}

/** Tablo anahtarları için kimlik. */
export function yeniKimlik() {
	return randomBytes(16).toString('hex');
}

/** CSRF işlem anahtarı. Oturuma bağlı, formda gizli alan olarak taşınıyor. */
export function islemAnahtariUret() {
	return randomBytes(32).toString('base64url');
}

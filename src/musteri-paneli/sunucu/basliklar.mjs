/*
  Güvenlik başlıkları (PANEL-TASARIMI.md §8).

  Politika tek yerde duruyor ve her yanıta ara katmandan bindiriliyor; sayfa
  başına yazılsaydı biri unutulurdu.
*/

import { randomBytes } from 'node:crypto';
import { ayarlar } from './ayarlar.mjs';

/** İstek başına yeni nonce. Tahmin edilebilir bir nonce, nonce değildir. */
export function nonceUret() {
	return randomBytes(16).toString('base64');
}

/**
 * İçerik güvenliği politikası.
 *
 * `script-src 'self' 'nonce-…'`: panelin betikleri Astro tarafından ayrı
 * dosyalara paketleniyor, yani hepsi `'self'` kapsamında. Nonce bugün hiçbir
 * etikette KULLANILMIYOR ve bu bilinçli: satır içi betik yok. Politikada
 * durmasının sebebi, ileride bir satır içi betik eklenirse nonce'suz
 * çalışmaması, yani kuralın sessizce gevşememesi.
 *
 * `style-src 'self'`: bu yüzden panelde tek bir Astro `<style>` bloğu da yok,
 * bütün stil `genel/panel.css` dosyasından geliyor. Astro `<style>` bloğu
 * kullanılsaydı geliştirme sunucusu onu satır içi basardı ve politika onu
 * engellerdi.
 *
 * `frame-ancestors 'none'`: panel hiçbir çerçeveye girmiyor (tıklama hırsızlığı).
 * `base-uri 'none'`: enjekte edilen bir `<base>` etiketiyle bütün göreli
 * adreslerin başka bir sunucuya çevrilmesini engelliyor.
 * `form-action 'self'`: form verisi dışarı postalanamıyor.
 */
export function politika(nonce) {
	return [
		"default-src 'none'",
		`script-src 'self' 'nonce-${nonce}'`,
		"style-src 'self'",
		"img-src 'self' data:",
		"font-src 'self'",
		"connect-src 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		"base-uri 'none'",
		"object-src 'none'",
		"manifest-src 'self'",
	].join('; ');
}

/** Yanıta güvenlik başlıklarını ekler. Aynı yanıt nesnesi geri dönüyor. */
export function basliklariEkle(yanit, nonce) {
	const b = yanit.headers;
	b.set('Content-Security-Policy', politika(nonce));
	b.set('X-Content-Type-Options', 'nosniff');
	/*
	  `no-referrer`: panel adresinin kendisi bile dışarı sızmasın. Panelde dış
	  bağlantı yok, kaybedilen bir şey de yok.
	*/
	b.set('Referrer-Policy', 'no-referrer');
	b.set('Cross-Origin-Opener-Policy', 'same-origin');
	b.set('Cross-Origin-Resource-Policy', 'same-origin');
	b.set('X-Frame-Options', 'DENY');
	b.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), interest-cohort=()');
	/*
	  Panel sayfaları kişiye özel: ortak vekil önbelleğinde durmamalı.
	*/
	if (!b.has('Cache-Control')) b.set('Cache-Control', 'no-store');
	/*
	  HSTS yalnızca gerçekten HTTPS ile sunulurken. Geliştirmede
	  http://localhost'a HSTS yazmak tarayıcıyı aylarca o adrese HTTPS
	  zorlamaya ikna eder ve geri alması zordur.
	*/
	if (ayarlar.cerezGuvenli) {
		b.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}
	return yanit;
}

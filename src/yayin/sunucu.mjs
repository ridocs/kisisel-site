import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const calistir = promisify(execFile);

/*
  YAYIN ALTYAPISIYLA KONUŞAN ORTAK KATMAN

  Site Cloudflare Pages'te duruyor. Hem `/durum` sayfası (durum.ts) hem de
  yayınlama yordamı (yayinla.mjs) buradan geçiyor: proje adı, adresler ve hata
  çevirisi tek yerde dursun diye.

  Dosya TypeScript değil, düz JavaScript. Sebebi ideolojik değil teknik:
  `eklenti.mjs` içindeki Vite ara katmanı bu modülü Astro'nun yapılandırma
  yükleyicisi üzerinden, yani doğrudan Node ile içeri alıyor. Node `.ts`
  okuyamıyor. Sayfa tarafı (`durum.ts`) Vite'ın içinden geçtiği için orada
  TypeScript serbest.

  Bu klasörün tamamı yalnızca panel kipinde var; yayın derlemesi buraya hiç
  bakmıyor. Gerekçe: eklenti.mjs.
*/

/** Cloudflare Pages proje adı. */
export const PAGES_PROJESI = 'mustafaeybek';

/** Ziyaretçinin gördüğü adres; "site ayakta mı" bu adresten ölçülüyor. */
export const CANLI_ADRES = 'https://mustafaeybek.com/';

/*
  Site haritası, "yerelde yazılmış ama yayında olmayan" yazıyı bulmanın en
  ucuz yolu: tek istekle yayındaki bütün adresleri veriyor. Yazı yazı HEAD
  isteği atmak onlarca istek demekti.

  `sitemap-0.xml` doğrudan okunuyor, `sitemap-index.xml` değil: index yalnızca
  tek bir parçaya işaret ediyor ve araya bir istek daha koymanın karşılığı yok.
*/
export const SITEMAP_ADRESI = 'https://mustafaeybek.com/sitemap-0.xml';

/** Önceki sürümlerin listesi ve geri alma Cloudflare panelinde. */
export const CLOUDFLARE_PANELI = `https://dash.cloudflare.com/?to=/:account/pages/view/${PAGES_PROJESI}`;

/** Wrangler proje bağımlılığı; `npx` Windows'ta kabuksuz çalışmıyor. */
export function wranglerYolu(kok = process.cwd()) {
	return join(kok, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
}

/*
  Canlı site yoklaması.

  `GET` kullanılıyor, `HEAD` değil: CDN bu ikisine farklı davranabiliyor ve
  ölçmek istediğimiz şey ziyaretçinin gerçekten yaşadığı istek. Yanıt gövdesi
  okunmadan atılıyor, ölçülen süre ilk yanıta kadar geçen süre.

  Önbellek atlatılıyor: `cache: 'no-store'` olmadan aradaki katmanlar eski bir
  200'ü gösterip site çökmüşken bile "ayakta" dedirtebilir.
*/
export async function canliYokla() {
	const basladi = Date.now();
	try {
		const yanit = await fetch(CANLI_ADRES, {
			cache: 'no-store',
			signal: AbortSignal.timeout(15_000),
		});
		await yanit.arrayBuffer();
		return { ulasildi: true, durumKodu: yanit.status, sureMs: Date.now() - basladi };
	} catch (hata) {
		return { ulasildi: false, hata: agHatasiMetni(hata), sureMs: Date.now() - basladi };
	}
}

/**
 * Yayındaki adreslerin listesi (sondaki eğik çizgi atılmış hâlde). Site
 * haritası okunamazsa `null` dönüyor — boş dizi dönseydi "yayında hiç sayfa
 * yok" gibi okunur ve her yazı yayınlanmamış görünürdü.
 */
export async function canliSayfalar() {
	try {
		const yanit = await fetch(SITEMAP_ADRESI, {
			cache: 'no-store',
			signal: AbortSignal.timeout(15_000),
		});
		if (!yanit.ok) return null;
		const xml = await yanit.text();
		const adresler = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((e) => e[1]);
		return adresler.map(adresiYolaCevir);
	} catch {
		return null;
	}
}

/** "https://mustafaeybek.com/blog/x/" → "/blog/x" */
export function adresiYolaCevir(adres) {
	try {
		return new URL(adres).pathname.replace(/\/+$/, '') || '/';
	} catch {
		return adres;
	}
}

/*
  Son yayınlar: Cloudflare'in kendi kaydından okunuyor. Wrangler oturumu yoksa
  ya da ağ yoksa hata FIRLATMIYOR; `/durum` sayfası çökmek yerine ne
  bilmediğini söylemeli.
*/
export async function yayinDurumu() {
	try {
		const { stdout } = await calistir(
			process.execPath,
			[wranglerYolu(), 'pages', 'deployment', 'list', '--project-name', PAGES_PROJESI, '--environment', 'production', '--json'],
			{ timeout: 60_000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8', windowsHide: true },
		);
		const liste = JSON.parse(stdout.slice(stdout.indexOf('[')));
		const son = liste[0];
		return {
			ulasildi: true,
			surumSayisi: liste.length,
			sonYayin: son ? yayinZamani(String(son.Status ?? '')) : null,
			adres: son ? String(son.Deployment ?? '') : null,
		};
	} catch (hata) {
		return { ulasildi: false, hata: hataMetni(hata) };
	}
}

const ZAMAN_BIRIMLERI = {
	second: 'saniye',
	minute: 'dakika',
	hour: 'saat',
	day: 'gün',
	week: 'hafta',
	month: 'ay',
	year: 'yıl',
};

/*
  Wrangler bu listede `Status` alanına durum değil göreli zaman yazıyor
  ("30 seconds ago"). Bilinen kalıp Türkçeye çevriliyor; "Failure" gibi başka
  bir sözcük gelirse olduğu gibi gösteriliyor ki gizlenmesin.
*/
export function yayinZamani(metin) {
	const eslesme = /^(\d+|an?)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i.exec(metin.trim());
	if (!eslesme) return metin;
	const adet = /^\d/.test(eslesme[1]) ? eslesme[1] : '1';
	return `${adet} ${ZAMAN_BIRIMLERI[eslesme[2].toLowerCase()]} önce`;
}

/*
  `fetch` hataları wrangler hatalarından farklı konuşuyor; ikisi tek çeviriciye
  sığmıyordu. Buradaki metinler kullanıcıya ne yapacağını söylemeli, hatanın
  İngilizce adını değil.
*/
function agHatasiMetni(hata) {
	const metin = hata instanceof Error ? `${hata.name}: ${hata.message}` : String(hata);
	if (/TimeoutError|AbortError|timed out/i.test(metin)) {
		return 'Site 15 saniye içinde yanıt vermedi.';
	}
	if (/ENOTFOUND|getaddrinfo|EAI_AGAIN/i.test(metin)) {
		return 'Adres çözülemedi; bu makinede internet bağlantısı yok gibi görünüyor.';
	}
	if (/ECONNREFUSED/i.test(metin)) {
		return 'Bağlantı reddedildi.';
	}
	if (/certificate|SSL|TLS/i.test(metin)) {
		return `Güvenli bağlantı kurulamadı: ${metin}`;
	}
	return `Siteye ulaşılamadı: ${metin}`;
}

/** Wrangler hatalarının Türkçe karşılığı. */
export function hataMetni(hata) {
	const metin =
		hata instanceof Error
			? `${hata.message}\n${String(/** @type {{ stderr?: string }} */ (hata).stderr ?? '')}`
			: String(hata);

	if (/not authenticated|wrangler login|Authentication|10000/i.test(metin)) {
		return 'Cloudflare oturumu yok. Terminalde `npx wrangler login` çalıştırın.';
	}
	if (/Cannot find module|MODULE_NOT_FOUND/i.test(metin)) {
		return 'Wrangler kurulu değil. Proje klasöründe `npm install` çalıştırın.';
	}
	if (/timed out|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed/i.test(metin)) {
		return "Cloudflare'e bağlanılamadı. İnternet bağlantısını kontrol edin.";
	}
	return `Cloudflare komutu başarısız oldu. Verdiği yanıt:\n${metin.trim()}`;
}

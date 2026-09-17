// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite';
import { satteri } from '@astrojs/markdown-satteri';
import gorselTabani from './araclar/gorsel-tabani-eklentisi.mjs';

// Yayın yolu tek yerde: `base` ile markdown görsellerinin öneki aynı değeri
// kullanmak zorunda, ikisi ayrışırsa görseller sessizce 404 veriyor.
const TABAN = '/web-sitem';

// https://astro.build/config
export default defineConfig({
	// Sitemap, RSS ve canonical mutlak URL üretebilmek için buna ihtiyaç duyar.
	site: 'https://twinshareapp.com',
	// Site alan adının kökünde değil, bir alt dizinde yayınlanıyor.
	// Astro yalnızca kendi ürettiği varlık yollarını (_astro/…) bu önekle
	// yazar; elle yazdığımız bağlantılar src/i18n/ceviriler.ts içindeki
	// `taban` üzerinden aynı öneki alıyor.
	base: TABAN,
	/*
	  Yazı içindeki görseller: alt dizin öneki ve metin karşılığı denetimi.
	  Gerekçesi araclar/gorsel-tabani-eklentisi.mjs içinde.

	  `rehypePlugins` DEĞİL: bu sürümde varsayılan markdown işlemcisi Sätteri
	  ve unified artık kurulu gelmiyor — rehype eklentisi verildiğinde derleme
	  "@astrojs/markdown-remark kurulu değil" diyerek duruyor. Ölçüldü.
	*/
	markdown: {
		processor: satteri({ hastPlugins: [gorselTabani({ taban: TABAN })] }),
	},
	// Türkçe varsayılan ve ön ek almıyor: "/blog". İngilizce "/en/blog".
	i18n: {
		defaultLocale: 'tr',
		locales: ['tr', 'en'],
		routing: { prefixDefaultLocale: false },
	},
	// React yalnızca hero gibi etkileşimli adacıklar için; sayfaların geri kalanı
	// istemciye JavaScript göndermemeye devam ediyor.
	integrations: [
		mdx(),
		// Hata sayfaları site haritasına girmiyor: ikisi de `noindex` işaretli,
		// haritada durmaları çelişki olurdu. Eklenti yalnızca kökteki /404'ü
		// kendiliğinden atıyor, /en/404 elle süzülüyor.
		sitemap({ filter: (sayfa) => !sayfa.includes('/404') }),
		icon(),
		/*
		  React BURADA YOK — bilerek.

		  Yayınlanan sitede tek bir React adacığı bulunmuyor (`client:*`
		  direktifi hiçbir dosyada geçmiyor). Entegrasyon yine de kayıtlı
		  olduğu için derleme her seferinde `_astro/client.*.js` üretiyordu:
		  ~220 KB, hiçbir sayfanın çağırmadığı ölü bir dosya. Ziyaretçiye
		  inmiyordu ama her yayında sunucuya gidiyordu.

		  React'e ihtiyacı olan tek yer Keystatic; o da `astro.config.cms.mjs`
		  içinde, kendi entegrasyonunun yanında duruyor.
		*/
	],
	vite: {
		// Vite, bilinmeyen host başlıklarını güvenlik gereği reddediyor. Siteyi
		// geçici bir Cloudflare tüneliyle paylaşırken önizleme sunucusuna bu alan
		// adından erişilebilmesi için izin veriliyor; yalnızca bu alt alan adları.
		preview: { allowedHosts: ['.trycloudflare.com'] },
		server: { allowedHosts: ['.trycloudflare.com'] },
		plugins: [
			tailwindcss(),
			// Teknoloji logolarını derleme sırasında bileşene gömer: çalışma anında
			// ağ isteği yok, çevrimdışı çalışır, yalnızca kullanılan ikonlar paketlenir.
			Icons({ compiler: 'jsx', jsx: 'react' }),
		],
	},
});

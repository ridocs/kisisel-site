// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite';

// https://astro.build/config
export default defineConfig({
	// Sitemap ve RSS mutlak URL üretebilmek için buna ihtiyaç duyar.
	// Kendi alan adını aldığında burayı değiştir.
	site: 'https://ridocs.github.io',
	// Türkçe varsayılan ve ön ek almıyor: "/blog". İngilizce "/en/blog".
	i18n: {
		defaultLocale: 'tr',
		locales: ['tr', 'en'],
		routing: { prefixDefaultLocale: false },
	},
	// React yalnızca hero gibi etkileşimli adacıklar için; sayfaların geri kalanı
	// istemciye JavaScript göndermemeye devam ediyor.
	integrations: [mdx(), sitemap(), icon(), react()],
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

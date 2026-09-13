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
	// React yalnızca hero gibi etkileşimli adacıklar için; sayfaların geri kalanı
	// istemciye JavaScript göndermemeye devam ediyor.
	integrations: [mdx(), sitemap(), icon(), react()],
	vite: {
		plugins: [
			tailwindcss(),
			// Teknoloji logolarını derleme sırasında bileşene gömer: çalışma anında
			// ağ isteği yok, çevrimdışı çalışır, yalnızca kullanılan ikonlar paketlenir.
			Icons({ compiler: 'jsx', jsx: 'react' }),
		],
	},
});

// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
	// Sitemap ve RSS mutlak URL üretebilmek için buna ihtiyaç duyar.
	// Kendi alan adını aldığında burayı değiştir.
	site: 'https://ridocs.github.io',
	integrations: [mdx(), sitemap(), icon()],
	vite: {
		plugins: [tailwindcss()],
	},
});

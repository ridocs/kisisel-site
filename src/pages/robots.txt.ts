import type { APIRoute } from 'astro';
import { taban } from '@/i18n/ceviriler';

/*
  robots.txt derleme anında üretiliyor; içindeki sitemap adresi elle yazılmıyor.
  Alan adı `astro.config.mjs` içindeki `site`, alt dizin de `base` ayarından
  geliyor. Site alan adının kökünde olduğu için dosya arama motorlarının
  okuduğu yerde duruyor.
*/
export const GET: APIRoute = ({ site }) => {
	const sitemap = new URL(`${taban}/sitemap-index.xml`, site);

	const metin = `User-agent: *
Allow: /

Sitemap: ${sitemap.href}
`;

	return new Response(metin, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};

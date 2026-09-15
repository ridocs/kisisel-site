import type { APIRoute } from 'astro';
import { taban } from '@/i18n/ceviriler';

/*
  robots.txt derleme anında üretiliyor; içindeki sitemap adresi elle yazılmıyor.
  Alan adı `astro.config.mjs` içindeki `site`, alt dizin de `base` ayarından
  geliyor — site kendi alan adının köküne taşındığında bu dosyada değişecek
  hiçbir şey yok.

  SINIR: robots.txt yalnızca alan adının KÖKÜNDEN okunur. Site şu an
  /web-sitem altında yayınlandığı için bu dosya .../web-sitem/robots.txt
  adresine düşüyor ve arama motorları onu okumaz. Alt dizin geçici olduğundan
  ek bir kural kurulmadı: köke taşındığında dosya kendiliğinden doğru yere gelir.
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

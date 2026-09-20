import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { taban } from '@/i18n/ceviriler';

/*
  AKIŞ DİLE GÖRE AYRI.

  Önce tek akış vardı ve İKİ DİLİN yazılarını birlikte veriyordu; üstelik
  İngilizce yazıların bağlantısı da Türkçe yola (`/blog/<id>/`) yazılıyordu,
  yani okuyucu var olmayan bir adrese gidiyordu. Akış ayrıca kendini
  `tr-tr` diye tanıtıyordu.

  Bir akış TEK bir dili ilan eder; karışık akış hem okuyucuya yanlış içerik
  gösterir hem de okuyucu uygulamasına yanlış dil bildirir. Bu yüzden iki
  ayrı akış var ve her sayfa kendi dilininkini gösteriyor.
*/

export async function GET(context) {
	const yazilar = (
		await getCollection('blog', ({ data }) => !data.draft && data.dil === 'tr')
	).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

	return rss({
		title: 'Mustafa Eybek Blog',
		description: 'Kişisel blog yazıları.',
		// Kanalın kendi bağlantısı da alt dizini göstermeli; context.site
		// yalnızca alan adının kökünü verir.
		site: new URL(taban + '/', context.site),
		items: yazilar.map((yazi) => ({
			title: yazi.data.title,
			description: yazi.data.description,
			pubDate: yazi.data.pubDate,
			// Alt dizinde yayınlandığında bağlantılar da öneki taşımalı.
			link: `${taban}/blog/${yazi.id}/`,
		})),
		customData: '<language>tr-tr</language>',
	});
}

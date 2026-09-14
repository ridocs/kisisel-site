import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { taban } from '@/i18n/ceviriler';

export async function GET(context) {
	const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
		(a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
	);

	return rss({
		title: 'Mustafa — Blog',
		description: 'Kişisel blog yazıları.',
		// Kanalın kendi bağlantısı da alt dizini göstermeli; context.site
		// yalnızca alan adının kökünü verir.
		site: new URL(taban + '/', context.site),
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			// Alt dizinde yayınlandığında bağlantılar da öneki taşımalı.
			link: `${taban}/blog/${post.id}/`,
		})),
		customData: '<language>tr-tr</language>',
	});
}

/**
 * Arayüz metinleri. Tek kaynak burası; sayfalar ve bileşenler metni buradan
 * alır, böylece iki dil arasında eksik/çelişkili çeviri kalmaz.
 */
export const diller = ['tr', 'en'] as const;
export type Dil = (typeof diller)[number];

export const varsayilanDil: Dil = 'tr';

export const ceviriler = {
	tr: {
		'site.baslik': 'Mustafa Eybek — Kişisel Site',
		'site.aciklama': 'Kişisel tanıtım ve blog sitesi.',

		'nav.anasayfa': 'Ana Sayfa',
		'nav.blog': 'Blog',
		'nav.hakkimda': 'Hakkımda',
		'nav.iletisim': 'İletişim',
		'nav.rss': 'RSS akışı',
		'nav.menuAc': 'Menüyü aç',
		'nav.menuKapat': 'Menüyü kapat',
		'nav.koyuTema': 'Koyu temaya geç',
		'nav.acikTema': 'Açık temaya geç',
		'nav.dilDegistir': 'Switch to English',
		'nav.icerigeGec': 'İçeriğe geç',

		'hero.altBaslik':
			'Yazılım geliştirici. Web uygulamaları, altyapı ve otomasyon üzerine çalışıyorum; öğrendiklerimi burada yazıyorum.',
		'hero.birincilDugme': 'Yazıları oku',
		'hero.ikincilDugme': 'GitHub profilim',

		'anasayfa.sonYazilar': 'Son yazılar',
		'anasayfa.tumYazilar': 'Tüm yazılar →',

		'blog.baslik': 'Blog',
		'blog.sayfaBasligi': 'Blog — Mustafa Eybek',
		'blog.aciklama': 'Yazılar.',

		'hakkimda.baslik': 'Hakkımda',
		'hakkimda.sayfaBasligi': 'Hakkımda — Mustafa Eybek',
		'hakkimda.aciklama': 'Mustafa Eybek kimdir, neler yapar.',
		'hakkimda.metin':
			'Buraya kendini anlatan metni yaz: ne yaptığın, hangi konularla ilgilendiğin, nerede çalıştığın.',
		'hakkimda.iletisimBaslik': 'İletişim',
		'hakkimda.iletisimMetin':
			'Ulaşılmak istediğin kanalları (e-posta, sosyal hesaplar) buraya ekle.',

		'altbilgi.lisans': 'MIT lisansı ile yayımlanmıştır.',
	},
	en: {
		'site.baslik': 'Mustafa Eybek — Personal Site',
		'site.aciklama': 'Personal site and blog.',

		'nav.anasayfa': 'Home',
		'nav.blog': 'Blog',
		'nav.hakkimda': 'About',
		'nav.iletisim': 'Contact',
		'nav.rss': 'RSS feed',
		'nav.menuAc': 'Open menu',
		'nav.menuKapat': 'Close menu',
		'nav.koyuTema': 'Switch to dark theme',
		'nav.acikTema': 'Switch to light theme',
		'nav.dilDegistir': 'Türkçeye geç',
		'nav.icerigeGec': 'Skip to content',

		'hero.altBaslik':
			'Software developer. I work on web applications, infrastructure and automation — and write about what I learn.',
		'hero.birincilDugme': 'Read the posts',
		'hero.ikincilDugme': 'My GitHub',

		'anasayfa.sonYazilar': 'Latest posts',
		'anasayfa.tumYazilar': 'All posts →',

		'blog.baslik': 'Blog',
		'blog.sayfaBasligi': 'Blog — Mustafa Eybek',
		'blog.aciklama': 'Writing.',

		'hakkimda.baslik': 'About',
		'hakkimda.sayfaBasligi': 'About — Mustafa Eybek',
		'hakkimda.aciklama': 'Who Mustafa Eybek is and what he does.',
		'hakkimda.metin':
			'Write your introduction here: what you do, which topics you care about, where you work.',
		'hakkimda.iletisimBaslik': 'Contact',
		'hakkimda.iletisimMetin': 'Add the channels you want to be reached on (email, social accounts).',

		'altbilgi.lisans': 'Published under the MIT license.',
	},
} as const;

/** Yol adından dili çıkarır: /en/... -> "en", diğer her şey -> "tr". */
export function dilBul(url: URL): Dil {
	const [, ilkParca] = url.pathname.split('/');
	return (diller as readonly string[]).includes(ilkParca) ? (ilkParca as Dil) : varsayilanDil;
}

/** Seçili dile göre metin döndüren yardımcı. */
export function cevirici(dil: Dil) {
	return function metin(anahtar: keyof (typeof ceviriler)['tr']): string {
		return ceviriler[dil][anahtar];
	};
}

/**
 * Dile göre yol üretir. Varsayılan dil ön ek almaz: "/blog" ve "/en/blog".
 */
export function yol(dil: Dil, parca = ''): string {
	const temiz = parca.replace(/^\/+/, '');
	if (dil === varsayilanDil) return `/${temiz}`;
	return `/${dil}/${temiz}`;
}

/** Aynı sayfanın diğer dildeki karşılığı (dil değiştirici için). */
export function digerDilYolu(url: URL, hedef: Dil): string {
	const parcalar = url.pathname.split('/').filter(Boolean);
	if ((diller as readonly string[]).includes(parcalar[0])) parcalar.shift();
	// Yol adları dile göre değişiyor: hakkımda <-> about
	const esleme: Record<string, Record<Dil, string>> = {
		hakkimda: { tr: 'hakkimda', en: 'about' },
		about: { tr: 'hakkimda', en: 'about' },
	};
	if (parcalar[0] && esleme[parcalar[0]]) parcalar[0] = esleme[parcalar[0]][hedef];
	return yol(hedef, parcalar.join('/'));
}

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

		// Hero'dan sonra gelen tanıtım bölümü. Metinler yer tutucu; değiştirilecek.
		'tanitim.ustBaslik': 'NE YAPIYORUM?',
		'tanitim.paragraf1':
			'Web uygulamaları geliştiriyorum: arayüzden veritabanına, dağıtımdan otomasyona kadar işin her ucuna dokunuyorum.',
		'tanitim.paragraf2':
			'Öğrendiklerimi not almayı seviyorum. Buradaki yazılar çoğunlukla karşılaştığım sorunların ve çözümlerinin kaydı.',
		'tanitim.paragraf3':
			'Yeni bir iş, ortak bir proje ya da sadece sohbet için yazabilirsin.',
		'tanitim.dugme': 'Devamını oku',
		'tanitim.gorselAlt': 'Mustafa Eybek portre fotoğrafı',

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

		// Yetkinlikler
		'yetkinlik.ustBaslik': 'YETKİNLİKLER',
		'yetkinlik.baslik': 'Kullandığım diller ve araçlar',
		'yetkinlik.metin':
			'Günlük işimde en çok dokunduğum teknolojiler ve her biriyle ne kadar yol aldığım.',
		'yetkinlik.ipucu': 'Ayrıntı için tıkla',
		'yetkinlik.ilerlemeBaslik': 'NEREDE KULLANDIM',

		// 404 sayfası
		'404.sayfaBasligi': 'Sayfa bulunamadı',
		'404.baslik': 'Hop! Sayfa kayıp.',
		'404.metin': 'Aradığın sayfa buralarda değil — galiba hayalet olmuş.',
		'404.dugme': 'Ana sayfaya dön',
		'404.ikincilBag': 'Yazılara göz at',
		'404.hayaletAlt': 'Şaşkın bir hayalet çizimi',
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

		'tanitim.ustBaslik': 'WHAT I DO',
		'tanitim.paragraf1':
			'I build web applications — touching every end of the work, from the interface to the database, from deployment to automation.',
		'tanitim.paragraf2':
			'I like taking notes on what I learn. Most of the writing here is a record of problems I ran into and how I solved them.',
		'tanitim.paragraf3': 'Write to me for a new role, a shared project, or just a conversation.',
		'tanitim.dugme': 'Read more',
		'tanitim.gorselAlt': 'Portrait photo of Mustafa Eybek',

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

		// Skills
		'yetkinlik.ustBaslik': 'SKILLS',
		'yetkinlik.baslik': 'Languages and tools I use',
		'yetkinlik.metin':
			'The technologies I touch most in daily work, and how far I have come with each.',
		'yetkinlik.ipucu': 'Click for details',
		'yetkinlik.ilerlemeBaslik': 'WHERE I USED IT',

		// 404 page
		'404.sayfaBasligi': 'Page not found',
		'404.baslik': 'Boo! Page missing.',
		'404.metin': "The page you are looking for isn't here — it must be a ghost.",
		'404.dugme': 'Back to home',
		'404.ikincilBag': 'Browse the posts',
		'404.hayaletAlt': 'Drawing of a puzzled ghost',
	},
} as const;

/** Yol adından dili çıkarır: /en/... -> "en", diğer her şey -> "tr". */
export function dilBul(url: URL): Dil {
	const [ilkParca] = tabansizParcalar(url);
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
/**
 * Sitenin yayınlandığı alt dizin ('' ya da ör. '/web-sitem').
 *
 * Astro'nun `base` ayarı yalnızca kendi ürettiği varlık yollarını önekler;
 * elle yazdığımız bağlantıları öneklemez. Bu yüzden bağlantı üreten her yer
 * buradan geçiyor. Sondaki eğik çizgi atılıyor ki birleştirmede çift
 * çizgi oluşmasın.
 */
export const taban = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

/** Yol parçalarını, varsa alt dizin önekini atarak döndürür. */
function tabansizParcalar(url: URL): string[] {
	let yolAdi = url.pathname;
	if (taban && (yolAdi === taban || yolAdi.startsWith(taban + '/'))) {
		yolAdi = yolAdi.slice(taban.length);
	}
	return yolAdi.split('/').filter(Boolean);
}

export function yol(dil: Dil, parca = ''): string {
	// Sondaki eğik çizgi bilinçli: derleme dizin tabanlı çıktı üretiyor
	// (/blog/index.html). Çizgisiz bağlantı sunucuda 301 ile çizgili
	// hâline yönlendiriliyordu; her gezinmede fazladan bir gidiş-dönüş.
	const temiz = parca.replace(/^\/+/, '').replace(/\/*$/, '');
	const kuyruk = temiz ? `${temiz}/` : '';
	if (dil === varsayilanDil) return `${taban}/${kuyruk}`;
	return `${taban}/${dil}/${kuyruk}`;
}

/** Aynı sayfanın diğer dildeki karşılığı (dil değiştirici için). */
export function digerDilYolu(url: URL, hedef: Dil): string {
	const parcalar = tabansizParcalar(url);
	if ((diller as readonly string[]).includes(parcalar[0])) parcalar.shift();
	// Yol adları dile göre değişiyor: hakkımda <-> about
	const esleme: Record<string, Record<Dil, string>> = {
		hakkimda: { tr: 'hakkimda', en: 'about' },
		about: { tr: 'hakkimda', en: 'about' },
	};
	if (parcalar[0] && esleme[parcalar[0]]) parcalar[0] = esleme[parcalar[0]][hedef];
	return yol(hedef, parcalar.join('/'));
}

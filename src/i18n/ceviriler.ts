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

		// Sayfa boyunca inen yazı sarmaşığı. Süs; ekran okuyucuya verilmiyor.
		'sarmasik.metin': 'Mustafa Eybek',

		// Seçilmiş çalışmalar. Proje metinleri yer tutucu.
		'calisma.ustBaslik': 'SEÇİLMİŞ ÇALIŞMALAR',
		'calisma.baslik': 'Üzerinde çalıştığım işler',
		'calisma.metin':
			'Araçlardan çok sonuç anlatan birkaç iş. Hepsini değil, anlatmaya değer olanları koyuyorum.',

		'blog.baslik': 'Blog',
		'blog.sayfaBasligi': 'Blog — Mustafa Eybek',
		'blog.aciklama': 'Yazılar.',

		/*
		  Hakkımda sayfası.

		  Tanıtım metinleri (giris, metin, metin2) YER TUTUCU ve bunu okuyana da
		  söylüyorlar — sitedeki diğer yer tutucularla (proje adları, portre)
		  aynı kalıp. Uydurma bir özgeçmiş yazmak yerine ne yazılacağı yazıldı.
		  İlke metinleri yer tutucu değil: üçü de bu deponun kendi çalışma
		  biçimini anlatıyor, doğrulanabilir. Kullanıcı isterse değiştirebilir.
		*/
		'hakkimda.baslik': 'Hakkımda',
		'hakkimda.sayfaBasligi': 'Hakkımda — Mustafa Eybek',
		'hakkimda.aciklama': 'Mustafa Eybek kimdir, neler yapar.',
		'hakkimda.ustBaslik': 'HAKKIMDA',
		'hakkimda.giris':
			'Buraya tek cümlelik güçlü bir giriş yaz: ne yaptığın ve neyi iyi yaptığın. Sayfada ilk okunan satır bu olacak.',
		'hakkimda.metin':
			'Buraya kendini anlatan metni yaz: ne yaptığın, hangi konularla ilgilendiğin, nerede çalıştığın.',
		'hakkimda.metin2':
			'İkinci paragrafta yolu anlat: nereden başladın, şu an neyle uğraşıyorsun, sırada ne var.',

		'hakkimda.kunyeBaslik': 'KÜNYE',
		'hakkimda.kunyeRol': 'Rol',
		'hakkimda.kunyeKonum': 'Konum',
		'hakkimda.kunyeDurum': 'Durum',
		'hakkimda.kunyeKod': 'Kod',

		'hakkimda.ilkeUstBaslik': 'NASIL ÇALIŞIYORUM',
		'hakkimda.ilkeBaslik': 'Çalışırken tuttuğum üç şey',
		'hakkimda.ilkeMetin':
			'İddia değil, alışkanlık. Bu sitenin kendisi de aynı üç kurala göre kuruldu.',
		'hakkimda.ilke1Baslik': 'Önce en basit çözüm',
		'hakkimda.ilke1Metin':
			'İşi çözen en az kodu yazıyorum. Bir kütüphane gerçekten gerekmiyorsa eklemiyorum — bu sayfada tarayıcıya inen çerçeve kodu yok.',
		'hakkimda.ilke2Baslik': 'Erişilebilirlik sonradan eklenmez',
		'hakkimda.ilke2Metin':
			'Klavyeyle gezinme, kontrast ve hareket tercihleri tasarımın parçası. Sonradan yamanan bir arayüz hiçbir zaman tam oturmuyor.',
		'hakkimda.ilke3Baslik': 'Ölçmeden “oldu” demiyorum',
		'hakkimda.ilke3Metin':
			'Her değişikliği gerçek cihazda açıp bakıyorum. Yerelde iyi görünenin telefonda da iyi olduğunu varsaymak en pahalı hata.',

		'hakkimda.iletisimUstBaslik': 'İLETİŞİM',
		'hakkimda.iletisimBaslik': 'Bana nasıl ulaşırsın',
		'hakkimda.iletisimMetin':
			'Yeni bir iş, ortak bir proje ya da sadece sohbet için yazabilirsin. En hızlı yol e-posta.',
		'hakkimda.kanalEposta': 'E-posta',
		'hakkimda.kanalEpostaNot': 'En güvenilir yol; genelde aynı gün dönüyorum.',
		'hakkimda.kanalWhatsappNot': 'Kısa sorular ve hızlı geri dönüşler için.',
		'hakkimda.kanalGithubNot': 'Kodun durduğu yer.',
		'hakkimda.kanalKonum': 'Konum',
		'hakkimda.kanalKonumNot': 'Saat dilimi UTC+3.',

		'yazi.ustBaslik': 'YAZILAR',
		'yazi.bos': 'Henüz yayımlanmış bir yazı yok. Yakında burada olacak.',
		'yazi.dakika': 'dk okuma',
		'yazi.guncellendi': 'güncellendi',
		'yazi.tumune': '← Tüm yazılar',
		'yazi.sonraki': 'Sonraki içerik →',

		'iletisim.ustBaslik': 'İLETİŞİM',
		'iletisim.baslik': 'Bir fikrin mi var, konuşalım',
		'iletisim.durum': 'Yeni işlere açığım',
		'iletisim.rol': 'Yazılım geliştirici',
		'iletisim.yaz': 'Bana yaz',
		'iletisim.kopyala': 'E-postayı kopyala',
		'iletisim.kopyalandi': 'Kopyalandı',
		'iletisim.qrAlt': 'Sitenin adresini içeren kare kod',
		'iletisim.qrNot': 'Telefonunla okut, site cebinde açılsın.',
		'iletisim.serit': 'Genelde aynı gün dönüyorum',

		'altbilgi.tanim': 'Web uygulamaları, altyapı ve otomasyon üzerine çalışıyorum.',
		'altbilgi.gezinme': 'Altbilgi gezinmesi',
		'altbilgi.gezinmeBaslik': 'Sayfalar',
		'altbilgi.baglantiBaslik': 'Bağlantılar',
		'altbilgi.sifirJs': 'tarayıcıya inen JavaScript yok',
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

		'sarmasik.metin': 'Mustafa Eybek',

		'calisma.ustBaslik': 'SELECTED WORK',
		'calisma.baslik': 'Things I have built',
		'calisma.metin':
			'A few pieces of work that speak to outcomes rather than tools. Not everything — only what is worth telling.',

		'blog.baslik': 'Blog',
		'blog.sayfaBasligi': 'Blog — Mustafa Eybek',
		'blog.aciklama': 'Writing.',

		'hakkimda.baslik': 'About',
		'hakkimda.sayfaBasligi': 'About — Mustafa Eybek',
		'hakkimda.aciklama': 'Who Mustafa Eybek is and what he does.',
		'hakkimda.ustBaslik': 'ABOUT',
		'hakkimda.giris':
			'Write one strong opening sentence here: what you do and what you are good at. It is the first line anyone reads on this page.',
		'hakkimda.metin':
			'Write your introduction here: what you do, which topics you care about, where you work.',
		'hakkimda.metin2':
			'Use the second paragraph for the path: where you started, what you are working on now, what comes next.',

		'hakkimda.kunyeBaslik': 'AT A GLANCE',
		'hakkimda.kunyeRol': 'Role',
		'hakkimda.kunyeKonum': 'Location',
		'hakkimda.kunyeDurum': 'Status',
		'hakkimda.kunyeKod': 'Code',

		'hakkimda.ilkeUstBaslik': 'HOW I WORK',
		'hakkimda.ilkeBaslik': 'Three things I hold on to',
		'hakkimda.ilkeMetin':
			'Habits, not claims. This site was built on the same three rules.',
		'hakkimda.ilke1Baslik': 'The simplest solution first',
		'hakkimda.ilke1Metin':
			'I write the least code that solves the problem. If a library is not genuinely needed, it does not go in — no framework code is shipped to the browser on this page.',
		'hakkimda.ilke2Baslik': 'Accessibility is not bolted on',
		'hakkimda.ilke2Metin':
			'Keyboard navigation, contrast and motion preferences are part of the design. An interface patched afterwards never quite settles.',
		'hakkimda.ilke3Baslik': 'No “it works” without measuring',
		'hakkimda.ilke3Metin':
			'I open every change on a real device. Assuming what looks right locally looks right on a phone is the most expensive mistake there is.',

		'hakkimda.iletisimUstBaslik': 'CONTACT',
		'hakkimda.iletisimBaslik': 'How to reach me',
		'hakkimda.iletisimMetin':
			'Write to me for a new role, a shared project, or just a conversation. Email is the quickest route.',
		'hakkimda.kanalEposta': 'Email',
		'hakkimda.kanalEpostaNot': 'The most reliable route; I usually reply the same day.',
		'hakkimda.kanalWhatsappNot': 'For short questions and quick replies.',
		'hakkimda.kanalGithubNot': 'Where the code lives.',
		'hakkimda.kanalKonum': 'Location',
		'hakkimda.kanalKonumNot': 'Time zone UTC+3.',

		'yazi.ustBaslik': 'WRITING',
		'yazi.bos': 'No posts published yet. They will show up here.',
		'yazi.dakika': 'min read',
		'yazi.guncellendi': 'updated',
		'yazi.tumune': '← All posts',
		'yazi.sonraki': 'Next post →',

		'iletisim.ustBaslik': 'CONTACT',
		'iletisim.baslik': 'Got an idea? Let us talk',
		'iletisim.durum': 'Available for work',
		'iletisim.rol': 'Software developer',
		'iletisim.yaz': 'Write to me',
		'iletisim.kopyala': 'Copy email',
		'iletisim.kopyalandi': 'Copied',
		'iletisim.qrAlt': 'Square code containing the address of this site',
		'iletisim.qrNot': 'Scan it and the site opens on your phone.',
		'iletisim.serit': 'I usually reply the same day',

		'altbilgi.tanim': 'I work on web applications, infrastructure and automation.',
		'altbilgi.gezinme': 'Footer navigation',
		'altbilgi.gezinmeBaslik': 'Pages',
		'altbilgi.baglantiBaslik': 'Links',
		'altbilgi.sifirJs': 'zero JavaScript shipped',
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

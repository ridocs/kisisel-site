/**
 * Arayüz metinleri. Tek kaynak burası; sayfalar ve bileşenler metni buradan
 * alır, böylece iki dil arasında eksik/çelişkili çeviri kalmaz.
 */
export const diller = ['tr', 'en'] as const;
export type Dil = (typeof diller)[number];

export const varsayilanDil: Dil = 'tr';

export const ceviriler = {
	tr: {
		/*
		  Ana sayfanın <title>'ı ve sitenin varsayılan açıklaması. İkisi de arama
		  sonucunda görünen metin: başlık ~60, açıklama ~155 karakteri aşmamalı,
		  ama "Kişisel site" gibi bir satır da neyin ne olduğunu söylemiyor.
		*/
		'site.baslik': 'Mustafa Eybek — Yazılım geliştirici, Kayseri',
		'site.aciklama':
			'Kayseri’de çalışan yazılım geliştirici. Web uygulamaları, altyapı ve otomasyon üzerine işler; öğrendiklerimi anlattığım yazılar burada.',

		'nav.anasayfa': 'Ana Sayfa',
		'nav.blog': 'Blog',
		'nav.hakkimda': 'Hakkımda',
		'nav.hizmetler': 'Hizmetler',
		'nav.kullandiklarim': 'Kullandıklarım',
		'nav.gizlilik': 'Gizlilik',
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
		// Başlık iki dilde birebir aynıydı; arama motoru için iki ayrı sayfa
		// aynı başlıkla yarışıyordu.
		'blog.sayfaBasligi': 'Blog: yazılım ve altyapı notları — Mustafa Eybek',
		'blog.aciklama':
			'Karşılaştığım sorunların ve çözümlerinin kaydı: web geliştirme, CSS, altyapı ve otomasyon üzerine ölçerek yazılmış kısa notlar.',

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
		'hakkimda.aciklama':
			'Mustafa Eybek kimdir, neler yapar: nasıl çalıştığı, kullandığı araçlar ve ulaşma yolları. Kayseri’de yazılım geliştirici.',
		'hakkimda.ustBaslik': 'HAKKIMDA',
		'hakkimda.giris':
			'Buraya tek cümlelik güçlü bir giriş yaz: ne yaptığın ve neyi iyi yaptığın. Sayfada ilk okunan satır bu olacak.',
		'hakkimda.metin':
			'Buraya kendini anlatan metni yaz: ne yaptığın, hangi konularla ilgilendiğin, nerede çalıştığın.',
		'hakkimda.metin2':
			'İkinci paragrafta yolu anlat: nereden başladın, şu an neyle uğraşıyorsun, sırada ne var.',

		'hakkimda.portreAlt': 'Mustafa Eybek portre fotoğrafı',
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

		/*
		  Hizmetler sayfası.

		  Metinler yer tutucu DEĞİL: dört kalem de sitenin başka yerlerinde
		  (hero, tanıtım, yetkinlikler, DAGITIM.md) zaten yazılı olan işleri
		  anlatıyor. Bilinçli olarak yok olanlar: fiyat, teslim süresi, müşteri
		  sayısı ve referans. Hiçbiri doğrulanabilir değil, hepsi bakım yükü.
		*/
		'hizmet.sayfaBasligi': 'Hizmetler: web geliştirme ve altyapı — Mustafa Eybek',
		'hizmet.aciklama':
			'Aldığım işler: web uygulaması geliştirme, arayüz uygulaması, altyapı ve dağıtım, otomasyon. Kapsamı net çizilmiş, yazılı teslim edilen işler.',
		'hizmet.ustBaslik': 'HİZMETLER',
		'hizmet.baslik': 'Ne tür işler alıyorum',
		'hizmet.giris':
			'Web uygulaması kuruyorum: arayüzden veritabanına, dağıtımdan otomasyona kadar işin her ucuna dokunuyorum.',
		'hizmet.metin':
			'Kapsamı net çizilmiş işleri tercih ediyorum. Aşağıdaki dört başlık, bu sitede de kullandığım araçlarla yaptığım işler — birinde durup diğerini başkasına bırakmak gerekmiyor.',

		'hizmet.kalemUstBaslik': 'KALEMLER',
		'hizmet.kalemBaslik': 'Dört başlık',
		'hizmet.kapsam': 'KAPSAM',

		'hizmet.kalem1Ad': 'Web uygulaması geliştirme',
		'hizmet.kalem1Metin':
			'Fikirden çalışan uygulamaya: veri modeli, sunucu tarafı ve arayüz birlikte kuruluyor. Parçaları tek kişi yazdığı için aralarındaki ek yerleri sonradan yamanmıyor.',
		'hizmet.kalem2Ad': 'Arayüz ve tasarım uygulaması',
		'hizmet.kalem2Metin':
			'Hazır bir tasarımı ya da kaba taslağı çalışan arayüze çeviriyorum. Klavye gezinmesi, kontrast ve hareket tercihleri işin başında hesaba katılıyor, sonradan eklenen bir katman değil.',
		'hizmet.kalem3Ad': 'Altyapı ve dağıtım',
		'hizmet.kalem3Metin':
			'Uygulamayı sunucuya taşıyıp çalışır hâlde tutuyorum: kapsayıcıya alma, web sunucusu ayarı, yayın yolu ve sertifika. Adımlar yazıya dökülüyor, bir dahakine aynı şekilde tekrarlanabiliyor.',
		'hizmet.kalem4Ad': 'Otomasyon ve araç yazımı',
		'hizmet.kalem4Metin':
			'Elle tekrarlanan işleri betiğe çeviriyorum: veri dönüştürme, dosya işleme, düzenli çalışan görevler. Bu sitenin yazı tipi alt kümeleme aracı da tam olarak böyle bir iş.',

		'hizmet.surecUstBaslik': 'NASIL İLERLİYORUZ',
		'hizmet.surecBaslik': 'Konuşmadan teslime dört adım',
		'hizmet.surecMetin':
			'Her işte aynı sıra. Süre ve bütçe işin kapsamı belli olduktan sonra konuşuluyor; baştan bir sayı söylemiyorum.',
		'hizmet.adim1Ad': 'Konuşma',
		'hizmet.adim1Metin':
			'Ne yapmak istediğini dinliyorum: çözülecek sorun, kısıtlar ve elinde hâlihazırda ne olduğu.',
		'hizmet.adim2Ad': 'Kapsam',
		'hizmet.adim2Metin':
			'Ne yapılacağını ve neyin kapsam dışı olduğunu yazıya döküyoruz. İkimiz de aynı şeyi anlamadan kod yazılmıyor.',
		'hizmet.adim3Ad': 'Yapım',
		'hizmet.adim3Metin':
			'İş parça parça ilerliyor; her parça bittiğinde açıp deneyebiliyorsun. Yön değiştirmek en ucuz burada.',
		'hizmet.adim4Ad': 'Teslim',
		'hizmet.adim4Metin':
			'Çalışan hâli yayına alınıyor; kurulum ve bakım adımları yazılı olarak devrediliyor. Kod senin.',

		'hizmet.kapanisUstBaslik': 'BAŞLANGIÇ',
		'hizmet.kapanisBaslik': 'Aklındaki işi anlat',
		'hizmet.kapanisMetin':
			'Birkaç cümle yeter. Bakar, yapabileceğim bir iş mi açıkça söylerim — değilse de söylerim.',
		'hizmet.kapanisEposta': 'E-posta gönder',
		'hizmet.kapanisWhatsapp': 'WhatsApp’tan yaz',

		/*
		  Kullandıklarım sayfası.

		  Yalnızca sayfa kabuğu ve bölüm başlıkları burada. Kalemlerin kendisi
		  (ad + gerekçe) `KullandiklarimIcerik.astro` içinde duruyor — Seçilmiş
		  çalışmalar ve Yetkinlikler bölümlerindeki kalıbın aynısı: içerik
		  düzenlenecek tek bir yerde toplu dursun diye.
		*/
		'kullandiklarim.sayfaBasligi': 'Kullandıklarım: donanım, program ve araçlar — Mustafa Eybek',
		'kullandiklarim.aciklama':
			'Günlük işimde kullandığım donanım, program ve araçlar; editörden dillere, bu sitenin yığınından sunucuya, her biri için kısa bir gerekçeyle.',
		'kullandiklarim.ustBaslik': 'KULLANDIKLARIM',
		'kullandiklarim.baslik': 'Kullandıklarım',
		'kullandiklarim.giris':
			'Çalışırken elimin altında duran şeyler. Salt liste değil: her kalemin yanında neden onu seçtiğim yazıyor — asıl bilgi orada.',
		'kullandiklarim.not':
			'“Yer tutucu” işaretli satırlar henüz doldurulmadı. Uydurma bir liste yazmaktansa boş bırakıldı.',
		'kullandiklarim.yerTutucu': 'yer tutucu',

		'kullandiklarim.donanimBaslik': 'Donanım',
		'kullandiklarim.donanimMetin':
			'Masanın üstündekiler. Bu bölümün tamamı henüz yer tutucu: donanımı sen dolduracaksın.',
		'kullandiklarim.gelistirmeBaslik': 'Geliştirme',
		'kullandiklarim.gelistirmeMetin':
			'Kod yazarken açık duran programlar ve en çok dokunduğum diller.',
		'kullandiklarim.siteBaslik': 'Bu site',
		'kullandiklarim.siteMetin':
			'Şu an okuduğun sayfanın yığını. Sürümler depodaki kurulu paketlerden alındı.',
		'kullandiklarim.sunucuBaslik': 'Sunucu',
		'kullandiklarim.sunucuMetin': 'Yayına çıkan tarafta çalışanlar.',

		/*
		  Gizlilik ve Çerez Politikası.

		  Buradaki her cümle sitenin ÖLÇÜLMÜŞ durumunu anlatıyor: çerez yok,
		  izleme betiği yok, localStorage'da iki tercih var, nginx erişim
		  kayıtları 14 gün duruyor. Hiçbiri temenni değil — biri değişirse
		  (ör. bir analitik eklenirse) bu metnin de değişmesi gerekir, yoksa
		  sayfa yanlış beyan hâline gelir.

		  Hukukçu ağzı bilinçli olarak yok: kişisel bir sitede "işbu politika"
		  diye başlayan bir metin kimseyi bilgilendirmiyor, yalnızca korkutuyor.
		*/
		'gizlilik.sayfaBasligi': 'Gizlilik ve Çerez Politikası — Mustafa Eybek',
		'gizlilik.aciklama':
			'Bu site çerez kullanmıyor, izleme betiği çalıştırmıyor. Hangi veri neden işleniyor, ne kadar saklanıyor ve KVKK kapsamındaki haklarını nasıl kullanırsın — sade bir dille.',
		'gizlilik.ustBaslik': 'GİZLİLİK',
		'gizlilik.baslik': 'Gizlilik ve Çerez Politikası',
		'gizlilik.giris':
			'Bu sayfa, siteyi açtığında hangi verinin nereye gittiğini anlatıyor. Kısa, çünkü anlatılacak çok şey yok.',
		'gizlilik.metin':
			'Site tamamen hazır sayfalardan oluşuyor: form yok, üyelik yok, reklam yok. Yine de her web sunucusu gibi bu sunucu da birkaç satır kayıt tutuyor. Aşağıda hepsi tek tek yazılı.',

		'gizlilik.kunyeSorumlu': 'Veri sorumlusu',
		'gizlilik.kunyeSite': 'Site',
		'gizlilik.kunyeGuncelleme': 'Son güncelleme',
		'gizlilik.tarih': '15 Eylül 2026',

		'gizlilik.ozetBaslik': 'KISACA',
		'gizlilik.ozet1': 'Çerez yok, izleme betiği yok, reklam ağı yok. Onay kutusu da bu yüzden yok.',
		'gizlilik.ozet2':
			'Tarayıcında yalnızca iki tercih saklanıyor: tema ve dil. İkisi de cihazından çıkmıyor.',
		'gizlilik.ozet3':
			'Sunucu erişim kayıtları 14 gün duruyor, sonra siliniyor. Kimseyle paylaşılmıyor.',

		'gizlilik.cerezUstBaslik': 'ÇEREZLER',
		'gizlilik.cerezBaslik': 'Bu site çerez kullanmıyor',
		'gizlilik.cerezMetin':
			'Hiçbir çerez yazılmıyor — ne bu sitenin kendi çerezi ne de bir başkasınınki. Sayfalarda Google Analytics, reklam ağı ya da üçüncü taraf izleme betiği yok; sayfayı açtığında tarayıcına inen JavaScript de yok.',
		'gizlilik.cerezMetin2':
			'Karşına “çerezleri kabul et” kutusu çıkmamasının sebebi bu. Kutunun olmaması bir eksiklik değil: onaylanacak bir çerez yok.',

		'gizlilik.yerelUstBaslik': 'TARAYICIDA SAKLANANLAR',
		'gizlilik.yerelBaslik': 'İki tercih, senin cihazında',
		'gizlilik.yerelMetin':
			'Site, tarayıcının localStorage alanına iki değer yazıyor. İkisi de senin yaptığın seçimin kaydı: sunucuya gönderilmiyor, cihazından hiç çıkmıyor, benim erişimim yok.',
		'gizlilik.yerelTemaMetin':
			'Koyu mu açık mı görünüm istediğin. Sayfa boyanmadan önce okunuyor: hem tema düğmesine her seferinde basmak zorunda kalmıyorsun hem de koyu temada bir anlık beyaz parlama olmuyor.',
		'gizlilik.yerelDilMetin':
			'Dili kendin seçtin mi. Yalnızca ana sayfada bir kez çalışan otomatik dil yönlendirmesinin senin seçiminin üstüne yazmasını engelliyor.',
		'gizlilik.yerelDayanak':
			'İkisi de ziyaretçinin kendi tercihini hatırlayan işlevsel kayıt. KVKK ve GDPR bu tür zorunlu/işlevsel saklama için ayrıca onay aramıyor — onay gereken şey, senin tercihin dışında seni takip eden kayıtlar.',
		'gizlilik.yerelSilBaslik': 'Nasıl silinir',
		'gizlilik.yerelSilMetin':
			'Tarayıcının ayarlarından bu site için site verilerini temizlemen yeter; iki kayıt da gider. Gizli sekmede zaten hiç kalıcı olmuyor. Sildiğinde site varsayılan temaya ve tarayıcı diline döner; başka hiçbir şey kaybolmaz.',

		'gizlilik.kayitUstBaslik': 'SUNUCU KAYITLARI',
		'gizlilik.kayitBaslik': 'Erişim kayıtları 14 gün duruyor',
		'gizlilik.kayitMetin':
			'Siteyi yayınlayan web sunucusu (nginx) her istek için bir satır yazıyor. Bu kayıtlar sunucuyu ayakta tutmak, hataları görmek ve kötüye kullanımı engellemek için gerekli; meşru menfaat kapsamında tutuluyor. Bir satırda şunlar bulunuyor:',
		'gizlilik.kayitAlan1': 'IP adresi',
		'gizlilik.kayitAlan2': 'Tarih ve saat',
		'gizlilik.kayitAlan3': 'İstenen sayfanın adresi',
		'gizlilik.kayitAlan4': 'HTTP durum kodu',
		'gizlilik.kayitAlan5': 'Gönderilen veri miktarı',
		'gizlilik.kayitAlan6': 'Yönlendiren adres (referer)',
		'gizlilik.kayitAlan7': 'Tarayıcı bilgisi (user-agent)',
		'gizlilik.kayitSure':
			'14 gün sonra bu kayıtlar otomatik olarak siliniyor. Ayrıca bir arşiv tutulmuyor, yedeği alınmıyor.',
		'gizlilik.kayitIstatistikBaslik': 'Ziyaretçi sayısı',
		'gizlilik.kayitIstatistikMetin':
			'Aynı kayıtlardan hangi sayfanın ne kadar açıldığına dair basit bir sayım üretiliyor. Sayım üretilirken IP adresi ham hâlde saklanmıyor, karması (hash) alınıyor. Yani elde kalan şey “kaç kişi geldi” bilgisi; “kim geldi” değil.',

		'gizlilik.iletisimUstBaslik': 'BANA YAZDIĞINDA',
		'gizlilik.iletisimBaslik': 'Sitede form yok, doğrudan yazıyorsun',
		'gizlilik.iletisimMetin':
			'Sitede iletişim formu yok; e-posta ya da WhatsApp bağlantısı seni kendi uygulamana götürüyor. Bana yazdığında doğal olarak yazdığın içerik ve ulaştığın adres elimde olur. Bunları yalnızca sana cevap vermek için kullanıyorum: bir listeye eklemiyorum, kimseye aktarmıyorum. Yazışmayı silmemi istersen söyle, silerim.',

		'gizlilik.ucuncuUstBaslik': 'ÜÇÜNCÜ TARAFLAR',
		'gizlilik.ucuncuBaslik': 'Verini kimseye satmıyorum, aktarmıyorum',
		'gizlilik.ucuncuMetin':
			'Yukarıda sayılan hiçbir veri üçüncü kişilere satılmıyor, pazarlama amacıyla paylaşılmıyor. Tek teknik istisna altyapı: site Cloudflare üzerinden yayınlanıyor. Cloudflare sayfaları hızlandırmak ve saldırıları süzmek için trafiği kendi ağından geçiriyor ve bu sırada kendi güvenlik ile önbellek kayıtlarını tutuyor. O kayıtlar Cloudflare’in kendi gizlilik politikasına tabi; benim elimde değiller.',

		'gizlilik.haklarUstBaslik': 'HAKLARIN',
		'gizlilik.haklarBaslik': 'KVKK 11. madde kapsamında',
		'gizlilik.haklarMetin':
			'6698 sayılı Kişisel Verilerin Korunması Kanunu’nun 11. maddesi sana şu hakları veriyor:',
		'gizlilik.hak1': 'Kişisel verinin işlenip işlenmediğini öğrenme.',
		'gizlilik.hak2': 'İşlenmişse buna ilişkin bilgi isteme.',
		'gizlilik.hak3':
			'İşlenme amacını ve verinin amacına uygun kullanılıp kullanılmadığını öğrenme.',
		'gizlilik.hak4': 'Yurt içinde veya yurt dışında verinin aktarıldığı üçüncü kişileri bilme.',
		'gizlilik.hak5': 'Eksik ya da yanlış işlenmişse düzeltilmesini isteme.',
		'gizlilik.hak6': 'Silinmesini veya yok edilmesini isteme.',
		'gizlilik.hak7':
			'Düzeltme ve silme işlemlerinin, verinin aktarıldığı üçüncü kişilere bildirilmesini isteme.',
		'gizlilik.hak8':
			'Yalnızca otomatik sistemlerle yapılan analiz sonucu aleyhine bir sonuç çıkmasına itiraz etme.',
		'gizlilik.hak9':
			'Kanuna aykırı işleme yüzünden zarara uğrarsan zararın giderilmesini talep etme.',
		'gizlilik.haklarNasilBaslik': 'Nasıl kullanılır',
		'gizlilik.haklarNasilMetin':
			'Aşağıdaki adrese yaz; ne istediğini bir iki cümleyle söylemen yeterli. En geç otuz gün içinde dönüyorum, pratikte çok daha erken. Elimde yalnızca yukarıda sayılan veriler olduğu için çoğu talebin cevabı kısa oluyor.',

		'gizlilik.kapanisUstBaslik': 'SORULAR',
		'gizlilik.kapanisBaslik': 'Bir şey sormak istersen',
		'gizlilik.kapanisMetin':
			'Bu sayfada yazan bir şey sana eksik ya da yanlış geldiyse yaz, düzeltirim. Sitede veri açısından bir şey değişirse bu sayfa ve üstteki tarih de değişir.',
		'gizlilik.kapanisEposta': 'E-posta gönder',

		// 404 sayfası
		'404.sayfaBasligi': 'Sayfa bulunamadı — Mustafa Eybek',
		'404.baslik': 'Hop! Sayfa kayıp.',
		'404.metin': 'Aradığın sayfa buralarda değil — galiba hayalet olmuş.',
		'404.dugme': 'Ana sayfaya dön',
		'404.ikincilBag': 'Yazılara göz at',
		'404.hayaletAlt': 'Şaşkın bir hayalet çizimi',
	},
	en: {
		'site.baslik': 'Mustafa Eybek — Software Developer, Kayseri',
		'site.aciklama':
			'Software developer based in Kayseri, Türkiye. Web applications, infrastructure and automation — plus notes on what I learn along the way.',

		'nav.anasayfa': 'Home',
		'nav.blog': 'Blog',
		'nav.hakkimda': 'About',
		'nav.hizmetler': 'Services',
		'nav.kullandiklarim': 'Uses',
		'nav.gizlilik': 'Privacy',
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
		'blog.sayfaBasligi': 'Blog: notes on software and infrastructure — Mustafa Eybek',
		'blog.aciklama':
			'A record of problems I ran into and how I solved them: short, measured notes on web development, CSS, infrastructure and automation.',

		'hakkimda.baslik': 'About',
		'hakkimda.sayfaBasligi': 'About — Mustafa Eybek',
		'hakkimda.aciklama':
			'Who Mustafa Eybek is and what he does: how he works, the tools he uses and how to reach him. Software developer based in Kayseri.',
		'hakkimda.ustBaslik': 'ABOUT',
		'hakkimda.giris':
			'Write one strong opening sentence here: what you do and what you are good at. It is the first line anyone reads on this page.',
		'hakkimda.metin':
			'Write your introduction here: what you do, which topics you care about, where you work.',
		'hakkimda.metin2':
			'Use the second paragraph for the path: where you started, what you are working on now, what comes next.',

		'hakkimda.portreAlt': 'Portrait photo of Mustafa Eybek',
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

		// Services
		'hizmet.sayfaBasligi': 'Services: web development and infrastructure — Mustafa Eybek',
		'hizmet.aciklama':
			'The work I take on: web application development, interface implementation, infrastructure and deployment, automation — clearly scoped work.',
		'hizmet.ustBaslik': 'SERVICES',
		'hizmet.baslik': 'The kind of work I take on',
		'hizmet.giris':
			'I build web applications, touching every end of the work — from the interface to the database, from deployment to automation.',
		'hizmet.metin':
			'I prefer work with a clearly drawn scope. The four headings below are things I build with the same tools this site runs on — there is no point where one piece has to be handed to someone else.',

		'hizmet.kalemUstBaslik': 'WHAT I OFFER',
		'hizmet.kalemBaslik': 'Four headings',
		'hizmet.kapsam': 'SCOPE',

		'hizmet.kalem1Ad': 'Web application development',
		'hizmet.kalem1Metin':
			'From an idea to a running application: data model, server side and interface built together. One person writes the pieces, so the seams between them are not patched in afterwards.',
		'hizmet.kalem2Ad': 'Interface and design implementation',
		'hizmet.kalem2Metin':
			'I turn a finished design or a rough sketch into a working interface. Keyboard navigation, contrast and motion preferences are accounted for from the start, not bolted on later.',
		'hizmet.kalem3Ad': 'Infrastructure and deployment',
		'hizmet.kalem3Metin':
			'I move the application onto a server and keep it running: containerisation, web server configuration, publishing path and certificates. The steps are written down so the next run is identical.',
		'hizmet.kalem4Ad': 'Automation and tooling',
		'hizmet.kalem4Metin':
			'I turn repeated manual work into scripts: data transforms, file processing, scheduled jobs. This site’s own font-subsetting tool is exactly that kind of job.',

		'hizmet.surecUstBaslik': 'HOW WE PROCEED',
		'hizmet.surecBaslik': 'Four steps from conversation to handover',
		'hizmet.surecMetin':
			'The same order every time. Timing and budget are discussed once the scope is clear; I do not quote a number up front.',
		'hizmet.adim1Ad': 'Conversation',
		'hizmet.adim1Metin':
			'I listen to what you want to build: the problem to solve, the constraints, and what you already have in hand.',
		'hizmet.adim2Ad': 'Scope',
		'hizmet.adim2Metin':
			'We write down what will be built and what is out of scope. No code gets written until we both understand the same thing.',
		'hizmet.adim3Ad': 'Build',
		'hizmet.adim3Metin':
			'The work moves piece by piece; you can open and try each piece as it lands. Changing direction is cheapest here.',
		'hizmet.adim4Ad': 'Handover',
		'hizmet.adim4Metin':
			'The working version goes live, and the setup and maintenance steps are handed over in writing. The code is yours.',

		'hizmet.kapanisUstBaslik': 'GETTING STARTED',
		'hizmet.kapanisBaslik': 'Tell me what you have in mind',
		'hizmet.kapanisMetin':
			'A few sentences are enough. I will look and tell you plainly whether it is work I can do — and say so if it is not.',
		'hizmet.kapanisEposta': 'Send an email',
		'hizmet.kapanisWhatsapp': 'Message on WhatsApp',

		// Uses
		'kullandiklarim.sayfaBasligi': 'Uses: hardware, software and tools — Mustafa Eybek',
		'kullandiklarim.aciklama':
			'The hardware, software and tools I use day to day — editor, languages, this site’s own stack and the server side — each with a short reason.',
		'kullandiklarim.ustBaslik': 'USES',
		'kullandiklarim.baslik': 'What I use',
		'kullandiklarim.giris':
			'The things within arm’s reach while I work. Not just a list: each item says why I picked it — that is where the useful part is.',
		'kullandiklarim.not':
			'Rows marked “placeholder” have not been filled in yet. Left empty rather than made up.',
		'kullandiklarim.yerTutucu': 'placeholder',

		'kullandiklarim.donanimBaslik': 'Hardware',
		'kullandiklarim.donanimMetin':
			'What sits on the desk. This whole section is still a placeholder — the hardware is yours to fill in.',
		'kullandiklarim.gelistirmeBaslik': 'Development',
		'kullandiklarim.gelistirmeMetin':
			'The programs open while I write code, and the languages I touch most.',
		'kullandiklarim.siteBaslik': 'This site',
		'kullandiklarim.siteMetin':
			'The stack behind the page you are reading. Versions are taken from the packages installed in the repository.',
		'kullandiklarim.sunucuBaslik': 'Server',
		'kullandiklarim.sunucuMetin': 'What runs on the published side.',

		// Privacy and cookies
		'gizlilik.sayfaBasligi': 'Privacy and Cookie Policy — Mustafa Eybek',
		'gizlilik.aciklama':
			'This site sets no cookies and runs no tracking scripts. What data is processed and why, how long it is kept, and how to exercise your rights — in plain language.',
		'gizlilik.ustBaslik': 'PRIVACY',
		'gizlilik.baslik': 'Privacy and Cookie Policy',
		'gizlilik.giris':
			'This page explains where your data goes when you open the site. It is short because there is not much to tell.',
		'gizlilik.metin':
			'The site is made of pre-built pages: no forms, no accounts, no ads. Even so, like every web server, this one writes a few lines of log. All of them are listed below.',

		'gizlilik.kunyeSorumlu': 'Data controller',
		'gizlilik.kunyeSite': 'Site',
		'gizlilik.kunyeGuncelleme': 'Last updated',
		'gizlilik.tarih': '15 September 2026',

		'gizlilik.ozetBaslik': 'THE SHORT VERSION',
		'gizlilik.ozet1':
			'No cookies, no tracking scripts, no ad networks. That is why there is no consent banner.',
		'gizlilik.ozet2':
			'Two preferences are stored in your browser: theme and language. Neither ever leaves your device.',
		'gizlilik.ozet3':
			'Server access logs are kept for 14 days, then deleted. They are shared with no one.',

		'gizlilik.cerezUstBaslik': 'COOKIES',
		'gizlilik.cerezBaslik': 'This site sets no cookies',
		'gizlilik.cerezMetin':
			'Not one cookie is written — neither this site’s own nor anyone else’s. There is no Google Analytics, no ad network and no third-party tracking script on these pages; no JavaScript is shipped to your browser when you open them.',
		'gizlilik.cerezMetin2':
			'That is why you never saw an “accept cookies” banner. Its absence is not an oversight: there is no cookie to consent to.',

		'gizlilik.yerelUstBaslik': 'STORED IN YOUR BROWSER',
		'gizlilik.yerelBaslik': 'Two preferences, on your device',
		'gizlilik.yerelMetin':
			'The site writes two values into your browser’s localStorage. Both are simply a record of a choice you made: they are never sent to the server, never leave your device, and I cannot read them.',
		'gizlilik.yerelTemaMetin':
			'Whether you want the dark or the light appearance. It is read before the page paints, so you do not have to press the theme button on every visit and the dark theme never flashes white.',
		'gizlilik.yerelDilMetin':
			'Whether you picked the language yourself. It stops the one-time automatic language redirect — which only runs on the home page — from overriding your choice.',
		'gizlilik.yerelDayanak':
			'Both are functional entries that remember your own preference. Under GDPR and Turkey’s KVKK, storage of this kind is strictly necessary and needs no separate consent — consent is for records that follow you around, not for the switch you flipped yourself.',
		'gizlilik.yerelSilBaslik': 'How to delete them',
		'gizlilik.yerelSilMetin':
			'Clear site data for this site in your browser settings and both entries are gone. In a private window nothing persists in the first place. Afterwards the site falls back to the default theme and your browser language; nothing else is lost.',

		'gizlilik.kayitUstBaslik': 'SERVER LOGS',
		'gizlilik.kayitBaslik': 'Access logs are kept for 14 days',
		'gizlilik.kayitMetin':
			'The web server that publishes the site (nginx) writes one line per request. These logs are what keep the server running, make errors visible and hold abuse off; they rest on legitimate interest. One line holds:',
		'gizlilik.kayitAlan1': 'IP address',
		'gizlilik.kayitAlan2': 'Date and time',
		'gizlilik.kayitAlan3': 'The page requested',
		'gizlilik.kayitAlan4': 'HTTP status code',
		'gizlilik.kayitAlan5': 'Bytes sent',
		'gizlilik.kayitAlan6': 'Referring address (referer)',
		'gizlilik.kayitAlan7': 'Browser details (user-agent)',
		'gizlilik.kayitSure':
			'After 14 days these logs are deleted automatically. No separate archive is kept and no backup is taken.',
		'gizlilik.kayitIstatistikBaslik': 'Visitor counts',
		'gizlilik.kayitIstatistikMetin':
			'The same logs feed a simple count of how often each page was opened. While that count is produced, the IP address is not stored in raw form — it is hashed. What remains is “how many people came”, not “who came”.',

		'gizlilik.iletisimUstBaslik': 'WHEN YOU WRITE TO ME',
		'gizlilik.iletisimBaslik': 'No form here — you write to me directly',
		'gizlilik.iletisimMetin':
			'There is no contact form on the site; the email and WhatsApp links simply hand you over to your own app. When you write, I naturally end up holding what you wrote and the address you wrote from. I use it only to reply to you: it goes on no mailing list and to no one else. Ask me to delete the conversation and I will.',

		'gizlilik.ucuncuUstBaslik': 'THIRD PARTIES',
		'gizlilik.ucuncuBaslik': 'Nothing is sold, nothing is handed on',
		'gizlilik.ucuncuMetin':
			'None of the data above is sold to third parties or shared for marketing. The one technical exception is infrastructure: the site is served through Cloudflare, which routes traffic over its own network to speed pages up and filter attacks, and keeps its own security and cache logs while doing so. Those logs fall under Cloudflare’s own privacy policy and are not in my hands.',

		'gizlilik.haklarUstBaslik': 'YOUR RIGHTS',
		'gizlilik.haklarBaslik': 'Under article 11 of the KVKK',
		'gizlilik.haklarMetin':
			'Turkey’s Personal Data Protection Law no. 6698 gives you these rights in its article 11:',
		'gizlilik.hak1': 'To learn whether your personal data is being processed.',
		'gizlilik.hak2': 'To request information about it if it has been processed.',
		'gizlilik.hak3':
			'To learn the purpose of processing and whether the data is used in line with that purpose.',
		'gizlilik.hak4':
			'To know the third parties the data is transferred to, at home or abroad.',
		'gizlilik.hak5': 'To have it corrected if it is incomplete or wrong.',
		'gizlilik.hak6': 'To ask for it to be erased or destroyed.',
		'gizlilik.hak7':
			'To ask that corrections and erasures be reported to any third parties the data went to.',
		'gizlilik.hak8':
			'To object to an adverse outcome reached purely by automated analysis.',
		'gizlilik.hak9':
			'To claim compensation if unlawful processing has caused you harm.',
		'gizlilik.haklarNasilBaslik': 'How to use them',
		'gizlilik.haklarNasilMetin':
			'Write to the address below; a sentence or two saying what you want is enough. I answer within thirty days at the latest, and in practice much sooner. Since all I hold is what is listed above, most answers turn out short.',

		'gizlilik.kapanisUstBaslik': 'QUESTIONS',
		'gizlilik.kapanisBaslik': 'If you want to ask something',
		'gizlilik.kapanisMetin':
			'If anything on this page reads as incomplete or wrong to you, write and I will fix it. If anything changes on the data side of the site, this page and the date above change with it.',
		'gizlilik.kapanisEposta': 'Send an email',

		// 404 page
		'404.sayfaBasligi': 'Page not found — Mustafa Eybek',
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
	/*
	  Yol adları dile göre değişiyor: hakkımda <-> about.

	  Adı çevrilen HER yeni sayfa buraya iki satır olarak eklenmeli (hem Türkçe
	  hem İngilizce ad, çünkü arama iki yönde de yapılıyor). Eklenmezse dil
	  değiştirici o sayfadayken adı olduğu gibi bırakıyor ve ziyaretçi
	  /en/gizlilik gibi var olmayan bir adrese, yani 404'e düşüyor.
	*/
	const esleme: Record<string, Record<Dil, string>> = {
		hakkimda: { tr: 'hakkimda', en: 'about' },
		about: { tr: 'hakkimda', en: 'about' },
		hizmetler: { tr: 'hizmetler', en: 'services' },
		services: { tr: 'hizmetler', en: 'services' },
		kullandiklarim: { tr: 'kullandiklarim', en: 'uses' },
		uses: { tr: 'kullandiklarim', en: 'uses' },
		gizlilik: { tr: 'gizlilik', en: 'privacy' },
		privacy: { tr: 'gizlilik', en: 'privacy' },
	};
	if (parcalar[0] && esleme[parcalar[0]]) parcalar[0] = esleme[parcalar[0]][hedef];
	return yol(hedef, parcalar.join('/'));
}

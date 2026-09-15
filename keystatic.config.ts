import { config, collection, fields, singleton } from '@keystatic/core';
import trMetinler from './src/icerik/metinler-tr.json';

/**
 * Yazı ve site metni yönetim paneli.
 *
 * YEREL KİP: panel yalnızca geliştirme sunucusunda açılıyor ve doğrudan
 * `src/content/blog/` ile `src/icerik/` altındaki dosyaları yazıyor. Sunucuya
 * hiçbir şey eklenmiyor, kimlik doğrulama gerekmiyor, yayınlanan site hiç
 * etkilenmiyor — içerik git'te durmaya devam ediyor.
 *
 * Panelin kendisi React ile çalışıyor. Bu, sitenin "tarayıcıya sıfır
 * JavaScript" kuralını BOZMUYOR: `astro.config.mjs` eklentiyi hiç tanımıyor,
 * Keystatic yalnızca `astro.config.cms.mjs` üzerinden (`npm run yazi`)
 * devreye giriyor. `astro build` o dosyayı okumadığı için yayın çıktısında
 * `/keystatic` rotası hiç üretilmiyor.
 *
 * Yazı alanları `src/content.config.ts` içindeki şemayla BİREBİR aynı olmak
 * zorunda. Buraya bir alan ekleyip oraya eklemezsen panel dosyayı yazar,
 * derleme tip hatası verir.
 */

/* ------------------------------------------------------------------ *
 * Site metinleri
 * ------------------------------------------------------------------ */

/*
  Alan listesi ELLE YAZILMIYOR, `metinler-tr.json` dosyasının kendi
  yapısından üretiliyor.

  Sebebi tek kaynak kuralı: 209 alanı iki kez (veri dosyasında ve burada)
  yazmak, birine eklenip diğerine eklenmeyen alan demekti — panel o metni
  hiç göstermezdi ve kimse fark etmezdi. Burada eklenen alan aynı anda
  panelde de beliriyor.

  Türkçe dosya ikisi için de kalıp: İngilizce şema da ondan üretiliyor, yani
  bir dile eklenen alan öbür dilde boş ama GÖRÜNÜR oluyor. Eksik çeviri
  panelde göze çarpıyor, sessizce kaybolmuyor.
*/

// Anahtar adlarındaki sözcüklerin Türkçe karşılığı. Anahtarlar ASCII
// (`aciklama`), panel etiketi tam imlalı olmak zorunda; ikisini tek tek
// eşlemek yerine sözcük sözcük çevriliyor, böylece yeni anahtar da
// kendiliğinden doğru etiketi alıyor.
const sozcukler: Record<string, string> = {
	ac: 'aç',
	acik: 'açık',
	aciklama: 'açıklama',
	ad: 'ad',
	adim: 'adım',
	alan: 'alan',
	anasayfa: 'ana sayfa',
	bag: 'bağlantı',
	baglanti: 'bağlantı',
	basligi: 'başlığı',
	baslik: 'başlık',
	birincil: 'birincil',
	blog: 'blog',
	bos: 'boş',
	cerez: 'çerez',
	dakika: 'dakika',
	dayanak: 'dayanak',
	degistir: 'değiştir',
	dil: 'dil',
	donanim: 'donanım',
	dugme: 'düğme',
	durum: 'durum',
	eposta: 'e-posta',
	gec: 'geç',
	gelistirme: 'geliştirme',
	gezinme: 'gezinme',
	giris: 'giriş',
	github: 'GitHub',
	gizlilik: 'gizlilik',
	gorsel: 'görsel',
	guncelleme: 'güncelleme',
	guncellendi: 'güncellendi',
	hak: 'hak',
	hakkimda: 'hakkımda',
	haklar: 'haklar',
	hayalet: 'hayalet',
	hizmetler: 'hizmetler',
	icerige: 'içeriğe',
	ikincil: 'ikincil',
	ilerleme: 'ilerleme',
	iletisim: 'iletişim',
	ilke: 'ilke',
	ipucu: 'ipucu',
	istatistik: 'istatistik',
	js: 'JavaScript',
	kalem: 'kalem',
	kanal: 'kanal',
	kapanis: 'kapanış',
	kapat: 'kapat',
	kapsam: 'kapsam',
	kayit: 'kayıt',
	kod: 'kod',
	konum: 'konum',
	kopyala: 'kopyala',
	kopyalandi: 'kopyalandı',
	koyu: 'koyu',
	kullandiklarim: 'kullandıklarım',
	kunye: 'künye',
	lisans: 'lisans',
	menu: 'menü',
	metin: 'metin',
	nasil: 'nasıl',
	not: 'not',
	ozet: 'özet',
	paragraf: 'paragraf',
	portre: 'portre',
	qr: 'kare kod',
	rol: 'rol',
	rss: 'RSS',
	sayfa: 'sayfa',
	serit: 'şerit',
	sifir: 'sıfır',
	sil: 'sil',
	site: 'site',
	son: 'son',
	sonraki: 'sonraki',
	sorumlu: 'sorumlu',
	sunucu: 'sunucu',
	sure: 'süre',
	surec: 'süreç',
	tanim: 'tanım',
	tarih: 'tarih',
	tema: 'tema',
	tum: 'tüm',
	tumune: 'tümüne',
	tutucu: 'tutucu',
	ucuncu: 'üçüncü',
	ust: 'üst',
	whatsapp: 'WhatsApp',
	yaz: 'yaz',
	yazilar: 'yazılar',
	yer: 'yer',
	yerel: 'yerel',
};

/** `ilke1Baslik` → "İlke 1 başlık". */
function alanEtiketi(anahtar: string): string {
	const parcalar = anahtar
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/([a-zA-Z])(\d)/g, '$1 $2')
		.replace(/(\d)([a-zA-Z])/g, '$1 $2')
		.split(' ');

	const sozler = parcalar.map((parca, sira) => {
		if (/^\d+$/.test(parca)) return parca;
		const kucuk = parca.toLowerCase();
		/*
		  "alt" iki ayrı anlama geliyor: `altBaslik` bölümün alt başlığı,
		  `gorselAlt` ise görselin metin karşılığı. Ayırt eden şey konum —
		  sondaysa erişilebilirlik metnidir.
		*/
		if (kucuk === 'alt') return sira === parcalar.length - 1 ? 'metin karşılığı' : 'alt';
		return sozcukler[kucuk] ?? parca;
	});

	const tumu = sozler.join(' ');
	return tumu.charAt(0).toLocaleUpperCase('tr-TR') + tumu.slice(1);
}

/*
  Grup başlıkları ve açıklamaları. Açıklamalar panelde alanların üstünde
  görünüyor; buradaki notlar metinlerin NEDEN böyle yazıldığını anlatıyor,
  çünkü bunlar taşınmadan önce kaynak dosyadaki yorumlardı ve JSON yorum
  tutamıyor.
*/
const grupBilgisi: Record<string, { etiket: string; aciklama?: string }> = {
	'404': {
		etiket: 'Sayfa bulunamadı (404)',
		aciklama: 'Var olmayan bir adrese girildiğinde gösterilen sayfa.',
	},
	site: {
		etiket: 'Site geneli',
		aciklama:
			'Ana sayfanın <title>’ı ve sitenin varsayılan açıklaması. İkisi de arama sonucunda görünüyor: başlık ~60, açıklama ~155 karakteri aşmamalı — ama "Kişisel site" gibi bir satır da neyin ne olduğunu söylemiyor.',
	},
	nav: {
		etiket: 'Gezinme çubuğu',
		aciklama:
			'Menü adları ile düğmelerin erişilebilirlik etiketleri. "Dil değiştir" bilinçli olarak öbür dilde yazılı: düğme neye götürdüğünü kendi dilinde söylüyor.',
	},
	hero: { etiket: 'Açılış bölümü' },
	anasayfa: { etiket: 'Ana sayfa' },
	tanitim: {
		etiket: 'Tanıtım bölümü',
		aciklama: 'Açılıştan sonra gelen bölüm. Metinler yer tutucu; değiştirilecek.',
	},
	sarmasik: {
		etiket: 'Yazı sarmaşığı',
		aciklama: 'Sayfa boyunca inen süs yazısı. Ekran okuyucuya verilmiyor.',
	},
	calisma: {
		etiket: 'Seçilmiş çalışmalar',
		aciklama: 'Proje metinleri yer tutucu.',
	},
	blog: {
		etiket: 'Blog',
		aciklama:
			'Sayfa başlığı iki dilde AYNI OLMAMALI: aynı başlıkla iki sayfa arama motorunda birbiriyle yarışıyor.',
	},
	hakkimda: {
		etiket: 'Hakkımda sayfası',
		aciklama:
			'Giriş ve iki tanıtım paragrafı YER TUTUCU ve bunu okuyana da söylüyorlar — uydurma bir özgeçmiş yazmak yerine ne yazılacağı yazıldı. İlke metinleri yer tutucu değil: üçü de bu deponun kendi çalışma biçimini anlatıyor, doğrulanabilir.',
	},
	yazi: { etiket: 'Yazı ve liste etiketleri' },
	iletisim: { etiket: 'İletişim bölümü' },
	altbilgi: { etiket: 'Altbilgi' },
	yetkinlik: {
		etiket: 'Yetkinlikler',
		aciklama:
			'Yalnızca bölüm kabuğu burada. Kalemlerin kendisi `YetkinlikBolumu.astro` içinde duruyor.',
	},
	hizmet: {
		etiket: 'Hizmetler sayfası',
		aciklama:
			'Metinler yer tutucu DEĞİL: dört kalem de sitenin başka yerlerinde zaten yazılı olan işleri anlatıyor. Bilinçli olarak yok olanlar: fiyat, teslim süresi, müşteri sayısı ve referans — hiçbiri doğrulanabilir değil, hepsi bakım yükü.',
	},
	kullandiklarim: {
		etiket: 'Kullandıklarım sayfası',
		aciklama:
			'Yalnızca sayfa kabuğu ve bölüm başlıkları burada. Kalemlerin kendisi (ad + gerekçe) `KullandiklarimIcerik.astro` içinde duruyor.',
	},
	gizlilik: {
		etiket: 'Gizlilik ve Çerez Politikası',
		aciklama:
			'DİKKAT: buradaki her cümle sitenin ÖLÇÜLMÜŞ durumunu anlatıyor — çerez yok, izleme betiği yok, localStorage’da iki tercih var, sunucu kayıtları 14 gün duruyor. Hiçbiri temenni değil. Sitede bunlardan biri değişirse (ör. bir analitik eklenirse) bu metinler de değişmek zorunda, yoksa sayfa yanlış beyan hâline gelir.',
	},
};

/** Bir dilin bütün metin alanlarını, veri dosyasının yapısına göre üretir. */
function metinAlanlari() {
	const kaynak = trMetinler as Record<string, Record<string, string>>;

	return Object.fromEntries(
		Object.entries(kaynak).map(([grup, kalemler]) => {
			const alanlar = Object.fromEntries(
				Object.entries(kalemler).map(([anahtar, ornek]) => [
					anahtar,
					fields.text({
						label: alanEtiketi(anahtar),
						// Uzun metin tek satırlık kutuya sığmıyor. Eşik Türkçe
						// metnin uzunluğundan alınıyor ki iki dilde aynı yerleşim
						// çıksın; farklı olsaydı çeviriyi yan yana okumak zorlaşırdı.
						multiline: ornek.length > 70,
						// Bu metinlerin hepsi arayüzde görünüyor: boş bırakılan bir
						// alan sayfada boşluk demek, o yüzden hiçbiri isteğe bağlı değil.
						validation: { isRequired: true },
					}),
				]),
			);

			const bilgi = grupBilgisi[grup];
			return [
				grup,
				fields.object(alanlar, {
					label: bilgi?.etiket ?? grup,
					description: bilgi?.aciklama,
				}),
			];
		}),
	);
}

/*
  `path` sonunda eğik çizgi YOK: Keystatic çizgili yolu dizin sayıp
  `.../index.json` yazıyor, çizgisiz olunca dosyanın kendisini —
  `src/icerik/metinler-tr.json` — yazıyor. Site tam da o dosyayı okuyor.
*/
const metinSingletonu = (dil: 'tr' | 'en', etiket: string) =>
	singleton({
		label: etiket,
		path: `src/icerik/metinler-${dil}`,
		format: { data: 'json' },
		schema: metinAlanlari(),
	});

/* ------------------------------------------------------------------ *
 * Yapılandırma
 * ------------------------------------------------------------------ */

export default config({
	storage: { kind: 'local' },

	ui: {
		brand: { name: 'Mustafa Eybek' },
		navigation: {
			İçerik: ['yazilar'],
			'Site metinleri': ['metinlerTr', 'metinlerEn'],
		},
	},

	singletons: {
		metinlerTr: metinSingletonu('tr', 'Türkçe metinler'),
		metinlerEn: metinSingletonu('en', 'İngilizce metinler'),
	},

	collections: {
		yazilar: collection({
			label: 'Yazılar',
			path: 'src/content/blog/*',
			// Dosya adı yazının adresini belirliyor: src/content/blog/ornek.mdx
			// → /blog/ornek/. Bu yüzden slug alanı başlıktan ayrı tutuluyor;
			// başlığı sonradan düzeltmek adresi bozmamalı.
			slugField: 'title',
			format: { contentField: 'content' },
			entryLayout: 'content',
			columns: ['title', 'pubDate'],

			schema: {
				title: fields.slug({
					name: { label: 'Başlık', validation: { isRequired: true } },
					slug: {
						label: 'Adres (dosya adı)',
						description:
							'Yayımlandıktan sonra değiştirme: eski adres 404 verir ve paylaşılmış bağlantılar kırılır.',
					},
				}),

				description: fields.text({
					label: 'Açıklama',
					description:
						'Tek cümle. Kart listelerinde ve arama sonuçlarında başlığın altında görünüyor.',
					multiline: true,
					validation: { isRequired: true },
				}),

				pubDate: fields.date({
					label: 'Yayım tarihi',
					validation: { isRequired: true },
				}),

				updatedDate: fields.date({
					label: 'Güncelleme tarihi',
					description: 'Yazıyı sonradan değiştirdiysen. Boş bırakılabilir.',
				}),

				/*
				  Dil, listelerin süzgeci. Yanlış seçilirse yazı öbür dilin
				  listesinde çıkar; o yüzden varsayılan Türkçe ve alan zorunlu.
				*/
				dil: fields.select({
					label: 'Dil',
					options: [
						{ label: 'Türkçe', value: 'tr' },
						{ label: 'English', value: 'en' },
					],
					defaultValue: 'tr',
				}),

				tags: fields.array(fields.text({ label: 'Etiket' }), {
					label: 'Etiketler',
					itemLabel: (props) => props.value,
				}),

				draft: fields.checkbox({
					label: 'Taslak',
					description: 'İşaretliyken yazı listelerde ve RSS akışında görünmüyor.',
					defaultValue: false,
				}),

				/*
				  Kapak bir DOSYA SEÇİCİ; elle yol yazılmıyor.

				  Yüklenen görsel `public/yazi-gorselleri/<yazı-adresi>/` altına
				  iniyor: yazı başına ayrı klasör, çünkü Keystatic dosyayı alan
				  adıyla ("kapak.jpg") kaydediyor ve tek klasörde ikinci yazının
				  kapağı birincininkini ezerdi.

				  Kapak isteğe bağlı. Verilmezse başlıktan türetilen soyut bir
				  kapak çiziliyor, yani boş bırakmak ızgarada boşluk bırakmıyor.
				*/
				kapak: fields.image({
					label: 'Kapak görseli',
					directory: 'public/yazi-gorselleri',
					publicPath: '/yazi-gorselleri/',
					description: 'Boş bırakılabilir — o zaman başlıktan soyut bir kapak üretilir.',
				}),

				kapakAlt: fields.text({
					label: 'Kapak görseli metin karşılığı',
					description:
						'Kapak seçtiysen ZORUNLU: ne gösterdiğini yaz, ekran okuyucu bunu okuyor. Boş bırakırsan derleme hata verir.',
				}),

				content: fields.mdx({
					label: 'İçerik',
					options: {
						image: {
							directory: 'public/yazi-gorselleri',
							publicPath: '/yazi-gorselleri/',
							schema: {
								/*
								  Metin karşılığı zorunlu: görseli anlatan bir satır
								  olmadan görsel, ekran okuyucu için hiç yok demek.
								  Süs görsel kullanılmıyor, o yüzden istisna da yok.
								*/
								alt: fields.text({
									label: 'Metin karşılığı (alt)',
									description: 'Görselin ne gösterdiğini yaz.',
									validation: { isRequired: true },
								}),
							},
						},
					},
				}),
			},
		}),
	},
});

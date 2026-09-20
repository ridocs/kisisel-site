import { config, collection, fields, singleton } from '@keystatic/core';
import { BOLUMLER } from './src/icerik/metinler/_bolumler';
import { TEKNOLOJI_SECENEKLERI } from './src/lib/teknolojiler';

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
	projeler: {
		etiket: 'Projeler sayfası',
		aciklama:
			'Yalnızca sayfa kabuğu burada. Projelerin kendisi soldaki “Projeler” bölümünde.',
	},
	degisiklik: {
		etiket: 'Sürüm günlüğü',
		aciklama: 'Neler değişti sayfasının başlıkları. Kayıtlar git geçmişinden geliyor.',
	},
	anasayfa: { etiket: 'Son yazılar bloğu' },
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
		etiket: 'Yetkinlikler bölümü',
		aciklama:
			'Yalnızca bölüm başlıkları burada. Teknolojilerin kendisi soldaki “Yetkinlikler” bölümünde.',
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

/*
  KULLANDIKLARIM — donanım, geliştirme, site ve sunucu kalemleri.

  Bölüm başlıkları metinlerde ("Kullandıklarım sayfası"), kalemler burada.
  Her kalemin hangi bölüme gireceği seçiliyor; bölümü olmayan kalem sayfada
  görünmez, bu yüzden alan zorunlu.

  "Yer tutucu" işareti bilinçli: doldurulmamış satırlar sayfada rozetle
  işaretleniyor, böylece uydurma bir liste gibi okunmuyor. Gerçek bilgiyi
  yazınca işareti kaldır.
*/
const kullandiklarimSingletonu = singleton({
	label: 'Kullandıklarım',
	path: 'src/icerik/kullandiklarim',
	format: { data: 'json' },
	schema: {
		kalemler: fields.array(
			fields.object({
				bolum: fields.select({
					label: 'Bölüm',
					options: [
						{ label: 'Donanım', value: 'donanim' },
						{ label: 'Geliştirme ortamı', value: 'gelistirme' },
						{ label: 'Bu sitenin yığını', value: 'site' },
						{ label: 'Sunucu ve yayın', value: 'sunucu' },
					],
					defaultValue: 'donanim',
				}),
				ad: fields.text({ label: 'Ad (Türkçe)' }),
				adEn: fields.text({ label: 'Ad (İngilizce)' }),
				neden: fields.text({
					label: 'Neden (Türkçe)',
					description: 'Salt liste değil: neden onu seçtiğini yaz. Asıl bilgi burada.',
					multiline: true,
				}),
				nedenEn: fields.text({ label: 'Neden (İngilizce)', multiline: true }),
				surum: fields.text({
					label: 'Sürüm',
					description: 'Varsa yazılır, yoksa boş bırak.',
				}),
				yerTutucu: fields.checkbox({
					label: 'Yer tutucu',
					description: 'İşaretliyken sayfada “yer tutucu” rozetiyle görünüyor.',
					defaultValue: true,
				}),
			}),
			{
				label: 'Kalemler',
				itemLabel: (props) => props.fields.ad.value || 'Kalem',
			},
		),
	},
});

/*
  SEÇİLMİŞ ÇALIŞMALAR — ana sayfadaki üç kart.

  "Projeler" koleksiyonundan ayrı bir şey: orası sitenin proje sayfası, burası
  ana sayfada öne çıkarılan birkaç iş. Kartlar kısa; detay sayfası yok.

  Sıra listenin kendi sırası, sürükleyerek değiştiriliyor.
*/
const calismalarSingletonu = singleton({
	label: 'Seçilmiş çalışmalar',
	path: 'src/icerik/calismalar',
	format: { data: 'json' },
	schema: {
		kalemler: fields.array(
			fields.object({
				ad: fields.text({ label: 'Ad (Türkçe)' }),
				adEn: fields.text({ label: 'Ad (İngilizce)' }),
				ozet: fields.text({
					label: 'Özet (Türkçe)',
					description: 'Ne yaptığını ve senin payının ne olduğunu bir iki cümleyle anlat.',
					multiline: true,
				}),
				ozetEn: fields.text({ label: 'Özet (İngilizce)', multiline: true }),
				etiketler: fields.array(fields.text({ label: 'Etiket' }), {
					label: 'Etiketler',
					description: 'Kullanılan teknolojiler. Kartın altında rozet olarak görünüyor.',
					itemLabel: (props) => props.value,
				}),
				yil: fields.text({ label: 'Yıl' }),
				baglanti: fields.url({
					label: 'Bağlantı',
					description: 'Boş bırakılırsa kart tıklanabilir olmuyor.',
				}),
			}),
			{
				label: 'Çalışmalar',
				itemLabel: (props) => props.fields.ad.value || 'Çalışma',
			},
		),
	},
});

/*
  İLETİŞİM BİLGİLERİ — sitenin tek adres kaynağı.

  Aynı bilgi üç yerde birden görünüyor (ana sayfadaki koyu kart, Hakkımda
  sayfasındaki kanal listesi, altbilginin iletişim sütunu) ve arama motorlarına
  verilen yapılandırılmış veriye de giriyor. Hepsi bu tek kayıttan okuyor.

  Sosyal adresleri boş bırakmak serbest — boş olan hiçbir yere basılmıyor.
  YANLIŞ bir adres yazmak boş bırakmaktan kötü: başka birinin profilini
  seninmiş gibi bildirir.
*/
const iletisimSingletonu = singleton({
	label: 'İletişim bilgileri',
	path: 'src/icerik/iletisim-bilgisi',
	format: { data: 'json' },
	schema: {
		eposta: fields.text({ label: 'E-posta', validation: { isRequired: true } }),
		whatsapp: fields.text({
			label: 'WhatsApp numarası',
			description: 'Ülke koduyla yaz. Boşluk ve + serbest — bağlantı kurulurken temizleniyor. Boş bırakılırsa WhatsApp düğmesi hiç basılmıyor.',
		}),
		telefonGorunen: fields.text({
			label: 'Telefon (görünen biçim)',
			description: 'Ekranda böyle yazıyor: +90 533 479 80 49',
		}),
		konum: fields.text({ label: 'Konum (Türkçe)' }),
		konumEn: fields.text({ label: 'Konum (İngilizce)' }),
		github: fields.url({ label: 'GitHub' }),
		linkedin: fields.url({ label: 'LinkedIn' }),
		instagram: fields.url({ label: 'Instagram' }),
		qrIcerik: fields.text({
			label: 'Kare kod içeriği',
			description:
				'İletişim kartındaki QR kodun içine ne yazılacağı. BOŞ BIRAKILIRSA sitenin adresi kodlanır — en sık istenen bu. Adres olmak zorunda değil: tel:+905334798049, mailto:…, düz metin de olur. Kod her yayında yeniden üretilir.',
			multiline: true,
		}),
	},
});

/*
  BİR BÖLÜMÜN DÜZENLEME SAYFASI.

  Panelde her bölüm (açılış, iletişim kartı, gizlilik…) kendi sayfasında
  duruyor ve o sayfada İKİ DİL birlikte görünüyor. Önceden iki dev sayfa
  vardı — "Türkçe metinler" ve "İngilizce metinler" — ve 239 alan tek listede
  akıyordu; aranan metni bulmak da, bir metnin öteki dildeki karşılığını
  görmek de zordu.

  Alan listesi ELLE YAZILMIYOR: bölümün kendi JSON dosyasından türetiliyor.
  Dosyaya bir alan eklendiğinde panelde kendiliğinden beliriyor.
*/
function bolumAlanlari(kalemler: Record<string, string>, dilEtiketi: string) {
	const alanlar = Object.fromEntries(
		Object.entries(kalemler).map(([anahtar, ornek]) => [
			anahtar,
			fields.text({
				label: alanEtiketi(anahtar),
				// Uzun metin tek satırlık kutuya sığmıyor. Eşik Türkçe metnin
				// uzunluğundan alınıyor ki iki dilde aynı yerleşim çıksın;
				// farklı olsaydı çeviriyi yan yana okumak zorlaşırdı.
				multiline: ornek.length > 70,
				// Bu metinlerin hepsi arayüzde görünüyor: boş bırakılan bir alan
				// sayfada boşluk demek, o yüzden hiçbiri isteğe bağlı değil.
				validation: { isRequired: true },
			}),
		]),
	);
	return fields.object(alanlar, { label: dilEtiketi });
}

/*
  `path` sonunda eğik çizgi YOK: Keystatic çizgili yolu dizin sayıp
  `.../index.json` yazıyor, çizgisiz olunca dosyanın kendisini —
  `src/icerik/metinler/<bölüm>.json` — yazıyor. Site tam da o dosyayı okuyor.

  Türkçe alanların uzunluğu iki dilde de ölçü alınıyor (bk. `bolumAlanlari`),
  bu yüzden ikisine de `tr` kalemleri veriliyor.
*/
const bolumSingletonu = (ad: keyof typeof BOLUMLER) => {
	const bilgi = grupBilgisi[ad];
	const kalemler = BOLUMLER[ad].tr as Record<string, string>;
	return singleton({
		label: bilgi?.etiket ?? ad,
		path: `src/icerik/metinler/${ad}`,
		format: { data: 'json' },
		schema: {
			tr: bolumAlanlari(kalemler, 'Türkçe'),
			en: bolumAlanlari(kalemler, 'İngilizce'),
		},
	});
};

/*
  Panelin sol menüsü sitenin kendi yapısını izliyor: önce ana sayfanın
  bölümleri yukarıdan aşağıya sırayla, sonra ayrı sayfalar, sonra her sayfada
  görünen ortak parçalar. Aranan metni bulmak için sitede nerede durduğunu
  hatırlamak yetiyor.
*/
const METIN_AGACI: Record<string, (keyof typeof BOLUMLER)[]> = {
	'Ana sayfa': ['hero', 'tanitim', 'yetkinlik', 'calisma', 'anasayfa', 'iletisim'],
	Sayfalar: ['hakkimda', 'hizmet', 'projeler', 'blog', 'kullandiklarim', 'degisiklik', 'gizlilik'],
	'Site geneli': ['site', 'nav', 'altbilgi', 'yazi', 'sarmasik', '404'],
};

/** Menüdeki her bölüm için bir singleton; anahtar `metinHero` gibi. */
const metinSingletonAdi = (ad: string) => `metin_${ad}`;

const metinSingletonlari = Object.fromEntries(
	(Object.keys(BOLUMLER) as (keyof typeof BOLUMLER)[]).map((ad) => [
		metinSingletonAdi(ad),
		bolumSingletonu(ad),
	]),
);

/* ------------------------------------------------------------------ *
 * Yapılandırma
 * ------------------------------------------------------------------ */

/*
  Projeler koleksiyonu.

  Alanlar `src/content.config.ts` içindeki şemayla BİREBİR aynı olmak zorunda;
  biri değişip öteki değişmezse panel dosyayı yazar, derleme tip hatası verir.
*/
const projelerKoleksiyonu = collection({
	label: 'Projeler',
	path: 'src/content/projeler/*',
	slugField: 'ad',
	format: { contentField: 'icerik' },
	entryLayout: 'content',
	columns: ['ad', 'durum'],
	schema: {
		ad: fields.slug({
			name: { label: 'Proje adı' },
			slug: { label: 'Adres (dosya adı)' },
		}),
		tur: fields.multiselect({
			label: 'Tür',
			description: 'Bir proje hem site hem uygulama olabilir.',
			options: [
				{ label: 'Web sitesi', value: 'website' },
				{ label: 'Mobil uygulama', value: 'mobil' },
			],
			defaultValue: ['website'],
		}),
		ozet: fields.text({
			label: 'Özet (Türkçe)',
			description: 'Bir iki cümle. Kartta bu görünüyor.',
			multiline: true,
		}),
		ozetEn: fields.text({
			label: 'Özet (İngilizce)',
			multiline: true,
		}),
		adres: fields.url({
			label: 'Canlı adres',
			description: 'Boş bırakılırsa kart bağlantı olmuyor.',
		}),
		teknolojiler: fields.array(fields.text({ label: 'Teknoloji' }), {
			label: 'Teknolojiler',
			itemLabel: (props) => props.value,
		}),
		/*
		  Katkı verenler. Boş bırakılırsa detay sayfasında o bölüm hiç
		  basılmıyor — "Katkı verenler: —" yazan boş bir başlık kalmıyor.
		*/
		katkiVerenler: fields.array(
			fields.object({
				ad: fields.text({ label: 'Ad' }),
				rol: fields.text({ label: 'Rol (Türkçe)', description: 'Örn. Arayüz, Tasarım, Veri tarafı.' }),
				rolEn: fields.text({ label: 'Rol (İngilizce)', description: 'Örn. Frontend, Design.' }),
				adres: fields.url({ label: 'Bağlantı', description: 'GitHub, LinkedIn ya da kişisel site. Boşsa ad düz yazı kalır.' }),
			}),
			{
				label: 'Katkı verenler',
				itemLabel: (props) => props.fields.ad.value || 'Katkı veren',
			},
		),
		/*
		  Detayın İNGİLİZCESİ. Türkçesi sayfanın gövdesinde (aşağıdaki zengin
		  metin alanı); gövde tek tane olduğu için ikinci dil buraya düz metin
		  olarak yazılıyor. Paragrafları boş satırla ayır.
		*/
		detayEn: fields.text({
			label: 'Detay (İngilizce)',
			description: 'Projeyi anlatan uzun metin. Boş bırakılırsa İngilizce sayfada özet gösterilir.',
			multiline: true,
		}),
		durum: fields.select({
			label: 'Durum',
			options: [
				{ label: 'Aktif', value: 'aktif' },
				{ label: 'Arşiv', value: 'arsiv' },
			],
			defaultValue: 'aktif',
		}),
		sira: fields.number({
			label: 'Sıra',
			description: 'Küçük sayı önce gelir.',
			defaultValue: 100,
		}),
		taslak: fields.checkbox({
			label: 'Taslak',
			description: 'İşaretliyken sayfaya hiç basılmıyor.',
			defaultValue: false,
		}),
		icerik: fields.mdx({
			label: 'Ayrıntı',
			description: 'İsteğe bağlı. Kartın altında değil, ileride ayrıntı sayfasında kullanılacak.',
		}),
	},
});

/*
  YETKİNLİKLER

  Teknoloji katalogdan SEÇİLİYOR (`src/lib/teknolojiler.ts`): adı, simgesi ve
  "bu teknoloji nedir" tanımı oradan geliyor, panelde yeniden yazılmıyor.
  Burada yalnızca kişisel olan kısım var: ne kadardır kullanıldığı ve nerede
  kullanıldığı.

  Sıra listenin kendi sırası — kalemleri sürükleyerek değiştirebiliyorsun.
  Önceki sürümde bir `oran` alanı vardı ve ekranda görünmeyen bir sayıyla
  sıralama yapılıyordu; sürükleyip bırakmak hem görünür hem anlaşılır.
*/
const yetkinliklerSingletonu = singleton({
	label: 'Yetkinlikler',
	path: 'src/icerik/yetkinlikler',
	format: { data: 'json' },
	schema: {
		kalemler: fields.array(
			fields.object({
				teknoloji: fields.select({
					label: 'Teknoloji',
					description: 'Adı, simgesi ve tanımı hazır geliyor.',
					options: TEKNOLOJI_SECENEKLERI,
					defaultValue: TEKNOLOJI_SECENEKLERI[0].value,
				}),
				sure: fields.text({
					label: 'Ne kadardır (Türkçe)',
					description: 'Kartta görünüyor. Örn. "4 yıl".',
				}),
				sureEn: fields.text({ label: 'Ne kadardır (İngilizce)', description: 'Örn. "4 years".' }),
				kullanim: fields.text({
					label: 'Nerede kullandın? (Türkçe)',
					description: 'Kart seçilince açılan panelde görünüyor. Somut yaz: hangi proje, hangi iş.',
					multiline: true,
				}),
				kullanimEn: fields.text({
					label: 'Nerede kullandın? (İngilizce)',
					multiline: true,
				}),
			}),
			{
				label: 'Yetkinlikler',
				itemLabel: (props) => props.fields.teknoloji.value || 'Yetkinlik',
			},
		),
	},
});

export default config({
	storage: { kind: 'local' },

	ui: {
		brand: { name: 'Mustafa Eybek' },
		navigation: {
			İçerik: [
				'yazilar',
				'projeler',
				'yetkinlikler',
				'calismalar',
				'kullandiklarim',
				'iletisimBilgisi',
			],
			...Object.fromEntries(
				Object.entries(METIN_AGACI).map(([baslik, adlar]) => [
					baslik,
					adlar.map(metinSingletonAdi),
				]),
			),
		},
	},


	singletons: {
		...metinSingletonlari,
		yetkinlikler: yetkinliklerSingletonu,
		calismalar: calismalarSingletonu,
		iletisimBilgisi: iletisimSingletonu,
		kullandiklarim: kullandiklarimSingletonu,
	},

	collections: {
		projeler: projelerKoleksiyonu,
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

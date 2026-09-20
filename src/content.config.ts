import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Blog yazıları src/content/blog/ altındaki .md ve .mdx dosyalarından okunur.
const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: z
		.object({
			title: z.string(),
			/*
			  Arama sonucunda ve tarayıcı sekmesinde görünen başlık.

			  Boş bırakılırsa `title` kullanılıp sonuna site adı ekleniyor
			  ("Dart Programlama Dili — Mustafa Eybek"). Doluysa BİREBİR o
			  yazılıyor: site adı da dahil her şey yazarın elinde kalsın.

			  Ayrı bir alan, çünkü ikisinin işi farklı: `title` sayfanın
			  içindeki H1 ve kart başlığı, bu ise arama sonucundaki satır.
			  60 karakteri aşınca Google kırpıyor.
			*/
			sayfaBasligi: z.string().optional(),
			description: z.string(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			tags: z.array(z.string()).default([]),
			draft: z.boolean().default(false),
			// Yazının dili. Belirtilmezse Türkçe sayılır; listeler buna göre süzülür.
			dil: z.enum(['tr', 'en']).default('tr'),
			/*
			  Bu yazının öteki dildeki karşılığının adresi (dosya adı).

			  Dil bağı (`hreflang`) bundan kuruluyor. Önce adres öteki dile
			  ÇEVRİLEREK tahmin ediliyordu ve çeviri adları farklı olduğu için
			  var olmayan sayfalar gösteriliyordu — arama motoru iki dili
			  birbirinin kopyası sayabiliyor. SEO paneli yedi sayfada bunu ölçtü.

			  Boş bırakılabilir: çevirisi olmayan yazıda dil bağı hiç basılmıyor.
			  Yanlış bir adres göstermektense hiç göstermemek doğru.

			  Bağ İKİ TARAFLI yazılmalı; arama motoru karşılıklı olmayan bağı
			  yok sayıyor.
			*/
			ceviri: z.string().optional(),
			/*
			  Kapak görseli. İsteğe bağlı: verilmezse başlıktan türetilen soyut bir
			  kapak çiziliyor, yani kapaksız yazı da ızgarada boşluk bırakmıyor.

			  Panelden seçilen kapak `public/yazi-gorselleri/<yazı-adresi>/` altına
			  iniyor ve buraya "/yazi-gorselleri/<yazı-adresi>/kapak.jpg" olarak
			  yazılıyor. Alt dizin öneki ("/web-sitem") burada DEĞİL, çizim
			  sırasında ekleniyor — bkz. `YaziKapagi.astro`.
			*/
			kapak: z.string().optional(),
			kapakAlt: z.string().optional(),
		})
		/*
		  Kapak varsa metin karşılığı zorunlu — ama BU KURAL DERLEMEYİ DURDURMUYOR.

		  Önce `.refine` ile hata fırlatılıyordu. Niyet doğruydu (alt metinsiz
		  görsel yayına çıkmasın) ama sonuç kilitti: şema hatası yalnızca yayın
		  derlemesini değil PANELİN KENDİSİNİ de düşürüyordu. Panelden kapak
		  ekleyip alt metni boş bırakan kişi, düzeltmesi gereken ekrana bir daha
		  giremiyordu. 20 Eylül'de tam bu yaşandı.

		  Şimdi kural aynı ama yaptırımı başka: alt metni olmayan kapak
		  BASILMIYOR. Erişilemez bir görsel hiçbir zaman yayına çıkmıyor,
		  derleme de durmuyor. Eksik `kontrol` ekranında bulgu olarak
		  görünüyor — `kapakAltEksik` bayrağı bunun için.
		*/
		.transform((veri) => {
			const kapakAltEksik = Boolean(veri.kapak) && (veri.kapakAlt ?? '').trim() === '';
			return { ...veri, kapak: kapakAltEksik ? undefined : veri.kapak, kapakAltEksik };
		}),
});

/*
  AKTİF PROJELER

  Blogdan ayrı bir koleksiyon: yazı zamana bağlı ve arşive gider, proje ise
  bir durumdur — yaşarken güncellenir, bitince arşive çekilir. İkisini aynı
  koleksiyonda tutmak "tarihe göre sırala" ile "duruma göre süz" arasında
  sürekli çatışma çıkarırdı.

  İki dil AYNI dosyada, blogdaki gibi ayrı dosyalarda değil. Sebep: bir yazının
  çevirisi ayrı bir metindir, ama bir proje TEK bir şeydir — iki dosyaya
  bölmek aynı projenin iki kaydı gibi görünür ve biri güncellenip öteki
  unutulur. Sitede aynı kalıp Kullandıklarım ve Hizmetler'de de var.
*/
const projeler = defineCollection({
	loader: glob({ base: './src/content/projeler', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		ad: z.string(),
		/*
		  Arama sonucunda ve tarayıcı sekmesinde görünen başlık.

		  Boş bırakılırsa PROJE ADININ KENDİSİ kullanılıyor — site adı
		  eklenmiyor. Önce "Ad — Mustafa Eybek" biçimindeydi; proje adı zaten
		  sayfanın konusu ve marka eki 60 karakterlik alandan yiyordu.

		  Yazılardaki `sayfaBasligi` ile aynı iş: `ad` sayfanın H1'i ve kart
		  başlığı, bu ise arama sonucundaki satır.
		*/
		sayfaBasligi: z.string().optional(),
		/*
		  Bir proje hem site hem uygulama olabiliyor (TwinShare öyle), bu yüzden
		  tek seçim değil liste. En az bir tür zorunlu: türü olmayan bir kayıt
		  sayfada hangi başlığın altına gireceğini bilemez.
		*/
		tur: z.array(z.enum(['website', 'mobil'])).min(1),
		ozet: z.string(),
		ozetEn: z.string(),
		/** Canlı adres. Yoksa kart bağlantı olarak basılmıyor. */
		adres: z.string().optional(),
		teknolojiler: z.array(z.string()).default([]),
		/*
		  KATKI VERENLER

		  Projeyi tek başına yapmadıysan burası doluyor; boşsa detay sayfasında
		  o bölüm hiç basılmıyor. Rol iki dilde ayrı: "Arayüz" ile "Frontend"
		  aynı kutuya sığmıyor ve İngilizce sayfada Türkçe bir rol adı
		  görünmesi istenmiyor. Rol boş bırakılırsa yalnızca ad yazılıyor.

		  `adres` varsa ad bağlantıya dönüyor (GitHub, LinkedIn, kişisel site).
		*/
		katkiVerenler: z
			.array(
				z.object({
					ad: z.string(),
					rol: z.string().optional(),
					rolEn: z.string().optional(),
					adres: z.string().optional(),
				}),
			)
			.default([]),
		/*
		  Detay sayfasındaki uzun anlatım.

		  TÜRKÇESİ dosyanın GÖVDESİNDE duruyor (MDX): panelde zengin metin
		  editörüyle yazılıyor, başlık ve liste kullanılabiliyor.
		  İngilizcesi burada düz metin: gövde tek tane ve iki dile
		  bölünemiyor. Paragraflar boş satırla ayrılıyor.

		  Boşsa detay sayfasında özet gösteriliyor, bölüm boş kalmıyor.
		*/
		detayEn: z.string().optional(),
		durum: z.enum(['aktif', 'arsiv']).default('aktif'),
		/** Küçük sayı önce gelir; eşitse ada göre sıralanır. */
		sira: z.number().default(100),
		/*
		  Taslak proje sayfaya HİÇ basılmıyor. Yarım bir açıklamayı yayında
		  tutmaktansa projeyi hiç göstermemek doğru.
		*/
		taslak: z.boolean().default(false),
	}),
});

export const collections = { blog, projeler };

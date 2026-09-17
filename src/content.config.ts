import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Blog yazıları src/content/blog/ altındaki .md ve .mdx dosyalarından okunur.
const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: z
		.object({
			title: z.string(),
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
		  Kapak varsa metin karşılığı zorunlu.

		  Panel bunu tek başına güvenceye alamıyor: kapak alanı boş
		  bırakılabildiği için "zorunlu" işareti konamıyor, ayrıca elle yazılmış
		  bir yazı panelden hiç geçmiyor. Denetim burada olunca kaçacak yer
		  kalmıyor — eksikse derleme, yazının adını vererek duruyor.
		*/
		.refine((veri) => !veri.kapak || (veri.kapakAlt ?? '').trim() !== '', {
			message:
				'Kapak görseli seçilmiş ama metin karşılığı (kapakAlt) boş. Görselin ne gösterdiğini yaz.',
			path: ['kapakAlt'],
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

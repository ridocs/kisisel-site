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

export const collections = { blog };

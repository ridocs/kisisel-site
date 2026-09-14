import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Blog yazıları src/content/blog/ altındaki .md ve .mdx dosyalarından okunur.
const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
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
		  Yerel dosya için public/ altına koyup "/kapak.jpg" yazmak yeterli.
		*/
		kapak: z.string().optional(),
		kapakAlt: z.string().optional(),
	}),
});

export const collections = { blog };

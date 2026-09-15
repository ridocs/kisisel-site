import { config, collection, fields } from '@keystatic/core';

/**
 * Yazı yönetim paneli.
 *
 * YEREL KİP: panel yalnızca geliştirme sunucusunda açılıyor ve doğrudan
 * `src/content/blog/` altındaki dosyaları yazıyor. Sunucuya hiçbir şey
 * eklenmiyor, kimlik doğrulama gerekmiyor, yayınlanan site hiç etkilenmiyor —
 * yazı git'te durmaya devam ediyor.
 *
 * Panelin kendisi React ile çalışıyor. Bu, sitenin "tarayıcıya sıfır
 * JavaScript" kuralını BOZMUYOR: `astro.config.mjs` eklentiyi yalnızca
 * `astro dev` çalışırken devreye alıyor, dolayısıyla yayın derlemesinde
 * `/keystatic` rotası hiç üretilmiyor.
 *
 * Alanlar `src/content.config.ts` içindeki şemayla BİREBİR aynı olmak
 * zorunda. Buraya bir alan ekleyip oraya eklemezsen panel dosyayı yazar,
 * derleme tip hatası verir.
 */
export default config({
	storage: { kind: 'local' },

	ui: {
		brand: { name: 'Mustafa Eybek' },
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
				  Kapak isteğe bağlı. Verilmezse başlıktan türetilen soyut bir
				  kapak çiziliyor, yani boş bırakmak ızgarada boşluk bırakmıyor.
				  Yerel dosya için public/ altına koyup "/kapak.jpg" yaz.
				*/
				kapak: fields.text({
					label: 'Kapak görseli (adres)',
					description: 'Boş bırakılabilir — o zaman başlıktan soyut bir kapak üretilir.',
				}),

				kapakAlt: fields.text({
					label: 'Kapak görseli metin karşılığı',
					description: 'Görsel varsa ne gösterdiğini yaz; ekran okuyucu bunu okuyor.',
				}),

				content: fields.mdx({
					label: 'İçerik',
					options: {
						image: {
							directory: 'public/yazi-gorselleri',
							publicPath: '/yazi-gorselleri/',
						},
					},
				}),
			},
		}),
	},
});

/**
 * Yayın öncesi kontrol sayfasını `/kontrol` rotasına bağlayan eklenti.
 *
 * Sayfa bilinçli olarak `src/pages/` dışında duruyor. Oraya konsaydı Astro onu
 * dosya sisteminden kendiliğinden bulur ve `astro build` yayın çıktısına bir
 * "site denetim raporu" koyardı — taslak başlıkları, kırık bağlantıları,
 * yapılmamış işleri sıralayan bir sayfa. Burada rota ELLE bağlanıyor; eklenti
 * de yalnızca `astro.config.cms.mjs` içinde duruyor, yani rota yalnızca
 * `npm run yazi` çalışırken var oluyor.
 *
 * Aynı gerekçe ve aynı düzen `src/istatistik/eklenti.mjs` içinde de var;
 * ikisi bilerek birbirinin eşi, çünkü "panel sayfası nasıl eklenir"in tek bir
 * cevabı olsun isteniyor.
 */
export default function kontrolPaneli() {
	return {
		name: 'kontrol-paneli',
		hooks: {
			'astro:config:setup': ({ injectRoute }) => {
				// `prerender` ayarlanmıyor: dev sunucusu statik sayfaları da her
				// istekte yeniden çalıştırıyor, yani rapor her açılışta dosyaların
				// o anki hâlinden üretiliyor. Yenilemek yeniden denetlemek demek.
				injectRoute({
					pattern: '/kontrol',
					entrypoint: './src/kontrol/Sayfa.astro',
				});
			},
		},
	};
}

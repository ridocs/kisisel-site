/**
 * İstatistik sayfasını `/istatistik` rotasına bağlayan eklenti.
 *
 * Sayfa bilinçli olarak `src/pages/` dışında duruyor. Oraya konsaydı Astro onu
 * dosya sisteminden kendiliğinden bulur, `astro build` üretir ve ziyaretçi
 * verisi sunucuya çıkardı. Burada rota ELLE bağlanıyor; eklenti de yalnızca
 * `astro.config.cms.mjs` içinde duruyor, yani rota yalnızca `npm run yazi`
 * çalışırken var oluyor.
 *
 * Tek dosyalık bir eklenti için ayrı dosya fazla görünebilir; yapılandırmanın
 * içine gömülmemesinin sebebi, sayfanın nereye bağlandığının sayfanın yanında
 * yazılı olması.
 */
export default function istatistikPaneli() {
	return {
		name: 'istatistik-paneli',
		hooks: {
			'astro:config:setup': ({ injectRoute }) => {
				// `prerender` ayarlanmıyor: proje adaptörsüz ve statik: `false`
				// vermek sunucu kipi istemek olurdu. Gerek de yok — dev sunucusu
				// statik sayfaları da her istekte yeniden çalıştırıyor, yani veri
				// zaten her açılışta tazeleniyor.
				injectRoute({
					pattern: '/istatistik',
					entrypoint: './src/istatistik/Sayfa.astro',
				});
			},
		},
	};
}

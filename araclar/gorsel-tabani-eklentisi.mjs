/**
 * Yazı içindeki görsellere alt dizin önekini ekler ve metin karşılığını
 * zorunlu kılar. Sätteri'nin hast aşamasında çalışıyor.
 *
 * NEDEN ÖNEK: site alan adının kökünde değil, `/web-sitem` altında
 * yayınlanıyor. Astro `base` ayarını yalnızca kendi ürettiği varlıklara
 * uyguluyor; `public/` altındaki bir dosyaya markdown'dan verilen
 * `/yazi-gorselleri/…` yolu olduğu gibi kalıyor. Ölçüldü: önek eklenmeden
 * derlenen HTML'de yol öneksiz çıkıyor, yani yayında 404. Bağlantılar için
 * aynı işi `src/i18n/ceviriler.ts` içindeki `taban` yapıyor; burası onun
 * görsel karşılığı. Öneki içeriğe yazmak yerine derlemede eklemek yazıları
 * taşınabilir bırakıyor: site bir gün kök dizine geçerse tek bir yazıya
 * dokunmak gerekmiyor.
 *
 * NEDEN ALT DENETİMİ: panel görsel eklerken metin karşılığı istiyor ama elle
 * yazılmış ya da daha önce eklenmiş bir görsel o denetimden geçmiyor.
 * Derlemeyi durdurmak erişilebilirlik hatasının yayına çıkmasını önlüyor;
 * sessizce geçen bir uyarı kimseyi durdurmuyor.
 *
 * KAPSAM: markdown'ın `![…](…)` biçimi ve MDX içindeki düz `<img>` etiketi.
 */
export default function gorselTabani({ taban = '' } = {}) {
	const onek = taban.replace(/\/+$/, '');

	return {
		name: 'gorsel-tabani',
		element: {
			filter: ['img'],
			visit(dugum, baglam) {
				const ozellikler = dugum.properties ?? {};
				const kaynak = ozellikler.src;
				const metinKarsiligi = ozellikler.alt;

				if (typeof metinKarsiligi !== 'string' || metinKarsiligi.trim() === '') {
					const dosya = baglam.fileURL ? decodeURIComponent(baglam.fileURL.pathname) : 'bilinmiyor';
					throw new Error(
						`Görselin metin karşılığı (alt) boş: ${kaynak}\n` +
							`  Dosya: ${dosya}\n` +
							`  Ekran okuyucu için görselin ne gösterdiğini yaz.`,
					);
				}

				// Yalnızca kökten verilen kendi yollarımız öneklenir: "http…",
				// "data:", "//cdn…" ve "./resim.png" başkasının ya da Astro'nun
				// kendi işi.
				if (
					onek &&
					typeof kaynak === 'string' &&
					kaynak.startsWith('/') &&
					!kaynak.startsWith('//') &&
					!kaynak.startsWith(onek + '/')
				) {
					baglam.setProperty(dugum, 'src', onek + kaynak);
				}
			},
		},
	};
}

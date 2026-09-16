import { seoAlaniYaz, yazmaAcikMi } from './metinler.mjs';

/**
 * SEO yönetimi ekranını `/seo` rotasına bağlayan eklenti.
 *
 * Sayfa bilinçli olarak `src/pages/` dışında duruyor. Oraya konsaydı Astro onu
 * dosya sisteminden kendiliğinden bulur ve `astro build` yayın çıktısına
 * sitenin bütün SEO eksiklerini sıralayan — üstelik site metinlerini
 * DEĞİŞTİREBİLEN — bir sayfa koyardı. Rota burada ELLE bağlanıyor; eklenti de
 * yalnızca panel yapılandırmalarında duruyor, yani rota yalnızca panel
 * çalışırken var oluyor.
 *
 * Aynı gerekçe ve aynı düzen `src/kontrol/eklenti.mjs` ile
 * `src/istatistik/eklenti.mjs` içinde de var; üçü bilerek birbirinin eşi,
 * çünkü "panel sayfası nasıl eklenir"in tek bir cevabı olsun isteniyor.
 */
export default function seoPaneli() {
	return {
		name: 'seo-paneli',
		hooks: {
			'astro:config:setup': ({ injectRoute, updateConfig }) => {
				// `prerender` ayarlanmıyor: dev sunucusu statik sayfaları da her
				// istekte yeniden çalıştırıyor, yani ölçüm her açılışta derlenmiş
				// çıktının o anki hâlinden üretiliyor.
				injectRoute({
					pattern: '/seo',
					entrypoint: './src/seo/Sayfa.astro',
				});

				/*
				  YAZMA UÇ NOKTASI İNTERNETE AÇIK KOPYADA HİÇ BAĞLANMIYOR.

				  O kopya `PANEL_EDITOR_YOK=1` ile çalışıyor. Aynı bayrağa
				  `src/panel/Kabuk.astro` da bakıyor: yazı editörü sekmesi orada
				  basılmıyor. Burada da uç nokta KURULMUYOR — sayfadaki alanları
				  basmamak tek başına yetmezdi, adres bilinirse doğrudan istek
				  atılabilirdi.

				  Gerekçe güvenlikten önce DOĞRULUK: internete açık panel sunucudaki
				  depoya yazıyor ve oraya yazılan metin kullanıcının bilgisayarındaki
				  depoya hiçbir zaman ulaşmıyor. Sessizce kaybolan bir düzeltme, hiç
				  yapılamayan düzeltmeden kötü.

				  Taşıyıcı neden Vite ara katmanı: masaüstü paneli adaptörsüz ve
				  statik, POST alan bir Astro rotası kurulamıyor. Aynı kısıt ve aynı
				  çözüm `src/yayin/eklenti.mjs` içinde ayrıntılı yazılı.
				*/
				if (yazmaAcikMi()) {
					updateConfig({ vite: { plugins: [yazmaAraKatmani()] } });
				}
			},
		},
	};
}

const YAZMA_YOLU = '/seo/yaz';

function yazmaAraKatmani() {
	return {
		name: 'seo-paneli-yazma',
		// Yalnızca dev sunucusunda: derlenmiş bir çıktıya sızması mümkün değil.
		apply: 'serve',
		configureServer(sunucu) {
			sunucu.middlewares.use(YAZMA_YOLU, async (istek, yanit) => {
				const cevapla = (kod, govde) => {
					yanit.statusCode = kod;
					yanit.setHeader('Content-Type', 'application/json; charset=utf-8');
					yanit.setHeader('Cache-Control', 'no-store');
					yanit.end(JSON.stringify(govde));
				};

				/*
				  GET kabul edilmiyor. Tarayıcının ya da bir eklentinin adresi
				  önceden getirmesi, hiç istenmediği hâlde site metnini
				  değiştirirdi.
				*/
				if (istek.method !== 'POST') {
					cevapla(405, { hata: 'Yalnızca POST.' });
					return;
				}

				let istem;
				try {
					istem = JSON.parse(await govdeyiOku(istek));
				} catch {
					cevapla(400, { hata: 'Gövde okunamadı.' });
					return;
				}

				try {
					const sonuc = await seoAlaniYaz(istem);
					cevapla(200, { basarili: true, ...sonuc });
				} catch (hata) {
					/*
					  Doğrulama hataları kullanıcıya ait (boş alan, satır sonu);
					  beklenmeyen hata programa ait. İkisi de aynı mesajla
					  dönüyor ama beklenmeyeni terminale de yazıyoruz, yoksa
					  panel "kaydedilemedi" deyip sebebini kimseye söylemezdi.
					*/
					if (!(hata instanceof Error)) console.error('[seo]', hata);
					cevapla(400, { hata: hata?.message ?? 'Kaydedilemedi.' });
				}
			});
		},
	};
}

function govdeyiOku(istek) {
	return new Promise((cozumle, reddet) => {
		let veri = '';
		istek.setEncoding('utf8');
		istek.on('data', (parca) => {
			veri += parca;
			// Bu uç noktaya gelen gövde birkaç yüz bayt; büyüğü bir hata ya da
			// kötüye kullanım demek.
			if (veri.length > 10_000) reddet(new Error('Gövde çok büyük.'));
		});
		istek.on('end', () => cozumle(veri));
		istek.on('error', reddet);
	});
}

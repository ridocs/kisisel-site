import { kokuAyarla } from './yayinla.mjs';
import { islemiYurut, islemSuruyorMu, islemiKilitle, kilidiAc } from './islem-yurut.mjs';

/**
 * Site durumu ve yayınlama ekranını `/durum` rotasına bağlayan eklenti.
 *
 * Sayfa bilinçli olarak `src/pages/` dışında duruyor. Oraya konsaydı Astro onu
 * dosya sisteminden kendiliğinden bulur, `astro build` üretir ve sunucu
 * adresiyle git durumu internete açılırdı. Rota burada ELLE bağlanıyor;
 * eklenti de yalnızca `astro.config.cms.mjs` içinde duruyor, yani rota
 * yalnızca `npm run yazi` çalışırken var oluyor. Aynı gerekçe
 * `src/istatistik/eklenti.mjs` için de geçerli.
 */
export default function yayinPaneli() {
	return {
		name: 'yayin-paneli',
		hooks: {
			'astro:config:setup': ({ config, injectRoute, updateConfig }) => {
				// Yayın yordamı proje kökünü `import.meta.url` ile bulamıyor;
				// gerekçesi yayinla.mjs içinde yazılı. Tek doğru kaynak burası.
				kokuAyarla(fileYolu(config.root));

				// `prerender` ayarlanmıyor: proje adaptörsüz ve statik. Gerek de yok —
				// dev sunucusu statik sayfaları da her istekte yeniden çalıştırıyor,
				// yani durum her açılışta yeniden ölçülüyor.
				injectRoute({
					pattern: '/durum',
					entrypoint: './src/yayin/Sayfa.astro',
				});

				/*
				  İŞLEM UÇ NOKTASI İKİ FARKLI YOLDAN GELİYOR.

				  Masaüstü panelinde proje adaptörsüz ve statik: POST alan bir Astro
				  rotası kurulamıyor, iş Vite ara katmanına düşüyor. İnternete açık
				  panelde Node adaptörü var ve gerçek bir rota POST'a cevap
				  verebiliyor — ara katman orada zaten çalışmazdı, çünkü yalnızca dev
				  sunucusunda var (`apply: 'serve'`).

				  Mantık ikisinde de aynı çekirdekten geliyor; yalnızca taşıyıcı
				  farklı.
				*/
				if (process.env.PANEL_YEREL_YAYIN === '1') {
					injectRoute({
						pattern: '/durum/islem',
						entrypoint: './src/yayin/islem.ts',
					});
				} else {
					updateConfig({ vite: { plugins: [islemAraKatmani()] } });
				}
			},
		},
	};
}

/** `config.root` bir `URL`; dosya sistemi yolu gerekiyor. */
function fileYolu(kokUrl) {
	const yol = decodeURIComponent(new URL(kokUrl).pathname);
	// Windows'ta pathname "/C:/Users/…" biçiminde geliyor; baştaki eğik çizgi
	// atılmazsa hiçbir dosya işlemi çalışmıyor.
	return /^\/[A-Za-z]:/.test(yol) ? yol.slice(1) : yol;
}

/*
  YAYIN İŞLEMLERİ NEDEN ASTRO ROTASI DEĞİL DE VITE ARA KATMANI

  Bu uç nokta POST alıyor ve yanıtı akıtıyor (derleme sürerken satır satır).
  Astro'nun statik kipinde bir rota önceden üretilmiş sayılıyor ve önceden
  üretilmiş uç noktalar yalnızca GET'e cevap veriyor; `prerender = false` demek
  ise projeye adaptör istemek olurdu — yayın derlemesi bundan etkilenirdi.

  GET'e çevirmek seçenek değil: tarayıcının ya da bir eklentinin adresi
  önceden getirmesi, hiç istenmediği hâlde yayın başlatırdı.

  Vite ara katmanı ikisini de çözüyor: yalnızca dev sunucusunda var
  (`apply: 'serve'`), gövdeyi ve akışı ham Node nesneleriyle yönetiyor.
*/
const ISLEM_YOLU = '/durum/islem';


function islemAraKatmani() {
	return {
		name: 'yayin-paneli-islem',
		apply: 'serve',
		configureServer(sunucu) {
			sunucu.middlewares.use(ISLEM_YOLU, async (istek, yanit) => {
				if (istek.method !== 'POST') {
					yanit.statusCode = 405;
					yanit.end('Yalnızca POST.');
					return;
				}

				let istem;
				try {
					istem = JSON.parse(await govdeyiOku(istek));
				} catch {
					yanit.statusCode = 400;
					yanit.end('Gövde okunamadı.');
					return;
				}

				if (islemSuruyorMu()) {
					yanit.statusCode = 409;
					yanit.end('Başka bir işlem sürüyor.');
					return;
				}

				/*
				  NDJSON: her satır kendi başına bir JSON nesnesi. Bütün yanıtı tek
				  bir JSON yapmak, akışı imkânsız kılardı — derleme bitene kadar
				  ekranda hiçbir şey görünmezdi. SSE yerine bunun seçilmesinin
				  sebebi de SSE'nin GET'e bağlı olması.
				*/
				yanit.statusCode = 200;
				yanit.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
				yanit.setHeader('Cache-Control', 'no-store');
				// Bazı ara katmanlar yanıtı tampona alıp akışı öldürüyor; bu başlık
				// "tamponlama" diyen her katmana dokunma demenin ortak yolu.
				yanit.setHeader('X-Accel-Buffering', 'no');

				const bildir = (tur, metin) => {
					yanit.write(`${JSON.stringify({ tur, metin })}\n`);
				};

				islemiKilitle();
				try {
					const sonuc = await islemiYurut(istem, bildir);
					yanit.write(`${JSON.stringify({ tur: 'sonuc', ...sonuc })}\n`);
				} catch (hata) {
					// Buraya düşmek bir program hatası demek; kullanıcıya da terminale
					// de gösteriliyor, yoksa panel sessizce donmuş görünürdü.
					console.error('[yayın]', hata?.stack ?? hata);
					yanit.write(
						`${JSON.stringify({
							tur: 'sonuc',
							basarili: false,
							hata: `Beklenmeyen hata: ${hata?.message ?? String(hata)}`,
						})}\n`,
					);
				} finally {
					kilidiAc();
					yanit.end();
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

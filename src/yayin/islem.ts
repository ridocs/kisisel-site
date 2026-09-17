import type { APIRoute } from 'astro';
import { islemiYurut, islemSuruyorMu, islemiKilitle, kilidiAc } from './islem-yurut.mjs';
import { kokuAyarla } from './yayinla.mjs';

/*
  PROJE KÖKÜ BURADA AYARLANIYOR, EKLENTİDE DEĞİL.

  `eklenti.mjs` kökü `astro:config:setup` içinde veriyor; o kanca DERLEME
  anında çalışıyor. Masaüstünde sorun çıkmıyordu çünkü orada ara katman aynı
  süreçte yaşıyor. Derlenmiş sunucuda ise uç nokta ayrı bir süreçte ve İSTEK
  anında çalışıyor: yapılandırma kancası oraya hiç uğramıyor, kök ayarsız
  kalıyordu.

  Belirti: "Proje kökü ayarlanmadı" hatası. Ölçülerek bulundu.

  `process.cwd()` doğru kaynak: servis depo klasöründen başlatılıyor
  (pm2 çalışma dizini `/opt/panel/kisisel-site`).
*/
kokuAyarla(process.cwd());

/*
  YAYIN İŞLEMLERİ — SUNUCU KİPİ UÇ NOKTASI

  Masaüstü panelinde bu işi bir Vite ara katmanı yapıyor; orada proje
  adaptörsüz ve statik olduğu için POST alan bir rota kurulamıyor.

  İnternete açık panelde (`astro.config.genel.mjs`) Node adaptörü var, yani
  gerçek bir rota POST'a cevap verebiliyor. Mantık ikisinde de aynı çekirdekten
  geliyor (`islem-yurut.mjs`); yalnızca taşıyıcı farklı.

  `prerender = false` burada güvenli: bu yapılandırmada zaten sunucu kipi var.
  Yayın derlemesi bu dosyayı hiç görmüyor — rota yalnızca genel panel
  yapılandırmasında bağlanıyor.
*/
export const prerender = false;

/*
  SALT-OKUR DENETİMİ BURADA, EKRANDA DEĞİL.

  `PANEL_SALT_OKUR` uzun süre yalnızca `Sayfa.astro` içinde okunuyordu ve
  orada sadece düğmelerin BASILMASINI engelliyordu. Uç noktanın kendisi
  açıktı: düğme görünmüyordu ama adres biliniyorsa doğrudan POST edilebiliyor
  ve canlı site değiştirilebiliyordu.

  Düğmeyi gizlemek bir yetki denetimi değildir. Denetim isteği karşılayan
  yerde durmalı; arayüz yalnızca kullanıcıya kolaylık.

  Bu, ağ katmanındaki korumanın (nginx parolası ve izin listesi) YERİNE
  geçmiyor, ona EKLENİYOR. İzin listesindeki bir kusur tek başına siteyi
  değiştirmeye yetmesin diye.
*/
const SALT_OKUR = process.env.PANEL_SALT_OKUR === '1';

export const POST: APIRoute = async ({ request }) => {
	if (SALT_OKUR) {
		return new Response('Bu panel salt okur kipinde; yayın işlemleri kapalı.', {
			status: 403,
		});
	}

	let istem: unknown;
	try {
		istem = await request.json();
	} catch {
		return new Response('Gövde okunamadı.', { status: 400 });
	}

	if (islemSuruyorMu()) {
		return new Response('Başka bir işlem sürüyor.', { status: 409 });
	}

	/*
	  NDJSON akışı: her satır kendi başına bir JSON nesnesi. Tek bir JSON
	  döndürmek, derleme bitene kadar ekranda hiçbir şey göstermemek olurdu —
	  derleme yarım dakika sürüyor ve boş ekran donma sanılıyor.
	*/
	const kodlayici = new TextEncoder();

	const akis = new ReadableStream({
		async start(denetleyici) {
			const bildir = (tur: string, metin: string) => {
				denetleyici.enqueue(kodlayici.encode(`${JSON.stringify({ tur, metin })}\n`));
			};

			islemiKilitle();
			try {
				const sonuc = await islemiYurut(istem, bildir);
				denetleyici.enqueue(kodlayici.encode(`${JSON.stringify({ tur: 'sonuc', ...sonuc })}\n`));
			} catch (hata: any) {
				// Buraya düşmek bir program hatası demek; kullanıcıya da kayda da
				// yazılıyor, yoksa panel sessizce donmuş görünürdü.
				console.error('[yayın]', hata?.stack ?? hata);
				denetleyici.enqueue(
					kodlayici.encode(
						`${JSON.stringify({
							tur: 'sonuc',
							basarili: false,
							hata: `Beklenmeyen hata: ${hata?.message ?? String(hata)}`,
						})}\n`,
					),
				);
			} finally {
				kilidiAc();
				denetleyici.close();
			}
		},
	});

	return new Response(akis, {
		status: 200,
		headers: {
			'Content-Type': 'application/x-ndjson; charset=utf-8',
			'Cache-Control': 'no-store',
			// Araya giren katmanlar yanıtı tamponlayıp akışı öldürebiliyor.
			'X-Accel-Buffering': 'no',
		},
	});
};

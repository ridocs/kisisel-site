// @ts-check
import { defineConfig } from 'astro/config';
import keystatic from '@keystatic/astro';
import temelYapilandirma from './astro.config.mjs';
import istatistikPaneli from './src/istatistik/eklenti.mjs';

/*
  YAZI PANELİ İÇİN AYRI YAPILANDIRMA

  Panel `npm run yazi` ile bu dosyadan açılıyor. İki sebeple ayrı tutuldu.

  1. Yayın derlemesi hiç etkilenmiyor. Panel React ile çalışıyor ve kendi
     rotasını açıyor; eklenti ana yapılandırmada dursaydı bir gün yanlışlıkla
     yayın çıktısına sızardı. Burada duruyorsa sızamaz — `astro build` bu
     dosyayı hiç okumuyor.

  2. `base` KALDIRILIYOR. Site "/web-sitem" altında yayınlanıyor ama
     Keystatic'in istemci yönlendiricisi Astro'nun `base` ayarını bilmiyor:
     kenar çubuğundaki bağlantı "/keystatic/collection/..." adresine gidiyor,
     API çağrısı da öneksiz çıkıp 404 alıyor ve koleksiyon "Unable to load"
     diyordu. Panel yalnızca yerelde, dosyaları düzenlemek için çalıştığı
     için önekin burada bir karşılığı yok.

  Panel `src/content/blog/` altındaki dosyaları doğrudan yazıyor; içerik
  git'te kalıyor, sunucuya hiçbir şey eklenmiyor.

  Ziyaretçi istatistiği sayfası (`/istatistik`) da aynı gerekçeyle buraya
  bağlandı: ziyaretçi verisi gösteriyor, internete açılamaz. Sayfanın kendisi
  `src/pages/` dışında duruyor ve rotayı yalnızca bu eklenti açıyor.
*/
export default defineConfig({
	...temelYapilandirma,
	base: undefined,
	/*
	  PORT SABİT — dolu olduğunda başka porta KAYMIYOR, hata veriyor.

	  Astro'nun varsayılanı dolu portu sessizce artırmak: 4321 meşgulse 4322'ye
	  geçiyor. Bu yapılandırmada o davranış veri kaybettiriyor. Sebebi, aynı
	  proje klasöründe iki dev sunucusunun aynı anda çalışabilmesi: ikisi de
	  içerik deposunu `.astro/data-store.json` olarak yazıyor ve ikisi de aynı
	  geçici dosya adını (`.tmp`) kullanıyor. Biri dosyayı yeniden adlandırıp
	  tükettiğinde diğeri aynı adı arıyor ve şu hatayla düşüyor:

	      UnknownFilesystemError · ENOENT · rename
	      .astro/data-store.json.tmp → .astro/data-store.json

	  Bu hata panelde yazı kaydederken "Failed to fetch" olarak görünüyor ve
	  yazılan makale diske hiç yazılmıyor.

	  DİKKAT — `strictPort` tek başına YETMİYOR. Bu sürümde etkisi görülmedi:
	  4321 doluyken sunucu yine 4322'ye kaydı, `--port` verilsin verilmesin.
	  Ölçüldü. Niyeti bildirdiği için burada duruyor ama güvence değil.

	  Gerçek koruma kendi kodumuzda: `npm run yazi` artık doğrudan Astro'yu
	  değil `masaustu/sunucu-nobetcisi.mjs` dosyasını çağırıyor ve masaüstü
	  uygulaması da dolu portta ikinci sunucu başlatmıyor. Ayrıntı o iki
	  dosyada.
	*/
	server: { port: 4321, strictPort: true },
	integrations: [
		...(temelYapilandirma.integrations ?? []),
		keystatic(),
		istatistikPaneli(),
	],
});

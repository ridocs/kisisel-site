// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import keystatic from '@keystatic/astro';
import temelYapilandirma from './astro.config.mjs';
import istatistikPaneli from './src/istatistik/eklenti.mjs';
import kontrolPaneli from './src/kontrol/eklenti.mjs';
import yayinPaneli from './src/yayin/eklenti.mjs';

/*
  PANELİN İNTERNETE AÇIK KOPYASI

  Bu yapılandırma `twinshareapp.com/web-sitem/panel-root` altında yayınlanan
  paneli üretiyor. Masaüstü panelinden (`astro.config.cms.mjs`) ve yayın
  sitesinden (`astro.config.mjs`) ayrı duruyor.

  NEDEN AYRI BİR YAPILANDIRMA

  1. KEYSTATIC VAR ama tek başına değil. Keystatic dosyaları diske yazıyor;
     bu kopya sunucuda çalıştığı için yazılan yazı sunucudaki dosyaya
     düşüyor ve kullanıcının deposuna kendiliğinden ulaşmıyor. İki kopya
     çatallanırdı.

     Bunu `araclar/icerik-esitleyici.mjs` çözüyor: içerik klasörlerini
     izliyor, değişiklikleri toplayıp işliyor ve GitHub'a gönderiyor. Yani
     tek gerçek kaynak yine depo. Eşitleyici çalışmıyorsa yazılar sunucuda
     birikir — kayıtlarında sebebi yazıyor.

  2. SUNUCU KİPİ. Panel sayfaları çalışma anında ölçüm yapıyor: kayıt
     okuyor, git durumuna bakıyor, dosya deniyor. Statik derlemede bu
     rakamlar derleme anına donardı. Node adaptörüyle her istekte yeniden
     ölçülüyor.

  3. YAYIN SİTESİ ETKİLENMİYOR. `astro build` bu dosyayı hiç okumuyor;
     `dist/` çıktısı ve oradaki 21 sayfa aynı kalıyor.

  GÜVENLİK — bu kopya internete bakıyor, üç şey bilinçli:

  - Sunucu yalnızca `127.0.0.1` dinliyor. Dışarıdan doğrudan porta
    erişilemiyor; tek kapı nginx ve orada parola koruması var.
  - `PANEL_SALT_OKUR=1` ile çalışıyor: Yayınla ve Geri al düğmeleri HTML'e
    hiç basılmıyor, onları süren betik de yok. Gizlemek yetmezdi.
  - `PANEL_YEREL_KAYIT=1` ile çalışıyor: ziyaretçi kayıtları SSH yerine
    doğrudan yerel dosyadan okunuyor. Böylece sitenin dağıtım anahtarı
    internete bakan makinede HİÇ BULUNMUYOR — makine ele geçse bile sunucuya
    yazma yetkisi kazanılmıyor.

  `base` BURADA GEREKLİ ve masaüstü yapılandırmasının tersi. Orada kaldırılmış,
  çünkü Keystatic'in istemci yönlendiricisi öneki bilmiyor. Burada Keystatic
  yok ve panel `/web-sitem/panel-root/` altında duruyor: önek verilmezse üst
  şeritteki bağlantılar `/istatistik` gibi kök adreslere çıkar ve nginx onları
  siteye yönlendirip 404 verir.
*/
export default defineConfig({
	...temelYapilandirma,
	base: '/web-sitem/panel-root',
	/*
	  Çıktı AYRI bir dizine. Varsayılan `dist/` yayın sitesinin çıktısı;
	  buraya yazsaydı iki farklı derleme aynı klasörü paylaşır ve hangisinin
	  orada durduğu belirsizleşirdi — sunucuya yanlış olanı göndermek çok
	  kolay olurdu.
	*/
	outDir: './dist-panel',
	output: 'server',
	/*
	  ROTA ELEMESİ BURADA DEĞİL, NGINX'TE.

	  Bu yapılandırma `astro.config.mjs`'i miras aldığı için sitenin bütün
	  sayfaları da derleniyor; uygulama `/blog`, `/hakkimda` gibi adresleri de
	  sunuyor. Kullanıcı bunu gördü: parolayı girip panel yerine siteyi açtı.

	  `astro:routes:resolved` kancasıyla rotaları elemek DENENDİ ve işe
	  yaramadı: kanca 23 rotadan 6'sının kaldığını bildiriyor ama derlenmiş
	  sunucu site sayfalarını yine servis ediyor. Ölçüldü.

	  Bu yüzden hangi adreslerin dışarı açılacağına nginx karar veriyor —
	  zaten parola kapısı da orada. Sunulmayan bir adres yanlışlıkla
	  açılamıyor. Ayrıntı: /etc/nginx/sites-enabled/twinshareapp
	*/
	adapter: node({ mode: 'standalone' }),
	integrations: [
		...(temelYapilandirma.integrations ?? []),
		keystatic(),
		istatistikPaneli(),
		kontrolPaneli(),
		yayinPaneli(),
	],
});

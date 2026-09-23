// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { ayarlariDogrula } from './src/musteri-paneli/sunucu/ayarlar.mjs';

/*
  MÜŞTERİ PANELİ: `twinshareapp.com/web-sitem/panel/`

  Bu dosya kasıtlı olarak `astro.config.mjs`'i MİRAS ALMIYOR.

  `astro.config.genel.mjs` temel yapılandırmayı yayıyor ve orada ölçülmüş bir
  sonuç var: sunucu kipinde Astro sitenin bütün sayfalarını da servis ediyor,
  `astro:routes:resolved` ile elemek işe yaramıyor. Orada çözüm nginx'e
  bırakıldı çünkü o panel zaten sitenin bileşenlerini kullanıyor.

  Burada gerek yok. `srcDir` doğrudan `src/musteri-paneli/` gösteriyor, yani
  Astro'nun gördüğü rotalar YALNIZCA bu klasördeki rotalar. Sitenin
  `src/pages/` altı bu derlemeye hiç girmiyor; blog, hakkımda, hizmetler
  sayfaları burada var olmuyor. Ters vekilde yapılacak eleme bunun üstüne
  ikinci bir katman, tek dayanak değil.

  YAYINLANAN SİTEYE HİÇBİR ŞEY SIZMIYOR:
  - `astro.config.mjs` değişmedi, `npm run build` çıktısı aynı.
  - Buradaki hiçbir eklenti oraya eklenmedi; bu dosyada zaten yalnızca Node
    adaptörü var. Tailwind, MDX, sitemap, icon, React: hiçbiri yok, panelin
    işine yaramıyorlar.
  - Çıktı `dist-panel/`. `dist/` hiç elleniyor değil.

  DİL: panel yalnızca Türkçe. `i18n` yapılandırması bilinçli olarak yok;
  panel müşteriye özel ve iki dilli olmasının bir karşılığı yok.
*/

/*
  Zorunlu ortam değişkenleri AÇILIŞTA denetleniyor.

  Hata ilk isteğe kadar ertelenseydi sunucu "çalışıyor" görünür, müşteri de
  giriş denemesinde anlamsız bir hata alırdı. Burada durursa sebebi ekranda
  yazıyor. Değerler `.env.ornek`te; gerçekleri DEPOYA GİRMİYOR.
*/
ayarlariDogrula();

export default defineConfig({
	site: 'https://twinshareapp.com',
	base: '/web-sitem/panel',
	srcDir: './src/musteri-paneli',
	/*
	  Statik dosyalar (stil sayfası, robots.txt) panelin kendi klasöründen.
	  Varsayılan `public/` sitenin varlıkları; onları panel adresinin altında
	  ikinci kez yayınlamanın anlamı yok.
	*/
	publicDir: './src/musteri-paneli/genel',
	/*
	  Çıktı ayrı dizine. `dist/` yayın sitesinin; ikisi aynı klasöre yazarsa
	  sunucuya yanlış olanı göndermek çok kolay olur.
	*/
	outDir: './dist-panel-musteri',
	output: 'server',
	adapter: node({ mode: 'standalone' }),
	/*
	  AYRI ÖNBELLEK DİZİNİ. Ölçülmüş tuzak (MIMARI.md §7): aynı klasörde iki
	  Astro sunucusu `.astro/` altına aynı geçici adla yazıyor ve biri
	  diğerinin dosyasını tüketince yazılan içerik sessizce kayboluyor.
	  Panelin kendi önbelleği olunca site sunucusuyla yan yana çalışabiliyor.
	*/
	cacheDir: './node_modules/.astro-musteri-paneli',
	/*
	  Varsayılan 4321 sitenin dev sunucusunun portu. Panel kendi portunda
	  durursa ikisi aynı anda açılabiliyor ve hangi sunucunun cevap verdiği
	  belirsiz kalmıyor.
	*/
	server: { port: 4327, host: false },
	/*
	  GELİŞTİRME ARAÇ ÇUBUĞU KAPALI, güvenlik başlıklarıyla çakıştığı için.
	  Araç çubuğu sayfaya satır içi betik enjekte ediyor; panelin içerik
	  güvenliği politikası `script-src 'self'` ve nonce olduğu için o betik
	  tarayıcıda engelleniyor ve konsol hatayla doluyor. Politikayı
	  geliştirmede gevşetmek, üretimde denenmemiş bir politika bırakırdı.
	*/
	devToolbar: { enabled: false },
	/*
	  Astro'nun kendi CSP desteği (security.csp) BURADA KULLANILMIYOR: o,
	  `<meta http-equiv>` etiketi basıyor ve tarayıcı iki politikanın
	  KESİŞİMİNİ uyguluyor. Politika ara katmanda, tek yerde ve başlık olarak
	  veriliyor (src/musteri-paneli/sunucu/basliklar.mjs).
	*/
});

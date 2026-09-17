# Mimari ve dosya haritası

Bu belge projenin **nerede ne olduğunu** ve daha önemlisi **neden öyle
olduğunu** anlatır. Kullanım komutları `README.md`'de, elle dağıtım adımları
`DAGITIM.md`'de.

Bir dosyanın ne yaptığını arıyorsan aşağıdaki haritaya bak; **neden** öyle
yapıldığını arıyorsan dosyanın kendi başındaki yorum bloğu çoğu zaman bu
belgeden ayrıntılıdır — kararlar koda yakın tutuluyor.

---

## 1. Proje nedir

Mustafa Eybek'in kişisel tanıtım ve blog sitesi.

| | |
|---|---|
| Yayın adresi | `https://twinshareapp.com/web-sitem/` |
| Yönetim paneli (web) | `https://twinshareapp.com/web-sitem/panel-root` (parola korumalı) |
| Depo | `github.com/ridocs/kisisel-site`, ana dal `main` |
| Yığın | Astro 7 · Tailwind CSS 4 · MDX · TypeScript |
| Diller | Türkçe (kök) + İngilizce (`/en/`) |
| Sayfa sayısı | 23 derlenen sayfa, 21'i dizinlenebilir |

### İki kural — ihlal edilmiyor

1. **Çatı JavaScript'i inmiyor.** Ölçüldü:

   | Ne | Durum |
   |---|---|
   | Harici betik (`<script src=…>`) | **0** — hiçbir sayfada yok |
   | React / `client:*` adacığı | **0** — depoda tek direktif yok |
   | Satır içi betik | sayfa başına **7–10 blok, ~12–15 KB** |

   Yani "React yok" doğru, ama **"hiç JavaScript yok" DOĞRU DEĞİL**. Tema
   uygulama, dil yönlendirmesi, belirme animasyonu, mobil menü ve sayfa sayfa
   kaydırma hepsi elle yazılmış betiklerle çalışıyor ve tarayıcıya iniyor.

   > **Bu ayrım önemli:** sitenin gizlilik sayfası ziyaretçiye "sayfayı
   > açtığında tarayıcına inen JavaScript de yok" diye söz veriyor, altbilgi
   > de "tarayıcıya inen JavaScript yok" yazıyor. İkisi de olduğu gibi
   > yanlış. Metin düzeltilmeli (bkz. §8).

   > İkinci pürüz: derleme `dist/_astro/client.*.js` (~220 KB) üretiyor ve
   > **hiçbir sayfa onu çağırmıyor** — React entegrasyonu kayıtlı olduğu için
   > çıkıyor. Ziyaretçiye inmiyor ama her yayında boşuna sunucuya gidiyor.

2. **Koyu temada lacivert yok.** Koyu zeminler nötr gri, chroma sıfır.

### Alt dizinde yayın — her şeyi etkileyen karar

Site alan adının kökünde değil `/web-sitem/` altında duruyor. Bunun üç
sonucu var ve üçü de kodda ayrı ayrı ele alınmış:

- Astro `base: '/web-sitem'` ile derleniyor; elle yazılan her adres bu önekten
  geçmek zorunda (`src/i18n/ceviriler.ts` içindeki `yol()` / `taban`).
- `robots.txt` alan adı kökünden okunuyor, alt dizinden **okunmuyor**. Site
  haritası beyanı bu yüzden kökteki dosyaya ayrıca yazılmalı (bkz. §8).
- Arama motorları otoriteyi kök alan adına yazıyor; alt dizin bunu
  devralmıyor.

---

## 2. Üç yapılandırma — hangisi ne üretir

Bu projenin en kolay karıştırılan yeri burası. **Üç ayrı Astro
yapılandırması** var ve üçü üç farklı şey üretiyor.

| Dosya | Ne üretir | Çıktı | Kim çalıştırır |
|---|---|---|---|
| `astro.config.mjs` | **Yayınlanan site** | `dist/` | `npm run build` |
| `astro.config.cms.mjs` | **Masaüstü paneli** (Keystatic dahil) | dev sunucusu | `npm run yazi` / `npm run panel` |
| `astro.config.genel.mjs` | **İnternete açık panel** (Keystatic YOK) | `dist-panel/` | sunucuda pm2 |

`astro build` yalnızca `astro.config.mjs`'i okur. Panel eklentileri öteki iki
dosyada durduğu için yayın çıktısına **sızamaz** — güvenlik değil, mimari
güvence.

### Neden panelin iki kopyası var

Masaüstü kopyası yazma yapıyor (Keystatic dosyalara yazıyor), internete açık
kopya yalnızca okuyor. Ayrımı env bayrakları kuruyor:

| Bayrak | Okunduğu tek yer | Ne değiştirir |
|---|---|---|
| `PANEL_EDITOR_YOK` | `src/panel/Kabuk.astro:70`, `src/seo/metinler.mjs:96` | Yazı sekmesini ve SEO yazma alanlarını hiç basmaz |
| `PANEL_SALT_OKUR` | `src/yayin/Sayfa.astro:210` | Yayınla/Geri al kartlarını basmaz |
| `PANEL_YEREL_KAYIT` | `src/istatistik/kayitlar.ts:219` | nginx kaydını SSH yerine yerel kabuktan okur |
| `PANEL_YEREL_SUNUCU` | `src/yayin/sunucu.mjs:87` | `ssh()` yerine yerel `sh -c` |
| `PANEL_YEREL_YAYIN` | `src/yayin/yayinla.mjs:59`, `src/yayin/eklenti.mjs:43` | `scp` yerine `cp`; derlemeden önce `git pull` |

> **Dikkat:** `PANEL_SALT_OKUR` yalnızca HTML basımını engelliyor, uç
> noktayı değil. Yani düğmeyi gizlemek yetmiyor — denetim sunucu tarafına da
> yazılmalı. Bu açık biliniyor ve kapatılacak.

### Keystatic neden yalnızca masaüstünde

Keystatic'in Astro entegrasyonu **hiç seçenek almıyor** — imzası
`keystatic(): AstroIntegration`. Ona bir önek verilemiyor; adreslerini her
zaman kökten kuruyor (`/keystatic`, `/api/keystatic`). İnternete açık panel
`/web-sitem/panel-root/` altında durduğu için o istekler siteye düşüyor ve
editör açılmıyor. Denendi, ölçüldü. Kendi alt alan adı kurulursa editör oraya
da alınabilir.

---

## 3. Dosya haritası — site

### `src/pages/` — rotalar

Türkçe önek almıyor, İngilizce `/en/` alıyor. Her TR sayfanın EN eşi **aynı
bileşeni** paylaşıyor; metin ayrımı bileşenin içinde değil çeviri
dosyalarında.

| Rota | Dosya | EN eşi |
|---|---|---|
| `/` | `index.astro` | `en/index.astro` |
| `/hakkimda` | `hakkimda.astro` | `en/about.astro` |
| `/hizmetler` | `hizmetler.astro` | `en/services.astro` |
| `/projeler` | `projeler.astro` | `en/projects.astro` |
| `/kullandiklarim` | `kullandiklarim.astro` | `en/uses.astro` |
| `/gizlilik` | `gizlilik.astro` | `en/privacy.astro` |
| `/neler-degisti` | `neler-degisti.astro` | `en/whats-changed.astro` |
| `/blog` | `blog/index.astro` | `en/blog/index.astro` |
| `/blog/<slug>` | `blog/[...slug].astro` | `en/blog/[...slug].astro` |
| `/404` | `404.astro` | `en/404.astro` |

Ayrıca `robots.txt.ts` ve `rss.xml.js` — ikisi de üretilen rota.

**`noindex` olan tek sayfalar:** iki 404. Site haritasından da eleniyorlar.

### `src/components/` — bileşenler

Düzen parçaları (her sayfada, `BaseLayout` üzerinden):
`Navbar.astro` (üst çubuk, tema ve dil düğmesi) · `Altbilgi.astro` (gezinme,
sosyal, sürüm damgası) · `SosyalRay.astro` (sağ kenar, 1024 px altında gizli)
· `SarmasikYazi.astro` (SMIL ile canlanan dekoratif SVG, JS yok) ·
`KaydirmaSeridi.astro` (saf CSS gösterge).

Ana sayfa bölümleri: `HeroBolumu` · `TanitimBolumu` · `YetkinlikBolumu` ·
`CalismaBolumu` · `YaziBolumu` · `IletisimBolumu`.

Sayfa gövdeleri (TR ve EN ortak kullanıyor): `HakkimdaIcerik` ·
`HizmetIcerik` · `GizlilikIcerik` · `KullandiklarimIcerik` ·
`DegisiklikIcerik` · `BulunamadiBolumu`.

Yazı parçaları: `YaziKarti` · `YaziKapagi` (kapak dosyası yoksa başlıktan
türeyen kararlı soyut SVG çiziyor).

> `ui/button.tsx` ve `ui/toggle.tsx` **hiçbir yerde kullanılmıyor** (arandı,
> tek import yok). shadcn kalıntısı; silinebilir.

### `src/layouts/BaseLayout.astro`

Tek düzen dosyası ve sitenin en yoğun yeri (581 satır). Sağladıkları:
`<html lang>`, yazı tipi ön yüklemesi, canonical, `hreflang` tr/en/x-default,
OG ve paylaşım kartı etiketleri, JSON-LD (Person + WebSite + BlogPosting),
`noindex` anahtarı, düzen parçaları ve iki slot (`tam-genislik` ve varsayılan
`max-w-3xl` okuma sütunu).

Tarayıcıya inen betiklerin çoğu burada: tema uygulama (boyamadan önce),
dil yönlendirmesi, belirme animasyonu, sayfa sayfa kaydırma.

### `src/styles/`

- `global.css` — tek stil kaynağı. Tailwind 4 `@theme`, koyu tema
  `@custom-variant dark (&:where(.dark, .dark *))` ile **sınıf tabanlı**
  (işletim sistemi tercihine değil).
- `yazitipi/inter-temel.woff2` — her sayfada ön yüklenen temel alt küme.
- `yazitipi/inter-ek.woff2` — Türkçeye özgü harfler, yalnızca TR sayfalarda.

### Çeviri düzeneği

- `src/i18n/ceviriler.ts` — **metin içermez, yalnızca mantık**: `dilBul()`,
  `cevirici()` → `m('grup.anahtar')`, `yol()` (önek ve sondaki eğik çizgi),
  `digerDilYolu()` + yol adı eşleme sözlüğü.
- `src/icerik/metinler-tr.json` / `metinler-en.json` — 18 grup, 224 alan.
  Anahtar tipi **TR JSON'un kendi yapısından** türetiliyor, yani yanlış
  anahtar derlemeyi durduruyor.

Bölüm içeriği (proje listesi, yetkinlik kalemleri) çeviri dosyasında değil,
ilgili bileşenin içinde `{tr, en}` sözlüğü olarak duruyor.

**Dil düğmesi:** durağan sayfalarda yol adı çevriliyor; yazılarda slug'lar
farklı olduğu için gerçek adres `dilBagi` prop'uyla geçiriliyor, çevirisi
yoksa düğme **hiç basılmıyor** (çalışmayan düğme, olmayan düğmeden kötü).

### İçerik koleksiyonu

`src/content.config.ts` — tek koleksiyon `blog`. Alanlar: `title`,
`description`, `pubDate`, `updatedDate`, `tags`, `draft`, `dil` (tr/en),
`ceviri` (öteki dildeki dosya adı), `kapak`, `kapakAlt`.

Bir kural şemada zorlanıyor: **kapak varsa `kapakAlt` boş olamaz**, yoksa
derleme durur.

Şu an 7 yazı: üç TR/EN çifti + `dart-dili` (çevirisi yok).

İkinci koleksiyon `projeler`: her proje TEK dosya, iki dilin özeti aynı
dosyada (`ozet` / `ozetEn`). Bir proje hem site hem uygulama olabiliyor, bu
yüzden `tur` liste. `taslak` işaretli olan sayfaya hiç basılmıyor.

### `keystatic.config.ts`

Yerel kip. Bir koleksiyon (`yazilar`) ve iki tekil (`metinlerTr`,
`metinlerEn`). Tekillerin şeması da TR JSON'dan üretiliyor, elle yazılmıyor.

---

## 4. Dosya haritası — panel ve altyapı

### `src/panel/` — ortak kabuk

- `Kabuk.astro` — panelin beş sekmeli üst şeridi ve ortak düzeni. Adresler
  `import.meta.env.BASE_URL`'den türetiliyor; sabit yazıldığında internete
  açık kopyada 404 veriyordu.
- `panel.css` — panelin tüm renk/boşluk değişkenleri. Öteki panel ekranları
  buradan besleniyor, kendi renklerini tanımlamıyor.

### `src/istatistik/` — ziyaretçi ölçümü

- `kayitlar.ts` — nginx erişim kayıtlarını okuyup ayrıştırır. Komut tek yerde
  tanımlı; taşıyıcı SSH ya da yerel kabuk. Robot desenleri burada.
- `Sayfa.astro` — ekran.
- `eklenti.mjs` — rotayı `injectRoute` ile açar (sayfa `src/pages/` dışında
  durduğu için yayın derlemesine giremiyor).

### `src/kontrol/` — yayın öncesi denetim

- `denetimler.ts` — taslak, kırık bağlantı, eksik alt metni gibi kusurları
  **yerel kaynaktan** tarar. SSH yok, HTTP yok.
- `Sayfa.astro`, `eklenti.mjs`

### `src/seo/` — SEO yönetimi ve puan

- `olcum.ts` — `dist/` içindeki HTML'i okuyup ölçer: başlık/açıklama
  uzunlukları, canonical, hreflang, JSON-LD, site haritası, yetim sayfalar.
  **Puanlama da burada** (`puanHesapla`): 100 puan altı kaleme bölünüyor,
  her kalem "teknik" mi "metin" mi olduğunu söylüyor.
- `metinler.mjs` — panelden düzenlenebilen metin alanlarını `src/icerik/`
  JSON'larına yazar.
- `Sayfa.astro`, `seo.css`, `eklenti.mjs`

### `src/yayin/` — site durumu ve yayınlama

- `sunucu.mjs` — sunucuyla konuşan ortak katman: adres, anahtar yolu, `ssh()`
  sarmalayıcısı, hata çevirisi. Sunucu sabitleri **burada**.
- `yayinla.mjs` — derleme + gönderme + geri alma yordamı. Derleme projenin
  İÇİNDE değil `node_modules/.yayin-derleme` KOPYASINDA yapılıyor (sebep §7).
- `durum.ts` — canlı site, sunucu dizini, git durumu, taslaklar.
- `islem.ts` / `islem-yurut.mjs` — yayın işlemlerini yürüten uç nokta ve
  ortak çekirdek. Vite ara katmanı yalnızca dev'de var, bu yüzden üretim
  için ayrı SSR uç noktası gerekti.
- `Sayfa.astro`, `eklenti.mjs`

### `masaustu/` — Electron uygulaması

- `ana.mjs` — pencere, menü, dev sunucusunu başlatma/bağlanma. Panel listesi
  (`PANELLER`) burada; sırası `src/panel/Kabuk.astro` ile aynı olmalı.
- `onyukleme.cjs` — preload. Üç iş yapıyor: Keystatic'i koyu temaya alıyor,
  arayüzünü Türkçeleştiriyor (Keystatic'in kendi `tr-TR` tablosu bozuk), ve
  panel girdilerini Keystatic'in şeridine/sol menüsüne/gösterge paneline
  enjekte ediyor.
- `sunucu-nobetcisi.mjs` — aynı klasörde İKİNCİ dev sunucusunun başlamasını
  engeller. Sebep §7.
- `baslatiliyor.html`, `hata.html` — yerel açılış ve hata ekranları.

### `src/lib/`

- `iletisim.ts` — e-posta, telefon, konum, GitHub ve sosyal profiller.
  **Düzenlenecek tek yer burası**; adresler hem sayfaya hem JSON-LD `sameAs`
  şemasına hem sosyal raya hem altbilgiye buradan gidiyor.
- `surum.ts` — git'ten sürüm ve değişiklik günlüğü okur (derleme zamanında).
  `.git`'i bulmak için yukarı yürür; yayın kopyasında `.git` yok.
- `utils.ts` — küçük yardımcılar.

### `araclar/`

- `gorsel-tabani-eklentisi.mjs` — markdown görsellerine site önekini ekler.
- `icerik-esitleyici.mjs` — içerik eşitleme gözcüsü (şu an kullanılmıyor).
- `yazitipi-altkume.py` — Inter yazı yüzünden alt küme üretir.

---

## 5. Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Yayın yapılandırmasıyla dev sunucusu |
| `npm run build` | `dist/` üretir (yayınlanan site) |
| `npm run yazi` | Panel dev sunucusu — **nöbetçiden geçer**, ikinci sunucuyu engeller |
| `npm run panel` | Electron masaüstü paneli |

---

## 6. Sunucu ve dağıtım

> **Sunucu adresi, dizin yolları ve süreç adları BU DEPODA YAZILI DEĞİL.**
> Depo herkese açık; o bilgiler yalnızca kullanıcının yerel notlarında
> duruyor. `DAGITIM.md` de aynı sebeple yer tutucularla genel tutulmuştur.

Yapının şekli şöyle (somut değerler olmadan):

- Site, alan adının **statik kökü altında bir dizinde** duruyor. Yayın
  **atomik takasla** yapılıyor: yeni sürüm komşu bir dizine yükleniyor,
  sahiplik ayarlanıyor, sonra iki dizin yer değiştiriyor. Bir önceki sürüm
  `…eski` adıyla duruyor, geri alma bundan ibaret.
- İnternete açık panel **ayrı bir klon** üzerinde, yalnızca yerel arayüzü
  dinleyen bir süreç olarak çalışıyor; dışarıya tek kapı nginx ve orada
  parola var.
- **Dağıtım anahtarı internete bakan makinede YOK** — bilerek. Makine ele
  geçse bile sunucuya yazma yetkisi kazanılmıyor; internete açık panel bu
  yüzden `PANEL_YEREL_*` bayraklarıyla çalışıyor.

### nginx'te panelin üç bloğu

Panel adresleri **izin listesiyle** açılıyor: kök adres parolalı bir
yönlendirme, adı listede geçen panel rotaları parolalı vekil, geri kalan her
şey parola sonrası **404**. Böylece sitenin ikinci bir kopyası parolanın
arkasında durmuyor.

> Bu listede bilinen iki kusur var; ayrıntısı bilerek buraya yazılmadı
> (herkese açık depo). Kullanıcının yerel notlarında duruyor.

---

## 7. Ölçülerek öğrenilmiş tuzaklar

Bunların hepsi yaşandı ve ölçüldü. Kodda ilgili yerlerde ayrıca yazılı.

**İki dev sunucusu = sessiz veri kaybı.** Aynı klasörde iki Astro dev
sunucusu, içerik deposunu aynı geçici adla yazıyor
(`.astro/data-store.json.tmp`). Biri dosyayı taşıyıp tüketince öteki `ENOENT`
alıp düşüyor; panelde bu "Failed to fetch" olarak görünüyor ve **yazılan
makale diske hiç yazılmıyor**. `strictPort` bu sürümde işe yaramıyor
(ölçüldü, 4321 doluyken 4322'ye kayıyor). Koruma `masaustu/sunucu-nobetcisi.mjs`'de.

**Yayın derlemesi kopyada yapılıyor.** Aynı sebeple: panel açıkken dev
sunucusu da `.astro`'ya yazıyor. `yayinla.mjs` kaynakları
`node_modules/.yayin-derleme` altına kopyalayıp orada derliyor.

**Vite ara katmanı üretimde yok.** `apply: 'serve'` yalnızca dev sunucusunda
çalışıyor; yayın uç noktası bu yüzden ayrı bir SSR rotası olarak yazıldı.

**`astro:routes:resolved` ile rota elemek işe yaramadı.** Kanca filtrelemeyi
bildiriyor ama derlenmiş sunucu site sayfalarını yine servis ediyor.
Ölçüldü. Eleme bu yüzden nginx'te.

**Görünmeyen pencerede `requestAnimationFrame` hiç çalışmıyor.** Preload'daki
enjeksiyon tazelemesi bu yüzden `setTimeout` kullanıyor. Pencere simge
durumundayken rAF'a bağlanan iş sıraya girip orada kalıyor.

**Bash heredoc Türkçe metni sessizce bozuyor** (Git Bash). Dosya içeriği
`Write` ile yazılmalı; doğrulama bayt düzeyinde (`od -c` → `ü` = `303 274`).

---

## 8. Bekleyenler

- **Panel parolası değiştirilmeli.**

Kapatılanlar (17 Eylül 2026):

- Site haritası artık kökteki `robots.txt`'den beyan ediliyor — yeni bir
  `Sitemap` satırı eklendi, alan adındaki öteki uygulamanın kurallarına
  dokunulmadı.
- nginx izin listesi SEO ekranını kapsıyor ve desen sona bağlandı; yayın uç
  noktası dışarıdan erişilemiyor.
- Yayın uç noktası salt-okur denetimini kodda da aldı (`src/yayin/islem.ts`).
- İnternete açık panel gerçekten salt-okur kipinde çalışıyor: `PANEL_SALT_OKUR`
  ayarlanmamıştı, eklendi ve pm2 kaydı güncellendi.
- Metin eksikleri: `/gizlilik` (170) ve `/en/privacy` (161) açıklamaları 160
  sınırının üstünde; `/blog/dart-dili` başlığı 81 karakter; o yazının
  İngilizce çevirisi yok.
- **Gizlilik sayfası ve altbilgi "tarayıcıya inen JavaScript yok" diyor;
  bu doğru değil** (ölçüldü: sayfa başına 7–10 satır içi blok, ~12–15 KB).
  Metin "çatı/izleme betiği yok, yalnızca arayüz için birkaç küçük betik var"
  diye düzeltilmeli — gizlilik metninde yanlış bir söz durmamalı.
- `rss.xml` **dil süzmüyor**: İngilizce yazılar akışta Türkçe adresle
  (`/blog/<id>/`) çıkıyor ve akış `tr-tr` olarak etiketli.
- `src/components/ui/button.tsx` ve `toggle.tsx` kullanılmıyor — silinebilir.
- Kullanılmayan `dist/_astro/client.*.js` (~220 KB) her yayında gönderiliyor.
- `public/og.jpg` yer tutucu; Kullandıklarım sayfasında donanım yer tutucuları.

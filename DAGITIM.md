# Dağıtım

Site Cloudflare Pages'te, proje adı `mustafaeybek`, adres `https://mustafaeybek.com/`.
Sunucu yok; yayın doğrudan yükleme.

## Yayın

Panelden: Durum sayfası > Derle > Yayınla.

Elle:

```bash
npx wrangler login        # bir kez, tarayıcıda izin verilir
npm run yayinla
```

`yayinla` önce `astro build` çalıştırır, sonra `dist/` klasörünü üretim dalına yükler.
Yükleme atomiktir: tamamlanmadan alan adı yeni sürüme geçmez, yarıda kalırsa site değişmez.

## Geri alma

Cloudflare paneli > Workers & Pages > mustafaeybek > Deployments > önceki sürüm > Rollback.

## Proje yeniden kurulursa

```bash
npx wrangler pages project create mustafaeybek --production-branch=main --force
```

`--force` burada şart. Wrangler 4.156 olmayan bir projeyi Workers'a devretmeye kalkıyor,
siteye `astro add cloudflare` kurmayı deniyor ve `package.json` dosyasını bozuyor. Site
statik, adaptör gerekmiyor. Proje varken `pages deploy` doğrudan çalışır, `--force` istemez.

## Alan adı

- `mustafaeybek.com`: Pages projesinin Custom domains sekmesinden bağlı, kök kayıt
  `CNAME @ -> mustafaeybek.pages.dev` (vekilli).
- `www.mustafaeybek.com`: `CNAME www -> mustafaeybek.com` (vekilli) ve bölgedeki 301
  yönlendirme kuralı (`https://www.*` -> `https://${1}`). Ayrı bir Pages bağı gerekmiyor.

## Yanıt başlıkları

`public/_headers`: güvenlik başlıkları, `_astro/` önbelleği ve geçici `pages.dev`
adresinin arama motorlarına kapatılması.

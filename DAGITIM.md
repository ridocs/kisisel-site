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

## Yanıt başlıkları

`public/_headers`: güvenlik başlıkları, `_astro/` önbelleği ve geçici `pages.dev`
adresinin arama motorlarına kapatılması.

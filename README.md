# Kişisel tanıtım ve blog sitesi

Astro + Tailwind CSS ile kurulmuş statik kişisel site. Blog yazıları Markdown/MDX
dosyalarından üretilir.

## Kurulu kütüphaneler

| Paket | Ne işe yarar |
| --- | --- |
| `astro` | Statik site üreteci; varsayılan olarak sıfır JavaScript gönderir |
| `tailwindcss` + `@tailwindcss/vite` | Utility tabanlı CSS (v4 — yapılandırma `src/styles/global.css` içinde) |
| `@tailwindcss/typography` | Blog yazılarının tipografisi (`prose` sınıfları) |
| `@astrojs/mdx` | Yazıların içinde bileşen kullanabilmek için MDX desteği |
| `@astrojs/markdown-satteri` | Kod bloklarının sözdizimi vurgulaması |
| `@astrojs/sitemap` | `sitemap-index.xml` üretimi (SEO) |
| `@astrojs/rss` | `/rss.xml` akışı |
| `astro-icon` + `@iconify-json/lucide` | SVG ikonlar (`<Icon name="lucide:rss" />`) |

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu — http://localhost:4321 |
| `npm run build` | Üretim derlemesi → `dist/` |
| `npm run preview` | Derlenmiş siteyi yerelde önizle |

## Yazı eklemek

`src/content/blog/` altına `.md` veya `.mdx` dosyası ekle:

```yaml
---
title: 'Yazı başlığı'
description: 'Listelerde ve RSS akışında görünen özet.'
pubDate: 2026-09-13
tags: ['etiket']
draft: false
---
```

`draft: true` olan yazılar listelerde ve RSS'te görünmez. Şema
`src/content.config.ts` içinde tanımlıdır.

## Yapılacaklar

- `astro.config.mjs` içindeki `site` değerini kendi alan adınla değiştir
  (sitemap ve RSS mutlak URL'leri buradan üretilir).
- `src/pages/index.astro` içindeki tanıtım metnini kendinle doldur.
- `LICENSE` dosyasındaki telif satırına tam adını yaz.

## Lisans

[MIT](LICENSE)

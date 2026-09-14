# Dağıtım — alt dizin altında yayın

Site statik. `npm run build` sonrası `dist/` klasörünün **içeriği** sunucuda
yayın yoluna denk gelen dizine kopyalanır — `dist` klasörünün kendisi değil,
içindekiler.

Yayın yolu `astro.config.mjs` içinde tanımlı:

```js
site: 'https://alan-adi.example',
base: '/alt-dizin',
```

Bu iki satır değiştiğinde elle yazılmış bağlantılar da kendiliğinden uyum
sağlar: bağlantı üreten her yer `src/i18n/ceviriler.ts` içindeki `taban`
sabitinden geçiyor. Alan adının kökünde yayınlanacaksa `base` satırı
tamamen kaldırılır.

Astro'nun `base` ayarı yalnızca kendi ürettiği varlık yollarını (`_astro/…`)
önekler. Elle yazılan bağlantılar öneksiz kalır ve 404 verir; bu yüzden
öneki uygulamak `taban` sabitinin işi.

## 1) Derle

```bash
npm run build
```

## 2) Sunucuya kopyala

```bash
rsync -avz --delete dist/ <kullanıcı>@<sunucu>:<hedef-dizin>/
```

`rsync` yoksa `scp -r dist/* <kullanıcı>@<sunucu>:<hedef-dizin>/` da olur;
`--delete` karşılığı olmadığı için silinen dosyalar sunucuda kalır.

## 3) Web sunucusu ayarı (nginx)

Alan adının kökünde başka bir uygulama çalışıyorsa yalnızca ilgili yol
statik dosyalara yönlendirilir:

```nginx
location /alt-dizin/ {
    alias <hedef-dizin>/;
    index index.html;
    # Astro dizin tabanlı yollar üretiyor: /alt-dizin/blog/ -> blog/index.html
    try_files $uri $uri/ $uri/index.html =404;
}

# Sondaki eğik çizgi olmadan gelen istekler
location = /alt-dizin {
    return 301 /alt-dizin/;
}
```

Hash'li varlıklar içerik değiştiğinde ad değiştirir; uzun süre önbelleğe
alınabilirler:

```nginx
location /alt-dizin/_astro/ {
    alias <hedef-dizin>/_astro/;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

Ardından: `nginx -t && systemctl reload nginx`

## 4) CDN önbelleği

Alan adı bir CDN arkasındaysa (ör. Cloudflare) ilk yayından önceki 404 yanıtı
önbellekte kalabilir; ilgili yol için önbellek temizlenmeli.

## 5) Doğrulama

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://alan-adi.example/alt-dizin/
curl -s https://alan-adi.example/alt-dizin/ | grep -o '/alt-dizin/_astro/[^"]*\.css'
```

Beklenen: `200` ve bir CSS yolu. O CSS yolunun kendisi de `200` dönmeli —
dönmüyorsa `alias` yolu yanlıştır.

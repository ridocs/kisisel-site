# Müşteri panelinin sunucuya kurulumu

Bu belge panelin ilk kurulumunu anlatıyor. Tasarım ve gerekçeler için
`PANEL-TASARIMI.md`, sitenin kendi dağıtımı için `DAGITIM.md`.

> **Depo herkese açık.** Burada `<...>` biçiminde duran her şey yer tutucu.
> Gerçek adres, yol, kullanıcı adı ve sır bu dosyaya **yazılmaz**; yerel
> notta durur.

---

## 0. Önce bu

Panel müşteri verisi tutacak. Başlamadan önce `PANEL-TASARIMI.md` §11'deki
sıfırıncı madde kapatılmalı: **sunucu adresi ve kullanıcı adı hâlâ herkese
açık depoda** (`src/yayin/sunucu.mjs`). Kurulumdan önce oradan çıkarılmalı
ve SSH anahtarı döndürülmeli.

---

## 1. Ön koşullar

Sunucuda:

- **Node 24 veya üstü.** Panel `node:sqlite` kullanıyor; bu modül Node 24'te
  stabil. Node 22'de bayrak istiyor, Node 20'de hiç yok.
- nginx (zaten var, site onunla yayınlanıyor).
- systemd (zaten var).

Doğrulama:

```sh
node -v                      # v24 veya üstü olmalı
node -e "require('node:sqlite'); console.log('sqlite tamam')"
```

---

## 2. Kullanıcı ve dizinler

Panel kendi kullanıcısıyla çalışacak, root ile değil.

```sh
sudo useradd --system --no-create-home --shell /usr/sbin/nologin <panel-kullanicisi>
sudo mkdir -p <panel-dizini> <veritabani-dizini>
sudo chown -R <panel-kullanicisi>:<panel-grubu> <veritabani-dizini>
sudo chmod 750 <veritabani-dizini>
```

Veritabanı **dizini** yazılabilir olmak zorunda, yalnızca dosyası değil:
SQLite yanına `-wal` ve `-shm` dosyaları açıyor.

---

## 3. Paneli derle ve yükle

Yerelde:

```sh
npm run build -- --config astro.config.panel.mjs
```

Çıktı `dist-panel-musteri/`. Sunucuya yüklenecekler:

| Yerel | Sunucu |
|---|---|
| `dist-panel-musteri/*` | `<panel-dizini>/` |
| `veri/sunucu-ice-al.mjs` | `<uzak-veri-dizini>/` |
| `veri/sunucu-talep-ver.mjs` | `<uzak-veri-dizini>/` |
| `veri/db.mjs`, `veri/semalar.mjs`, `veri/esitleme.mjs`, `veri/izinli-alanlar.mjs` | `<uzak-veri-dizini>/` |

Eşitleme betikleri bu dört dosyayı göreli yoldan içe aktarıyor, yani **aynı
dizinde** durmak zorundalar. Ayrıca kopyalanacak bir şema dosyası yok:
şemalar `semalar.mjs` içinde dize olarak duruyor.

> Şemanın neden ayrı bir `.sql` dosyası olmadığı ölçülerek öğrenildi. Bir
> süre öyleydi ve geliştirme sunucusunda sorunsuz çalışıyordu; üretim
> derlemesinde paketleyici modülü taşıyıp yanındaki `.sql` dosyasını
> taşımadığı için panel ilk istekte 500 veriyordu.

---

## 4. Ortam dosyası

`.env.ornek` dosyasını örnek alarak sunucuda `<ortam-dosyasi>` oluşturun.

```sh
sudo install -o <panel-kullanicisi> -g <panel-grubu> -m 600 /dev/null <ortam-dosyasi>
sudo -u <panel-kullanicisi> nano <ortam-dosyasi>
```

Gizli anahtarı sunucuda üretin, kendi bilgisayarınızda yazıp yollamayın:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Zorunlu değerler: `PANEL_GIZLI`, `PANEL_RP_ID`, `PANEL_ORIGIN`, `PANEL_VT`,
`PANEL_TABAN`, `PANEL_VEKIL_GUVENILIR=1`. `PANEL_GELISTIRME` **kesinlikle
konulmaz**; konulursa çerez `Secure` bayrağını kaybeder.

`PANEL_RP_ID` yalnızca ana bilgisayar adı olmalı, şema ve port olmadan.
Passkey'ler bu değere bağlanıyor: sonradan değiştirilirse bütün müşteriler
yeniden kaydolmak zorunda kalır (`PANEL-TASARIMI.md` §9).

---

## 5. Servis

```sh
sudo cp dagitim/panel.service /etc/systemd/system/panel.service
sudo nano /etc/systemd/system/panel.service      # yer tutucuları doldurun
sudo systemctl daemon-reload
sudo systemctl enable --now panel
sudo systemctl status panel
```

Yerel olarak cevap verdiğini görün:

```sh
curl -si http://127.0.0.1:4327/web-sitem/panel/ | head -1
```

---

## 6. Ters vekil

`dagitim/nginx-panel.conf` içindeki panel bloğunu sitenin sunucu bloğuna
ekleyin, sonra:

```sh
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` geçmeden **reload etmeyin**: bozuk yapılandırmayla reload, siteyi
de indirir.

---

## 7. Eşitleme ayarları

### Önce sunucuda: kullanıcı sarmalayıcısı

SSH ile bağlanan sahip **root**. Root olarak açılan SQLite, yanına root
sahipli `-wal` ve `-shm` dosyaları bırakır ve panel sürecinin o veritabanına
yazma yetkisi kaybolur. Sorun sessizdir: panel açılır, yalnızca yazma anında
patlar.

Bu yüzden eşitleme betikleri panel kullanıcısıyla çalışmalı. Uzak veri
dizinine çalıştırma izni olan küçük bir sarmalayıcı koyun:

```sh
#!/bin/sh
exec setpriv --reuid=panel --regid=panel --clear-groups <node-yolu> "$@"
```

### Sonra yönetim uygulamasında

`npm run yonetim`, Eşitleme ekranı, beş değer: sunucu adresi, uzak veri
dizini, uzak veritabanı yolu, SSH özel anahtar yolu ve **uzak Node yolu**
(yukarıdaki sarmalayıcı). Bu değerler yalnızca kendi bilgisayarınızdaki
veritabanında durur, depoya yazılmaz.

> Uzak Node yolunun ayar olmasının sebebi ölçüldü: sunucunun `PATH`
> değişkenindeki Node eski bir sürümdü ve panelin kullandığı `node:sqlite`
> orada yoktu. Komut düz `node` diye çağrılsaydı eşitleme ilk denemede,
> panel çoktan yayındayken kırılırdı.

"Eşitle" düğmesi önce kuyruğu gönderir, sonra destek taleplerini çeker.

---

## 8. İlk müşteri

1. Yönetim uygulamasında müşteriyi tanımlayın.
2. Davet ekranından anahtar üretin. **Anahtar bir kez görünür**, ekrandan
   çıkınca kaybolur.
3. "Eşitle" deyin: anahtarın karması sunucuya gider, anahtarın kendisi
   gitmez.
4. Anahtarı müşteriye verin. Telefonda okumak en sağlamı.
5. Müşteri panele girip anahtarı yazar ve cihazını kaydeder.

Müşteriye **iki cihaz** kaydettirin (telefon ve bilgisayar). O zaman tek
cihaz kaybı olay olmaktan çıkar.

---

## 9. Yedekleme

Veritabanı tek dosya, ama çalışırken kopyalamak bozuk kopya verir. SQLite'ın
kendi yedek komutunu kullanın:

```sh
sudo -u <panel-kullanicisi> node -e "
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(process.argv[1]);
  db.exec(\"VACUUM INTO '\" + process.argv[2] + \"'\");
" <veritabani-yolu> <yedek-yolu>
```

Yedeği sunucunun **dışına** alın: aynı makinedeki yedek, makine gidince
gider.

---

## 10. Kurulum sonrası kontrol listesi

- [ ] `https://<alan>/web-sitem/panel/` giriş sayfasını veriyor
- [ ] Cevapta `set-cookie` başlığı `__Secure-` önekli ve `Secure; HttpOnly; SameSite=Strict` taşıyor
- [ ] `Content-Security-Policy` başlığı geliyor ve iki kez gelmiyor
- [ ] Oturumsuz `/web-sitem/panel/pano` giriş sayfasına yönlendiriyor
- [ ] Sitenin geri kalanı çalışıyor, `/web-sitem/hizmetler/` hâlâ statik dosyadan geliyor
- [ ] Navbar'daki "Giriş Yap" düğmesi panele gidiyor
- [ ] `systemctl status panel` çalışır durumda, yeniden başlatmada da açılıyor
- [ ] Yönetim uygulamasından "Eşitle" hatasız dönüyor
- [ ] Gerçek bir cihazla passkey kaydı ve girişi denendi

---

## 11. Geri alma

Panel sorun çıkarırsa site etkilenmeden kapatılabilir:

```sh
sudo systemctl stop panel
```

Sonra nginx'teki panel bloğunu yorum satırına alıp `nginx -t && systemctl
reload nginx`. Site çalışmaya devam eder; yalnızca "Giriş Yap" düğmesi 404
verir. Düğmeyi de gizlemek gerekirse `src/components/Navbar.astro` içindeki
`hedef` değerini kaldırıp siteyi yeniden yayınlayın.

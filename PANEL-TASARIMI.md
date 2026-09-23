# Müşteri paneli: kimlik doğrulama tasarımı

**Durum:** taslak, onay bekliyor. Kod yazılmadı.
**Tarih:** 23 Eylül 2026.
**Kapsam:** giriş akışı ve oturum yönetimi. Panelin içi (destek talepleri
ekranları) bu belgenin dışında, sonraki aşama.

Bu belge `MIMARI.md`'yi tekrar etmez. Sunucu adresi, dizin yolu ve süreç adı
burada **yok**: depo herkese açık, o değerler yerel notta duruyor.

---

## 1. Neden özel bir şifreleme algoritması yazmıyoruz

İstek "bize özel yüksek güvenlikli şifreleme" idi. Kelimesi kelimesine
karşılığı, yani kendi algoritmamızı icat etmek, güvenliği düşürür:

- Ciddi kriptografi **anahtarın** gizliliğine dayanır, algoritmanın değil
  (Kerckhoffs ilkesi). Gizli tutulan algoritma incelenmediği için kırılır.
- OWASP Top 10 2025, A07 "Authentication Failures" maddesi bunu doğrudan
  söylüyor: kimlik doğrulamayı sıfırdan yazma, kanıtlanmışı kullan.
- Bu deponun kendisi zaten herkese açık. Algoritmanın gizliliğine dayanan
  bir tasarım burada ilk günden çöker.

Özel olan kısım **mimari**: aşağıdaki kurgunun sahip olduğu üç özellik çoğu
ticari panelde yok.

1. **Panelde parola diye bir şey yok.** Çalınacak, tahmin edilecek, başka
   sitede tekrar kullanılacak bir sır yok.
2. **Kimlik avı protokol gereği çalışmıyor.** Zayıf yedek giriş yolu (SMS,
   e-posta bağlantısı, TOTP) bilinçli olarak **yok**.
3. **Yönetici arayüzü internette yok.** Müşteri davetleri sahibin masaüstü
   panelinden üretiliyor, sunucuda yönetici girişi diye bir saldırı yüzeyi
   bulunmuyor.

---

## 2. Alınan kararlar

| Karar | Seçim | Gerekçe |
|---|---|---|
| Konum | `twinshareapp.com/web-sitem/panel/` | Kullanıcı kararı, 23 Eylül. Bedeli §9'da. |
| Giriş | Passkey (WebAuthn) + 256 bitlik davet anahtarı | Parolasız, kimlik avına dirençli |
| Veri | Sunucu okuyabilir | Arama ve bildirim çalışsın; uçtan uca şifreleme abartı |
| İlk adım | Bu belge | Kod öncesi mutabakat |

### Reddedilen seçenekler ve sebepleri

- **Kendi algoritması:** §1.
- **Klasik parola (Argon2id):** çalışırdı ve sıfır JavaScript kuralını hiç
  bozmazdı, ama parola kimlik avına açıktır ve güvenlik müşterinin parola
  alışkanlığına bağlı kalır.
- **OPAQUE (RFC 9807):** parolanın sunucuya hiç ulaşmadığı protokol. Olgun ve
  incelenmiş, ama hâlâ bir **parolaya** dayanıyor ve istemcide WASM istiyor.
  Passkey aynı bedeli ödeyip daha fazlasını veriyor: parola hiç yok.
- **SRP:** yeni iş için savunulabilir değil, OPAQUE aynı işi daha sağlam
  ispatla yapıyor.
- **JWT oturumu:** tek sunucuda tek avantajı (durumsuz ölçekleme) işe
  yaramaz, tek dezavantajı (bir oturumu anında sonlandıramamak) tam da
  ihtiyacımız olan şeyi elimizden alır.
- **SMS veya e-posta ile kurtarma:** 2026'nın en yaygın kimlik avı deseni
  passkey'i pas geçip zayıf yedeğe düşürmek. Yedek yoksa saldırı da yok.
- **Barındırılan servis (Clerk, WorkOS):** ölçeğimizde parasız çalışırdı ama
  statik siteye üçüncü taraf JavaScript ve dış origin sokar, müşteri verisi
  bir SaaS'a bağlanır.
- **Uçtan uca şifreleme:** sunucu çalınsa bile veri okunamazdı, ama arama ve
  bildirim ölür, kasa parolası kaybolursa veri kalıcı olarak gider.

---

## 3. Kimden koruyoruz

| Tehdit | Savunma |
|---|---|
| Parola tahmini, kaba kuvvet | Parola yok |
| Sızmış parola listeleri, tekrar kullanım | Parola yok |
| Kimlik avı (sahte giriş sayfası) | WebAuthn imzası alan adına bağlı |
| Yedek yola düşürme (downgrade) | Yedek yol yok |
| Davet anahtarının kaba kuvvetle bulunması | 256 bit entropi, süreli, tek kullanımlık |
| Sunucu veritabanının sızması | Anahtarların yalnızca karması saklanıyor |
| Oturum çerezi hırsızlığı | Kısa ömür, yenileme, çıkışta iptal, IP ve tarayıcı değişiminde uyarı |
| CSRF | `SameSite=Strict` **artı** işlem anahtarı |
| Hesap sayımı | Tüm akışlarda aynı cevap, aynı süre |
| Aynı ana bilgisayardaki başka uygulama | Kısmen. §9, bu kalan en büyük risk |

**Kapsam dışı:** sahibin kendisine karşı koruma (veriyi sunucuda okuyabiliyor,
bu bilinçli karar), devlet düzeyinde saldırgan, müşterinin cihazının ele
geçirilmesi.

---

## 4. Mimari

Bugün yayınlanan site tamamen statik: `dist/` içinde tek satır JavaScript yok,
sunucu yalnızca dosya servis ediyor. Giriş, tanımı gereği bir çalışma anı
ister. Eklenen tek yeni parça bu.

```
tarayıcı
   |
   +-- /web-sitem/...        -> statik dosyalar (bugünkü site, değişmiyor)
   |
   +-- /web-sitem/panel/...  -> ters vekil -> Node süreci -> SQLite
```

- **Statik site olduğu gibi kalıyor.** `astro.config.mjs` değişmiyor, sıfır
  JavaScript ve statik çıktı korunuyor. Navbar'daki hazır "Giriş Yap"
  düğmesine yalnızca `hedef` veriliyor.
- **Panel ayrı bir Astro yapılandırması:** `astro.config.panel.mjs`,
  `output: 'server'`, `@astrojs/node` (bağımlılık zaten kurulu),
  `base: '/web-sitem/panel'`. Çıktısı `dist-panel/`.
- **Rota elemesi ters vekilde yapılıyor, Astro'da değil.** Sunucu kipinde
  Astro sitenin bütün sayfalarını da servis etmeye kalkar; bu daha önce
  ölçülmüş bir tuzak (`astro.config.genel.mjs` içindeki not). Yalnızca
  `/web-sitem/panel/` öneki Node sürecine gider, gerisi diskten servis edilir.
- **Veritabanı: SQLite**, tek dosya. Birkaç müşteri için doğru ölçek; yedeği
  dosya kopyalamak.
- **Süreç yönetimi:** açılışta kendiliğinden başlayan, çöktüğünde geri gelen
  bir servis. Yalnızca yerel arayüzü dinliyor, internete doğrudan açık değil.

### Bağımlılıklar

| Paket | İş |
|---|---|
| `@simplewebauthn/server` | WebAuthn kayıt ve doğrulama, sunucu |
| `@simplewebauthn/browser` | Tarayıcı tarafı sarmalayıcı, ~10 KB |
| `@astrojs/node` | Zaten kurulu |
| SQLite sürücüsü | Tek dosya veritabanı |

Kriptografiyi kendimiz yazmıyoruz. Rastgelelik Node'un `crypto` modülünden,
imza doğrulaması SimpleWebAuthn'dan geliyor.

---

## 5. Akışlar

### 5.1 Davet üretimi (sahip, masaüstünde)

Bu adım **internete hiç açılmıyor**. Mevcut Electron panelinde yeni bir ekran:

1. Sahip müşteri adını yazar, "davet üret" der.
2. Yerelde 32 bayt (256 bit) rastgele üretilir. Bu **davet anahtarı**.
3. Anahtarın SHA-256 karması, müşteri kaydı ve son kullanma tarihiyle birlikte
   SSH üzerinden sunucuya yazılır. **Anahtarın kendisi sunucuya hiç gitmez.**
4. Sahip anahtarı müşteriye kendi tanıdığı kanaldan verir: telefonda okur,
   WhatsApp'tan yollar, elden verir.

Neden yüksek entropili anahtar için Argon2 kullanmıyoruz: 256 bit rastgelelik
zaten tahmin edilemez. Yavaş türetme, insanların seçtiği **düşük** entropili
parolaları korumak içindir. Burada SHA-256 yeterli ve doğru.

Anahtarın müşteriye gidiş biçimi iki türlü:

- **Elle yazılabilir:** Crockford base32, dörtlü gruplar, sonda kontrol
  karakteri. Telefonda okunabilir, karışan harfler (I, L, O, U) ayıklanmış.
- **Bağlantı olarak:** anahtar adres **çapasında** (`#` sonrası) taşınır.
  Çapa tarayıcıdan sunucuya gönderilmez, yani sunucu günlüklerine düşmez.

Varsayılan geçerlilik: 7 gün, tek kullanım.

### 5.2 İlk giriş ve cihaz kaydı (müşteri)

1. Müşteri panel adresine gider, davet anahtarını yapıştırır veya bağlantıya
   tıklar.
2. Sunucu anahtarın karmasını arar. Bulamazsa, süresi geçmişse veya
   kullanılmışsa: **aynı** mesaj, **aynı** süre, aynı HTTP kodu.
3. Geçerliyse kısa ömürlü (10 dakika) bir kayıt bileti verilir.
4. Tarayıcı `navigator.credentials.create()` çağırır. Cihaz bir anahtar çifti
   üretir: özel anahtar güvenli donanımdan **hiç çıkmaz**, sunucuya yalnızca
   açık anahtar gelir. Standart eğri P-256, yani 256 bit.
5. Sunucu kaydı doğrular ve saklar. Davet anahtarı kullanılmış işaretlenir.
6. Oturum açılır.

Ayarlar: `residentKey: required` (kullanıcı adı yazmadan giriş),
`userVerification: required` (parmak izi, yüz veya cihaz PIN'i),
`attestation: none` (cihaz modelini toplamıyoruz, gerekmiyor).

### 5.3 Normal giriş

1. Müşteri "Giriş yap" der.
2. Sunucu tek kullanımlık bir meydan okuma (challenge) üretir, saklar.
3. Tarayıcı `navigator.credentials.get()` çağırır, müşteri parmak izini
   okutur, cihaz imzalar.
4. Sunucu imzayı, meydan okumayı, alan adını ve imza sayacını doğrular.
5. Oturum açılır.

**Kimlik avı neden çalışmıyor:** imzanın içine tarayıcının kendi hesapladığı
alan adı giriyor. Sahte bir alan adındaki sayfa, müşteri ne kadar
kandırılırsa kandırılsın, gerçek panel için geçerli imza üretemez. Aktarılan
bir sır olmadığı için yakalanacak bir şey de yok.

**İmza sayacı:** cihaz her imzada artan bir sayaç tutar. Gelen sayaç
saklanandan küçük veya eşitse kopyalanmış kimlik bilgisi şüphesi var demektir;
o kimlik bilgisi askıya alınır ve sahibe bildirilir. (Not: senkronize
passkey'lerde sayaç sıfır kalabilir, o durumda kontrol atlanır.)

### 5.4 Çıkış ve oturum sonu

Çıkışta oturum kaydı **silinir**, çerez geçersiz kılınır. Sahip, masaüstü
panelinden bir müşterinin tüm oturumlarını anında sonlandırabilir. Opak
oturum kimliği seçmemizin asıl sebebi bu.

### 5.5 Cihaz kaybı ve kurtarma

Otomatik kurtarma **yok**. Müşteri sahibi arar, sahip kimliğinden emin olur ve
yeni bir davet anahtarı üretir. Eski kimlik bilgisi silinir.

Birkaç müşterisi olan, müşterilerini tanıyan bir işletmede en güvenli kurtarma
yolu budur: otomatik e-posta kurtarma, kurduğumuz her şeyi e-posta hesabının
güvenliğine indirger.

Öneri: her müşteri **iki cihaz** kaydetsin (telefon ve bilgisayar). O zaman
tek cihaz kaybı olay olmaktan çıkar.

---

## 6. Veri modeli

Yalnızca şekil; alan adları uygulamada kesinleşir.

**musteri**: kimlik, görünen ad, iletişim notu, durum (etkin, askıda),
oluşturulma.

**davet**: kimlik, müşteri, **anahtar karması** (ham anahtar değil), son
kullanma, kullanıldı mı, kullanıldığı an, üreten.

**kimlik_bilgisi** (passkey): kimlik, müşteri, credential id, açık anahtar,
imza sayacı, aktarım türü, cihaz takma adı, oluşturulma, son kullanım.

**oturum**: **kimlik karması** (ham kimlik değil), müşteri, oluşturulma, son
görülme, mutlak son kullanma, istemci izi (IP karması ve tarayıcı imzası).

**deneme**: zaman, tür (davet, giriş), hedef müşteri, IP karması, sonuç. Oran
sınırlama ve denetim izi bundan besleniyor.

Ham hiçbir sır veritabanında durmuyor: ne davet anahtarı, ne oturum kimliği.
Veritabanı sızsa bile bunlardan giriş yapılamaz.

---

## 7. Oturum ve çerez

```
__Secure-panel_oturum = <256 bit rastgele, base64url>
  Secure; HttpOnly; SameSite=Strict; Path=/web-sitem/panel/; Max-Age=...
```

- **Neden `__Host-` değil:** `__Host-` öneki çerezin `Path=/` olmasını şart
  koşuyor. O zaman çerez `twinshareapp.com`'un **her yoluna**, TwinShare
  uygulamasına da gönderilirdi. Panel kendi ana bilgisayarına alınırsa
  `__Host-` doğru seçim olur; aynı ana bilgisayarda `__Secure-` daha doğru.
- **`Path` bir güvenlik sınırı değildir.** Çerez spesifikasyonu bunu açıkça
  yazıyor. Burada derinlemesine savunmanın bir katmanı, tek başına dayanak
  değil. Asıl mesele §9.
- **Oturum kimliği girişte yenilenir.** Oturum sabitleme saldırısına karşı
  zorunlu kural.
- **Süreler:** 30 dakika hareketsizlik, 12 saat mutlak. İstemci izi (IP
  karması, tarayıcı imzası) değişirse oturum düşer.
- **`SameSite=Strict` bedeli:** dışarıdan gelen bir bağlantıyla panele ilk
  girişte çerez gönderilmez, sayfa "giriş yapılmamış" görünür ve tazelenince
  düzelir. Panel için kabul edilebilir.

### CSRF

`SameSite=Strict` tek başına yeterli değil; OWASP bunu birebir söylüyor.
Durum değiştiren her istekte ayrıca bir işlem anahtarı taşınır (oturuma bağlı,
formda gizli alan, sabit zamanlı karşılaştırma).

---

## 8. Zorunlu savunmalar

**Hesap sayımını engelleme.** Davet doğrulama, giriş ve tüm API cevapları aynı
mesajı, aynı HTTP kodunu ve **yaklaşık aynı süreyi** döndürür. Kayıt
bulunamadığında erken dönülmez; aynı işlem sahte bir değere karşı çalıştırılır.
Karşılaştırmalar sabit zamanlı.

**Oran sınırlama, iki ayrı sayaç.**

| Sayaç | Neye karşı | Eşik |
|---|---|---|
| Müşteri başına | Belirli kişiyi hedefleyen saldırı | 5 başarısız, sonra üstel gecikme (1s, 4s, 16s), 10'da 30 dakika kilit |
| IP ve ağ başına | Dağıtık deneme | Kayan pencerede sınır |

Yalnızca IP'ye bakmak yetmez, saldırgan IP değiştirir. Ters vekilde ucuz bir
ilk bariyer, asıl mantık uygulamada.

**Güvenlik başlıkları.** Katı içerik güvenlik politikası (`script-src 'self'`
ve nonce, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`),
`X-Content-Type-Options`, `Referrer-Policy`, HSTS.

**Günlük ve bildirim.** Her başarısız deneme, her yeni cihaz kaydı, her sayaç
uyuşmazlığı kaydedilir. Yeni cihaz kaydında sahibe bildirim.

**Yedekleme.** Veritabanı dosyasının günlük yedeği, sunucu dışında.

---

## 9. Bilinen risk: aynı ana bilgisayar

Panel `twinshareapp.com` üzerinde kalıyor ve alan adının kökünde TwinShare'in
kendi uygulaması çalışıyor. Tarayıcı gözünde **aynı origin**. Sonuçları:

1. **TwinShare tarafındaki bir betik açığı panel oturumunu ele geçirebilir.**
   `HttpOnly` çerezi okuyamaz ama tarayıcıda müşteri adına istek atabilir.
   `Path` bunu engellemez.
2. **WebAuthn alan adı paylaşılıyor.** Passkey `twinshareapp.com` için
   kaydedilir, yol bazında ayrılamaz. Aynı alan adındaki başka bir sayfa da
   aynı kimlik bilgisi için imza isteyebilir.
3. **İleride taşımanın bedeli var.** Panel başka bir alan adına (kendi alt
   alan adı veya `mustafaeybek.com`) taşınırsa, passkey'ler alan adına bağlı
   olduğu için **çalışmaz**: her müşterinin yeniden kayıt olması gerekir.
   Birkaç müşteriyle katlanılır, ama bilinerek girilmeli.

**Azaltma:** katı içerik güvenlik politikası, dar çerez yolu, kısa oturum
ömrü, istemci izi kontrolü ve sahibin oturumları anında sonlandırabilmesi.
Bunlar riski küçültür, sıfırlamaz.

**Sıfırlayan tek şey** paneli kendi ana bilgisayarına almak. Karar bugün aksi
yönde verildi; alan adı durumu değişirse bu madde yeniden açılmalı.

---

## 10. Sitede düzeltilmesi gereken metinler

Giriş yayına girdiğinde şu ifadeler yanlış olur:

- **`altbilgi.json` → `sifirJs`: "tarayıcıya inen JavaScript yok".** Bu ibare
  **bugün zaten yanlış**: tema, dil ve kaydırma için satır içi betikler var.
  Panelden bağımsız olarak düzeltilmeli.
- **Gizlilik sayfası: "tek bir çerez bile yazılmıyor".** Statik site için
  doğru kalır, panel için yanlış olur. Gizlilik metnine panel oturum çerezi
  eklenmeli: ne tutuyor, ne kadar duruyor, neden zorunlu.
- **Hizmetler sayfası, "256 bitlik anahtar" vaadi.** Bu tasarım vaadi birebir
  karşılıyor, metin doğru kalıyor. Değiştirilmesi gerekmiyor.

---

## 11. Sıra

| # | İş | Bağımlılık |
|---|---|---|
| 0 | Sunucu bilgilerinin depodan çıkarılması, erişim anahtarının döndürülmesi | Müşteri verisi tutmadan **önce** |
| 1 | `astro.config.panel.mjs`, boş panel iskeleti, yerelde çalışır durumda | |
| 2 | Veritabanı şeması ve göç düzeneği | 1 |
| 3 | Davet üretimi: masaüstü paneline ekran, SSH ile yazma | 2 |
| 4 | Davet doğrulama ve passkey kaydı | 3 |
| 5 | Giriş, oturum, çıkış | 4 |
| 6 | Oran sınırlama, günlükleme, güvenlik başlıkları | 5 |
| 7 | Sunucu kurulumu: ters vekil bloğu, servis tanımı, yedek | 6 |
| 8 | Navbar düğmesine hedef, metin düzeltmeleri | 7 |
| 9 | Panelin içi: destek talepleri | ayrı aşama |

0 numaralı madde ayrı bir karar bekliyor: çalışma ağacından silmek kolay,
geçmişten silmek herkese açık bir depoda yıkıcı bir iştir ve tek başıma
yapmam.

---

## 12. Açık sorular

1. **Müşteri sayısı ve ne tutacağız?** Destek talebi metinleri dışında
   dosya, fatura, kişisel veri girecek mi? Girerse gizlilik metni ve saklama
   süresi buna göre yazılmalı.
2. **Davet anahtarı hangi kanaldan gidecek?** WhatsApp pratik ama mesajı
   WhatsApp görür. Tek kullanımlık ve süreli olduğu için kabul edilebilir;
   yine de telefonda okumak en sağlamı.
3. **Sahip panele nasıl bakacak?** Müşterinin gördüğü panelden mi, yoksa
   masaüstü uygulamasından SSH ile mi? İkincisi internetteki saldırı yüzeyini
   sıfırda tutar.
4. **Oturum süreleri** (30 dakika hareketsizlik, 12 saat mutlak) iş akışına
   uyuyor mu?

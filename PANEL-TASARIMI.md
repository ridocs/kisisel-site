# Müşteri paneli: kimlik doğrulama tasarımı

**Durum:** onaylandı, uygulanıyor.
**Tarih:** 23 Eylül 2026.
**Kapsam:** iki ayrı program. Müşterinin gördüğü **web paneli** (giriş ve
destek talepleri) ve sahibin kullandığı **masaüstü uygulaması** (müşteri,
iş ve istatistik yönetimi). İkisi de bu belgede.

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
| Müşterinin gördüğü | Yalnızca destek talepleri ve kendi işlerinin özeti | Kullanıcı kararı |
| Sahibin arayüzü | **Ayrı** bir masaüstü uygulaması | Kullanıcı kararı; internette yönetici arayüzü yok |
| Kimlik ve mali veri | Sunucuya **hiç gitmiyor**, yalnızca yerelde | §4, veri asgariliği |
| Hareketsizlik süresi | 1 saat | Kullanıcı kararı |

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

### İki program, iki veritabanı

```
   SAHİBİN BİLGİSAYARI                    SUNUCU
   ────────────────────                   ──────
   Masaüstü uygulaması                    Node süreci
   (Electron, ayrı program)               (ters vekil arkasında)
        |                                      |
   yerel.db  ◄──── SSH ile eşitleme ────►  panel.db
   tam müşteri kartı                      asgari veri
   TC, vergi no, adres                    görünen ad
   iş tutarları, ödemeler                 işin müşteriye görünen özeti
   istatistikler                          passkey, oturum, destek talepleri
```

**Asıl defter yerelde.** Sahibin bilgisayarındaki veritabanı gerçeğin
kaynağı. Sunucudaki veritabanı onun **kısıtlı bir kopyası**: yalnızca
müşterinin panelde görmesi gereken şeyler.

Sunucuya hiç gitmeyenler: **TC kimlik numarası, vergi numarası, açık adres,
iş tutarları, ödeme durumu, ön ödeme oranları, revize ücretleri ve bütün
istatistikler.** Sunucu ele geçse bile bu bilgilerin hiçbiri orada değil.

Eşitleme SSH üzerinden ve tek yönlü ağırlıklı:

- **Yerelden sunucuya:** müşteri kaydı (yalnızca görünen ad), davet anahtarı
  karması, işin müşteriye gösterilecek özeti ve durumu.
- **Sunucudan yerele:** müşterinin açtığı destek talepleri.

Sunucu hiçbir zaman yerel veritabanına yazamaz; yerel uygulama çeker. Yani
ele geçirilmiş bir sunucu sahibin defterini bozamaz.

### Web tarafı

```
tarayıcı
   |
   +-- /web-sitem/...        -> statik dosyalar (bugünkü site, değişmiyor)
   |
   +-- /web-sitem/panel/...  -> ters vekil -> Node süreci -> panel.db
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

Yalnızca şekil; alan adları uygulamada kesinleşir. İki veritabanı ayrı
tutuluyor, §4.

### 6.1 Yerel veritabanı (sahibin bilgisayarı)

**musteri**: kimlik, ad soyad, telefon, adres (ilçe ve şehir), **vergi
numarası**, **TC kimlik numarası**, not, durum, oluşturulma.

**is**: kimlik, müşteri, iş adı, özet, durum (teklif, ön ödeme alındı,
sürüyor, teslim edildi, kapandı, iptal), toplam tutar, ön ödeme oranı, ön
ödeme tutarı, tahsil edilen, kalan, para birimi, başlangıç, teslim, tekrar
eden mi, oluşturulma.

**odeme**: kimlik, iş, tür (ön ödeme, ara ödeme, son ödeme), tutar, tarih,
yöntem, not.

**revize**: kimlik, iş, başlık, açıklama, tutar, tarih, ücretli mi.

**talep_kopyasi**: sunucudan çekilen destek taleplerinin yerel kopyası.

### 6.2 Sunucu veritabanı (panel)

**musteri**: kimlik, **yalnızca görünen ad**, durum, oluşturulma. Telefon,
adres, TC ve vergi numarası **yok**.

**is_ozeti**: kimlik, müşteri, iş adı, müşteriye gösterilecek durum,
güncellenme. **Tutar ve ödeme bilgisi yok.**

**davet**: kimlik, müşteri, **anahtar karması** (ham anahtar değil), son
kullanma, kullanıldı mı, kullanıldığı an.

**kimlik_bilgisi** (passkey): kimlik, müşteri, credential id, açık anahtar,
imza sayacı, aktarım türü, cihaz takma adı, oluşturulma, son kullanım.

**oturum**: **kimlik karması** (ham kimlik değil), müşteri, oluşturulma, son
görülme, mutlak son kullanma, istemci izi (IP karması ve tarayıcı imzası).

**talep**: kimlik, müşteri, iş (isteğe bağlı), başlık, durum, öncelik,
oluşturulma, son güncelleme.

**talep_mesaji**: kimlik, talep, yazan (müşteri veya sahip), metin, zaman.

**deneme**: zaman, tür (davet, giriş), hedef müşteri, IP karması, sonuç. Oran
sınırlama ve denetim izi bundan besleniyor.

Ham hiçbir sır veritabanında durmuyor: ne davet anahtarı, ne oturum kimliği.
Veritabanı sızsa bile bunlardan giriş yapılamaz.

### 6.3 İstatistikler

Hepsi **yerelde** hesaplanıyor, sunucunun bu sayılardan haberi yok: müşteri
sayısı, açık destek talebi sayısı, aylık yapılan ön ödeme tutarı, aylık
toplam alınacak ödeme, aylık kalan ödeme, ağırlıkta yapılan işler (tür
dağılımı) ve tekrar eden işler.

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
- **Süreler:** 1 saat hareketsizlik, 12 saat mutlak. İstemci izi (IP karması,
  tarayıcı imzası) değişirse oturum düşer.
- **`SameSite=Strict` bedeli:** dışarıdan gelen bir bağlantıyla panele ilk
  girişte çerez gönderilmez, sayfa "giriş yapılmamış" görünür ve tazelenince
  düzelir. Panel için kabul edilebilir.

### CSRF

`SameSite=Strict` tek başına yeterli değil; OWASP bunu birebir söylüyor.
Durum değiştiren her istekte ayrıca bir işlem anahtarı taşınır (oturuma bağlı,
formda gizli alan, sabit zamanlı karşılaştırma).

### Canlı akış oturumu UZATMIYOR

Yazışma sayfası `/api/talepler/akis` uç noktasına bağlanıyor ve o istek
saatlerce açık kalıyor. Ara katman **bu tek yolda** `oturumTazele`
çağırmıyor. Sebep: sayacı orada sıfırlamak, açık duran bir sekmenin oturumu
süresiz uzatması demekti ve yukarıdaki bir saatlik hareketsizlik kuralı
fiilen kalkardı.

Sonuç ölçüldü: akış isteği `son_gorulme` damgasına dokunmuyor, sıradan bir
sayfa isteği tazeliyor. Akışın kendi ömrü de hareketsizlik süresiyle aynı
(bir saat); dolunca sunucu bağlantıyı kapatıyor. Oturum gerçekten canlıysa
tarayıcı yeniden bağlanıyor, değilse akış nabız sıklığında yapılan
denetimde kapanıyor.

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

| # | İş | Durum |
|---|---|---|
| 0 | Sunucu bilgilerinin depodan çıkarılması, erişim anahtarının döndürülmesi | **Bekliyor**, karar kullanıcıda |
| 1 | İki veritabanının şeması ve göç düzeneği | Bitti |
| 2 | Masaüstü uygulaması: müşteri, iş, ödeme, revize, istatistikler | Bitti |
| 3 | Davet üretimi: masaüstünde üret, karmasını kuyruğa yaz | Bitti |
| 4 | Web paneli: `astro.config.panel.mjs`, iskelet | Bitti |
| 5 | Davet doğrulama ve passkey kaydı | Bitti, tarayıcı tarafı elle denenmedi |
| 6 | Giriş, oturum, çıkış | Bitti, tarayıcı tarafı elle denenmedi |
| 7 | Destek talepleri: panelde açma ve yazışma | Bitti |
| 8 | Oran sınırlama, günlükleme, güvenlik başlıkları | Bitti |
| 9 | Eşitlemenin SSH tarafı: paketi gönder, talepleri çek | Bitti, gerçek sunucuya karşı denenmedi |
| 10 | Sunucu kurulumu: ters vekil bloğu, servis tanımı | **Yayında**, 23 Eylül |
| 11 | Navbar düğmesine hedef | Bitti, yayında |
| 12 | §10'daki metin düzeltmeleri | **Yapılmadı**, artık gerçekten yanlışlar |
| 13 | Yedekleme düzeni | **Yapılmadı** |

### Yayına alınırken ölçülerek öğrenilenler

- **Sunucudaki Node sürümü panelin istediğinden eskiydi.** Sistem Node'una
  dokunulmadı, çünkü aynı makinede başka servisler ona bağlı; panel için
  ayrı bir dizine kendi Node'u kuruldu ve servis tanımı onu tam yolla
  çağırıyor. Sunucuda zaten aynı desenle kurulmuş başka bir Node vardı.
- **`MemoryDenyWriteExecute=yes` Node'u çökertiyor.** V8'in JIT'i yazılabilir
  ve çalıştırılabilir bellek istiyor; servis açılışta `V8_Fatal` veriyordu.
  Sertleştirmenin geri kalanı duruyor, yalnızca bu kapalı.
- **Astro'nun node çıktısı bağımlılıkları paketlemiyor.** Sunucuda önce
  `@oslojs/encoding`, sonra `zod` eksik çıktı. Tek tek saymak yerine
  `vite.ssr.noExternal = true` ile hepsi çıktıya gömüldü; sunucuda ne
  `package.json` ne `node_modules` var.
- **Üretim provası depo dışında yapılmalı.** İlk prova çıktıyı yerinde
  çalıştırıyor ve depodaki `node_modules` klasörünü buluyordu, yani sunucu
  koşulunu taklit etmiyordu: prova "çalışıyor" derken servis çöküyordu.
- **nginx'te alt bloktaki tek bir `add_header` üsttekilerin hepsini iptal
  ediyor.** Sunucu bloğunda CSP dahil sekiz başlık vardı; panel kendi CSP'sini
  gönderdiği için ikisi çakışıp tarayıcıda kesişim olarak uygulanacaktı.
  Panel bloğuna `X-Robots-Tag` konarak üsttekiler bilinçli olarak iptal edildi.
- **Cloudflare siteye kendi betiğini enjekte ediyor** (e-posta gizleme).
  Sunucudaki dosyada tek satır JavaScript yok ama tarayıcıya iki tane
  `email-decode.min.js` iniyor. Panelde enjeksiyon yok.

### Gerçek cihazla denenmesi gerekenler

Sunucu tarafı test edildi, ama passkey'in kendisi ancak gerçek bir cihazla
denenir. Elle bakılacaklar: davet anahtarıyla ilk kayıt ve parmak izi istemi,
kullanıcı adı yazmadan giriş, aynı cihazı ikinci kez kaydetme denemesi, iki
ayrı cihaz kaydı, `#anahtar` çapalı bağlantıyla gelme, ve içerik güvenlik
politikası altında tarayıcı konsolunun temiz kalması.

0 numaralı madde ayrı bir karar bekliyor: çalışma ağacından silmek kolay,
geçmişten silmek herkese açık bir depoda yıkıcı bir iştir ve tek başıma
yapmam.

---

## 12. Kararlaşanlar ve kalan sorular

23 Eylül'de cevaplandı:

- Panelde **yalnızca destek talepleri** olacak.
- Sahip **ayrı bir masaüstü uygulamasından** yönetecek.
- Oturum hareketsizliği **1 saat**.
- Müşteri, iş ve istatistik alanları PDF'te verildi, §6'ya işlendi.

Kalan sorular:

1. **Davet anahtarı hangi kanaldan gidecek?** WhatsApp pratik ama mesajı
   WhatsApp da görür. Tek kullanımlık ve süreli olduğu için kabul edilebilir;
   yine de telefonda okumak en sağlamı. Uygulama ikisini de destekleyecek.
2. **Müşteri kendi iş özetini görsün mü?** Sitenin vaadi "destek taleplerinizi
   **ve aldığınız hizmetleri** takip edebilirsiniz" diyor. Tutar olmadan,
   yalnızca iş adı ve durum gösterilecek biçimde tasarlandı. İstenmezse bu
   tablo sunucuya hiç gönderilmez.
3. **Yasal metinler.** TC ve vergi numarası yalnızca yerelde tutulsa bile
   toplanıyor. Gizlilik metninin bunu ve saklama süresini yazması gerekiyor.

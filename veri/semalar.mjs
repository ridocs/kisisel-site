/*
  Şemalar BURADA, ayrı .sql dosyalarında değil.

  Sebebi ölçülerek bulundu: db.mjs şemayı diskten okuyordu ve bu geliştirme
  sunucusunda sorunsuz çalışıyordu. Üretim derlemesinde ise paketleyici
  modülü bir chunk'a taşıyor, yanındaki .sql dosyasını taşımıyor: panel ilk
  istekte ENOENT alıp 500 veriyordu. Geliştirmede görünmeyen, yalnızca
  derlenmiş çıktıda ortaya çıkan bir hataydı.

  Dize olarak tutulan şemayı paketleyici modülün içinde taşımak zorunda.
  Aynı sebeple sunucuya kopyalanacak dosya listesi de kısaldı: eşitleme
  betiklerinin yanına ayrıca bir .sql koymak gerekmiyor.
*/

/** Sahibin bilgisayarındaki asıl defter. */
export const SEMA_YEREL = `
-- Yerel defter: sahibin bilgisayarında duran asıl veritabanı.
-- Buradaki hiçbir tablo sunucuya olduğu gibi gitmiyor; sunucuya yalnızca
-- veri/esitleme.mjs içinde açıkça seçilen alanlar çıkıyor (PANEL-TASARIMI.md §4).
--
-- TC kimlik ve vergi numarası düz metin DEĞİL: işletim sisteminin anahtarlığı
-- (Electron safeStorage, Windows'ta DPAPI) ile şifrelenmiş BLOB olarak duruyor.
-- Veritabanı dosyası kopyalansa bile o iki alan başka makinede açılmaz.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS musteri (
	id            TEXT PRIMARY KEY,
	ad_soyad      TEXT NOT NULL,
	telefon       TEXT,
	ilce          TEXT,
	sehir         TEXT,
	vergi_sifreli BLOB,
	tc_sifreli    BLOB,
	not_metni     TEXT,
	durum         TEXT NOT NULL DEFAULT 'etkin'
	              CHECK (durum IN ('etkin', 'askida', 'arsiv')),
	olusturuldu   TEXT NOT NULL,
	guncellendi   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS musteri_durum ON musteri (durum, ad_soyad);

CREATE TABLE IF NOT EXISTS is_kaydi (
	id              TEXT PRIMARY KEY,
	musteri_id      TEXT NOT NULL REFERENCES musteri (id) ON DELETE CASCADE,
	ad              TEXT NOT NULL,
	ozet            TEXT,
	tur             TEXT,
	durum           TEXT NOT NULL DEFAULT 'teklif'
	                CHECK (durum IN ('teklif', 'on_odeme_alindi', 'suruyor',
	                                 'teslim_edildi', 'kapandi', 'iptal')),
	-- Tutarlar kuruş cinsinden TAM SAYI. Ondalık sayı para tutmaz:
	-- 0.1 + 0.2 ikilik tabanda 0.3 etmiyor, bu hata faturaya yansır.
	tutar_kurus     INTEGER NOT NULL DEFAULT 0,
	on_odeme_orani  INTEGER CHECK (on_odeme_orani BETWEEN 0 AND 100),
	para_birimi     TEXT NOT NULL DEFAULT 'TRY',
	tekrar_eden     INTEGER NOT NULL DEFAULT 0 CHECK (tekrar_eden IN (0, 1)),
	baslangic       TEXT,
	teslim          TEXT,
	olusturuldu     TEXT NOT NULL,
	guncellendi     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS is_musteri ON is_kaydi (musteri_id, durum);
CREATE INDEX IF NOT EXISTS is_durum ON is_kaydi (durum, guncellendi);

CREATE TABLE IF NOT EXISTS odeme (
	id          TEXT PRIMARY KEY,
	is_id       TEXT NOT NULL REFERENCES is_kaydi (id) ON DELETE CASCADE,
	tur         TEXT NOT NULL CHECK (tur IN ('on_odeme', 'ara_odeme', 'son_odeme', 'iade')),
	tutar_kurus INTEGER NOT NULL,
	tarih       TEXT NOT NULL,
	yontem      TEXT,
	not_metni   TEXT,
	olusturuldu TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS odeme_is ON odeme (is_id, tarih);
CREATE INDEX IF NOT EXISTS odeme_tarih ON odeme (tarih);

CREATE TABLE IF NOT EXISTS revize (
	id          TEXT PRIMARY KEY,
	is_id       TEXT NOT NULL REFERENCES is_kaydi (id) ON DELETE CASCADE,
	baslik      TEXT NOT NULL,
	aciklama    TEXT,
	tutar_kurus INTEGER NOT NULL DEFAULT 0,
	ucretli     INTEGER NOT NULL DEFAULT 1 CHECK (ucretli IN (0, 1)),
	tarih       TEXT NOT NULL,
	olusturuldu TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS revize_is ON revize (is_id, tarih);

-- Sunucudan çekilen destek taleplerinin yerel kopyası. Sahip çevrimdışıyken de
-- geçmişi görebilsin diye. Gerçeğin kaynağı sunucudaki tablo.
CREATE TABLE IF NOT EXISTS talep_kopyasi (
	id            TEXT PRIMARY KEY,
	musteri_id    TEXT REFERENCES musteri (id) ON DELETE SET NULL,
	is_id         TEXT REFERENCES is_kaydi (id) ON DELETE SET NULL,
	baslik        TEXT NOT NULL,
	durum         TEXT NOT NULL,
	oncelik       TEXT,
	olusturuldu   TEXT NOT NULL,
	guncellendi   TEXT NOT NULL,
	cekildi       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS talep_mesaj_kopyasi (
	id          TEXT PRIMARY KEY,
	talep_id    TEXT NOT NULL REFERENCES talep_kopyasi (id) ON DELETE CASCADE,
	yazan       TEXT NOT NULL CHECK (yazan IN ('musteri', 'sahip')),
	metin       TEXT NOT NULL,
	zaman       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS talep_mesaj_talep ON talep_mesaj_kopyasi (talep_id, zaman);

-- Sunucuya gönderilmeyi bekleyen değişiklikler. Eşitleme çevrimdışı çalışsın
-- ve yarım kalan bir gönderim iki kez uygulanmasın diye.
CREATE TABLE IF NOT EXISTS esitleme_kuyrugu (
	id          INTEGER PRIMARY KEY AUTOINCREMENT,
	islem       TEXT NOT NULL,
	govde       TEXT NOT NULL,
	olusturuldu TEXT NOT NULL,
	gonderildi  TEXT
);

CREATE INDEX IF NOT EXISTS kuyruk_bekleyen ON esitleme_kuyrugu (gonderildi, id);

CREATE TABLE IF NOT EXISTS ayar (
	anahtar TEXT PRIMARY KEY,
	deger   TEXT NOT NULL
);
`;

/** Sunucudaki kısıtlı kopya. */
export const SEMA_PANEL = `
-- Sunucudaki panel veritabanı: yerel defterin KISITLI kopyası.
--
-- Burada bilinçli olarak OLMAYANLAR (PANEL-TASARIMI.md §4):
-- TC kimlik numarası, vergi numarası, açık adres, telefon, iş tutarları,
-- ödeme durumu, ön ödeme oranı, revize ücretleri, istatistikler.
-- Sunucu ele geçse bile bunların hiçbiri orada değil.
--
-- Ham hiçbir sır saklanmıyor: davet anahtarı da oturum kimliği de yalnızca
-- SHA-256 karmasıyla duruyor. Veritabanı sızsa bile bunlardan giriş yapılamaz.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS musteri (
	id          TEXT PRIMARY KEY,
	gorunen_ad  TEXT NOT NULL,
	durum       TEXT NOT NULL DEFAULT 'etkin'
	            CHECK (durum IN ('etkin', 'askida')),
	olusturuldu TEXT NOT NULL,
	guncellendi TEXT NOT NULL
);

-- Müşterinin panelde gördüğü iş listesi. Tutar ve ödeme bilgisi YOK.
CREATE TABLE IF NOT EXISTS is_ozeti (
	id          TEXT PRIMARY KEY,
	musteri_id  TEXT NOT NULL REFERENCES musteri (id) ON DELETE CASCADE,
	ad          TEXT NOT NULL,
	durum       TEXT NOT NULL,
	guncellendi TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS is_ozeti_musteri ON is_ozeti (musteri_id, guncellendi);

-- 256 bitlik tek kullanımlık davet. Anahtarın kendisi buraya HİÇ gelmiyor;
-- sahibin bilgisayarında üretiliyor, sunucuya yalnızca karması yazılıyor.
CREATE TABLE IF NOT EXISTS davet (
	id             TEXT PRIMARY KEY,
	musteri_id     TEXT NOT NULL REFERENCES musteri (id) ON DELETE CASCADE,
	anahtar_karmasi BLOB NOT NULL UNIQUE,
	son_kullanma   TEXT NOT NULL,
	kullanildi     TEXT,
	olusturuldu    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS davet_musteri ON davet (musteri_id, kullanildi);

-- WebAuthn kimlik bilgisi (passkey). Özel anahtar müşterinin cihazında,
-- buraya yalnızca açık anahtar geliyor.
CREATE TABLE IF NOT EXISTS kimlik_bilgisi (
	id            TEXT PRIMARY KEY,
	musteri_id    TEXT NOT NULL REFERENCES musteri (id) ON DELETE CASCADE,
	credential_id BLOB NOT NULL UNIQUE,
	acik_anahtar  BLOB NOT NULL,
	sayac         INTEGER NOT NULL DEFAULT 0,
	aktarim       TEXT,
	cihaz_adi     TEXT,
	yedekli       INTEGER NOT NULL DEFAULT 0 CHECK (yedekli IN (0, 1)),
	olusturuldu   TEXT NOT NULL,
	son_kullanim  TEXT,
	askiya_alindi TEXT
);

CREATE INDEX IF NOT EXISTS kimlik_musteri ON kimlik_bilgisi (musteri_id);

-- Tek kullanımlık WebAuthn meydan okumaları. Tekrar saldırısını bu tablo keser.
CREATE TABLE IF NOT EXISTS meydan_okuma (
	id           TEXT PRIMARY KEY,
	deger        BLOB NOT NULL,
	amac         TEXT NOT NULL CHECK (amac IN ('kayit', 'giris')),
	musteri_id   TEXT REFERENCES musteri (id) ON DELETE CASCADE,
	davet_id     TEXT REFERENCES davet (id) ON DELETE CASCADE,
	son_kullanma TEXT NOT NULL,
	tuketildi    TEXT,
	olusturuldu  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS meydan_son ON meydan_okuma (son_kullanma);

-- Oturum. Ham kimlik değil, karması saklanıyor.
CREATE TABLE IF NOT EXISTS oturum (
	kimlik_karmasi BLOB PRIMARY KEY,
	musteri_id     TEXT NOT NULL REFERENCES musteri (id) ON DELETE CASCADE,
	ip_karmasi     BLOB,
	istemci_izi    BLOB,
	olusturuldu    TEXT NOT NULL,
	son_gorulme    TEXT NOT NULL,
	mutlak_son     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS oturum_musteri ON oturum (musteri_id);
CREATE INDEX IF NOT EXISTS oturum_son ON oturum (mutlak_son);

CREATE TABLE IF NOT EXISTS talep (
	id          TEXT PRIMARY KEY,
	musteri_id  TEXT NOT NULL REFERENCES musteri (id) ON DELETE CASCADE,
	is_id       TEXT REFERENCES is_ozeti (id) ON DELETE SET NULL,
	baslik      TEXT NOT NULL,
	durum       TEXT NOT NULL DEFAULT 'acik'
	            CHECK (durum IN ('acik', 'yanitlandi', 'beklemede', 'kapandi')),
	oncelik     TEXT NOT NULL DEFAULT 'normal'
	            CHECK (oncelik IN ('dusuk', 'normal', 'yuksek')),
	olusturuldu TEXT NOT NULL,
	guncellendi TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS talep_musteri ON talep (musteri_id, guncellendi);
CREATE INDEX IF NOT EXISTS talep_durum ON talep (durum, guncellendi);

CREATE TABLE IF NOT EXISTS talep_mesaji (
	id       TEXT PRIMARY KEY,
	talep_id TEXT NOT NULL REFERENCES talep (id) ON DELETE CASCADE,
	yazan    TEXT NOT NULL CHECK (yazan IN ('musteri', 'sahip')),
	metin    TEXT NOT NULL,
	zaman    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS mesaj_talep ON talep_mesaji (talep_id, zaman);

-- Oran sınırlama ve denetim izi. IP düz metin değil, karma olarak tutuluyor:
-- sitenin istatistik tarafı da aynı şeyi yapıyor.
CREATE TABLE IF NOT EXISTS deneme (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	zaman      TEXT NOT NULL,
	tur        TEXT NOT NULL CHECK (tur IN ('davet', 'giris', 'kayit')),
	musteri_id TEXT,
	ip_karmasi BLOB,
	sonuc      TEXT NOT NULL CHECK (sonuc IN ('basarili', 'basarisiz', 'kilitli'))
);

CREATE INDEX IF NOT EXISTS deneme_musteri ON deneme (musteri_id, zaman);
CREATE INDEX IF NOT EXISTS deneme_ip ON deneme (ip_karmasi, zaman);
CREATE INDEX IF NOT EXISTS deneme_zaman ON deneme (zaman);
`;

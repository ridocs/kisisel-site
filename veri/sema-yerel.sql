-- Yerel defter: sahibin bilgisayarında duran asıl veritabanı.
-- Buradaki hiçbir tablo sunucuya olduğu gibi gitmiyor; sunucuya yalnızca
-- `veri/esitleme.mjs` içinde açıkça seçilen alanlar çıkıyor (PANEL-TASARIMI.md §4).
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

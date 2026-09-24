/*
  Göçler: ZATEN VAR OLAN veritabanlarını yeni şemaya taşır.

  Şema dosyası yeni kurulumu kuruyor ve baştan sona `IF NOT EXISTS` ile
  yazıldığı için yeni TABLOLAR kendiliğinden geliyor. Kendiliğinden gelmeyen
  tek şey var olan bir tabloya SÜTUN eklemek; SQLite'ta bu `ALTER TABLE`
  ister ve onu da `IF NOT EXISTS` ile yazmak mümkün değil.

  Sunucuda ve sahibin bilgisayarında dolu veritabanları var, yani bu dosya
  gerçek veriyle çalışıyor.

  SIRA DEĞİŞTİRİLMEZ ve yayınlanmış bir göç DÜZENLENMEZ: zaten göç etmiş bir
  veritabanı o adımı bir daha çalıştırmaz, değiştirilirse iki kurulum sessizce
  ayrı düşer. Yeni adım hep sona eklenir.
*/

/** Bir sütun gerçekten var mı: ALTER TABLE iki kez çalışmasın diye. */
function sutunVar(db, tablo, sutun) {
	return db
		.prepare(`PRAGMA table_info(${tablo})`)
		.all()
		.some((s) => s.name === sutun);
}

function sutunEkle(db, tablo, sutun, tanim) {
	if (sutunVar(db, tablo, sutun)) return;
	db.exec(`ALTER TABLE ${tablo} ADD COLUMN ${sutun} ${tanim}`);
}

/** Bir tablo var mı: göç, tablo hiç yokken de çalışabilmeli. */
function tabloVar(db, tablo) {
	return Boolean(
		db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tablo),
	);
}

export const PANEL_GOCLERI = [
	/*
	  1) Ödeme dökümü ve hedef teslim tarihi (24 Eylül 2026).

	  Müşteri kendi ödeme dökümünü panelde görecek, bu yüzden iş özetine tutar
	  ve para birimi eklendi. Varsayılan sıfır: göçten sonra eşitleme gerçek
	  tutarları getirene kadar panelde 0 görünüyor, yanlış bir rakam değil.
	*/
	(db) => {
		if (!tabloVar(db, 'is_ozeti')) return;
		sutunEkle(db, 'is_ozeti', 'ozet', 'TEXT');
		sutunEkle(db, 'is_ozeti', 'tutar_kurus', "INTEGER NOT NULL DEFAULT 0");
		sutunEkle(db, 'is_ozeti', 'para_birimi', "TEXT NOT NULL DEFAULT 'TRY'");
		sutunEkle(db, 'is_ozeti', 'teslim_hedefi', 'TEXT');
	},
];

export const YEREL_GOCLERI = [
	/*
	  1) Yerelde şu an eklenecek sütun yok: ilerleme aşamaları, dosyalar ve iş
	     yazışması yeni TABLOLAR olarak geldi, onları şema kendisi kuruyor.
	     Yine de listeyi boş bırakmıyoruz ki sürüm numarası iki taraf için de
	     ilerlesin ve ileride eklenecek adımın yeri belli olsun.
	*/
	() => {},
];

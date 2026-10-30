/*
  Destek talepleri ve iş listesi.

  BU DOSYANIN TEK KURALI: her sorguda müşteri kimliği süzgeci, istisnasız.
  Talep kimliği tahmin edilemez olsa bile "kimliği bilen görür" bir yetki
  modeli değildir. `talepGetir` bile `WHERE id = ? AND musteri_id = ?`
  yazıyor; testi de bunu doğruluyor.

  `is_ozeti` tablosunda tutar sütunu YOK ve buradan da hiçbir mali alan
  okunmuyor (§4, §6.2).
*/

import { yeniKimlik } from '../../../veri/kimlik.mjs';

export const BASLIK_EN_AZ = 3;
export const BASLIK_EN_COK = 120;
export const METIN_EN_AZ = 2;
export const METIN_EN_COK = 4000;

/** Müşterinin panelde gördüğü iş durumları. Bilinmeyen değer olduğu gibi gösteriliyor. */
const IS_DURUMLARI = {
	teklif: 'Teklif aşamasında',
	on_odeme_alindi: 'Başlamaya hazır',
	suruyor: 'Sürüyor',
	teslim_edildi: 'Teslim edildi',
	kapandi: 'Tamamlandı',
	iptal: 'İptal edildi',
};

const TALEP_DURUMLARI = {
	acik: 'Açık',
	yanitlandi: 'Yanıtlandı',
	beklemede: 'Beklemede',
	kapandi: 'Kapandı',
};

export function isDurumEtiketi(durum) {
	return IS_DURUMLARI[durum] ?? durum;
}

export function talepDurumEtiketi(durum) {
	return TALEP_DURUMLARI[durum] ?? durum;
}

/** Müşterinin işleri: yalnızca ad ve durum. Tutar YOK. */
export function isleriListele(db, musteriId) {
	return db
		.prepare(
			'SELECT id, ad, durum, guncellendi FROM is_ozeti WHERE musteri_id = ? ORDER BY guncellendi DESC',
		)
		.all(musteriId);
}

export function talepleriListele(db, musteriId) {
	return db
		.prepare(
			`SELECT t.id, t.baslik, t.durum, t.oncelik, t.olusturuldu, t.guncellendi,
			        i.ad AS is_adi,
			        (SELECT COUNT(*) FROM talep_mesaji m WHERE m.talep_id = t.id) AS mesaj_sayisi
			 FROM talep t LEFT JOIN is_ozeti i ON i.id = t.is_id
			 WHERE t.musteri_id = ?
			 ORDER BY t.guncellendi DESC`,
		)
		.all(musteriId);
}

export function acikTalepSayisi(db, musteriId) {
	return (
		db
			.prepare("SELECT COUNT(*) AS sayi FROM talep WHERE musteri_id = ? AND durum <> 'kapandi'")
			.get(musteriId)?.sayi ?? 0
	);
}

/**
 * Tek talep. Müşteri süzgeci olmadan bu işlev ÇAĞRILAMAZ; imzası buna izin
 * vermiyor ve sorgu iki koşulu birden istiyor.
 */
export function talepGetir(db, musteriId, talepId) {
	const talep = db
		.prepare(
			`SELECT t.*, i.ad AS is_adi
			 FROM talep t LEFT JOIN is_ozeti i ON i.id = t.is_id
			 WHERE t.id = ? AND t.musteri_id = ?`,
		)
		.get(talepId, musteriId);
	if (!talep) return null;
	const mesajlar = db
		.prepare('SELECT id, yazan, metin, zaman FROM talep_mesaji WHERE talep_id = ? ORDER BY zaman')
		.all(talepId);
	return { ...talep, mesajlar };
}

function kirp(deger) {
	return typeof deger === 'string' ? deger.trim().replace(/\r\n/g, '\n') : '';
}

/** Girdi denetimi. Hata mesajları kullanıcıya doğrudan gösteriliyor. */
export function talepGirdisiniDenetle({ baslik, metin }) {
	const b = kirp(baslik);
	const m = kirp(metin);
	if (b.length < BASLIK_EN_AZ) return { tamam: false, hata: 'Başlık en az üç karakter olmalı.' };
	if (b.length > BASLIK_EN_COK) return { tamam: false, hata: `Başlık en çok ${BASLIK_EN_COK} karakter olabilir.` };
	if (m.length < METIN_EN_AZ) return { tamam: false, hata: 'Mesaj boş olamaz.' };
	if (m.length > METIN_EN_COK) return { tamam: false, hata: `Mesaj en çok ${METIN_EN_COK} karakter olabilir.` };
	return { tamam: true, baslik: b, metin: m };
}

export function mesajGirdisiniDenetle(metin) {
	const m = kirp(metin);
	if (m.length < METIN_EN_AZ) return { tamam: false, hata: 'Mesaj boş olamaz.' };
	if (m.length > METIN_EN_COK) return { tamam: false, hata: `Mesaj en çok ${METIN_EN_COK} karakter olabilir.` };
	return { tamam: true, metin: m };
}

/**
 * Yeni talep açar. `isId` verilirse o işin AYNI müşteriye ait olduğu
 * doğrulanıyor; başka müşterinin işine talep bağlanamaz.
 */
export function talepAc(db, { musteriId, baslik, metin, isId = null, simdiMs = Date.now() }) {
	const denetim = talepGirdisiniDenetle({ baslik, metin });
	if (!denetim.tamam) return denetim;

	let bagliIs = null;
	if (isId) {
		const varMi = db
			.prepare('SELECT id FROM is_ozeti WHERE id = ? AND musteri_id = ?')
			.get(isId, musteriId);
		if (!varMi) return { tamam: false, hata: 'Seçilen iş bulunamadı.' };
		bagliIs = isId;
	}

	const simdi = new Date(simdiMs).toISOString();
	const talepId = yeniKimlik();
	db.exec('BEGIN');
	try {
		db.prepare(
			`INSERT INTO talep (id, musteri_id, is_id, baslik, durum, oncelik, olusturuldu, guncellendi)
			 VALUES (?, ?, ?, ?, 'acik', 'normal', ?, ?)`,
		).run(talepId, musteriId, bagliIs, denetim.baslik, simdi, simdi);
		db.prepare(
			"INSERT INTO talep_mesaji (id, talep_id, yazan, metin, zaman) VALUES (?, ?, 'musteri', ?, ?)",
		).run(yeniKimlik(), talepId, denetim.metin, simdi);
		db.exec('COMMIT');
	} catch (hata) {
		db.exec('ROLLBACK');
		throw hata;
	}
	return { tamam: true, talepId };
}

/**
 * Var olan talebe mesaj yazar.
 * Talep başka bir müşteriye aitse yazma gerçekleşmiyor ve dönen değer,
 * talep hiç yokmuş gibi aynı: müşteri başkasının talebinin varlığını bile
 * öğrenemiyor.
 */
export function mesajYaz(db, { musteriId, talepId, metin, simdiMs = Date.now() }) {
	const denetim = mesajGirdisiniDenetle(metin);
	if (!denetim.tamam) return denetim;

	const talep = db
		.prepare('SELECT id, durum FROM talep WHERE id = ? AND musteri_id = ?')
		.get(talepId, musteriId);
	if (!talep) return { tamam: false, hata: 'Talep bulunamadı.' };
	if (talep.durum === 'kapandi') return { tamam: false, hata: 'Kapanmış talebe mesaj yazılamaz.' };

	const simdi = new Date(simdiMs).toISOString();
	db.exec('BEGIN');
	try {
		db.prepare(
			"INSERT INTO talep_mesaji (id, talep_id, yazan, metin, zaman) VALUES (?, ?, 'musteri', ?, ?)",
		).run(yeniKimlik(), talepId, denetim.metin, simdi);
		/* Müşteri yazınca talep yeniden açılıyor: sahibin sırasına geri düşsün. */
		db.prepare('UPDATE talep SET durum = ?, guncellendi = ? WHERE id = ? AND musteri_id = ?').run(
			'acik',
			simdi,
			talepId,
			musteriId,
		);
		db.exec('COMMIT');
	} catch (hata) {
		db.exec('ROLLBACK');
		throw hata;
	}
	return { tamam: true };
}

/*
  İş detayı: ilerleme aşamaları, ödeme dökümü, dosya künyeleri ve iş bazlı
  yazışma.

  BU DOSYANIN TEK KURALI, `talepler.mjs` ile aynı: her sorguda müşteri
  kimliği süzgeci, istisnasız. İş kimliği tahmin edilemez olsa bile yetki
  modeli "kimliği bilen görür" olamaz. Aşama, ödeme, dosya ve mesaj
  tablolarında müşteri sütunu YOK; süzgeç ancak `is_ozeti` ile birleşerek
  kurulabiliyor, bu yüzden bu dosyadaki her alt sorgu ya birleşim yapıyor ya
  da işin sahipliği önce `isGetir` ile doğrulanmış oluyor.

  ÖDENEN TUTAR BURADA HESAPLANIYOR, VERİTABANINDAN OKUNMUYOR. Şema da aynı
  şeyi söylüyor: iki yerde tutulan bir sayı er geç ayrışır ve hangisinin
  doğru olduğu anlaşılmaz. Tek gerçek kaynak `is_odeme` satırları.
*/

import { yeniKimlik } from '../../../veri/kimlik.mjs';
import { METIN_EN_AZ, METIN_EN_COK } from './talepler.mjs';

export { METIN_EN_AZ, METIN_EN_COK };

/** Kapanmış ve iptal edilmiş iş "açık" sayılmıyor; gecikme uyarısı da çıkmıyor. */
export const BITEN_DURUMLAR = new Set(['kapandi', 'iptal']);

const ODEME_TURLERI = {
	on_odeme: 'Ön ödeme',
	ara_odeme: 'Ara ödeme',
	son_odeme: 'Son ödeme',
	iade: 'İade',
};

const ASAMA_DURUMLARI = {
	tamamlandi: 'Tamamlandı',
	suruyor: 'Sürüyor',
	bekliyor: 'Bekliyor',
};

export function odemeTuruEtiketi(tur) {
	return ODEME_TURLERI[tur] ?? tur;
}

export function asamaDurumEtiketi(durum) {
	return ASAMA_DURUMLARI[durum] ?? durum;
}

/**
 * İşin künyesi. Müşteri süzgeci olmadan ÇAĞRILAMAZ: imza iki argüman
 * istiyor, sorgu iki koşulu birden yazıyor. Başkasının işi için `null`,
 * yani "var ama göremezsin" bile denmiyor.
 */
export function isGetir(db, musteriId, isId) {
	if (!isId) return null;
	return (
		db
			.prepare(
				`SELECT id, musteri_id, ad, durum, ozet, tutar_kurus, para_birimi,
				        teslim_hedefi, guncellendi
				 FROM is_ozeti WHERE id = ? AND musteri_id = ?`,
			)
			.get(isId, musteriId) ?? null
	);
}

/**
 * İlerleme aşamaları.
 *
 * Sıralama önce `sira`, sonra `tarih`: sahip geçmişe dönük bir aşama
 * ekleyebiliyor ve o zaman iki alan ayrışıyor. Kronolojiyi taşıyan `sira`,
 * bu yüzden birinci ölçüt.
 */
export function asamalariListele(db, isId) {
	return db
		.prepare(
			`SELECT id, sira, kaynak, baslik, aciklama, durum, tarih
			 FROM is_asama WHERE is_id = ? ORDER BY sira, tarih, id`,
		)
		.all(isId);
}

export function odemeleriListele(db, isId) {
	return db
		.prepare('SELECT id, tur, tutar_kurus, tarih FROM is_odeme WHERE is_id = ? ORDER BY tarih, id')
		.all(isId);
}

export function dosyalariListele(db, isId) {
	return db
		.prepare(
			`SELECT id, asama_id, gosterilen_ad, tur, boyut, gorsel_mi, olusturuldu
			 FROM is_dosya WHERE is_id = ? ORDER BY olusturuldu, id`,
		)
		.all(isId);
}

export function isMesajlariListele(db, isId) {
	return db
		.prepare('SELECT id, yazan, metin, zaman FROM is_mesaji WHERE is_id = ? ORDER BY zaman, id')
		.all(isId);
}

/**
 * ÖDEME DÖKÜMÜ. Ödenen tutar `is_odeme` satırlarından toplanıyor.
 *
 * İADE EKSİ YÖNDE SAYILIYOR. Satırın işareti iki türlü yazılmış olabilir:
 * iade bazen eksi tutarla, bazen artı tutarla ve `tur = 'iade'` ile
 * kaydediliyor. `Math.abs` ile mutlak değer alınıp çıkarılması ikisini de
 * aynı sonuca getiriyor; aksi hâlde eksi yazılmış bir iade iki kez düşer.
 *
 * Kalan eksiye düşebilir: fazla ödeme ya da iş tutarının sonradan
 * düşürülmesi. Bu bir hata değil, `fazla` alanıyla ayrıca söyleniyor.
 */
export function odemeDokumu(tutarKurus, odemeler) {
	const toplam = Number.isFinite(tutarKurus) ? Math.trunc(tutarKurus) : 0;
	let odenen = 0;
	for (const odeme of odemeler ?? []) {
		const tutar = Math.trunc(Number(odeme.tutar_kurus) || 0);
		odenen += odeme.tur === 'iade' ? -Math.abs(tutar) : tutar;
	}
	const kalan = toplam - odenen;
	return {
		toplam,
		odenen,
		kalan,
		/** Ödenen tutar iş bedelini aştıysa kalan eksiye düşüyor. */
		fazla: kalan < 0 ? -kalan : 0,
		/** Tamamı ödendiyse (ya da aşıldıysa) ödeme bölümü sakinleşiyor. */
		kapandiMi: kalan <= 0,
	};
}

/**
 * Teslim hedefi ve gecikme.
 *
 * Gecikme YALNIZCA açık işlerde var: teslim edilmiş bir işin geçmiş hedef
 * tarihi bir uyarı değil, bir tarih. Dil bilinçli olarak sakin; panik
 * yaratan bir kırmızı kutu müşteriyi telefona sarıldırıyor, oysa söylenecek
 * şey "planlanan tarih geçti" cümlesinden ibaret.
 */
export function teslimDurumu(is, simdiMs = Date.now()) {
	if (!is?.teslim_hedefi) return { var: false, gecikti: false, gunFarki: null };
	const ms = Date.parse(is.teslim_hedefi);
	if (Number.isNaN(ms)) return { var: false, gecikti: false, gunFarki: null };

	const gunBasi = (t) => {
		const g = new Date(t);
		g.setHours(0, 0, 0, 0);
		return g.getTime();
	};
	const fark = Math.round((gunBasi(ms) - gunBasi(simdiMs)) / 86400000);
	const acik = !BITEN_DURUMLAR.has(is.durum);
	return {
		var: true,
		acikMi: acik,
		gecikti: acik && fark < 0,
		/** Üç gün kala hatırlatma: geçmedi ama yaklaştı. */
		yaklasti: acik && fark >= 0 && fark <= 3,
		gunFarki: fark,
	};
}

/**
 * İş detayının tamamı: künye, aşamalar, ödemeler, dosyalar, mesajlar.
 * İş bu müşterinin değilse `null` ve hiçbir alt sorgu hiç çalışmıyor.
 */
export function isDetayGetir(db, musteriId, isId, simdiMs = Date.now()) {
	const is = isGetir(db, musteriId, isId);
	if (!is) return null;
	const odemeler = odemeleriListele(db, isId);
	return {
		is,
		asamalar: asamalariListele(db, isId),
		odemeler,
		dokum: odemeDokumu(is.tutar_kurus, odemeler),
		dosyalar: dosyalariListele(db, isId),
		mesajlar: isMesajlariListele(db, isId),
		teslim: teslimDurumu(is, simdiMs),
	};
}

/**
 * Panonun iş listesi: künye artı hesaplanmış kalan borç.
 *
 * Ödemeler tek sorguda toplanıyor, iş başına ayrı sorgu açılmıyor; ama
 * toplama yine `is_odeme` satırlarından ve yine `odemeDokumu` ile yapılıyor,
 * yani iki ayrı yerde iki ayrı hesap yok.
 */
export function isleriOzetle(db, musteriId, simdiMs = Date.now()) {
	const isler = db
		.prepare(
			`SELECT id, musteri_id, ad, durum, ozet, tutar_kurus, para_birimi,
			        teslim_hedefi, guncellendi
			 FROM is_ozeti WHERE musteri_id = ? ORDER BY guncellendi DESC`,
		)
		.all(musteriId);
	if (isler.length === 0) return [];

	/*
	  Ödemeler TEK sorguda ve yine müşteri süzgeciyle: `is_odeme` tablosunda
	  müşteri sütunu yok, süzgeç `is_ozeti` ile birleşerek kuruluyor.
	*/
	const odemeler = db
		.prepare(
			`SELECT o.is_id, o.id, o.tur, o.tutar_kurus, o.tarih
			 FROM is_odeme o JOIN is_ozeti i ON i.id = o.is_id
			 WHERE i.musteri_id = ? ORDER BY o.tarih, o.id`,
		)
		.all(musteriId);

	const kume = new Map();
	for (const odeme of odemeler) {
		if (!kume.has(odeme.is_id)) kume.set(odeme.is_id, []);
		kume.get(odeme.is_id).push(odeme);
	}

	return isler.map((is) => ({
		...is,
		dokum: odemeDokumu(is.tutar_kurus, kume.get(is.id) ?? []),
		teslim: teslimDurumu(is, simdiMs),
	}));
}

function kirp(deger) {
	return typeof deger === 'string' ? deger.trim().replace(/\r\n/g, '\n') : '';
}

/**
 * İşe mesaj yazar.
 *
 * İş başka bir müşteriye aitse yazma GERÇEKLEŞMİYOR ve dönen değer, iş hiç
 * yokmuş gibi aynı: müşteri başkasının işinin varlığını bile öğrenemiyor.
 * Panel yalnızca `musteri` ağzından yazıyor; sahip tarafı sunucuya
 * masaüstünden eşitlemeyle geliyor.
 */
export function isMesajiYaz(db, { musteriId, isId, metin, simdiMs = Date.now() }) {
	const m = kirp(metin);
	if (m.length < METIN_EN_AZ) return { tamam: false, hata: 'Mesaj boş olamaz.' };
	if (m.length > METIN_EN_COK) {
		return { tamam: false, hata: `Mesaj en çok ${METIN_EN_COK} karakter olabilir.` };
	}

	const is = db
		.prepare('SELECT id, durum FROM is_ozeti WHERE id = ? AND musteri_id = ?')
		.get(isId, musteriId);
	if (!is) return { tamam: false, hata: 'İş bulunamadı.' };

	const simdi = new Date(simdiMs).toISOString();
	db.exec('BEGIN');
	try {
		db.prepare(
			"INSERT INTO is_mesaji (id, is_id, yazan, metin, zaman) VALUES (?, ?, 'musteri', ?, ?)",
		).run(yeniKimlik(), isId, m, simdi);
		/*
		  İşin `guncellendi` damgası da ilerliyor: pano "son hareket"i buradan
		  okuyor ve yazdığı mesajı orada görmeyen müşteri mesajın gidip
		  gitmediğinden emin olamıyor.
		*/
		db.prepare('UPDATE is_ozeti SET guncellendi = ? WHERE id = ? AND musteri_id = ?').run(
			simdi,
			isId,
			musteriId,
		);
		db.exec('COMMIT');
	} catch (hata) {
		db.exec('ROLLBACK');
		throw hata;
	}
	return { tamam: true };
}

/**
 * Müşterinin bekleyen yanıt sayısı: üst çubuktaki sayaç.
 *
 * ŞEMADA "OKUNDU" SÜTUNU YOK ve `veri/` altına dokunulmuyor, yani gerçek bir
 * okunmamışlık kaydı tutulamıyor. Onun yerine SAYILABİLİR ve doğru olan şey
 * sayılıyor: her yazışmada müşterinin kendi son mesajından SONRA sahibin
 * yazdığı mesajlar. Müşteri hiç yazmamışsa sahibin bütün mesajları sayılıyor.
 *
 * Bu, "okumadınız" iddiası değil "size dönüş yapıldı" bilgisi; arayüzdeki
 * etiket de aynı şeyi söylüyor.
 */
export function bekleyenYanitSayisi(db, musteriId) {
	const talep = db
		.prepare(
			`SELECT COUNT(*) AS sayi
			 FROM talep_mesaji m JOIN talep t ON t.id = m.talep_id
			 WHERE t.musteri_id = ? AND m.yazan = 'sahip'
			   AND m.zaman > COALESCE(
			       (SELECT MAX(k.zaman) FROM talep_mesaji k
			        WHERE k.talep_id = m.talep_id AND k.yazan = 'musteri'), '')`,
		)
		.get(musteriId)?.sayi ?? 0;

	const is = db
		.prepare(
			`SELECT COUNT(*) AS sayi
			 FROM is_mesaji m JOIN is_ozeti i ON i.id = m.is_id
			 WHERE i.musteri_id = ? AND m.yazan = 'sahip'
			   AND m.zaman > COALESCE(
			       (SELECT MAX(k.zaman) FROM is_mesaji k
			        WHERE k.is_id = m.is_id AND k.yazan = 'musteri'), '')`,
		)
		.get(musteriId)?.sayi ?? 0;

	return talep + is;
}

/** Açık iş sayısı: üst çubuktaki ikinci sayaç. */
export function acikIsSayisi(db, musteriId) {
	return (
		db
			.prepare(
				"SELECT COUNT(*) AS sayi FROM is_ozeti WHERE musteri_id = ? AND durum NOT IN ('kapandi', 'iptal')",
			)
			.get(musteriId)?.sayi ?? 0
	);
}

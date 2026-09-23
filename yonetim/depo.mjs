/*
  VERİ KATMANI

  SQLite sorguları burada. Electron burada DA yok: şifreleme bir "kasa"
  nesnesi olarak DIŞARIDAN veriliyor (`depoKur(db, kasa)`). Uygulamada o
  kasa Electron'un `safeStorage`'ı oluyor, testte sahte bir kasa. Böylece
  hem sorgular hem şifreleme yolu Electron açmadan sınanabiliyor.

  Şemayı bu dosya kurmuyor: `veri/db.mjs` içindeki `yerelAc()` kuruyor.
*/

import { simdi } from '../veri/db.mjs';
import { davetAnahtariUret, yeniKimlik } from '../veri/kimlik.mjs';
import {
	aramaEslesiyorMu,
	davetEsitlemeKaydi,
	isEsitlemeKaydi,
	isHesabi,
	istatistikHesapla,
	kuyrukGovdesiSuz,
	musteriEsitlemeKaydi,
} from './is-mantigi.mjs';

/** Davetin varsayılan geçerlilik süresi: 7 gün (PANEL-TASARIMI.md §5.1). */
export const DAVET_GUN = 7;

/**
 * Şifreleme kullanılamıyorken TC ve vergi numarasının başına düşen durum.
 * Sessizce düz metin yazmak yerine kayıt reddediliyor; çağıran taraf bu
 * hatayı kullanıcıya olduğu gibi gösteriyor.
 */
export class SifrelemeYok extends Error {
	constructor() {
		super(
			'İşletim sisteminin anahtarlığı açılamadı. TC kimlik ve vergi numarası ' +
				'şifrelenemeyeceği için kaydedilmedi. Diğer alanlar kaydedildi.',
		);
		this.name = 'SifrelemeYok';
	}
}

export function depoKur(db, kasa) {
	/* -------------------------------------------------------------- */
	/* Şifreli alanlar                                                 */
	/* -------------------------------------------------------------- */

	function sifrele(metin) {
		const temiz = String(metin ?? '').trim();
		if (temiz === '') return null;
		if (!kasa?.kullanilabilir?.()) throw new SifrelemeYok();
		return kasa.sifrele(temiz);
	}

	/**
	 * Çözerken hata yutuluyor ve `null` dönüyor. Sebebi: veritabanı başka
	 * bir makineden kopyalanmışsa (ya da kullanıcı profili değişmişse)
	 * anahtarlık o baytları açamaz. Bu beklenen bir durum, uygulamanın
	 * çökmesi için sebep değil; arayüz "çözülemedi" yazıyor.
	 */
	function coz(baytlar) {
		if (!baytlar || baytlar.length === 0) return null;
		if (!kasa?.kullanilabilir?.()) return null;
		try {
			return kasa.coz(baytlar);
		} catch {
			return null;
		}
	}

	/* -------------------------------------------------------------- */
	/* Eşitleme kuyruğu                                                */
	/* -------------------------------------------------------------- */

	const kuyrugaEkleSorgu = db.prepare(
		'INSERT INTO esitleme_kuyrugu (islem, govde, olusturuldu) VALUES (?, ?, ?)',
	);

	/**
	 * Kuyruğa tek giriş noktası. Gövde önce `kuyrukGovdesiSuz` ile
	 * süzülüyor: izin verilmeyen bir alan varsa buraya hiç gelmiyor, hata
	 * fırlıyor. Kuyruğa hassas veri sızmamasının garantisi bu tek kapı.
	 */
	function kuyrugaYaz({ islem, govde }) {
		const temiz = kuyrukGovdesiSuz(islem, govde);
		kuyrugaEkleSorgu.run(islem, JSON.stringify(temiz), simdi());
	}

	/* -------------------------------------------------------------- */
	/* Müşteri                                                         */
	/* -------------------------------------------------------------- */

	function musteriListesi({ arama = '', arsivDahil = false } = {}) {
		const satirlar = db
			.prepare(
				`SELECT m.id, m.ad_soyad, m.telefon, m.ilce, m.sehir, m.durum,
				        m.not_metni, m.olusturuldu,
				        (SELECT COUNT(*) FROM is_kaydi i WHERE i.musteri_id = m.id) AS is_sayisi
				 FROM musteri m
				 ORDER BY m.ad_soyad COLLATE NOCASE`,
			)
			.all();
		return satirlar
			.filter((m) => (arsivDahil ? true : m.durum !== 'arsiv'))
			.filter((m) => aramaEslesiyorMu([m.ad_soyad, m.telefon, m.ilce, m.sehir, m.not_metni], arama));
	}

	function musteriGetir(id) {
		const satir = db.prepare('SELECT * FROM musteri WHERE id = ?').get(id);
		if (!satir) return null;
		return {
			...satir,
			tc: coz(satir.tc_sifreli),
			vergi: coz(satir.vergi_sifreli),
			tc_sifreli: undefined,
			vergi_sifreli: undefined,
			// Kayıt var ama çözülemiyorsa arayüz bunu ayırt edebilsin:
			// boş alan ile "açılamayan alan" farklı şeyler.
			tcVar: Boolean(satir.tc_sifreli?.length),
			vergiVar: Boolean(satir.vergi_sifreli?.length),
		};
	}

	/**
	 * Müşteri kaydeder ya da günceller.
	 *
	 * Anahtarlık açılamıyorsa TC ve vergi sütunlarına HİÇ DOKUNULMUYOR:
	 * ne düz metin yazılıyor ne de eski şifreli değer siliniyor. İkincisi
	 * ilk yazımda gözden kaçmıştı ve testte yakalandı: alanlar arayüzde
	 * kapalı olduğu için boş geliyor, boş değer de güncellemede sütunu
	 * `null` yapıyordu. Yani anahtarlığın açılmadığı tek bir kayıt
	 * düzenlemesi, daha önce şifrelenmiş TC'yi sessizce silerdi.
	 *
	 * Kullanıcı yeni bir değer yazmışsa uyarı dönüyor; yazmamışsa ortada
	 * şikâyet edilecek bir şey yok, sessiz kalınıyor.
	 */
	function musteriKaydet(kayit) {
		const an = simdi();
		const id = kayit.id || yeniKimlik();
		const yeniMi = !kayit.id;

		const tcVerildi = String(kayit.tc ?? '').trim() !== '';
		const vergiVerildi = String(kayit.vergi ?? '').trim() !== '';
		const kasaAcik = Boolean(kasa?.kullanilabilir?.());

		let sifrelemeHatasi = null;
		let tcBayt = null;
		let vergiBayt = null;
		if (kasaAcik) {
			tcBayt = sifrele(kayit.tc);
			vergiBayt = sifrele(kayit.vergi);
		} else if (tcVerildi || vergiVerildi) {
			sifrelemeHatasi = new SifrelemeYok();
		}

		db.exec('BEGIN');
		try {
			if (yeniMi) {
				db.prepare(
					`INSERT INTO musteri
					 (id, ad_soyad, telefon, ilce, sehir, vergi_sifreli, tc_sifreli,
					  not_metni, durum, olusturuldu, guncellendi)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				).run(
					id,
					String(kayit.ad_soyad).trim(),
					bosNull(kayit.telefon),
					bosNull(kayit.ilce),
					bosNull(kayit.sehir),
					vergiBayt,
					tcBayt,
					bosNull(kayit.not_metni),
					kayit.durum || 'etkin',
					an,
					an,
				);
			} else {
				db.prepare(
					`UPDATE musteri SET ad_soyad = ?, telefon = ?, ilce = ?, sehir = ?,
					        not_metni = ?, durum = ?, guncellendi = ?
					 WHERE id = ?`,
				).run(
					String(kayit.ad_soyad).trim(),
					bosNull(kayit.telefon),
					bosNull(kayit.ilce),
					bosNull(kayit.sehir),
					bosNull(kayit.not_metni),
					kayit.durum || 'etkin',
					an,
					id,
				);
				// Yalnızca anahtarlık açıkken yazılıyor. Kapalıyken sütunlara
				// dokunmamak, eski şifreli değeri korumanın tek yolu.
				if (kasaAcik) {
					db.prepare('UPDATE musteri SET tc_sifreli = ?, vergi_sifreli = ? WHERE id = ?').run(
						tcBayt,
						vergiBayt,
						id,
					);
				}
			}

			kuyrugaYaz(
				musteriEsitlemeKaydi({
					id,
					ad_soyad: String(kayit.ad_soyad).trim(),
					durum: kayit.durum || 'etkin',
				}),
			);
			db.exec('COMMIT');
		} catch (hata) {
			db.exec('ROLLBACK');
			throw hata;
		}

		return { id, uyari: sifrelemeHatasi ? sifrelemeHatasi.message : null };
	}

	function musteriDurumu(id, durum) {
		const satir = db.prepare('SELECT ad_soyad FROM musteri WHERE id = ?').get(id);
		if (!satir) throw new Error('Müşteri bulunamadı.');
		db.exec('BEGIN');
		try {
			db.prepare('UPDATE musteri SET durum = ?, guncellendi = ? WHERE id = ?').run(
				durum,
				simdi(),
				id,
			);
			kuyrugaYaz(musteriEsitlemeKaydi({ id, ad_soyad: satir.ad_soyad, durum }));
			db.exec('COMMIT');
		} catch (hata) {
			db.exec('ROLLBACK');
			throw hata;
		}
		return { id, durum };
	}

	/* -------------------------------------------------------------- */
	/* İş                                                              */
	/* -------------------------------------------------------------- */

	function isListesi({ musteriId = null, arama = '', durum = null } = {}) {
		const satirlar = db
			.prepare(
				`SELECT i.*, m.ad_soyad AS musteri_adi
				 FROM is_kaydi i JOIN musteri m ON m.id = i.musteri_id
				 ORDER BY COALESCE(i.teslim, i.baslangic, i.olusturuldu) DESC`,
			)
			.all();
		const odemeler = db.prepare('SELECT * FROM odeme').all();
		const revizeler = db.prepare('SELECT * FROM revize').all();

		return satirlar
			.filter((i) => (musteriId ? i.musteri_id === musteriId : true))
			.filter((i) => (durum ? i.durum === durum : true))
			.filter((i) => aramaEslesiyorMu([i.ad, i.ozet, i.tur, i.musteri_adi], arama))
			.map((i) => ({
				...i,
				hesap: isHesabi(
					i,
					odemeler.filter((o) => o.is_id === i.id),
					revizeler.filter((r) => r.is_id === i.id),
				),
			}));
	}

	function isGetir(id) {
		const is = db
			.prepare(
				`SELECT i.*, m.ad_soyad AS musteri_adi
				 FROM is_kaydi i JOIN musteri m ON m.id = i.musteri_id
				 WHERE i.id = ?`,
			)
			.get(id);
		if (!is) return null;
		const odemeler = db.prepare('SELECT * FROM odeme WHERE is_id = ? ORDER BY tarih').all(id);
		const revizeler = db.prepare('SELECT * FROM revize WHERE is_id = ? ORDER BY tarih').all(id);
		return { ...is, odemeler, revizeler, hesap: isHesabi(is, odemeler, revizeler) };
	}

	function isKaydet(kayit) {
		const an = simdi();
		const id = kayit.id || yeniKimlik();
		const yeniMi = !kayit.id;

		db.exec('BEGIN');
		try {
			if (yeniMi) {
				db.prepare(
					`INSERT INTO is_kaydi
					 (id, musteri_id, ad, ozet, tur, durum, tutar_kurus, on_odeme_orani,
					  para_birimi, tekrar_eden, baslangic, teslim, olusturuldu, guncellendi)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'TRY', ?, ?, ?, ?, ?)`,
				).run(
					id,
					kayit.musteri_id,
					String(kayit.ad).trim(),
					bosNull(kayit.ozet),
					bosNull(kayit.tur),
					kayit.durum,
					kayit.tutar_kurus,
					oranNull(kayit.on_odeme_orani),
					Number(kayit.tekrar_eden) === 1 ? 1 : 0,
					bosNull(kayit.baslangic),
					bosNull(kayit.teslim),
					an,
					an,
				);
			} else {
				db.prepare(
					`UPDATE is_kaydi SET musteri_id = ?, ad = ?, ozet = ?, tur = ?, durum = ?,
					        tutar_kurus = ?, on_odeme_orani = ?, tekrar_eden = ?,
					        baslangic = ?, teslim = ?, guncellendi = ?
					 WHERE id = ?`,
				).run(
					kayit.musteri_id,
					String(kayit.ad).trim(),
					bosNull(kayit.ozet),
					bosNull(kayit.tur),
					kayit.durum,
					kayit.tutar_kurus,
					oranNull(kayit.on_odeme_orani),
					Number(kayit.tekrar_eden) === 1 ? 1 : 0,
					bosNull(kayit.baslangic),
					bosNull(kayit.teslim),
					an,
					id,
				);
			}
			// Sunucuya yalnızca ad ve durum gidiyor; tutar, oran ve özet burada kalıyor.
			kuyrugaYaz(
				isEsitlemeKaydi({
					id,
					musteri_id: kayit.musteri_id,
					ad: String(kayit.ad).trim(),
					durum: kayit.durum,
				}),
			);
			db.exec('COMMIT');
		} catch (hata) {
			db.exec('ROLLBACK');
			throw hata;
		}
		return { id };
	}

	function isSil(id) {
		// Ödeme ve revizeler ON DELETE CASCADE ile gidiyor.
		db.prepare('DELETE FROM is_kaydi WHERE id = ?').run(id);
		return { id };
	}

	/* -------------------------------------------------------------- */
	/* Ödeme ve revize                                                 */
	/* -------------------------------------------------------------- */

	function odemeKaydet(kayit) {
		const an = simdi();
		const id = kayit.id || yeniKimlik();
		if (kayit.id) {
			db.prepare(
				'UPDATE odeme SET tur = ?, tutar_kurus = ?, tarih = ?, yontem = ?, not_metni = ? WHERE id = ?',
			).run(kayit.tur, kayit.tutar_kurus, kayit.tarih, bosNull(kayit.yontem), bosNull(kayit.not_metni), id);
		} else {
			db.prepare(
				`INSERT INTO odeme (id, is_id, tur, tutar_kurus, tarih, yontem, not_metni, olusturuldu)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			).run(
				id,
				kayit.is_id,
				kayit.tur,
				kayit.tutar_kurus,
				kayit.tarih,
				bosNull(kayit.yontem),
				bosNull(kayit.not_metni),
				an,
			);
		}
		return { id };
	}

	function odemeSil(id) {
		db.prepare('DELETE FROM odeme WHERE id = ?').run(id);
		return { id };
	}

	function odemeListesi({ isId = null, sinir = 300 } = {}) {
		const satirlar = db
			.prepare(
				`SELECT o.*, i.ad AS is_adi, m.ad_soyad AS musteri_adi
				 FROM odeme o
				 JOIN is_kaydi i ON i.id = o.is_id
				 JOIN musteri m ON m.id = i.musteri_id
				 ORDER BY o.tarih DESC, o.olusturuldu DESC
				 LIMIT ?`,
			)
			.all(sinir);
		return isId ? satirlar.filter((o) => o.is_id === isId) : satirlar;
	}

	function revizeKaydet(kayit) {
		const an = simdi();
		const id = kayit.id || yeniKimlik();
		const ucretli = Number(kayit.ucretli) === 1 ? 1 : 0;
		if (kayit.id) {
			db.prepare(
				'UPDATE revize SET baslik = ?, aciklama = ?, tutar_kurus = ?, ucretli = ?, tarih = ? WHERE id = ?',
			).run(String(kayit.baslik).trim(), bosNull(kayit.aciklama), kayit.tutar_kurus, ucretli, kayit.tarih, id);
		} else {
			db.prepare(
				`INSERT INTO revize (id, is_id, baslik, aciklama, tutar_kurus, ucretli, tarih, olusturuldu)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			).run(
				id,
				kayit.is_id,
				String(kayit.baslik).trim(),
				bosNull(kayit.aciklama),
				kayit.tutar_kurus,
				ucretli,
				kayit.tarih,
				an,
			);
		}
		return { id };
	}

	function revizeSil(id) {
		db.prepare('DELETE FROM revize WHERE id = ?').run(id);
		return { id };
	}

	function revizeListesi({ isId = null, sinir = 300 } = {}) {
		const satirlar = db
			.prepare(
				`SELECT r.*, i.ad AS is_adi, m.ad_soyad AS musteri_adi
				 FROM revize r
				 JOIN is_kaydi i ON i.id = r.is_id
				 JOIN musteri m ON m.id = i.musteri_id
				 ORDER BY r.tarih DESC, r.olusturuldu DESC
				 LIMIT ?`,
			)
			.all(sinir);
		return isId ? satirlar.filter((r) => r.is_id === isId) : satirlar;
	}

	/* -------------------------------------------------------------- */
	/* İstatistik                                                      */
	/* -------------------------------------------------------------- */

	function istatistik(ay) {
		return istatistikHesapla({
			ay,
			musteriler: db.prepare('SELECT id, durum, olusturuldu FROM musteri').all(),
			isler: db.prepare('SELECT * FROM is_kaydi').all(),
			odemeler: db.prepare('SELECT * FROM odeme').all(),
			revizeler: db.prepare('SELECT * FROM revize').all(),
			talepler: db.prepare('SELECT id, durum FROM talep_kopyasi').all(),
		});
	}

	/** İstatistik ekranındaki ay listesi: kayıtlarda geçen aylar, yeniden eskiye. */
	function aylar() {
		const kume = new Set();
		for (const satir of db
			.prepare(
				`SELECT COALESCE(teslim, baslangic, olusturuldu) AS t FROM is_kaydi
				 UNION ALL SELECT tarih FROM odeme
				 UNION ALL SELECT olusturuldu FROM musteri`,
			)
			.all()) {
			if (satir.t) kume.add(String(satir.t).slice(0, 7));
		}
		return [...kume].sort().reverse();
	}

	/* -------------------------------------------------------------- */
	/* Davet                                                           */
	/* -------------------------------------------------------------- */

	/**
	 * Davet anahtarı üretir.
	 *
	 * ANAHTARIN KENDİSİ HİÇBİR YERE YAZILMIYOR: ne veritabanına, ne kuyruğa,
	 * ne günlüğe. Yalnızca çağırana dönüyor, o da ekranda gösteriyor. Ekran
	 * kapanınca anahtar kayboluyor ve bir daha üretilemiyor.
	 *
	 * Kuyruğa giden tek şey SHA-256 karması. Sunucu veritabanı sızsa bile
	 * karmadan anahtar geri üretilemez.
	 */
	function davetUret(musteriId, gun = DAVET_GUN) {
		const musteri = db.prepare('SELECT id, ad_soyad FROM musteri WHERE id = ?').get(musteriId);
		if (!musteri) throw new Error('Müşteri bulunamadı.');

		const anahtar = davetAnahtariUret();
		const sonKullanma = new Date(Date.now() + gun * 24 * 60 * 60 * 1000).toISOString();
		const davetId = yeniKimlik();

		kuyrugaYaz(
			davetEsitlemeKaydi({
				id: davetId,
				musteriId,
				anahtarKarmasiHex: Buffer.from(anahtar.karma).toString('hex'),
				sonKullanma,
			}),
		);

		return {
			davetId,
			musteriAdi: musteri.ad_soyad,
			// Ham baytlar bilinçli olarak dönülmüyor: kimsenin işine yaramıyor
			// ve yanlışlıkla bir yere yazılma ihtimalini doğuruyor.
			metin: anahtar.metin,
			sonKullanma,
		};
	}

	/* -------------------------------------------------------------- */
	/* Kuyruk okuma (yalnızca gösterim ve test için)                   */
	/* -------------------------------------------------------------- */

	function kuyrukBekleyenler(sinir = 200) {
		return db
			.prepare(
				'SELECT id, islem, govde, olusturuldu FROM esitleme_kuyrugu WHERE gonderildi IS NULL ORDER BY id DESC LIMIT ?',
			)
			.all(sinir);
	}

	return {
		musteriListesi,
		musteriGetir,
		musteriKaydet,
		musteriDurumu,
		isListesi,
		isGetir,
		isKaydet,
		isSil,
		odemeKaydet,
		odemeSil,
		odemeListesi,
		revizeKaydet,
		revizeSil,
		revizeListesi,
		istatistik,
		aylar,
		davetUret,
		kuyrukBekleyenler,
		sifrelemeVarMi: () => Boolean(kasa?.kullanilabilir?.()),
	};
}

/** Boş metni `null`a çeviriyor. SQLite'ta boş dize ile NULL ayrı şeyler ve
 *  "girilmemiş" olanı NULL tutmak sorguları tutarlı kılıyor. */
function bosNull(deger) {
	const metin = String(deger ?? '').trim();
	return metin === '' ? null : metin;
}

function oranNull(deger) {
	if (deger === null || deger === undefined || String(deger).trim() === '') return null;
	const sayi = Number(deger);
	return Number.isFinite(sayi) ? Math.round(sayi) : null;
}

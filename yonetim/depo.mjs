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
	ESITLEME_AYARLARI,
	OTOMATIK_ANAHTARLARI,
	TALEP_DURUMLARI,
	aramaEslesiyorMu,
	davetEsitlemeKaydi,
	esitlemeAyariDogrula,
	isEsitlemeKaydi,
	isHesabi,
	istatistikHesapla,
	kuyrukGovdesiSuz,
	musteriEsitlemeKaydi,
	otomatikAralikDuzelt,
	otomatikAyariDogrula,
	talepDurumuEsitlemeKaydi,
	talepYanitiDogrula,
	talepYanitiEsitlemeKaydi,
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

/**
 * @param db     açık SQLite bağlantısı
 * @param kasa   şifreleme sarmalayıcısı (uygulamada safeStorage, testte sahte)
 * @param secenekler.kuyrukDinleyici
 *        Kuyruğa her kayıt düştüğünde çağrılıyor, işlem adıyla. Otomatik
 *        eşitleme bunu dinliyor. Verilmezse hiçbir şey değişmiyor: depo
 *        Electron'suz da, eşitlemesiz de çalışmaya devam ediyor.
 */
export function depoKur(db, kasa, { kuyrukDinleyici = null } = {}) {
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
	 *
	 * Dinleyici tek kapının burada olması sayesinde bir yere bağlanıyor:
	 * kuyruğa kayıt düşen HER yol buradan geçtiği için, otomatik eşitlemeyi
	 * tetiklemeyi unutmuş bir çağrı kalamıyor.
	 *
	 * Dinleyici işlemin İÇİNDEN çağrılıyor, COMMIT'ten önce. İşlem geri
	 * alınırsa bildirim boşa gitmiş olur; bunun bedeli, gönderecek bir şey
	 * bulamayan tek bir eşitleme koşusu. Bildirimi COMMIT'ten sonraya almak
	 * altı ayrı çağrı yerini değiştirmeyi gerektirirdi ve asıl riski, yani
	 * bir yolu atlamayı, geri getirirdi.
	 */
	function kuyrugaYaz({ islem, govde }) {
		const temiz = kuyrukGovdesiSuz(islem, govde);
		kuyrugaEkleSorgu.run(islem, JSON.stringify(temiz), simdi());
		if (kuyrukDinleyici) {
			try {
				kuyrukDinleyici(islem);
			} catch {
				// Dinleyicinin hatası kaydı geri almamalı: kayıt asıl iş,
				// eşitleme tetiği yardımcı iş.
			}
		}
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

	/** Yalnızca sayı. Durum göstergesi bunu saniyede bir sorabilmeli, gövde
	 *  okumadan. */
	function kuyrukBekleyenSayisi() {
		return (
			db.prepare('SELECT COUNT(*) AS adet FROM esitleme_kuyrugu WHERE gonderildi IS NULL').get()
				?.adet ?? 0
		);
	}

	/* -------------------------------------------------------------- */
	/* Eşitleme ayarları ve özeti                                      */
	/* -------------------------------------------------------------- */

	const ayarYazSorgu = db.prepare(
		`INSERT INTO ayar (anahtar, deger) VALUES (?, ?)
		 ON CONFLICT (anahtar) DO UPDATE SET deger = excluded.deger`,
	);

	function ayarlariOkuHam() {
		const satirlar = db.prepare('SELECT anahtar, deger FROM ayar').all();
		return Object.fromEntries(satirlar.map((s) => [s.anahtar, s.deger]));
	}

	/**
	 * Eşitleme ayarlarını yazar.
	 *
	 * Bu dört değer YALNIZCA burada, yerel veritabanında duruyor. Depoya
	 * yazılmıyor, dışarı gönderilmiyor, günlüğe düşmüyor. Depo herkese açık
	 * ve sunucunun adresi orada işi olan bir bilgi değil.
	 */
	function esitlemeAyariYaz(form) {
		const hatalar = esitlemeAyariDogrula(form ?? {});
		if (hatalar.length) throw new Error(hatalar.join(' '));
		db.exec('BEGIN');
		try {
			for (const alan of ESITLEME_AYARLARI) {
				ayarYazSorgu.run(alan.anahtar, String(form[alan.anahtar]).trim());
			}
			db.exec('COMMIT');
		} catch (hata) {
			db.exec('ROLLBACK');
			throw hata;
		}
		return { yazilan: ESITLEME_AYARLARI.length };
	}

	/**
	 * Otomatik eşitleme ayarları.
	 *
	 * Varsayılan AÇIK. Sebebi bu işin çıkış noktası: elle eşitleme unutulunca
	 * sessizce yanlış sonuç doğuruyordu. Varsayılanı kapalı yapmak, o hatayı
	 * kullanıcının bir ayarı bulmasına bırakmak olurdu.
	 */
	function otomatikAyariOku() {
		const ayar = ayarlariOkuHam();
		const ham = ayar[OTOMATIK_ANAHTARLARI.acik];
		return {
			// Yalnızca açıkça "0" yazılmışsa kapalı; hiç yazılmamışsa açık.
			otomatik: ham === undefined || ham === null ? true : String(ham) !== '0',
			aralikDk: otomatikAralikDuzelt(ayar[OTOMATIK_ANAHTARLARI.aralikDk]),
			// Bağlantı ayarları eksikse otomatik eşitleme boşuna denemesin.
			ayarTamam: esitlemeAyariDogrula(ayar).length === 0,
			eksikler: esitlemeAyariDogrula(ayar),
		};
	}

	function otomatikAyariYaz(form) {
		const hatalar = otomatikAyariDogrula(form ?? {});
		if (hatalar.length) throw new Error(hatalar.join(' '));
		const acik = Boolean(form.otomatik);
		const aralikDk = otomatikAralikDuzelt(form.aralikDk);
		db.exec('BEGIN');
		try {
			ayarYazSorgu.run(OTOMATIK_ANAHTARLARI.acik, acik ? '1' : '0');
			ayarYazSorgu.run(OTOMATIK_ANAHTARLARI.aralikDk, String(aralikDk));
			db.exec('COMMIT');
		} catch (hata) {
			db.exec('ROLLBACK');
			throw hata;
		}
		return { otomatik: acik, aralikDk };
	}

	/**
	 * Eşitleme ekranının ihtiyaç duyduğu her şey tek çağrıda.
	 *
	 * Kuyruk satırlarının GÖVDESİ dışarı verilmiyor, yalnızca işlem adı ve
	 * kaydın kimliği. Gövdede zaten hassas alan olamaz (beyaz liste), ama
	 * bu ekranın sorusu "ne bekliyor", "içinde ne var" değil.
	 */
	function esitlemeOzeti(sinir = 50) {
		const ayar = ayarlariOkuHam();
		const sayac = db
			.prepare(
				`SELECT COUNT(*) AS adet, MIN(olusturuldu) AS en_eski
				 FROM esitleme_kuyrugu WHERE gonderildi IS NULL`,
			)
			.get();

		const islemler = db
			.prepare(
				`SELECT id, islem, govde, olusturuldu FROM esitleme_kuyrugu
				 WHERE gonderildi IS NULL ORDER BY id LIMIT ?`,
			)
			.all(sinir)
			.map((satir) => ({
				sira: satir.id,
				islem: satir.islem,
				olusturuldu: satir.olusturuldu,
				kayitId: kuyrukKaydininKimligi(satir.govde),
			}));

		return {
			ayar: Object.fromEntries(
				ESITLEME_AYARLARI.map((alan) => [alan.anahtar, ayar[alan.anahtar] ?? '']),
			),
			ayarHatalari: esitlemeAyariDogrula(ayar),
			otomatikAyari: otomatikAyariOku(),
			bekleyenSayisi: sayac.adet ?? 0,
			enEski: sayac.en_eski ?? null,
			sonCalisma: ayar['esitleme.son_calisma'] ?? null,
			sonCekis: ayar['esitleme.son_cekis'] ?? null,
			islemler,
		};
	}

	/* -------------------------------------------------------------- */
	/* Destek talepleri                                                */
	/* -------------------------------------------------------------- */

	/*
	  Bu iki tablo sunucudan ÇEKİLİYOR, yerelde üretilmiyor. Tek istisna
	  sahibin yazdığı yanıt: o hem kuyruğa hem de yerel kopyaya düşüyor,
	  yoksa sahip kendi yazdığını bir sonraki eşitlemeye kadar göremezdi.
	*/

	const TALEP_SECIMI = `SELECT t.id, t.musteri_id, t.is_id, t.baslik, t.durum, t.oncelik,
	                             t.olusturuldu, t.guncellendi, t.cekildi,
	                             m.ad_soyad AS musteri_adi, i.ad AS is_adi
	                      FROM talep_kopyasi t
	                      LEFT JOIN musteri m ON m.id = t.musteri_id
	                      LEFT JOIN is_kaydi i ON i.id = t.is_id`;

	function talepListesi({ arama = '', durum = null, kapaliDahil = true } = {}) {
		const satirlar = db
			.prepare(
				`${TALEP_SECIMI}
				 ORDER BY t.guncellendi DESC`,
			)
			.all()
			.map((t) => ({
				...t,
				mesajSayisi: db
					.prepare('SELECT COUNT(*) AS adet FROM talep_mesaj_kopyasi WHERE talep_id = ?')
					.get(t.id).adet,
			}));

		return satirlar
			.filter((t) => (durum ? t.durum === durum : true))
			.filter((t) => (kapaliDahil ? true : t.durum !== 'kapandi'))
			.filter((t) => aramaEslesiyorMu([t.baslik, t.musteri_adi, t.is_adi, t.durum], arama));
	}

	function talepGetir(id) {
		const talep = db.prepare(`${TALEP_SECIMI} WHERE t.id = ?`).get(id);
		if (!talep) return null;
		const mesajlar = db
			.prepare(
				'SELECT id, talep_id, yazan, metin, zaman FROM talep_mesaj_kopyasi WHERE talep_id = ? ORDER BY zaman, id',
			)
			.all(id);
		return { ...talep, mesajlar };
	}

	/**
	 * Sahibin yanıtı.
	 *
	 * Yanıt doğrudan sunucuya GİTMİYOR: kuyruğa `talep.yanit` olarak
	 * düşüyor ve bir sonraki eşitlemede gidiyor. Bu ekranın ağ işi yok.
	 *
	 * Yerel kopyaya yazılan mesajın kimliği, kuyruğa yazılanla AYNI. Yanıt
	 * gönderildikten sonra sunucu onu geri verdiğinde `talep_mesaj_kopyasi`
	 * üzerindeki `ON CONFLICT (id)` aynı satırı güncelliyor, yani aynı yanıt
	 * iki kez görünmüyor.
	 */
	function talepYanitla(talepId, metin) {
		const talep = db.prepare('SELECT id FROM talep_kopyasi WHERE id = ?').get(talepId);
		if (!talep) throw new Error('Talep bulunamadı.');

		const hatalar = talepYanitiDogrula({ talepId, metin });
		if (hatalar.length) throw new Error(hatalar.join(' '));

		const govde = String(metin).trim();
		const id = yeniKimlik();
		const zaman = simdi();

		db.exec('BEGIN');
		try {
			db.prepare(
				`INSERT INTO talep_mesaj_kopyasi (id, talep_id, yazan, metin, zaman)
				 VALUES (?, ?, 'sahip', ?, ?)`,
			).run(id, talepId, govde, zaman);
			kuyrugaYaz(talepYanitiEsitlemeKaydi({ id, talepId, metin: govde, zaman }));
			db.exec('COMMIT');
		} catch (hata) {
			db.exec('ROLLBACK');
			throw hata;
		}
		return { id, talepId, zaman };
	}

	/**
	 * Talebin durumunu değiştirir (kapatmak da bu yoldan).
	 *
	 * Yerel kopya da güncelleniyor ki sahip sonucu hemen görsün. Gerçeğin
	 * kaynağı yine sunucu: bir sonraki çekişte oradaki değer buraya yazılır.
	 * Sıra bunu güvenli kılıyor, `esitle()` önce gönderiyor sonra çekiyor.
	 */
	function talepDurumu(talepId, durum) {
		const talep = db.prepare('SELECT durum FROM talep_kopyasi WHERE id = ?').get(talepId);
		if (!talep) throw new Error('Talep bulunamadı.');
		if (!TALEP_DURUMLARI.some((d) => d.anahtar === durum)) {
			throw new Error('Bilinmeyen talep durumu.');
		}

		db.exec('BEGIN');
		try {
			db.prepare('UPDATE talep_kopyasi SET durum = ? WHERE id = ?').run(durum, talepId);
			kuyrugaYaz(talepDurumuEsitlemeKaydi({ id: talepId, durum }));
			db.exec('COMMIT');
		} catch (hata) {
			db.exec('ROLLBACK');
			throw hata;
		}
		return { id: talepId, durum };
	}

	/* -------------------------------------------------------------- */
	/* Canlı akıştan gelen tek kayıt                                   */
	/* -------------------------------------------------------------- */

	/*
	  `veri/esitleme.mjs` içindeki `talepleriIceAl` aynı işi PAKET için
	  yapıyor: düzenli eşitlemede çekilen talep listesini yerele yazıyor.
	  Canlı akış paket değil tek tek olay taşıdığı için burada onun tek
	  kayıtlık karşılığı duruyor. İkisi de aynı iki kuralı uyguluyor:

	  1. Gelen veri GÜVENİLMEZ, çünkü sunucu ele geçmiş olabilir. Yalnızca
	     beklenen alanlar okunuyor, metin uzunluğu sınırlanıyor ve müşteri
	     kimliği yerelde gerçekten varsa bağlanıyor. Tanınmayan alan yok
	     sayılıyor.
	  2. `ON CONFLICT (id)` ile yazılıyor. Aynı mesaj hem akıştan hem
	     eşitlemeden gelebilir, üstelik sahibin kendi yanıtı da akıştan geri
	     döner (kimliği aynı, çünkü kuyruğa giden kimlikle yerel kopyaya
	     yazılan kimlik aynı). Hiçbiri ikinci kez görünmemeli.

	  Dönen `yeni` alanı "bu kayıt gerçekten ilk kez görüldü" demek.
	  Ekrandaki okunmamış işareti buna bakıyor: geri dönen kendi yanıtının
	  okunmamış sayılması yanlış olurdu.
	*/

	/** Akıştan gelen mesaj gövdesinin üst sınırı. `veri/esitleme.mjs`
	 *  içindeki paket sınırıyla aynı sayı; o sabit dışa açılmadığı için
	 *  burada tekrar yazılı. */
	const AKIS_METIN_SINIRI = 20000;

	const akisMusteriVarMi = db.prepare('SELECT 1 FROM musteri WHERE id = ?');
	const akisTalepVarMi = db.prepare('SELECT 1 FROM talep_kopyasi WHERE id = ?');
	const akisMesajVarMi = db.prepare('SELECT 1 FROM talep_mesaj_kopyasi WHERE id = ?');

	/*
	  Çakışmada `musteri_id` ve `is_id` KASITLI olarak güncellenmiyor.
	  Bağlantıyı yerel taraf kuruyor ve sunucunun uydurduğu bir kimlik var
	  olan bir bağı koparmamalı. `talepleriIceAl` de aynı şeyi yapıyor.
	*/
	const akisTalepYaz = db.prepare(
		`INSERT INTO talep_kopyasi (id, musteri_id, is_id, baslik, durum, oncelik, olusturuldu, guncellendi, cekildi)
		 VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (id) DO UPDATE SET
		   baslik = excluded.baslik, durum = excluded.durum, oncelik = excluded.oncelik,
		   guncellendi = excluded.guncellendi, cekildi = excluded.cekildi`,
	);
	const akisMesajYaz = db.prepare(
		`INSERT INTO talep_mesaj_kopyasi (id, talep_id, yazan, metin, zaman)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT (id) DO UPDATE SET metin = excluded.metin`,
	);
	/* Mesaj geldiğinde talebin son hareket damgası ilerliyor: liste bu alana
	   göre sıralı ve yeni yazışan talep üste çıkmalı. Geriye gitmiyor. */
	const akisTalepDamgasi = db.prepare(
		'UPDATE talep_kopyasi SET guncellendi = ? WHERE id = ? AND guncellendi < ?',
	);

	/** Sunucunun verdiği müşteri kimliğini yerelde gerçekten varsa kabul
	 *  eder, yoksa boş bırakır. */
	function akistanMusteri(ham) {
		const kimlik = ham ? String(ham) : '';
		return kimlik && akisMusteriVarMi.get(kimlik) ? kimlik : null;
	}

	function akistanTalep(ham) {
		if (!ham.id || typeof ham.baslik !== 'string') {
			return { atlandi: true, sebep: 'eksik alan' };
		}
		const id = String(ham.id);
		const zaman = simdi();
		const yeni = !akisTalepVarMi.get(id);
		akisTalepYaz.run(
			id,
			akistanMusteri(ham.musteri_id),
			String(ham.baslik).slice(0, 500),
			String(ham.durum ?? 'acik').slice(0, 40),
			ham.oncelik ? String(ham.oncelik).slice(0, 20) : null,
			String(ham.olusturuldu ?? zaman),
			String(ham.guncellendi ?? zaman),
			zaman,
		);
		return { tur: 'talep', id, talepId: id, yeni, atlandi: false };
	}

	function akistanMesaj(ham) {
		if (!ham.id || !ham.talep_id || typeof ham.metin !== 'string') {
			return { atlandi: true, sebep: 'eksik alan' };
		}
		const id = String(ham.id);
		const talepId = String(ham.talep_id);
		const yazan = ham.yazan === 'sahip' ? 'sahip' : 'musteri';
		const zaman = String(ham.zaman ?? simdi());
		const yeni = !akisMesajVarMi.get(id);

		db.exec('BEGIN');
		try {
			/*
			  Talep yerelde yoksa TASLAK bir satır kuruluyor. Sunucu her turda
			  önce talep sonra mesaj akıtıyor, yani normalde talep çoktan
			  yazılmış olur; ama sıraya güvenip mesajı düşürmek, müşterinin
			  ilk mesajını, yani en acil olanı kaybetmek demekti (yabancı
			  anahtar onu reddederdi). Akış mesajla birlikte başlığı ve
			  müşteri kimliğini de taşıyor, taslak bu yüzden kurulabiliyor.
			  Bir sonraki eşitleme gerçek satırı getirip üstüne yazıyor.
			*/
			if (!akisTalepVarMi.get(talepId)) {
				akisTalepYaz.run(
					talepId,
					akistanMusteri(ham.musteri_id),
					typeof ham.baslik === 'string' ? ham.baslik.slice(0, 500) : 'Başlıksız talep',
					'acik',
					null,
					zaman,
					zaman,
					simdi(),
				);
			}
			akisMesajYaz.run(id, talepId, yazan, ham.metin.slice(0, AKIS_METIN_SINIRI), zaman);
			akisTalepDamgasi.run(zaman, talepId, zaman);
			db.exec('COMMIT');
		} catch (hata) {
			db.exec('ROLLBACK');
			throw hata;
		}
		return { tur: 'mesaj', id, talepId, yazan, yeni, atlandi: false };
	}

	/**
	 * Canlı akıştan gelen tek olayı yerel kopyaya yazar.
	 *
	 * Tanınmayan tür sessizce atlanıyor: akışın ileride yeni bir olay türü
	 * taşıması, eski bir uygulamayı çökertmemeli.
	 *
	 * @returns {{ tur?: string, id?: string, talepId?: string, yazan?: string,
	 *            yeni?: boolean, atlandi: boolean, sebep?: string }}
	 */
	function akisOlayiniIsle(ham) {
		if (ham?.tur === 'talep') return akistanTalep(ham);
		if (ham?.tur === 'mesaj') return akistanMesaj(ham);
		return { atlandi: true, sebep: 'tanınmayan tür' };
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
		kuyrukBekleyenSayisi,
		esitlemeAyariYaz,
		esitlemeOzeti,
		otomatikAyariOku,
		otomatikAyariYaz,
		talepListesi,
		talepGetir,
		talepYanitla,
		talepDurumu,
		akisOlayiniIsle,
		sifrelemeVarMi: () => Boolean(kasa?.kullanilabilir?.()),
	};
}

/** Kuyruk satırının gövdesinden yalnızca kaydın kimliğini çıkarır. Gövde
 *  bozuksa kimlik yok sayılıyor; bir gösterim satırı yüzünden ekran
 *  çökmemeli. */
function kuyrukKaydininKimligi(govde) {
	try {
		return JSON.parse(govde)?.id ?? null;
	} catch {
		return null;
	}
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

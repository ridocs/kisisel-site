/*
  Veri katmanının testleri. Gerçek SQLite kullanıyor ama Electron
  kullanmıyor: şifreleme sahte bir "kasa" ile veriliyor.

  Çalıştırma: node --test yonetim/depo.test.mjs
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { yerelAc } from '../veri/db.mjs';
import { depoKur } from './depo.mjs';

/*
  Sahte kasa. XOR ile geri çevrilebilir bir dönüşüm: gerçek şifreleme
  DEĞİL, ama bir şeyi doğru taklit ediyor, çıktısında düz metin GEÇMİYOR.
  Böylece "veritabanında düz metin var mı" testi anlamlı oluyor.
*/
function sahteKasa(acikMi = true) {
	return {
		kullanilabilir: () => acikMi,
		sifrele: (metin) => Buffer.from(Buffer.from(metin, 'utf8').map((b) => b ^ 0x5a)),
		coz: (baytlar) => Buffer.from(Buffer.from(baytlar).map((b) => b ^ 0x5a)).toString('utf8'),
	};
}

function ortamKur(kasaAcik = true) {
	const dizin = mkdtempSync(join(tmpdir(), 'yonetim-test-'));
	const yol = join(dizin, 'yerel.db');
	const db = yerelAc(yol);
	return {
		dizin,
		yol,
		db,
		depo: depoKur(db, sahteKasa(kasaAcik)),
		kapat() {
			try {
				db.close();
			} catch {
				// Zaten kapalıysa sorun değil.
			}
			rmSync(dizin, { recursive: true, force: true });
		},
	};
}

/** Veritabanı dosyalarının ham baytları. WAL kipinde veri `-wal` dosyasında
 *  da olabiliyor; ikisine birden bakılıyor. */
function hamBaytlar(yol) {
	const parcalar = [readFileSync(yol)];
	for (const ek of ['-wal', '-shm']) {
		if (existsSync(yol + ek)) parcalar.push(readFileSync(yol + ek));
	}
	return Buffer.concat(parcalar).toString('latin1');
}

const ORNEK_MUSTERI = {
	ad_soyad: 'Ayşe Yılmaz',
	telefon: '05551112233',
	ilce: 'Çankaya',
	sehir: 'Ankara',
	tc: '10000000146',
	vergi: '1234567890',
	not_metni: 'Eski müşteri',
	durum: 'etkin',
};

/* ------------------------------------------------------------------ */
/* Şifreli alanlar                                                     */
/* ------------------------------------------------------------------ */

test('TC ve vergi numarası veritabanına düz metin yazılmıyor', () => {
	const o = ortamKur(true);
	try {
		const { id } = o.depo.musteriKaydet(ORNEK_MUSTERI);

		const ham = o.db.prepare('SELECT tc_sifreli, vergi_sifreli FROM musteri WHERE id = ?').get(id);
		assert.ok(ham.tc_sifreli?.length > 0, 'TC şifreli olarak yazılmalı');
		const tcBaytlari = Buffer.from(ham.tc_sifreli).toString('utf8');
		assert.ok(!tcBaytlari.includes('10000000146'), 'TC düz metin geçmemeli');
		const vergiBaytlari = Buffer.from(ham.vergi_sifreli).toString('utf8');
		assert.ok(!vergiBaytlari.includes('1234567890'), 'vergi numarası düz metin geçmemeli');

		// Dosyanın kendisinde de geçmemeli.
		o.db.close();
		const dosya = hamBaytlar(o.yol);
		assert.ok(!dosya.includes('10000000146'), 'veritabanı dosyasında TC düz metin var');
		assert.ok(!dosya.includes('1234567890'), 'veritabanı dosyasında vergi numarası düz metin var');
	} finally {
		o.kapat();
	}
});

test('şifreli alanlar okunurken geri çözülüyor', () => {
	const o = ortamKur(true);
	try {
		const { id, uyari } = o.depo.musteriKaydet(ORNEK_MUSTERI);
		assert.equal(uyari, null);
		const kayit = o.depo.musteriGetir(id);
		assert.equal(kayit.tc, '10000000146');
		assert.equal(kayit.vergi, '1234567890');
		assert.equal(kayit.ad_soyad, 'Ayşe Yılmaz');
		assert.equal(kayit.tcVar, true);
	} finally {
		o.kapat();
	}
});

test('anahtarlık kapalıyken TC ve vergi numarası SESSİZCE düz metin yazılmıyor', () => {
	const o = ortamKur(false);
	try {
		const { id, uyari } = o.depo.musteriKaydet(ORNEK_MUSTERI);
		assert.ok(uyari, 'kullanıcıya uyarı dönmeli');
		assert.match(uyari, /şifrelen/i);

		const ham = o.db.prepare('SELECT * FROM musteri WHERE id = ?').get(id);
		assert.equal(ham.tc_sifreli, null, 'TC hiç yazılmamalı');
		assert.equal(ham.vergi_sifreli, null, 'vergi numarası hiç yazılmamalı');
		// Diğer alanlar kaydedilmiş olmalı: adı kaybetmek daha kötü.
		assert.equal(ham.ad_soyad, 'Ayşe Yılmaz');

		o.db.close();
		assert.ok(!hamBaytlar(o.yol).includes('10000000146'));
	} finally {
		o.kapat();
	}
});

test('anahtarlık kapalıyken mevcut şifreli değer silinmiyor', () => {
	const dizin = mkdtempSync(join(tmpdir(), 'yonetim-test-'));
	const yol = join(dizin, 'yerel.db');
	const db = yerelAc(yol);
	try {
		const acik = depoKur(db, sahteKasa(true));
		const { id } = acik.musteriKaydet(ORNEK_MUSTERI);

		// Arayüz, anahtarlık kapalıyken TC alanını kapatıyor ve boş gönderiyor.
		// Bu, daha önce şifrelenmiş değeri SİLMEMELİ.
		const kapali = depoKur(db, sahteKasa(false));
		const sessiz = kapali.musteriKaydet({ id, ad_soyad: 'Ayşe Yılmaz Kaya', durum: 'etkin' });
		assert.equal(sessiz.uyari, null, 'yeni değer girilmediyse uyarıya gerek yok');

		let ham = db.prepare('SELECT ad_soyad, tc_sifreli FROM musteri WHERE id = ?').get(id);
		assert.equal(ham.ad_soyad, 'Ayşe Yılmaz Kaya', 'ad güncellenmeliydi');
		assert.ok(ham.tc_sifreli?.length > 0, 'eski şifreli TC silinmemeliydi');

		// Kullanıcı gerçekten yeni bir TC yazdıysa: yazılmıyor ve uyarılıyor.
		const uyarili = kapali.musteriKaydet({
			id,
			ad_soyad: 'Ayşe Yılmaz Kaya',
			tc: '29896640848',
			durum: 'etkin',
		});
		assert.ok(uyarili.uyari, 'yeni TC girildiyse uyarı dönmeli');
		ham = db.prepare('SELECT tc_sifreli FROM musteri WHERE id = ?').get(id);
		assert.equal(
			depoKur(db, sahteKasa(true)).musteriGetir(id).tc,
			'10000000146',
			'yeni TC yazılmamalı, eskisi durmalı',
		);
	} finally {
		db.close();
		rmSync(dizin, { recursive: true, force: true });
	}
});

/* ------------------------------------------------------------------ */
/* Eşitleme kuyruğu                                                    */
/* ------------------------------------------------------------------ */

test('kuyruğa hassas veri SIZMIYOR', () => {
	const o = ortamKur(true);
	try {
		const { id: musteriId } = o.depo.musteriKaydet(ORNEK_MUSTERI);
		const { id: isId } = o.depo.isKaydet({
			musteri_id: musteriId,
			ad: 'Site yenileme',
			// Özet artık müşteriye gidiyor, dolayısıyla burada iç not değil
			// müşterinin okuyacağı metin duruyor.
			ozet: 'İki dilli tanıtım sitesi',
			tur: 'Web sitesi',
			durum: 'suruyor',
			tutar_kurus: 1_234_567,
			on_odeme_orani: 45,
			tekrar_eden: 0,
			baslangic: '2026-09-01',
			teslim: '2026-09-20',
		});
		o.depo.odemeKaydet({
			is_id: isId,
			tur: 'on_odeme',
			tutar_kurus: 555_555,
			tarih: '2026-09-02',
			yontem: 'Havale',
		});
		o.depo.revizeKaydet({
			is_id: isId,
			baslik: 'Ek sayfa',
			tutar_kurus: 99_999,
			ucretli: 1,
			tarih: '2026-09-10',
		});
		o.depo.davetUret(musteriId);

		const kuyruk = o.depo.kuyrukBekleyenler();
		/*
		  Arama havuzundan kimlik ve karma alanları çıkarılıyor. İkisi de
		  rastgele onaltılık metin, yani içlerinde herhangi bir rakam dizisi
		  rastlantıyla geçebilir ve testi yanlış yere düşürür. Zaten izin
		  verilen alan kontrolü aşağıda ayrıca yapılıyor.
		*/
		const hepsi = kuyruk
			.map((k) => {
				const govde = JSON.parse(k.govde);
				delete govde.id;
				delete govde.musteri_id;
				delete govde.is_id;
				delete govde.anahtar_karmasi;
				return JSON.stringify(govde);
			})
			.join('\n');

		/*
		  24 EYLÜL 2026: ödeme artık kuyruğa GİRİYOR, revize hâlâ girmiyor.
		  İş kaydı durum değişikliğiyle birlikte otomatik bir ilerleme
		  aşaması da düşürüyor, o da listede.
		*/
		assert.deepEqual(
			[...new Set(kuyruk.map((k) => k.islem))].sort(),
			['asama.yaz', 'davet.yaz', 'is.yaz', 'musteri.yaz', 'odeme.yaz'],
		);

		const sizmamasiGerekenler = [
			'10000000146', // TC
			'1234567890', // vergi numarası
			'05551112233', // telefon
			'Çankaya', // ilçe
			'Ankara', // şehir
			'99999', // revize tutarı: revize sunucuya çıkmıyor
			'Havale', // ödeme yöntemi
			'Ek sayfa', // revize başlığı
			'Web sitesi', // iş türü
			'2026-09-01', // başlangıç tarihi: yalnızca hedef teslim çıkıyor
		];
		for (const parca of sizmamasiGerekenler) {
			assert.ok(!hepsi.includes(parca), `kuyruğa sızdı: ${parca}\n${hepsi}`);
		}

		// Buna karşılık gitmesi GEREKENLER orada.
		assert.ok(hepsi.includes('Ayşe Yılmaz'), 'görünen ad gitmeliydi');
		assert.ok(hepsi.includes('Site yenileme'), 'işin görünen adı gitmeliydi');
		assert.ok(hepsi.includes('1234567'), 'iş tutarı gitmeliydi');
		assert.ok(hepsi.includes('555555'), 'ödeme tutarı gitmeliydi');
		assert.ok(hepsi.includes('2026-09-20'), 'hedef teslim tarihi gitmeliydi');

		// Her gövde yalnızca izin verilen alanlardan oluşmalı.
		const izinli = {
			'musteri.yaz': ['id', 'gorunen_ad', 'durum'],
			'is.yaz': [
				'id', 'musteri_id', 'ad', 'durum', 'ozet', 'tutar_kurus',
				'para_birimi', 'teslim_hedefi',
			],
			'odeme.yaz': ['id', 'is_id', 'tur', 'tutar_kurus', 'tarih'],
			'asama.yaz': [
				'id', 'is_id', 'sira', 'kaynak', 'baslik', 'aciklama', 'durum', 'tarih',
			],
			'davet.yaz': ['id', 'musteri_id', 'anahtar_karmasi', 'son_kullanma'],
		};
		for (const kayit of kuyruk) {
			for (const alan of Object.keys(JSON.parse(kayit.govde))) {
				assert.ok(izinli[kayit.islem].includes(alan), `${kayit.islem} içinde izinsiz alan: ${alan}`);
			}
		}
	} finally {
		o.kapat();
	}
});

test('davet anahtarının kendisi hiçbir yere kaydedilmiyor', () => {
	const o = ortamKur(true);
	try {
		const { id: musteriId } = o.depo.musteriKaydet({ ad_soyad: 'Mehmet Demir' });
		const davet = o.depo.davetUret(musteriId);

		assert.match(davet.metin, /^[0-9A-Z-]+$/);
		assert.ok(!('baytlar' in davet), 'ham baytlar dışarı çıkmamalı');

		// Kuyrukta anahtarın kendisi değil, 64 karakterlik karma olmalı.
		const govde = JSON.parse(o.depo.kuyrukBekleyenler().find((k) => k.islem === 'davet.yaz').govde);
		assert.match(govde.anahtar_karmasi, /^[0-9a-f]{64}$/);

		o.db.close();
		const dosya = hamBaytlar(o.yol);
		const tiresiz = davet.metin.replace(/-/g, '');
		assert.ok(!dosya.includes(davet.metin), 'anahtar metni veritabanına yazılmış');
		assert.ok(!dosya.includes(tiresiz), 'anahtarın tiresiz hâli veritabanına yazılmış');
	} finally {
		o.kapat();
	}
});

test('iki davet aynı anahtarı üretmiyor', () => {
	const o = ortamKur(true);
	try {
		const { id } = o.depo.musteriKaydet({ ad_soyad: 'Mehmet Demir' });
		const kume = new Set();
		for (let i = 0; i < 25; i++) kume.add(o.depo.davetUret(id).metin);
		assert.equal(kume.size, 25);
	} finally {
		o.kapat();
	}
});

/* ------------------------------------------------------------------ */
/* Liste, arama ve hesap                                               */
/* ------------------------------------------------------------------ */

test('arşivdeki müşteri varsayılan listede görünmüyor', () => {
	const o = ortamKur(true);
	try {
		const { id } = o.depo.musteriKaydet({ ad_soyad: 'Zeynep Ak' });
		o.depo.musteriKaydet({ ad_soyad: 'Ali Vural' });
		o.depo.musteriDurumu(id, 'arsiv');

		assert.deepEqual(o.depo.musteriListesi().map((m) => m.ad_soyad), ['Ali Vural']);
		assert.equal(o.depo.musteriListesi({ arsivDahil: true }).length, 2);
	} finally {
		o.kapat();
	}
});

test('arama Türkçe büyük ve küçük harfi ayırt etmiyor', () => {
	const o = ortamKur(true);
	try {
		o.depo.musteriKaydet({ ad_soyad: 'İpek Işık', sehir: 'İstanbul' });
		assert.equal(o.depo.musteriListesi({ arama: 'ipek' }).length, 1);
		assert.equal(o.depo.musteriListesi({ arama: 'İSTANBUL' }).length, 1);
		assert.equal(o.depo.musteriListesi({ arama: 'ışık' }).length, 1);
		assert.equal(o.depo.musteriListesi({ arama: 'bulunmaz' }).length, 0);
	} finally {
		o.kapat();
	}
});

test('iş detayı ödemeler ve revizelerle birlikte hesaplanıyor', () => {
	const o = ortamKur(true);
	try {
		const { id: musteriId } = o.depo.musteriKaydet({ ad_soyad: 'Ali Vural' });
		const { id: isId } = o.depo.isKaydet({
			musteri_id: musteriId,
			ad: 'Katalog',
			durum: 'suruyor',
			tutar_kurus: 1_000_000,
			on_odeme_orani: 50,
			tekrar_eden: 0,
		});
		o.depo.odemeKaydet({ is_id: isId, tur: 'on_odeme', tutar_kurus: 500_000, tarih: '2026-09-01' });
		o.depo.revizeKaydet({ is_id: isId, baslik: 'Ek', tutar_kurus: 200_000, ucretli: 1, tarih: '2026-09-05' });

		const is = o.depo.isGetir(isId);
		assert.equal(is.hesap.toplamKurus, 1_200_000);
		assert.equal(is.hesap.tahsilEdilenKurus, 500_000);
		assert.equal(is.hesap.kalanKurus, 700_000);
		assert.equal(is.hesap.onOdemeBeklenenKurus, 500_000);
		assert.equal(is.hesap.onOdemeTamamMi, true);
		assert.equal(is.odemeler.length, 1);
		assert.equal(is.revizeler.length, 1);
	} finally {
		o.kapat();
	}
});

test('iş silinince ödemeleri ve revizeleri de gidiyor', () => {
	const o = ortamKur(true);
	try {
		const { id: musteriId } = o.depo.musteriKaydet({ ad_soyad: 'Ali Vural' });
		const { id: isId } = o.depo.isKaydet({
			musteri_id: musteriId,
			ad: 'Katalog',
			durum: 'suruyor',
			tutar_kurus: 100,
			tekrar_eden: 0,
		});
		o.depo.odemeKaydet({ is_id: isId, tur: 'on_odeme', tutar_kurus: 100, tarih: '2026-09-01' });
		o.depo.isSil(isId);
		assert.equal(o.depo.odemeListesi().length, 0);
		assert.equal(o.depo.isListesi().length, 0);
	} finally {
		o.kapat();
	}
});

test('istatistik veritabanından okunan kayıtlarla hesaplanıyor', () => {
	const o = ortamKur(true);
	try {
		const { id: musteriId } = o.depo.musteriKaydet({ ad_soyad: 'Ali Vural' });
		const { id: isId } = o.depo.isKaydet({
			musteri_id: musteriId,
			ad: 'Katalog',
			tur: 'CAD',
			durum: 'teslim_edildi',
			tutar_kurus: 800_000,
			on_odeme_orani: 50,
			tekrar_eden: 1,
			teslim: '2026-09-15',
		});
		o.depo.odemeKaydet({ is_id: isId, tur: 'on_odeme', tutar_kurus: 400_000, tarih: '2026-09-15' });

		const s = o.depo.istatistik('2026-09');
		assert.equal(s.ayinIsSayisi, 1);
		assert.equal(s.aylikToplamAlinacakKurus, 800_000);
		assert.equal(s.aylikKalanKurus, 400_000);
		assert.equal(s.aylikYapilanOnOdemeKurus, 400_000);
		assert.equal(s.tekrarEdenSayisi, 1);
		assert.deepEqual(s.turDagilimi, [{ tur: 'CAD', adet: 1 }]);

		assert.ok(o.depo.aylar().includes('2026-09'));
		// Başka bir ayda aynı iş sayılmamalı.
		assert.equal(o.depo.istatistik('2026-10').ayinIsSayisi, 0);
	} finally {
		o.kapat();
	}
});

test('olmayan müşteriye davet üretilemiyor', () => {
	const o = ortamKur(true);
	try {
		assert.throws(() => o.depo.davetUret('yok-boyle-bir-id'), /bulunamadı/i);
	} finally {
		o.kapat();
	}
});

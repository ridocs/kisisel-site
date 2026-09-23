/*
  Yerel defter ile sunucudaki kısıtlı kopya arasındaki eşitleme.

  Tasarımın kalbi burada (PANEL-TASARIMI.md §4): sunucuya ne gittiğine bu dosya
  karar veriyor. Kural beyaz liste: izin verilen alanlar tek tek sayılıyor,
  geri kalan her şey düşüyor. Kara liste yazmıyoruz, çünkü kara listeye yeni bir
  alan eklemeyi unutmak sessizce veri sızdırır; beyaz listede unutulan alan
  sadece gönderilmez ve bu fark edilir.

  Yön:
    yerel  -> sunucu : müşterinin görünen adı, işin adı ve durumu, davet karması
    sunucu -> yerel  : destek talepleri ve mesajları

  Sunucu hiçbir zaman yerel veritabanına yazamaz. Yerel taraf çeker ve neyi
  kabul edeceğine kendisi karar verir; ele geçirilmiş bir sunucu sahibin
  defterini bozamaz.
*/

import { simdi } from './db.mjs';
import { IZINLI_ALANLAR } from './izinli-alanlar.mjs';

/*
  Sunucuya çıkmasına izin verilen alanlar. Bu listeyi genişletmeden önce
  şu soruyu cevapla: bu bilgi sunucu ele geçtiğinde sızsa ne olur?
  Tutar, TC, vergi numarası, telefon ve adres bilerek burada yok.
*/
export { IZINLI_ALANLAR, ISLEMLER, HASSAS_ALAN_DESENI } from './izinli-alanlar.mjs';

/**
 * Bir eşitleme işlemini beyaz listeden geçirir.
 * Tanınmayan işlem veya eksik zorunlu alan varsa hata fırlatır; sessizce
 * yarım kayıt göndermek, hiç göndermemekten kötüdür.
 */
export function suz(islem, govde) {
	const izinli = IZINLI_ALANLAR[islem];
	if (!izinli) throw new Error(`Tanınmayan eşitleme işlemi: ${islem}`);
	const temiz = {};
	for (const alan of izinli) {
		const deger = govde?.[alan];
		if (deger === undefined || deger === null) continue;
		temiz[alan] = deger instanceof Uint8Array ? Buffer.from(deger).toString('hex') : deger;
	}
	if (temiz.id === undefined) throw new Error(`${islem} için id zorunlu`);
	return temiz;
}

/** İşlemi kuyruğa yazar. Gönderme ayrı bir adım, burada ağ işi yok. */
export function kuyrugaYaz(db, islem, govde) {
	const temiz = suz(islem, govde);
	db.prepare(
		'INSERT INTO esitleme_kuyrugu (islem, govde, olusturuldu) VALUES (?, ?, ?)',
	).run(islem, JSON.stringify(temiz), simdi());
	return temiz;
}

/** Gönderilmeyi bekleyen işlemler, eskiden yeniye. */
export function bekleyenler(db, sinir = 500) {
	return db
		.prepare(
			'SELECT id, islem, govde FROM esitleme_kuyrugu WHERE gonderildi IS NULL ORDER BY id LIMIT ?',
		)
		.all(sinir)
		.map((satir) => ({ id: satir.id, islem: satir.islem, govde: JSON.parse(satir.govde) }));
}

/** Gönderimi onaylanan satırları işaretler. */
export function gonderildiIsaretle(db, kimlikler) {
	if (!kimlikler.length) return 0;
	const zaman = simdi();
	const deyim = db.prepare('UPDATE esitleme_kuyrugu SET gonderildi = ? WHERE id = ?');
	db.exec('BEGIN');
	try {
		for (const id of kimlikler) deyim.run(zaman, id);
		db.exec('COMMIT');
	} catch (hata) {
		db.exec('ROLLBACK');
		throw hata;
	}
	return kimlikler.length;
}

/**
 * Sunucu tarafında uygulanacak paketi hazırlar.
 * Paket kendi başına anlamlı ve tekrar uygulanabilir olmalı: aynı paket iki kez
 * işlenirse sonuç değişmemeli, çünkü yarım kalan bir gönderim tekrarlanacak.
 */
export function paketHazirla(satirlar) {
	return {
		surum: 1,
		uretildi: simdi(),
		islemler: satirlar.map((s) => ({ sira: s.id, islem: s.islem, govde: suz(s.islem, s.govde) })),
	};
}

/*
  Sunucudan gelen talepleri yerele yazar.

  Gelen veri GÜVENİLMEZ kabul ediliyor: sunucu ele geçmiş olabilir. Bu yüzden
  yalnızca beklenen alanlar okunuyor, metin uzunluğu sınırlanıyor ve müşteri
  kimliği yerelde gerçekten varsa bağlanıyor. Tanınmayan alan yok sayılıyor.
*/
const METIN_SINIRI = 20000;

export function talepleriIceAl(db, gelen) {
	if (!gelen || !Array.isArray(gelen.talepler)) throw new Error('Beklenen biçimde değil');
	const zaman = simdi();
	let yazilan = 0;
	let atlanan = 0;

	const talepYaz = db.prepare(
		`INSERT INTO talep_kopyasi (id, musteri_id, is_id, baslik, durum, oncelik, olusturuldu, guncellendi, cekildi)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (id) DO UPDATE SET
		   baslik = excluded.baslik, durum = excluded.durum, oncelik = excluded.oncelik,
		   guncellendi = excluded.guncellendi, cekildi = excluded.cekildi`,
	);
	const mesajYaz = db.prepare(
		`INSERT INTO talep_mesaj_kopyasi (id, talep_id, yazan, metin, zaman)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT (id) DO UPDATE SET metin = excluded.metin`,
	);
	const musteriVarMi = db.prepare('SELECT 1 FROM musteri WHERE id = ?');
	const isVarMi = db.prepare('SELECT 1 FROM is_kaydi WHERE id = ?');

	db.exec('BEGIN');
	try {
		for (const ham of gelen.talepler) {
			if (!ham?.id || typeof ham.baslik !== 'string') {
				atlanan++;
				continue;
			}
			// Yerelde olmayan bir müşteriye bağlamak yerine boş bırak: sunucunun
			// uydurduğu bir kimlik yerel defterde kayıt açmasın.
			const musteri = ham.musteri_id && musteriVarMi.get(ham.musteri_id) ? ham.musteri_id : null;
			const isKaydi = ham.is_id && isVarMi.get(ham.is_id) ? ham.is_id : null;
			talepYaz.run(
				String(ham.id),
				musteri,
				isKaydi,
				String(ham.baslik).slice(0, 500),
				String(ham.durum ?? 'acik').slice(0, 40),
				ham.oncelik ? String(ham.oncelik).slice(0, 20) : null,
				String(ham.olusturuldu ?? zaman),
				String(ham.guncellendi ?? zaman),
				zaman,
			);
			for (const mesaj of Array.isArray(ham.mesajlar) ? ham.mesajlar : []) {
				if (!mesaj?.id || typeof mesaj.metin !== 'string') {
					atlanan++;
					continue;
				}
				mesajYaz.run(
					String(mesaj.id),
					String(ham.id),
					mesaj.yazan === 'sahip' ? 'sahip' : 'musteri',
					mesaj.metin.slice(0, METIN_SINIRI),
					String(mesaj.zaman ?? zaman),
				);
			}
			yazilan++;
		}
		db.exec('COMMIT');
	} catch (hata) {
		db.exec('ROLLBACK');
		throw hata;
	}
	return { yazilan, atlanan };
}

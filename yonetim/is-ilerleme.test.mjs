/*
  İLERLEME AĞACI, ÖDEME DÖKÜMÜ, DOSYA PAYLAŞIMI VE İŞ YAZIŞMASI

  Dört özelliğin de ortak sorusu aynı: sunucuya NE gidiyor, ne gitmiyor ve
  bir adım yarıda kalırsa ortada ne kalıyor. Testler bu yüzden çoğunlukla
  eşitleme kuyruğuna bakıyor; kuyruk, sunucuya çıkanın tek kapısı.

  GERÇEK SCP ÇAĞRILMIYOR. Dosya taşıma `depoKur`a dışarıdan veriliyor ve
  burada sahtesi kullanılıyor. Böylece "gönderim başarısızsa künye kuyruğa
  yazılmıyor" kuralı ağa hiç çıkılmadan sınanabiliyor.

  Çalıştırma: node --test yonetim/is-ilerleme.test.mjs
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { yerelAc } from '../veri/db.mjs';
import { depoKur } from './depo.mjs';
import { otomatikAsamaKimligi } from './is-mantigi.mjs';

/** Sahte kasa: bu dosyadaki testlerin şifrelemeyle işi yok, ama depo bir
 *  kasa bekliyor. */
const KASA = {
	kullanilabilir: () => true,
	sifrele: (metin) => Buffer.from(metin, 'utf8'),
	coz: (baytlar) => Buffer.from(baytlar).toString('utf8'),
};

/**
 * Sahte dosya taşıma.
 *
 * `incele` diske hiç bakmıyor: gerçek `dosyayiIncele` tür ve boyut denetimi
 * yapıyor ve onun kendi testi var. Buradaki soru taşımanın sonucunun depoyu
 * nasıl etkilediği.
 */
function sahteTasima({ gonderimHatasi = null } = {}) {
	const cagrilar = { incele: [], gonder: [] };
	return {
		cagrilar,
		arac: {
			incele: async (yerelYol) => {
				cagrilar.incele.push(yerelYol);
				return {
					gosterilen_ad: 'teknik-resim.pdf',
					// Gerçeğinde rastgele; depo yalnızca UZANTISINI kullanıyor.
					depo_adi: 'rastgele-ad.pdf',
					tur: 'application/pdf',
					boyut: 4096,
					sha256: Buffer.alloc(32, 0x2b),
					gorsel_mi: 0,
				};
			},
			gonder: async (yerelYol, depoAdi) => {
				cagrilar.gonder.push({ yerelYol, depoAdi });
				if (gonderimHatasi) throw new Error(gonderimHatasi);
				return `/uzak/dosyalar/${depoAdi}`;
			},
		},
	};
}

function ortamKur(secenekler = {}) {
	const dizin = mkdtempSync(join(tmpdir(), 'yonetim-ilerleme-'));
	const db = yerelAc(join(dizin, 'yerel.db'));
	const tasima = sahteTasima(secenekler);
	const depo = depoKur(db, KASA, { dosyaTasima: tasima.arac });
	return {
		db,
		depo,
		tasima,
		/** Kuyruk satırları, gövdeleri çözülmüş hâlde ve eskiden yeniye. */
		kuyruk() {
			return db
				.prepare('SELECT islem, govde FROM esitleme_kuyrugu ORDER BY id')
				.all()
				.map((s) => ({ islem: s.islem, govde: JSON.parse(s.govde) }));
		},
		kuyrukSuz(islem) {
			return this.kuyruk().filter((k) => k.islem === islem);
		},
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

function ornekIs(depo, durum = 'teklif') {
	const { id: musteriId } = depo.musteriKaydet({ ad_soyad: 'Ayşe Yılmaz' });
	const { id: isId } = depo.isKaydet({
		musteri_id: musteriId,
		ad: 'Kalıp tasarımı',
		durum,
		tutar_kurus: 1_500_000,
		tekrar_eden: 0,
	});
	return { musteriId, isId };
}

/* ------------------------------------------------------------------ */
/* 1) Otomatik aşama                                                   */
/* ------------------------------------------------------------------ */

test('işin durumu değişince otomatik aşama düşüyor', () => {
	const o = ortamKur();
	try {
		const { musteriId, isId } = ornekIs(o.depo, 'teklif');

		// Yeni kayıtta da bir aşama düşüyor: ağaç boş başlamıyor.
		let asamalar = o.depo.asamaListesi(isId);
		assert.equal(asamalar.length, 1);
		assert.equal(asamalar[0].baslik, 'Teklif verildi');
		assert.equal(asamalar[0].kaynak, 'otomatik');

		o.depo.isKaydet({
			id: isId,
			musteri_id: musteriId,
			ad: 'Kalıp tasarımı',
			durum: 'suruyor',
			tutar_kurus: 1_500_000,
			tekrar_eden: 0,
		});

		asamalar = o.depo.asamaListesi(isId);
		assert.deepEqual(
			asamalar.map((a) => a.baslik),
			['Teklif verildi', 'İş sürüyor'],
		);
		assert.equal(asamalar[1].durum, 'suruyor');

		// Aynı durumla ikinci kayıt YENİ aşama doğurmuyor: durum değişmedi.
		o.depo.isKaydet({
			id: isId,
			musteri_id: musteriId,
			ad: 'Kalıp tasarımı (yeni ad)',
			durum: 'suruyor',
			tutar_kurus: 1_500_000,
			tekrar_eden: 0,
		});
		assert.equal(o.depo.asamaListesi(isId).length, 2);

		// Teslime geçince "sürüyor" aşaması tamamlandıya çekiliyor, yoksa
		// ağaçta aynı anda hem süren hem teslim edilmiş bir iş görünürdü.
		o.depo.isKaydet({
			id: isId,
			musteri_id: musteriId,
			ad: 'Kalıp tasarımı',
			durum: 'teslim_edildi',
			tutar_kurus: 1_500_000,
			tekrar_eden: 0,
		});
		asamalar = o.depo.asamaListesi(isId);
		assert.equal(asamalar.length, 3);
		assert.equal(asamalar.find((a) => a.baslik === 'İş sürüyor').durum, 'tamamlandi');
		assert.equal(asamalar.find((a) => a.baslik === 'Teslim edildi').durum, 'tamamlandi');

		// Otomatik aşamalar kuyruğa da gidiyor.
		const gidenler = o.kuyrukSuz('asama.yaz').map((k) => k.govde.baslik);
		assert.ok(gidenler.includes('Teklif verildi'));
		assert.ok(gidenler.includes('İş sürüyor'));
		assert.ok(gidenler.includes('Teslim edildi'));
	} finally {
		o.kapat();
	}
});

test('aynı duruma geri dönülürse aşama ikiye katlanmıyor', () => {
	const o = ortamKur();
	try {
		const { musteriId, isId } = ornekIs(o.depo, 'teklif');
		const temel = {
			id: isId,
			musteri_id: musteriId,
			ad: 'Kalıp tasarımı',
			tutar_kurus: 1_500_000,
			tekrar_eden: 0,
		};
		o.depo.isKaydet({ ...temel, durum: 'suruyor' });
		o.depo.isKaydet({ ...temel, durum: 'teklif' });
		o.depo.isKaydet({ ...temel, durum: 'suruyor' });

		const asamalar = o.depo.asamaListesi(isId);
		assert.equal(asamalar.length, 2, 'gidiş gelişte aynı aşama üstüne yazılmalı');
		assert.ok(asamalar.some((a) => a.id === otomatikAsamaKimligi(isId, 'suruyor')));
	} finally {
		o.kapat();
	}
});

test('iptal edilen işe otomatik aşama düşmüyor', () => {
	const o = ortamKur();
	try {
		const { musteriId, isId } = ornekIs(o.depo, 'teklif');
		o.depo.isKaydet({
			id: isId,
			musteri_id: musteriId,
			ad: 'Kalıp tasarımı',
			durum: 'iptal',
			tutar_kurus: 1_500_000,
			tekrar_eden: 0,
		});
		assert.deepEqual(
			o.depo.asamaListesi(isId).map((a) => a.baslik),
			['Teklif verildi'],
		);
	} finally {
		o.kapat();
	}
});

/* ------------------------------------------------------------------ */
/* 2) Paylaşılmayan aşama                                              */
/* ------------------------------------------------------------------ */

test('paylaşılmayan aşama kuyruğa YAZILMIYOR', () => {
	const o = ortamKur();
	try {
		const { isId } = ornekIs(o.depo);
		const oncekiSayi = o.kuyrukSuz('asama.yaz').length;

		const { id } = o.depo.asamaKaydet({
			is_id: isId,
			baslik: 'Numune tedarikçiden geldi',
			aciklama: 'Müşterinin bilmesine gerek yok',
			durum: 'tamamlandi',
			tarih: '2026-09-20',
			sira: 25,
			paylasildi: 0,
		});

		// Yerelde duruyor.
		const yerel = o.depo.asamaListesi(isId).find((a) => a.id === id);
		assert.ok(yerel, 'aşama yerel deftere yazılmalı');
		assert.equal(yerel.paylasildi, 0);

		// Kuyrukta yok.
		assert.equal(o.kuyrukSuz('asama.yaz').length, oncekiSayi);
		const hepsi = JSON.stringify(o.kuyruk());
		assert.ok(!hepsi.includes('Numune tedarikçiden geldi'), 'gizli aşama kuyruğa sızdı');
		assert.ok(!hepsi.includes('Müşterinin bilmesine gerek yok'));
	} finally {
		o.kapat();
	}
});

test('paylaşımdan çıkarılan aşama için silme kaydı yazılıyor', () => {
	const o = ortamKur();
	try {
		const { isId } = ornekIs(o.depo);
		const { id } = o.depo.asamaKaydet({
			is_id: isId,
			baslik: 'Teknik resim onaylandı',
			aciklama: '',
			durum: 'tamamlandi',
			tarih: '2026-09-21',
			sira: 25,
			paylasildi: 1,
		});
		assert.equal(o.kuyrukSuz('asama.yaz').some((k) => k.govde.id === id), true);

		o.depo.asamaKaydet({
			id,
			is_id: isId,
			baslik: 'Teknik resim onaylandı',
			aciklama: '',
			durum: 'tamamlandi',
			tarih: '2026-09-21',
			sira: 25,
			paylasildi: 0,
		});

		assert.deepEqual(
			o.kuyrukSuz('asama.sil').map((k) => k.govde.id),
			[id],
			'paylaşımdan çıkarılan aşama sunucudan da silinmeli',
		);
	} finally {
		o.kapat();
	}
});

test('hiç paylaşılmamış aşama silinince kuyruğa silme kaydı girmiyor', () => {
	const o = ortamKur();
	try {
		const { isId } = ornekIs(o.depo);
		const { id } = o.depo.asamaKaydet({
			is_id: isId,
			baslik: 'İç not',
			aciklama: '',
			durum: 'bekliyor',
			tarih: '2026-09-21',
			sira: 26,
			paylasildi: 0,
		});
		o.depo.asamaSil(id);
		assert.equal(o.kuyrukSuz('asama.sil').length, 0);
		assert.equal(o.depo.asamaListesi(isId).some((a) => a.id === id), false);
	} finally {
		o.kapat();
	}
});

/* ------------------------------------------------------------------ */
/* 3) Ödeme dökümü                                                     */
/* ------------------------------------------------------------------ */

test('ödeme kuyruğa gidiyor ama YÖNTEM ve İÇ NOT sızmıyor', () => {
	const o = ortamKur();
	try {
		const { isId } = ornekIs(o.depo);
		const { id } = o.depo.odemeKaydet({
			is_id: isId,
			tur: 'on_odeme',
			tutar_kurus: 750_000,
			tarih: '2026-09-22',
			yontem: 'Havale, Ziraat',
			not_metni: 'Fatura kesilmedi',
		});

		const kayitlar = o.kuyrukSuz('odeme.yaz');
		assert.equal(kayitlar.length, 1);
		assert.deepEqual(Object.keys(kayitlar[0].govde).sort(), [
			'id', 'is_id', 'tarih', 'tur', 'tutar_kurus',
		]);
		assert.equal(kayitlar[0].govde.id, id);
		assert.equal(kayitlar[0].govde.tutar_kurus, 750_000);

		const hepsi = JSON.stringify(o.kuyruk());
		assert.ok(!hepsi.includes('Havale'), 'ödeme yöntemi kuyruğa sızdı');
		assert.ok(!hepsi.includes('Ziraat'), 'ödeme yöntemi kuyruğa sızdı');
		assert.ok(!hepsi.includes('Fatura kesilmedi'), 'iç not kuyruğa sızdı');

		// Yöntem ve not yerelde DURUYOR: gitmemeleri gerekiyor, kaybolmaları değil.
		const yerel = o.depo.odemeListesi({ isId })[0];
		assert.equal(yerel.yontem, 'Havale, Ziraat');
		assert.equal(yerel.not_metni, 'Fatura kesilmedi');
	} finally {
		o.kapat();
	}
});

test('silinen ödeme için kuyruğa silme kaydı yazılıyor', () => {
	const o = ortamKur();
	try {
		const { isId } = ornekIs(o.depo);
		const { id } = o.depo.odemeKaydet({
			is_id: isId,
			tur: 'ara_odeme',
			tutar_kurus: 100_000,
			tarih: '2026-09-22',
		});
		o.depo.odemeSil(id);
		assert.deepEqual(
			o.kuyrukSuz('odeme.sil').map((k) => k.govde.id),
			[id],
		);
	} finally {
		o.kapat();
	}
});

test('iş tutarı ve hedef teslim tarihi is.yaz ile gidiyor', () => {
	const o = ortamKur();
	try {
		const { id: musteriId } = o.depo.musteriKaydet({ ad_soyad: 'Mehmet Demir' });
		o.depo.isKaydet({
			musteri_id: musteriId,
			ad: 'Vitrin tasarımı',
			ozet: 'İki kanatlı vitrin',
			durum: 'teklif',
			tutar_kurus: 2_400_000,
			on_odeme_orani: 40,
			tekrar_eden: 0,
			baslangic: '2026-09-01',
			teslim: '2026-11-30',
		});

		const govde = o.kuyrukSuz('is.yaz').at(-1).govde;
		assert.equal(govde.tutar_kurus, 2_400_000);
		assert.equal(govde.teslim_hedefi, '2026-11-30');
		assert.equal(govde.para_birimi, 'TRY');
		assert.equal(govde.ozet, 'İki kanatlı vitrin');
		// Ön ödeme oranı ve başlangıç tarihi sunucuya çıkmıyor.
		assert.ok(!('on_odeme_orani' in govde));
		assert.ok(!('baslangic' in govde));
	} finally {
		o.kapat();
	}
});

/* ------------------------------------------------------------------ */
/* 4) Dosya paylaşımı                                                  */
/* ------------------------------------------------------------------ */

test('dosya eklemek göndermek değil: kuyruğa hiçbir şey yazılmıyor', async () => {
	const o = ortamKur();
	try {
		const { isId } = ornekIs(o.depo);
		const { id } = await o.depo.dosyaEkle({ isId, yerelYol: 'C:/cizimler/kalip.pdf' });

		const dosya = o.depo.dosyaListesi(isId).find((d) => d.id === id);
		assert.equal(dosya.paylasildi, 0);
		assert.equal(dosya.gonderildi, null);
		assert.equal(o.kuyrukSuz('dosya.yaz').length, 0);
		assert.equal(o.tasima.cagrilar.gonder.length, 0, 'eklerken gönderim olmamalı');
	} finally {
		o.kapat();
	}
});

test('dosya GÖNDERİMİ BAŞARISIZSA künye kuyruğa yazılmıyor', async () => {
	const o = ortamKur({ gonderimHatasi: 'Permission denied (publickey).' });
	try {
		const { isId } = ornekIs(o.depo);
		const { id } = await o.depo.dosyaEkle({ isId, yerelYol: 'C:/cizimler/kalip.pdf' });

		await assert.rejects(() => o.depo.dosyaPaylas(id), /Permission denied/);

		/*
		  Asıl kural bu: kuyrukta künye YOK. Olsaydı bir sonraki eşitlemede
		  sunucuya gider ve müşteri, indirmeye kalktığında var olmayan bir
		  dosya görürdü.
		*/
		assert.equal(o.kuyrukSuz('dosya.yaz').length, 0, 'gönderilmeyen dosyanın künyesi kuyruğa yazıldı');

		// Satır da paylaşılmış sayılmıyor, yani düğme "Paylaş" olarak kalıyor.
		const dosya = o.depo.dosyaListesi(isId).find((d) => d.id === id);
		assert.equal(dosya.paylasildi, 0);
		assert.equal(dosya.gonderildi, null);
	} finally {
		o.kapat();
	}
});

test('gönderim başarılıysa künye kuyruğa yazılıyor ve depo adı sabit kalıyor', async () => {
	const o = ortamKur();
	try {
		const { isId } = ornekIs(o.depo);
		const { id } = await o.depo.dosyaEkle({ isId, yerelYol: 'C:/cizimler/kalip.pdf' });
		const sonuc = await o.depo.dosyaPaylas(id);

		const kayitlar = o.kuyrukSuz('dosya.yaz');
		assert.equal(kayitlar.length, 1);
		assert.equal(kayitlar[0].govde.id, id);
		assert.equal(kayitlar[0].govde.depo_adi, sonuc.depoAdi);
		// SHA-256 kuyrukta onaltılık metin olarak duruyor: JSON ham bayt taşımıyor.
		assert.equal(kayitlar[0].govde.sha256, '2b'.repeat(32));
		// Sahibin disk yolu sunucuya ÇIKMIYOR.
		assert.ok(!('yerel_yol' in kayitlar[0].govde));
		assert.ok(!JSON.stringify(kayitlar[0].govde).includes('cizimler'));

		// Paylaşım geri alınıp yeniden yapıldığında diskteki ad AYNI kalmalı,
		// yoksa sunucuda öksüz kopyalar birikirdi.
		o.depo.dosyaPaylasimiGeriAl(id);
		const ikinci = await o.depo.dosyaPaylas(id);
		assert.equal(ikinci.depoAdi, sonuc.depoAdi);
		assert.deepEqual(
			o.kuyrukSuz('dosya.sil').map((k) => k.govde.id),
			[id],
		);
	} finally {
		o.kapat();
	}
});

test('dosya taşıma kurulmamışsa paylaşma çağrısı anlaşılır hata veriyor', async () => {
	const dizin = mkdtempSync(join(tmpdir(), 'yonetim-ilerleme-'));
	const db = yerelAc(join(dizin, 'yerel.db'));
	try {
		const depo = depoKur(db, KASA);
		const { id: musteriId } = depo.musteriKaydet({ ad_soyad: 'Ayşe Yılmaz' });
		const { id: isId } = depo.isKaydet({
			musteri_id: musteriId,
			ad: 'İş',
			durum: 'teklif',
			tutar_kurus: 0,
			tekrar_eden: 0,
		});
		await assert.rejects(
			() => depo.dosyaEkle({ isId, yerelYol: 'C:/a.pdf' }),
			/kurulmadı/,
		);
	} finally {
		db.close();
		rmSync(dizin, { recursive: true, force: true });
	}
});

/* ------------------------------------------------------------------ */
/* 5) İş bazlı yazışma                                                 */
/* ------------------------------------------------------------------ */

test('iş mesajı hem kuyruğa hem yerel kopyaya düşüyor, aynı kimlikle', () => {
	const o = ortamKur();
	try {
		const { isId } = ornekIs(o.depo);
		const { id, zaman } = o.depo.isMesajiYaz(isId, '  Ölçüleri onayladım, üretime geçiyoruz.  ');

		// Yerel kopya.
		const mesajlar = o.depo.isMesajlari(isId);
		assert.equal(mesajlar.length, 1);
		assert.equal(mesajlar[0].id, id);
		assert.equal(mesajlar[0].yazan, 'sahip');
		assert.equal(mesajlar[0].metin, 'Ölçüleri onayladım, üretime geçiyoruz.');

		// Kuyruk.
		const kayitlar = o.kuyrukSuz('is-mesaj.yaz');
		assert.equal(kayitlar.length, 1);
		assert.deepEqual(Object.keys(kayitlar[0].govde).sort(), ['id', 'is_id', 'metin', 'zaman']);
		assert.equal(kayitlar[0].govde.id, id, 'iki taraftaki kimlik aynı olmalı');
		assert.equal(kayitlar[0].govde.is_id, isId);
		assert.equal(kayitlar[0].govde.zaman, zaman);
		// Yazan bilgisi gitmiyor: sunucu bu kanaldan geleni zaten sahibin biliyor.
		assert.ok(!('yazan' in kayitlar[0].govde));
	} finally {
		o.kapat();
	}
});

test('boş iş mesajı reddediliyor ve hiçbir yere yazılmıyor', () => {
	const o = ortamKur();
	try {
		const { isId } = ornekIs(o.depo);
		assert.throws(() => o.depo.isMesajiYaz(isId, '   '), /boş bırakılamaz/i);
		assert.equal(o.depo.isMesajlari(isId).length, 0);
		assert.equal(o.kuyrukSuz('is-mesaj.yaz').length, 0);
	} finally {
		o.kapat();
	}
});

test('olmayan işe mesaj yazılamıyor', () => {
	const o = ortamKur();
	try {
		assert.throws(() => o.depo.isMesajiYaz('yok-boyle-bir-is', 'merhaba'), /bulunamadı/i);
	} finally {
		o.kapat();
	}
});

/* ------------------------------------------------------------------ */
/* Otomatik eşitleme tetiği                                            */
/* ------------------------------------------------------------------ */

test('yeni yolların hepsi kuyruk dinleyicisini tetikliyor', async () => {
	const dizin = mkdtempSync(join(tmpdir(), 'yonetim-ilerleme-'));
	const db = yerelAc(join(dizin, 'yerel.db'));
	try {
		const gorulen = [];
		const tasima = sahteTasima();
		const depo = depoKur(db, KASA, {
			kuyrukDinleyici: (islem) => gorulen.push(islem),
			dosyaTasima: tasima.arac,
		});

		const { id: musteriId } = depo.musteriKaydet({ ad_soyad: 'Ayşe Yılmaz' });
		const { id: isId } = depo.isKaydet({
			musteri_id: musteriId,
			ad: 'İş',
			durum: 'teklif',
			tutar_kurus: 100,
			tekrar_eden: 0,
		});
		const { id: odemeId } = depo.odemeKaydet({
			is_id: isId,
			tur: 'on_odeme',
			tutar_kurus: 100,
			tarih: '2026-09-22',
		});
		depo.odemeSil(odemeId);
		const { id: asamaId } = depo.asamaKaydet({
			is_id: isId,
			baslik: 'Ara adım',
			aciklama: '',
			durum: 'tamamlandi',
			tarih: '2026-09-22',
			sira: 15,
			paylasildi: 1,
		});
		depo.asamaSil(asamaId);
		const { id: dosyaId } = await depo.dosyaEkle({ isId, yerelYol: 'C:/a.pdf' });
		await depo.dosyaPaylas(dosyaId);
		depo.dosyaPaylasimiGeriAl(dosyaId);
		depo.isMesajiYaz(isId, 'merhaba');
		depo.isSil(isId);

		/*
		  Tetikleyici kuyruğun TEK KAPISINDA duruyor, yani yeni bir yol
		  eklendiğinde onu ayrıca bağlamak gerekmiyor. Bu test o kapının
		  gerçekten tek olduğunu bekliyor.
		*/
		for (const beklenen of [
			'musteri.yaz',
			'is.yaz',
			'asama.yaz',
			'odeme.yaz',
			'odeme.sil',
			'asama.sil',
			'dosya.yaz',
			'dosya.sil',
			'is-mesaj.yaz',
			'is.sil',
		]) {
			assert.ok(gorulen.includes(beklenen), `${beklenen} otomatik eşitlemeyi tetiklemedi`);
		}
	} finally {
		db.close();
		rmSync(dizin, { recursive: true, force: true });
	}
});

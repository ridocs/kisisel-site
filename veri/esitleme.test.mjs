/*
  Eşitlemenin tek kritik sözü şu: sunucuya yalnızca izin verilen alanlar çıkar.
  Buradaki testler o sözü koruyor. Beyaz liste genişletilirse bu testler de
  bilinçli olarak güncellenmek zorunda kalır, yani sızıntı sessizce olamaz.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { yerelAc, simdi } from './db.mjs';
import {
	suz,
	kuyrugaYaz,
	bekleyenler,
	gonderildiIsaretle,
	paketHazirla,
	talepleriIceAl,
	IZINLI_ALANLAR,
	HASSAS_ALAN_DESENI,
} from './esitleme.mjs';

function geciciYerel() {
	const dizin = mkdtempSync(join(tmpdir(), 'esitleme-test-'));
	return { dizin, db: yerelAc(join(dizin, 'yerel.db')) };
}

function musteriEkle(db, id = 'm1') {
	db.prepare(
		'INSERT INTO musteri (id, ad_soyad, telefon, olusturuldu, guncellendi) VALUES (?, ?, ?, ?, ?)',
	).run(id, 'Deneme Müşteri', '0500', simdi(), simdi());
	return id;
}

test('süzgeç hassas alanları düşürüyor', () => {
	const cikti = suz('musteri.yaz', {
		id: 'm1',
		gorunen_ad: 'Ali Veli',
		durum: 'etkin',
		// Aşağıdakilerin hiçbiri sunucuya çıkmamalı:
		tc_sifreli: Buffer.from('gizli'),
		vergi_sifreli: Buffer.from('gizli'),
		telefon: '05001112233',
		ilce: 'Melikgazi',
		sehir: 'Kayseri',
		not_metni: 'özel not',
	});
	assert.deepEqual(Object.keys(cikti).sort(), ['durum', 'gorunen_ad', 'id']);
});

test('iş kaydında tutar ve ödeme bilgisi süzülüyor', () => {
	const cikti = suz('is.yaz', {
		id: 'i1',
		musteri_id: 'm1',
		ad: 'Web sitesi',
		durum: 'suruyor',
		tutar_kurus: 4500000,
		on_odeme_orani: 50,
		ozet: 'içeride kalmalı',
	});
	assert.deepEqual(Object.keys(cikti).sort(), ['ad', 'durum', 'id', 'musteri_id']);
	assert.equal(cikti.tutar_kurus, undefined);
	assert.equal(cikti.ozet, undefined);
});

test('bilinmeyen işlem reddediliyor', () => {
	assert.throws(() => suz('musteri.hepsiniVer', { id: 'x' }), /Tanınmayan/);
});

test('beyaz listenin kendisi hassas alana karşı korunuyor', () => {
	// İkinci emniyet kemeri: beyaz listeye ileride hassas bir alan eklenirse
	// modül yüklenirken patlamalı. Desenin o adları gerçekten tanıdığını
	// burada doğruluyoruz, yoksa kemer takılı görünüp boşta durur.
	for (const hassas of [
		'tutar_kurus', 'tc_sifreli', 'vergi_sifreli', 'telefon', 'adres',
		'ilce', 'sehir', 'iban', 'on_odeme_orani', 'odeme_turu', 'revize_tutari',
	]) {
		assert.ok(HASSAS_ALAN_DESENI.test(hassas), `${hassas} hassas sayılmalıydı`);
	}
	// İzin verilen alanların hiçbiri desene takılmamalı, yoksa liste kullanılamaz.
	for (const alanlar of Object.values(IZINLI_ALANLAR)) {
		for (const alan of alanlar) {
			assert.ok(!HASSAS_ALAN_DESENI.test(alan), `${alan} yanlışlıkla hassas sayılıyor`);
		}
	}
});

test('id olmadan işlem geçmiyor', () => {
	assert.throws(() => suz('musteri.yaz', { gorunen_ad: 'Ali' }), /id zorunlu/);
});

test('bayt dizisi hex metne çevriliyor', () => {
	const cikti = suz('davet.yaz', {
		id: 'd1',
		musteri_id: 'm1',
		anahtar_karmasi: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
		son_kullanma: simdi(),
	});
	assert.equal(cikti.anahtar_karmasi, 'deadbeef');
});

test('kuyruk yazılıyor, okunuyor ve işaretleniyor', () => {
	const { dizin, db } = geciciYerel();
	try {
		kuyrugaYaz(db, 'musteri.yaz', { id: 'm1', gorunen_ad: 'Ali', durum: 'etkin' });
		kuyrugaYaz(db, 'is.yaz', { id: 'i1', musteri_id: 'm1', ad: 'Site', durum: 'suruyor' });
		const bekleyen = bekleyenler(db);
		assert.equal(bekleyen.length, 2);
		assert.equal(bekleyen[0].islem, 'musteri.yaz');
		gonderildiIsaretle(db, [bekleyen[0].id]);
		assert.equal(bekleyenler(db).length, 1);
	} finally {
		db.close();
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('kuyruğa hassas alan yazılamıyor', () => {
	const { dizin, db } = geciciYerel();
	try {
		kuyrugaYaz(db, 'musteri.yaz', {
			id: 'm1',
			gorunen_ad: 'Ali',
			durum: 'etkin',
			telefon: '05001112233',
		});
		const ham = db.prepare('SELECT govde FROM esitleme_kuyrugu').get().govde;
		assert.ok(!ham.includes('05001112233'), 'telefon kuyruğa sızmış');
		assert.ok(!ham.includes('telefon'), 'telefon alanı kuyruğa sızmış');
	} finally {
		db.close();
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('paket tekrar uygulanabilir biçimde hazırlanıyor', () => {
	const paket = paketHazirla([
		{ id: 7, islem: 'musteri.yaz', govde: { id: 'm1', gorunen_ad: 'Ali', durum: 'etkin' } },
	]);
	assert.equal(paket.surum, 1);
	assert.equal(paket.islemler[0].sira, 7);
	assert.equal(paket.islemler[0].govde.gorunen_ad, 'Ali');
});

test('sunucudan gelen talep yerele yazılıyor', () => {
	const { dizin, db } = geciciYerel();
	try {
		musteriEkle(db, 'm1');
		const sonuc = talepleriIceAl(db, {
			talepler: [
				{
					id: 't1',
					musteri_id: 'm1',
					baslik: 'Site açılmıyor',
					durum: 'acik',
					oncelik: 'yuksek',
					olusturuldu: simdi(),
					guncellendi: simdi(),
					mesajlar: [{ id: 'msj1', yazan: 'musteri', metin: 'Merhaba', zaman: simdi() }],
				},
			],
		});
		assert.equal(sonuc.yazilan, 1);
		const talep = db.prepare('SELECT * FROM talep_kopyasi WHERE id = ?').get('t1');
		assert.equal(talep.baslik, 'Site açılmıyor');
		assert.equal(talep.musteri_id, 'm1');
		const mesaj = db.prepare('SELECT * FROM talep_mesaj_kopyasi WHERE talep_id = ?').get('t1');
		assert.equal(mesaj.metin, 'Merhaba');
	} finally {
		db.close();
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('aynı paket iki kez uygulanınca kayıt ikilenmiyor', () => {
	const { dizin, db } = geciciYerel();
	try {
		musteriEkle(db, 'm1');
		const paket = {
			talepler: [
				{
					id: 't1',
					musteri_id: 'm1',
					baslik: 'Aynı talep',
					durum: 'acik',
					olusturuldu: simdi(),
					guncellendi: simdi(),
					mesajlar: [{ id: 'msj1', yazan: 'musteri', metin: 'Tek kopya', zaman: simdi() }],
				},
			],
		};
		talepleriIceAl(db, paket);
		talepleriIceAl(db, paket);
		assert.equal(db.prepare('SELECT COUNT(*) AS n FROM talep_kopyasi').get().n, 1);
		assert.equal(db.prepare('SELECT COUNT(*) AS n FROM talep_mesaj_kopyasi').get().n, 1);
	} finally {
		db.close();
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('sunucunun uydurduğu müşteri kimliği yerele yazılmıyor', () => {
	// Ele geçirilmiş bir sunucu, var olmayan bir müşteriye talep bağlayarak
	// yerel deftere kayıt açamamalı.
	const { dizin, db } = geciciYerel();
	try {
		talepleriIceAl(db, {
			talepler: [
				{ id: 't9', musteri_id: 'olmayan', baslik: 'Sahte', durum: 'acik', mesajlar: [] },
			],
		});
		const talep = db.prepare('SELECT musteri_id FROM talep_kopyasi WHERE id = ?').get('t9');
		assert.equal(talep.musteri_id, null);
		assert.equal(db.prepare('SELECT COUNT(*) AS n FROM musteri').get().n, 0);
	} finally {
		db.close();
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('aşırı uzun mesaj kırpılıyor', () => {
	const { dizin, db } = geciciYerel();
	try {
		musteriEkle(db, 'm1');
		talepleriIceAl(db, {
			talepler: [
				{
					id: 't1',
					musteri_id: 'm1',
					baslik: 'x'.repeat(2000),
					durum: 'acik',
					mesajlar: [{ id: 'm', yazan: 'musteri', metin: 'y'.repeat(100000) }],
				},
			],
		});
		assert.equal(db.prepare('SELECT baslik FROM talep_kopyasi').get().baslik.length, 500);
		assert.equal(db.prepare('SELECT metin FROM talep_mesaj_kopyasi').get().metin.length, 20000);
	} finally {
		db.close();
		rmSync(dizin, { recursive: true, force: true });
	}
});

test('bozuk gelen veri işlemi çökertmiyor, atlıyor', () => {
	const { dizin, db } = geciciYerel();
	try {
		const sonuc = talepleriIceAl(db, {
			talepler: [{ baslik: 'id yok' }, { id: 't2', baslik: 42 }, null],
		});
		assert.equal(sonuc.yazilan, 0);
		assert.equal(sonuc.atlanan, 3);
		assert.throws(() => talepleriIceAl(db, { yanlis: true }), /biçimde değil/);
	} finally {
		db.close();
		rmSync(dizin, { recursive: true, force: true });
	}
});

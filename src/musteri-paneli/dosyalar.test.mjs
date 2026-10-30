/*
  Dosya indirme: yetki, dizin dışına çıkma ve eksik dosya.

  Panelin en tehlikeli uç noktası burası, bu yüzden testi de en sert olan
  bu dosya. Üç soruyu ölçüyor:

  1. Başka müşterinin dosyası indirilebiliyor mu? İNDİRİLEMEMELİ.
  2. Diskteki yol nereden kuruluyor? YALNIZCA veritabanındaki `depo_adi`'ndan;
     gösterilen adda `../` olsa bile yola karışmamalı.
  3. Dosya diskte yoksa ne oluyor? Anlaşılır bir hata, çökme değil.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	boyutMetni,
	depoAdiGecerliMi,
	depoYolu,
	dosyaBasligi,
	dosyaGetir,
	dosyaYaniti,
} from './sunucu/dosyalar.mjs';
import { dosyaEkle, geciciPanel, isEkle, musteriEkle } from './test-destek.mjs';

/** İki müşteri, birer iş ve geçici bir dosya deposu. */
function kurulum() {
	const panel = geciciPanel();
	const depo = mkdtempSync(join(tmpdir(), 'panel-dosya-test-'));
	const ayse = musteriEkle(panel.db, 'Ayşe Yılmaz');
	const bora = musteriEkle(panel.db, 'Bora Şahin');
	return {
		db: panel.db,
		depo,
		ayse,
		bora,
		ayseninIsi: isEkle(panel.db, { musteriId: ayse, ad: 'Ayşe işi' }),
		boraninIsi: isEkle(panel.db, { musteriId: bora, ad: 'Bora işi' }),
		kapat() {
			panel.kapat();
			rmSync(depo, { recursive: true, force: true });
		},
	};
}

/* ---------- Yetki ---------- */

test('BAŞKA MÜŞTERİNİN DOSYASI İNDİRİLEMİYOR', async () => {
	const k = kurulum();
	try {
		const { id, depoAdi } = dosyaEkle(k.db, {
			isId: k.ayseninIsi,
			gosterilenAd: 'ayse-teknik-resim.pdf',
		});
		/* Dosya diskte GERÇEKTEN var: reddin sebebi eksik dosya değil, yetki. */
		writeFileSync(join(k.depo, depoAdi), 'Ayşe için gizli içerik');

		/* Künye sorgusu Bora için hiçbir şey döndürmüyor. */
		assert.equal(dosyaGetir(k.db, k.bora, id), null);

		const yanit = await dosyaYaniti(k.db, {
			musteriId: k.bora,
			dosyaId: id,
			dizin: k.depo,
		});
		assert.equal(yanit.status, 404);
		const govde = await yanit.text();
		/* Gövdede dosyanın içeriğinden hiçbir iz yok. */
		assert.ok(!govde.includes('gizli'));

		/* Ayşe aynı dosyayı indirebiliyor: test yalıtımı ölçüyor, erişimi kırmıyor. */
		const ayseninYaniti = await dosyaYaniti(k.db, {
			musteriId: k.ayse,
			dosyaId: id,
			dizin: k.depo,
		});
		assert.equal(ayseninYaniti.status, 200);
		assert.equal(await ayseninYaniti.text(), 'Ayşe için gizli içerik');
	} finally {
		k.kapat();
	}
});

test('yetkisiz ile var olmayan AYNI yanıtı alıyor', async () => {
	const k = kurulum();
	try {
		const { id, depoAdi } = dosyaEkle(k.db, { isId: k.ayseninIsi, gosterilenAd: 'ozet.pdf' });
		writeFileSync(join(k.depo, depoAdi), 'içerik');

		const yetkisiz = await dosyaYaniti(k.db, { musteriId: k.bora, dosyaId: id, dizin: k.depo });
		const yok = await dosyaYaniti(k.db, {
			musteriId: k.bora,
			dosyaId: 'hic-olmayan-kimlik',
			dizin: k.depo,
		});
		/*
		  Farklı kodlar dönseydi Bora, göremediği bir dosyanın var olduğunu
		  öğrenirdi.
		*/
		assert.equal(yetkisiz.status, yok.status);
		assert.equal(await yetkisiz.text(), await yok.text());
	} finally {
		k.kapat();
	}
});

/* ---------- Dizin dışına çıkma ---------- */

test('DİZİN DIŞINA ÇIKAN DEPO ADI REDDEDİLİYOR', () => {
	const kok = '/var/lib/panel/dosyalar';
	for (const kotu of [
		'../etc/passwd',
		'..',
		'../../gizli.env',
		'alt/dizin.pdf',
		'ters\\dizin.pdf',
		'/mutlak/yol.pdf',
		'',
		'  bosluk.pdf',
	]) {
		assert.equal(depoAdiGecerliMi(kotu), false, `kabul edilmemeliydi: ${kotu}`);
		assert.equal(depoYolu(kotu, kok), null, `yol kurulmamalıydı: ${kotu}`);
	}

	/* Meşru ad: rastgele onaltılık artı uzantı (veri/dosya-gonder.mjs böyle üretiyor). */
	const iyi = 'a3f9c1d2e4b5a6978877665544332211.pdf';
	assert.equal(depoAdiGecerliMi(iyi), true);
	assert.ok(depoYolu(iyi, kok).endsWith(iyi));
});

test('YOL GÖSTERİLEN ADDAN DEĞİL, DEPO ADINDAN KURULUYOR', async () => {
	const k = kurulum();
	try {
		/*
		  Gösterilen ad dizin dışına çıkmaya çalışıyor. Bu ad dosya sistemine
		  HİÇ girmiyor: yalnızca `Content-Disposition` başlığına, orada da
		  eğik çizgileri temizlenmiş hâliyle.
		*/
		const { id, depoAdi } = dosyaEkle(k.db, {
			isId: k.ayseninIsi,
			gosterilenAd: '../../../etc/passwd',
			depoAdi: 'aaaa1111bbbb2222cccc3333dddd4444.pdf',
		});
		writeFileSync(join(k.depo, depoAdi), 'meşru içerik');

		const yanit = await dosyaYaniti(k.db, { musteriId: k.ayse, dosyaId: id, dizin: k.depo });
		assert.equal(yanit.status, 200);
		assert.equal(await yanit.text(), 'meşru içerik');

		const baslik = yanit.headers.get('content-disposition');
		assert.ok(!baslik.includes('../'), `başlıkta yol parçası kalmış: ${baslik}`);
	} finally {
		k.kapat();
	}
});

test('Content-Disposition adı başlık enjeksiyonuna kapalı', () => {
	const baslik = dosyaBasligi('rapor"\r\nSet-Cookie: x=1\n.pdf');
	assert.ok(!baslik.includes('\r'));
	assert.ok(!baslik.includes('\n'));
	assert.ok(!baslik.includes('Set-Cookie: x=1"'));

	/* Türkçe ad RFC 5987 ile de taşınıyor, ASCII yedeği de basılıyor. */
	const turkce = dosyaBasligi('ölçü raporu.pdf');
	assert.ok(turkce.startsWith('attachment; filename="'));
	assert.ok(turkce.includes("filename*=UTF-8''"));
	assert.ok(turkce.includes(encodeURIComponent('ölçü raporu.pdf')));
});

/* ---------- Eksik dosya ---------- */

test('DİSKTE OLMAYAN DOSYA ÇÖKERTMİYOR, ANLAŞILIR HATA VERİYOR', async () => {
	const k = kurulum();
	try {
		/* Künye var, içerik yok: eşitleme yarım kalmış bir dosya. */
		const { id } = dosyaEkle(k.db, { isId: k.ayseninIsi, gosterilenAd: 'eksik.pdf' });

		const yanit = await dosyaYaniti(k.db, { musteriId: k.ayse, dosyaId: id, dizin: k.depo });
		assert.equal(yanit.status, 404);
		const govde = await yanit.text();
		/* Yığın izi değil, ne yapılacağını söyleyen bir cümle. */
		assert.ok(govde.includes('bulunamadı'));
		assert.ok(govde.includes('yazarsanız'));
	} finally {
		k.kapat();
	}
});

test('olmayan dizin de çökertmiyor', async () => {
	const k = kurulum();
	try {
		const { id } = dosyaEkle(k.db, { isId: k.ayseninIsi, gosterilenAd: 'ozet.pdf' });
		const yanit = await dosyaYaniti(k.db, {
			musteriId: k.ayse,
			dosyaId: id,
			dizin: join(k.depo, 'hic-olmayan-dizin'),
		});
		assert.equal(yanit.status, 404);
	} finally {
		k.kapat();
	}
});

/* ---------- Başlıklar ve önizleme ---------- */

test('başlıklar veritabanından geliyor, tahmin edilmiyor', async () => {
	const k = kurulum();
	try {
		const { id, depoAdi } = dosyaEkle(k.db, {
			isId: k.ayseninIsi,
			gosterilenAd: 'ölçü raporu.pdf',
			tur: 'application/pdf',
		});
		writeFileSync(join(k.depo, depoAdi), 'PDF içeriği');

		const yanit = await dosyaYaniti(k.db, { musteriId: k.ayse, dosyaId: id, dizin: k.depo });
		assert.equal(yanit.headers.get('content-type'), 'application/pdf');
		assert.equal(yanit.headers.get('x-content-type-options'), 'nosniff');
		assert.ok(yanit.headers.get('content-disposition').startsWith('attachment;'));
		assert.equal(yanit.headers.get('cache-control'), 'private, no-store');
		await yanit.text();
	} finally {
		k.kapat();
	}
});

test('görsel önizlemesi inline, görsel olmayan her şey indiriliyor', async () => {
	const k = kurulum();
	try {
		const gorsel = dosyaEkle(k.db, {
			isId: k.ayseninIsi,
			gosterilenAd: 'imalat.png',
			tur: 'image/png',
			gorselMi: 1,
		});
		const belge = dosyaEkle(k.db, {
			isId: k.ayseninIsi,
			gosterilenAd: 'sozlesme.pdf',
			tur: 'application/pdf',
		});
		writeFileSync(join(k.depo, gorsel.depoAdi), 'PNG');
		writeFileSync(join(k.depo, belge.depoAdi), 'PDF');

		const gorselYanit = await dosyaYaniti(k.db, {
			musteriId: k.ayse,
			dosyaId: gorsel.id,
			onizleme: true,
			dizin: k.depo,
		});
		assert.ok(gorselYanit.headers.get('content-disposition').startsWith('inline;'));
		await gorselYanit.text();

		/*
		  Görsel olmayan dosya `?onizleme=1` ile de INDIRILIYOR. Aksi hâlde
		  veritabanına bir gün `text/html` düşerse aynı kökende çalışan bir
		  sayfa olurdu.
		*/
		const belgeYanit = await dosyaYaniti(k.db, {
			musteriId: k.ayse,
			dosyaId: belge.id,
			onizleme: true,
			dizin: k.depo,
		});
		assert.ok(belgeYanit.headers.get('content-disposition').startsWith('attachment;'));
		await belgeYanit.text();
	} finally {
		k.kapat();
	}
});

test('boyut okunur biçimde yazılıyor', () => {
	assert.equal(boyutMetni(512), '512 B');
	assert.equal(boyutMetni(2048), '2 KB');
	assert.equal(boyutMetni(1572864), '1,5 MB');
	assert.equal(boyutMetni(null), '');
});

/* ---------- Oturum ---------- */

test('OTURUMSUZ İSTEK DOSYA İNDİREMİYOR', async () => {
	const { GET, HEAD } = await import('./pages/api/dosya/[id].js');
	const baglam = {
		locals: {},
		params: { id: 'herhangi' },
		url: new URL('http://yerel/api/dosya/herhangi'),
	};

	const yanit = await GET(baglam);
	assert.equal(yanit.status, 401);
	assert.equal((await yanit.json()).tamam, false);

	/* HEAD de aynı kapıdan geçiyor: gövdesiz bir istek denetimi atlayamaz. */
	assert.equal((await HEAD(baglam)).status, 401);
});

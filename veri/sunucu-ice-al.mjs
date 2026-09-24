#!/usr/bin/env node
/*
  SUNUCUDA çalışır. Yerel defterden gelen eşitleme paketini panel
  veritabanına uygular.

  Paketi standart girdiden okur, sonucu standart çıktıya JSON yazar. Ağ
  dinlemiyor, uç nokta açmıyor: taşıma işini SSH yapıyor. Böylece eşitleme
  için internete açılan yeni bir yüzey oluşmuyor (PANEL-TASARIMI.md §1).

  İKİ KURAL:

  1. Her işlem tekrar uygulanabilir olmak zorunda. Yarım kalan bir gönderim
     tekrarlanacak ve aynı paket iki kez gelebilir; sonuç değişmemeli.
  2. Gelen paket YALNIZCA beyaz listedeki alanları taşıyabilir. Paketi
     üreten taraf zaten süzüyor, burada bir kez daha süzülüyor: sunucu,
     gönderenin doğru davrandığını varsaymaz.

  Kullanım:
      node sunucu-ice-al.mjs /var/lib/panel/panel.db < paket.json
*/

import { panelAc, simdi } from './db.mjs';
import { suz } from './esitleme.mjs';

const vtYolu = process.argv[2];
if (!vtYolu) {
	process.stderr.write('Kullanım: node sunucu-ice-al.mjs <veritabani-yolu>\n');
	process.exit(2);
}

function girdiyiOku() {
	return new Promise((coz, at) => {
		let veri = '';
		process.stdin.setEncoding('utf8');
		process.stdin.on('data', (parca) => {
			veri += parca;
			// Kötü niyetli ya da bozuk bir gönderim belleği doldurmasın.
			if (veri.length > 8 * 1024 * 1024) {
				at(new Error('Paket çok büyük'));
				process.stdin.destroy();
			}
		});
		process.stdin.on('end', () => coz(veri));
		process.stdin.on('error', at);
	});
}

function hexeBayt(metin) {
	if (typeof metin !== 'string' || !/^[0-9a-f]+$/i.test(metin) || metin.length % 2 !== 0) {
		throw new Error('Geçersiz hex değer');
	}
	return Buffer.from(metin, 'hex');
}

function uygula(db, islem, govde) {
	const temiz = suz(islem, govde);
	const zaman = simdi();

	switch (islem) {
		case 'musteri.yaz':
			db.prepare(
				`INSERT INTO musteri (id, gorunen_ad, durum, olusturuldu, guncellendi)
				 VALUES (?, ?, ?, ?, ?)
				 ON CONFLICT (id) DO UPDATE SET
				   gorunen_ad = excluded.gorunen_ad,
				   durum = excluded.durum,
				   guncellendi = excluded.guncellendi`,
			).run(temiz.id, temiz.gorunen_ad, temiz.durum ?? 'etkin', zaman, zaman);
			return;

		case 'musteri.sil':
			// Yabancı anahtarlar ON DELETE CASCADE: müşterinin davetleri, passkey'leri,
			// oturumları ve talepleri de gider. Bu bilinçli: sahip müşteriyi sildiğinde
			// panelde ona ait hiçbir şey kalmamalı.
			db.prepare('DELETE FROM musteri WHERE id = ?').run(temiz.id);
			return;

		case 'is.yaz':
			db.prepare(
				`INSERT INTO is_ozeti
				   (id, musteri_id, ad, durum, ozet, tutar_kurus, para_birimi, teslim_hedefi, guncellendi)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT (id) DO UPDATE SET
				   ad = excluded.ad,
				   durum = excluded.durum,
				   ozet = excluded.ozet,
				   tutar_kurus = excluded.tutar_kurus,
				   para_birimi = excluded.para_birimi,
				   teslim_hedefi = excluded.teslim_hedefi,
				   guncellendi = excluded.guncellendi`,
			).run(
				temiz.id,
				temiz.musteri_id,
				temiz.ad,
				temiz.durum,
				temiz.ozet ?? null,
				Math.trunc(Number(temiz.tutar_kurus) || 0),
				temiz.para_birimi ?? 'TRY',
				temiz.teslim_hedefi ?? null,
				zaman,
			);
			return;

		case 'is.sil':
			db.prepare('DELETE FROM is_ozeti WHERE id = ?').run(temiz.id);
			return;

		case 'odeme.yaz':
			db.prepare(
				`INSERT INTO is_odeme (id, is_id, tur, tutar_kurus, tarih, guncellendi)
				 VALUES (?, ?, ?, ?, ?, ?)
				 ON CONFLICT (id) DO UPDATE SET
				   tur = excluded.tur,
				   tutar_kurus = excluded.tutar_kurus,
				   tarih = excluded.tarih,
				   guncellendi = excluded.guncellendi`,
			).run(
				temiz.id,
				temiz.is_id,
				temiz.tur,
				Math.trunc(Number(temiz.tutar_kurus) || 0),
				temiz.tarih,
				zaman,
			);
			return;

		case 'odeme.sil':
			db.prepare('DELETE FROM is_odeme WHERE id = ?').run(temiz.id);
			return;

		case 'asama.yaz':
			db.prepare(
				`INSERT INTO is_asama (id, is_id, sira, kaynak, baslik, aciklama, durum, tarih, guncellendi)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT (id) DO UPDATE SET
				   sira = excluded.sira,
				   kaynak = excluded.kaynak,
				   baslik = excluded.baslik,
				   aciklama = excluded.aciklama,
				   durum = excluded.durum,
				   tarih = excluded.tarih,
				   guncellendi = excluded.guncellendi`,
			).run(
				temiz.id,
				temiz.is_id,
				Math.trunc(Number(temiz.sira) || 0),
				temiz.kaynak === 'otomatik' ? 'otomatik' : 'elle',
				temiz.baslik,
				temiz.aciklama ?? null,
				temiz.durum ?? 'tamamlandi',
				temiz.tarih,
				zaman,
			);
			return;

		case 'asama.sil':
			db.prepare('DELETE FROM is_asama WHERE id = ?').run(temiz.id);
			return;

		case 'dosya.yaz':
			/*
			  Yalnızca KÜNYE yazılıyor. Dosyanın içeriği kuyruktan değil ayrı
			  bir kopyalamayla geliyor; künye önce gelirse müşteri indirmeye
			  çalıştığında dosya henüz yerinde olmayabilir, bu yüzden panel
			  tarafı indirmeden önce dosyanın varlığını denetliyor.
			*/
			db.prepare(
				`INSERT INTO is_dosya
				   (id, is_id, asama_id, gosterilen_ad, depo_adi, tur, boyut, sha256, gorsel_mi, olusturuldu)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT (id) DO UPDATE SET
				   gosterilen_ad = excluded.gosterilen_ad,
				   asama_id = excluded.asama_id,
				   tur = excluded.tur,
				   boyut = excluded.boyut,
				   sha256 = excluded.sha256,
				   gorsel_mi = excluded.gorsel_mi`,
			).run(
				temiz.id,
				temiz.is_id,
				temiz.asama_id ?? null,
				temiz.gosterilen_ad,
				temiz.depo_adi,
				temiz.tur,
				Math.trunc(Number(temiz.boyut) || 0),
				hexeBayt(temiz.sha256),
				Number(temiz.gorsel_mi) === 1 ? 1 : 0,
				zaman,
			);
			return;

		case 'dosya.sil':
			db.prepare('DELETE FROM is_dosya WHERE id = ?').run(temiz.id);
			return;

		case 'is-mesaj.yaz':
			db.prepare(
				`INSERT INTO is_mesaji (id, is_id, yazan, metin, zaman)
				 VALUES (?, ?, 'sahip', ?, ?)
				 ON CONFLICT (id) DO NOTHING`,
			).run(temiz.id, temiz.is_id, temiz.metin, temiz.zaman ?? zaman);
			return;

		case 'davet.yaz':
			/*
			  `kullanildi` sütununa BİLEREK dokunulmuyor.

			  Aynı paket iki kez gelirse ya da sahip eski bir kuyruğu yeniden
			  gönderirse, kullanılmış bir davet yeniden kullanılabilir hâle
			  gelmemeli. Tek kullanımlık olmanın anlamı bu.
			*/
			db.prepare(
				`INSERT INTO davet (id, musteri_id, anahtar_karmasi, son_kullanma, olusturuldu)
				 VALUES (?, ?, ?, ?, ?)
				 ON CONFLICT (id) DO UPDATE SET son_kullanma = excluded.son_kullanma`,
			).run(temiz.id, temiz.musteri_id, hexeBayt(temiz.anahtar_karmasi), temiz.son_kullanma, zaman);
			return;

		case 'davet.iptal':
			db.prepare('DELETE FROM davet WHERE id = ? AND kullanildi IS NULL').run(temiz.id);
			return;

		case 'talep.durum':
			db.prepare('UPDATE talep SET durum = ?, guncellendi = ? WHERE id = ?').run(
				temiz.durum,
				zaman,
				temiz.id,
			);
			return;

		case 'talep.yanit':
			db.prepare(
				`INSERT INTO talep_mesaji (id, talep_id, yazan, metin, zaman)
				 VALUES (?, ?, 'sahip', ?, ?)
				 ON CONFLICT (id) DO NOTHING`,
			).run(temiz.id, temiz.talep_id, temiz.metin, temiz.zaman ?? zaman);
			db.prepare('UPDATE talep SET durum = ?, guncellendi = ? WHERE id = ?').run(
				'yanitlandi',
				zaman,
				temiz.talep_id,
			);
			return;

		default:
			throw new Error(`Uygulanamayan işlem: ${islem}`);
	}
}

const ham = await girdiyiOku();
let paket;
try {
	paket = JSON.parse(ham);
} catch {
	process.stdout.write(JSON.stringify({ tamam: false, hata: 'Paket okunamadı' }) + '\n');
	process.exit(1);
}

if (paket?.surum !== 1 || !Array.isArray(paket.islemler)) {
	process.stdout.write(JSON.stringify({ tamam: false, hata: 'Bilinmeyen paket sürümü' }) + '\n');
	process.exit(1);
}

const db = panelAc(vtYolu);
const uygulanan = [];
const basarisiz = [];

/*
  Hepsi tek işlemde: paket ya bütünüyle uygulanır ya hiç. Yarısı uygulanmış
  bir paket, gönderen tarafta hangi satırların işaretleneceğini belirsiz
  bırakırdı.
*/
db.exec('BEGIN');
try {
	for (const adim of paket.islemler) {
		try {
			uygula(db, adim.islem, adim.govde);
			uygulanan.push(adim.sira);
		} catch (hata) {
			basarisiz.push({ sira: adim.sira, hata: hata.message });
		}
	}
	if (basarisiz.length) throw new Error('Paketteki bazı işlemler uygulanamadı');
	db.exec('COMMIT');
} catch (hata) {
	db.exec('ROLLBACK');
	db.close();
	process.stdout.write(
		JSON.stringify({ tamam: false, hata: hata.message, basarisiz }) + '\n',
	);
	process.exit(1);
}
db.close();

process.stdout.write(JSON.stringify({ tamam: true, uygulanan }) + '\n');

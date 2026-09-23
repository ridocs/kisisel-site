/*
  Eşitlemenin taşıma katmanı: SSH.

  NEDEN SSH, NEDEN BİR HTTP UÇ NOKTASI DEĞİL

  Eşitleme için sunucuda bir uç nokta açmak, panelin saldırı yüzeyine
  "sahibin verisini yazabilen" yeni bir kapı eklerdi ve o kapının kendi
  kimlik doğrulaması olurdu. SSH zaten orada, zaten anahtarla korunuyor ve
  zaten sahibin dağıtım için kullandığı yol. Yeni yüzey açmamak, yeni yüzeyi
  iyi korumaktan iyidir (PANEL-TASARIMI.md §1).

  SUNUCU BİLGİSİ BU DOSYADA YOK. Depo herkese açık; adres, kullanıcı ve
  yollar yerel veritabanının `ayar` tablosundan okunuyor ve oraya yönetim
  uygulamasından giriliyor.
*/

import { spawn } from 'node:child_process';
import { simdi } from './db.mjs';
import {
	bekleyenler,
	gonderildiIsaretle,
	paketHazirla,
	talepleriIceAl,
} from './esitleme.mjs';

export const AYAR_ANAHTARLARI = [
	'esitleme.sunucu',
	'esitleme.uzak_veri',
	'esitleme.uzak_vt',
	'esitleme.ssh_anahtari',
];

/*
  Uzak yollar ve sunucu adı SSH üzerinden uzakta bir kabuğa giriyor. Bu
  değerleri sahip kendi eliyle giriyor, yine de kabukta anlam taşıyan
  karakterleri baştan reddediyoruz: yanlışlıkla yapıştırılan bir boşluk ya
  da noktalı virgül, uzakta istenmeyen bir komut çalıştırmasın.
*/
const GUVENLI_YOL = /^[A-Za-z0-9._/-]+$/;
const GUVENLI_SUNUCU = /^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+$/;

export function ayarlariOku(db) {
	const satirlar = db.prepare('SELECT anahtar, deger FROM ayar').all();
	const ayar = Object.fromEntries(satirlar.map((s) => [s.anahtar, s.deger]));
	const eksik = AYAR_ANAHTARLARI.filter((a) => !ayar[a]);
	if (eksik.length) {
		throw new Error(`Eşitleme ayarları eksik: ${eksik.join(', ')}`);
	}
	if (!GUVENLI_SUNUCU.test(ayar['esitleme.sunucu'])) {
		throw new Error('Sunucu adresi "kullanici@makine" biçiminde olmalı');
	}
	for (const anahtar of ['esitleme.uzak_veri', 'esitleme.uzak_vt']) {
		if (!GUVENLI_YOL.test(ayar[anahtar])) {
			throw new Error(`${anahtar} değeri yalnızca harf, rakam, nokta, alt çizgi, eğik çizgi ve tire içerebilir`);
		}
	}
	return ayar;
}

/**
 * Uzakta bir komut çalıştırır, `girdi` varsa standart girdisine yazar.
 * Kabuk açmıyoruz (`shell: false`), argümanlar diziyle geçiyor.
 */
function sshCalistir(ayar, komutParcalari, girdi = null, zamanAsimiMs = 60000) {
	return new Promise((coz, at) => {
		const argumanlar = [
			'-i', ayar['esitleme.ssh_anahtari'],
			// Parola sorulursa süreç sonsuza kadar bekler; BatchMode bunu hataya çevirir.
			'-o', 'BatchMode=yes',
			'-o', 'StrictHostKeyChecking=accept-new',
			'-o', `ConnectTimeout=${Math.ceil(zamanAsimiMs / 1000)}`,
			ayar['esitleme.sunucu'],
			...komutParcalari,
		];
		const surec = spawn('ssh', argumanlar, { shell: false });
		let cikti = '';
		let hataCiktisi = '';
		const sayac = setTimeout(() => {
			surec.kill();
			at(new Error('SSH zaman aşımına uğradı'));
		}, zamanAsimiMs);

		surec.stdout.setEncoding('utf8');
		surec.stderr.setEncoding('utf8');
		surec.stdout.on('data', (p) => (cikti += p));
		surec.stderr.on('data', (p) => (hataCiktisi += p));
		surec.on('error', (hata) => {
			clearTimeout(sayac);
			at(new Error(`SSH başlatılamadı: ${hata.message}`));
		});
		surec.on('close', (kod) => {
			clearTimeout(sayac);
			if (kod === 0) coz(cikti);
			else at(new Error(`SSH ${kod} koduyla döndü: ${hataCiktisi.trim() || cikti.trim()}`));
		});

		if (girdi !== null) {
			surec.stdin.write(girdi);
			surec.stdin.end();
		} else {
			surec.stdin.end();
		}
	});
}

/**
 * Kuyrukta bekleyenleri sunucuya gönderir.
 *
 * Sıra önemli: önce gönder, sunucu "tamam" dedikten SONRA işaretle. Tersi
 * olsaydı, gönderim yarıda koparsa kayıtlar gönderilmiş sayılır ve sessizce
 * kaybolurdu. Bu sırada en kötü ihtimal aynı paketin iki kez uygulanması,
 * o da zararsız: sunucu tarafı tekrar uygulanabilir yazıldı.
 */
export async function gonder(db, { sinir = 500 } = {}) {
	const ayar = ayarlariOku(db);
	const satirlar = bekleyenler(db, sinir);
	if (!satirlar.length) return { gonderilen: 0, bosKuyruk: true };

	const paket = paketHazirla(satirlar);
	const ham = await sshCalistir(
		ayar,
		['node', `${ayar['esitleme.uzak_veri']}/sunucu-ice-al.mjs`, ayar['esitleme.uzak_vt']],
		JSON.stringify(paket),
	);

	let sonuc;
	try {
		sonuc = JSON.parse(ham.trim().split('\n').pop());
	} catch {
		throw new Error(`Sunucudan beklenmeyen cevap: ${ham.slice(0, 200)}`);
	}
	if (!sonuc.tamam) {
		throw new Error(sonuc.hata ?? 'Sunucu paketi uygulamadı');
	}

	gonderildiIsaretle(db, sonuc.uygulanan ?? satirlar.map((s) => s.id));
	return { gonderilen: (sonuc.uygulanan ?? satirlar).length, bosKuyruk: false };
}

/**
 * Sunucudaki destek taleplerini çeker ve yerele yazar.
 *
 * Artımlı: son çekiş damgasından sonrakiler isteniyor. Damga ancak yazma
 * başarılı olduktan sonra ilerliyor, yani kopan bir çekiş bir sonrakinde
 * aynı yerden devam ediyor.
 */
export async function cek(db) {
	const ayar = ayarlariOku(db);
	const sonCekis = db
		.prepare("SELECT deger FROM ayar WHERE anahtar = 'esitleme.son_cekis'")
		.get()?.deger;

	const komut = ['node', `${ayar['esitleme.uzak_veri']}/sunucu-talep-ver.mjs`, ayar['esitleme.uzak_vt']];
	if (sonCekis) komut.push(sonCekis);

	const ham = await sshCalistir(ayar, komut);
	let gelen;
	try {
		gelen = JSON.parse(ham.trim().split('\n').pop());
	} catch {
		throw new Error(`Sunucudan beklenmeyen cevap: ${ham.slice(0, 200)}`);
	}

	const sonuc = talepleriIceAl(db, gelen);

	/*
	  Damgayı sunucunun ürettiği ana değil, çekilen en son talebin
	  güncellenme anına alıyoruz. Sunucunun saati ileri giderse aradaki
	  talepler atlanmasın diye. Hiç talep gelmediyse damga olduğu gibi kalıyor.
	*/
	const enSon = (gelen.talepler ?? [])
		.map((t) => t.guncellendi)
		.filter(Boolean)
		.sort()
		.pop();
	if (enSon) {
		db.prepare(
			`INSERT INTO ayar (anahtar, deger) VALUES ('esitleme.son_cekis', ?)
			 ON CONFLICT (anahtar) DO UPDATE SET deger = excluded.deger`,
		).run(enSon);
	}

	return sonuc;
}

/** Önce gönder, sonra çek. Yönetim uygulamasındaki "Eşitle" düğmesi bunu çağırıyor. */
export async function esitle(db) {
	const gonderim = await gonder(db);
	const cekis = await cek(db);
	db.prepare(
		`INSERT INTO ayar (anahtar, deger) VALUES ('esitleme.son_calisma', ?)
		 ON CONFLICT (anahtar) DO UPDATE SET deger = excluded.deger`,
	).run(simdi());
	return { gonderim, cekis };
}

/*
  Destek talebi hareketlerinin CANLI akışı, sahibin bilgisayarı tarafında.

  Sunucuda `sunucu-talep-izle.mjs` açık kalıyor ve yeni mesajları NDJSON
  olarak yazıyor; burası o satırları okuyup olaya çeviriyor. Arada düzenli
  bir yoklama yok, dolayısıyla gecikme dakikalar değil saniyenin altı.

  Eşitlemenin yerini ALMIYOR, yanında duruyor: eşitleme iki yönlü ve
  dayanıklı (kuyruk, tekrar uygulanabilirlik), bu ise tek yönlü ve
  hızlı. Akış koparsa veri kaybolmuyor, düzenli eşitleme onu yine getiriyor.
  Bu yüzden akış "en iyi çaba" olarak tasarlandı: çalışırsa anlık, çalışmazsa
  üç dakikalık yol hâlâ yerinde.
*/

import { spawn } from 'node:child_process';

/** Yeniden bağlanma gecikmeleri, üstel ve tavanlı. */
const ILK_GECIKME_MS = 1000;
const EN_COK_GECIKME_MS = 60000;

/*
  Nabız aralığı sunucuda 20 saniye. Bunun üç katı sessizlik, bağlantının
  fiilen ölmüş olduğu anlamına geliyor: TCP bazen kopmayı fark etmiyor ve
  soket sonsuza kadar açık görünüyor. Sessizlik sayacı bunu yakalıyor.
*/
const SESSIZLIK_SINIRI_MS = 60000;

/**
 * Akışı başlatır.
 *
 * @param {object} ayar        `ayarlariOku` çıktısı
 * @param {object} secenekler
 * @param {string} secenekler.baslangic  Bu ISO damgasından sonrası isteniyor
 * @param {(olay: object) => void} secenekler.olay     Mesaj ve talep olayları
 * @param {(durum: object) => void} [secenekler.durum] Bağlantı durumu
 * @returns {{ durdur: () => void }}
 */
export function akisBaslat(ayar, { baslangic, olay, durum = () => {} }) {
	let surec = null;
	let kapandi = false;
	let gecikme = ILK_GECIKME_MS;
	let yenidenSayac = null;
	let sessizlikSayaci = null;
	let sonDamga = baslangic;

	function durumBildir(ad, ek = {}) {
		durum({ ad, ...ek });
	}

	function sessizligiSifirla() {
		clearTimeout(sessizlikSayaci);
		sessizlikSayaci = setTimeout(() => {
			/*
			  Nabız gelmiyor: bağlantı sessizce ölmüş. Süreci öldürmek
			  `close` olayını tetikliyor, o da yeniden bağlanmayı başlatıyor.
			*/
			durumBildir('sessiz-koptu');
			surec?.kill();
		}, SESSIZLIK_SINIRI_MS);
	}

	function bagla() {
		if (kapandi) return;

		const argumanlar = [
			'-i', ayar['esitleme.ssh_anahtari'],
			'-o', 'BatchMode=yes',
			'-o', 'StrictHostKeyChecking=accept-new',
			// Ağ sessizce kopduğunda SSH'ın kendisi de fark etsin.
			'-o', 'ServerAliveInterval=15',
			'-o', 'ServerAliveCountMax=3',
			ayar['esitleme.sunucu'],
			ayar['esitleme.uzak_node'],
			`${ayar['esitleme.uzak_veri']}/sunucu-talep-izle.mjs`,
			ayar['esitleme.uzak_vt'],
			sonDamga,
		];

		surec = spawn('ssh', argumanlar, { shell: false });
		durumBildir('baglaniyor');

		let tampon = '';
		surec.stdout.setEncoding('utf8');
		surec.stdout.on('data', (parca) => {
			gecikme = ILK_GECIKME_MS; // Veri geldi, demek ki bağlantı sağlam.
			sessizligiSifirla();
			tampon += parca;

			/*
			  Satır satır ayrıştırılıyor ve SON PARÇA tamponda bırakılıyor:
			  TCP bir JSON satırını ortadan bölebilir. Bölünen satırı
			  ayrıştırmaya kalkmak akışı bozardı.
			*/
			const satirlar = tampon.split('\n');
			tampon = satirlar.pop() ?? '';
			for (const satir of satirlar) {
				if (!satir.trim()) continue;
				let nesne;
				try {
					nesne = JSON.parse(satir);
				} catch {
					// Bozuk satırı atla: akışın tamamını düşürmeye değmez.
					continue;
				}
				if (nesne.tur === 'nabiz') {
					durumBildir('canli', { zaman: nesne.zaman });
					continue;
				}
				// Kaldığımız yeri güncelle ki yeniden bağlanınca tekrar gelmesin.
				const damga = nesne.zaman ?? nesne.guncellendi;
				if (damga && damga > sonDamga) sonDamga = damga;
				olay(nesne);
			}
		});

		let hataMetni = '';
		surec.stderr.setEncoding('utf8');
		surec.stderr.on('data', (parca) => {
			hataMetni = (hataMetni + parca).slice(-500);
		});

		surec.on('error', (hata) => {
			durumBildir('hata', { hata: hata.message });
		});

		surec.on('close', (kod) => {
			clearTimeout(sessizlikSayaci);
			surec = null;
			if (kapandi) return;
			durumBildir('koptu', { kod, hata: hataMetni.trim() || null });
			yenidenSayac = setTimeout(bagla, gecikme);
			gecikme = Math.min(gecikme * 2, EN_COK_GECIKME_MS);
		});

		sessizligiSifirla();
	}

	bagla();

	return {
		durdur() {
			kapandi = true;
			clearTimeout(yenidenSayac);
			clearTimeout(sessizlikSayaci);
			/*
			  Standart girdiyi kapatmak uzaktaki betiğe "bitti" diyor ve o da
			  kendini sonlandırıyor. Yalnızca süreci öldürmek, sunucuda öksüz
			  bir süreç bırakma riski taşırdı.
			*/
			try {
				surec?.stdin.end();
			} catch {
				// Süreç zaten gitmişse sorun değil.
			}
			surec?.kill();
			surec = null;
			durumBildir('durduruldu');
		},
	};
}

/**
 * Yerel kopyadaki en son hareket damgası: akış buradan devam ediyor.
 * Hiç kayıt yoksa son bir gün isteniyor, böylece ilk açılışta yakın geçmiş
 * de geliyor ama bütün tarih akıtılmıyor.
 */
export function akisBaslangici(db) {
	const mesaj = db.prepare('SELECT MAX(zaman) AS z FROM talep_mesaj_kopyasi').get()?.z;
	const talep = db.prepare('SELECT MAX(guncellendi) AS z FROM talep_kopyasi').get()?.z;
	const enSon = [mesaj, talep].filter(Boolean).sort().pop();
	return enSon ?? new Date(Date.now() - 864e5).toISOString();
}

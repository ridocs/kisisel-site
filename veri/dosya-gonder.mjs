/*
  Dosya taşıma: sahibin bilgisayarından sunucuya.

  NEDEN KUYRUKTAN GİTMİYOR

  Eşitleme kuyruğu JSON taşıyor. Bir teknik resmi ya da imalat fotoğrafını
  JSON içine gömmek (base64) boyutu üçte bir büyütür, kuyruğu şişirir ve tek
  bir büyük dosya bütün eşitlemeyi bekletir. Dosyanın KÜNYESİ kuyruktan
  gidiyor, İÇERİĞİ buradan.

  GÜVENLİK

  Diskteki ad rastgele üretiliyor ve müşterinin gördüğü addan bağımsız.
  Müşterinin verdiği ad doğrudan dosya sistemine yazılsaydı `../` içeren bir
  ad dizin dışına çıkabilir, `.mjs` uzantılı bir ad ise sunucuda çalıştırılan
  bir dosyanın üstüne yazabilirdi. Gösterilen ad yalnızca veritabanında
  duruyor ve indirirken başlıkta veriliyor.
*/

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { extname, basename } from 'node:path';

/** Tek dosya için üst sınır. Büyük dosya eşitlemeyi kilitler. */
export const EN_BUYUK_DOSYA = 25 * 1024 * 1024;

/*
  İzin verilen türler. Beyaz liste, çünkü kara liste her yeni tehlikeli
  uzantıda güncellenmek zorunda kalır ve biri unutulur.
*/
export const IZINLI_TURLER = new Map([
	['.pdf', 'application/pdf'],
	['.png', 'image/png'],
	['.jpg', 'image/jpeg'],
	['.jpeg', 'image/jpeg'],
	['.webp', 'image/webp'],
	['.gif', 'image/gif'],
	['.heic', 'image/heic'],
	['.dxf', 'application/dxf'],
	['.dwg', 'application/acad'],
	['.step', 'application/step'],
	['.stp', 'application/step'],
	['.stl', 'model/stl'],
	['.zip', 'application/zip'],
	['.txt', 'text/plain'],
	['.csv', 'text/csv'],
	['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
	['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
]);

const GORSEL_TURLERI = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic']);

/**
 * Dosyayı inceler: tür izinli mi, boyut sınırda mı, özeti ne?
 * Gönderimden ÖNCE çağrılıyor; reddedilecek bir dosya için ağ kullanılmıyor.
 */
export async function dosyayiIncele(yerelYol) {
	const uzanti = extname(yerelYol).toLowerCase();
	const tur = IZINLI_TURLER.get(uzanti);
	if (!tur) {
		throw new Error(
			`Bu dosya türü paylaşılamıyor: ${uzanti || 'uzantısız'}. ` +
				`İzin verilenler: ${[...IZINLI_TURLER.keys()].join(', ')}`,
		);
	}

	const bilgi = statSync(yerelYol);
	if (!bilgi.isFile()) throw new Error('Yalnızca dosya paylaşılabilir');
	if (bilgi.size === 0) throw new Error('Dosya boş');
	if (bilgi.size > EN_BUYUK_DOSYA) {
		throw new Error(
			`Dosya çok büyük: ${(bilgi.size / 1048576).toFixed(1)} MB. ` +
				`Sınır ${EN_BUYUK_DOSYA / 1048576} MB.`,
		);
	}

	const sha256 = await dosyaOzeti(yerelYol);

	return {
		gosterilen_ad: basename(yerelYol),
		// Diskteki ad: rastgele artı izinli uzantı. Gösterilen addan bağımsız.
		depo_adi: randomBytes(16).toString('hex') + uzanti,
		tur,
		boyut: bilgi.size,
		sha256,
		gorsel_mi: GORSEL_TURLERI.has(tur) ? 1 : 0,
	};
}

/**
 * Gönderilen dosyanın sahibini panel kullanıcısına çevirir ve iznini daraltır.
 * Kullanıcı adı ayardan geliyor, kodda sabit değil: sunucu kurulumu değişirse
 * burası da değişmeli.
 */
function sahipligiDuzelt(ayar, hedef) {
	const kullanici = ayar['esitleme.uzak_kullanici'] ?? 'panel';
	if (!/^[a-z_][a-z0-9_-]*$/.test(kullanici)) {
		return Promise.reject(new Error('Uzak kullanıcı adı geçersiz'));
	}
	return new Promise((coz, at) => {
		const surec = spawn(
			'ssh',
			[
				'-i', ayar['esitleme.ssh_anahtari'],
				'-o', 'BatchMode=yes',
				ayar['esitleme.sunucu'],
				'chown', `${kullanici}:${kullanici}`, hedef,
				'&&', 'chmod', '640', hedef,
			],
			{ shell: false },
		);
		let hata = '';
		surec.stderr.on('data', (p) => (hata += p));
		surec.on('error', at);
		surec.on('close', (kod) =>
			kod === 0 ? coz() : at(new Error(`Dosya sahipliği düzeltilemedi: ${hata.trim()}`)),
		);
	});
}

/** Dosyanın SHA-256 özeti: gönderim sonrası bütünlük denetimi için. */
export function dosyaOzeti(yerelYol) {
	return new Promise((coz, at) => {
		const karma = createHash('sha256');
		const akis = createReadStream(yerelYol);
		akis.on('data', (parca) => karma.update(parca));
		akis.on('end', () => coz(karma.digest()));
		akis.on('error', at);
	});
}

/**
 * Dosyayı sunucuya kopyalar ve sahipliğini panel kullanıcısına verir.
 *
 * Sahiplik şart: SSH ile bağlanan sahip root, root'un yazdığı dosyayı panel
 * süreci okuyamayabilir. Aynı tuzak veritabanında da yaşanmıştı.
 */
export function dosyayiGonder(ayar, yerelYol, depoAdi, { zamanAsimiMs = 120000 } = {}) {
	const uzakDizin = `${ayar['esitleme.uzak_dosya'] ?? '/var/lib/panel/dosyalar'}`;
	const hedef = `${uzakDizin}/${depoAdi}`;

	return new Promise((coz, at) => {
		const scp = spawn(
			'scp',
			[
				'-i', ayar['esitleme.ssh_anahtari'],
				'-o', 'BatchMode=yes',
				'-o', 'StrictHostKeyChecking=accept-new',
				'-q',
				yerelYol,
				`${ayar['esitleme.sunucu']}:${hedef}`,
			],
			{ shell: false },
		);
		let hata = '';
		const sayac = setTimeout(() => {
			scp.kill();
			at(new Error('Dosya gönderimi zaman aşımına uğradı'));
		}, zamanAsimiMs);
		scp.stderr.on('data', (p) => (hata += p));
		scp.on('error', (h) => {
			clearTimeout(sayac);
			at(new Error(`scp başlatılamadı: ${h.message}`));
		});
		scp.on('close', (kod) => {
			clearTimeout(sayac);
			if (kod !== 0) {
				at(new Error(`Dosya gönderilemedi (${kod}): ${hata.trim()}`));
				return;
			}
			/*
			  Sahipliği düzelt. SSH ile bağlanan sahip root ve root'un yazdığı
			  dosyanın sahibi de root oluyor; panel süreci başka bir kullanıcı
			  olarak çalıştığı için onu okuyamayabilir. Aynı tuzak veritabanında
			  yaşandı, orada WAL dosyaları root sahipli kalıyordu.
			*/
			sahipligiDuzelt(ayar, hedef).then(() => coz(hedef), at);
		});
	});
}

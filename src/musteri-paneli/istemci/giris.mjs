/*
  Giriş sayfasının tarayıcı tarafı.

  Panelde JavaScript çalışıyor çünkü WebAuthn bunu zorunlu kılıyor:
  `navigator.credentials` başka türlü çağrılamaz. Yayınlanan statik sitenin
  sıfır JavaScript kuralı buraya GEÇERLİ DEĞİL, panel ayrı bir uygulama.

  Eklenen tek paket `@simplewebauthn/browser`: base64url dönüşümlerini ve
  tarayıcı farklarını kapatan ince bir sarmalayıcı.
*/

import { startAuthentication, startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { anahtarBicimiGecerliMi, anahtaraBenziyorMu, temizle } from './anahtar.mjs';

const kok = document.getElementById('giris');
if (kok) kur(kok);

function kur(kok) {
	const taban = kok.dataset.taban ?? '';
	const bildirim = kok.querySelector('[data-bildirim]');
	const girisDugmesi = kok.querySelector('[data-giris]');
	const davetFormu = kok.querySelector('[data-davet-formu]');
	const davetAlani = kok.querySelector('[data-davet-alani]');
	const davetKutusu = kok.querySelector('[data-davet-kutusu]');

	function soyle(metin, tur = 'hata') {
		bildirim.textContent = metin;
		bildirim.dataset.tur = tur;
	}

	function temizleBildirim() {
		bildirim.textContent = '';
	}

	async function gonder(yol, govde) {
		const yanit = await fetch(`${taban}${yol}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(govde),
			credentials: 'same-origin',
		});
		let cozulen = null;
		try {
			cozulen = await yanit.json();
		} catch {
			cozulen = null;
		}
		return { durum: yanit.status, govde: cozulen };
	}

	if (!browserSupportsWebAuthn()) {
		soyle('Bu tarayıcı passkey desteklemiyor. Güncel bir tarayıcıyla deneyin.');
		if (girisDugmesi) girisDugmesi.disabled = true;
	}

	/*
	  ADRES ÇAPASINDAN GELEN ANAHTAR.

	  Çapa (`#` sonrası) tarayıcıdan sunucuya HİÇ gönderilmiyor, yani anahtar
	  sunucu günlüklerine düşmüyor (§5.1). Okunduktan sonra adres çubuğundan
	  siliniyor: bağlantı geçmişte, ekran paylaşımında ya da omuz üstünde
	  gereğinden uzun durmasın.
	*/
	const capa = decodeURIComponent((location.hash || '').replace(/^#/, ''));
	if (capa && anahtaraBenziyorMu(capa) && davetAlani) {
		davetAlani.value = capa;
		if (davetKutusu) davetKutusu.open = true;
		history.replaceState(null, '', location.pathname + location.search);
	}

	girisDugmesi?.addEventListener('click', async () => {
		temizleBildirim();
		girisDugmesi.disabled = true;
		try {
			const basla = await gonder('/api/giris/basla', {});
			if (!basla.govde?.tamam) {
				soyle(basla.govde?.mesaj ?? 'Giriş başlatılamadı.');
				return;
			}
			const cevap = await startAuthentication({ optionsJSON: basla.govde.secenekler });
			const bitir = await gonder('/api/giris/tamamla', { bilet: basla.govde.bilet, cevap });
			if (bitir.govde?.tamam) {
				location.assign(`${taban}/pano`);
				return;
			}
			soyle(bitir.govde?.mesaj ?? 'Giriş tamamlanamadı.');
		} catch (hata) {
			soyle(cihazHatasi(hata));
		} finally {
			girisDugmesi.disabled = false;
		}
	});

	davetFormu?.addEventListener('submit', async (olay) => {
		olay.preventDefault();
		temizleBildirim();
		const dugme = davetFormu.querySelector('button[type="submit"]');
		const anahtar = temizle(davetAlani.value);

		/* Biçim bozuksa sunucuya HİÇ gidilmiyor. */
		if (!(await anahtarBicimiGecerliMi(anahtar))) {
			soyle('Anahtar eksik ya da yanlış yazılmış. Baştan kontrol edip yeniden deneyin.');
			davetAlani.focus();
			return;
		}

		dugme.disabled = true;
		try {
			const dogrula = await gonder('/api/davet/dogrula', { anahtar });
			if (!dogrula.govde?.tamam) {
				soyle(dogrula.govde?.mesaj ?? 'Anahtar kabul edilmedi.');
				return;
			}
			const cevap = await startRegistration({ optionsJSON: dogrula.govde.secenekler });
			const bitir = await gonder('/api/davet/tamamla', { bilet: dogrula.govde.bilet, cevap });
			if (bitir.govde?.tamam) {
				location.assign(`${taban}/pano`);
				return;
			}
			soyle(bitir.govde?.mesaj ?? 'Kayıt tamamlanamadı.');
		} catch (hata) {
			soyle(cihazHatasi(hata));
		} finally {
			dugme.disabled = false;
			davetAlani.value = '';
		}
	});
}

/** Tarayıcının attığı hataları anlaşılır Türkçeye çeviriyor. */
function cihazHatasi(hata) {
	const ad = hata?.name ?? '';
	if (ad === 'NotAllowedError') return 'İşlem yarıda kaldı ya da zaman aşımına uğradı. Yeniden deneyin.';
	if (ad === 'InvalidStateError') return 'Bu cihaz zaten kayıtlı. Doğrudan giriş yapmayı deneyin.';
	if (ad === 'SecurityError') return 'Adres doğrulanamadı. Panele her zaman kendi adresinden girin.';
	if (ad === 'AbortError') return 'İşlem iptal edildi.';
	return 'Cihazla iletişim kurulamadı. Yeniden deneyin.';
}

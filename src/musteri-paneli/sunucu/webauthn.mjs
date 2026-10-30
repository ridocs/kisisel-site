/*
  WebAuthn: kayıt ve giriş.

  Kriptografi BURADA YAZILMIYOR. İmza doğrulaması, CBOR çözümü, COSE anahtar
  ayrıştırması ve alan adı kontrolü `@simplewebauthn/server` v14'ten geliyor.
  Bu dosyanın işi meydan okumayı saklamak, sonucu veritabanına yazmak ve
  başarısızlıkları tek tip döndürmek.

  v14 API'si v13'ten farklı; imzalar `node_modules/@simplewebauthn/server/esm`
  altındaki tip dosyalarından doğrulandı:
  - `verifyRegistrationResponse` sonucu `registrationInfo.credential`
    ({ id, publicKey, counter, transports }) veriyor, v13'teki
    `credentialID` / `credentialPublicKey` düzleştirmesi yok.
  - `verifyAuthenticationResponse` artık `credential` alanını istiyor
    (v13'te `authenticator` idi).
  - Tarayıcı tarafında `startRegistration({ optionsJSON })` ve
    `startAuthentication({ optionsJSON })`, yani seçenekler sarmalanıyor.
*/

import {
	generateRegistrationOptions,
	verifyRegistrationResponse,
	generateAuthenticationOptions,
	verifyAuthenticationResponse,
} from '@simplewebauthn/server';

import { yeniKimlik } from '../../../veri/kimlik.mjs';
import { ayarlar } from './ayarlar.mjs';

/** Kayıt bileti ve meydan okumanın ömrü (§5.2). */
export const MEYDAN_OMRU_MS = 10 * 60 * 1000;

/*
  Ayarlar üç yerde birden geçiyor, tek yerde dursun:
  `residentKey: required`  -> kullanıcı adı yazmadan giriş,
  `userVerification: required` -> parmak izi, yüz veya cihaz PIN'i,
  `attestation: none` -> cihaz modelini toplamıyoruz, gerekmiyor.
*/
export const KIMLIK_DOGRULAYICI_SECIMI = Object.freeze({
	residentKey: 'required',
	userVerification: 'required',
});

function meydanOkumaYaz(db, { deger, amac, musteriId = null, davetId = null, simdiMs }) {
	const id = yeniKimlik();
	db.prepare(
		`INSERT INTO meydan_okuma (id, deger, amac, musteri_id, davet_id, son_kullanma, olusturuldu)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
	).run(
		id,
		deger,
		amac,
		musteriId,
		davetId,
		new Date(simdiMs + MEYDAN_OMRU_MS).toISOString(),
		new Date(simdiMs).toISOString(),
	);
	return id;
}

/**
 * Bileti tüketir. Tek kullanımlık: aynı meydan okuma ikinci kez kabul
 * edilmiyor, tekrar saldırısını kesen şey bu.
 */
function meydanOkumaTuket(db, { bilet, amac, simdiMs }) {
	if (typeof bilet !== 'string' || bilet.length === 0) return null;
	const satir = db.prepare('SELECT * FROM meydan_okuma WHERE id = ? AND amac = ?').get(bilet, amac);
	if (!satir) return null;
	db.prepare('DELETE FROM meydan_okuma WHERE id = ?').run(bilet);
	if (satir.tuketildi) return null;
	if (Date.parse(satir.son_kullanma) <= simdiMs) return null;
	return satir;
}

/** Süresi geçmiş meydan okumaları toplar. Her akışın başında ucuza çağrılıyor. */
export function meydanOkumalariTemizle(db, simdiMs = Date.now()) {
	db.prepare('DELETE FROM meydan_okuma WHERE son_kullanma <= ?').run(new Date(simdiMs).toISOString());
}

function b64(baytlar) {
	return Buffer.from(baytlar).toString('base64url');
}

function aktarimlariCoz(metin) {
	if (!metin) return undefined;
	try {
		const cozulen = JSON.parse(metin);
		return Array.isArray(cozulen) && cozulen.length > 0 ? cozulen : undefined;
	} catch {
		return undefined;
	}
}

/** Kayıt seçenekleri. Davet doğrulandıktan SONRA çağrılıyor. */
export async function kayitSecenekleri(db, { davet, musteri, simdiMs = Date.now() }) {
	const mevcut = db
		.prepare('SELECT credential_id, aktarim FROM kimlik_bilgisi WHERE musteri_id = ?')
		.all(musteri.id);

	const secenekler = await generateRegistrationOptions({
		rpName: ayarlar.rpAd,
		rpID: ayarlar.rpId,
		userName: musteri.gorunenAd,
		userDisplayName: musteri.gorunenAd,
		userID: Buffer.from(musteri.id, 'utf8'),
		attestationType: 'none',
		/*
		  KOPYA VERİLİYOR, sabitin kendisi değil. Ölçüldü: v14
		  `generateRegistrationOptions` gelen nesneye `requireResidentKey`
		  alanını EKLİYOR; dondurulmuş sabit doğrudan verilince
		  "object is not extensible" diyerek 500 veriyor.
		*/
		authenticatorSelection: { ...KIMLIK_DOGRULAYICI_SECIMI },
		timeout: MEYDAN_OMRU_MS,
		/* Aynı cihaz iki kez kaydedilmesin. */
		excludeCredentials: mevcut.map((satir) => ({
			id: b64(satir.credential_id),
			transports: aktarimlariCoz(satir.aktarim),
		})),
	});

	const bilet = meydanOkumaYaz(db, {
		deger: Buffer.from(secenekler.challenge, 'base64url'),
		amac: 'kayit',
		musteriId: musteri.id,
		davetId: davet.id,
		simdiMs,
	});

	return { bilet, secenekler };
}

/**
 * Kayıt cevabını doğrular ve kimlik bilgisini saklar.
 * Başarısızlıkta `{ tamam: false }`; sebep yalnızca günlüğe gidiyor.
 */
export async function kaydiDogrula(db, { bilet, cevap, simdiMs = Date.now() }) {
	const meydan = meydanOkumaTuket(db, { bilet, amac: 'kayit', simdiMs });
	if (!meydan) return { tamam: false, sebep: 'bilet' };

	let sonuc;
	try {
		sonuc = await verifyRegistrationResponse({
			response: cevap,
			expectedChallenge: Buffer.from(meydan.deger).toString('base64url'),
			expectedOrigin: ayarlar.origin,
			expectedRPID: ayarlar.rpId,
			requireUserVerification: true,
		});
	} catch (hata) {
		return { tamam: false, sebep: `dogrulama: ${hata.message}` };
	}

	if (!sonuc.verified) return { tamam: false, sebep: 'gecersiz' };

	const { credential, credentialBackedUp } = sonuc.registrationInfo;
	db.prepare(
		`INSERT INTO kimlik_bilgisi
		   (id, musteri_id, credential_id, acik_anahtar, sayac, aktarim, cihaz_adi, yedekli, olusturuldu)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		yeniKimlik(),
		meydan.musteri_id,
		Buffer.from(credential.id, 'base64url'),
		Buffer.from(credential.publicKey),
		credential.counter ?? 0,
		JSON.stringify(cevap?.response?.transports ?? credential.transports ?? []),
		null,
		credentialBackedUp ? 1 : 0,
		new Date(simdiMs).toISOString(),
	);

	return { tamam: true, musteriId: meydan.musteri_id, davetId: meydan.davet_id };
}

/**
 * Giriş seçenekleri.
 *
 * `allowCredentials` BOŞ bırakılıyor: `residentKey: required` ile kaydedilen
 * passkey'ler keşfedilebilir, tarayıcı listeyi kendi gösteriyor. Liste
 * verseydik, hangi kimlik bilgilerinin var olduğunu kimlik doğrulamadan önce
 * söylemiş olurduk; bu da hesap sayımının ta kendisi.
 */
export async function girisSecenekleri(db, { simdiMs = Date.now() } = {}) {
	const secenekler = await generateAuthenticationOptions({
		rpID: ayarlar.rpId,
		userVerification: 'required',
		timeout: MEYDAN_OMRU_MS,
	});
	const bilet = meydanOkumaYaz(db, {
		deger: Buffer.from(secenekler.challenge, 'base64url'),
		amac: 'giris',
		simdiMs,
	});
	return { bilet, secenekler };
}

/**
 * Giriş cevabını doğrular.
 *
 * Kimlik bilgisi bulunamasa bile aynı yolun aynı uzunluğu yürünüyor: erken
 * dönüş yok, çağıran taraf başarısızlıkta hep aynı yanıtı veriyor.
 */
export async function girisiDogrula(db, { bilet, cevap, simdiMs = Date.now() }) {
	const meydan = meydanOkumaTuket(db, { bilet, amac: 'giris', simdiMs });
	if (!meydan) return { tamam: false, sebep: 'bilet' };

	const kimlikId = typeof cevap?.id === 'string' ? cevap.id : '';
	let aranan = null;
	try {
		aranan = Buffer.from(kimlikId, 'base64url');
	} catch {
		aranan = Buffer.alloc(0);
	}

	const satir = db
		.prepare(
			`SELECT k.*, m.durum AS musteri_durumu
			 FROM kimlik_bilgisi k JOIN musteri m ON m.id = k.musteri_id
			 WHERE k.credential_id = ? AND k.askiya_alindi IS NULL`,
		)
		.get(aranan);

	if (!satir) return { tamam: false, sebep: 'kimlik-yok' };
	if (satir.musteri_durumu !== 'etkin') return { tamam: false, sebep: 'musteri-askida' };

	let sonuc;
	try {
		sonuc = await verifyAuthenticationResponse({
			response: cevap,
			expectedChallenge: Buffer.from(meydan.deger).toString('base64url'),
			expectedOrigin: ayarlar.origin,
			expectedRPID: ayarlar.rpId,
			requireUserVerification: true,
			credential: {
				id: b64(satir.credential_id),
				publicKey: Buffer.from(satir.acik_anahtar),
				counter: satir.sayac,
				transports: aktarimlariCoz(satir.aktarim),
			},
		});
	} catch (hata) {
		/*
		  Kütüphane, gelen sayaç saklanandan küçük veya eşitse hata atıyor.
		  Bu, kimlik bilgisinin kopyalanmış olabileceğinin tek işareti: o
		  kimlik bilgisi askıya alınıyor ve sahibe bildirilmesi için
		  `deneme` tablosuna düşüyor (§5.3).
		*/
		if (/counter/i.test(hata.message)) {
			kimlikBilgisiniAskiyaAl(db, satir.id, simdiMs);
			return { tamam: false, sebep: 'sayac', musteriId: satir.musteri_id, askiyaAlindi: true };
		}
		return { tamam: false, sebep: `dogrulama: ${hata.message}`, musteriId: satir.musteri_id };
	}

	if (!sonuc.verified) return { tamam: false, sebep: 'gecersiz', musteriId: satir.musteri_id };

	const yeniSayac = sonuc.authenticationInfo.newCounter;
	/*
	  İkinci kontrol: kütüphane zaten bakıyor ama kural bu dosyada da yazılı
	  dursun. Senkronize passkey'lerde sayaç sıfır kalıyor, o durumda kontrol
	  atlanıyor (§5.3 notu).
	*/
	if (satir.sayac > 0 && yeniSayac <= satir.sayac) {
		kimlikBilgisiniAskiyaAl(db, satir.id, simdiMs);
		return { tamam: false, sebep: 'sayac', musteriId: satir.musteri_id, askiyaAlindi: true };
	}

	db.prepare('UPDATE kimlik_bilgisi SET sayac = ?, son_kullanim = ? WHERE id = ?').run(
		yeniSayac,
		new Date(simdiMs).toISOString(),
		satir.id,
	);

	return { tamam: true, musteriId: satir.musteri_id, kimlikBilgisiId: satir.id };
}

export function kimlikBilgisiniAskiyaAl(db, kimlikBilgisiId, simdiMs = Date.now()) {
	db.prepare('UPDATE kimlik_bilgisi SET askiya_alindi = ? WHERE id = ?').run(
		new Date(simdiMs).toISOString(),
		kimlikBilgisiId,
	);
}

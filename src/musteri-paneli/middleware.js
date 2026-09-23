/*
  Her isteğin geçtiği tek kapı.

  Dört işi var ve dördü de tek yerde olmak zorunda; sayfa başına yazılan bir
  kontrol er geç bir sayfada unutulur:

  1. Güvenlik başlıkları (CSP, nosniff, referrer, HSTS).
  2. Oturumu okuma ve tazeleme.
  3. Yetki: oturumu olmayan panel sayfasına giremiyor.
  4. CSRF'in ilk katmanı: durum değiştiren isteklerde köken kontrolü.
     İkinci katman (oturuma bağlı işlem anahtarı) form işleyen sayfalarda,
     gövde ayrıştırıldıktan sonra.
*/

import { oturumKarmasi } from '../../veri/kimlik.mjs';
import { ayarlar } from './sunucu/ayarlar.mjs';
import { basliklariEkle, nonceUret } from './sunucu/basliklar.mjs';
import { cerezOku, cereziSil, istemciIzleri, json, kokenGuvenliMi } from './sunucu/istek.mjs';
import { islemAnahtari } from './sunucu/csrf.mjs';
import { oturumOku, oturumTazele } from './sunucu/oturum.mjs';
import { musteriGetir, panelVt } from './sunucu/veritabani.mjs';

const TABAN = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

/** Oturum istemeyen adresler. Bunun dışındaki her şey girişin arkasında. */
const ACIK_YOLLAR = new Set([
	'/',
	'/api/davet/dogrula',
	'/api/davet/tamamla',
	'/api/giris/basla',
	'/api/giris/tamamla',
]);

function yolAyikla(yolAdi) {
	let yol = yolAdi;
	if (TABAN && (yol === TABAN || yol.startsWith(`${TABAN}/`))) yol = yol.slice(TABAN.length);
	if (!yol.startsWith('/')) yol = `/${yol}`;
	/* Sondaki eğik çizgi anlamlı değil: /talepler ile /talepler/ aynı sayfa. */
	if (yol.length > 1 && yol.endsWith('/')) yol = yol.slice(0, -1);
	return yol;
}

/** Astro ve Vite'ın kendi varlıkları: yetki kontrolüne girmiyorlar. */
function varlikMi(yol) {
	return yol.startsWith('/_astro') || yol.startsWith('/@') || yol.startsWith('/node_modules');
}

export async function onRequest(context, next) {
	const nonce = nonceUret();
	context.locals.nonce = nonce;

	const yol = yolAyikla(context.url.pathname);
	if (varlikMi(yol)) return basliklariEkle(await next(), nonce);

	const apiMi = yol.startsWith('/api/');
	const db = panelVt();
	const simdiMs = Date.now();
	const izler = istemciIzleri(context.request, context.clientAddress);

	/*
	  KÖKEN KONTROLÜ. `SameSite=Strict` zaten çapraz siteden çerez
	  göndermiyor, ama OWASP'ın dediği gibi tek başına dayanak değil.
	  Bu kontrol ucuz ve gövde okunmadan çalışıyor.
	*/
	if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
		if (!kokenGuvenliMi(context.request)) {
			return basliklariEkle(
				json({ tamam: false, mesaj: 'İstek reddedildi.' }, 403),
				nonce,
			);
		}
	}

	const cerez = cerezOku(context.request.headers.get('cookie'), ayarlar.cerezAdi);
	const karma = cerez ? oturumKarmasi(cerez) : null;
	const durum = oturumOku(db, {
		karma,
		ipKarmasi: izler.ip,
		istemciIzi: izler.izi,
		simdiMs,
	});

	let cerezTemizle = false;
	if (durum.gecerli) {
		const musteri = musteriGetir(db, durum.musteriId);
		if (musteri) {
			/* Hareketsizlik sayacı her istekte sıfırlanıyor, mutlak ömre dokunulmuyor. */
			oturumTazele(db, karma, simdiMs);
			context.locals.musteri = musteri;
			context.locals.oturumKarmasi = karma;
			context.locals.islemAnahtari = islemAnahtari(karma, ayarlar.gizli.csrf);
		} else {
			/* Müşteri askıya alınmışsa oturum da düşüyor. */
			cerezTemizle = true;
		}
	} else if (cerez) {
		cerezTemizle = true;
	}

	context.locals.taban = TABAN;

	const girisli = Boolean(context.locals.musteri);

	if (!girisli && !ACIK_YOLLAR.has(yol)) {
		const yanit = apiMi
			? json({ tamam: false, mesaj: 'Oturum bulunamadı.' }, 401)
			: context.redirect(`${TABAN}/`, 303);
		if (cerezTemizle) yanit.headers.append('set-cookie', cereziSil());
		return basliklariEkle(yanit, nonce);
	}

	/* Girişliyken giriş sayfasında durmanın anlamı yok. */
	if (girisli && yol === '/') {
		return basliklariEkle(context.redirect(`${TABAN}/pano`, 303), nonce);
	}

	const yanit = await next();
	if (cerezTemizle) yanit.headers.append('set-cookie', cereziSil());
	return basliklariEkle(yanit, nonce);
}

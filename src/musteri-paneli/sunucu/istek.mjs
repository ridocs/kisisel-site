/*
  HTTP kenarındaki küçük işler: çerez okuma ve yazma, istemci adresi,
  sabit süreli yanıt, JSON yardımcıları.

  Kimlik doğrulama mantığı burada YOK; bu dosya yalnızca istekle veritabanı
  arasındaki çeviriyi yapıyor.
*/

import { ipKarmasi, istemciIzi } from '../../../veri/kimlik.mjs';
import { ayarlar } from './ayarlar.mjs';

/**
 * Başarısız akışların hepsinde dönen TEK mesaj.
 * Davet mi yoktu, süresi mi geçmişti, müşteri mi askıdaydı: dışarıdan
 * ayırt edilemiyor (§8).
 */
export const GENEL_HATA = 'Anahtar kabul edilmedi. Anahtarı kontrol edin veya yeni bir davet isteyin.';

/** Giriş akışının tek mesajı. */
export const GIRIS_HATASI = 'Giriş tamamlanamadı. Kayıtlı cihazınızla yeniden deneyin.';

/** Kilit mesajı. Sayaç dolduğunda. */
export const KILIT_HATASI = 'Çok fazla başarısız deneme yapıldı. Bir süre sonra tekrar deneyin.';

/** Bütün başarısız yanıtların hedef süresi. Zamanlama farkını siliyor. */
export const EN_AZ_SURE_MS = 400;

/** `Cookie` başlığından tek bir çerezi okur. */
export function cerezOku(baslik, ad) {
	if (!baslik) return null;
	for (const parca of baslik.split(';')) {
		const esit = parca.indexOf('=');
		if (esit === -1) continue;
		if (parca.slice(0, esit).trim() !== ad) continue;
		return decodeURIComponent(parca.slice(esit + 1).trim());
	}
	return null;
}

/**
 * Oturum çerezinin `Set-Cookie` değeri.
 *
 * `Secure; HttpOnly; SameSite=Strict; Path=/web-sitem/panel/` (§7).
 * `Max-Age` verilmiyor: çerez oturumluk kalıyor, asıl ömür sunucudaki
 * kayıtta. Tarayıcıdaki süreye güvenmenin bir anlamı yok.
 */
export function cerezYaz(deger) {
	const parcalar = [
		`${ayarlar.cerezAdi}=${deger}`,
		`Path=${ayarlar.cerezYolu}`,
		'HttpOnly',
		'SameSite=Strict',
	];
	if (ayarlar.cerezGuvenli) parcalar.push('Secure');
	return parcalar.join('; ');
}

/** Çıkışta: çerez geçersiz kılınıyor. */
export function cereziSil() {
	const parcalar = [
		`${ayarlar.cerezAdi}=`,
		`Path=${ayarlar.cerezYolu}`,
		'HttpOnly',
		'SameSite=Strict',
		'Max-Age=0',
	];
	if (ayarlar.cerezGuvenli) parcalar.push('Secure');
	return parcalar.join('; ');
}

/**
 * İstemcinin adresi.
 *
 * `X-Forwarded-For` yalnızca ters vekile güvenileceği açıkça söylendiğinde
 * okunuyor: aksi hâlde başlığı isteyen herkes yazabilir ve IP sayacı
 * anlamsızlaşır.
 */
export function istemciAdresi(istek, clientAddress) {
	if (ayarlar.vekilGuvenilir) {
		const iletilen = istek.headers.get('x-forwarded-for');
		if (iletilen) {
			const ilk = iletilen.split(',')[0].trim();
			if (ilk) return ilk;
		}
	}
	return clientAddress ?? null;
}

/** İstekten IP karması ve tarayıcı izi. Düz IP hiçbir yere yazılmıyor. */
export function istemciIzleri(istek, clientAddress) {
	const adres = istemciAdresi(istek, clientAddress);
	return {
		ip: ayarlar.oturumIpBagla && adres ? ipKarmasi(adres, ayarlar.gizli.ip) : null,
		/** Sayaç için IP her hâlükârda gerekli, oturuma bağlanmasa bile. */
		sayacIp: adres ? ipKarmasi(adres, ayarlar.gizli.ip) : null,
		izi: istemciIzi(
			istek.headers.get('user-agent'),
			istek.headers.get('accept-language'),
			ayarlar.gizli.izi,
		),
	};
}

/**
 * Yanıtı hedef süreye kadar bekletir.
 *
 * Hızlı dönen bir "anahtar yok" ile yavaş dönen bir "anahtar var ama süresi
 * geçmiş" arasındaki fark ölçülebilir bir sızıntıdır. Taban süre bunu siler.
 */
export async function enAzSur(baslangicMs, hedefMs = EN_AZ_SURE_MS) {
	const kalan = hedefMs - (Date.now() - baslangicMs);
	if (kalan > 0) await new Promise((coz) => setTimeout(coz, kalan));
}

/** Uygulanan gecikmeyi (oran sınırlama) bekler. */
export async function beklet(ms) {
	if (ms > 0) await new Promise((coz) => setTimeout(coz, ms));
}

export function json(govde, durum = 200, ekBasliklar = {}) {
	return new Response(JSON.stringify(govde), {
		status: durum,
		headers: { 'content-type': 'application/json; charset=utf-8', ...ekBasliklar },
	});
}

/**
 * Bütün başarısızlıkların ortak yanıtı: aynı kod, aynı gövde.
 * HTTP kodu da sabit; 401/404/409 ayrımı tam da gizlemek istediğimiz şeyi
 * söylerdi.
 */
export async function basarisiz(baslangicMs, mesaj = GENEL_HATA) {
	await enAzSur(baslangicMs);
	return json({ tamam: false, mesaj }, 401);
}

/**
 * Köken kontrolü: CSRF'e karşı ikinci katman.
 * `Sec-Fetch-Site` bütün güncel tarayıcılarda var; yoksa `Origin`e bakılıyor.
 */
export function kokenGuvenliMi(istek) {
	const site = istek.headers.get('sec-fetch-site');
	if (site) return site === 'same-origin' || site === 'none';
	const koken = istek.headers.get('origin');
	if (!koken) return false;
	return koken === ayarlar.origin;
}

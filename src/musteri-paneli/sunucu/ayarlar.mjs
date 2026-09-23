/*
  Panelin çalışma ayarları. Hepsi ortam değişkeninden geliyor.

  BURADA SABİT BİR SIR YOK ve olmayacak. Depo herkese açık; koda gömülen bir
  anahtar, yazıldığı anda yayınlanmış demektir. Yer tutucu örnek `.env.ornek`
  dosyasında, gerçek değerler yalnızca sunucudaki `.env` dosyasında.

  Eksik ayar sessizce geçilmiyor: `ayarlariDogrula()` açılışta çağrılıyor
  (astro.config.panel.mjs) ve eksik değer varsa uygulama anlaşılır bir hata
  ile duruyor. Yarı çalışan bir kimlik doğrulama, hiç çalışmayandan kötüdür.
*/

import { existsSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BURASI = dirname(fileURLToPath(import.meta.url));
/** Depo kökü: sunucu/ -> musteri-paneli/ -> src/ -> kök. */
export const KOK = resolve(BURASI, '..', '..', '..');

/*
  `.env` okuması Node'un kendi `process.loadEnvFile`'ı ile. Vite'ın
  `import.meta.env`'i yalnızca `PUBLIC_` önekli değerleri istemciye açtığı ve
  sunucu tarafında `process.env`'i doldurmadığı için ona güvenilmiyor.
  Sunucuda değerler zaten süreç ortamından (servis tanımı) geliyor; bu satır
  yalnızca geliştirme kolaylığı.
*/
const ORTAM_DOSYASI = join(KOK, '.env');
if (existsSync(ORTAM_DOSYASI)) {
	try {
		process.loadEnvFile(ORTAM_DOSYASI);
	} catch {
		// Bozuk .env yüzünden süreç düşmesin; eksik değer aşağıda zaten yakalanıyor.
	}
}

/** Gizli anahtarın en az uzunluğu. 32 bayt = 256 bit. */
export const GIZLI_EN_AZ = 32;

const eksikler = [];

function zorunlu(ad, aciklama) {
	const deger = process.env[ad];
	if (!deger) {
		eksikler.push(`${ad}: ${aciklama}`);
		return '';
	}
	return deger;
}

function secmeli(ad, varsayilan) {
	const deger = process.env[ad];
	return deger === undefined || deger === '' ? varsayilan : deger;
}

const gelistirme = secmeli('PANEL_GELISTIRME', '0') === '1';
const gizliMetin = zorunlu(
	'PANEL_GIZLI',
	`en az ${GIZLI_EN_AZ} karakterlik rastgele dize. IP karması, tarayıcı izi ve CSRF işlem anahtarı bundan türetiliyor`,
);
if (gizliMetin && gizliMetin.length < GIZLI_EN_AZ) {
	eksikler.push(
		`PANEL_GIZLI: en az ${GIZLI_EN_AZ} karakter olmalı, ${gizliMetin.length} karakter verilmiş`,
	);
}

const rpId = zorunlu('PANEL_RP_ID', 'WebAuthn alan adı, örnek: twinshareapp.com (şema ve port olmadan)');
const origin = zorunlu('PANEL_ORIGIN', 'panelin tarayıcıdaki tam kökeni, örnek: https://twinshareapp.com');

const vtDeger = secmeli('PANEL_VT', join(KOK, 'veri-yerel', 'panel.db'));

/*
  Gizli anahtar üç ayrı iş için kullanılıyor. Aynı baytları üç yerde doğrudan
  kullanmak yerine her kullanım için etiketli bir alt anahtar türetiliyor:
  bir kullanımdan sızan bilgi diğerine yaramaz.
*/
function altAnahtar(kok, etiket) {
	return createHmac('sha256', kok).update(`panel/${etiket}`).digest();
}

const kokGizli = Buffer.from(gizliMetin, 'utf8');

export const ayarlar = {
	gelistirme,
	rpId,
	rpAd: secmeli('PANEL_RP_AD', 'Müşteri Paneli'),
	origin,
	vtYolu: isAbsolute(vtDeger) ? vtDeger : join(KOK, vtDeger),
	/** Ters vekilin `X-Forwarded-For` başlığına güvenilsin mi. */
	vekilGuvenilir: secmeli('PANEL_VEKIL_GUVENILIR', '0') === '1',
	/** Oturum IP karmasına da bağlansın mı (PANEL-TASARIMI.md §7). */
	oturumIpBagla: secmeli('PANEL_OTURUM_IP_BAGLA', '1') === '1',
	/*
	  Çerez adı ve `Secure` bayrağı birlikte yürüyor: `__Secure-` öneki
	  tanımı gereği `Secure` istiyor, `Secure` çerez de düz HTTP'de tarayıcı
	  tarafından atılıyor. Geliştirmede (http://localhost) bu yüzden önek
	  kaldırılıyor. Üretimde her zaman önekli ve Secure.

	  `__Host-` DEĞİL: o önek `Path=/` şart koşar ve çerez alan adının bütün
	  yollarına, TwinShare uygulamasına da giderdi. Gerekçe §7.
	*/
	cerezAdi: gelistirme ? 'panel_oturum' : '__Secure-panel_oturum',
	cerezGuvenli: !gelistirme,
	cerezYolu: `${secmeli('PANEL_TABAN', '/web-sitem/panel').replace(/\/+$/, '')}/`,
	gizli: {
		ip: altAnahtar(kokGizli, 'ip'),
		izi: altAnahtar(kokGizli, 'istemci-izi'),
		csrf: altAnahtar(kokGizli, 'csrf'),
	},
};

/**
 * Eksik ayar varsa anlaşılır bir hata ile durur.
 * Açılışta çağrılıyor; ilk isteği beklemek hatayı gizlerdi.
 */
export function ayarlariDogrula() {
	if (eksikler.length === 0) return ayarlar;
	throw new Error(
		[
			'Müşteri paneli başlatılamadı: zorunlu ortam değişkenleri eksik.',
			'',
			...eksikler.map((satir) => `  - ${satir}`),
			'',
			`Örnek dosya: ${join(KOK, '.env.ornek')}`,
			`Kopyalayıp doldurun: ${ORTAM_DOSYASI}`,
			'',
			'Değerler DEPOYA YAZILMAZ; .env zaten .gitignore içinde.',
		].join('\n'),
	);
}

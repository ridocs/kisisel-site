import { readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

/*
  SEO METİN ALANLARI — okuma ve yazma

  Sayfa başlıkları ve açıklamaları `src/icerik/metinler-tr.json` ile
  `metinler-en.json` içinde duruyor; site tam da o dosyaları okuyor. Bu modül
  onların SEO'ya giren alanlarını ayıklıyor ve panelden gelen düzeltmeyi aynı
  dosyalara geri yazıyor.

  NEDEN AYRI BİR MODÜL (ve neden `.mjs`)

  Aynı mantığı hem sayfa (okuma) hem de yazma uç noktası kullanıyor. Uç nokta
  bir Vite ara katmanı, yani Astro'nun derleyicisinden geçmeyen düz Node kodu:
  `.ts` dosyasını içe aktaramıyor. Tür bilgisi bu yüzden JSDoc ile veriliyor —
  `olcum.ts` bu dosyadan tür de alıyor.

  YAZMA YALNIZCA MASAÜSTÜNDE. Bu modülün yazma yordamı internete açık panelde
  hiç bağlanmıyor (bkz. eklenti.mjs). Gerekçe güvenlik değil, DOĞRULUK: o kopya
  sunucudaki depoya yazıyor ve oraya yazılan şey kullanıcının bilgisayarındaki
  depoya hiçbir zaman ulaşmıyor — sessizce kaybolan bir düzeltme, hiç
  yapılamayan düzeltmeden kötü.
*/

/**
 * @typedef {'tr' | 'en'} Dil
 *
 * @typedef {object} MetinAlani
 * @property {Dil} dil
 * @property {string} anahtar   Düz anahtar: "hakkimda.sayfaBasligi".
 * @property {string} grup      JSON'daki üst grup: "hakkimda".
 * @property {string} ad        Grup içindeki alan adı: "sayfaBasligi".
 * @property {'baslik' | 'aciklama'} tur
 * @property {string} etiket    Ekranda görünen ad.
 * @property {string} deger
 */

/** Metin dosyalarının bulunduğu klasör; proje köküne göre. */
const ICERIK_KLASORU = join('src', 'icerik');

export const DILLER = /** @type {const} */ (['tr', 'en']);

/*
  Hangi alanlar SEO alanı?

  Liste rota rota yazılmıyor; kural ALAN ADINA bakıyor. `src/pages` altındaki
  her sayfa BaseLayout'a `grup.sayfaBasligi` ve `grup.aciklama` veriyor, ana
  sayfa da `site.baslik`/`site.aciklama`. Yeni bir sayfa aynı adlandırmayı
  izlediği sürece burada kendiliğinden beliriyor; elle tutulan bir liste ise
  eklenmeyi unutup sessizce eksik kalırdı.
*/
const AD_TURU = /** @type {Record<string, 'baslik' | 'aciklama'>} */ ({
	sayfaBasligi: 'baslik',
	aciklama: 'aciklama',
});

/*
  Kuralın dışında kalan iki alan.

  `site.baslik` ana sayfanın <title>'ı, `404.metin` ise hata sayfasının
  açıklaması olarak basılıyor (`src/pages/404.astro`). İkisi de ada bakan
  kurala uymuyor ama sayfanın arama sonucundaki görünümünü belirliyor; dışarıda
  bırakmak, panelin "her başlık burada" sözünü bozardı.

  `grup.baslik` alanlarının çoğu sayfa İÇİ başlık (ör. `calisma.baslik`), <title>
  değil. Bu yüzden `baslik` adı yalnızca `site` grubunda kabul ediliyor.
*/
const EK_ALANLAR = /** @type {Record<string, 'baslik' | 'aciklama'>} */ ({
	'404.metin': 'aciklama',
});

/** Ekranda grubun insan okunur adı; bilinmeyen grup kendi adıyla görünür. */
const GRUP_ADLARI = /** @type {Record<string, string>} */ ({
	site: 'Ana sayfa',
	'404': 'Hata sayfası',
	blog: 'Blog listesi',
	hakkimda: 'Hakkımda',
	hizmet: 'Hizmetler',
	kullandiklarim: 'Kullandıklarım',
	gizlilik: 'Gizlilik',
});

/** Tek satırlık meta metinleri için üst sınır; ikisi de arama sonucunda kırpılıyor. */
const EN_UZUN_DEGER = 300;

/**
 * Yazma bu kipte açık mı.
 *
 * Tek yerde duruyor çünkü iki ayrı yerde kullanılıyor: sayfa yazma alanlarını
 * BASMAMAK için, eklenti de uç noktayı BAĞLAMAMAK için. İki yerde ayrı ayrı
 * `process.env` okunsaydı biri değişip öteki geride kalabilirdi — o durumda
 * alanlar görünmezken uç nokta açık kalırdı.
 */
export function yazmaAcikMi() {
	return process.env.PANEL_EDITOR_YOK !== '1';
}

/** @param {string} kok @param {Dil} dil */
function metinDosyasi(kok, dil) {
	return join(kok, ICERIK_KLASORU, `metinler-${dil}.json`);
}

/**
 * Bir alanın SEO alanı olup olmadığı; değilse null.
 * @param {string} grup @param {string} ad
 * @returns {'baslik' | 'aciklama' | null}
 */
function alanTuru(grup, ad) {
	const anahtar = `${grup}.${ad}`;
	if (EK_ALANLAR[anahtar]) return EK_ALANLAR[anahtar];
	if (ad === 'baslik') return grup === 'site' ? 'baslik' : null;
	return AD_TURU[ad] ?? null;
}

/**
 * İki dildeki SEO metin alanlarını okur.
 * @returns {Promise<MetinAlani[]>}
 */
export async function seoAlanlariniOku() {
	const kok = process.cwd();
	/** @type {MetinAlani[]} */
	const alanlar = [];

	for (const dil of DILLER) {
		let gruplar;
		try {
			gruplar = JSON.parse(await readFile(metinDosyasi(kok, dil), 'utf8'));
		} catch {
			// Dosya okunamazsa o dilin alanları listelenmiyor; panel yine açılıyor.
			continue;
		}
		for (const [grup, kalemler] of Object.entries(gruplar)) {
			for (const [ad, deger] of Object.entries(/** @type {object} */ (kalemler))) {
				const tur = alanTuru(grup, ad);
				if (!tur || typeof deger !== 'string') continue;
				alanlar.push({
					dil,
					anahtar: `${grup}.${ad}`,
					grup,
					ad,
					tur,
					etiket: `${GRUP_ADLARI[grup] ?? grup} · ${tur === 'baslik' ? 'Başlık' : 'Açıklama'}`,
					deger,
				});
			}
		}
	}
	return alanlar;
}

/**
 * Bir SEO metin alanını dosyaya yazar.
 *
 * Hata durumunda `Error` fırlatıyor; mesajı doğrudan kullanıcıya gösteriliyor,
 * bu yüzden hepsi Türkçe ve ne yapılacağını söylüyor.
 *
 * @param {unknown} istem  Uç noktaya gelen ham gövde.
 * @returns {Promise<{ anahtar: string, dil: Dil, deger: string }>}
 */
export async function seoAlaniYaz(istem) {
	const kok = process.cwd();
	const { dil, anahtar, deger } = /** @type {Record<string, unknown>} */ (istem ?? {});

	if (typeof dil !== 'string' || !(/** @type {readonly string[]} */ (DILLER).includes(dil))) {
		throw new Error('Dil "tr" ya da "en" olmalı.');
	}
	if (typeof anahtar !== 'string' || typeof deger !== 'string') {
		throw new Error('Eksik alan: anahtar ve değer gerekiyor.');
	}

	/*
	  ANAHTAR DENETİMİ — uç nokta gövdesine güvenilmiyor.

	  Denetim olmasaydı bu uç nokta `metinler-*.json` içindeki HERHANGİ bir
	  alanı, hatta yeni bir alan yazabilirdi; panelde görünmeyen bir metin
	  sessizce değişir ve nereden geldiği bulunamazdı. İzin listesi dosyanın
	  kendisinden üretiliyor: var olmayan bir anahtar da reddediliyor.
	*/
	const izinli = (await seoAlanlariniOku()).some(
		(alan) => alan.dil === dil && alan.anahtar === anahtar,
	);
	if (!izinli) throw new Error(`Bu alan panelden düzenlenemiyor: ${anahtar}`);

	const temiz = deger.trim();
	if (!temiz) throw new Error('Alan boş bırakılamaz.');
	/*
	  Satır sonu reddediliyor: bu metinler `<title>` ve `<meta description>`
	  olarak basılıyor, ikisi de tek satır. Sessizce kırpmak yerine hata vermek,
	  kullanıcının yazdığıyla dosyada duranın ayrışmasını önlüyor.
	*/
	if (/[\r\n]/.test(temiz)) throw new Error('Bu alan tek satır olmalı.');
	if ([...temiz].length > EN_UZUN_DEGER) {
		throw new Error(`Alan en fazla ${EN_UZUN_DEGER} karakter olabilir.`);
	}

	const yol = metinDosyasi(kok, /** @type {Dil} */ (dil));
	const ham = await readFile(yol, 'utf8');
	const gruplar = JSON.parse(ham);
	const [grup, ad] = anahtar.split('.');
	gruplar[grup][ad] = temiz;

	/*
	  SATIR SONU DOSYADAN ÖĞRENİLİYOR, sabit yazılmıyor.

	  Bu dosyalar çalışma kopyasında CRLF ile duruyor (Windows'ta git öyle
	  bırakıyor). LF ile yazılsaydı tek bir başlık düzeltmesi git farkında 245
	  satırın tamamını değişmiş gösterirdi; gerçek değişiklik gürültünün içinde
	  kaybolur, yayın panelindeki "ne değişecek" özeti de anlamsızlaşırdı.
	*/
	const satirSonu = ham.includes('\r\n') ? '\r\n' : '\n';

	/*
	  ÖNCE GEÇİCİ DOSYA, SONRA YENİDEN ADLANDIRMA.

	  Doğrudan üzerine yazmak, yazma yarıda kalırsa dosyayı bozuk bırakıyor —
	  site metinlerinin tamamı tek dosyada olduğu için bedeli bütün site.
	  Geçici adın içinde süreç kimliği var: aynı klasörde ikinci bir sunucu
	  çalışırsa iki yazma aynı geçici adı paylaşmasın (bu projede tam olarak bu
	  çakışma yaşandı, bkz. astro.config.cms.mjs).

	  Biçim: iki boşluk girinti ve sondaki satır sonu — dosyanın hâlihazırdaki
	  biçimi. Yazı editörü (Keystatic) aynı dosyayı aynı biçimde yazıyor.
	*/
	const gecici = `${yol}.${process.pid}.tmp`;
	const metin = JSON.stringify(gruplar, null, 2).split('\n').join(satirSonu) + satirSonu;
	await writeFile(gecici, metin, 'utf8');
	await rename(gecici, yol);

	return { anahtar, dil: /** @type {Dil} */ (dil), deger: temiz };
}

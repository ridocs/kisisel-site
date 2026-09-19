/**
 * BÖLÜM KAYDI — sitenin ve panelin ortak listesi.
 *
 * Her bölümün metinleri bu klasörde kendi dosyasında ve iki dili birden
 * taşıyor: `{ "tr": {...}, "en": {...} }`.
 *
 * Bu dosya o dosyaları tek sözlükte topluyor. İki yer birden okuyor:
 *   - `src/i18n/ceviriler.ts` — siteyi besliyor
 *   - `keystatic.config.ts` — panelde her bölüm için bir düzenleme sayfası
 *     ve alan listesi üretiyor
 *
 * Liste iki yerde ayrı ayrı yazılsaydı biri güncellenip öteki unutulurdu:
 * panelde görünmeyen bir bölüm ya da sitede karşılığı olmayan bir düzenleme
 * sayfası çıkardı.
 *
 * YENİ BÖLÜM EKLEMEK: dosyayı bu klasöre koy, aşağıya bir `import` ve
 * `BOLUMLER` içine bir satır ekle. Panelde kendiliğinden beliriyor; yalnızca
 * `keystatic.config.ts` içindeki menü ağacına hangi başlığın altında
 * duracağını yazmak kalıyor.
 */
import dortyuzdort from './404.json';
import altbilgi from './altbilgi.json';
import anasayfa from './anasayfa.json';
import blog from './blog.json';
import calisma from './calisma.json';
import degisiklik from './degisiklik.json';
import gizlilik from './gizlilik.json';
import hakkimda from './hakkimda.json';
import hero from './hero.json';
import hizmet from './hizmet.json';
import iletisim from './iletisim.json';
import kullandiklarim from './kullandiklarim.json';
import nav from './nav.json';
import projeler from './projeler.json';
import sarmasik from './sarmasik.json';
import site from './site.json';
import tanitim from './tanitim.json';
import yazi from './yazi.json';
import yetkinlik from './yetkinlik.json';

/*
  Dosya adı `404.json`, ama JavaScript'te bir değişken rakamla başlayamıyor;
  içe aktarma adı `dortyuzdort`, sözlükteki anahtarı yine `'404'`.
*/
export const BOLUMLER = {
	'404': dortyuzdort,
	altbilgi,
	anasayfa,
	blog,
	calisma,
	degisiklik,
	gizlilik,
	hakkimda,
	hero,
	hizmet,
	iletisim,
	kullandiklarim,
	nav,
	projeler,
	sarmasik,
	site,
	tanitim,
	yazi,
	yetkinlik,
} as const;

export type BolumAdi = keyof typeof BOLUMLER;

/**
 * Arayüz metinlerinin okuyucusu.
 *
 * METİNLER BURADA DEĞİL: `src/icerik/metinler/` altında, HER BÖLÜM KENDİ
 * DOSYASINDA duruyor (`hero.json`, `iletisim.json`, `gizlilik.json`…) ve yazı
 * panelinden düzenleniyor. Her dosya iki dili birden taşıyor:
 *
 *     { "tr": { "baslik": "…" }, "en": { "baslik": "…" } }
 *
 * Neden bölündü: önceden iki büyük dosya vardı (`metinler-tr.json` ve
 * `metinler-en.json`), panelde 239 alan tek listede akıyordu ve aranan metni
 * bulmak zordu. Bölüm bölüm ayrılınca panelin sol menüsü sitenin kendi
 * yapısına benziyor: ana sayfa bölümleri, sayfalar, site geneli.
 *
 * Neden iki dil aynı dosyada: bir metni düzenlerken öteki dildeki karşılığı
 * da düzenlenmek isteniyor. Ayrı dosyalarda tutulunca biri güncellenip öteki
 * unutuluyordu.
 *
 * Bu dosyada kalanlar metin DEĞİL, yönlendirme mantığı: dil listesi, yol
 * üretimi ve `esleme` sözlüğü. Bunlar panele açılmadı, çünkü yanlış bir değer
 * metni bozmakla kalmaz, sayfayı 404'e düşürür.
 *
 * YENİ BÖLÜM EKLEMEK: `src/icerik/metinler/` altına dosyayı koy, aşağıya bir
 * `import` ve `GRUPLAR` içine bir satır ekle, `keystatic.config.ts` içinde de
 * bir singleton tanımla. Üçü birden yapılmazsa panel ile site ayrı düşer.
 */
import { BOLUMLER } from '../icerik/metinler/_bolumler';

export const diller = ['tr', 'en'] as const;
export type Dil = (typeof diller)[number];

export const varsayilanDil: Dil = 'tr';

/*
  Bölüm listesi `src/icerik/metinler/_bolumler.ts` içinde; panel de aynı
  kaydı okuyor. Anahtar adı metin anahtarının ilk parçası oluyor:
  `hero` + `altBaslik` → `hero.altBaslik`.
*/
const GRUPLAR = BOLUMLER;

/*
  Anahtar birleşimi JSON'un kendi yapısından türetiliyor: `hero` dosyasının
  `tr` bölümündeki `altBaslik` alanı `hero.altBaslik` oluyor. Elle yazılmış
  bir liste olsaydı, dosyaya eklenen bir alan koda yazılmadığı sürece
  görünmezdi; burada eklenir eklenmez derleyici tanıyor, yanlış yazılan
  anahtar ise hata veriyor.
*/
type Gruplar = typeof GRUPLAR;
export type MetinAnahtari = {
	[Grup in keyof Gruplar & string]: `${Grup}.${keyof Gruplar[Grup]['tr'] & string}`;
}[keyof Gruplar & string];

function duzles(dil: Dil): Record<string, string> {
	const duz: Record<string, string> = {};
	for (const [grup, icerik] of Object.entries(GRUPLAR)) {
		for (const [ad, metin] of Object.entries((icerik as Record<Dil, Record<string, string>>)[dil])) {
			duz[`${grup}.${ad}`] = metin;
		}
	}
	return duz;
}

export const ceviriler: Record<Dil, Record<MetinAnahtari, string>> = {
	tr: duzles('tr') as Record<MetinAnahtari, string>,
	en: duzles('en') as Record<MetinAnahtari, string>,
};

/** Yol adından dili çıkarır: /en/... -> "en", diğer her şey -> "tr". */
export function dilBul(url: URL): Dil {
	const [ilkParca] = tabansizParcalar(url);
	return (diller as readonly string[]).includes(ilkParca) ? (ilkParca as Dil) : varsayilanDil;
}

/** Seçili dile göre metin döndüren yardımcı. */
export function cevirici(dil: Dil) {
	return function metin(anahtar: MetinAnahtari): string {
		return ceviriler[dil][anahtar];
	};
}

/**
 * Sitenin yayınlandığı alt dizin ('' ya da ör. '/web-sitem').
 *
 * Astro'nun `base` ayarı yalnızca kendi ürettiği varlık yollarını önekler;
 * elle yazdığımız bağlantıları öneklemez. Bu yüzden bağlantı üreten her yer
 * buradan geçiyor. Sondaki eğik çizgi atılıyor ki birleştirmede çift
 * çizgi oluşmasın.
 */
export const taban = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

/** Yol parçalarını, varsa alt dizin önekini atarak döndürür. */
function tabansizParcalar(url: URL): string[] {
	let yolAdi = url.pathname;
	if (taban && (yolAdi === taban || yolAdi.startsWith(taban + '/'))) {
		yolAdi = yolAdi.slice(taban.length);
	}
	return yolAdi.split('/').filter(Boolean);
}

/**
 * Dile göre yol üretir. Varsayılan dil ön ek almaz: "/blog" ve "/en/blog".
 */
export function yol(dil: Dil, parca = ''): string {
	// Sondaki eğik çizgi bilinçli: derleme dizin tabanlı çıktı üretiyor
	// (/blog/index.html). Çizgisiz bağlantı sunucuda 301 ile çizgili
	// hâline yönlendiriliyordu; her gezinmede fazladan bir gidiş-dönüş.
	const temiz = parca.replace(/^\/+/, '').replace(/\/*$/, '');
	const kuyruk = temiz ? `${temiz}/` : '';
	if (dil === varsayilanDil) return `${taban}/${kuyruk}`;
	return `${taban}/${dil}/${kuyruk}`;
}

/** Aynı sayfanın diğer dildeki karşılığı (dil değiştirici için). */
export function digerDilYolu(url: URL, hedef: Dil): string {
	const parcalar = tabansizParcalar(url);
	if ((diller as readonly string[]).includes(parcalar[0])) parcalar.shift();
	/*
	  Yol adları dile göre değişiyor: hakkımda <-> about.

	  Adı çevrilen HER yeni sayfa buraya iki satır olarak eklenmeli (hem Türkçe
	  hem İngilizce ad, çünkü arama iki yönde de yapılıyor). Eklenmezse dil
	  değiştirici o sayfadayken adı olduğu gibi bırakıyor ve ziyaretçi
	  /en/gizlilik gibi var olmayan bir adrese, yani 404'e düşüyor.

	  BU SÖZLÜK PANELE AÇILMADI: içindekiler metin değil, dosya yolu. Panelden
	  değiştirilebilseydi tek harflik bir hata sayfayı erişilemez yapardı.
	*/
	const esleme: Record<string, Record<Dil, string>> = {
		hakkimda: { tr: 'hakkimda', en: 'about' },
		about: { tr: 'hakkimda', en: 'about' },
		hizmetler: { tr: 'hizmetler', en: 'services' },
		services: { tr: 'hizmetler', en: 'services' },
		kullandiklarim: { tr: 'kullandiklarim', en: 'uses' },
		uses: { tr: 'kullandiklarim', en: 'uses' },
		gizlilik: { tr: 'gizlilik', en: 'privacy' },
		privacy: { tr: 'gizlilik', en: 'privacy' },
		projeler: { tr: 'projeler', en: 'projects' },
		projects: { tr: 'projeler', en: 'projects' },
		// Sürüm günlüğü. İki yönde de yazılı: dil değiştirici hem Türkçe hem
		// İngilizce addan arama yapıyor.
		'neler-degisti': { tr: 'neler-degisti', en: 'whats-changed' },
		'whats-changed': { tr: 'neler-degisti', en: 'whats-changed' },
	};
	if (parcalar[0] && esleme[parcalar[0]]) parcalar[0] = esleme[parcalar[0]][hedef];
	return yol(hedef, parcalar.join('/'));
}

/**
 * Arayüz metinlerinin okuyucusu.
 *
 * METİNLER ARTIK BURADA DEĞİL: `src/icerik/metinler-tr.json` ve
 * `metinler-en.json` içindeler ve yazı panelinden ("Site metinleri")
 * düzenleniyorlar. Sebep: metni değiştirmek için kaynak koda dokunmak
 * gerekiyordu; bir metin düzeltmesi artık derleme bilgisi istemiyor.
 *
 * Bu dosyada kalanlar metin DEĞİL, yönlendirme mantığı: dil listesi, yol
 * üretimi ve `esleme` sözlüğü. Bunlar panele açılmadı, çünkü yanlış bir
 * değer metni bozmakla kalmaz, sayfayı 404'e düşürür.
 *
 * Veri dosyaları gruplanmış duruyor ("site", "nav", "gizlilik"…) ki panelde
 * 209 alan tek listede akmasın. Kod ise eskisi gibi düz anahtarla ("site.baslik")
 * çalışıyor; birleştirme aşağıdaki `duzles` ile bir kez yapılıyor.
 */
import trGruplar from '../icerik/metinler-tr.json';
import enGruplar from '../icerik/metinler-en.json';

export const diller = ['tr', 'en'] as const;
export type Dil = (typeof diller)[number];

export const varsayilanDil: Dil = 'tr';

/*
  Anahtar birleşimi JSON'un kendi yapısından türetiliyor: "site" grubundaki
  "baslik" alanı `site.baslik` oluyor. Elle yazılmış bir liste olsaydı, veri
  dosyasına eklenen bir alan koda yazılmadığı sürece görünmezdi; burada
  eklenir eklenmez derleyici tanıyor, yanlış yazılan anahtar ise hata veriyor.
*/
type Gruplar = typeof trGruplar;
export type MetinAnahtari = {
	[Grup in keyof Gruplar & string]: `${Grup}.${keyof Gruplar[Grup] & string}`;
}[keyof Gruplar & string];

function duzles(gruplar: Record<string, Record<string, string>>): Record<string, string> {
	const duz: Record<string, string> = {};
	for (const [grup, kalemler] of Object.entries(gruplar)) {
		for (const [ad, metin] of Object.entries(kalemler)) {
			duz[`${grup}.${ad}`] = metin;
		}
	}
	return duz;
}

export const ceviriler: Record<Dil, Record<MetinAnahtari, string>> = {
	tr: duzles(trGruplar) as Record<MetinAnahtari, string>,
	en: duzles(enGruplar) as Record<MetinAnahtari, string>,
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
 * Dile göre yol üretir. Varsayılan dil ön ek almaz: "/blog" ve "/en/blog".
 */
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
		// Sürüm günlüğü. İki yönde de yazılı: dil değiştirici hem Türkçe hem
		// İngilizce addan arama yapıyor.
		'neler-degisti': { tr: 'neler-degisti', en: 'whats-changed' },
		'whats-changed': { tr: 'neler-degisti', en: 'whats-changed' },
	};
	if (parcalar[0] && esleme[parcalar[0]]) parcalar[0] = esleme[parcalar[0]][hedef];
	return yol(hedef, parcalar.join('/'));
}

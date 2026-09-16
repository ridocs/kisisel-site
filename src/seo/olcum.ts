import { readdir, readFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { seoAlanlariniOku, type MetinAlani } from './metinler.mjs';

/*
  SEO YÖNETİMİ — ölçüm mantığı

  Bu modül yalnızca panel kipinde çalışıyor; yayın derlemesi onu hiç görmüyor.
  Gerekçesi ve düzeneği: src/seo/eklenti.mjs.

  ÖLÇÜM KAYNAĞI: `dist/` — yani DERLENMİŞ ÇIKTI, kaynak kod değil.

  Kaynaktan çıkarım yapmak burada yanıltıcı olurdu: sayfanın <title>'ı üç
  yerden besleniyor (sayfa dosyası, `metinler-*.json`, BaseLayout'un birleştirme
  mantığı), yazı sayfalarının başlığı ise frontmatter'dan geliyor. Bunları
  yeniden hesaplamak, BaseLayout'un mantığını ikinci kez — ve er geç yanlış —
  yazmak demekti. `dist/` içindeki HTML arama motorunun GERÇEKTE göreceği şey;
  ölçüm oradan yapılırsa panel ile yayın arasında sapma olamaz.

  BEDELİ: rapor son derlemeyi anlatıyor, o andaki kaynağı değil. Panel bunu
  gizlemiyor — derleme anı ekranda yazılı ve kaynak daha yeniyse uyarı çıkıyor.

  KONTROL PANELİYLE SINIR

  `/kontrol` tekil kusurları sıralıyor (çift h1, kırık bağlantı, taslak…).
  Burada soru başka: "sayfalarım arama sonucunda nasıl görünüyor, hangi sayfada
  ne eksik". Bu yüzden çıktı bulgu listesi değil, sayfa sayfa TABLO ve site
  geneli sağlık ölçüleri (site haritası ↔ gerçek sayfa, yetim sayfa, yinelenen
  başlık, paylaşım görseli).
*/

/* ------------------------------------------------------------------ */
/* Ölçüler                                                             */
/* ------------------------------------------------------------------ */

/*
  Arama sonucundaki kırpılma sınırları. Google piksel genişliğine bakıyor,
  karaktere değil; bu yüzden sayılar kesin değil, "buradan sonrası riskli"
  eşikleri. `src/kontrol/denetimler.ts` içindeki eşiklerle aynı tutuldu —
  iki ekran aynı metne farklı sınır uygularsa hangisine inanılacağı
  belirsizleşir. Orada YAZININ frontmatter'ı, burada SAYFANIN basılmış
  <title>'ı ölçülüyor; ikisi farklı metinler (sayfa başlığı site adını da
  taşıyor), bu yüzden bir tekrar değil.
*/
export const BASLIK_UST = 60;
export const ACIKLAMA_ALT = 50;
export const ACIKLAMA_UST = 160;

/** Ölçümün okuduğu klasör; proje köküne göre. */
const CIKTI_KLASORU = 'dist';

/* ------------------------------------------------------------------ */
/* Türler                                                              */
/* ------------------------------------------------------------------ */

export type Dil = 'tr' | 'en';

/** Bir ölçünün sınırı aştığında ekranda nasıl görüneceği. */
export type Durum = 'iyi' | 'dikkat' | 'agir' | 'notr';

export interface UzunlukOlcusu {
	metin: string;
	uzunluk: number;
	durum: Durum;
	/** Sınır aşıldıysa tek cümlelik gerekçe; aşılmadıysa boş. */
	not: string;
}

export interface SayfaOlcumu {
	/** Yayınlanan adres, site öneki olmadan: "/", "/hakkimda", "/en/about". */
	rota: string;
	/** Proje köküne göre dosya yolu: "dist/hakkimda/index.html". */
	dosya: string;
	dil: Dil;
	baslik: UzunlukOlcusu;
	aciklama: UzunlukOlcusu;
	/** og:image adresi; yoksa boş. */
	ogGorsel: string;
	ogGorselVar: boolean;
	canonical: string;
	canonicalDogru: boolean;
	hreflangTr: string;
	hreflangEn: string;
	/** İki dil bağı da var ve ikisi de var olan bir sayfaya gidiyor mu. */
	hreflangTam: boolean;
	hreflangNot: string;
	/** JSON-LD içindeki @type değerleri: ["Person", "WebSite", "BlogPosting"]. */
	jsonLdTurleri: string[];
	h1Sayisi: number;
	/** `noindex` işaretli mi — bu sayfalar site haritasında da beklenmiyor. */
	dizinDisi: boolean;
	haritada: boolean;
	/** Kaç FARKLI sayfadan bu sayfaya bağlantı veriliyor. */
	gelenBaglanti: number;
	/**
	 * Başlığı/açıklamayı üreten `metinler-*.json` anahtarı — bulunabildiyse.
	 * Yazı sayfalarında boş: onların metni frontmatter'dan geliyor ve yazı
	 * editöründen düzenleniyor.
	 */
	baslikAnahtari: string;
	aciklamaAnahtari: string;
}

export interface SiteOlcusu {
	ad: string;
	durum: Durum;
	/** Tek satırlık cevap: rakam ya da kısa hüküm. */
	deger: string;
	/** Neden önemli / ne yapmalı. */
	aciklama: string;
	/** Varsa tek tek adresler. */
	ayrinti: string[];
}

export interface YinelenenKayit {
	deger: string;
	rotalar: string[];
}

export interface SeoRaporu {
	/** `dist/` var mı — yoksa rapor üretilemiyor, kullanıcıya "derleyin" deniyor. */
	ciktiVar: boolean;
	/** Derlemenin ne zaman yapıldığı (dist/index.html'in dosya tarihi). */
	derlemeAni: Date | null;
	/** Kaynak dosyalardan biri derlemeden yeni mi — rapor eskimiş demektir. */
	kaynakDahaYeni: boolean;
	/** Ölçülen adresin kökü: "https://twinshareapp.com" + "/web-sitem". */
	siteKoku: string;
	taban: string;
	sayfalar: SayfaOlcumu[];
	olculer: SiteOlcusu[];
	yinelenenBaslik: YinelenenKayit[];
	yinelenenAciklama: YinelenenKayit[];
	/** Panelden düzenlenebilen metin alanları (iki dil). */
	alanlar: MetinAlani[];
	/** Bu aracın BAKMADIĞI şeyler; "bulgu yok" ile "bakmadım" karışmasın. */
	kapsamDisi: string[];
}

/* ------------------------------------------------------------------ */
/* HTML ayrıştırma — kütüphanesiz                                      */
/* ------------------------------------------------------------------ */

/*
  Ayrıştırma düz metin eşlemesiyle yapılıyor, bir HTML ayrıştırıcısı
  eklenmeden. Sebep: aranan şey `<head>` içindeki birkaç sabit etiket ve bu
  HTML'i biz üretiyoruz — kaynağı belirsiz, bozuk işaretlemeli bir belge
  değil. Bir ayrıştırıcı paketi, tek bir panel ekranı için projeye kalıcı
  bağımlılık olurdu.
*/

/** Bir etiketin niteliklerini küçük harfli adlarla döndürür. */
function nitelikler(etiket: string): Record<string, string> {
	const harita: Record<string, string> = {};
	const kalip = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
	for (const esles of etiket.matchAll(kalip)) {
		harita[esles[1].toLowerCase()] = varligiCoz(esles[2] ?? esles[3] ?? esles[4] ?? '');
	}
	return harita;
}

/*
  HTML varlıkları çözülüyor: derleyici `&#39;` gibi kaçışlar basabiliyor ve
  çözülmezse başlık uzunluğu olduğundan uzun ölçülürdü — yani panel var
  olmayan bir kusuru bildirirdi. `&amp;` en sonda: önce çözülürse
  `&amp;lt;` gibi bir metin iki kez çözülüp yanlış sonuç verir.
*/
function varligiCoz(metin: string): string {
	return metin
		.replace(/&#(\d+);/g, (_, sayi) => String.fromCodePoint(Number(sayi)))
		.replace(/&#x([0-9a-fA-F]+);/g, (_, sayi) => String.fromCodePoint(parseInt(sayi, 16)))
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&nbsp;/g, '\u00a0')
		.replace(/&amp;/g, '&');
}

/** Belgedeki bütün `<meta>` / `<link>` etiketlerinin nitelik haritaları. */
function etiketler(html: string, ad: 'meta' | 'link'): Record<string, string>[] {
	const kalip = new RegExp(`<${ad}\\b[^>]*>`, 'gi');
	return [...html.matchAll(kalip)].map((e) => nitelikler(e[0]));
}

function metaDegeri(html: string, tur: 'name' | 'property', ad: string): string {
	for (const nit of etiketler(html, 'meta')) {
		if (nit[tur] === ad) return nit.content ?? '';
	}
	return '';
}

function linkAdresi(html: string, rel: string, hreflang?: string): string {
	for (const nit of etiketler(html, 'link')) {
		if (nit.rel !== rel) continue;
		if (hreflang !== undefined && nit.hreflang !== hreflang) continue;
		return nit.href ?? '';
	}
	return '';
}

/**
 * Sayfadaki `<a href>` adresleri.
 *
 * Yalnızca `<a>` etiketleri taranıyor. Bütün `href`'ler alınsaydı `canonical`
 * ve `hreflang` bağları da "iç bağlantı" sayılırdı — her sayfa kendine bağlantı
 * veriyor görünür ve YETİM SAYFA ölçümü hiçbir zaman bir şey bulamazdı.
 */
function bagAdresleri(html: string): string[] {
	return [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map((e) =>
		varligiCoz(e[1] ?? e[2] ?? ''),
	);
}

/* ------------------------------------------------------------------ */
/* Yol / adres yardımcıları                                            */
/* ------------------------------------------------------------------ */

/** "/hakkimda/" → "/hakkimda" · "/" → "/" */
function rotaDuzle(adres: string): string {
	const temiz = adres.replace(/\/+$/, '');
	return temiz || '/';
}

/** Klasördeki bütün dosyaları, verilen klasöre göreli olarak döndürür. */
async function dosyalariTopla(kok: string, klasor = ''): Promise<string[]> {
	const tam = klasor ? join(kok, klasor) : kok;
	const bulunan: string[] = [];
	let girisler;
	try {
		girisler = await readdir(tam, { withFileTypes: true });
	} catch {
		return [];
	}
	for (const giris of girisler) {
		const gorel = klasor ? `${klasor}/${giris.name}` : giris.name;
		if (giris.isDirectory()) bulunan.push(...(await dosyalariTopla(kok, gorel)));
		else bulunan.push(gorel);
	}
	return bulunan;
}

/**
 * Çıktı dosyasının karşılık geldiği adres.
 * "index.html" → "/" · "hakkimda/index.html" → "/hakkimda" · "404.html" → "/404"
 */
function ciktiRotasi(gorel: string): string {
	let ic = gorel.replace(/\.html$/, '');
	if (ic === 'index') return '/';
	if (ic.endsWith('/index')) ic = ic.slice(0, -'/index'.length);
	return `/${ic}`;
}

/* ------------------------------------------------------------------ */
/* Ölçüm                                                               */
/* ------------------------------------------------------------------ */

function uzunlukOlc(
	metin: string,
	tur: 'baslik' | 'aciklama',
): UzunlukOlcusu {
	// Kod NOKTASI sayılıyor, UTF-16 birimi değil: bir emoji ya da birleşik
	// karakter `length` ile iki sayılıp başlığı olduğundan uzun gösterirdi.
	const uzunluk = [...metin].length;

	if (!metin.trim()) {
		return {
			metin: '',
			uzunluk: 0,
			durum: 'agir',
			not: tur === 'baslik' ? 'Sayfanın başlığı yok.' : 'Sayfanın açıklaması yok.',
		};
	}

	if (tur === 'baslik') {
		if (uzunluk > BASLIK_UST) {
			return {
				metin,
				uzunluk,
				durum: 'dikkat',
				not: `Arama sonucunda sonu kırpılır (sınır ${BASLIK_UST}).`,
			};
		}
		return { metin, uzunluk, durum: 'iyi', not: '' };
	}

	if (uzunluk > ACIKLAMA_UST) {
		return {
			metin,
			uzunluk,
			durum: 'dikkat',
			not: `Arama sonucunda son cümle kesilir (sınır ${ACIKLAMA_UST}).`,
		};
	}
	if (uzunluk < ACIKLAMA_ALT) {
		return {
			metin,
			uzunluk,
			durum: 'dikkat',
			not: `Ayrılan yerin bir kısmı boş kalır (alt sınır ${ACIKLAMA_ALT}).`,
		};
	}
	return { metin, uzunluk, durum: 'iyi', not: '' };
}

/** JSON-LD bloğundaki `@type` değerleri. */
function jsonLdTurleri(html: string): string[] {
	const esles = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i.exec(
		html,
	);
	if (!esles) return [];
	try {
		const veri = JSON.parse(esles[1]);
		const dugumler = Array.isArray(veri['@graph']) ? veri['@graph'] : [veri];
		return dugumler.map((d: Record<string, string>) => d['@type']).filter(Boolean);
	} catch {
		// Bozuk JSON-LD'yi "tür yok" diye göstermek, çökmekten iyi: tabloda boş
		// hücre görünür ve kullanıcı sayfaya bakar.
		return [];
	}
}

/**
 * Sitenin kökünü (alan adı + alt dizin) ölçülen çıktıdan okur.
 *
 * Sabit yazılmıyor: `astro.config.mjs` içindeki `site`/`base` değiştiğinde bu
 * modülün de değişmesi gerekirdi ve unutulursa panel bütün canonical'ları
 * "yanlış" diye işaretlerdi. Kaynak olarak SİTE HARİTASI seçildi, canonical
 * değil — canonical burada DENETLENEN şey; onu ölçünün kendisinden türetmek,
 * her canonical'ı tanımı gereği doğru göstermek olurdu.
 */
async function siteKokunuBul(ciktiKoku: string): Promise<{ koku: string; taban: string }> {
	try {
		const xml = await readFile(join(ciktiKoku, 'sitemap-index.xml'), 'utf8');
		const esles = /<loc>([^<]+)<\/loc>/.exec(xml);
		if (esles) {
			const adres = new URL(esles[1]);
			// ".../web-sitem/sitemap-0.xml" → taban "/web-sitem"
			const taban = rotaDuzle(adres.pathname.replace(/\/[^/]*$/, ''));
			return { koku: adres.origin, taban: taban === '/' ? '' : taban };
		}
	} catch {
		// Aşağıdaki yedek kaynağa düşülüyor.
	}

	/*
	  YEDEK: ana sayfanın canonical'ı.

	  Site haritası yokken kök bilinemezse her adres "site dışı" sayılır ve
	  panel bütün canonical'ları, dil bağlarını, görselleri yanlış diye
	  işaretlerdi — tek bir eksik dosya yüzünden 21 satırlık sahte kusur.
	  Bunun bedeli, canonical denetiminin o durumda kendi kendini ölçüyor
	  olması: kök yanlışsa denetim de yanılır. Tercih bilinçli, çünkü site
	  haritası yokluğu zaten ayrı ve görünür bir ölçü olarak bildiriliyor.
	*/
	try {
		const html = await readFile(join(ciktiKoku, 'index.html'), 'utf8');
		const canonical = linkAdresi(html, 'canonical');
		if (canonical) {
			const adres = new URL(canonical);
			const taban = rotaDuzle(adres.pathname);
			return { koku: adres.origin, taban: taban === '/' ? '' : taban };
		}
	} catch {
		// Ana sayfa da okunamıyorsa ölçülecek bir çıktı zaten yok.
	}

	return { koku: '', taban: '' };
}

/** Mutlak adresi site kökünden arındırıp rotaya çevirir; dışarısı için boş döner. */
function adresiRotayaCevir(adres: string, koku: string, taban: string): string {
	let yol = adres;
	if (/^https?:\/\//i.test(adres)) {
		if (koku && !adres.startsWith(koku)) return '';
		yol = adres.slice(koku.length);
	}
	if (!yol.startsWith('/')) return '';
	yol = yol.split('#')[0].split('?')[0];
	if (taban) {
		if (yol !== taban && !yol.startsWith(taban + '/')) return '';
		yol = yol.slice(taban.length) || '/';
	}
	return rotaDuzle(yol);
}

/* ------------------------------------------------------------------ */
/* Rapor                                                               */
/* ------------------------------------------------------------------ */

export async function seoRaporu(): Promise<SeoRaporu> {
	const kok = process.cwd();
	const ciktiKoku = join(kok, CIKTI_KLASORU);
	const alanlar = await seoAlanlariniOku();

	const tumDosyalar = await dosyalariTopla(ciktiKoku);
	const dosyalar = tumDosyalar.filter((d) => d.endsWith('.html'));

	const bos: SeoRaporu = {
		ciktiVar: false,
		derlemeAni: null,
		kaynakDahaYeni: false,
		siteKoku: '',
		taban: '',
		sayfalar: [],
		olculer: [],
		yinelenenBaslik: [],
		yinelenenAciklama: [],
		alanlar,
		kapsamDisi: [],
	};
	if (dosyalar.length === 0) return bos;

	const { koku, taban } = await siteKokunuBul(ciktiKoku);

	/* ---------- Sayfalar ---------- */

	const hamSayfalar: { rota: string; dosya: string; html: string }[] = [];
	for (const gorel of dosyalar.sort()) {
		hamSayfalar.push({
			rota: ciktiRotasi(gorel),
			dosya: `${CIKTI_KLASORU}/${gorel}`,
			html: await readFile(join(ciktiKoku, gorel), 'utf8'),
		});
	}
	const varOlanRotalar = new Set(hamSayfalar.map((s) => s.rota));

	/* ---------- Site haritası ---------- */

	const haritaRotalari = new Set<string>();
	let haritaAdresSayisi = 0;
	let haritaVar = false;
	for (const gorel of tumDosyalar) {
		if (!/^sitemap-\d+\.xml$/.test(gorel)) continue;
		haritaVar = true;
		const xml = await readFile(join(ciktiKoku, gorel), 'utf8');
		for (const esles of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
			haritaAdresSayisi++;
			const rota = adresiRotayaCevir(esles[1], koku, taban);
			if (rota) haritaRotalari.add(rota);
		}
	}

	/* ---------- İç bağlantı sayacı ---------- */

	/*
	  Hangi sayfaya KAÇ FARKLI sayfadan bağlantı veriliyor.

	  Sayfanın kendine verdiği bağlantı sayılmıyor: üst şeritteki "Blog"
	  bağlantısı blog sayfasının kendisinde de duruyor ve sayılsaydı her sayfa
	  en az bir bağlantı almış görünür, yetim sayfa hiç bulunamazdı.
	*/
	const gelen = new Map<string, Set<string>>();
	for (const sayfa of hamSayfalar) {
		for (const ham of bagAdresleri(sayfa.html)) {
			const hedef = adresiRotayaCevir(ham, koku, taban);
			if (!hedef || hedef === sayfa.rota) continue;
			if (!varOlanRotalar.has(hedef)) continue;
			const kume = gelen.get(hedef) ?? new Set<string>();
			kume.add(sayfa.rota);
			gelen.set(hedef, kume);
		}
	}

	/* ---------- Sayfa satırları ---------- */

	/*
	  Metin anahtarı DEĞERE BAKILARAK bulunuyor, rota listesi elle yazılmıyor.
	  Elle yazılmış bir eşleme ("/hakkimda → hakkimda.sayfaBasligi") yeni sayfa
	  eklendiğinde sessizce eksik kalırdı; değerden gitmek yeni sayfayı da
	  kendiliğinden tanıyor. Bulunamayan satır boş kalıyor — yazı sayfalarının
	  başlığı frontmatter'dan geliyor ve zaten buradan düzenlenmiyor.
	*/
	const anahtarDegeri = new Map<string, string>();
	for (const alan of alanlar) {
		// İlk yazan kazanıyor: aynı metin iki anahtarda duruyorsa tabloda
		// hangisinin gösterildiği belirsiz olurdu; sıralı ve tekrarlanabilir
		// olsun diye ilki tutuluyor.
		const anahtar = `${alan.dil}\u0000${alan.deger.trim()}`;
		if (!anahtarDegeri.has(anahtar)) anahtarDegeri.set(anahtar, alan.anahtar);
	}

	const sayfalar: SayfaOlcumu[] = hamSayfalar.map((sayfa) => {
		const html = sayfa.html;
		const dil: Dil = sayfa.rota === '/en' || sayfa.rota.startsWith('/en/') ? 'en' : 'tr';

		const baslikEsles = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
		const baslikMetni = varligiCoz(baslikEsles ? baslikEsles[1].trim() : '');
		const aciklamaMetni = metaDegeri(html, 'name', 'description');

		const canonical = linkAdresi(html, 'canonical');
		const canonicalRotasi = adresiRotayaCevir(canonical, koku, taban);

		const trBag = linkAdresi(html, 'alternate', 'tr');
		const enBag = linkAdresi(html, 'alternate', 'en');
		const trRota = adresiRotayaCevir(trBag, koku, taban);
		const enRota = adresiRotayaCevir(enBag, koku, taban);

		let hreflangNot = '';
		if (!trBag || !enBag) hreflangNot = 'Bir dil bağı eksik.';
		else if (!varOlanRotalar.has(trRota) || !varOlanRotalar.has(enRota)) {
			hreflangNot = 'Dil bağı var olmayan bir sayfayı gösteriyor.';
		}

		const ogGorsel = metaDegeri(html, 'property', 'og:image');
		const ogRota = adresiRotayaCevir(ogGorsel, koku, taban);
		const ogDosyaYolu = ogRota && ogRota !== '/' ? join(ciktiKoku, ogRota) : '';
		let ogGorselVar = false;
		if (ogDosyaYolu) {
			try {
				ogGorselVar = statSync(ogDosyaYolu).size > 0;
			} catch {
				ogGorselVar = false;
			}
		}

		const dizinDisi = /noindex/i.test(metaDegeri(html, 'name', 'robots'));

		return {
			rota: sayfa.rota,
			dosya: sayfa.dosya,
			dil,
			baslik: uzunlukOlc(baslikMetni, 'baslik'),
			aciklama: uzunlukOlc(aciklamaMetni, 'aciklama'),
			ogGorsel,
			ogGorselVar,
			canonical,
			canonicalDogru: canonicalRotasi === sayfa.rota,
			hreflangTr: trBag,
			hreflangEn: enBag,
			hreflangTam: hreflangNot === '',
			hreflangNot,
			jsonLdTurleri: jsonLdTurleri(html),
			h1Sayisi: (html.match(/<h1[\s>]/gi) ?? []).length,
			dizinDisi,
			haritada: haritaRotalari.has(sayfa.rota),
			gelenBaglanti: gelen.get(sayfa.rota)?.size ?? 0,
			baslikAnahtari: anahtarDegeri.get(`${dil}\u0000${baslikMetni.trim()}`) ?? '',
			aciklamaAnahtari: anahtarDegeri.get(`${dil}\u0000${aciklamaMetni.trim()}`) ?? '',
		};
	});

	/* ---------- Yinelenen başlık / açıklama ---------- */

	/*
	  Karşılaştırma DİLDEN BAĞIMSIZ, çünkü burada ölçülen şey basılmış sayfa:
	  iki farklı adres aynı <title> ile çıkıyorsa arama motoru birini seçip
	  ötekini gizler — ikisi ayrı dilde olsa bile. (`/kontrol` aynı soruyu
	  YAZILARIN frontmatter'ında ve dil içinde soruyor; orada iki çevirinin
	  aynı başlığı taşıması kusur değil.)
	*/
	function yinelenenleriBul(sec: (s: SayfaOlcumu) => string): YinelenenKayit[] {
		const kovalar = new Map<string, string[]>();
		for (const sayfa of sayfalar) {
			const deger = sec(sayfa).trim();
			if (!deger) continue;
			const kova = kovalar.get(deger) ?? [];
			kova.push(sayfa.rota);
			kovalar.set(deger, kova);
		}
		return [...kovalar.entries()]
			.filter(([, rotalar]) => rotalar.length > 1)
			.map(([deger, rotalar]) => ({ deger, rotalar }));
	}

	const yinelenenBaslik = yinelenenleriBul((s) => s.baslik.metin);
	const yinelenenAciklama = yinelenenleriBul((s) => s.aciklama.metin);

	/* ---------- Site geneli ölçüler ---------- */

	const olculer: SiteOlcusu[] = [];

	// 1) Site haritası ↔ gerçek sayfa
	// `noindex` sayfalar haritada BEKLENMİYOR: ikisi de dizine girmemeli, biri
	// haritada dururken öteki "girme" demek çelişki olurdu.
	const haritadaEksik = sayfalar
		.filter((s) => !s.haritada && !s.dizinDisi)
		.map((s) => s.rota);
	const haritadaFazla = [...haritaRotalari].filter((r) => !varOlanRotalar.has(r));
	const dizinlenebilir = sayfalar.filter((s) => !s.dizinDisi).length;

	olculer.push({
		ad: 'Site haritası',
		durum: !haritaVar
			? 'agir'
			: haritadaEksik.length + haritadaFazla.length > 0
				? 'dikkat'
				: 'iyi',
		deger: haritaVar
			? `${haritaAdresSayisi} adres · ${dizinlenebilir} dizinlenebilir sayfa`
			: 'Site haritası yok',
		aciklama: !haritaVar
			? 'Çıktıda `sitemap-*.xml` yok. Arama motoru sayfaları yalnızca bağlantıları izleyerek bulmak zorunda kalıyor.'
			: haritadaEksik.length + haritadaFazla.length > 0
				? 'Haritadaki adreslerle gerçek sayfalar tutmuyor. Haritada olmayan bir sayfa geç bulunuyor; haritada olup var olmayan bir adres ise arama motoruna 404 gösteriyor.'
				: 'Haritadaki her adresin bir sayfası, dizinlenebilir her sayfanın da haritada bir satırı var. Dizin dışı bırakılan iki hata sayfası haritada beklenmiyor.',
		ayrinti: [
			...haritadaEksik.map((r) => `${r} — sayfa var, haritada yok`),
			...haritadaFazla.map((r) => `${r} — haritada var, sayfa yok`),
		],
	});

	// 2) robots.txt
	let robotsMetni = '';
	try {
		robotsMetni = await readFile(join(ciktiKoku, 'robots.txt'), 'utf8');
	} catch {
		robotsMetni = '';
	}
	const robotsHarita = /^\s*Sitemap:\s*(\S+)/im.exec(robotsMetni);
	const robotsEngel = /^\s*Disallow:\s*\/\s*$/im.test(robotsMetni);
	/*
	  ALT DİZİN TUZAĞI: robots.txt yalnızca alan adının KÖKÜNDEN okunuyor. Site
	  "/web-sitem" altında yayınlandığı için dosya ".../web-sitem/robots.txt"
	  adresine düşüyor ve hiçbir arama motoru oraya bakmıyor. Bu, kaynakta da
	  yazılı bilinen bir sınır (src/pages/robots.txt.ts) — panel onu gizlemek
	  yerine ölçüp söylüyor, çünkü "robots.txt doğru" demek burada yanıltıcı olur.
	*/
	olculer.push({
		ad: 'robots.txt',
		durum: !robotsMetni ? 'agir' : robotsEngel ? 'agir' : taban ? 'dikkat' : 'iyi',
		deger: !robotsMetni
			? 'Yok'
			: robotsEngel
				? 'Bütün siteyi kapatıyor'
				: robotsHarita
					? 'Var · site haritasını gösteriyor'
					: 'Var · site haritasını göstermiyor',
		aciklama: !robotsMetni
			? 'Çıktıda robots.txt yok.'
			: robotsEngel
				? '`Disallow: /` bütün siteyi arama motorlarına kapatıyor.'
				: taban
					? `Dosya doğru yazılmış ama yanlış yere düşüyor: robots.txt yalnızca alan adının kökünden okunur, bu site ise "${taban}" altında yayınlanıyor. Dosya "${taban}/robots.txt" adresine gidiyor ve okunmuyor. Site köke taşınana kadar sunucu tarafında bir yönlendirme gerekiyor.`
					: 'Dosya kökte ve site haritasını gösteriyor.',
		ayrinti: robotsMetni
			? robotsMetni.split('\n').filter((s) => s.trim()).map((s) => s.trim())
			: [],
	});

	// 3) Yetim sayfalar
	/*
	  Yetim = hiçbir BAŞKA sayfadan bağlantı almayan sayfa. Site haritasında
	  olsa bile arama motoru böyle bir sayfayı değersiz sayıyor; ziyaretçi de
	  gezinerek oraya hiç ulaşamıyor. Hata sayfaları dışarıda: onlara bağlantı
	  verilmemesi doğru.
	*/
	const yetimler = sayfalar
		.filter((s) => !s.dizinDisi && s.gelenBaglanti === 0)
		.map((s) => s.rota);
	olculer.push({
		ad: 'Yetim sayfalar',
		durum: yetimler.length === 0 ? 'iyi' : 'dikkat',
		deger: yetimler.length === 0 ? 'Yok' : `${yetimler.length} sayfa`,
		aciklama:
			yetimler.length === 0
				? 'Her sayfaya en az bir başka sayfadan bağlantı veriliyor.'
				: 'Bu sayfalara hiçbir sayfadan bağlantı verilmemiş. Ziyaretçi gezinerek ulaşamıyor, arama motoru da yalnızca site haritasından bulabiliyor.',
		ayrinti: yetimler,
	});

	// 4) Paylaşım görseli
	const ogsuz = sayfalar.filter((s) => !s.ogGorsel).map((s) => s.rota);
	const ogKirik = sayfalar.filter((s) => s.ogGorsel && !s.ogGorselVar);
	const ogAdresleri = new Set(sayfalar.map((s) => s.ogGorsel).filter(Boolean));
	olculer.push({
		ad: 'Paylaşım görseli',
		durum: ogsuz.length || ogKirik.length ? 'agir' : 'iyi',
		deger: ogsuz.length
			? `${ogsuz.length} sayfada yok`
			: ogKirik.length
				? 'Dosya bulunamadı'
				: `${ogAdresleri.size} görsel · hepsi çıktıda var`,
		aciklama:
			ogsuz.length || ogKirik.length
				? 'Paylaşım görseli olmayan bağlantı sosyal ağlarda düz metin olarak çıkıyor ve tıklanma oranı düşüyor.'
				: 'Her sayfa bir `og:image` bildiriyor ve bildirilen dosya derlenmiş çıktıda gerçekten duruyor.',
		ayrinti: [
			...ogsuz.map((r) => `${r} — og:image yok`),
			...ogKirik.map((s) => `${s.rota} — dosya yok: ${s.ogGorsel}`),
		],
	});

	// 5) Canonical
	const canonicalsiz = sayfalar.filter((s) => !s.canonical).map((s) => s.rota);
	const canonicalYanlis = sayfalar
		.filter((s) => s.canonical && !s.canonicalDogru)
		.map((s) => `${s.rota} → ${s.canonical}`);
	olculer.push({
		ad: 'Canonical',
		durum: canonicalsiz.length || canonicalYanlis.length ? 'agir' : 'iyi',
		deger:
			canonicalsiz.length || canonicalYanlis.length
				? `${canonicalsiz.length + canonicalYanlis.length} sayfada sorun`
				: `${sayfalar.length} sayfanın hepsi kendini gösteriyor`,
		aciklama:
			canonicalsiz.length || canonicalYanlis.length
				? 'Canonical sayfanın kendi adresini göstermeli. Yanlış adres gösteren sayfa arama sonucundan tamamen düşebiliyor.'
				: 'Her sayfanın canonical adresi kendi adresi.',
		ayrinti: [...canonicalsiz.map((r) => `${r} — canonical yok`), ...canonicalYanlis],
	});

	// 6) Dil bağları
	const hreflangEksik = sayfalar.filter((s) => !s.hreflangTam);
	olculer.push({
		ad: 'Dil bağları',
		durum: hreflangEksik.length ? 'dikkat' : 'iyi',
		deger: hreflangEksik.length
			? `${hreflangEksik.length} sayfada eksik`
			: 'Her sayfada tr + en çifti tam',
		aciklama: hreflangEksik.length
			? '`hreflang` çifti eksik olan sayfada arama motoru iki dili aynı sayfanın karşılığı sayamıyor; ikisi birbirinin kopyası gibi değerlendirilebiliyor.'
			: 'Her sayfa hem Türkçe hem İngilizce karşılığını bildiriyor ve iki adres de var olan bir sayfayı gösteriyor.',
		ayrinti: hreflangEksik.map((s) => `${s.rota} — ${s.hreflangNot}`),
	});

	/* ---------- Derleme tazeliği ---------- */

	let derlemeAni: Date | null = null;
	try {
		derlemeAni = statSync(join(ciktiKoku, 'index.html')).mtime;
	} catch {
		derlemeAni = null;
	}

	/*
	  Rapor DERLENMİŞ çıktıyı anlatıyor. Kaynak o çıktıdan yeniyse ekranda ne
	  yazdığıyla sitede ne olduğu ayrışmış demektir — bunu söylemeyen bir panel,
	  düzeltilmiş bir kusuru hâlâ kusur diye gösterir ve kullanıcı aynı şeyi
	  ikinci kez "düzeltmeye" çalışır. Yalnızca SEO'ya giren kaynaklar
	  karşılaştırılıyor: metin dosyaları ve yazılar.
	*/
	let kaynakDahaYeni = false;
	if (derlemeAni) {
		const izlenen = [
			join(kok, 'src', 'icerik', 'metinler-tr.json'),
			join(kok, 'src', 'icerik', 'metinler-en.json'),
			join(kok, 'src', 'layouts', 'BaseLayout.astro'),
		];
		for (const yol of izlenen) {
			try {
				if (statSync(yol).mtime > derlemeAni) kaynakDahaYeni = true;
			} catch {
				// Dosya yoksa karşılaştıracak bir şey de yok.
			}
		}
	}

	return {
		ciktiVar: true,
		derlemeAni,
		kaynakDahaYeni,
		siteKoku: koku,
		taban,
		sayfalar,
		olculer,
		yinelenenBaslik,
		yinelenenAciklama,
		alanlar,
		kapsamDisi: [
			'Ölçüm son derlemeye bakıyor; kaynakta yapılan ama derlenmemiş değişiklik burada görünmez.',
			'Sıralama, tıklanma ve arama hacmi ölçülmüyor: bunlar için arama motorunun kendi verisi gerekiyor.',
			'Dış bağlantıların açılıp açılmadığı denetlenmiyor; yalnızca site içi adresler ölçülüyor.',
			'Metnin kendisi (anahtar kelime, anlatım, olgu doğruluğu) değerlendirilmiyor — ölçülebilen yalnızca biçim.',
			'Tekil içerik kusurları (çift h1, kırık bağlantı, taslak, eksik alt metni) bu ekranda değil, Yayın öncesi kontrol ekranında.',
		],
	};
}

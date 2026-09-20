import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getCollection } from 'astro:content';
import { digerDilYolu, taban, type Dil } from '../i18n/ceviriler';

/*
  YAYIN ÖNCESİ KONTROL — denetim mantığı

  Bu modül yalnızca panel kipinde (`npm run yazi`) çalışıyor; yayın derlemesi
  onu hiç görmüyor. Sebebi ve düzeneği: src/kontrol/eklenti.mjs.

  TASARIM KARARI — "emin değilsen hata deme".

  Bu aracın tek sermayesi güven. Bir kez yanlış alarm verdiğinde kullanıcı
  listeyi okumayı bırakıyor ve o andan sonra gerçek bir kusur da görünmez
  oluyor. Bu yüzden her denetimin çıktısı üç kovadan birine giriyor:

    engel        — ölçülebilir, tartışmasız kusur (kırık bağlantı, iki <h1>)
    iyilestirme  — doğru ama daha iyi olabilir (uzun başlık, etiketsiz yazı)
    gozdenGecir  — insanın bakması gereken, aracın karar VEREMEDİĞİ şey

  Kararsız kalan her şey üçüncü kovaya gidiyor; "engel" kovası yalnızca
  kanıtlanabilir olanı taşıyor.
*/

export type Onem = 'engel' | 'iyilestirme' | 'gozdenGecir';

export interface Bulgu {
	onem: Onem;
	/** Hangi denetim buldu; aynı denetimin bulguları ekranda gruplanıyor. */
	denetim: string;
	/** Proje köküne göre dosya yolu. Bulgu bir dosyaya bağlı değilse boş. */
	dosya: string;
	/** Varsa DOSYADAKİ satır numarası (frontmatter dahil, 1'den başlar). */
	satir?: number;
	/** Ne bulundu. */
	sorun: string;
	/** Neden önemli — bir kusurun bedeli yazılı değilse kimse düzeltmiyor. */
	neden: string;
	/** Nasıl düzeltilir. */
	cozum: string;
}

export interface Rapor {
	bulgular: Bulgu[];
	yaziSayisi: number;
	sayfaSayisi: number;
	/**
	 * Aracın kendi körlükleri. Denetlenemeyen bir şey varsa burada yazıyor:
	 * "hiç bulgu yok" ile "bakamadım" karıştırılmamalı.
	 */
	kapsamDisi: string[];
}

/* ------------------------------------------------------------------ */
/* Ölçüler                                                             */
/* ------------------------------------------------------------------ */

/*
  Arama sonucundaki kırpılma sınırları. Google piksel genişliğine bakıyor,
  karaktere değil; bu yüzden sayılar KESİN değil, "buradan sonrası riskli"
  eşikleri. Bu yüzden aşan bulgular "engel" değil "iyileştirme" sayılıyor.
*/
const BASLIK_UST = 60;
const ACIKLAMA_ALT = 50;
const ACIKLAMA_UST = 160;

/** Yazıların bulunduğu klasör. */
const YAZI_KLASORU = join('src', 'content', 'blog');
const SAYFA_KLASORU = join('src', 'pages');
const BILESEN_KLASORLERI = [join('src', 'components'), join('src', 'layouts')];

/** Astro'nun sayfa sayacağı uzantılar. `.ts`/`.js` uç noktaları sayfa değil. */
const SAYFA_UZANTILARI = ['.astro', '.md', '.mdx'];

/* ------------------------------------------------------------------ */
/* Dosya gezintisi                                                     */
/* ------------------------------------------------------------------ */

/** Bir klasörün altındaki bütün dosyaları, proje köküne göreli döndürür. */
async function dosyalariTopla(kok: string, klasor: string): Promise<string[]> {
	const tam = join(kok, klasor);
	if (!existsSync(tam)) return [];

	const bulunan: string[] = [];
	const girisler = await readdir(tam, { withFileTypes: true });
	for (const giris of girisler) {
		const gorel = join(klasor, giris.name);
		if (giris.isDirectory()) {
			bulunan.push(...(await dosyalariTopla(kok, gorel)));
		} else {
			bulunan.push(gorel);
		}
	}
	return bulunan;
}

/** Yolu her yerde aynı yazalım: Windows'un ters çizgisi rapora sızmasın. */
function duz(yolAdi: string): string {
	return yolAdi.split('\\').join('/');
}

/* ------------------------------------------------------------------ */
/* Gövde ayrıştırma                                                    */
/* ------------------------------------------------------------------ */

interface Satir {
	no: number;
	metin: string;
}

/*
  Kod bloklarının DIŞINDAKİ satırlar.

  Bu ayıklama olmadan araç güvenilmez oluyordu: bir kabuk örneğindeki
  `# yorum` satırı "gövdede <h1> var" diye, bir kod örneğindeki
  `](/web-sitem/...)` de "kırık bağlantı" diye raporlanıyordu. İkisi de
  yanlış alarm — ve yanlış alarm bu aracın en pahalı hatası.

  Frontmatter gövdeye dahil değil: `getCollection` onu zaten ayırıyor. Burada
  sayılan satır numaraları bu yüzden gövdenin başından sayılıyor; rapora
  yazılmadan önce `govdeSatirOfseti` ile DOSYA satırına çevriliyorlar.
  Çevrilmeseydi kullanıcı editörde yanlış satıra bakardı.
*/
function koddisiSatirlar(govde: string): Satir[] {
	const satirlar = govde.split('\n');
	const disarida: Satir[] = [];
	let cit: string | null = null;

	for (let i = 0; i < satirlar.length; i++) {
		const metin = satirlar[i];
		const citBasi = /^\s{0,3}(`{3,}|~{3,})/.exec(metin);

		if (cit) {
			// Açık blok yalnızca aynı türden ve en az o uzunlukta bir çitle kapanır.
			if (citBasi && citBasi[1][0] === cit[0] && citBasi[1].length >= cit.length) {
				cit = null;
			}
			continue;
		}
		if (citBasi) {
			cit = citBasi[1];
			continue;
		}
		disarida.push({ no: i + 1, metin });
	}
	return disarida;
}

/** Satır içi kod parçalarını siler; `` `/web-sitem/x` `` bir bağlantı değil. */
function satirIciKodsuz(metin: string): string {
	return metin.replace(/`[^`]*`/g, '');
}

/*
  Gövdenin ilk satırı dosyanın kaçıncı satırı?

  `getCollection` gövdeyi frontmatter'dan ayırıp baştaki boş satırları da
  kırpıyor, yani gövde satır numaraları dosya satır numaralarıyla tutmuyor.
  Kullanıcı bu raporu okuyup editörde o satıra gidecek; yanlış satır vermek
  aracı işe yaramaz kılar.

  Ofset SAYARAK değil ARAYARAK bulunuyor: gövdenin ilk dolu satırı ham metinde
  birebir aranıyor. Arama frontmatter'ın kapanışından sonra başlıyor, yoksa
  açıklama alanındaki bir cümleyle gövdenin ilk cümlesi aynıysa yanlış yere
  düşerdi — `dart-dili.mdx` tam olarak böyle bir dosya.
*/
function govdeSatirOfseti(ham: string, govde: string): number {
	const hamSatirlar = ham.split('\n');
	const govdeSatirlar = govde.split('\n');

	let ilkDolu = 0;
	while (ilkDolu < govdeSatirlar.length && !govdeSatirlar[ilkDolu].trim()) ilkDolu++;
	if (ilkDolu >= govdeSatirlar.length) return 0;

	let basla = 0;
	if (hamSatirlar[0]?.trim() === '---') {
		for (let i = 1; i < hamSatirlar.length; i++) {
			if (hamSatirlar[i].trim() === '---') {
				basla = i + 1;
				break;
			}
		}
	}

	const hedef = govdeSatirlar[ilkDolu];
	for (let i = basla; i < hamSatirlar.length; i++) {
		if (hamSatirlar[i] === hedef) return i - ilkDolu;
	}
	// Eşleşme bulunamazsa satır numarası vermemek, yanlış vermekten iyi.
	return 0;
}

/* ------------------------------------------------------------------ */
/* Rotalar                                                             */
/* ------------------------------------------------------------------ */

interface SayfaRotasi {
	/** "/hakkimda", "/en/about", "/" */
	rota: string;
	dosya: string;
	/** Köşeli parantezli dosyalar tek bir adres değil, bir kalıp. */
	devingen: boolean;
}

/**
 * `src/pages` altındaki bir dosyanın karşılık geldiği adres.
 * Sayfa olmayan dosyalar (uç noktalar, kısmi parçalar) için null döner.
 */
function sayfaRotasi(gorel: string): SayfaRotasi | null {
	const yolAdi = duz(gorel);
	const uzanti = SAYFA_UZANTILARI.find((u) => yolAdi.endsWith(u));
	if (!uzanti) return null;

	// Alt çizgiyle başlayan dosya ve klasörleri Astro rota saymıyor.
	if (yolAdi.split('/').some((p) => p.startsWith('_'))) return null;

	let ic = yolAdi.slice(SAYFA_KLASORU.length + 1, -uzanti.length);
	if (ic === 'index') ic = '';
	else if (ic.endsWith('/index')) ic = ic.slice(0, -'/index'.length);

	return {
		rota: ic ? `/${ic}` : '/',
		dosya: yolAdi,
		devingen: ic.includes('['),
	};
}

/** "/en/about/" → "/en/about" · "/" → "/" */
function rotaDuzle(adres: string): string {
	const temiz = adres.replace(/\/+$/, '');
	return temiz || '/';
}

/** Adresten site önekini (varsa) atar. */
function tabansiz(adres: string): string {
	if (taban && (adres === taban || adres.startsWith(taban + '/'))) {
		return adres.slice(taban.length) || '/';
	}
	return adres;
}

/* ------------------------------------------------------------------ */
/* Tarih                                                               */
/* ------------------------------------------------------------------ */

/*
  Tarihler frontmatter'da "2026-09-15" olarak yazılıyor ve Zod onları UTC gece
  yarısına çeviriyor. `new Date()` ile doğrudan karşılaştırmak yanlış olurdu:
  bugün yazılan bir yazı, saat diliminin artısına göre "gelecekte" görünebilir.
  Bu yüzden iki taraf da GÜN düzeyinde, metin olarak karşılaştırılıyor.
*/
function gunMetni(tarih: Date): string {
	return tarih.toISOString().slice(0, 10);
}

function bugunMetni(): string {
	const simdi = new Date();
	const ay = String(simdi.getMonth() + 1).padStart(2, '0');
	const gun = String(simdi.getDate()).padStart(2, '0');
	return `${simdi.getFullYear()}-${ay}-${gun}`;
}

/* ------------------------------------------------------------------ */
/* Denetim                                                             */
/* ------------------------------------------------------------------ */

export async function denetle(): Promise<Rapor> {
	const kok = process.cwd();
	const bulgular: Bulgu[] = [];
	const kapsamDisi: string[] = [];

	/* ---------- Sayfalar ---------- */

	const sayfaDosyalari = await dosyalariTopla(kok, SAYFA_KLASORU);
	const rotalar = sayfaDosyalari
		.map(sayfaRotasi)
		.filter((r): r is SayfaRotasi => r !== null);

	const duraganRotalar = new Set(rotalar.filter((r) => !r.devingen).map((r) => r.rota));
	const devingenOnekler = rotalar
		.filter((r) => r.devingen)
		// "/blog/[...slug]" → "/blog"
		.map((r) => r.rota.slice(0, r.rota.indexOf('/[')))
		.filter(Boolean);

	/* ---------- Yazılar ---------- */

	const yazilar = await getCollection('blog');

	/*
	  Yazının dosya yolu. `entry.filePath` çoğu sürümde dolu geliyor ama
	  garanti değil; klasörü okuyup kimliğe göre eşlemek her durumda çalışıyor
	  ve uzantıyı da (.md / .mdx) doğru veriyor.
	*/
	const yaziDosyalari = await dosyalariTopla(kok, YAZI_KLASORU);
	const yolHaritasi = new Map<string, string>();
	for (const yolAdi of yaziDosyalari) {
		const duzYol = duz(yolAdi);
		const kimlik = duzYol
			.slice(duz(YAZI_KLASORU).length + 1)
			.replace(/\.(md|mdx)$/, '');
		yolHaritasi.set(kimlik, duzYol);
	}

	const yaziYolu = (kimlik: string) =>
		yolHaritasi.get(kimlik) ?? `${duz(YAZI_KLASORU)}/${kimlik}`;

	/*
	  Gövde satırını dosya satırına çeviren ofsetler. Dosyalar burada bir kez
	  okunuyor: üç ayrı denetim gövde satırı bildiriyor, her bulguda dosyayı
	  yeniden açmak aynı dosyayı onlarca kez okumak olurdu.
	*/
	const satirOfseti = new Map<string, number>();
	for (const yazi of yazilar) {
		try {
			const ham = await readFile(join(kok, yaziYolu(yazi.id)), 'utf8');
			satirOfseti.set(yazi.id, govdeSatirOfseti(ham, yazi.body ?? ''));
		} catch {
			// Dosya okunamadıysa ofsetsiz devam: satır numarası kabaca yanlış
			// olur ama denetimin kendisi çalışmaya devam eder.
			satirOfseti.set(yazi.id, 0);
		}
	}
	const dosyaSatiri = (kimlik: string, govdeSatiri: number) =>
		govdeSatiri + (satirOfseti.get(kimlik) ?? 0);

	/** Yayımlanan yazıların adresleri: bağlantı denetimi bunlara bakıyor. */
	const yayindakiYazilar = new Set(
		yazilar
			.filter((y) => !y.data.draft)
			.map((y) => (y.data.dil === 'en' ? `/en/blog/${y.id}` : `/blog/${y.id}`)),
	);

	const bugun = bugunMetni();

	/* ---------- 1) Gövdedeki <h1> ---------- */

	/*
	  Düzen, başlığı frontmatter'dan `<h1>` olarak basıyor. Gövde de `# ` ile
	  başlarsa sayfada iki `<h1>` oluyor. Bu sitede yaşandı.
	*/
	for (const yazi of yazilar) {
		const dosya = yaziYolu(yazi.id);
		for (const satir of koddisiSatirlar(yazi.body ?? '')) {
			if (!/^#\s+\S/.test(satir.metin)) continue;
			bulgular.push({
				onem: 'engel',
				denetim: 'İki <h1>',
				dosya,
				satir: dosyaSatiri(yazi.id, satir.no),
				sorun: `Gövdede birinci düzey başlık var: "${satir.metin.trim().slice(0, 70)}"`,
				neden:
					'Yazı düzeni başlığı zaten frontmatter’daki `title` alanından <h1> olarak basıyor. ' +
					'Gövdedeki `#` ikinci bir <h1> üretiyor; sayfada başlık iki kez görünüyor ve ' +
					'ekran okuyucu ile arama motoru sayfanın konusunu ayırt edemiyor.',
				cozum:
					'Satırı `##` yaparak alt başlığa çevirin; başlığı tekrar ediyorsa satırı tamamen silin. ' +
					'Yazının görünen başlığı frontmatter’dan gelmeye devam eder.',
			});
		}
	}

	/* ---------- 2) Dil eşlemesi ---------- */

	/*
	  Eşleme sözlüğü `src/i18n/ceviriler.ts` içinde ve dışarı açılmıyor.
	  Sözlüğün metnini ayrıştırmak yerine FONKSİYONUN KENDİSİ çağrılıyor:
	  `digerDilYolu` dil değiştirme düğmesinin kullandığı fonksiyon, yani
	  burada ölçülen şey tam olarak ziyaretçinin tıklayınca gideceği adres.
	  Sözlük ayrıştırılsaydı sözlüğün biçimi değiştiğinde denetim sessizce
	  yalan söylemeye başlardı.
	*/
	for (const sayfa of rotalar) {
		if (sayfa.devingen) continue;
		const parcalar = sayfa.rota.split('/').filter(Boolean);
		const dil: Dil = parcalar[0] === 'en' ? 'en' : 'tr';
		const hedef: Dil = dil === 'en' ? 'tr' : 'en';

		const karsilik = rotaDuzle(
			tabansiz(digerDilYolu(new URL(`http://yerel${sayfa.rota}`), hedef)),
		);
		if (duraganRotalar.has(karsilik)) continue;

		bulgular.push({
			onem: 'engel',
			denetim: 'Dil değiştirme 404',
			dosya: sayfa.dosya,
			sorun: `Dil düğmesi bu sayfada "${karsilik}" adresine gidiyor; böyle bir sayfa yok.`,
			neden:
				'Sayfa adları dile göre değişiyor (hakkimda ↔ about). Yeni sayfa ' +
				'`src/i18n/ceviriler.ts` içindeki `esleme` sözlüğüne eklenmezse dil düğmesi adı ' +
				'olduğu gibi bırakıyor ve ziyaretçi 404 sayfasına düşüyor.',
			cozum:
				'Karşılık sayfayı oluşturun ya da `esleme` sözlüğüne iki satır ekleyin (Türkçe ve ' +
				'İngilizce ad, çünkü arama iki yönde de yapılıyor).',
		});
	}

	/* ---------- 3-4) Başlık ve açıklama ölçüsü ---------- */

	for (const yazi of yazilar) {
		const dosya = yaziYolu(yazi.id);
		const baslik = yazi.data.title.trim();
		const aciklama = yazi.data.description.trim();

		if (baslik.length > BASLIK_UST) {
			bulgular.push({
				onem: 'iyilestirme',
				denetim: 'Başlık uzunluğu',
				dosya,
				sorun: `Başlık ${baslik.length} karakter (önerilen üst sınır ${BASLIK_UST}).`,
				neden:
					'Arama sonucunda başlık kırpılıyor ve cümlenin sonu "…" ile kesiliyor. ' +
					'Tıklama kararını veren satır yarım görünüyor.',
				cozum: 'Başlığı kısaltın; ayrıntıyı açıklamaya taşıyın.',
			});
		}

		if (!aciklama) {
			bulgular.push({
				onem: 'iyilestirme',
				denetim: 'Açıklama',
				dosya,
				sorun: 'Açıklama boş.',
				neden:
					'Açıklama hem arama sonucundaki metin hem de paylaşım kartındaki satır. ' +
					'Boş bırakılınca arama motoru gövdeden rastgele bir parça seçiyor.',
				cozum: `Frontmatter'a ${ACIKLAMA_ALT}-${ACIKLAMA_UST} karakterlik bir \`description\` yazın.`,
			});
		} else if (aciklama.length > ACIKLAMA_UST) {
			bulgular.push({
				onem: 'iyilestirme',
				denetim: 'Açıklama',
				dosya,
				sorun: `Açıklama ${aciklama.length} karakter (önerilen üst sınır ${ACIKLAMA_UST}).`,
				neden: 'Arama sonucunda sonu kesiliyor; son cümle ziyaretçiye hiç ulaşmıyor.',
				cozum: 'İlk cümleye asıl vaadi koyup kalanını kısaltın.',
			});
		} else if (aciklama.length < ACIKLAMA_ALT) {
			bulgular.push({
				onem: 'iyilestirme',
				denetim: 'Açıklama',
				dosya,
				sorun: `Açıklama ${aciklama.length} karakter (önerilen alt sınır ${ACIKLAMA_ALT}).`,
				neden:
					'Çok kısa açıklama arama sonucunda yazının ne anlattığını söylemiyor; ' +
					'ayrılan yerin bir kısmı boş kalıyor.',
				cozum: 'Yazının cevapladığı soruyu bir cümleyle ekleyin.',
			});
		}
	}

	/* ---------- 5) Taslak ---------- */

	for (const yazi of yazilar.filter((y) => y.data.draft)) {
		bulgular.push({
			onem: 'gozdenGecir',
			denetim: 'Taslak',
			dosya: yaziYolu(yazi.id),
			sorun: `"${yazi.data.title}" yazısında \`draft: true\` duruyor.`,
			neden:
				'Taslak yazılar listelerde, RSS akışında ve site haritasında görünmüyor. ' +
				'Bilerek böyleyse sorun yok; unutulduysa yazı yayımlanmış sayılmıyor.',
			cozum: 'Yayımlanacaksa `draft: false` yapın ya da satırı silin.',
		});
	}

	/* ---------- 6) Görsel metin karşılığı ---------- */

	for (const yazi of yazilar) {
		const dosya = yaziYolu(yazi.id);

		/*
		  Kapak görseli alt metinsiz.

		  Koşul `yazi.data.kapak` DEĞİL `kapakAltEksik`: şema bu durumda kapağı
		  zaten `undefined` yapıyor (bkz. `content.config.ts`), yani eski koşul
		  hiçbir zaman doğru olmuyor ve denetim sessizce ölüyordu.

		  Önem `gozdenGecir`: yazar bir kapak seçti ve o kapak sayfada
		  görünmüyor. Bu bir üslup önerisi değil, beklentiyle sonucun
		  ayrıldığı bir yer.
		*/
		if (yazi.data.kapakAltEksik) {
			bulgular.push({
				onem: 'gozdenGecir',
				denetim: 'Görsel metin karşılığı',
				dosya,
				sorun: '`kapak` seçilmiş ama `kapakAlt` boş; kapak BASILMIYOR.',
				neden:
					'Alt metni olmayan bir görsel ekran okuyucuda hiç karşılık bulmuyor ve ' +
					'yüklenemediğinde yerinde bir şey yazmıyor. Bu yüzden yayına hiç ' +
					'çıkarılmıyor — yazı şu an kapaksız görünüyor.',
				cozum:
					'Panelde yazının “Kapak metni” alanına görselde ne görüldüğünü yazın; ' +
					'kapak o anda görünür hâle gelir. Kapak istenmiyorsa `kapak` alanını boşaltın.',
			});
		}

		for (const satir of koddisiSatirlar(yazi.body ?? '')) {
			const metin = satirIciKodsuz(satir.metin);

			// Markdown görseli: ![](...) — köşeli parantez içi boşsa alt yok.
			for (const esles of metin.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
				if (esles[1].trim()) continue;
				bulgular.push({
					onem: 'iyilestirme',
					denetim: 'Görsel metin karşılığı',
					dosya,
					satir: dosyaSatiri(yazi.id, satir.no),
					sorun: `Görselin metin karşılığı boş: ${esles[2]}`,
					neden:
						'Ekran okuyucu kullanan ziyaretçi görselin ne olduğunu öğrenemiyor; ' +
						'görsel yüklenemediğinde de yerinde bir şey yazmıyor.',
					cozum: '`![](...)` yerine `![görselde ne var](...)` yazın.',
				});
			}
		}
	}

	/*
	  Astro bileşenlerindeki `<img>` etiketleri. Yalnızca `alt` niteliği HİÇ
	  yoksa bildiriliyor; `alt={degisken}` biçimindeki devingen değerler
	  dolu sayılıyor, çünkü değerin ne olduğu burada bilinemez.
	*/
	for (const klasor of [SAYFA_KLASORU, ...BILESEN_KLASORLERI]) {
		for (const gorel of await dosyalariTopla(kok, klasor)) {
			if (!gorel.endsWith('.astro')) continue;
			const icerik = await readFile(join(kok, gorel), 'utf8');
			for (const esles of icerik.matchAll(/<img\b[^>]*>/g)) {
				if (/\balt\s*=/.test(esles[0])) continue;
				const oncesi = icerik.slice(0, esles.index ?? 0);
				bulgular.push({
					onem: 'iyilestirme',
					denetim: 'Görsel metin karşılığı',
					dosya: duz(gorel),
					satir: oncesi.split('\n').length,
					sorun: `<img> etiketinde \`alt\` niteliği yok: ${esles[0].slice(0, 80)}`,
					neden:
						'`alt` olmayan görseli ekran okuyucu dosya adıyla okuyor; süs görselse de ' +
						'sessizce atlanması gerekirdi.',
					cozum:
						'Bilgi taşıyorsa `alt="…"` yazın; yalnızca süsse `alt=""` ve `aria-hidden="true"` verin.',
				});
			}
		}
	}

	/* ---------- 7) İç bağlantılar ---------- */

	for (const yazi of yazilar) {
		const dosya = yaziYolu(yazi.id);
		for (const satir of koddisiSatirlar(yazi.body ?? '')) {
			const metin = satirIciKodsuz(satir.metin);
			const adresler = [
				...[...metin.matchAll(/\]\(([^)\s]+)/g)].map((e) => e[1]),
				...[...metin.matchAll(/href\s*=\s*["']([^"']+)["']/g)].map((e) => e[1]),
			];

			for (const ham of adresler) {
				// Dış adresler, çapalar ve posta bağlantıları bu denetimin konusu değil.
				if (!ham.startsWith('/')) continue;
				const adres = rotaDuzle(ham.split('#')[0].split('?')[0]);

				/*
				  Site bir alt dizinde yayınlanıyor. İç bağlantı önekle yazılmazsa
				  yayında alan adının kökünü gösteriyor ve 404 veriyor. Ama panelde
				  `base` kaldırıldığı için bunu ÇALIŞTIRARAK doğrulayamıyoruz —
				  o yüzden "gözden geçir" kovasına giriyor.
				*/
				if (!adres.startsWith('/web-sitem')) {
					bulgular.push({
						onem: 'gozdenGecir',
						denetim: 'İç bağlantı',
						dosya,
						satir: dosyaSatiri(yazi.id, satir.no),
						sorun: `Bağlantı site önekiyle başlamıyor: ${ham}`,
						neden:
							'Site "/web-sitem" altında yayınlanıyor. Öneksiz bir iç bağlantı ' +
							'alan adının köküne gidiyor ve yayında 404 veriyor.',
						cozum: `Adresin başına "/web-sitem" ekleyin: "/web-sitem${adres}".`,
					});
					continue;
				}

				const ic = rotaDuzle(adres.slice('/web-sitem'.length) || '/');

				// Uzantılı adresler sayfa değil, public/ altındaki bir dosya.
				const sonParca = ic.split('/').pop() ?? '';
				if (sonParca.includes('.')) {
					if (!existsSync(join(kok, 'public', ...ic.split('/').filter(Boolean)))) {
						bulgular.push({
							onem: 'engel',
							denetim: 'Kırık bağlantı',
							dosya,
							satir: dosyaSatiri(yazi.id, satir.no),
							sorun: `Bağlantı var olmayan bir dosyaya gidiyor: ${ham}`,
							neden:
								'`public/` altında böyle bir dosya yok; bağlantıya tıklayan ziyaretçi ' +
								'404 alıyor.',
							cozum: `Dosyayı \`public${ic}\` olarak ekleyin ya da bağlantıyı düzeltin.`,
						});
					}
					continue;
				}

				if (duraganRotalar.has(ic)) continue;
				if (yayindakiYazilar.has(ic)) continue;

				/*
				  Devingen rotanın altındaki bir adres: yazı adresleri böyle.
				  Yayımlanan yazılar arasında yoksa ya yazı taslak ya da adres
				  yanlış — ikisi de ziyaretçi için 404 demek.
				*/
				const devingenAltinda = devingenOnekler.some(
					(onek) => ic === onek || ic.startsWith(onek + '/'),
				);
				bulgular.push({
					onem: 'engel',
					denetim: 'Kırık bağlantı',
					dosya,
					satir: dosyaSatiri(yazi.id, satir.no),
					sorun: `Bağlantı var olmayan bir sayfaya gidiyor: ${ham}`,
					neden: devingenAltinda
						? 'Böyle bir yazı yok ya da yazı `draft: true` olduğu için üretilmiyor. ' +
							'Bağlantıya tıklayan ziyaretçi 404 alıyor.'
						: '`src/pages` altında bu adresi üreten bir dosya yok; bağlantı 404 veriyor.',
					cozum: 'Adresi düzeltin ya da hedef sayfayı oluşturun.',
				});
			}
		}
	}

	/* ---------- 8) Yinelenen başlık / açıklama ---------- */

	/*
	  Karşılaştırma DİL İÇİNDE yapılıyor. Türkçe ve İngilizce eşlerin başlığı
	  zaten farklı, ama olsa bile bu bir hata olmazdı: ikisi ayrı sayfa, ayrı
	  dil. Diller karıştırılsaydı her çeviri çifti yanlış alarm üretirdi.
	*/
	for (const alan of ['title', 'description'] as const) {
		const kovalar = new Map<string, typeof yazilar>();
		for (const yazi of yazilar) {
			const deger = yazi.data[alan].trim().toLocaleLowerCase('tr');
			if (!deger) continue;
			const anahtar = `${yazi.data.dil}\u0000${deger}`;
			const kova = kovalar.get(anahtar) ?? [];
			kova.push(yazi);
			kovalar.set(anahtar, kova);
		}
		for (const kova of kovalar.values()) {
			if (kova.length < 2) continue;
			for (const yazi of kova) {
				// Dosyanın kendisi listeden çıkarılıyor: "şu dosyayla aynı" demek,
				// satırın başında zaten yazan dosyayı tekrar etmekten anlaşılır.
				const digerleri = kova
					.filter((y) => y.id !== yazi.id)
					.map((y) => duz(yaziYolu(y.id)))
					.join(', ');
				bulgular.push({
					onem: 'iyilestirme',
					denetim: alan === 'title' ? 'Yinelenen başlık' : 'Yinelenen açıklama',
					dosya: yaziYolu(yazi.id),
					sorun:
						alan === 'title'
							? `Başlık şu yazıyla aynı: ${digerleri}`
							: `Açıklama şu yazıyla aynı: ${digerleri}`,
					neden:
						'Arama motoru aynı metni taşıyan sayfalardan birini seçip diğerini gizliyor. ' +
						'Ziyaretçi de arama sonucunda hangisinin hangisi olduğunu ayırt edemiyor.',
					cozum: 'Yazılardan birini kendi konusuna göre yeniden adlandırın.',
				});
			}
		}
	}

	/* ---------- 9) Gelecek tarih ---------- */

	for (const yazi of yazilar) {
		const dosya = yaziYolu(yazi.id);
		const yayin = gunMetni(yazi.data.pubDate);
		if (yayin > bugun) {
			bulgular.push({
				onem: 'engel',
				denetim: 'Gelecek tarih',
				dosya,
				sorun: `\`pubDate\` ${yayin} — bugünden (${bugun}) sonra.`,
				neden:
					'Yazı yine de yayımlanıyor ama sayfada, RSS akışında ve site haritasında ' +
					'henüz gelmemiş bir tarih görünüyor. Listeler tarihe göre sıralandığı için ' +
					'yazı da en üste çıkıp gerçek son yazıyı aşağı itiyor.',
				cozum: 'Tarihi yazının gerçekten yayımlandığı güne çekin.',
			});
		}

		if (yazi.data.updatedDate) {
			const guncelleme = gunMetni(yazi.data.updatedDate);
			if (guncelleme > bugun) {
				bulgular.push({
					onem: 'engel',
					denetim: 'Gelecek tarih',
					dosya,
					sorun: `\`updatedDate\` ${guncelleme} — bugünden (${bugun}) sonra.`,
					neden:
						'Yazının künyesinde ve yapısal verisinde henüz gelmemiş bir güncelleme ' +
						'tarihi duruyor. Okuyucuya da arama motoruna da yanlış bilgi gidiyor.',
					cozum: 'Tarihi gerçekten düzenleme yapılan güne çekin ya da satırı silin.',
				});
			} else if (guncelleme < yayin) {
				bulgular.push({
					onem: 'gozdenGecir',
					denetim: 'Gelecek tarih',
					dosya,
					sorun: `\`updatedDate\` (${guncelleme}) \`pubDate\`den (${yayin}) önce.`,
					neden: 'Yazı yayımlanmadan güncellenmiş görünüyor; biri yanlış yazılmış olmalı.',
					cozum: 'İki tarihten hangisinin doğru olduğuna bakıp düzeltin.',
				});
			}
		}
	}

	/* ---------- 10) Etiketsiz yazı ---------- */

	for (const yazi of yazilar) {
		if (yazi.data.tags.length > 0) continue;
		bulgular.push({
			onem: 'iyilestirme',
			denetim: 'Etiket',
			dosya: yaziYolu(yazi.id),
			sorun: 'Yazının hiç etiketi yok.',
			neden:
				'Etiketler yazı sayfasında konuyu gösteriyor. Etiketsiz yazı, konusunu ' +
				'yalnızca başlığıyla anlatmak zorunda kalıyor.',
			cozum: 'Frontmatter’a `tags: [...]` ile bir iki konu ekleyin.',
		});
	}

	/* ---------- Kapsam notu ---------- */

	kapsamDisi.push(
		'Dış bağlantılar denetlenmiyor: adresin açılıp açılmadığını ölçmek internete istek atmayı gerektirir.',
	);
	kapsamDisi.push(
		'İç bağlantı denetimi yalnızca yazı gövdelerine bakıyor; `src/pages` ve bileşenlerdeki bağlantılar elden geçmedi.',
	);
	kapsamDisi.push(
		'Metnin kendisi (imla, anlatım, olgu doğruluğu) denetlenmiyor; bu araç yalnızca ölçülebilir kusurlara bakıyor.',
	);

	return {
		bulgular,
		yaziSayisi: yazilar.length,
		sayfaSayisi: rotalar.filter((r) => !r.devingen).length,
		kapsamDisi,
	};
}

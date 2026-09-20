import { spawn } from 'node:child_process';
import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';

import {
	HEDEF_KOK,
	SUNUCU,
	YAYIN_DIZINI,
	canliSayfalar,
	hataMetni,
	sshBayraklari,
	ssh,
} from './sunucu.mjs';

/*
  YAYINLAMA YORDAMI

  Üç iş yapıyor: derleme, sunucuya gönderme, geri alma. Üçü de ilerlerken
  `bildir` geri çağrısıyla ne olduğunu söylüyor — panel bu satırları canlı
  gösteriyor, kullanıcı donmuş sanmasın.

  Derleme ile gönderme BİLİNÇLİ OLARAK AYRI iki çağrı: kullanıcı önce
  derliyor, ne üretildiğini görüyor, sonra onaylıyor. Tek düğmede
  birleştirilseydi, geri alınması zor bir iş tek tıkla olurdu.
*/

/*
  PROJE KÖKÜ DIŞARIDAN VERİLİYOR, `import.meta.url` ile bulunmuyor.

  Bu modülü Astro'nun yapılandırma yükleyicisi içeri alıyor ve o yükleyici
  yapılandırmayı geçici bir dosyaya paketleyebiliyor. Öyle bir çalıştırmada
  `import.meta.url` gerçek dosyayı değil geçici dosyayı gösterir; kök de iki
  klasör yukarı kayardı ve derleme bambaşka bir yerde denenirdi. Eklenti,
  Astro'nun kendi `config.root` değerini buraya veriyor — tek güvenilir kaynak
  o. Değer, ilk istek gelmeden önce, `astro:config:setup` sırasında yazılıyor.
*/
let projeKoku = null;

export function kokuAyarla(kok) {
	projeKoku = kok;
}

/*
  PANEL SUNUCUNUN KENDİSİNDE Mİ ÇALIŞIYOR?

  Açıkken yayınlama iki noktada değişiyor:

  1. Dosyalar `scp` ile GÖNDERİLMİYOR, aynı makinede kopyalanıyor. Hedef
     dizin zaten orada; ağdan geçirmenin anlamı yok ve daha önemlisi SSH
     anahtarı o makineye bilerek konulmadı.

  2. Derlemeden ÖNCE depo çekiliyor. Sunucudaki kopya kullanıcının
     bilgisayarından gönderilmiş bir yazının gerisinde kalmış olabilir;
     çekmeden derlemek eski içeriği yayınlamak olurdu.

  Masaüstü panelinde tanımsız; oradan yayın eskisi gibi ssh + scp ile
  yapılıyor.
*/
const YEREL_YAYIN = process.env.PANEL_YEREL_YAYIN === '1';

/*
  PANELİN YAZDIĞI YOLLAR

  Keystatic yalnızca buralara yazıyor (`keystatic.config.ts` içindeki `path`
  ve `directory` değerleri). Kaydetme adımı YALNIZCA bunları aşamalandırıyor:
  bir yayın adımının, o sırada üzerinde çalışılan kodu da sessizce
  commit'lemesi istenmez. Keystatic'e yeni bir koleksiyon eklenirse yolu
  buraya da yazılmalı, yoksa o içerik depoya girmeden yayınlanır.
*/
export const PANEL_YOLLARI = ['src/icerik', 'src/content', 'public/yazi-gorselleri'];

function kokuIste() {
	if (!projeKoku) {
		throw new Error(
			'Proje kökü ayarlanmadı: `kokuAyarla` çağrılmadan yayın yordamı kullanılamaz.',
		);
	}
	return projeKoku;
}

/*
  DERLEME NEREDE YAPILIYOR VE NEDEN ORADA

  Panel açıkken dev sunucusu da çalışıyor. İkisi de içerik katmanını
  eşitliyor ve Astro bu eşitlemenin çıktısını projenin `.astro/` klasörüne
  yazıyor (`content-assets.mjs`, `content-modules.mjs`, `collections/…`).
  Yazma yöntemi şu: önce `<dosya>.tmp`, sonra asıl adına `rename`. İki süreç
  aynı anda yaptığında biri `.tmp` dosyasını taşıyıp tüketiyor, diğeri aynı
  dosyayı arayıp düşüyor:

      UnknownFilesystemError · ENOENT · rename
      .astro/…​.tmp → .astro/…

  Bu sitede yaşandı: panelde "Failed to fetch" olarak görünüyor ve yazılan
  makale diske hiç yazılmıyor. Yani sessiz veri kaybı.

  ÇÖZÜM: derleme projenin İÇİNDE değil, projenin bir KOPYASINDA yapılıyor.
  Kaynaklar aşağıdaki dizine kopyalanıyor ve `astro build` kökü orası olacak
  şekilde çalıştırılıyor. Astro'nun `.astro/` klasörü kökten türediği için
  (`<kök>/.astro/`) kopyanın içinde kalıyor; dev sunucusuyla ORTAK TEK BİR
  DOSYA kalmıyor. `outDir` ve `cacheDir` da kopyanın içinde.

  Neden `--outDir` ile `cacheDir` tek başına yetmiyor: `.astro/` klasörünün
  yeri ayarlanabilir değil, her zaman kökün altında. Kök değişmeden çakışma
  duruyor.

  Kopyanın ikinci faydası: derlemenin başladığı anın FOTOĞRAFI alınıyor.
  Kullanıcı derleme sürerken panelde yazı düzenlemeye devam edebiliyor;
  yayınlanan şey önizlemede gösterilenle birebir aynı kalıyor.

  Kopya neden `node_modules/` altında: Vite'ın dosya gözcüsü `node_modules`
  içini zaten yok sayıyor, yani yüzlerce dosyanın kopyalanması dev sunucusunda
  yeniden yükleme fırtınası başlatmıyor — proje kökünde bir klasör olsaydı
  başlatırdı. Node'un modül çözümlemesi de buradan yukarı yürüyüp projenin
  `node_modules` klasörünü buluyor, yani kopyaya bağımlılık kopyalamak
  gerekmiyor.
*/
function derlemeDizini() {
	return join(kokuIste(), 'node_modules', '.yayin-derleme');
}

/** Derleme çıktısı. Sunucuya giden dosyalar buradan okunuyor. */
function derlemeCiktisi() {
	return join(derlemeDizini(), 'cikti');
}

/** Kopyalanan kaynaklar: derlemenin okuduğu her şey bu dört girdide. */
const KOPYALANACAKLAR = ['src', 'public', 'tsconfig.json', 'package.json'];

/*
  Kopyaya yazılan yapılandırma. Asıl `astro.config.mjs` olduğu gibi içeri
  alınıyor — yayın çıktısının ayarları (site, base, i18n, eklentiler) kendi
  dosyasında, tek yerde kalsın. Burada yalnızca çıktı ve önbellek yolları
  kopyanın içine çekiliyor.

  `astro.config.cms.mjs` DEĞİL `astro.config.mjs`: yayınlanan şey sitenin
  kendisi, panel değil. Panel rotaları (`/keystatic`, `/istatistik`, `/durum`)
  bu derlemeye zaten giremiyor.
*/
function yapilandirmaMetni() {
	const asilYapilandirma = `file:///${join(kokuIste(), 'astro.config.mjs').split(sep).join('/')}`;
	return `// Bu dosya her yayında yeniden üretiliyor; elle düzenlemenin anlamı yok.
// Neden var olduğu: src/yayin/yayinla.mjs
import temel from ${JSON.stringify(asilYapilandirma)};

export default {
	...temel,
	outDir: './cikti',
	cacheDir: './onbellek',
};
`;
}

/* ------------------------------------------------------------------ */
/* Derleme                                                             */
/* ------------------------------------------------------------------ */

/**
 * Projeyi kopyalar ve `astro build` çalıştırır.
 *
 * Hata FIRLATMIYOR: derlemenin başarısız olması olağan bir sonuç (bir yazının
 * frontmatter'ı bozuktur, bir bağlantı kırıktır). Panel çökmek yerine Astro'nun
 * kendi çıktısını göstermeli, bu yüzden hata bir değer olarak dönüyor.
 */
/* Çıktısı panele akmayan komut: durum sorguları kayıt penceresini doldurmasın. */
function sessizce(komut, argumanlar) {
	return komutCalistir(komut, argumanlar, kokuIste(), () => {});
}

/*
  Bir yolu commit mesajında görünecek kısa bir ada indiriyor:
  `src/icerik/metinler/gizlilik.json` → `gizlilik`
  `src/content/blog/dart-dili.mdx`    → `blog/dart-dili`
*/
function bolumAdi(yol) {
	const parcalar = yol.split('/');
	const adsiz = (a) => (a ?? '').replace(/\.[^.]+$/, '');
	if (parcalar[1] === 'content') return `${parcalar[2]}/${adsiz(parcalar[3])}`;
	if (parcalar[1] === 'yazi-gorselleri') return 'görseller';
	return adsiz(parcalar.at(-1));
}

function commitMesaji(dosyalar) {
	const adlar = [...new Set(dosyalar.map(bolumAdi))].filter(Boolean);
	const gosterilen = adlar.slice(0, 5).join(', ');
	const kalan = adlar.length > 5 ? ` ve ${adlar.length - 5} bölüm daha` : '';
	return `Panelden içerik: ${gosterilen}${kalan}`;
}

/**
 * Panelden yazılan içeriği depoya kaydediyor (commit; gönderme AYRI).
 *
 * NEDEN YAYININ İÇİNDE: panel içerik dosyalarını doğrudan diske yazıyor ve
 * git'e hiç dokunmuyordu. Sonuç iki ayrı arıza veriyordu:
 *
 *   1. Depo ile yayın ayrışıyordu. Sunucudaki klon `main`'i çekiyor; depoya
 *      girmemiş bir metin, sonraki bir yayında sessizce geri alınıyordu.
 *   2. Aşağıdaki `git pull --rebase` kirli ağaçta çalışmıyor. Her yayında
 *      "Depo çekilemedi" uyarısı verilip atlanıyordu — yani çekme adımı
 *      aslında hiç işlemiyordu.
 *
 * Hata FIRLATMIYOR. Kaydedememek yayını durdurmak için yeterli bir sebep
 * değil: metin zaten diskte duruyor ve bir sonraki yayında yine denenecek.
 */
export async function icerigiKaydet(bildir) {
	const durum = await sessizce('git', ['status', '--porcelain', '--', ...PANEL_YOLLARI]);
	if (durum.kod !== 0) {
		bildir('uyari', 'git çalıştırılamadı; içerik depoya kaydedilmedi.');
		return { kaydedildi: false, dosyalar: [] };
	}

	const satirlar = durum.cikti
		.split('\n')
		.map((satir) => satir.slice(3).trim())
		.filter(Boolean);

	if (satirlar.length === 0) return { kaydedildi: false, dosyalar: [] };

	/*
	  Aşamalandırma DİZİN değil dosya listesiyle yapılıyor. `git add -- <dizin>`
	  var olmayan bir yol geçildiğinde tamamen başarısız oluyor ve
	  `public/yazi-gorselleri` henüz hiç görsel yüklenmemişse yok — bu yüzden
	  kaydetme adımının tamamı düşüyordu.

	  Yeniden adlandırmada porcelain `eski -> yeni` yazıyor; iki taraf da
	  ekleniyor, yoksa eskisi silinmiş olarak geride kalırdı. Özel karakterli
	  adlar tırnak içinde geliyor, tırnaklar soyuluyor.
	*/
	const dosyalar = satirlar
		.flatMap((yol) => (yol.includes(' -> ') ? yol.split(' -> ') : [yol]))
		.map((yol) => yol.replace(/^"|"$/g, ''))
		.filter(Boolean);

	/*
	  Dal uyarısı: yayınlanan sürüm `main`'e girmezse sunucudaki klon onu hiç
	  görmüyor. Kaydetme yine de yapılıyor — yazılan metnin kaybolmaması,
	  hangi dalda olduğundan önce gelir.
	*/
	const dal = await sessizce('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
	const dalAdi = dal.cikti.trim();
	if (dal.kod === 0 && dalAdi && dalAdi !== 'main') {
		bildir('uyari', `Depo "${dalAdi}" dalında, main değil. Bu içerik main'e girmeden yayınlanıyor.`);
	}

	bildir('adim', `${satirlar.length} içerik dosyası depoya kaydediliyor…`);
	const ekle = await sessizce('git', ['add', '--', ...dosyalar]);
	if (ekle.kod !== 0) {
		bildir('uyari', 'İçerik aşamalandırılamadı; kaydetme atlandı.');
		return { kaydedildi: false, dosyalar };
	}

	const kayit = await sessizce('git', ['commit', '-m', commitMesaji(dosyalar)]);
	if (kayit.kod !== 0) {
		bildir('uyari', `İçerik kaydedilemedi: ${kayit.cikti.trim().split('\n').at(-1) ?? ''}`);
		return { kaydedildi: false, dosyalar };
	}

	bildir('bilgi', `Kaydedildi: ${commitMesaji(dosyalar)}`);
	return { kaydedildi: true, dosyalar };
}

/**
 * Yereldeki commit'leri GitHub'a gönderiyor.
 *
 * Yayının SONUNDA çağrılıyor, başında değil: gönderilen şey sunucuya gerçekten
 * çıkmış olan sürüm oluyor. Başarısız olursa yayın başarısız SAYILMIYOR — site
 * zaten güncellendi, eksik olan yalnızca deponun uzak kopyası ve bu bir sonraki
 * yayında kendiliğinden kapanıyor.
 */
export async function depoyuGonder(bildir) {
	const sayim = await sessizce('git', ['rev-list', '--count', '@{u}..HEAD']);
	if (sayim.kod !== 0) {
		bildir('uyari', "Dalın uzak karşılığı yok; GitHub'a gönderilmedi.");
		return { gonderildi: false, adet: 0 };
	}

	const adet = Number(sayim.cikti.trim());
	if (!Number.isFinite(adet) || adet === 0) return { gonderildi: false, adet: 0 };

	bildir('adim', `${adet} commit GitHub'a gönderiliyor…`);
	const itme = await komutCalistir('git', ['push'], kokuIste(), bildir);
	if (itme.kod !== 0) {
		bildir('uyari', "GitHub'a gönderilemedi; commit'ler yerelde duruyor.");
		return { gonderildi: false, adet };
	}

	bildir('bilgi', `${adet} commit gönderildi.`);
	return { gonderildi: true, adet };
}

export async function derle(bildir) {
	const dizin = derlemeDizini();

	/*
	  Sunucuda çalışıyorsak önce depo çekiliyor: panelden yazılanlar zaten
	  buradaki kopyada ama kullanıcı kendi bilgisayarından da yazmış olabilir.
	  Çekmeden derlemek onun yazısını yayına almamak demekti.

	  Çekme başarısız olursa yayın DURDURULMUYOR, uyarı verilip devam ediliyor:
	  ağ sorunu yüzünden yayınlayamamak, bir tık eski içerik yayınlamaktan daha
	  kötü. Uyarı kayıt panelinde görünüyor.
	*/
	/*
	  Çekmeden ÖNCE kaydetmek şart: `git pull --rebase` kirli bir ağaçta
	  çalışmıyor. Sıra tersken çekme her yayında sessizce atlanıyordu.
	*/
	await icerigiKaydet(bildir);

	if (YEREL_YAYIN) {
		bildir('adim', 'Depo güncelleniyor (git pull)…');
		const cekme = await komutCalistir('git', ['pull', '--rebase', 'origin', 'main'], kokuIste(), bildir);
		if (cekme.kod !== 0) {
			bildir('uyari', 'Depo çekilemedi; elde olan sürümle devam ediliyor.');
		}
	}

	bildir('adim', 'Kaynaklar derleme kopyasına alınıyor…');
	try {
		// Kopya her seferinde sıfırdan kuruluyor. Üzerine yazılsaydı silinmiş bir
		// yazı kopyada kalır ve yayında görünmeye devam ederdi.
		await rm(dizin, { recursive: true, force: true });
		await mkdir(dizin, { recursive: true });
		for (const ad of KOPYALANACAKLAR) {
			await cp(join(kokuIste(), ad), join(dizin, ad), { recursive: true, force: true });
		}
		await writeFile(join(dizin, 'astro.config.mjs'), yapilandirmaMetni(), 'utf8');
	} catch (hata) {
		return {
			basarili: false,
			hata: `Derleme kopyası hazırlanamadı: ${hata?.message ?? String(hata)}`,
		};
	}

	bildir('adim', 'Site derleniyor (astro build)…');
	const sonuc = await komutCalistir(
		process.execPath,
		[join(kokuIste(), 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build'],
		dizin,
		bildir,
	);

	if (sonuc.kod !== 0) {
		return {
			basarili: false,
			hata:
				`Derleme ${sonuc.kod} koduyla durdu; sunucuya hiçbir şey gönderilmedi.\n\n` +
				(sonuc.cikti.trim() || 'Astro hiçbir çıktı vermedi.'),
		};
	}

	const sayfalar = await uretilenSayfalar();
	if (sayfalar.length === 0) {
		return {
			basarili: false,
			hata: 'Derleme başarılı göründü ama tek bir HTML sayfası üretilmedi. Yayınlanmadı.',
		};
	}

	bildir('adim', `Derleme bitti: ${sayfalar.length} sayfa üretildi.`);

	/*
	  Yayındaki liste derlemeden SONRA çekiliyor: onay ekranı "neyin
	  değişeceğini" ancak iki listeyi karşılaştırarak söyleyebiliyor. Site
	  haritası okunamazsa karşılaştırma `null` kalıyor — uydurulmuş bir "hiçbir
	  şey değişmiyor" cümlesi, yanlış bir cümle olurdu.
	*/
	const yayindakiler = await canliSayfalar();
	/*
	  Hata sayfaları karşılaştırmanın dışında: `astro.config.mjs` onları site
	  haritasına bilerek koymuyor (ikisi de `noindex`). Süzülmeselerdi her
	  önizlemede "/404 ve /en/404 yayına girecek" yazardı — hiç değişmedikleri
	  hâlde.
	*/
	const hataSayfasiMi = (yol) => /\/404$/.test(yol);
	const karsilastirilan = sayfalar.filter((y) => !hataSayfasiMi(y));
	const karsilastirma =
		yayindakiler === null
			? null
			: {
					yeni: karsilastirilan.filter((y) => !yayindakiler.includes(y)),
					kaybolan: yayindakiler.filter((y) => !karsilastirilan.includes(y)),
				};

	return { basarili: true, sayfalar, karsilastirma };
}

/** Derleme çıktısındaki `.html` dosyalarını ziyaretçinin göreceği yola çevirir. */
async function uretilenSayfalar() {
	const kok = derlemeCiktisi();
	const yollar = [];

	async function gez(dizin) {
		let girdiler;
		try {
			girdiler = await readdir(dizin, { withFileTypes: true });
		} catch {
			return;
		}
		for (const girdi of girdiler) {
			const tam = join(dizin, girdi.name);
			if (girdi.isDirectory()) await gez(tam);
			else if (girdi.name.endsWith('.html')) yollar.push(tam);
		}
	}

	await gez(kok);

	return yollar
		.map((tam) => {
			// Windows'ta yol ayracı ters eğik çizgi; adres her zaman düz çizgi.
			const goreli = relative(kok, tam).split(sep).join('/');
			// "blog/x/index.html" → "/web-sitem/blog/x", "404.html" → "/web-sitem/404"
			const ic = goreli.replace(/(^|\/)index\.html$/, '').replace(/\.html$/, '');
			return posix.join('/web-sitem', ic).replace(/\/+$/, '') || '/web-sitem';
		})
		.sort();
}

/* ------------------------------------------------------------------ */
/* Sunucuya gönderme                                                   */
/* ------------------------------------------------------------------ */

/*
  ATOMİK YER DEĞİŞTİRME — sunucudaki sıralama

  Dosyalar önce `web-sitem.yeni` altına kopyalanıyor, yayın dizini ancak
  kopyalama bittikten sonra tek bir `mv` ile değiştiriliyor. Doğrudan
  `web-sitem` üzerine kopyalansaydı, kopyalama sürerken siteyi açan ziyaretçi
  yarısı eski yarısı yeni bir site görürdü.

  ESKİ SÜRÜM KORUNUYOR. Elde kullanılan yordamda bu bloğun ilk satırı
  `rm -rf web-sitem.eski` idi; buradan çıkarıldı ki bir önceki sürüm geri
  alınabilsin. Ama YALNIZCA ÇIKARMAK YETMİYOR: `mv web-sitem web-sitem.eski`
  komutu, hedef zaten bir dizinse üzerine yazmıyor, İÇİNE giriyor —
  `web-sitem.eski/web-sitem` oluşuyor ve ikinci yayın sessizce bozuluyor.

  Bu yüzden eski sürüm önce geçici bir ada alınıyor ve yer değiştirme bittikten
  SONRA siliniyor. Böylece geri alınacak sürümün hiç bulunmadığı bir aralık
  oluşmuyor: ya `web-sitem.eski` duruyor, ya geçici adı.
*/
function devreyeAlmaKomutu() {
	return [
		'set -e',
		`chown -R www-data:www-data ${HEDEF_KOK}/${YAYIN_DIZINI}.yeni`,
		`find ${HEDEF_KOK}/${YAYIN_DIZINI}.yeni -type d -exec chmod 755 {} +`,
		`find ${HEDEF_KOK}/${YAYIN_DIZINI}.yeni -type f -exec chmod 644 {} +`,
		`cd ${HEDEF_KOK}`,
		`rm -rf ${YAYIN_DIZINI}.eski.silinecek`,
		`if [ -e ${YAYIN_DIZINI}.eski ]; then mv ${YAYIN_DIZINI}.eski ${YAYIN_DIZINI}.eski.silinecek; fi`,
		`mv ${YAYIN_DIZINI} ${YAYIN_DIZINI}.eski`,
		`mv ${YAYIN_DIZINI}.yeni ${YAYIN_DIZINI}`,
		`rm -rf ${YAYIN_DIZINI}.eski.silinecek`,
		'echo yayin-tamam',
	].join('\n');
}

/**
 * Derlenmiş çıktıyı sunucuya taşır.
 *
 * `kuru` verildiğinde sunucuda HİÇBİR ŞEY DEĞİŞMİYOR: çalıştırılacak komutlar
 * olduğu gibi yazdırılıyor ve yalnızca salt okunur bir yoklama yapılıyor.
 * Akışın kendisini canlı siteyi riske atmadan sınamanın tek yolu bu.
 */
export async function gonder(bildir, { kuru = false } = {}) {
	const hazirlaKomutu = `rm -rf ${HEDEF_KOK}/${YAYIN_DIZINI}.yeni && mkdir -p ${HEDEF_KOK}/${YAYIN_DIZINI}.yeni`;

	/*
	  `cikti/.` sondaki nokta bilinçli: scp'ye "dizinin KENDİSİNİ değil
	  İÇİNDEKİLERİ kopyala" demenin yolu bu.

	  Yol göreli, çünkü komut derleme dizininde çalışıyor. Mutlak Windows yolu
	  verilseydi scp `C:` önekini uzak makine adı sanabilirdi.
	*/
	const scpArgumanlari = [
		...sshBayraklari(),
		'-q',
		'-r',
		'cikti/.',
		`${SUNUCU}:${HEDEF_KOK}/${YAYIN_DIZINI}.yeni/`,
	];

	if (kuru) {
		bildir('uyari', 'KURU ÇALIŞTIRMA — sunucuda hiçbir şey değişmeyecek.');
		bildir('komut', hazirlaKomutu);
		bildir(
			'komut',
			YEREL_YAYIN
				? `cp -r cikti/. ${HEDEF_KOK}/${YAYIN_DIZINI}.yeni/`
				: `scp -r cikti/. ${SUNUCU}:${HEDEF_KOK}/${YAYIN_DIZINI}.yeni/`,
		);
		bildir('komut', `ssh … "${devreyeAlmaKomutu()}"`);
		bildir('adim', 'Sunucuya salt okunur bir yoklama yapılıyor…');
		try {
			const cikti = await ssh(`ls -ld ${HEDEF_KOK}/${YAYIN_DIZINI}*`, { zamanAsimiMs: 30_000 });
			bildir('bilgi', cikti.trim());
			bildir('bitti', 'Kuru çalıştırma tamam: bağlantı çalışıyor, hedef dizin yerinde.');
			return { basarili: true };
		} catch (hata) {
			return { basarili: false, hata: hataMetni(hata) };
		}
	}

	try {
		bildir('adim', 'Sunucuda geçici dizin hazırlanıyor…');
		await ssh(hazirlaKomutu, { zamanAsimiMs: 60_000 });

		bildir('adim', 'Dosyalar kopyalanıyor (adımların en uzunu)…');
		/*
		  Yerelde `cp`, uzakta `scp`. İkisi de "dizinin içindekileri" kopyalıyor:
		  `cikti/.` sondaki nokta bunun için.
		*/
		const kopyalama = YEREL_YAYIN
			? await komutCalistir(
					'cp',
					['-r', 'cikti/.', `${HEDEF_KOK}/${YAYIN_DIZINI}.yeni/`],
					derlemeDizini(),
					bildir,
				)
			: await komutCalistir('scp', scpArgumanlari, derlemeDizini(), bildir);
		if (kopyalama.kod !== 0) {
			// Yarım kalan kopya sunucuda durmasın. Yayın dizinine henüz
			// dokunulmadığı için site eski hâlinde; temizlenecek tek şey `.yeni`.
			await ssh(`rm -rf ${HEDEF_KOK}/${YAYIN_DIZINI}.yeni`, { zamanAsimiMs: 60_000 }).catch(
				() => {},
			);
			return {
				basarili: false,
				hata:
					`Kopyalama ${kopyalama.kod} koduyla durdu. Yayın dizinine DOKUNULMADI, site eski hâlinde.\n\n` +
					(kopyalama.cikti.trim() || 'scp hiçbir çıktı vermedi.'),
			};
		}

		bildir('adim', 'Devreye alınıyor…');
		const cikti = await ssh(devreyeAlmaKomutu(), { zamanAsimiMs: 120_000 });
		if (!cikti.includes('yayin-tamam')) {
			return {
				basarili: false,
				hata: `Devreye alma beklenen onayı vermedi. Sunucunun yanıtı:\n${cikti.trim()}`,
			};
		}

		/*
		  Site çıktı; şimdi depo. Sıra bu: gönderilen commit, sunucuda gerçekten
		  duran sürümü gösteriyor.
		*/
		await depoyuGonder(bildir);

		bildir('bitti', 'Yayınlandı. Önceki sürüm `web-sitem.eski` olarak duruyor.');
		return { basarili: true };
	} catch (hata) {
		return { basarili: false, hata: hataMetni(hata) };
	}
}

/* ------------------------------------------------------------------ */
/* Geri alma                                                           */
/* ------------------------------------------------------------------ */

/*
  Geri alma silmek yerine TAKAS ediyor: yayından kalkan sürüm `.eski` olarak
  duruyor. Böylece geri almanın kendisi de geri alınabiliyor — yanlış düğmeye
  basmak tek yönlü bir yol olmamalı.
*/
function geriAlmaKomutu() {
	return [
		'set -e',
		`cd ${HEDEF_KOK}`,
		`if [ ! -d ${YAYIN_DIZINI}.eski ]; then echo eski-surum-yok; exit 1; fi`,
		`rm -rf ${YAYIN_DIZINI}.takas`,
		`mv ${YAYIN_DIZINI} ${YAYIN_DIZINI}.takas`,
		`mv ${YAYIN_DIZINI}.eski ${YAYIN_DIZINI}`,
		`mv ${YAYIN_DIZINI}.takas ${YAYIN_DIZINI}.eski`,
		'echo geri-alma-tamam',
	].join('\n');
}

export async function geriAl(bildir, { kuru = false } = {}) {
	if (kuru) {
		bildir('uyari', 'KURU ÇALIŞTIRMA — sunucuda hiçbir şey değişmeyecek.');
		bildir('komut', `ssh … "${geriAlmaKomutu()}"`);
		bildir('bitti', 'Kuru çalıştırma tamam.');
		return { basarili: true };
	}

	try {
		bildir('adim', 'Önceki sürüm geri yükleniyor…');
		const cikti = await ssh(geriAlmaKomutu(), { zamanAsimiMs: 120_000 });
		if (cikti.includes('eski-surum-yok')) {
			return { basarili: false, hata: 'Sunucuda geri alınacak bir sürüm yok.' };
		}
		if (!cikti.includes('geri-alma-tamam')) {
			return {
				basarili: false,
				hata: `Geri alma beklenen onayı vermedi. Sunucunun yanıtı:\n${cikti.trim()}`,
			};
		}
		bildir('bitti', 'Önceki sürüm yayında. Az önce kaldırılan sürüm `web-sitem.eski` oldu.');
		return { basarili: true };
	} catch (hata) {
		/*
		  `set -e` yüzünden sıfırdan farklı çıkış kodu hata olarak geliyor;
		  "eski sürüm yok" durumu da buraya düşüyor. Metin orada da anlaşılır
		  olsun diye ayrıca sınanıyor.
		*/
		const metin = String(hata?.stdout ?? '') + String(hata?.stderr ?? '');
		if (metin.includes('eski-surum-yok')) {
			return { basarili: false, hata: 'Sunucuda geri alınacak bir sürüm yok.' };
		}
		return { basarili: false, hata: hataMetni(hata) };
	}
}

/* ------------------------------------------------------------------ */
/* Ortak                                                               */
/* ------------------------------------------------------------------ */

/**
 * Alt süreci çalıştırır, çıktısını satır satır `bildir` ile geçirir ve çıkış
 * kodunu döndürür.
 *
 * `execFile` yerine `spawn`: çıktı BİTTİĞİNDE değil AKARKEN gerekiyor. Derleme
 * yarım dakika sürebiliyor ve kullanıcı o süre boyunca bir şeylerin olduğunu
 * görmeli.
 */
function komutCalistir(komut, argumanlar, calismaDizini, bildir) {
	return new Promise((cozumle) => {
		let cikti = '';
		const surec = spawn(komut, argumanlar, {
			cwd: calismaDizini,
			stdio: ['ignore', 'pipe', 'pipe'],
			// Kabuk yok: hem araya sarmalayıcı bir süreç girmiyor hem de
			// argümanlar kabuk ayrıştırmasından geçmiyor.
			shell: false,
			windowsHide: true,
		});

		/*
		  Yarım satır tamponu. Astro çıktısını parça parça yazıyor ve bir satırın
		  ortasında kesiliyor: tampon olmadan "(+5ms)" kendi başına bir satır
		  olarak görünüyordu.
		*/
		let yarim = '';
		const yut = (veri) => {
			const metin = ansisiz(String(veri));
			// Son 8000 karakter tutuluyor: hata anında işe yarayan son satırlar bu
			// kadar, derlemenin tamamını bellekte tutmanın karşılığı yok.
			cikti = (cikti + metin).slice(-8000);
			const parcalar = (yarim + metin).split('\n');
			yarim = parcalar.pop() ?? '';
			for (const satir of parcalar) {
				if (satir.trim()) bildir('cikti', satir.trimEnd());
			}
		};
		surec.stdout.on('data', yut);
		surec.stderr.on('data', yut);
		const yarimiBosalt = () => {
			if (yarim.trim()) bildir('cikti', yarim.trimEnd());
			yarim = '';
		};

		// Komut hiç başlatılamadıysa (ör. `scp` kurulu değil) çıkış kodu gelmiyor;
		// uydurulmuş bir kodla ama gerçek mesajla dönülüyor.
		surec.on('error', (hata) => cozumle({ kod: -1, cikti: `${cikti}\n${hata.message}` }));
		surec.on('close', (kod) => {
			yarimiBosalt();
			cozumle({ kod: kod ?? -1, cikti });
		});
	});
}

/*
  Terminal renk kodlarını atar.

  Astro çıktısını renkli basıyor; o kaçış dizileri terminalde renk, tarayıcıda
  ise "[2m23:29:57[22m" gibi okunmaz bir kalabalık oluyor. Kayıt panelde
  gösterildiği için burada, kaynağında temizleniyor.
*/
function ansisiz(metin) {
	// eslint-disable-next-line no-control-regex
	return metin.replace(/\[[0-9;]*[A-Za-z]/g, '');
}

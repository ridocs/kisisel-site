/**
 * SÜRÜM BİLGİSİ VE DEĞİŞİKLİK GÜNLÜĞÜ — ikisi de derleme anında git'ten okunur.
 *
 * Neden git: "şu an yayında olan sürüm hangisi" sorusunun tek dürüst cevabı
 * deponun kendisinde. Elle tutulan bir sürüm dosyası ilk acele yayında
 * güncellenmeden kalır ve o andan sonra yalan söyler.
 *
 * GİT BULUNAMAZSA ÇÖKMÜYORUZ. Bu dosyadaki her okuma başarısız olabilir ve
 * başarısızlık `null` / boş liste olarak dönüyor. Gerekçesi somut: yayın
 * yordamı (`src/yayin/yayinla.mjs`) kaynakları `node_modules/.yayin-derleme`
 * altına kopyalayıp orada derliyor ve kopyaya `.git` alınmıyor. Sürüm bilgisi
 * olmadan da site derlenebilmeli — aksi hâlde bir ayrıntı bütün yayını
 * durdururdu.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Yayındaki sürüm: kısa commit kimliği ve o commit'in tarihi (YYYY-AA-GG). */
export interface Surum {
	kimlik: string;
	tarih: string;
}

/** Günlükteki tek bir değişiklik. */
export interface Degisiklik {
	kimlik: string;
	/**
	 * Commit başlığının ilk satırı, Türkçe ve tam cümle. Sayfaya basılmadan
	 * önce `gorunenBaslik()` süzgecinden geçiyor; İngilizce sayfada ayrıca
	 * `src/lib/degisiklik-ceviri.ts` sözlüğünden geçiriliyor.
	 */
	baslik: string;
	/** Bu değişiklikle EKLENEN yazıların adresleri (dosya adından gelen kimlik). */
	yeniYazilar: string[];
}

/** Aynı güne düşen değişiklikler. */
export interface DegisiklikGunu {
	tarih: string;
	kayitlar: Degisiklik[];
}

/*
  ZİYARETÇİNİN GÖRDÜĞÜ YÜZ.

  Depoda panel, masaüstü uygulaması, yayın yordamı ve araç betikleri de var.
  "Eşitleyici olmayan klasörü komuta vermesin" gibi bir satır siteye gelen
  biri için hiçbir şey ifade etmiyor; ham commit listesi basmak günlüğü
  okunmaz yapardı.

  Bu yüzden yalnızca aşağıdaki yolların altına dokunan commit'ler günlüğe
  giriyor — hepsi ziyaretçinin tarayıcısında bir karşılığı olan klasörler:

    src/pages      sayfaların kendisi
    src/components sayfaları kuran bileşenler
    src/layouts    ortak kabuk (üst çubuk, altbilgi, <head>)
    src/content    blog yazıları
    src/icerik     sitenin bütün arayüz metinleri
    src/styles     görünüm
    src/i18n       sayfa adları ve dil yönlendirmesi
    src/lib        iletişim bilgileri gibi sayfalarda basılan veriler
    public         görseller, yazı tipi, favicon

  Dışarıda kalanlar bilinçli: `src/panel`, `src/istatistik`, `src/kontrol`,
  `src/yayin`, `masaustu`, `araclar` ve kök dizindeki yapılandırma dosyaları.
  Bunların hepsi siteyi ÜRETEN takımlar; sitenin kendisi değil.
*/
const SITE_ONEKLERI = [
	'src/pages/',
	'src/components/',
	'src/layouts/',
	'src/content/',
	'src/icerik/',
	'src/styles/',
	'src/i18n/',
	'src/lib/',
	'public/',
];

/** Blog yazısı dosyası mı, öyleyse yazının adresi ne? */
const YAZI_DESENI = /^src\/content\/blog\/(.+)\.mdx?$/;

/*
  Kayıt ve alan ayıraçları: commit başlığında geçme ihtimali olmayan iki
  denetim karakteri. Boru işareti gibi görünür bir ayıraç seçilseydi, içinde
  boru geçen bir başlık ayrıştırmayı sessizce bozardı.

  git'e `%x1e` / `%x1f` kaçışlarıyla söyleniyor, karakterin kendisi argümana
  yazılmıyor: Node, içinde NUL geçen bir argümanı zaten reddediyor ve görünmez
  karakterli argümanlar hata ayıklanamaz hâle geliyor. Çıktıda ise gerçek
  karakterler var, aşağıda onlara bölünüyor.
*/
const KAYIT_AYIRACI = '';
const ALAN_AYIRACI = '';

let kokOnbellek: string | null | undefined;

/**
 * Deponun kökünü bulur; bulamazsa `null`.
 *
 * Yukarı doğru yürünüyor, çünkü derleme deponun İÇİNDE ama kökünde olmayan
 * bir dizinde de çalışabiliyor: yayın kopyası `<kök>/node_modules/.yayin-derleme`
 * altında ve orada `.git` yok. Oradan yukarı iki adım kökü buluyor.
 *
 * İki başlangıç noktası deneniyor. Çalışma dizini olağan derlemede proje kökü,
 * yayın derlemesinde kopyanın kökü. Modülün kendi yolu ise yedek: Astro
 * sunucu kodunu paketleyip başka bir klasörden çalıştırabiliyor ve o durumda
 * çalışma dizini tek başına yeterli olmayabilir.
 */
function depoKokunuBul(): string | null {
	const baslangiclar = [process.cwd(), dirname(fileURLToPath(import.meta.url))];

	for (const baslangic of baslangiclar) {
		let dizin = resolve(baslangic);
		for (;;) {
			// Worktree'de `.git` bir DOSYA, ana kopyada klasör. `existsSync` ikisini
			// de görüyor; `statSync(...).isDirectory()` worktree'leri kaçırırdı.
			if (existsSync(join(dizin, '.git'))) return dizin;
			const ust = dirname(dizin);
			if (ust === dizin) break;
			dizin = ust;
		}
	}

	return null;
}

function depoKoku(): string | null {
	if (kokOnbellek === undefined) kokOnbellek = depoKokunuBul();
	return kokOnbellek;
}

/**
 * git komutu çalıştırır; hiçbir koşulda fırlatmaz.
 *
 * Başarısızlığın onlarca sebebi olabilir (git kurulu değil, depo yok, tek
 * commit yok) ve hiçbiri siteyi derlenemez yapmamalı. Çağıran taraf `null`
 * değerini "bu bilgi bu derlemede yok" diye okuyor.
 */
function git(argumanlar: string[]): string | null {
	const kok = depoKoku();
	if (!kok) return null;

	try {
		return execFileSync('git', argumanlar, {
			cwd: kok,
			encoding: 'utf8',
			// stderr yutuluyor: git'in uyarıları derleme çıktısına karışmasın.
			// Gerçek hata zaten istisna olarak geliyor.
			stdio: ['ignore', 'pipe', 'ignore'],
			maxBuffer: 16 * 1024 * 1024,
			windowsHide: true,
		});
	} catch {
		return null;
	}
}

let surumOnbellek: Surum | null | undefined;

/**
 * Yayındaki sürüm. Derleme başına bir kez okunuyor: altbilgi her sayfada
 * çiziliyor ve sayfa başına bir `git` süreci başlatmanın karşılığı yok.
 */
export function surumBul(): Surum | null {
	if (surumOnbellek !== undefined) return surumOnbellek;

	const cikti = git(['log', '-1', '--format=%h%x1f%cs']);
	const [kimlik, tarih] = (cikti ?? '').trim().split(ALAN_AYIRACI);
	surumOnbellek = kimlik && tarih ? { kimlik, tarih } : null;

	return surumOnbellek;
}

/**
 * Commit başlığının GÖRÜNEN hâli: uzun tire (—) taşımayan sürümü.
 *
 * NEDEN GÖRÜNTÜLEME KATMANINDA, NEDEN GİT GEÇMİŞİNDE DEĞİL
 *
 * Sitenin yazım kuralı net: görünen hiçbir metinde uzun tire yok. Ama bu
 * listenin kaynağı commit başlıkları; onlar bir kez yazıldı, gönderildi ve
 * başka kopyalara gitti. Geçmişi yeniden yazmak tek bir noktalama işareti
 * için her commit kimliğini değiştirirdi: altbilgideki sürüm kimliği, bu
 * sayfadaki kayıtlar ve klonlanmış her kopya birden geçersiz olurdu. Kaynak
 * olduğu gibi duruyor, kural basarken uygulanıyor.
 *
 * NEDEN KISA ÇİZGİ — NEDEN VİRGÜL, İKİ NOKTA YA DA SİLMEK DEĞİL
 *
 * Geçmişte uzun tirenin TEK geçişi şu başlıkta:
 *
 *     Sayfa başlıklarından "— Mustafa Eybek" eki kalktı
 *
 * Tire burada ara söz ayıracı ya da açıklama girişi değil; tırnağın içinde,
 * kaldırılan ekin kendisinin parçası. Yani cümle tirenin kendisinden söz
 * ediyor. Virgül ya da iki nokta koymak alıntıyı tahrif ederdi; büsbütün
 * silmek ise eki yanlış aktarırdı, çünkü kalkan ek "Mustafa Eybek" değil
 * tireli hâliydi. Kısa çizgi alıntıyı olduğu gibi taşıyor ve kuralı da
 * çiğnemiyor.
 *
 * Tırnak dışında, ara söz ya da açıklama konumunda bir geçiş bugün yok.
 * Olmayan bir cümle biçimi için şimdiden noktalama kuralı yazmak tahminde
 * bulunmak olurdu; ilk gerçek örnek çıktığında bu fonksiyon o örneğe
 * bakılarak genişletilir.
 */
export function gorunenBaslik(baslik: string): string {
	return baslik.replaceAll('—', '-');
}

let gunlukOnbellek: DegisiklikGunu[] | undefined;

/**
 * Sitenin görünen yüzünü değiştiren commit'ler, yeniden eskiye, güne göre
 * gruplanmış. git okunamazsa boş liste döner; sayfa bunu kendi anlatıyor.
 */
export function siteGunlugu(): DegisiklikGunu[] {
	if (gunlukOnbellek !== undefined) return gunlukOnbellek;

	/*
	  `--no-merges`: birleştirme commit'lerinin başlığı ("Merge branch
	  'worktree-…'") dal adından ibaret, ziyaretçiye hiçbir şey anlatmıyor.
	  Getirdikleri değişiklikler zaten asıl commit'leriyle listede.

	  `--name-status`: hem dokunulan yollar hem de her yolun durumu (A/M/D)
	  tek geçişte geliyor. Yalnızca `--name-only` alınsaydı "yeni yazı"
	  ayırt edilemez, ikinci bir git çağrısı gerekirdi.
	*/
	const cikti = git(['log', '--no-merges', '--format=%x1e%h%x1f%cs%x1f%s', '--name-status']);

	if (!cikti) {
		gunlukOnbellek = [];
		return gunlukOnbellek;
	}

	const gunler = new Map<string, Degisiklik[]>();

	for (const blok of cikti.split(KAYIT_AYIRACI)) {
		const satirlar = blok.split('\n').filter((satir) => satir.trim() !== '');
		if (satirlar.length === 0) continue;

		const [kimlik, tarih, ...baslikParcalari] = satirlar[0].split(ALAN_AYIRACI);
		// Başlıkta ayıraç geçme ihtimali yok ama geçerse başlık kesilmesin diye
		// kalan parçalar geri birleştiriliyor.
		const baslik = gorunenBaslik(baslikParcalari.join(ALAN_AYIRACI).trim());
		if (!kimlik || !tarih || !baslik) continue;

		let siteyiEtkiliyor = false;
		const yeniYazilar: string[] = [];

		for (const satir of satirlar.slice(1)) {
			const parcalar = satir.split('\t');
			if (parcalar.length < 2) continue;
			const durum = parcalar[0];
			// Yeniden adlandırmada iki yol var; ziyaretçiyi ilgilendiren yenisi.
			const yol = parcalar[parcalar.length - 1];

			if (SITE_ONEKLERI.some((onek) => yol.startsWith(onek))) siteyiEtkiliyor = true;

			// Yalnızca "A" (eklendi). Taşınan bir yazı yeni yazı değil; onu da
			// yeni saysaydık klasör düzeni değiştiği gün bütün arşiv "eklendi"
			// diye yeniden listelenirdi.
			if (durum.startsWith('A')) {
				const eslesme = YAZI_DESENI.exec(yol);
				if (eslesme) yeniYazilar.push(eslesme[1]);
			}
		}

		if (!siteyiEtkiliyor) continue;

		const kayitlar = gunler.get(tarih) ?? [];
		kayitlar.push({ kimlik, baslik, yeniYazilar });
		gunler.set(tarih, kayitlar);
	}

	// `git log` zaten yeniden eskiye sıralı; Map ekleme sırasını koruduğu için
	// ayrıca sıralamaya gerek yok.
	gunlukOnbellek = [...gunler].map(([tarih, kayitlar]) => ({ tarih, kayitlar }));

	return gunlukOnbellek;
}

import { app, BrowserWindow, Menu, shell, dialog } from 'electron';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/*
  YÖNETİM PANELİ — MASAÜSTÜ KABUĞU

  Bu dosya site kodunun bir parçası değil; sahibinin bilgisayarında çalışan
  ayrı bir program. Dört paneli (`/keystatic`, `/istatistik`, `/kontrol` ve
  `/durum`) terminal açmadan kullanabilmek için var. Yaptığı tek şey
  `astro dev` sunucusunu arka planda çalıştırıp bir pencereyi ona yöneltmek.

  Sitenin "tarayıcıya sıfır JavaScript" kuralı burada geçerli değil: o kural
  ziyaretçiye giden yayın çıktısı için. Bu program hiçbir zaman yayınlanmıyor.

  Yayın derlemesinden tamamen ayrık duruyor: `masaustu/` klasörü `src/`
  dışında, `astro build` buraya hiç bakmıyor ve `astro.config.mjs`
  değişmiyor.
*/

/*
  `npm run panel` BETİĞİNDEKİ `--disable-backgrounding-occluded-windows` NE İŞE YARIYOR

  Onsuz panel bomboş bir pencere olarak açılabiliyor. Belirti şuydu: pencere,
  başlığı ve menüsü var, ama içerik alanı hiç çizilmiyor — panel değil,
  bir başlık ile biraz CSS'ten ibaret bekleme ekranı bile.

  Sayfanın kendisi sağlamdı. `executeJavaScript` ile bakıldığında DOM doluydu,
  React bağlanmıştı (`astro-island` üzerindeki `ssr` niteliği düşmüştü) ve
  gövde metni doğru uzunluktaydı. Yani yüklenme değil, EKRANA ÇİZME aşaması
  düşüyordu.

  Sebep: uygulama başka pencerelerin arkasında açıldığında Chromium pencereyi
  "üstü kapalı" sayıp kare üretmeyi durduruyor, sonradan öne getirilse bile
  geri açmıyordu. Şu gözlem ele verdi: pencere yalnızca `capturePage()`
  çağrılan çalıştırmalarda görünür oluyordu — çünkü o çağrı bir kare
  üretilmeye zorluyor. Pencereyi öne almak da, yenilemek de tek başına
  yetmiyordu; kare üretimini geri açan bu anahtar oldu.

  Anahtar neden burada değil de package.json'da: `app.commandLine.appendSwitch`
  DENENDİ, YETMEDİ. ESM giriş dosyası Electron'un ilgili süreçleri başlattıktan
  sonra yürüdüğü için o satır geç kalıyor. Komut satırından verilen anahtar
  Electron'dan önce işleniyor.

  Not: bir ara suç GPU'da sanılıp `--disable-gpu` eklenmişti; sorun onunla da
  sürdü, occlusion anahtarı eklenince GPU açıkken de düzeldi. Donanım
  hızlandırması AÇIK, kapatmaya gerek yok.
*/

const BURASI = dirname(fileURLToPath(import.meta.url));
const PROJE_KOKU = join(BURASI, '..');
const ASTRO_GIRISI = join(PROJE_KOKU, 'node_modules', 'astro', 'bin', 'astro.mjs');

// Astro'nun ve `npm run yazi`nin varsayılanı. Panelin kullandığı TEK port bu:
// dolu ve panel sunmuyorsa başka porta kaçmak yerine hata veriliyor, çünkü
// aynı klasörde ikinci bir sunucu içerik deposunu bozuyor.
const VARSAYILAN_PORT = 4321;

// Sunucunun ayağa kalkması için tanınan süre. İlk açılışta Vite bütün
// bağımlılıkları taradığı için 10 saniye yetmeyebiliyor; 90 saniye sonunda
// hâlâ yanıt yoksa gerçekten bir sorun var demektir.
const ZAMAN_ASIMI_MS = 90_000;
const YOKLAMA_ARALIGI_MS = 400;

/*
  "Sunucu hazır mı" yoklaması bu adrese yapılıyor.

  `/istatistik` ile denendi ve yanlış çıktı: o sayfa açılırken sunucuya SSH
  ile bağlanıp kayıtları çekiyor, yani yanıtı saniyeler sürebiliyor. Yoklama
  zaman aşımına uğrayıp "sunucu yok" diyor, oysa sunucu oradaydı.

  `/keystatic` bu iş için doğru rota: anında dönüyor ve yalnızca
  `astro.config.cms.mjs` yapılandırmasında var. Yani yoklama "herhangi bir
  sunucu var mı"yı değil, "PANELİ sunan sunucu var mı"yı ölçüyor — 4321'de
  `npm run dev` (yayın yapılandırması) çalışıyorsa buradan 200 gelmez.
*/
const YOKLAMA_YOLU = '/keystatic';

const PANELLER = {
	yazilar: { yol: '/keystatic', baslik: 'Yazılar' },
	istatistik: { yol: '/istatistik', baslik: 'İstatistik' },
	kontrol: { yol: '/kontrol', baslik: 'Yayın öncesi kontrol' },
	durum: { yol: '/durum', baslik: 'Site durumu' },
};

/** Astro dev sunucusunun alt süreci. Sunucuya bağlanıldıysa null kalır. */
let astroSureci = null;
/**
 * Astro'nun son çıktısı. Sunucu başlamadığında hata ekranında gösteriliyor:
 * "başlatılamadı" tek başına kullanıcıya hiçbir şey anlatmıyor, asıl cümle
 * Astro'nun kendi çıktısında oluyor. Örneğin Astro 7, proje için arka planda
 * zaten bir dev sunucusu kayıtlıysa yenisini başlatmayı reddedip
 * "Dev server already running… Stop: astro dev stop" yazıp çıkıyor — bunu
 * görmeyen kullanıcı ne yapacağını bilemez.
 */
let astroCiktisi = '';
/**
 * Sunucuyu biz mi başlattık? Kapanışta yalnızca kendi başlattığımızı
 * kapatıyoruz — kullanıcının elle açtığı sunucuyu öldürmek, paneli kapattı
 * diye terminalindeki işi elinden almak olurdu.
 */
let kendiBaslattik = false;
/** Panelin adresi; sunucu hazır olunca doluyor. */
let panelKoku = null;
let pencere = null;
let temizlendi = false;

/* ------------------------------------------------------------------ */
/* Port                                                                */
/* ------------------------------------------------------------------ */

/**
 * Bir adres 200 döndürüyor mu? `fetch` başarısız olduğunda (bağlantı reddi)
 * de `false` dönmeli; bu yüzden hata yutuluyor — yoklamanın normal hâli bu.
 *
 * Süre sınırı bilerek uzun. Kısa tutulduğunda (2 saniye) çalışan bir sunucu
 * "yok" sayılıyordu: Astro dev rotaları ilk istekte derliyor ve soğuk bir
 * `/keystatic` saniyeler sürebiliyor. Uzun sınırın bir bedeli de yok — porta
 * kimse bakmıyorsa bağlantı milisaniyeler içinde reddediliyor, beklenmiyor.
 */
async function yanitVeriyorMu(adres, sureMs = 15_000) {
	try {
		const yanit = await fetch(adres, {
			signal: AbortSignal.timeout(sureMs),
			redirect: 'manual',
		});
		return yanit.status === 200;
	} catch {
		return false;
	}
}

/**
 * Portu kimse dinlemiyor mu? Bağlanıp hemen bırakarak bakılıyor; "boş port"
 * için başka güvenilir bir ölçüm yok.
 */
function portBosMu(port) {
	return new Promise((cozumle) => {
		const deneme = createServer();
		deneme.once('error', () => cozumle(false));
		deneme.once('listening', () => deneme.close(() => cozumle(true)));
		deneme.listen(port, '127.0.0.1');
	});
}


/* ------------------------------------------------------------------ */
/* Sunucu                                                              */
/* ------------------------------------------------------------------ */

/**
 * PORT ÇAKIŞMASI STRATEJİSİ — tek sunucu, tek port.
 *
 * Önce 4321'de zaten bir panel çalışıyor mu diye bakılıyor; çalışıyorsa ona
 * BAĞLANILIYOR, yeni süreç başlatılmıyor. Sebebi: Keystatic `src/content/`
 * altındaki dosyaları doğrudan yazıyor. Kullanıcı `npm run yazi`yi elle
 * açtıysa niyeti zaten o sunucuyu kullanmak.
 *
 * Yoklamanın neden kök adresle değil `YOKLAMA_YOLU` ile yapıldığı orada yazılı.
 *
 * Port doluysa ama paneli sunmuyorsa BAŞKA BİR PORTA KAÇMIYORUZ, hata
 * veriyoruz. Eskiden boş port aranıp Astro orada başlatılıyordu ve bu veri
 * kaybettiriyordu: aynı proje klasöründe iki dev sunucusu, içerik deposunu
 * aynı geçici dosya adıyla (`.astro/data-store.json.tmp`) yazıyor. Biri
 * dosyayı yeniden adlandırıp tükettiğinde diğeri ENOENT alıp düşüyor; panelde
 * bu "Failed to fetch" olarak görünüyor ve yazılan makale diske hiç
 * yazılmıyor.
 *
 * Aynı sebeple `astro.config.cms.mjs` içinde `strictPort` açık: Astro da
 * kendiliğinden başka porta kaymıyor. İki taraf birden kapalı olmalı, yoksa
 * ikinci sunucu bir yolunu bulup başlıyor.
 */
async function sunucuyuHazirla(durumBildir) {
	const kok = `http://127.0.0.1:${VARSAYILAN_PORT}`;
	durumBildir('Çalışan bir panel aranıyor…');
	if (await yanitVeriyorMu(kok + YOKLAMA_YOLU)) {
		return kok;
	}

	/*
	  Panel yanıtı yok ama port da boş değil: orada paneli sunmayan bir şey
	  oturuyor. Bu, kapatılmamış bir `npm run dev` olabileceği gibi önceki
	  panel oturumundan kalmış ve artık yanıt vermeyen bir sunucu da olabilir.
	  İkisinde de doğru davranış durup söylemek — üstüne ikinci sunucu
	  başlatmak sessizce veri kaybettiriyor.
	*/
	if (!(await portBosMu(VARSAYILAN_PORT))) {
		throw new Error(
			`${VARSAYILAN_PORT} portu dolu ama paneli sunmuyor.\n\n` +
				'Orada başka bir sunucu çalışıyor olabilir (ör. kapatılmamış bir ' +
				'`npm run dev`) ya da önceki panel oturumundan kalmış ve artık ' +
				'yanıt vermeyen bir sunucu.\n\n' +
				'Yapılacak: o sunucuyu kapatın, sonra paneli yeniden açın. ' +
				'Terminalden `npx astro dev stop` işe yarar; görmüyorsa görev ' +
				'yöneticisinden `node.exe` sürecini kapatın.\n\n' +
				'Panel bu durumda ikinci bir sunucu BAŞLATMIYOR: aynı klasörde iki ' +
				'sunucu çalışırsa içerik deposu bozuluyor ve yazdığınız makale ' +
				'kaydedilmiyor.',
		);
	}

	durumBildir('Astro sunucusu başlatılıyor…');

	kendiBaslattik = true;

	/*
	  Astro `node` ile doğrudan çalıştırılıyor, `npm`/`astro.cmd` ile değil.
	  Kabuk sarmalayıcısı araya bir süreç daha koyar ve kapanışta asıl node
	  süreci öksüz kalır.

	  Electron'un kendi `process.execPath`i electron.exe olduğu için
	  kullanılmıyor; `npm run yazi`nin çalıştığı node sürümüyle aynı şeyi
	  çalıştırmak, panelin terminalde davrandığı gibi davranmasını sağlıyor.
	*/
	astroSureci = spawn(
		'node',
		[
			ASTRO_GIRISI,
			'dev',
			'--config',
			'astro.config.cms.mjs',
			'--port',
			String(VARSAYILAN_PORT),
		],
		{
			cwd: PROJE_KOKU,
			stdio: ['ignore', 'pipe', 'pipe'],
			// Kabuk yok: hem sarmalayıcı süreç oluşmuyor hem de argümanlar
			// kabuk ayrıştırmasından geçmiyor.
			shell: false,
			windowsHide: true,
		},
	);

	// Çıktı hem terminale geçiriliyor hem de biriktiriliyor. Son 4000 karakter
	// tutuluyor: dev sunucusu saatlerce çalışıp her isteği yazabiliyor, hepsini
	// bellekte tutmanın anlamı yok — hata anında işe yarayan son satırlar.
	const yaz = (veri, akis) => {
		akis.write(veri);
		astroCiktisi = (astroCiktisi + veri).slice(-4000);
	};
	astroSureci.stdout.on('data', (veri) => yaz(veri, process.stdout));
	astroSureci.stderr.on('data', (veri) => yaz(veri, process.stderr));

	return kok;
}

/**
 * Sunucu gerçekten yanıt verene kadar bekle. Pencere hemen yönlendirilirse
 * Chromium'un İngilizce "bağlanılamadı" ekranı çıkıyor; kullanıcı da sorunun
 * ne olduğunu anlamıyor.
 */
async function sunucuyuBekle(kok) {
	const bitis = Date.now() + ZAMAN_ASIMI_MS;
	while (Date.now() < bitis) {
		// Önce yoklama, sonra süreç denetimi. Ters sırada, arka plana geçen
		// Astro'da hazır sunucuyu "kapanmış" sanıp hata veriyorduk.
		if (await yanitVeriyorMu(kok + YOKLAMA_YOLU)) return;
		/*
		  Yalnızca SIFIRDAN FARKLI çıkış ölümcül sayılıyor. Astro arka plana
		  geçtiğinde başlattığımız süreç işi devredip 0 ile çıkıyor — sunucu
		  ayakta olduğu hâlde. Sıfırla çıkmayı hata saymak o durumda paneli
		  boş yere kapatıyordu. Gerçekten başlamayan bir sunucuyu zaten
		  zaman aşımı yakalıyor.
		*/
		if (astroSureci && astroSureci.exitCode !== null && astroSureci.exitCode !== 0) {
			throw new Error(
				`Astro sunucusu başlamadan kapandı (çıkış kodu ${astroSureci.exitCode}).\n\n` +
					(astroCiktisi.trim() || 'Astro hiçbir çıktı vermedi.'),
			);
		}
		await new Promise((c) => setTimeout(c, YOKLAMA_ARALIGI_MS));
	}
	throw new Error(
		`Sunucu ${ZAMAN_ASIMI_MS / 1000} saniye içinde ${kok} adresinden yanıt vermedi.` +
			(astroCiktisi.trim() ? `\n\nAstro'nun son çıktısı:\n${astroCiktisi.trim()}` : ''),
	);
}

/* ------------------------------------------------------------------ */
/* Temizlik                                                            */
/* ------------------------------------------------------------------ */

/**
 * ALT SÜRECİ ÖLDÜR — iki ayrı yoldan, çünkü Astro iki farklı şekilde çalışıyor.
 *
 * (1) ÖN PLANDA çalıştığında sunucu bizim doğrudan çocuğumuz. Burada
 *     `child.kill()` YETMİYOR: Windows'ta yalnızca tutulan süreci
 *     sonlandırıyor, Vite'ın altında açtığı işçi süreçler ayakta kalıp portu
 *     tutmaya devam ediyor. `taskkill /T` ağacın tamamını, `/F` de kibarca
 *     sormadan kapatıyor.
 *
 * (2) ARKA PLANA GEÇTİĞİNDE sunucu bizim çocuğumuz DEĞİL. Astro, ortamı bir
 *     yapay zekâ ajanı ortamı olarak tanırsa (`am-i-vibing` paketiyle) dev
 *     sunucusunu kendiliğinden arka plana atıyor: başlattığımız süreç işi
 *     devredip çıkıyor, sunucu bambaşka bir PID'de kalıyor. Ölçtük: panel
 *     kapatıldıktan sonra sunucu ayakta kalıp 4321'i tutmaya devam etti.
 *     Süreç ağacını öldürmek burada işe yaramıyor, çünkü artık ağacımızda
 *     değil. Bunun için Astro'nun kendi komutu var — kilit dosyasından
 *     sunucuyu bulup kapatıyor ve dosyayı da temizliyor. Kilit dosyası
 *     ortada kalsaydı kullanıcının sonraki `npm run yazi` çağrısı
 *     şaşırırdı.
 *
 * İkisi de çağrılıyor: hangisinin geçerli olduğunu bilmeye çalışmak yerine
 * ikisini de denemek hem daha kısa hem daha güvenli. Yanlış olan zaten
 * bir şey bulamayıp sessizce dönüyor.
 *
 * `spawnSync` bilinçli: `before-quit` içinde çalışıyor ve Electron kapanmadan
 * önce temizliğin BİTMİŞ olması gerekiyor. Eşzamansız olsaydı uygulama
 * kapanır, öldürme işlemi yarım kalırdı.
 */
function temizle() {
	if (temizlendi) return;
	temizlendi = true;
	if (!kendiBaslattik) return;

	if (astroSureci && astroSureci.exitCode === null) {
		spawnSync('taskkill', ['/pid', String(astroSureci.pid), '/T', '/F'], {
			stdio: 'ignore',
			windowsHide: true,
		});
	}
	astroSureci = null;

	spawnSync('node', [ASTRO_GIRISI, 'dev', 'stop'], {
		cwd: PROJE_KOKU,
		stdio: 'ignore',
		windowsHide: true,
	});
}

/* ------------------------------------------------------------------ */
/* Pencere boyutu                                                      */
/* ------------------------------------------------------------------ */

// Kullanıcı verisi klasöründe; depoya yazmak yanlış olurdu — bu bir tercih,
// kaynak kodu değil.
const boyutDosyasi = () => join(app.getPath('userData'), 'pencere-boyutu.json');

function boyutOku() {
	try {
		const kayit = JSON.parse(readFileSync(boyutDosyasi(), 'utf8'));
		if (typeof kayit.genislik === 'number' && typeof kayit.yukseklik === 'number') {
			return kayit;
		}
	} catch {
		// İlk açılış ya da bozuk dosya: varsayılana düşmek yeterli.
	}
	return { genislik: 1280, yukseklik: 860 };
}

function boyutYaz() {
	if (!pencere || pencere.isDestroyed()) return;
	try {
		// `getNormalBounds`, pencere o an büyütülmüş ya da tam ekransa bile
		// eski normal ölçüyü veriyor; `getBounds` olsaydı ekran boyutunu
		// kaydedip bir daha küçültmek imkânsızlaşırdı.
		const { width, height } = pencere.getNormalBounds();
		writeFileSync(
			boyutDosyasi(),
			JSON.stringify({ genislik: width, yukseklik: height }),
			'utf8',
		);
	} catch {
		// Boyutu kaydedememek uygulamayı kapatmayı engellememeli.
	}
}

/* ------------------------------------------------------------------ */
/* Menü                                                                */
/* ------------------------------------------------------------------ */

function paneliAc(anahtar) {
	const panel = PANELLER[anahtar];
	if (!pencere || !panel || !panelKoku) return;
	pencere.setTitle(`Yönetim paneli — ${panel.baslik}`);
	pencere.loadURL(panelKoku + panel.yol);
}

/**
 * Menü tamamen elle kuruluyor. Electron kendi varsayılan menüsünü
 * İngilizce basıyor ("File", "Edit", "View"); burada onun görünmemesi için
 * `setApplicationMenu` ile üzerine yazılıyor. `role` kullanılan yerlerde
 * `label` de elle veriliyor, yoksa rolün İngilizce adı çıkıyor.
 */
function menuyuKur() {
	const menu = Menu.buildFromTemplate([
		{
			label: 'Panel',
			submenu: [
				{
					label: 'Yazılar',
					accelerator: 'CmdOrCtrl+1',
					click: () => paneliAc('yazilar'),
				},
				{
					label: 'İstatistik',
					accelerator: 'CmdOrCtrl+2',
					click: () => paneliAc('istatistik'),
				},
				{
					label: 'Yayın öncesi kontrol',
					accelerator: 'CmdOrCtrl+3',
					click: () => paneliAc('kontrol'),
				},
				{
					label: 'Site durumu',
					accelerator: 'CmdOrCtrl+4',
					click: () => paneliAc('durum'),
				},
				{ type: 'separator' },
				{ label: 'Çıkış', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
			],
		},
		{
			label: 'Görünüm',
			submenu: [
				{ label: 'Yenile', accelerator: 'CmdOrCtrl+R', role: 'reload' },
				{
					label: 'Önbelleği yok sayarak yenile',
					accelerator: 'CmdOrCtrl+Shift+R',
					role: 'forceReload',
				},
				{ type: 'separator' },
				{ label: 'Yakınlaştır', role: 'zoomIn' },
				{ label: 'Uzaklaştır', role: 'zoomOut' },
				{ label: 'Yakınlaştırmayı sıfırla', role: 'resetZoom' },
				{ type: 'separator' },
				{ label: 'Tam ekran', role: 'togglefullscreen' },
				{
					label: 'Geliştirici araçları',
					accelerator: 'F12',
					role: 'toggleDevTools',
				},
			],
		},
	]);
	Menu.setApplicationMenu(menu);
}

/* ------------------------------------------------------------------ */
/* Pencere                                                             */
/* ------------------------------------------------------------------ */

function pencereyiKur() {
	const { genislik, yukseklik } = boyutOku();
	pencere = new BrowserWindow({
		width: genislik,
		height: yukseklik,
		minWidth: 900,
		minHeight: 600,
		title: 'Yönetim paneli',
		/*
		  Pencere ilk boyanana kadar bu renkte duruyor; sayfa yüklenirken beyaz
		  bir kare parlamasın diye.

		  Eskiden sistemin temasına bakılıyordu (`shouldUseDarkColors`). Artık
		  sabit koyu: panelin dört sayfası da koyu — üçü kendi stiliyle,
		  Keystatic de `masaustu/onyukleme.cjs` sayesinde. Sisteme bakmak açık
		  temalı bir makinede pencereyi açık renk boyar, sayfa koyu gelir ve
		  tam olarak kaçındığımız parlama çıkardı. Renk Keystatic'in koyu
		  ölçeğinden alındı (`--kui-color-scale-slate2`), böylece pencere
		  zemini ile sayfa zemini arasında geçiş görünmüyor.

		  `show: false` + `ready-to-show` kalıbı bilinçli olarak KULLANILMIYOR:
		  `loadFile` ile yerel bir dosya yüklendiğinde o olay ateşlenmeyip
		  pencere görünmez kalıyordu — başlığı ve tutamacı olan ama ekranda
		  hiç çizilmeyen bir pencere. Pencere baştan görünür açılıyor.
		*/
		backgroundColor: '#252525',
		webPreferences: {
			/*
			  Koyu tema ve Türkçeleştirme burada: preload sayfanın kendi
			  JavaScript'inden ÖNCE çalışan tek yer. Gerekçesi o dosyanın
			  başında yazılı.
			*/
			preload: join(BURASI, 'onyukleme.cjs'),
			/*
			  Uygulama yalnızca 127.0.0.1 yüklüyor, yani teoride bu ayarlar
			  olmadan da "güvenli". Yine de açık bırakılıyorlar çünkü yüklenen
			  sayfa Keystatic — düzinelerce bağımlılığı olan bir React
			  uygulaması. Bu kapılar kapalıyken oradaki herhangi bir kod
			  `require('fs')` ile diske uzanamıyor; açık bırakmanın hiçbir
			  karşılığı yokken riski var.
			*/
			nodeIntegration: false,
			contextIsolation: true,
		},
	});

	/*
	  Sayfanın hataları terminale düşsün. Panel boş açıldığında Electron
	  penceresi sessiz kalıyor; hatayı görmek için her seferinde geliştirici
	  araçlarını açmak gerekiyordu. Uyarılar elenip yalnızca hata seviyesi
	  yazılıyor, yoksa Vite'ın olağan gürültüsü asıl satırı boğuyor.
	*/
	// Tek parametreli olay nesnesi kullanılıyor; eski (olay, seviye, mesaj, …)
	// imzası Electron'da artık kullanımdan kaldırılmış ve uyarı basıyor.
	pencere.webContents.on('console-message', (olay) => {
		if (olay?.level !== 'error') return;
		console.error('[sayfa]', olay.message, `(${olay.sourceId}:${olay.lineNumber})`);
	});
	pencere.webContents.on('did-fail-load', (olay, kod, aciklama, adres) => {
		// -3 (ABORTED) bir hata değil: sayfa değiştirilirken önceki yükleme
		// iptal ediliyor ve panel arası geçişte her defasında düşüyor.
		if (kod === -3) return;
		console.error('[yüklenemedi]', kod, aciklama, adres);
	});

	pencere.on('close', boyutYaz);
	pencere.on('closed', () => {
		pencere = null;
	});

	/*
	  DIŞ BAĞLANTILAR PENCEREDEN ÇIKMASIN.

	  Panelde GitHub gibi dış bağlantılar var. Tıklanınca uygulama penceresi
	  o siteye gidiyor ve geri dönüş yolu yok — uygulamanın menüsü duruyor
	  ama içerik artık panel değil. İki yol da kapatılıyor: yeni pencere
	  açmak (`setWindowOpenHandler`) ve aynı pencerede gezinmek
	  (`will-navigate`). Her ikisi de sistem tarayıcısına yönlendiriliyor.
	*/
	pencere.webContents.setWindowOpenHandler(({ url }) => {
		if (/^https?:/.test(url)) shell.openExternal(url);
		return { action: 'deny' };
	});

	pencere.webContents.on('will-navigate', (olay, url) => {
		// Panelin kendi adresi içinde gezinmek serbest: Keystatic kenar
		// çubuğu böyle çalışıyor. Dışarısı sistem tarayıcısına gidiyor.
		if (panelKoku && url.startsWith(panelKoku)) return;
		// Yerel "başlatılıyor/hata" ekranları file:// adresinde; onlar da
		// gezinmiyor zaten ama dışarıya da açılmamalı.
		if (url.startsWith('file://')) return;
		olay.preventDefault();
		if (/^https?:/.test(url)) shell.openExternal(url);
	});
}

/* ------------------------------------------------------------------ */
/* Akış                                                                */
/* ------------------------------------------------------------------ */

function durumEkraniniGoster(mesaj) {
	if (!pencere || pencere.isDestroyed()) return;
	pencere.loadFile(join(BURASI, 'baslatiliyor.html'), {
		hash: encodeURIComponent(mesaj),
	});
}

function hataEkraniniGoster(mesaj) {
	if (!pencere || pencere.isDestroyed()) return;
	pencere.loadFile(join(BURASI, 'hata.html'), {
		hash: encodeURIComponent(mesaj),
	});
}

async function baslat() {
	menuyuKur();
	pencereyiKur();
	durumEkraniniGoster('Hazırlanıyor…');

	try {
		const kok = await sunucuyuHazirla(durumEkraniniGoster);
		durumEkraniniGoster(
			kendiBaslattik
				? 'Sunucunun hazır olması bekleniyor…'
				: 'Çalışan panele bağlanılıyor…',
		);
		await sunucuyuBekle(kok);
		panelKoku = kok;
		paneliAc('yazilar');
	} catch (hata) {
		// Ekrandaki metin kullanıcı için; yığın izi terminale, sorunu arayan
		// için. Yalnızca birini bırakmak her seferinde diğerini aratıyordu.
		console.error('[panel]', hata?.stack ?? hata);
		hataEkraniniGoster(hata?.message ?? String(hata));
	}
}

// Aynı anda iki kopya açılırsa ikisi de sunucu başlatmaya çalışır ve
// birbirlerinin portunu karıştırır. İkinci kopya açılmıyor, var olan pencere
// öne getiriliyor.
if (!app.requestSingleInstanceLock()) {
	app.quit();
} else {
	app.on('second-instance', () => {
		if (!pencere) return;
		if (pencere.isMinimized()) pencere.restore();
		pencere.focus();
	});

	app.whenReady().then(baslat);

	// Üç kapanış yolunun üçünde de alt süreç öldürülmeli:
	// pencereyi kapatmak, menüden çıkmak, terminalden Ctrl+C.
	app.on('window-all-closed', () => app.quit());
	app.on('before-quit', temizle);
	for (const sinyal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
		process.on(sinyal, () => {
			temizle();
			app.quit();
		});
	}
	// Ana süreçte yakalanmamış bir hata çıkarsa da sunucu arkada kalmasın;
	// kullanıcıya da ne olduğu söylensin.
	process.on('uncaughtException', (hata) => {
		temizle();
		dialog.showErrorBox('Panel hatası', hata?.stack ?? String(hata));
		app.exit(1);
	});
}

/*
  YÖNETİM UYGULAMASI: ELECTRON ANA SÜRECİ

  Bu, sahibin (Mustafa) kullandığı masaüstü programı. `masaustu/` klasöründeki
  içerik panelinden AYRI bir uygulama: o Astro sunucusuna bakan bir kabuk,
  bu ise kendi yerel veritabanına bakan bir defter.

  İnternetle hiçbir bağı yok. Hiçbir adres yüklemiyor, hiçbir istek atmıyor.
  Yüklediği tek sayfa `arayuz/index.html`, o da diskten geliyor.
  (PANEL-TASARIMI.md §1: yönetici arayüzü internette yok.)

  Renderer'a Node verilmiyor. Bütün veri işi bu süreçte, arayüz yalnızca
  `onyukleme.cjs` üzerinden açılan dar bir IPC yüzeyini çağırıyor.
*/

import { app, BrowserWindow, Menu, shell, dialog, ipcMain, safeStorage, clipboard } from 'electron';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { yerelAc } from '../veri/db.mjs';
import { ayarlariOku, esitle } from '../veri/esitleme-ssh.mjs';
import { akisBaslangici, akisBaslat } from '../veri/talep-akisi.mjs';
import { canliAkisYoneticisiKur } from './canli-akis.mjs';
import { depoKur } from './depo.mjs';
import {
	buAy,
	isGirdisiHazirla,
	musteriGirdisiHazirla,
	odemeGirdisiHazirla,
	revizeGirdisiHazirla,
} from './is-mantigi.mjs';
import { esitlemeYoneticisiKur } from './otomatik-esitleme.mjs';

const gerek = createRequire(import.meta.url);
/** QR üretimi ana süreçte yapılıyor: arayüze kütüphane indirmek yerine
 *  hazır bir `data:` adresi gidiyor, yani renderer'da yeni bağımlılık yok. */
const QRCode = gerek('qrcode');

const BURASI = dirname(fileURLToPath(import.meta.url));

/*
  Kendi kullanıcı verisi klasörü. İsim verilmezse Electron package.json'daki
  "web" adını kullanır ve içerik paneliyle AYNI klasöre yazardı; iki ayrı
  programın pencere boyutu ve veritabanı dosyası birbirine karışırdı.
  `setName` uygulama hazır olmadan ÖNCE çağrılmalı, yoksa yol çoktan
  hesaplanmış olur.
*/
app.setName('mustafa-yonetim');

let pencere = null;
let db = null;
let depo = null;
/**
 * Eşitlemenin tek sahibi. Elle düğme, davet üretimi, değişiklik tetiği ve
 * düzenli dinleme hepsi buradan geçiyor; kilit, toplama ve geri çekilme
 * `otomatik-esitleme.mjs` içinde.
 */
let esitlemeYoneticisi = null;
/**
 * Destek talebi hareketlerinin canlı akışı. Eşitlemenin YERİNE geçmiyor,
 * yanında duruyor: eşitleme iki yönlü ve dayanıklı, akış tek yönlü ve
 * hızlı. Akış koparsa yazışma üç dakikalık yoldan yine geliyor.
 */
let canliAkis = null;

/* ------------------------------------------------------------------ */
/* Kasa: Electron safeStorage sarmalayıcısı                            */
/* ------------------------------------------------------------------ */

/*
  TC kimlik ve vergi numarası veritabanına DÜZ METİN YAZILMIYOR. İşletim
  sisteminin anahtarlığıyla (Windows'ta DPAPI) şifrelenip BLOB olarak
  duruyor. Veritabanı dosyası kopyalansa bile o iki alan başka makinede,
  başka kullanıcı hesabında açılmıyor.

  Anahtarlık açılamıyorsa `kullanilabilir()` false döner; `depo.mjs` o
  durumda alanı yazmayı reddediyor ve kullanıcıya uyarı gidiyor. Sessizce
  düz metin yazmak, "şifreli" sanılan bir alanı açıkta bırakmak olurdu.
*/
const kasa = {
	kullanilabilir: () => {
		try {
			return safeStorage.isEncryptionAvailable();
		} catch {
			return false;
		}
	},
	sifrele: (metin) => safeStorage.encryptString(metin),
	coz: (baytlar) => safeStorage.decryptString(Buffer.from(baytlar)),
};

/* ------------------------------------------------------------------ */
/* Pencere boyutu                                                      */
/* ------------------------------------------------------------------ */

const boyutDosyasi = () => join(app.getPath('userData'), 'pencere-boyutu.json');

function boyutOku() {
	try {
		const kayit = JSON.parse(readFileSync(boyutDosyasi(), 'utf8'));
		if (typeof kayit.genislik === 'number' && typeof kayit.yukseklik === 'number') return kayit;
	} catch {
		// İlk açılış ya da bozuk dosya: varsayılan yeterli.
	}
	return { genislik: 1340, yukseklik: 880 };
}

function boyutYaz() {
	if (!pencere || pencere.isDestroyed()) return;
	try {
		const { width, height } = pencere.getNormalBounds();
		writeFileSync(boyutDosyasi(), JSON.stringify({ genislik: width, yukseklik: height }), 'utf8');
	} catch {
		// Boyutu kaydedememek kapanmayı engellememeli.
	}
}

/* ------------------------------------------------------------------ */
/* IPC                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Her kanal aynı kalıpta cevap veriyor: `{ tamam, veri }` ya da
 * `{ tamam: false, hata }`. Böylece arayüz tarafında try/catch dağılmıyor
 * ve ana süreçte oluşan bir hata pencereyi öldürmüyor.
 *
 * Yığın izi arayüze GİTMİYOR, yalnızca terminale yazılıyor: kullanıcıya
 * gösterilecek şey cümle, dosya yolu değil.
 */
function kanal(ad, islev) {
	ipcMain.handle(ad, async (olay, ...argumanlar) => {
		// Gelen isteğin gerçekten bizim penceremizden geldiğini doğrula.
		if (!pencere || olay.sender !== pencere.webContents) {
			return { tamam: false, hata: 'Tanınmayan istek kaynağı.' };
		}
		try {
			return { tamam: true, veri: await islev(...argumanlar) };
		} catch (hata) {
			console.error(`[yonetim] ${ad}:`, hata?.stack ?? hata);
			return { tamam: false, hata: hata?.message ?? String(hata) };
		}
	});
}

function kanallariKur() {
	kanal('durum:oku', () => ({
		sifreleme: depo.sifrelemeVarMi(),
		buAy: buAy(),
		veritabani: join(app.getPath('userData'), 'yerel.db'),
	}));

	/*
	  Formdan gelen ham metin burada kayda çevriliyor. Arayüz de aynı işlevi
	  çağırıyor ama son söz burada: arayüzün doğrulamasına güvenmek, kapıyı
	  içeriden kilitleyip anahtarı dışarıda bırakmak olurdu.
	*/
	function hazirla(hazirlayici, form) {
		const { kayit, hatalar } = hazirlayici(form ?? {});
		if (hatalar.length) throw new Error(hatalar.join(' '));
		return kayit;
	}

	kanal('musteri:liste', (secenek) => depo.musteriListesi(secenek ?? {}));
	kanal('musteri:getir', (id) => depo.musteriGetir(String(id)));
	kanal('musteri:kaydet', (form) => depo.musteriKaydet(hazirla(musteriGirdisiHazirla, form)));
	kanal('musteri:durum', (id, durum) => depo.musteriDurumu(String(id), String(durum)));

	kanal('is:liste', (secenek) => depo.isListesi(secenek ?? {}));
	kanal('is:getir', (id) => depo.isGetir(String(id)));
	kanal('is:kaydet', (form) => depo.isKaydet(hazirla(isGirdisiHazirla, form)));
	kanal('is:sil', (id) => depo.isSil(String(id)));

	kanal('odeme:kaydet', (form) => depo.odemeKaydet(hazirla(odemeGirdisiHazirla, form)));
	kanal('odeme:sil', (id) => depo.odemeSil(String(id)));
	kanal('odeme:liste', (secenek) => depo.odemeListesi(secenek ?? {}));

	kanal('revize:kaydet', (form) => depo.revizeKaydet(hazirla(revizeGirdisiHazirla, form)));
	kanal('revize:sil', (id) => depo.revizeSil(String(id)));
	kanal('revize:liste', (secenek) => depo.revizeListesi(secenek ?? {}));

	kanal('istatistik:ay', (ay) => depo.istatistik(String(ay || buAy())));
	kanal('istatistik:aylar', () => depo.aylar());

	kanal('kuyruk:bekleyen', () => depo.kuyrukBekleyenler());

	kanal('esitleme:ozet', () => ({
		...depo.esitlemeOzeti(),
		otomatik: esitlemeYoneticisi.durum(),
	}));
	kanal('esitleme:ayar-yaz', (form) => {
		const sonuc = depo.esitlemeAyariYaz(form ?? {});
		// Ayarlar tamamlandıysa otomatik eşitleme beklemeden uyanıyor.
		esitlemeYoneticisi.ayarlariYenile();
		// Canlı akış da: adres ya da anahtar değiştiyse açık bağlantı yanlış
		// yere bakıyor, eksikten tama döndüyse akış burada başlıyor.
		canliAkis?.ayarlariYenile();
		return sonuc;
	});
	kanal('esitleme:otomatik-yaz', (form) => {
		const sonuc = depo.otomatikAyariYaz(form ?? {});
		esitlemeYoneticisi.ayarlariYenile();
		return sonuc;
	});
	kanal('esitleme:durum', () => esitlemeDurumu());

	/*
	  Eşitleme uzun sürebilir ve ağ işi yapan tek kanal bu.

	  Hata YUTULMUYOR: `kanal` sarmalayıcısı hatanın metnini olduğu gibi
	  arayüze veriyor. SSH'ın söyledikleri (anahtar bulunamadı, sunucuya
	  ulaşılamadı, BatchMode parola istedi) kullanıcının görmesi gereken
	  şeyler; "eşitlenemedi" demek onu karanlıkta bırakmak olurdu.

	  İkinci bir çalıştırma artık REDDEDİLMİYOR, sıraya giriyor. Eskiden
	  "Eşitleme zaten sürüyor." hatası dönüyordu; arkada düzenli bir eşitleme
	  varken düğmeye basan kullanıcının karşısına çıkacak bu hata, kendi
	  isteğinin kaybolduğu izlenimini verirdi. İstek şimdi süren koşunun
	  arkasına sıralanıyor ve sonucu bu cevapta dönüyor. Aynı kuyruğun iki kez
	  gönderilmesi hâlâ imkânsız: koşular sırayla çalışıyor.
	*/
	kanal('esitleme:calistir', () => esitlemeYoneticisi.elleCalistir());

	kanal('talep:liste', (secenek) => depo.talepListesi(secenek ?? {}));
	kanal('talep:getir', (id) => depo.talepGetir(String(id)));
	kanal('talep:yanitla', (talepId, metin) =>
		depo.talepYanitla(String(talepId), String(metin ?? '')),
	);
	kanal('talep:durum', (talepId, durum) => depo.talepDurumu(String(talepId), String(durum)));
	/*
	  Akışın durumu SORULABİLİYOR da itiliyor da. Sorma yolu yalnızca açılış
	  için: pencere yüklenmeden önce olan bir durum değişikliği kaybolur,
	  arayüz açılırken bir kez sorup kendini hizalıyor.
	*/
	kanal('talep:akis-durum', () => (canliAkis ? canliAkis.durum() : null));

	/*
	  Davet üretimi. Anahtarın metni ve QR'ı YALNIZCA bu cevapta var;
	  veritabanına yazılan tek şey karması (depo.davetUret içinde kuyruğa).
	  Cevap arayüzde bir kez gösteriliyor, ekran kapanınca kayboluyor.
	*/
	kanal('davet:uret', async (musteriId) => {
		const davet = depo.davetUret(String(musteriId));
		const qr = await QRCode.toDataURL(davet.metin, {
			errorCorrectionLevel: 'M',
			margin: 2,
			width: 320,
			// Koyu arayüzde okunaklı olsun diye ters çevrilmedi: QR okuyucular
			// koyu modül / açık zemin bekliyor, tersi bazı telefonlarda okunmuyor.
			color: { dark: '#111111', light: '#ffffff' },
		});

		/*
		  ANAHTAR ÜRETİLİR ÜRETİLMEZ EŞİTLENİYOR.

		  Elle eşitleme adımı unutulabilir bir adımdı ve unutulunca ortaya
		  anlaşılması zor bir durum çıkıyor: anahtar sahibin elinde duruyor,
		  müşteri onu giriyor ve "anahtar kabul edilmedi" hatası alıyor.
		  Sebebi anahtarın yanlış olması değil, sunucuya hiç ulaşmamış olması.

		  Eşitleme BAŞARISIZ OLSA BİLE anahtar yine dönüyor: metni ve QR'ı bu
		  cevapta, ekranda bir kez gösteriliyor. Hata yutulmuyor, `esitleme`
		  alanında geri veriliyor ve arayüz onu gösteriyor. Anahtarı
		  kaybettirip sessizce başarısız olmak, iki kez denemekten kötüdür:
		  kuyruk zaten duruyor, sonraki eşitlemede gidecek.
		*/
		let esitlemeSonucu = null;
		try {
			const sonuc = await esitlemeYoneticisi.elleCalistir();
			esitlemeSonucu = { tamam: true, ...sonuc };
		} catch (hata) {
			esitlemeSonucu = { tamam: false, hata: hata.message };
		}

		return { ...davet, qr, esitleme: esitlemeSonucu };
	});

	kanal('pano:yaz', (metin) => {
		clipboard.writeText(String(metin ?? ''));
		return true;
	});

	kanal('onay:sor', async (baslik, mesaj) => {
		const sonuc = await dialog.showMessageBox(pencere, {
			type: 'warning',
			buttons: ['Vazgeç', 'Evet, sil'],
			defaultId: 0,
			cancelId: 0,
			title: baslik,
			message: baslik,
			detail: mesaj,
			noLink: true,
		});
		return sonuc.response === 1;
	});
}

/* ------------------------------------------------------------------ */
/* Menü                                                                */
/* ------------------------------------------------------------------ */

/** Ekran değiştirme isteği arayüze gönderiliyor; yönlendirme orada. */
function ekranaGit(anahtar) {
	if (pencere && !pencere.isDestroyed()) pencere.webContents.send('ekran:git', anahtar);
}

/* ------------------------------------------------------------------ */
/* Otomatik eşitleme                                                   */
/* ------------------------------------------------------------------ */

/**
 * Arayüzün gördüğü eşitleme durumu.
 *
 * Yöneticinin bildiklerine bekleyen kayıt sayısı ekleniyor: yönetici kuyruğu
 * bilmiyor, bilmemeli de. Sayı her bildirimde veritabanından okunuyor, çünkü
 * bu sorgu tek satırlık bir COUNT.
 */
function esitlemeDurumu() {
	const temel = esitlemeYoneticisi ? esitlemeYoneticisi.durum() : null;
	let bekleyenSayisi = 0;
	try {
		bekleyenSayisi = depo ? depo.kuyrukBekleyenSayisi() : 0;
	} catch {
		// Veritabanı kapanmış olabilir (uygulama kapanırken). Sayı sıfır kalsın.
	}
	return { ...temel, bekleyenSayisi };
}

/**
 * Durum değişikliğini arayüze itiyor.
 *
 * Arayüz sormuyor, ana süreç söylüyor. Alternatif arayüzün saniyede bir
 * sorması olurdu; eşitleme dakikalarca sessiz kalan bir iş, sürekli sormak
 * hem boşuna hem de gecikmeli.
 */
function esitlemeDurumunuBildir() {
	if (!pencere || pencere.isDestroyed()) return;
	pencere.webContents.send('esitleme:durum', esitlemeDurumu());
}

function esitlemeYoneticisiniKur() {
	return esitlemeYoneticisiKur({
		esitle: () => esitle(db),
		ayarlariOku: () => {
			const ayar = depo.otomatikAyariOku();
			return {
				otomatik: ayar.otomatik,
				aralikMs: ayar.aralikDk * 60 * 1000,
				ayarTamam: ayar.ayarTamam,
				eksikler: ayar.eksikler,
			};
		},
		durumDegisti: esitlemeDurumunuBildir,
	});
}

/* ------------------------------------------------------------------ */
/* Canlı akış                                                          */
/* ------------------------------------------------------------------ */

/**
 * Akıştan gelen tek hareket.
 *
 * Önce YEREL KOPYAYA yazılıyor, sonra arayüze haber veriliyor. Sıra
 * önemli: arayüz haberi alınca veriyi kendi kanalından okuyor ve o an
 * yazılmış olmalı. Arayüze mesaj metni GÖNDERİLMİYOR, yalnızca "şu talepte
 * şu kimlikte bir hareket oldu" bilgisi; metin zaten var olan `talep:getir`
 * kanalından, veritabanından geliyor.
 */
function akisOlayiniIsle(olay) {
	if (!depo) return;
	const sonuc = depo.akisOlayiniIsle(olay);
	if (!sonuc || sonuc.atlandi) return;
	if (!pencere || pencere.isDestroyed()) return;
	pencere.webContents.send('talep:akis-olayi', sonuc);
}

function akisDurumunuBildir(akisDurumu) {
	if (!pencere || pencere.isDestroyed()) return;
	pencere.webContents.send('talep:akis-durumu', akisDurumu);
}

function canliAkisiKur() {
	return canliAkisYoneticisiKur({
		akisBaslat,
		// Ayarlar eksikse bu çağrı fırlatıyor ve akış hiç başlamıyor.
		ayarlariOku: () => ayarlariOku(db),
		baslangicOku: () => akisBaslangici(db),
		olayGeldi: akisOlayiniIsle,
		durumDegisti: akisDurumunuBildir,
	});
}

function menuyuKur() {
	// Electron'un varsayılan menüsü İngilizce basıyor. `role` kullanılan
	// yerlerde bile `label` elle veriliyor, yoksa rolün İngilizce adı çıkar.
	const menu = Menu.buildFromTemplate([
		{
			label: 'Ekran',
			submenu: [
				{ label: 'Müşteriler', accelerator: 'CmdOrCtrl+1', click: () => ekranaGit('musteriler') },
				{ label: 'İşler', accelerator: 'CmdOrCtrl+2', click: () => ekranaGit('isler') },
				{ label: 'Ödemeler', accelerator: 'CmdOrCtrl+3', click: () => ekranaGit('odemeler') },
				{ label: 'Revizeler', accelerator: 'CmdOrCtrl+4', click: () => ekranaGit('revizeler') },
				{ label: 'İstatistikler', accelerator: 'CmdOrCtrl+5', click: () => ekranaGit('istatistik') },
				{ label: 'Davetler', accelerator: 'CmdOrCtrl+6', click: () => ekranaGit('davetler') },
				{ label: 'Eşitleme', accelerator: 'CmdOrCtrl+7', click: () => ekranaGit('esitleme') },
				{
					label: 'Destek talepleri',
					accelerator: 'CmdOrCtrl+8',
					click: () => ekranaGit('talepler'),
				},
				{ type: 'separator' },
				{ label: 'Yenile', accelerator: 'CmdOrCtrl+R', click: () => ekranaGit('yenile') },
				{ type: 'separator' },
				{ label: 'Çıkış', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
			],
		},
		{
			label: 'Düzen',
			submenu: [
				{ label: 'Geri al', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
				{ label: 'Yinele', accelerator: 'CmdOrCtrl+Shift+Z', role: 'redo' },
				{ type: 'separator' },
				{ label: 'Kes', accelerator: 'CmdOrCtrl+X', role: 'cut' },
				{ label: 'Kopyala', accelerator: 'CmdOrCtrl+C', role: 'copy' },
				{ label: 'Yapıştır', accelerator: 'CmdOrCtrl+V', role: 'paste' },
				{ label: 'Tümünü seç', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
			],
		},
		{
			label: 'Görünüm',
			submenu: [
				{ label: 'Yakınlaştır', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
				{ label: 'Uzaklaştır', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
				{ label: 'Normal boyut', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
				{ type: 'separator' },
				{ label: 'Geliştirici araçları', accelerator: 'F12', role: 'toggleDevTools' },
			],
		},
		{
			label: 'Yardım',
			submenu: [
				{
					label: 'Veritabanı klasörünü aç',
					click: () => shell.openPath(app.getPath('userData')),
				},
				{
					label: 'Bu program hakkında',
					click: () => {
						dialog.showMessageBox(pencere, {
							type: 'info',
							title: 'Yönetim',
							message: 'Yönetim',
							detail:
								'Müşteri, iş, ödeme ve revize defteri. Veriler yalnızca bu bilgisayarda ' +
								'duruyor. TC kimlik ve vergi numarası işletim sisteminin anahtarlığıyla ' +
								'şifreli tutuluyor.\n\nVeritabanı: ' +
								join(app.getPath('userData'), 'yerel.db'),
							buttons: ['Tamam'],
							noLink: true,
						});
					},
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
		minWidth: 1000,
		minHeight: 640,
		title: 'Yönetim',
		/*
		  Pencere ilk boyanana kadar bu renkte duruyor, sayfa yüklenirken
		  beyaz kare parlamasın diye. Renk arayüzün zemin tokeni ile aynı ve
		  NÖTR gri: koyu temada lacivert yok, chroma sıfır.

		  `show: false` + `ready-to-show` kalıbı kullanılmıyor: `loadFile` ile
		  yerel dosya yüklendiğinde o olayın ateşlenmediği, pencerenin görünmez
		  kaldığı bu depoda daha önce ölçüldü (masaustu/ana.mjs'teki not).
		*/
		backgroundColor: '#161616',
		webPreferences: {
			preload: join(BURASI, 'onyukleme.cjs'),
			// Renderer'a Node yok. Arayüzün elindeki tek kapı preload'daki
			// adı belli kanallar; `require` diye bir şey görmüyor.
			nodeIntegration: false,
			contextIsolation: true,
			sandbox: true,
			spellcheck: false,
		},
	});

	pencere.webContents.on('console-message', (olay) => {
		if (olay?.level !== 'error') return;
		console.error('[arayüz]', olay.message, `(${olay.sourceId}:${olay.lineNumber})`);
	});
	pencere.webContents.on('did-fail-load', (olay, kod, aciklama, adres) => {
		if (kod === -3) return;
		console.error('[yüklenemedi]', kod, aciklama, adres);
	});

	/*
	  Bu uygulama hiçbir dış adrese gitmiyor. Yine de bir bağlantı tıklanırsa
	  pencerenin içinde açılmıyor, sistem tarayıcısına gidiyor: uygulama
	  penceresinin başka bir siteye dönüşmesi geri dönüşü olmayan bir hata.
	*/
	pencere.webContents.setWindowOpenHandler(({ url }) => {
		if (/^https?:/.test(url)) shell.openExternal(url);
		return { action: 'deny' };
	});
	pencere.webContents.on('will-navigate', (olay, url) => {
		if (url.startsWith('file://')) return;
		olay.preventDefault();
		if (/^https?:/.test(url)) shell.openExternal(url);
	});

	pencere.on('close', boyutYaz);
	pencere.on('closed', () => {
		pencere = null;
	});

	pencere.loadFile(join(BURASI, 'arayuz', 'index.html'));
}

/* ------------------------------------------------------------------ */
/* Akış                                                                */
/* ------------------------------------------------------------------ */

function baslat() {
	db = yerelAc(join(app.getPath('userData'), 'yerel.db'));

	/*
	  Sıra önemli: yönetici depodan ÖNCE kurulamıyor (depo ayarları okuyor),
	  depo da yöneticiyi dinleyici olarak istiyor. Düğüm, dinleyicinin
	  yöneticiyi değişken üzerinden çağırmasıyla çözülüyor; kuyruğa ilk kayıt
	  düştüğünde yönetici çoktan kurulmuş oluyor.
	*/
	depo = depoKur(db, kasa, {
		kuyrukDinleyici: (islem) => esitlemeYoneticisi?.degisiklikBildir(islem),
	});
	esitlemeYoneticisi = esitlemeYoneticisiniKur();

	canliAkis = canliAkisiKur();

	kanallariKur();
	menuyuKur();
	pencereyiKur();
	esitlemeYoneticisi.baslat();

	/*
	  Akış PENCERE YÜKLENDİKTEN sonra başlıyor. Daha erken başlasa, ilk
	  saniyede gelen hareketin bildirimi boşluğa giderdi: `webContents.send`
	  sayfa yüklenmeden gönderilen mesajı düşürüyor. Kayıt yine de yerel
	  kopyaya yazılırdı, ama ekran onu ancak bir sonraki çizimde görürdü.

	  Ayarlar eksikse `baslat()` hiçbir şey açmıyor, sessizce bekliyor.
	*/
	pencere.webContents.once('did-finish-load', () => canliAkis?.baslat());

	/*
	  Önceki oturumdan gönderilmemiş kayıt kaldıysa açılışta eşitleniyor.
	  Tam olarak bu işin çıkış senaryosu: anahtar üretilmiş, eşitlenmemiş,
	  uygulama kapanmış. Aralığı beklemek o kaydı dakikalarca daha bekletirdi.
	*/
	if (depo.kuyrukBekleyenSayisi() > 0) esitlemeYoneticisi.degisiklikBildir('acilis');

	if (!kasa.kullanilabilir()) {
		console.warn(
			'[yonetim] İşletim sistemi anahtarlığı açılamadı. TC ve vergi numarası kaydedilemeyecek.',
		);
	}
}

function kapat() {
	// Zamanlayıcılar önce susuyor: kapanan veritabanına SSH sonucu yazmaya
	// çalışan bir koşu, kapanışı hataya çevirirdi. Akış da aynı sebeple
	// burada kapanıyor; üstelik kapatılmazsa sunucuda öksüz bir izleyici
	// süreç kalırdı.
	esitlemeYoneticisi?.durdur();
	canliAkis?.durdur();
	canliAkis = null;
	try {
		db?.close();
	} catch {
		// Zaten kapalıysa sorun değil.
	}
	db = null;
}

if (!app.requestSingleInstanceLock()) {
	// İkinci kopya aynı SQLite dosyasına yazardı. Var olan pencere öne alınıyor.
	app.quit();
} else {
	app.on('second-instance', () => {
		if (!pencere) return;
		if (pencere.isMinimized()) pencere.restore();
		pencere.focus();
	});

	app.whenReady().then(baslat);

	app.on('window-all-closed', () => app.quit());
	app.on('before-quit', kapat);
	for (const sinyal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
		process.on(sinyal, () => {
			kapat();
			app.quit();
		});
	}
}

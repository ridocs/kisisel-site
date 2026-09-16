import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const calistir = promisify(execFile);

/*
  YAYIN SUNUCUSUYLA KONUŞAN ORTAK KATMAN

  Hem `/durum` sayfası (durum.ts) hem de yayınlama yordamı (yayinla.mjs)
  buradan geçiyor: sunucu adresi, anahtar yolu ve hata çevirisi tek yerde
  dursun diye.

  Dosya TypeScript değil, düz JavaScript. Sebebi ideolojik değil teknik:
  `eklenti.mjs` içindeki Vite ara katmanı bu modülü Astro'nun yapılandırma
  yükleyicisi üzerinden, yani doğrudan Node ile içeri alıyor. Node `.ts`
  okuyamıyor. Sayfa tarafı (`durum.ts`) Vite'ın içinden geçtiği için orada
  TypeScript serbest.

  Bu klasörün tamamı yalnızca panel kipinde var; yayın derlemesi buraya hiç
  bakmıyor. Gerekçe: eklenti.mjs.
*/

/** Statik sitelerin durduğu kök. Yayın da geri alma da bu dizinde dönüyor. */
export const HEDEF_KOK = '/var/www/twinshareapp_static';

/** Yayın dizininin adı. `.yeni` ve `.eski` kardeşleri de bu addan türüyor. */
export const YAYIN_DIZINI = 'web-sitem';

export const SUNUCU = 'root@45.141.151.156';

/** Ziyaretçinin gördüğü adres; "site ayakta mı" bu adresten ölçülüyor. */
export const CANLI_ADRES = 'https://twinshareapp.com/web-sitem/';

/*
  Site haritası, "yerelde yazılmış ama yayında olmayan" yazıyı bulmanın en
  ucuz yolu: tek istekle yayındaki bütün adresleri veriyor. Yazı yazı HEAD
  isteği atmak onlarca istek demekti.

  `sitemap-0.xml` doğrudan okunuyor, `sitemap-index.xml` değil: index yalnızca
  tek bir parçaya işaret ediyor ve araya bir istek daha koymanın karşılığı yok.
*/
export const SITEMAP_ADRESI = 'https://twinshareapp.com/web-sitem/sitemap-0.xml';

/** `~` kabuk genişletmesi yok — komutlar kabuksuz çalışıyor, yol elle kuruluyor. */
export function anahtarYolu() {
	return join(homedir(), '.ssh', 'twinshare_server');
}

/*
  Her ssh çağrısında tekrarlanan bayraklar.

  `BatchMode=yes` şart: anahtar çalışmıyorsa parola sorulup komut sonsuza
  kadar beklerdi ve sayfa "yükleniyor" hâlinde kalırdı. Burada hemen hata
  dönüyor.
*/
export function sshBayraklari() {
	return [
		'-i',
		anahtarYolu(),
		'-o',
		'BatchMode=yes',
		'-o',
		'ConnectTimeout=10',
		'-o',
		'StrictHostKeyChecking=accept-new',
	];
}

/** Uzak uçta tek bir komut çalıştırır ve stdout'u döndürür. */
/*
  PANEL SUNUCUNUN KENDİSİNDE Mİ ÇALIŞIYOR?

  Panelin internete açık kopyası sunucunun üzerinde duruyor ve SSH anahtarı
  ORAYA BİLEREK KONULMADI: o anahtar sitenin dağıtım anahtarı, internete bakan
  bir makinede bulunmamalı. Ama sorulan şeyler (son yayın ne zaman, kaç dosya,
  geri alınabilir sürüm var mı) zaten o makinenin kendi diskinde.

  Bu değişken açıkken komut SSH'a değil doğrudan kabuğa gidiyor. Masaüstü
  panelinde tanımsız; oradan sunucuya yalnızca SSH ile ulaşılıyor, davranış
  eskisi gibi.

  Belirti şuydu: genel panelde "Son yayın" satırı "SSH anahtarı bulunamadı"
  diyordu — doğru bir hata mesajıydı ama yanlış soruya cevap veriyordu.
*/
const YEREL_SUNUCU = process.env.PANEL_YEREL_SUNUCU === '1';

export async function ssh(uzakKomut, { zamanAsimiMs = 60_000 } = {}) {
	if (YEREL_SUNUCU) {
		const { stdout } = await calistir('sh', ['-c', uzakKomut], {
			timeout: zamanAsimiMs,
			maxBuffer: 8 * 1024 * 1024,
			encoding: 'utf8',
		});
		return stdout;
	}

	const { stdout } = await calistir('ssh', [...sshBayraklari(), SUNUCU, uzakKomut], {
		timeout: zamanAsimiMs,
		maxBuffer: 8 * 1024 * 1024,
		encoding: 'utf8',
	});
	return stdout;
}

/*
  Canlı site yoklaması.

  `GET` kullanılıyor, `HEAD` değil: nginx ve önündeki CDN bu ikisine farklı
  davranabiliyor ve ölçmek istediğimiz şey ziyaretçinin gerçekten yaşadığı
  istek. Yanıt gövdesi okunmadan atılıyor, ölçülen süre ilk yanıta kadar
  geçen süre.

  Önbellek atlatılıyor: `cache: 'no-store'` olmadan aradaki katmanlar eski bir
  200'ü gösterip site çökmüşken bile "ayakta" dedirtebilir.
*/
export async function canliYokla() {
	const basladi = Date.now();
	try {
		const yanit = await fetch(CANLI_ADRES, {
			cache: 'no-store',
			signal: AbortSignal.timeout(15_000),
		});
		await yanit.arrayBuffer();
		return { ulasildi: true, durumKodu: yanit.status, sureMs: Date.now() - basladi };
	} catch (hata) {
		return { ulasildi: false, hata: agHatasiMetni(hata), sureMs: Date.now() - basladi };
	}
}

/**
 * Yayındaki adreslerin listesi (site önekiyle birlikte, sondaki eğik çizgi
 * atılmış hâlde). Site haritası okunamazsa `null` dönüyor — boş dizi dönseydi
 * "yayında hiç sayfa yok" gibi okunur ve her yazı yayınlanmamış görünürdü.
 */
export async function canliSayfalar() {
	try {
		const yanit = await fetch(SITEMAP_ADRESI, {
			cache: 'no-store',
			signal: AbortSignal.timeout(15_000),
		});
		if (!yanit.ok) return null;
		const xml = await yanit.text();
		const adresler = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((e) => e[1]);
		return adresler.map(adresiYolaCevir);
	} catch {
		return null;
	}
}

/** "https://twinshareapp.com/web-sitem/blog/x/" → "/web-sitem/blog/x" */
export function adresiYolaCevir(adres) {
	try {
		return new URL(adres).pathname.replace(/\/+$/, '') || '/';
	} catch {
		return adres;
	}
}

/*
  Sunucudaki yayın dizininin hâli: ne zaman yayınlandı, geri alınacak bir
  sürüm var mı, kaç dosya duruyor.

  Dördü de tek ssh oturumunda soruluyor. Ayrı ayrı sorulsaydı sayfa dört kez
  el sıkışmayı beklerdi; ölçüldüğünde her el sıkışma ~1 saniye.

  Zaman ölçüsü olarak dizinin kendi mtime'ı DEĞİL, `index.html` kullanılıyor:
  dizin mtime'ı içine dokunan her işlemle değişiyor, dosyanın tarihi ise
  kopyalandığı ana sabitleniyor — sorduğumuz şey tam olarak o.
*/
export async function sunucuDurumu() {
	const komut = [
		`cd ${HEDEF_KOK} || exit 1`,
		`stat -c %Y ${YAYIN_DIZINI}/index.html 2>/dev/null || echo 0`,
		`if [ -d ${YAYIN_DIZINI}.eski ]; then echo var; else echo yok; fi`,
		`stat -c %Y ${YAYIN_DIZINI}.eski/index.html 2>/dev/null || echo 0`,
		`find ${YAYIN_DIZINI} -type f 2>/dev/null | wc -l`,
	].join('\n');

	try {
		const satir = (await ssh(komut, { zamanAsimiMs: 30_000 })).split('\n');
		const saniye = Number(satir[0]?.trim() ?? 0);
		const eskiSaniye = Number(satir[2]?.trim() ?? 0);
		return {
			ulasildi: true,
			sonYayin: saniye > 0 ? new Date(saniye * 1000) : null,
			eskiSurumVar: satir[1]?.trim() === 'var',
			eskiSurumTarihi: eskiSaniye > 0 ? new Date(eskiSaniye * 1000) : null,
			dosyaSayisi: Number(satir[3]?.trim() ?? 0),
		};
	} catch (hata) {
		return { ulasildi: false, hata: hataMetni(hata) };
	}
}

/*
  `fetch` hataları ssh hatalarından farklı konuşuyor; ikisi tek çeviriciye
  sığmıyordu. Buradaki metinler kullanıcıya ne yapacağını söylemeli, hatanın
  İngilizce adını değil.
*/
function agHatasiMetni(hata) {
	const metin = hata instanceof Error ? `${hata.name}: ${hata.message}` : String(hata);
	if (/TimeoutError|AbortError|timed out/i.test(metin)) {
		return 'Site 15 saniye içinde yanıt vermedi.';
	}
	if (/ENOTFOUND|getaddrinfo|EAI_AGAIN/i.test(metin)) {
		return 'Adres çözülemedi; bu makinede internet bağlantısı yok gibi görünüyor.';
	}
	if (/ECONNREFUSED/i.test(metin)) {
		return 'Bağlantı reddedildi: sunucuda web sunucusu yanıt vermiyor olabilir.';
	}
	if (/certificate|SSL|TLS/i.test(metin)) {
		return `Güvenli bağlantı kurulamadı: ${metin}`;
	}
	return `Siteye ulaşılamadı: ${metin}`;
}

/*
  SSH hatalarının Türkçe karşılığı.

  Sıra önemli: anahtar dosyası yokken ssh önce "identity file … not
  accessible" uyarısı veriyor, ARDINDAN "Permission denied" diyor. Eksik dosya
  önce sınanmazsa her eksik anahtar "sunucu reddetti" diye görünür ve kullanıcı
  yanlış yerde arardı. Aynı sıralama `src/istatistik/kayitlar.ts` içinde de var.
*/
export function hataMetni(hata) {
	const metin =
		hata instanceof Error
			? `${hata.message}\n${String(/** @type {{ stderr?: string }} */ (hata).stderr ?? '')}`
			: String(hata);

	if (/ENOENT/.test(metin) && !/stat|No such file/i.test(metin)) {
		return 'Bu makinede `ssh` komutu bulunamadı. Git for Windows ya da OpenSSH istemcisi kurulu olmalı.';
	}
	if (/identity file .* not accessible/i.test(metin)) {
		return 'SSH anahtarı bulunamadı: `~/.ssh/twinshare_server` yok.';
	}
	if (/Permission denied|publickey/i.test(metin)) {
		return 'Sunucu anahtarı kabul etmedi. `~/.ssh/twinshare_server` dosyası yerinde mi ve sunucuda yetkili mi?';
	}
	if (/timed out|ETIMEDOUT|Connection timed out/i.test(metin)) {
		return 'Sunucuya bağlanılamadı: bağlantı zaman aşımına uğradı. İnternet bağlantısını kontrol edin.';
	}
	if (/Could not resolve|Name or service not known|Temporary failure/i.test(metin)) {
		return 'Sunucu adresi çözülemedi. Ağ bağlantısı yok gibi görünüyor.';
	}

	return `Sunucu komutu başarısız oldu. Verdiği yanıt:\n${metin.trim()}`;
}

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const calistir = promisify(execFile);

/*
  ZİYARETÇİ İSTATİSTİĞİ — nginx erişim kayıtlarından

  Sitede sayaç betiği yok ve olmayacak: ziyaretçiye tek satır JavaScript
  inmiyor. Ölçüm bu yüzden sunucunun zaten tuttuğu erişim kayıtlarından
  yapılıyor — ziyaretçi tarafında hiçbir maliyeti olmayan tek yöntem.

  Bu modül yalnızca panel kipinde (`npm run yazi`) çalışıyor; yayın derlemesi
  bu dosyayı hiç görmüyor. Ayrıntı: astro.config.cms.mjs.
*/

/** Sitenin yayınlandığı yol; kayıtlarda yalnızca bu önekli satırlar bizim. */
const SITE_YOLU = '/web-sitem';

/** Kaç günlük pencere gösteriliyor. Sunucudaki arşiv de 14 gün tutuyor. */
export const GUN_SAYISI = 14;

const SUNUCU = 'root@45.141.151.156';

/*
  Kayıt satırının biçimi nginx yapılandırmasında şöyle tanımlı:
    $host $remote_addr - $remote_user [$time_local] "$request" $status
    $body_bytes_sent "$http_referer" "$http_user_agent"

  Son alan `(.*)` ile alınıyor, `([^"]*)` ile değil: bazı tarayıcı kimlikleri
  kendi içlerinde tırnak taşıyor ve dar kalıp satırı hiç eşleştirmiyordu.
*/
const SATIR_KALIBI =
	/^(\S+) (\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) [^"]*" (\d{3}) \S+ "([^"]*)" "(.*)"$/;

const AYLAR: Record<string, string> = {
	Jan: '01',
	Feb: '02',
	Mar: '03',
	Apr: '04',
	May: '05',
	Jun: '06',
	Jul: '07',
	Aug: '08',
	Sep: '09',
	Oct: '10',
	Nov: '11',
	Dec: '12',
};

/** Sayfa görüntülemesi sayılmayan uzantılar: bunlar sayfanın parçaları. */
const VARLIK_UZANTILARI = /\.(css|js|woff2|svg|png|jpg|jpeg|ico|xml|txt)$/i;

/*
  Arama motoru ve benzeri robotlar.

  `WhatsApp` ve `Twitterbot` gibi mesajlaşma önizleme çekicileri de buraya
  giriyor: biri bağlantıyı sohbette paylaşınca kart önizlemesi için sayfayı
  indiriyorlar. Adında "bot" geçmeyen `WhatsApp/2.x` bu yüzden ayrıca
  yazıldı — insan ziyaretçi değil, sayılırsa tekil sayısını şişiriyor.
*/
const ROBOT_KALIBI = /(bot|crawl|spider|slurp|WhatsApp|facebookexternalhit|Slackbot|TelegramBot|Discordbot|preview)/i;

/*
  Kendi isteklerimiz. Kayıtların büyük kısmı geliştirme sırasında yapılan
  `curl` doğrulamaları; elenmezlerse rakam tamamen yanıltıcı oluyor
  (412 satırın 239'u yalnızca curl).
*/
const KENDI_KALIBI = /(curl|wget|python-requests|HeadlessChrome)/i;

/** Ziyaret sayılan durum kodları: başarılı ve "değişmemiş". */
const SAYILAN_DURUMLAR = new Set(['200', '304']);

export interface Sayim {
	ad: string;
	sayi: number;
}

export interface GunlukVeri {
	/** YYYY-AA-GG */
	tarih: string;
	/** "15 Eyl" gibi kısa gösterim. */
	etiket: string;
	goruntuleme: number;
	ziyaretci: number;
}

export interface Eleme {
	toplamSatir: number;
	robot: number;
	kendiIstegimiz: number;
	varlik: number;
	durum: number;
	kalan: number;
}

export interface Ozet {
	eleme: Eleme;
	toplamGoruntuleme: number;
	toplamZiyaretci: number;
	gunler: GunlukVeri[];
	sayfalar: Sayim[];
	kaynaklar: Sayim[];
	cihazlar: Sayim[];
	tarayicilar: Sayim[];
	/** Penceredeki en erken ve en geç kayıt; verinin gerçekten neyi kapsadığı. */
	ilkKayit: string | null;
	sonKayit: string | null;
}

export type Sonuc = { basarili: true; ozet: Ozet } | { basarili: false; hata: string };

/*
  Tekil ziyaretçi kimliği.

  IP kişisel veridir. Aynı kişinin iki isteğini birleştirmek için gerekli ama
  SAKLAMAK gereksiz: sayım bittikten sonra ham adrese bir daha ihtiyaç yok.
  Bu yüzden IP + tarayıcı kimliği karmaya çevriliyor ve yalnızca karma
  dolaşıyor; ham IP bu fonksiyonun dışına hiç çıkmıyor.
*/
function ziyaretciKimligi(ip: string, tarayiciKimligi: string): string {
	return createHash('sha256').update(`${ip}\n${tarayiciKimligi}`).digest('hex').slice(0, 16);
}

/*
  Sunucudan ham kayıtları çeker.

  Süzme uzak uçta yapılıyor: 14 günlük arşivin tamamı ~2 MB, `/web-sitem`
  satırları ise ~100 KB. Ağdan geçen veriyi yirmide birine indiriyor.

  `~` kabuk genişletmesi burada yok — komut kabuksuz çalıştırılıyor, ev dizini
  elle kuruluyor.
*/
async function sunucudanCek(): Promise<string> {
	const anahtar = join(homedir(), '.ssh', 'twinshare_server');

	// Dönen kayıt sırası önemsiz; sayım tarihe göre yapılıyor.
	const uzakKomut =
		'{ cat /var/log/nginx/access.log /var/log/nginx/access.log.1; ' +
		'zcat -f /var/log/nginx/access.log.*.gz; } 2>/dev/null | ' +
		`grep -F '${SITE_YOLU}'`;

	const { stdout } = await calistir(
		'ssh',
		[
			'-i',
			anahtar,
			// Parola sorulmasın: anahtar çalışmıyorsa komut beklemeden hata versin,
			// yoksa sayfa sonsuza kadar yüklenir görünürdü.
			'-o',
			'BatchMode=yes',
			'-o',
			'ConnectTimeout=10',
			'-o',
			'StrictHostKeyChecking=accept-new',
			SUNUCU,
			uzakKomut,
		],
		{ timeout: 30_000, maxBuffer: 32 * 1024 * 1024, encoding: 'utf8' },
	);

	return stdout;
}

/** "15/Sep/2026:00:07:05 +0300" → "2026-09-15" */
function tariheCevir(zaman: string): string | null {
	const parca = /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):/.exec(zaman);
	if (!parca) return null;
	const ay = AYLAR[parca[2]];
	if (!ay) return null;
	return `${parca[3]}-${ay}-${parca[1]}`;
}

const KISA_AYLAR = [
	'Oca',
	'Şub',
	'Mar',
	'Nis',
	'May',
	'Haz',
	'Tem',
	'Ağu',
	'Eyl',
	'Eki',
	'Kas',
	'Ara',
];

function tarihEtiketi(tarih: string): string {
	const [, ay, gun] = tarih.split('-');
	return `${Number(gun)} ${KISA_AYLAR[Number(ay) - 1]}`;
}

/*
  Yolu okunabilir bir sayfa adına çevirir.

  Elle yazılmış bir tablo kullanılıyor; sayfa sayısı bir avuç ve içerik
  koleksiyonunu buradan okumak panelin açılışını yavaşlatırdı. Tabloda
  olmayan bir yol (yazı adresleri, hatalı adresler) yolun kendisiyle
  gösteriliyor — uydurulmuş bir ad, yanlış bir ad olurdu.
*/
const SAYFA_ADLARI: Record<string, string> = {
	'/': 'Ana sayfa',
	'/hakkimda': 'Hakkımda',
	'/hizmetler': 'Hizmetler',
	'/kullandiklarim': 'Kullandıklarım',
	'/blog': 'Blog',
	'/404': 'Bulunamadı sayfası',
	'/en': 'Ana sayfa (İngilizce)',
	'/en/about': 'Hakkımda (İngilizce)',
	'/en/services': 'Hizmetler (İngilizce)',
	'/en/uses': 'Kullandıklarım (İngilizce)',
	'/en/blog': 'Blog (İngilizce)',
	'/en/404': 'Bulunamadı sayfası (İngilizce)',
};

function sayfaAdi(yol: string): string {
	// Site önekini at ve sondaki eğik çizgiyi tekilleştir: "/web-sitem/blog/"
	// ile "/web-sitem/blog" aynı sayfa, iki ayrı satır olarak görünmemeli.
	const ic = yol.slice(SITE_YOLU.length).replace(/\/+$/, '') || '/';
	const bilinen = SAYFA_ADLARI[ic];
	if (bilinen) return bilinen;

	const yazi = /^(?:\/en)?\/blog\/(.+)$/.exec(ic);
	if (yazi) return `Yazı: ${yazi[1]}`;

	return ic;
}

/** Referer adresini gruplanabilir bir kaynak adına indirger. */
function kaynakAdi(referer: string): string {
	if (!referer || referer === '-') return 'Doğrudan';
	try {
		const { hostname } = new URL(referer);
		// Sitenin kendi sayfaları arası geçişler "nereden geldi" sorusunun
		// cevabı değil; tek satırda toplanıp dışarıdan gelenleri gizlemesin.
		if (hostname.endsWith('twinshareapp.com')) return 'Site içi gezinme';
		return hostname;
	} catch {
		return referer;
	}
}

function cihazAdi(tarayiciKimligi: string): string {
	return /(Android|iPhone|iPod|iPad|Mobile)/i.test(tarayiciKimligi) ? 'Telefon' : 'Masaüstü';
}

/*
  Tarayıcı adı. Sıra önemli: Edge ve Chrome kendilerini "Safari" diye de
  tanıtıyor, Edge ayrıca "Chrome" diyor. En özgül kalıp önce sınanıyor.
*/
function tarayiciAdi(tarayiciKimligi: string): string {
	if (/Edg\//.test(tarayiciKimligi)) return 'Edge';
	if (/(OPR|Opera)\//.test(tarayiciKimligi)) return 'Opera';
	if (/Firefox\//.test(tarayiciKimligi)) return 'Firefox';
	if (/Chrome\//.test(tarayiciKimligi)) return 'Chrome';
	if (/Safari\//.test(tarayiciKimligi)) return 'Safari';
	return 'Diğer';
}

/** Sayım sözlüğünü çoktan aza sıralı listeye çevirir. */
function siralanmisSayim(sayac: Map<string, number>, enFazla?: number): Sayim[] {
	const liste = [...sayac.entries()]
		.map(([ad, sayi]) => ({ ad, sayi }))
		.sort((a, b) => b.sayi - a.sayi || a.ad.localeCompare(b.ad, 'tr'));
	return enFazla ? liste.slice(0, enFazla) : liste;
}

function birArtir(sayac: Map<string, number>, anahtar: string): void {
	sayac.set(anahtar, (sayac.get(anahtar) ?? 0) + 1);
}

export function ozetle(hamKayit: string): Ozet {
	const eleme: Eleme = {
		toplamSatir: 0,
		robot: 0,
		kendiIstegimiz: 0,
		varlik: 0,
		durum: 0,
		kalan: 0,
	};

	let toplamGoruntuleme = 0;
	const tumZiyaretciler = new Set<string>();
	const gunlukZiyaretciler = new Map<string, Set<string>>();
	const gunlukGoruntuleme = new Map<string, number>();
	const sayfalar = new Map<string, number>();
	const kaynaklar = new Map<string, number>();
	const cihazlar = new Map<string, number>();
	const tarayicilar = new Map<string, number>();

	let ilkKayit: string | null = null;
	let sonKayit: string | null = null;

	for (const satir of hamKayit.split('\n')) {
		if (!satir.trim()) continue;
		const parca = SATIR_KALIBI.exec(satir);
		if (!parca) continue;

		const [, , ip, zaman, , yol, durum, referer, tarayiciKimligi] = parca;

		// Uzak uçtaki `grep` satırın herhangi bir yerinde eşleşiyor; referer'ında
		// site adresi geçen ama kendisi başka bir yola giden istekler de geliyor.
		if (!yol.startsWith(SITE_YOLU)) continue;

		eleme.toplamSatir++;

		if (ROBOT_KALIBI.test(tarayiciKimligi)) {
			eleme.robot++;
			continue;
		}
		if (KENDI_KALIBI.test(tarayiciKimligi)) {
			eleme.kendiIstegimiz++;
			continue;
		}
		if (VARLIK_UZANTILARI.test(yol.split('?')[0])) {
			eleme.varlik++;
			continue;
		}
		if (!SAYILAN_DURUMLAR.has(durum)) {
			eleme.durum++;
			continue;
		}

		eleme.kalan++;

		const tarih = tariheCevir(zaman);
		if (!tarih) continue;

		if (!ilkKayit || tarih < ilkKayit) ilkKayit = tarih;
		if (!sonKayit || tarih > sonKayit) sonKayit = tarih;

		const kimlik = ziyaretciKimligi(ip, tarayiciKimligi);
		tumZiyaretciler.add(kimlik);

		let gununKisileri = gunlukZiyaretciler.get(tarih);
		if (!gununKisileri) {
			gununKisileri = new Set();
			gunlukZiyaretciler.set(tarih, gununKisileri);
		}
		gununKisileri.add(kimlik);

		toplamGoruntuleme++;
		gunlukGoruntuleme.set(tarih, (gunlukGoruntuleme.get(tarih) ?? 0) + 1);
		birArtir(sayfalar, sayfaAdi(yol.split('?')[0]));
		birArtir(kaynaklar, kaynakAdi(referer));
		birArtir(cihazlar, cihazAdi(tarayiciKimligi));
		birArtir(tarayicilar, tarayiciAdi(tarayiciKimligi));
	}

	/*
	  Grafik ekseni son kayda göre değil bugüne göre kuruluyor ve boş günler
	  sıfırla dolduruluyor: ziyaretsiz bir gün grafikte var olmalı, yoksa
	  yan yana duran iki çubuk arada geçen boşluğu gizler.
	*/
	const gunler: GunlukVeri[] = [];
	const bugun = new Date();
	for (let i = GUN_SAYISI - 1; i >= 0; i--) {
		const g = new Date(bugun);
		g.setDate(bugun.getDate() - i);
		const tarih = `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(
			g.getDate(),
		).padStart(2, '0')}`;
		gunler.push({
			tarih,
			etiket: tarihEtiketi(tarih),
			goruntuleme: gunlukGoruntuleme.get(tarih) ?? 0,
			ziyaretci: gunlukZiyaretciler.get(tarih)?.size ?? 0,
		});
	}

	return {
		eleme,
		toplamGoruntuleme,
		toplamZiyaretci: tumZiyaretciler.size,
		gunler,
		sayfalar: siralanmisSayim(sayfalar, 10),
		kaynaklar: siralanmisSayim(kaynaklar, 8),
		cihazlar: siralanmisSayim(cihazlar),
		tarayicilar: siralanmisSayim(tarayicilar),
		ilkKayit,
		sonKayit,
	};
}

/*
  Sayfanın çağırdığı tek giriş noktası.

  Hata fırlatmıyor: sunucuya ulaşılamaması olağan bir durum (uçakta, otelde,
  anahtarsız bir makinede). Sayfa böyle bir günde çökmek yerine ne olduğunu
  anlatmalı, bu yüzden hata bir değer olarak dönüyor.
*/
export async function ozetGetir(): Promise<Sonuc> {
	try {
		const ham = await sunucudanCek();
		return { basarili: true, ozet: ozetle(ham) };
	} catch (hata) {
		return { basarili: false, hata: hataMetni(hata) };
	}
}

function hataMetni(hata: unknown): string {
	const metin = hata instanceof Error ? `${hata.message}\n${String((hata as { stderr?: string }).stderr ?? '')}` : String(hata);

	if (/ENOENT/.test(metin)) {
		return 'Bu makinede `ssh` komutu bulunamadı. Git for Windows ya da OpenSSH istemcisi kurulu olmalı.';
	}
	/*
	  Anahtar dosyası yokken ssh önce "identity file … not accessible" uyarısı
	  veriyor, ARDINDAN "Permission denied (publickey)" diyor. İkisi aynı
	  çıktıda olduğu için eksik dosya önce sınanıyor; ters sırada her eksik
	  anahtar "sunucu reddetti" diye görünür ve yanlış yerde aranırdı.
	*/
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

	return `Kayıtlar çekilemedi. Sunucunun verdiği yanıt:\n${metin.trim()}`;
}

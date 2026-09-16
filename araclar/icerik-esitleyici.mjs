import { execFile } from 'node:child_process';
import { watch } from 'node:fs';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const calistir = promisify(execFile);

/*
  İÇERİK EŞİTLEYİCİ

  Panelin internete açık kopyasından yazılan yazılar sunucudaki depo
  kopyasına düşüyor. Bu servis onları GitHub'a gönderiyor.

  NEDEN GEREKLİ

  Keystatic dosyaları diske yazıyor, git'e dokunmuyor. Sunucuda yazılan bir
  yazı gönderilmezse yalnızca orada kalır: kullanıcının bilgisayarındaki depo
  onu hiç görmez, iki kopya çatallanır ve bir sonraki yayın onu silebilir.
  Panelin internete açılmasının asıl bedeli buydu; eşitleyici onu ödüyor.

  NEDEN AYRI BİR SERVİS

  Keystatic'in kaydetme akışına girmek onun iç yapısına bağımlılık kurardı ve
  her sürümde kırılabilirdi. Dosya sistemini izlemek dıştan çalışıyor:
  Keystatic ne yaparsa yapsın, dosya değiştiği an yakalanıyor.

  BEKLEME NEDEN VAR

  Bir kaydetme birden çok dosyaya dokunabiliyor (yazı + görsel + veri deposu)
  ve Keystatic aynı dosyayı kısa aralıkla birkaç kez yazabiliyor. Her olay
  için ayrı bir işleme çıkarsa depo gereksiz yere parçalı bir geçmişe boğulur.
  Değişiklikler bu yüzden toplanıp tek işlemede gönderiliyor.
*/

const BURASI = dirname(fileURLToPath(import.meta.url));
const DEPO = join(BURASI, '..');

/** İzlenen klasörler: yazılar ve panelden düzenlenen site metinleri. */
const IZLENEN = ['src/content', 'src/icerik', 'public/yazi-gorselleri'];

/*
  Son değişiklikten sonra beklenen süre. Kısa tutulursa tek bir kaydetme
  birkaç işlemeye bölünüyor; uzun tutulursa kullanıcı yazısının gönderildiğini
  görmek için bekliyor. On saniye ikisinin arasında duruyor.
*/
const BEKLEME_MS = 10_000;

/** Aynı anda iki gönderim çalışmasın; ikincisi birincinin bitmesini bekliyor. */
let calisiyor = false;
let tekrarGerekli = false;
let zamanlayici = null;

async function git(...argumanlar) {
	const { stdout } = await calistir('git', argumanlar, {
		cwd: DEPO,
		timeout: 120_000,
		maxBuffer: 8 * 1024 * 1024,
		encoding: 'utf8',
	});
	return stdout.trim();
}

function gunluk(mesaj) {
	// pm2 kayıtlara zaman damgası ekliyor; burada yalnızca ne olduğu yazılıyor.
	console.log(`[esitleyici] ${mesaj}`);
}

async function esitle() {
	if (calisiyor) {
		tekrarGerekli = true;
		return;
	}
	calisiyor = true;

	try {
		const degisenler = await git('status', '--porcelain', '--', ...IZLENEN);
		if (!degisenler) {
			gunluk('değişiklik yok, gönderilecek bir şey de yok');
			return;
		}

		const sayi = degisenler.split('\n').filter(Boolean).length;
		gunluk(`${sayi} dosya değişti, gönderiliyor`);

		await git('add', '--', ...IZLENEN);

		/*
		  İşleyen kim: panelden yazıldığı belli olsun. Kullanıcının kendi
		  bilgisayarından attığı işlemelerle karışmaması, sonradan "bu nereden
		  geldi" sorusunu ortadan kaldırıyor.
		*/
		await git(
			'-c',
			'user.name=Yönetim paneli',
			'-c',
			'user.email=panel@twinshareapp.com',
			'commit',
			'-q',
			'-m',
			`İçerik panelden güncellendi (${sayi} dosya)`,
		);

		/*
		  Göndermeden önce çekiliyor: kullanıcı bu arada kendi bilgisayarından
		  bir şey göndermiş olabilir. `--rebase` ile kendi işlememiz onun
		  üstüne biniyor, birleştirme işlemesi üretilmiyor.
		*/
		await git('pull', '--rebase', '--quiet', 'origin', 'main');
		await git('push', '--quiet', 'origin', 'HEAD:main');
		gunluk('gönderildi');
	} catch (hata) {
		/*
		  Hata yutulmuyor ama servis de düşmüyor: bir gönderim başarısız diye
		  panelin yazma yeteneği kapanmamalı. Sıradaki değişiklikte yeniden
		  denenecek ve o denemede birikmiş her şey birlikte gidecek.

		  En olası sebep depoya yazma yetkisinin kurulmamış olması; mesaj
		  kayıtta görünsün ki sebebi aranmasın.
		*/
		gunluk(`GÖNDERİLEMEDİ: ${hata?.stderr?.trim() || hata?.message || hata}`);
	} finally {
		calisiyor = false;
		if (tekrarGerekli) {
			tekrarGerekli = false;
			planla();
		}
	}
}

function planla() {
	if (zamanlayici) clearTimeout(zamanlayici);
	zamanlayici = setTimeout(esitle, BEKLEME_MS);
}

for (const klasor of IZLENEN) {
	const yol = join(DEPO, klasor);
	if (!existsSync(yol)) {
		gunluk(`izlenmiyor (klasör yok): ${klasor}`);
		continue;
	}
	watch(yol, { recursive: true }, planla);
	gunluk(`izleniyor: ${klasor}`);
}

// Açılışta bir kez: servis kapalıyken yazılmış bir şey varsa o da gitsin.
planla();
gunluk('eşitleyici çalışıyor');

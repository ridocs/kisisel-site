import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/*
  PANEL SUNUCUSU — NÖBETÇİ

  `npm run yazi` bu dosyadan geçiyor. Tek işi şu: aynı proje klasöründe
  İKİNCİ bir Astro dev sunucusunun başlamasını engellemek.

  NEDEN GEREKLİ

  İki dev sunucusu aynı klasörde çalıştığında ikisi de içerik deposunu
  `.astro/data-store.json` olarak yazıyor ve ikisi de aynı geçici dosya adını
  kullanıyor (`...json.tmp`). Yazma sırası şöyle: önce `.tmp` yazılıyor, sonra
  asıl dosyanın üzerine taşınıyor. İki süreç aynı anda yaptığında biri `.tmp`
  dosyasını taşıyıp tüketiyor, diğeri aynı dosyayı arıyor ve düşüyor:

      UnknownFilesystemError · ENOENT · rename
      .astro/data-store.json.tmp → .astro/data-store.json

  Panelde bu hata yazı kaydederken "Failed to fetch" olarak görünüyor ve
  yazılan makale diske HİÇ yazılmıyor. Yani sessiz veri kaybı.

  ASTRO'NUN KENDİ KORUMASI YETMİYOR

  `astro.config.cms.mjs` içinde `server.strictPort` açık ama bu sürümde etkisi
  görülmedi: 4321 doluyken sunucu yine 4322'ye kayıyor — `--port` verilse de,
  verilmese de. Ölçüldü. Dolayısıyla "ikinci sunucu başlamasın" güvencesini
  Astro'ya bırakamıyoruz, burada kuruyoruz.

  NE YAPIYOR

  Port doluysa hiç başlatmıyor ve ne yapılacağını Türkçe söylüyor. Boşsa
  Astro'yu başlatıp çıktısını olduğu gibi geçiriyor.
*/

const BURASI = dirname(fileURLToPath(import.meta.url));
const PROJE_KOKU = join(BURASI, '..');
const ASTRO_GIRISI = join(PROJE_KOKU, 'node_modules', 'astro', 'bin', 'astro.mjs');

/** Panelin kullandığı tek port. Masaüstü uygulaması da bunu bekliyor. */
const PORT = 4321;

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

/** Oradaki şey paneli mi sunuyor? Öyleyse kullanıcının işine yarar. */
async function panelMi(port) {
	try {
		const yanit = await fetch(`http://127.0.0.1:${port}/keystatic`, {
			signal: AbortSignal.timeout(15_000),
			redirect: 'manual',
		});
		return yanit.status === 200;
	} catch {
		return false;
	}
}

if (await portBosMu(PORT)) {
	// Yol açık: Astro'yu başlat ve çıktısını aynen geçir.
	const surec = spawn(
		process.execPath,
		[ASTRO_GIRISI, 'dev', '--config', 'astro.config.cms.mjs', '--port', String(PORT)],
		{ cwd: PROJE_KOKU, stdio: 'inherit', shell: false },
	);
	surec.on('exit', (kod) => process.exit(kod ?? 0));
} else if (await panelMi(PORT)) {
	console.error(
		`\nPanel zaten çalışıyor: http://127.0.0.1:${PORT}/keystatic\n\n` +
			'Yeni bir sunucu başlatılmadı. Aynı klasörde ikinci bir sunucu\n' +
			'içerik deposunu bozuyor ve yazdığın makale kaydedilmiyor.\n\n' +
			'Adresi tarayıcıda aç ya da masaüstündeki panel kısayolunu kullan.\n',
	);
	process.exit(1);
} else {
	console.error(
		`\n${PORT} portu dolu ama paneli sunmuyor.\n\n` +
			'Orada başka bir sunucu çalışıyor olabilir (ör. kapatılmamış bir\n' +
			'`npm run dev`) ya da önceki oturumdan kalmış, artık yanıt vermeyen\n' +
			'bir sunucu.\n\n' +
			'Yapılacak: önce onu kapat.\n' +
			'  npx astro dev stop\n' +
			'Görmüyorsa görev yöneticisinden ilgili `node.exe` sürecini kapat.\n',
	);
	process.exit(1);
}

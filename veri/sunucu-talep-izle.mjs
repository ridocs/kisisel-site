#!/usr/bin/env node
/*
  SUNUCUDA çalışır ve KAPANMAZ: destek talebi hareketlerini oluştukça akıtır.

  NEDEN BÖYLE, NEDEN BİR WEBSOCKET DEĞİL

  Sahibin bilgisayarı sunucuyu üç dakikada bir yokluyordu. Yazışma sırasında
  bu üç dakika, sohbeti kullanılmaz hâle getiriyor. Anlık akış için akla ilk
  gelen şey sunucuda bir WebSocket ya da olay uç noktası açmak, ama o
  panelin saldırı yüzeyine internete bakan yeni bir kapı eklerdi.

  Onun yerine SSH bağlantısı açık tutuluyor ve bu betik o bağlantının
  standart çıktısına yazıyor. Yeni yüzey yok: SSH zaten orada ve zaten
  anahtarla korunuyor (PANEL-TASARIMI.md §1).

  Veritabanı yoklanıyor, çünkü SQLite'ta süreçler arası bildirim yok. Ama
  yoklama SUNUCUNUN İÇİNDE: yarım saniyede bir yerel dosyaya bakmak ucuz.
  Pahalı olan, ağ üzerinden SSH el sıkışmasını tekrarlamaktı; o artık
  bağlantı başına bir kez oluyor.

  Çıktı biçimi NDJSON: her satır tek bir JSON nesnesi.
    {"tur":"mesaj",  "talep_id":…, "id":…, "yazan":…, "metin":…, "zaman":…}
    {"tur":"talep",  "id":…, "baslik":…, "durum":…, "guncellendi":…}
    {"tur":"nabiz",  "zaman":…}

  Kullanım:
      node sunucu-talep-izle.mjs <veritabani> [<baslangic ISO>] [<aralik ms>]
*/

import { panelAc } from './db.mjs';

const vtYolu = process.argv[2];
if (!vtYolu) {
	process.stderr.write('Kullanım: node sunucu-talep-izle.mjs <veritabani> [<ISO>] [<ms>]\n');
	process.exit(2);
}

/*
  Başlangıç damgası: bundan SONRAKİ hareketler akıtılıyor. Çağıran taraf
  elindeki en son mesajın zamanını veriyor, böylece bağlantı koptuğunda
  kaldığı yerden devam edebiliyor ve aradaki mesajlar kaybolmuyor.
*/
let sonMesajZamani = process.argv[3] && !Number.isNaN(Date.parse(process.argv[3]))
	? process.argv[3]
	: new Date(0).toISOString();
let sonTalepZamani = sonMesajZamani;

const ARALIK_MS = Math.min(Math.max(Number(process.argv[4]) || 500, 200), 10000);

/* Nabız: bağlantının canlı olduğunu karşı tarafa göstermek için. Veri
   akmadığında da düzenli geliyor, böylece kopmuş bir bağlantı ile sessiz
   bir bağlantı birbirinden ayrılabiliyor. */
const NABIZ_MS = 20000;
let sonNabiz = Date.now();

const db = panelAc(vtYolu);

const yeniMesajlar = db.prepare(
	`SELECT m.id, m.talep_id, m.yazan, m.metin, m.zaman, t.musteri_id, t.baslik
	 FROM talep_mesaji m JOIN talep t ON t.id = m.talep_id
	 WHERE m.zaman > ? ORDER BY m.zaman LIMIT 200`,
);
const degisenTalepler = db.prepare(
	`SELECT id, musteri_id, baslik, durum, oncelik, olusturuldu, guncellendi
	 FROM talep WHERE guncellendi > ? ORDER BY guncellendi LIMIT 200`,
);

function yaz(nesne) {
	process.stdout.write(JSON.stringify(nesne) + '\n');
}

function tur() {
	let birSeyAkti = false;

	for (const t of degisenTalepler.all(sonTalepZamani)) {
		yaz({ tur: 'talep', ...t });
		sonTalepZamani = t.guncellendi;
		birSeyAkti = true;
	}

	for (const m of yeniMesajlar.all(sonMesajZamani)) {
		yaz({ tur: 'mesaj', ...m });
		sonMesajZamani = m.zaman;
		birSeyAkti = true;
	}

	const simdi = Date.now();
	if (birSeyAkti) {
		sonNabiz = simdi;
	} else if (simdi - sonNabiz >= NABIZ_MS) {
		yaz({ tur: 'nabiz', zaman: new Date(simdi).toISOString() });
		sonNabiz = simdi;
	}
}

// İlk turu hemen çalıştır: bağlantı kurulur kurulmaz birikmişler aksın.
tur();
const sayac = setInterval(tur, ARALIK_MS);

function kapat(kod = 0) {
	clearInterval(sayac);
	try {
		db.close();
	} catch {
		// Zaten kapalıysa sorun değil.
	}
	process.exit(kod);
}

/*
  SSH bağlantısı kopunca bu süreç sunucuda öksüz kalmasın. Karşı taraf
  kapanınca standart girdi de kapanıyor; onu sonlanma işareti sayıyoruz.
  Aksi hâlde her kopan bağlantı sunucuda çalışan bir süreç bırakırdı.
*/
process.stdin.resume();
process.stdin.on('end', () => kapat(0));
process.stdin.on('close', () => kapat(0));
process.stdout.on('error', () => kapat(0));
process.on('SIGTERM', () => kapat(0));
process.on('SIGINT', () => kapat(0));

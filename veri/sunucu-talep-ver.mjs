#!/usr/bin/env node
/*
  SUNUCUDA çalışır. Müşterilerin açtığı destek taleplerini, sahibin
  bilgisayarının çekmesi için standart çıktıya JSON olarak yazar.

  Yalnızca OKUR. Bir şeyi değiştirmez, silmez, işaretlemez: eşitleme yarıda
  kalırsa hiçbir talep kaybolmasın diye. Neyin yeni olduğuna karar vermek
  çeken tarafın işi.

  Kullanım:
      node sunucu-talep-ver.mjs /var/lib/panel/panel.db [<ISO tarih>]

  İkinci argüman verilirse yalnızca o andan sonra güncellenen talepler
  döner. Verilmezse hepsi döner (ilk çekiş).
*/

import { panelAc } from './db.mjs';

const vtYolu = process.argv[2];
if (!vtYolu) {
	process.stderr.write('Kullanım: node sunucu-talep-ver.mjs <veritabani-yolu> [<ISO tarih>]\n');
	process.exit(2);
}

const sonrasi = process.argv[3];
if (sonrasi && Number.isNaN(Date.parse(sonrasi))) {
	process.stderr.write('İkinci argüman ISO 8601 tarih olmalı\n');
	process.exit(2);
}

const db = panelAc(vtYolu);

const talepler = sonrasi
	? db
			.prepare('SELECT * FROM talep WHERE guncellendi > ? ORDER BY guncellendi')
			.all(sonrasi)
	: db.prepare('SELECT * FROM talep ORDER BY guncellendi').all();

const mesajDeyimi = db.prepare(
	'SELECT id, yazan, metin, zaman FROM talep_mesaji WHERE talep_id = ? ORDER BY zaman',
);

/*
  İŞ YAZIŞMASI DA BURADAN GİDİYOR.

  İlk sürümde yalnızca destek talepleri çekiliyordu ve iş bazlı yazışma tek
  yönlü kalmıştı: sahip yazabiliyor, müşterinin aynı işe yazdığı yanıt
  yönetim uygulamasına hiç ulaşmıyordu. Özellik yarım kalıyordu.

  Sahibin kendi mesajları da dönüyor: aynı kimlikle yazıldıkları için yerel
  kopyada ikilenmiyorlar ve bu, yerel kopyanın sunucuyla aynı hizaya gelmesini
  sağlıyor.
*/
const isMesajlari = sonrasi
	? db
			.prepare('SELECT id, is_id, yazan, metin, zaman FROM is_mesaji WHERE zaman > ? ORDER BY zaman LIMIT 500')
			.all(sonrasi)
	: db.prepare('SELECT id, is_id, yazan, metin, zaman FROM is_mesaji ORDER BY zaman LIMIT 500').all();

const cikti = {
	surum: 1,
	uretildi: new Date().toISOString(),
	talepler: talepler.map((t) => ({
		id: t.id,
		musteri_id: t.musteri_id,
		is_id: t.is_id,
		baslik: t.baslik,
		durum: t.durum,
		oncelik: t.oncelik,
		olusturuldu: t.olusturuldu,
		guncellendi: t.guncellendi,
		mesajlar: mesajDeyimi.all(t.id),
	})),
	is_mesajlari: isMesajlari,
};

db.close();
process.stdout.write(JSON.stringify(cikti) + '\n');

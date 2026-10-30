/*
  Alt çubuktaki firma ve iletişim bilgisi.

  DEĞERLER SİTENİN KENDİ KAYNAĞINDAN OKUNUYOR, panele ikinci kez YAZILMIYOR:
  `src/icerik/iletisim-bilgisi.json` sahibin masaüstü panelinden düzenlenen
  tek kaynak ve site de (`src/lib/iletisim.ts`) oradan okuyor. Numara burada
  elle tekrarlansaydı, sahip numarasını değiştirdiğinde site güncellenir,
  panel eski numarayı göstermeye devam ederdi.

  JSON içe aktarımı DERLEME ANINDA gömülüyor, diskten okunmuyor. Aynı tuzak
  şema dosyalarında ölçülmüştü (`veri/semalar.mjs`): paketleyici modülü bir
  chunk'a taşıyor, yanındaki veri dosyasını taşımıyor ve panel üretimde
  ENOENT alıyor. İçe aktarım bu sorunu tanımıyor.

  Dosya YALNIZCA OKUNUYOR; sitenin hiçbir dosyası bu iş için değiştirilmedi.
*/

import iletisim from '../../icerik/iletisim-bilgisi.json';

/**
 * Sahibin adı ve unvanı. Alt çubuğun ilk satırı.
 *
 * Unvan sitedekiyle AYNI olmak zorunda: müşteri iki yüzü de görüyor ve
 * ikisinde farklı unvan okumak güven kırıyor. Sitedeki karşılığı
 * `src/icerik/metinler/iletisim.json` içindeki `rol` alanı; burada elle
 * tekrarlanmasının sebebi, o dosyanın iki dilli olması ve panelin tek dilli
 * olması. Biri değişirse öbürü de değişmeli.
 */
export const FIRMA_ADI = 'Mustafa Eybek';
export const FIRMA_UNVANI = 'Technical Solutions Developer';

/**
 * WhatsApp numarası: `wa.me` yalnızca rakam kabul ediyor.
 * Boşluklu yazılmış bir numara bağlantıyı sessizce bozuyordu; temizlik
 * sitede de aynı sebeple yapılıyor.
 */
export const WHATSAPP = String(iletisim.whatsapp ?? '').replace(/\D/g, '');

/** İnsanın okuyacağı biçim. Bağlantı yukarıdaki ham numaradan kuruluyor. */
export const TELEFON_GORUNEN = iletisim.telefonGorunen ?? '';

/** `tel:` bağlantısı için: artı işareti kalıyor, geri kalan temizleniyor. */
export const TELEFON_BAGLANTISI = WHATSAPP ? `+${WHATSAPP}` : '';

export const KONUM = iletisim.konum ?? '';

/**
 * Panelden açılan WhatsApp sohbetinde hazır bekleyen metin.
 *
 * Sitedeki karşılama metni DEĞİL: oraya gelen kişi tanıtım sayfasından
 * geliyor, buradaki kişi zaten müşteri ve bir işi soruyor.
 */
export const WHATSAPP_MESAJ = 'Merhaba Mustafa, müşteri panelinden yazıyorum.';

/** Alt çubuktaki WhatsApp adresi. Numara boşsa bağlantı hiç basılmıyor. */
export const WHATSAPP_BAGLANTISI = WHATSAPP
	? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(WHATSAPP_MESAJ)}`
	: '';

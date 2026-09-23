/*
  SUNUCUYA NE ÇIKAR: TEK KAYNAK.

  Bu liste iki yerden okunuyor: yönetim uygulamasının saf iş mantığı ve
  eşitleme katmanı. Tek kaynak olması şart, çünkü iki ayrı kopya tutulursa
  biri güncellenip öteki unutulur ve iki taraf birbirinin yazdığını tanımaz.

  Bu dosyanın hiçbir bağımlılığı yok (ne SQLite ne Electron), böylece her iki
  taraf da onu saflığını bozmadan içe aktarabiliyor.

  Kural beyaz liste: izin verilen alanlar tek tek sayılıyor, geri kalan her şey
  düşüyor. Kara liste yazmıyoruz, çünkü kara listeye yeni bir alan eklemeyi
  unutmak sessizce veri sızdırır; beyaz listede unutulan alan sadece
  gönderilmez ve bu fark edilir.

  Gerekçe ve neyin neden dışarıda kaldığı: PANEL-TASARIMI.md §4.
*/

export const IZINLI_ALANLAR = {
	'musteri.yaz': ['id', 'gorunen_ad', 'durum'],
	'musteri.sil': ['id'],
	'davet.yaz': ['id', 'musteri_id', 'anahtar_karmasi', 'son_kullanma'],
	'davet.iptal': ['id'],
	'is.yaz': ['id', 'musteri_id', 'ad', 'durum'],
	'is.sil': ['id'],
	'talep.durum': ['id', 'durum'],
	'talep.yanit': ['id', 'talep_id', 'metin', 'zaman'],
};

export const ISLEMLER = Object.keys(IZINLI_ALANLAR);

/*
  Beyaz listenin kendisine karşı ikinci emniyet kemeri.

  Beyaz liste, gövdede unutulan bir alanı zaten tutar. Tutamadığı tek durum
  şu: birisi ileride LİSTEYE hassas bir alan ekler. Aşağıdaki denetim modül
  yüklenirken çalışıyor, yani öyle bir alan eklenirse uygulama hiç açılmıyor
  ve bu sessiz kalmıyor.
*/
export const HASSAS_ALAN_DESENI =
	/(tutar|kurus|tc_|vergi|telefon|adres|ilce|sehir|iban|odeme|oran|revize|fiyat|bakiye)/i;

for (const [islem, alanlar] of Object.entries(IZINLI_ALANLAR)) {
	for (const alan of alanlar) {
		if (HASSAS_ALAN_DESENI.test(alan)) {
			throw new Error(
				`Eşitleme beyaz listesine hassas alan eklenmiş: ${islem}.${alan}. ` +
					'Bu alan sunucuya çıkamaz, bkz. PANEL-TASARIMI.md §4.',
			);
		}
	}
}

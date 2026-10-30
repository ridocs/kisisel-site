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

	/*
	  İş kaydı 24 Eylül 2026'da genişledi: tutar, para birimi ve hedef teslim
	  tarihi artık sunucuya çıkıyor. Sebebi sahibin kararı, müşteri kendi
	  ödeme dökümünü panelde görecek. Çıkmayanlar: ön ödeme oranı, maliyet,
	  iç notlar ve işin sahip tarafındaki ayrıntıları.
	*/
	'is.yaz': ['id', 'musteri_id', 'ad', 'durum', 'ozet', 'tutar_kurus', 'para_birimi', 'teslim_hedefi'],
	'is.sil': ['id'],

	/** Müşterinin gördüğü ödeme dökümü. Yöntem ve iç not yerelde kalıyor. */
	'odeme.yaz': ['id', 'is_id', 'tur', 'tutar_kurus', 'tarih'],
	'odeme.sil': ['id'],

	/** İlerleme ağacı aşaması. */
	'asama.yaz': ['id', 'is_id', 'sira', 'kaynak', 'baslik', 'aciklama', 'durum', 'tarih'],
	'asama.sil': ['id'],

	/*
	  Dosya künyesi. Dosyanın İÇERİĞİ bu kuyruktan gitmiyor, ayrıca
	  kopyalanıyor: kuyruk JSON ve büyük ikili veriyi taşımak için uygun değil.
	  `depo_adi` diskteki addır ve rastgele üretilir.
	*/
	'dosya.yaz': [
		'id', 'is_id', 'asama_id', 'gosterilen_ad', 'depo_adi',
		'tur', 'boyut', 'sha256', 'gorsel_mi',
	],
	'dosya.sil': ['id'],

	/** İş bazlı yazışmada sahibin yazdığı mesaj. */
	'is-mesaj.yaz': ['id', 'is_id', 'metin', 'zaman'],

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

  DESEN 24 EYLÜL 2026'DA DARALDI. Önce `tutar`, `kurus`, `odeme`, `oran`,
  `fiyat` gibi mali adlar da yasaklıydı; sahip müşterinin ödeme dökümünü
  görmesini isteyince tutar ve ödeme alanları bilinçli olarak serbest
  bırakıldı. Yasak kalanlar: kimlik numaraları, iletişim bilgileri, ödeme
  YÖNTEMİ, iç notlar ve maliyet. Yani müşterinin zaten bildiği rakam
  çıkabiliyor, işin iç yüzü çıkamıyor.
*/
export const HASSAS_ALAN_DESENI =
	/(tc_|vergi|telefon|adres|ilce|sehir|iban|yontem|not_metni|maliyet|kar_marj|iskonto|ozel_not)/i;

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

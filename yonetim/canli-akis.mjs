/*
  CANLI AKIŞIN UYGULAMA TARAFI

  NEDEN VAR

  Destek talebi yazışması yalnızca düzenli eşitlemeyle geliyordu: müşteri
  yazıyor, sahip onu üç dakika sonra görüyor. Yazışma sırasında üç dakika,
  sohbeti kullanılmaz hâle getiriyor. `veri/talep-akisi.mjs` sunucuya açık
  bir SSH bağlantısı tutuyor ve hareketleri oluştukça akıtıyor; bu dosya o
  akışın uygulama içindeki ömrünü yönetiyor: ne zaman başlar, ayarlar
  eksikken ne olur, ayar değişince ne olur, kapanırken ne olur.

  BU DOSYADA SSH VE ELECTRON YOK

  Akışın kendisi dışarıdan veriliyor (`akisBaslat`), ayarlar ve başlangıç
  damgası da öyle. Uygulamada bunlar gerçek SSH ve gerçek veritabanı,
  testte sahte bir başlatıcı. Böylece "ayar eksikken hiç başlamıyor",
  "kopunca uygulama çalışmaya devam ediyor" gibi davranışlar gerçek bir
  sunucuya bağlanmadan sınanabiliyor.

  AKIŞ EN İYİ ÇABA

  Akış koparsa veri kaybolmuyor: düzenli eşitleme onu yine getiriyor. Bu
  yüzden buradaki hiçbir hata uygulamayı durdurmuyor, yalnızca duruma
  yazılıyor ve ekranda görünüyor. Sessizce bozulmuş bir akış, olmayan
  akıştan kötüdür; bütün bu işin çıkış sebebi o.
*/

/** Akışın hiç başlamadığı, uygulamanın kapattığı durum. */
const KAPALI = 'kapali';
/** Bağlantı ayarları girilmediği için beklenen durum. */
const AYAR_EKSIK = 'ayar-eksik';

/**
 * Canlı akış yöneticisi.
 *
 * @param akisBaslat    (ayar, { baslangic, olay, durum }) => ({ durdur })
 * @param ayarlariOku   () => ayar nesnesi. Ayarlar eksikse FIRLATIYOR;
 *                      `veri/esitleme-ssh.mjs` içindeki `ayarlariOku` böyle.
 * @param baslangicOku  () => ISO damgası. Akış bundan sonrasını istiyor.
 * @param olayGeldi     (olay) => void. Akıştan gelen her hareket.
 * @param durumDegisti  (durum) => void. Bağlantı durumu her değiştiğinde.
 * @param simdiIso      () => ISO. Testte sahte saat verilebilsin diye.
 */
export function canliAkisYoneticisiKur({
	akisBaslat,
	ayarlariOku,
	baslangicOku,
	olayGeldi,
	durumDegisti = () => {},
	simdiIso = () => new Date().toISOString(),
}) {
	/** `baslat()` çağrıldı mı. Çağrılmadan hiçbir bağlantı açılmıyor:
	 *  testte ve uygulama kapanırken arkada akış kalmasın. */
	let calisiyor = false;
	let akis = null;

	let ad = KAPALI;
	let ayarTamam = false;
	let sonHata = null;
	let sonOlay = null;
	let degisti = null;
	/** Kaç kez bağlantı kurulmaya çalışıldı. Yeniden bağlanma akışın kendi
	 *  içinde, burası yalnızca sayıyor: ekranda "sekizinci deneme" demek,
	 *  "koptu" demekten daha çok şey anlatıyor. */
	let baglantiSayisi = 0;

	function durum() {
		return { ad, ayarTamam, sonHata, sonOlay, degisti, baglantiSayisi };
	}

	function bildir() {
		degisti = simdiIso();
		try {
			durumDegisti(durum());
		} catch {
			// Durum bildirimi başarısız olursa akış durmamalı: pencere
			// kapanmış olabilir, bu beklenen bir durum.
		}
	}

	function durumuYaz(yeniAd, hata = null) {
		ad = yeniAd;
		sonHata = hata;
		bildir();
	}

	/** Açık bağlantıyı kapatır. Durum yazmıyor: çağıran ne yazacağını
	 *  kendisi biliyor (kapandı mı, yeniden mi bağlanıyor). */
	function akisiKapat() {
		if (!akis) return;
		const eski = akis;
		akis = null;
		try {
			eski.durdur();
		} catch {
			// Kapatma hatası kapanmayı engellememeli.
		}
	}

	function bagla() {
		if (!calisiyor || akis) return;

		let ayar;
		try {
			ayar = ayarlariOku();
			ayarTamam = true;
		} catch (hata) {
			/*
			  Ayarlar eksikken BAŞLATILMIYOR ve sessizce bekleniyor. Denemek,
			  her seferinde aynı hatayı üretmek olurdu; kullanıcı ayarları
			  girdiğinde `ayarlariYenile()` zaten uyandırıyor.
			*/
			ayarTamam = false;
			durumuYaz(AYAR_EKSIK, hata?.message ?? String(hata));
			return;
		}

		let baslangic;
		try {
			baslangic = baslangicOku();
		} catch (hata) {
			durumuYaz('hata', hata?.message ?? String(hata));
			return;
		}

		baglantiSayisi += 1;
		try {
			akis = akisBaslat(ayar, {
				baslangic,
				olay: (nesne) => {
					/*
					  Tek bir bozuk olay bütün akışı düşürmemeli. Hata duruma
					  yazılıyor ve bağlantı olduğu yerde kalıyor.
					*/
					try {
						olayGeldi(nesne);
						sonOlay = simdiIso();
					} catch (hata) {
						sonHata = hata?.message ?? String(hata);
					}
					bildir();
				},
				durum: (d) => {
					ad = String(d?.ad ?? '');
					if (d?.hata) sonHata = String(d.hata);
					else if (d?.ad === 'canli') sonHata = null;
					bildir();
				},
			});
		} catch (hata) {
			// Süreç hiç başlatılamadı (ssh yok gibi). Uygulama çalışmaya
			// devam ediyor, düzenli eşitleme yerinde duruyor.
			akis = null;
			durumuYaz('hata', hata?.message ?? String(hata));
		}
	}

	/** Uygulama açılırken bir kez. Ayarlar eksikse hiçbir şey başlatmıyor. */
	function baslat() {
		calisiyor = true;
		bagla();
	}

	/** Uygulama kapanırken. Uzaktaki izleyici süreç de böyle sonlanıyor. */
	function durdur() {
		calisiyor = false;
		akisiKapat();
		durumuYaz(KAPALI);
	}

	/**
	 * Bağlantı ayarları değişti.
	 *
	 * Açık bağlantı kapatılıp yenisi kuruluyor: adres ya da anahtar
	 * değiştiyse eski bağlantı zaten yanlış yere bakıyor. Ayarlar eksikten
	 * tama döndüyse akış burada başlıyor.
	 */
	function ayarlariYenile() {
		if (!calisiyor) return durum();
		akisiKapat();
		bagla();
		return durum();
	}

	return { baslat, durdur, ayarlariYenile, durum };
}

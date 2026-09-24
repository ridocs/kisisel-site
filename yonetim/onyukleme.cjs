/*
  ÖN YÜKLEME: ARAYÜZÜN TEK KAPISI

  Renderer'da Node yok: `contextIsolation: true`, `nodeIntegration: false`,
  kum havuzu açık. Arayüz `require` diye bir şey görmüyor, dosya sistemine
  uzanamıyor, ağa çıkamıyor. Elindeki tek şey aşağıda adı geçen kanallar.

  Yüzey bilerek dar ve ADI BELLİ: genel bir `cagir(kanal, ...)` köprüsü
  yazılmadı, çünkü o köprü arayüzdeki herhangi bir kodun ana süreçteki
  HERHANGİ bir kanalı çağırmasına izin verirdi. Burada her işlev tek bir
  kanala bağlı.

  NEDEN `.cjs`: Electron'un ESM ön yükleme desteği yalnızca kum havuzu
  kapalıyken çalışıyor. Proje `"type": "module"` olduğu için uzantı `.cjs`
  olmak zorunda, `.js` olsaydı Node bunu ESM sanıp "require is not defined"
  derdi.
*/

const { contextBridge, ipcRenderer } = require('electron');

/** Cevap kalıbı ana süreçte `{ tamam, veri | hata }`. Hata burada gerçek
 *  bir `Error`a çevriliyor ki arayüzde `try/catch` doğal dursun. */
async function cagir(kanal, ...argumanlar) {
	const cevap = await ipcRenderer.invoke(kanal, ...argumanlar);
	if (!cevap || cevap.tamam !== true) {
		throw new Error(cevap?.hata ?? 'Bilinmeyen hata.');
	}
	return cevap.veri;
}

contextBridge.exposeInMainWorld('yonetim', {
	durumOku: () => cagir('durum:oku'),

	musteri: {
		liste: (secenek) => cagir('musteri:liste', secenek),
		getir: (id) => cagir('musteri:getir', id),
		kaydet: (kayit) => cagir('musteri:kaydet', kayit),
		durum: (id, durum) => cagir('musteri:durum', id, durum),
	},

	is: {
		liste: (secenek) => cagir('is:liste', secenek),
		getir: (id) => cagir('is:getir', id),
		kaydet: (kayit) => cagir('is:kaydet', kayit),
		sil: (id) => cagir('is:sil', id),
	},

	odeme: {
		liste: (secenek) => cagir('odeme:liste', secenek),
		kaydet: (kayit) => cagir('odeme:kaydet', kayit),
		sil: (id) => cagir('odeme:sil', id),
	},

	revize: {
		liste: (secenek) => cagir('revize:liste', secenek),
		kaydet: (kayit) => cagir('revize:kaydet', kayit),
		sil: (id) => cagir('revize:sil', id),
	},

	/** İlerleme ağacı. Otomatik aşamalar iş kaydedilirken düşüyor; bunlar
	 *  sahibin elle eklediklerini yönetiyor. */
	asama: {
		liste: (isId) => cagir('asama:liste', isId),
		kaydet: (kayit) => cagir('asama:kaydet', kayit),
		sil: (id) => cagir('asama:sil', id),
	},

	dosya: {
		liste: (isId) => cagir('dosya:liste', isId),
		/**
		 * Dosya seçiciyi ana süreçte açar. Arayüz bir YOL GÖNDEREMİYOR:
		 * seçim ana süreçte yapılıyor, buradan yalnızca "seçici aç" isteği
		 * gidiyor. Kum havuzundaki bir sayfaya dosya sistemine açılan bir
		 * kapı vermenin gereği yok.
		 */
		ekle: (isId, asamaId) => cagir('dosya:ekle', isId, asamaId),
		// Ağa çıkan tek dosya çağrısı bu; gönderim başarısızsa hata metni
		// olduğu gibi geliyor ve künye kuyruğa yazılmıyor.
		paylas: (id) => cagir('dosya:paylas', id),
		paylasimiGeriAl: (id) => cagir('dosya:paylasimi-geri-al', id),
		sil: (id) => cagir('dosya:sil', id),
		/** Görsel için `data:` adresi, önizlenemiyorsa `null`. */
		onizleme: (id) => cagir('dosya:onizleme', id),
	},

	isMesaj: {
		liste: (isId) => cagir('is-mesaj:liste', isId),
		// Talep yanıtıyla aynı: sunucuya değil kuyruğa gidiyor.
		yaz: (isId, metin) => cagir('is-mesaj:yaz', isId, metin),
	},

	istatistik: {
		ay: (ay) => cagir('istatistik:ay', ay),
		aylar: () => cagir('istatistik:aylar'),
	},

	davet: {
		// Dönen anahtar metni hiçbir yere kaydedilmiyor; ekran kapanınca gidiyor.
		uret: (musteriId) => cagir('davet:uret', musteriId),
	},

	kuyruk: {
		bekleyen: () => cagir('kuyruk:bekleyen'),
	},

	esitleme: {
		ozet: () => cagir('esitleme:ozet'),
		ayarYaz: (form) => cagir('esitleme:ayar-yaz', form),
		// Otomatik eşitlemenin açık/kapalı olması ve dinleme aralığı.
		otomatikYaz: (form) => cagir('esitleme:otomatik-yaz', form),
		durum: () => cagir('esitleme:durum'),
		// Uzun sürebilir ve ağa çıkan tek çağrı bu. Hata metni olduğu gibi
		// geliyor: SSH'ın söyledikleri kullanıcıya gösterilecek.
		calistir: () => cagir('esitleme:calistir'),
		/**
		 * Otomatik eşitlemenin durumu değiştikçe ana süreç haber veriyor.
		 * `ekranDinle` ile aynı kalıp: yalnızca dinleme yönü açık, arayüz bu
		 * kanaldan ana sürece bir şey gönderemiyor, olay nesnesi geçmiyor.
		 */
		durumDinle: (islev) => {
			ipcRenderer.on('esitleme:durum', (_olay, durum) => islev(durum));
		},
	},

	talep: {
		liste: (secenek) => cagir('talep:liste', secenek),
		getir: (id) => cagir('talep:getir', id),
		// Yanıt sunucuya değil, eşitleme kuyruğuna gidiyor.
		yanitla: (talepId, metin) => cagir('talep:yanitla', talepId, metin),
		durum: (talepId, durum) => cagir('talep:durum', talepId, durum),

		/** Canlı akışın bağlantı durumu. Açılışta bir kez soruluyor. */
		akisDurumu: () => cagir('talep:akis-durum'),
		/**
		 * Akıştan gelen hareket. Gövde YOK: yalnızca "şu talepte şu kimlikte
		 * bir hareket oldu" bilgisi geliyor, metni arayüz `getir` ile
		 * veritabanından okuyor. `ekranDinle` ile aynı kalıp: yalnızca
		 * dinleme yönü açık, olay nesnesi geçmiyor.
		 */
		akisDinle: (islev) => {
			ipcRenderer.on('talep:akis-olayi', (_olay, hareket) => islev(hareket));
		},
		/** Bağlantı durumu değiştikçe. Sessizce bozulmuş bir akış, olmayan
		 *  akıştan kötüdür; gösterge bu kanaldan besleniyor. */
		akisDurumDinle: (islev) => {
			ipcRenderer.on('talep:akis-durumu', (_olay, akisDurumu) => islev(akisDurumu));
		},
	},

	panoyaYaz: (metin) => cagir('pano:yaz', metin),
	onaySor: (baslik, mesaj) => cagir('onay:sor', baslik, mesaj),

	/**
	 * Menüden gelen ekran değiştirme isteği. Yalnızca dinleme yönü açık;
	 * arayüz bu kanaldan ana sürece bir şey GÖNDEREMİYOR. Olay nesnesi de
	 * geçirilmiyor: içinde `sender` var ve onu arayüze vermenin gereği yok.
	 */
	ekranDinle: (islev) => {
		ipcRenderer.on('ekran:git', (_olay, anahtar) => islev(String(anahtar)));
	},
});

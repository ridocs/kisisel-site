const { webFrame } = require('electron');

/*
  KEYSTATIC KABUĞU — KOYU TEMA VE TÜRKÇELEŞTİRME

  Bu dosya panelin yüklediği HER sayfaya, sayfanın kendi JavaScript'i
  çalışmadan ÖNCE giriyor (Electron `preload`). İki iş yapıyor: Keystatic'i
  koyu temayla açtırıyor ve arayüzündeki İngilizce dizgeleri Türkçeye
  çeviriyor.

  NEDEN SAYFANIN İÇİNDE DEĞİL DE BURADA

  Keystatic bizim yazdığımız bir sayfa değil, `node_modules` içindeki
  derlenmiş bir React uygulaması. Ne bileşenlerine dokunabiliyoruz ne de
  rotasına kendi betiğimizi koyabiliyoruz — `/keystatic` rotasını eklenti
  açıyor ve gövdesi tek bir `client:only` adasından ibaret. Geriye iki yol
  kalıyor: paketi yamalamak (bir sonraki `npm ci` siler) ya da pencereyi
  kuran taraftan girmek. Burası o taraf.

  NEDEN `.cjs`

  Electron'un ESM preload desteği yalnızca kum havuzu KAPALI iken çalışıyor;
  bizim pencerede `contextIsolation` açık ve kum havuzu varsayılan hâliyle
  açık. Kum havuzundaki preload CommonJS olmak zorunda. Proje
  `"type": "module"` olduğu için uzantı `.cjs` — `.js` olsaydı Node bunu ESM
  sanıp "require is not defined" derdi.
*/

/*
  YALNIZCA KEYSTATIC SAYFALARINDA ÇALIŞIYOR.

  Preload pencerenin yüklediği HER belgeye giriyor: `/istatistik`,
  `/kontrol`, `/durum` ve yereldeki `baslatiliyor.html` ile `hata.html` de
  dahil. O dört sayfa bu paketin kendi kodu; zaten koyu ve zaten Türkçe.
  Oralarda çalışmak iki şekilde zarar verirdi: aşağıdaki zemin CSS'i yazar
  stil sayfası olarak EN SONA ekleniyor, yani sayfanın kendi `body` kuralını
  eziyor; ve sözlükteki "Code", "Table", "Link" gibi teknik sözcükler o
  sayfalarda İngilizce kalması gereken yerlerde geçebiliyor.

  Bu yüzden kapı en başta: Keystatic değilse dosya hiçbir şey yapmadan
  dönüyor. Üst düzey `return` burada geçerli — CommonJS modülü zaten bir
  fonksiyonun içine sarılarak çalıştırılıyor.
*/
if (!location.pathname.startsWith('/keystatic')) return;

/* ------------------------------------------------------------------ */
/* 1) Koyu tema                                                        */
/* ------------------------------------------------------------------ */

/*
  TEMA SABİT KOYU — işletim sistemine BAĞLANMADI.

  `nativeTheme.shouldUseDarkColors` ile sistemin tercihine uymak da
  düşünüldü ve reddedildi: panelin öbür üç sayfası (`/istatistik`,
  `/kontrol`, `/durum`) koyu sabit. Sisteme bağlasaydık açık temalı bir
  makinede aynı pencerenin bir sekmesi bembeyaz, öbür üçü koyu olurdu —
  tema seçeneği sunmak değil, tutarsızlık üretmek olurdu bu.

  KOYU YALNIZCA VARSAYILAN — kullanıcının seçimi korunuyor.

  Önce her yüklemede `dark` yazılıyordu. Tema koyu geliyordu ama kenar
  çubuğundaki seçici işe yaramıyordu: kullanıcı açık temaya geçse bile panel
  yeniden açıldığında koyuya dönüyordu, çünkü bu satır tercihi eziyordu.
  Çalışmayan bir düğme, hiç olmayan düğmeden kötü.

  Artık yalnızca HİÇ tercih kaydedilmemişse yazılıyor. İlk açılışta koyu
  geliyor (öbür üç panelle tutarlı), sonrasında seçici gerçekten çalışıyor ve
  seçim kalıcı oluyor.

  Keystatic tercihi `localStorage` içinde tutuyor ve değeri React ilk
  çizimde, `useState` başlatıcısında okuyor. Yani buraya yazmak yetiyor;
  sonradan (`DOMContentLoaded`, `load`) yazmak geç kalır ve sayfa önce açık
  temada boyanırdı.
*/
const TEMA_ANAHTARI = 'keystatic-color-scheme';
let temaKoyuMu = true;
try {
	const kayitli = localStorage.getItem(TEMA_ANAHTARI);
	if (kayitli === null) {
		localStorage.setItem(TEMA_ANAHTARI, 'dark');
	} else {
		// Kullanıcı açık temayı seçtiyse aşağıdaki zemin CSS'i de açık olmalı;
		// koyu zemin basıp üstüne açık tema çizilirse ilk kare ters renkte
		// yanıp sönüyor.
		temaKoyuMu = kayitli !== 'light';
	}
} catch {
	// localStorage kapalıysa tema seçimi kaybolur ama panel çalışmalı.
	// Aşağıdaki CSS zaten zemini koyu tutuyor.
}

/*
  BEYAZ PARLAMAYA KARŞI İKİNCİ KAT.

  Yukarıdaki satır Keystatic'i koyu açtırıyor, ama React bağlanana kadar
  geçen sürede gövdeyi boyayan kimse yok: o aralıkta sayfa tarayıcının
  varsayılan beyazıyla duruyor. Ölçülen renkler Keystatic'in kendi koyu
  ölçeğinden alındı — `--kui-color-scale-slate1` (#1f1f1f, tuval) ve
  `slate2` (#252525, gövde). İkisi de nötr gri, chroma sıfır.

  `webFrame.insertCSS` bilinçli: preload çalışırken `<head>` henüz yok, bu
  yüzden `<style>` eklemek işe yaramıyor. Bu çağrı stili belgeye belge
  oluşmadan iliştiriyor ve yalnızca bu belge için geçerli — gezinmede
  kendiliğinden düşüyor, preload da her gezinmede yeniden çalışıyor.

  `color-scheme` de burada: kaydırma çubuğu ve yerel form denetimleri
  React'ten bağımsız, tarayıcının kendi çizdiği parçalar.

  Renkler kullanıcının tercihine göre seçiliyor. Sabit koyu bassaydık açık
  temayı seçmiş birinde ilk kare koyu, sonraki kare açık olurdu — parlamayı
  önlemek için eklenen kat, ters yönde parlama üretirdi. Açık ölçek de
  Keystatic'in kendi değerlerinden: `#ffffff` tuval, `#f6f6f6` gövde.
*/
const zemin = temaKoyuMu
	? { sema: 'dark', tuval: '#1f1f1f', govde: '#252525' }
	: { sema: 'light', tuval: '#ffffff', govde: '#f6f6f6' };

webFrame.insertCSS(`
	:root { color-scheme: ${zemin.sema}; background-color: ${zemin.tuval}; }
	body { background-color: ${zemin.govde}; }
`);

/* ------------------------------------------------------------------ */
/* 2) Türkçeleştirme — sözlük                                          */
/* ------------------------------------------------------------------ */

/*
  NEDEN KEYSTATIC'İN KENDİ ÇEVİRİSİ KULLANILMIYOR

  Keystatic'in içinde react-aria üzerinden çalışan bir dizge tablosu var ve
  tabloda `tr-TR` de bulunuyor. Kullanılmadı, çünkü içeriği güvenilmez:
  `"add": "Avbryt"` yazıyor — "Avbryt" İsveççe ve "iptal" demek, yani
  "Ekle" düğmesi "İptal" olurdu. `"save": "Kaydetmek"`, `"create":
  "Yaratmak"`, `"collection": "Toplamak"` — hepsi düğme etiketi olması
  gereken yerde mastar. Üstelik o tablo topu topu 28 anahtar; ekranda
  gördüğümüz dizgelerin çoğu (Dashboard dışındakiler) zaten orada yok.

  Ayrıca tablo dili `useLocale()` ile, yani tarayıcı diliyle seçiliyor:
  uygulamanın dilini Türkçeye çevirmek bu bozuk çevirileri açardı ve
  aşağıdaki sözlüğün eşleştiği İngilizce kaynak dizgeleri de kaydırırdı.
  Dil İngilizce bırakıldı; çeviri tek yerden, buradan yapılıyor.

  SÖZLÜK TAM EŞLEŞMEYLE ÇALIŞIYOR — parça değiştirme YOK.

  Bir metin düğümü ancak kırpılmış hâli anahtarla BİREBİR aynıysa
  değişiyor. "Save" anahtarı, içinde "Save" geçen bir cümleye dokunmuyor.
  Bu, kullanıcının yazısını bozmamanın ilk ve en önemli güvencesi; ikincisi
  aşağıdaki düzenlenebilir alan elemesi.
*/
const SOZLUK = new Map(Object.entries({
	// Kabuk ve gezinme
	Dashboard: 'Gösterge paneli',
	Collections: 'Koleksiyonlar',
	Collection: 'Koleksiyon',
	'Open app navigation': 'Uygulama gezinmesini aç',
	Resize: 'Yeniden boyutlandır',
	Breadcrumbs: 'Kırıntı yolu',
	theme: 'tema',
	Light: 'Açık',
	Dark: 'Koyu',
	System: 'Sistem',
	'Log out': 'Çıkış yap',
	Account: 'Hesap',
	Home: 'Ana sayfa',
	Help: 'Yardım',

	// Koleksiyon listesi
	Add: 'Ekle',
	Slug: 'Adres',
	Search: 'Ara',
	'show search': 'aramayı göster',
	Clear: 'Temizle',
	'Clear selection': 'Seçimi temizle',
	'No results': 'Sonuç yok',
	'No results…': 'Sonuç yok…',
	'No items selected…': 'Seçili öge yok…',
	'No more items…': 'Başka öge yok…',
	'Empty collection': 'Boş koleksiyon',
	'Create the first entry': 'İlk yazıyı oluştur',
	'Unable to load collection': 'Koleksiyon yüklenemedi',
	'Loading Entries': 'Yazılar yükleniyor',
	'Loading Item': 'Kayıt yükleniyor',
	'Loading more…': 'Daha fazlası yükleniyor…',
	Loading: 'Yükleniyor',
	'sortable column': 'sıralanabilir sütun',
	'Column resizer': 'Sütun genişliği tutamacı',
	'Not found': 'Bulunamadı',
	'Entry not found.': 'Kayıt bulunamadı.',
	'This page could not be found.': 'Bu sayfa bulunamadı.',
	'Failed to load shell': 'Panel kabuğu yüklenemedi',

	// Kayıt işlemleri
	Save: 'Kaydet',
	Create: 'Oluştur',
	Reset: 'Geri al',
	'Reset changes': 'Değişiklikleri geri al',
	'Delete entry': 'Yazıyı sil',
	'Delete entry…': 'Yazıyı sil…',
	'Duplicate entry': 'Yazıyı çoğalt',
	'Duplicate entry…': 'Yazıyı çoğalt…',
	'Copy entry': 'Yazıyı kopyala',
	'Paste entry': 'Yazıyı yapıştır',
	'Save and duplicate entry': 'Kaydet ve yazıyı çoğalt',
	'You have unsaved changes. Save this entry to duplicate it.':
		'Kaydedilmemiş değişiklikler var. Çoğaltmak için önce kaydet.',
	'Are you sure? This action cannot be undone.':
		'Emin misin? Bu işlem geri alınamaz.',
	// Silme onay kutusundaki asıl düğme. Ölçüldü: metni "Delete" değil,
	// "Yes, delete" — ilk turda gözden kaçmıştı.
	'Yes, delete': 'Evet, sil',
	'Contains invalid fields. Please edit.': 'Geçersiz alanlar var, düzeltmen gerekiyor.',
	'Other changes have been made to this entry since the draft. You may want to discard the draft changes.':
		'Taslaktan sonra bu kayıtta başka değişiklikler yapılmış. Taslağı atmak isteyebilirsin.',
	'Entry created': 'Yazı oluşturuldu',
	'Entry pasted': 'Yazı yapıştırıldı',
	'Entry not found in clipboard': 'Panoda yazı yok',
	'Failed to update': 'Güncellenemedi',
	'Failed to read clipboard': 'Pano okunamadı',
	'Failed to paste because clipboard access was denied':
		'Panoya erişim reddedildiği için yapıştırılamadı',
	'Creating entry': 'Yazı oluşturuluyor',
	Unsaved: 'Kaydedilmedi',
	Changed: 'Değişti',
	Added: 'Eklendi',
	Ignored: 'Yok sayıldı',
	Delete: 'Sil',
	Cancel: 'Vazgeç',
	Edit: 'Düzenle',
	Done: 'Bitti',
	Dismiss: 'Kapat',
	Preview: 'Önizleme',
	Insert: 'Ekle',
	Options: 'Seçenekler',
	Actions: 'İşlemler',
	'Actions available.': 'İşlemler var.',
	Empty: 'Boş',
	Items: 'Ögeler',
	Item: 'Öge',

	// Dizi (array) alanları
	'Add item': 'Öge ekle',
	'Edit item': 'Ögeyi düzenle',
	Remove: 'Kaldır',
	'Empty list': 'Liste boş',
	'Add the first item to see it here.': 'İlk ögeyi ekle, burada görünsün.',
	'Click to start dragging.': 'Sürüklemeye başlamak için tıkla.',
	Collapse: 'Daralt',
	Expand: 'Genişlet',

	// Alan yardımcıları
	Regenerate: 'Yeniden üret',
	regenerate: 'yeniden üret',
	'Choose file': 'Dosya seç',
	'File name': 'Dosya adı',
	Filename: 'Dosya adı',
	'Alt text': 'Metin karşılığı',
	'This text will be used by screen readers and search engines.':
		'Bu metni ekran okuyucular ve arama motorları kullanıyor.',
	Title: 'Başlık',
	Content: 'İçerik',
	Text: 'Metin',
	Kind: 'Tür',
	Language: 'Dil',
	Layout: 'Yerleşim',
	Layouts: 'Yerleşimler',

	// Metin editörü — araç çubuğu
	Paragraph: 'Paragraf',
	'Heading 1': 'Başlık 1',
	'Heading 2': 'Başlık 2',
	'Heading 3': 'Başlık 3',
	'Heading 4': 'Başlık 4',
	'Heading 5': 'Başlık 5',
	'Heading 6': 'Başlık 6',
	Heading: 'Başlık',
	'Text block': 'Metin bloğu',
	'Formatting options': 'Biçimlendirme seçenekleri',
	'Text formatting': 'Metin biçimlendirme',
	Bold: 'Kalın',
	Italic: 'Eğik',
	Strikethrough: 'Üstü çizili',
	Underline: 'Altı çizili',
	Subscript: 'Alt simge',
	Superscript: 'Üst simge',
	Code: 'Kod',
	'Clear formatting': 'Biçimlendirmeyi temizle',
	Lists: 'Listeler',
	'Bullet list': 'Madde listesi',
	'Bullet List': 'Madde listesi',
	'Numbered list': 'Numaralı liste',
	'Numbered List': 'Numaralı liste',
	'Ordered list': 'Numaralı liste',
	Blocks: 'Bloklar',
	'Insert block': 'Blok ekle',
	'Insert menu': 'Ekleme menüsü',
	Divider: 'Ayırıcı',
	Quote: 'Alıntı',
	Blockquote: 'Alıntı',
	'Code block': 'Kod bloğu',
	'Code Block': 'Kod bloğu',
	'Code block language': 'Kod bloğunun dili',
	'Plain text': 'Düz metin',
	Table: 'Tablo',
	Image: 'Görsel',
	Link: 'Bağlantı',
	Unlink: 'Bağlantıyı kaldır',
	'Start writing or press "/" for commands…':
		'Yazmaya başla ya da komutlar için "/" tuşuna bas…',
	'A horizontal line to separate content': 'İçeriği ayıran yatay çizgi',
	'Display code with syntax highlighting': 'Kodu sözdizimi renklendirmesiyle göster',
	'Insert a quote or citation': 'Alıntı ekle',
	'Insert a table': 'Tablo ekle',
	'Insert an image': 'Görsel ekle',
	'Insert an ordered list': 'Numaralı liste ekle',
	'Insert an unordered list': 'Madde listesi ekle',
	'Use this for a top level heading': 'En üst düzey başlık için',
	'Use this for key sections': 'Ana bölümler için',
	'Use this for sub-sections': 'Alt bölümler için',
	'Use this for deep headings': 'Derindeki başlıklar için',
	'Use this for low-level headings': 'En alt düzey başlıklar için',
	'Use this for grouping list items': 'Liste ögelerini gruplamak için',

	// Metin editörü — tablo ve görsel
	'Header row': 'Başlık satırı',
	'Insert column right': 'Sağa sütun ekle',
	'Insert row below': 'Alta satır ekle',
	'Delete column': 'Sütunu sil',
	'Delete row': 'Satırı sil',
	'Select Column': 'Sütunu seç',
	'Select Row': 'Satırı seç',
	'Select Table': 'Tabloyu seç',
	'Cell options': 'Hücre seçenekleri',
	'Text Alignment': 'Metin hizalama',
	'Align Start': 'Başa hizala',
	'Align Center': 'Ortaya hizala',
	'Align End': 'Sona hizala',
	'Image details': 'Görsel bilgileri',
	'Edit Image Options': 'Görsel seçeneklerini düzenle',
	'Remove Image': 'Görseli kaldır',
	Width: 'Genişlik',
	Height: 'Yükseklik',
	'Constrain proportions': 'Oranı koru',
	'Images must be smaller than 10MB': 'Görseller 10MB’tan küçük olmalı',
	'Invalid image type, only PNG, JPEG, GIF, and WebP are supported':
		'Geçersiz görsel türü; yalnızca PNG, JPEG, GIF ve WebP destekleniyor',
	'Image uploaded': 'Görsel yüklendi',
	'Image URL': 'Görsel adresi',
	'Image URL is required.': 'Görsel adresi zorunlu.',
	'Awaiting URL to display image preview and information…':
		'Önizleme ve bilgi için adres bekleniyor…',
}));

/*
  KALIPLAR — içinde sayı ya da alan adı geçen dizgeler.

  Hepsi `^…$` ile çapalı: yine TAM eşleşme, yalnızca değişkeni yakalamak
  için kalıp. "7 entries" gibi bir düğüm bütünüyle eşleşiyorsa değişiyor,
  içinde bu cümle geçen bir paragraf değişmiyor.

  Alan adını taşıyan doğrulama cümleleri buranın asıl sebebi: Keystatic
  alan etiketini (bizde Türkçe) İngilizce bir cümleye gömüyor ve ortaya
  "Başlık must not be empty" gibi yarı Türkçe bir satır çıkıyor.
*/
const KALIPLAR = [
	[/^(\d+) entries$/, (e) => `${e[1]} kayıt`],
	[/^(\d+) entry$/, (e) => `${e[1]} kayıt`],
	[/^Item (\d+)$/, (e) => `${e[1]}. öge`],
	/*
	  Sütun adı da sözlükten geçiriliyor: başlık hücresinde "Slug" artık
	  "Adres" yazıyor ama react-aria bu cümleyi sütunun özgün metninden
	  üretiyor ve "Slug sütununa göre artan sırada" gibi yarı İngilizce bir
	  duyuru çıkıyordu.
	*/
	[/^sorted by column (.+) in ascending order$/, (e) => `${cevir(e[1]) ?? e[1]} sütununa göre artan sırada`],
	[/^sorted by column (.+) in descending order$/, (e) => `${cevir(e[1]) ?? e[1]} sütununa göre azalan sırada`],
	[/^Drag (.+)$/, (e) => `${e[1]} ögesini sürükle`],
	[/^No items matching "(.+)" were found\.$/, (e) => `"${e[1]}" ile eşleşen öge bulunamadı.`],

	// Alan doğrulaması
	[/^(.+) must not be empty$/, (e) => `${e[1]} boş bırakılamaz`],
	[/^(.+) is required$/, (e) => `${e[1]} zorunlu`],
	[/^(.+) must be unique$/, (e) => `${e[1]} benzersiz olmalı`],
	[/^(.+) must be at least (\d+) characters long$/, (e) => `${e[1]} en az ${e[2]} karakter olmalı`],
	[/^(.+) must be no longer than (\d+) characters$/, (e) => `${e[1]} en çok ${e[2]} karakter olabilir`],
	[/^(.+) must not contain slashes$/, (e) => `${e[1]} eğik çizgi içeremez`],
	[/^(.+) must not start or end with spaces$/, (e) => `${e[1]} boşlukla başlayıp bitemez`],
	[/^(.+) must not contain \.\.$/, (e) => `${e[1]} ".." içeremez`],
	[/^(.+) must not be \.\.?$/, (e) => `${e[1]} yalnızca nokta olamaz`],
	[/^(.+) must match the pattern (.+)$/, (e) => `${e[1]} şu kalıba uymalı: ${e[2]}`],
	[/^(.+) must be a number$/, (e) => `${e[1]} sayı olmalı`],
	[/^(.+) must be a whole number$/, (e) => `${e[1]} tam sayı olmalı`],
	[/^(.+) must be at least (.+)$/, (e) => `${e[1]} en az ${e[2]} olmalı`],
	[/^(.+) must be at most (.+)$/, (e) => `${e[1]} en çok ${e[2]} olmalı`],
	[/^(.+) must be a multiple of (.+)$/, (e) => `${e[1]}, ${e[2]} katı olmalı`],
	[/^(.+) must be after (.+)$/, (e) => `${e[1]}, ${e[2]} tarihinden sonra olmalı`],
	[/^(.+) must be no later than (.+)$/, (e) => `${e[1]}, ${e[2]} tarihinden sonra olamaz`],
	[/^Must have at least (\d+) elements?$/, (e) => `En az ${e[1]} öge olmalı`],
	[/^Must have at most (\d+) elements?\}?$/, (e) => `En çok ${e[1]} öge olabilir`],
];

/** Bir dizgenin Türkçesi; yoksa `null` — bulunamayan dizge İngilizce kalıyor. */
function cevir(kaynak) {
	const temiz = kaynak.trim();
	if (!temiz) return null;
	const dogrudan = SOZLUK.get(temiz);
	if (dogrudan !== undefined) return dogrudan;
	for (const [desen, uret] of KALIPLAR) {
		const eslesme = temiz.match(desen);
		if (eslesme) return uret(eslesme);
	}
	return null;
}

/* ------------------------------------------------------------------ */
/* 3) Türkçeleştirme — neye DOKUNULMAYACAĞI                            */
/* ------------------------------------------------------------------ */

/*
  BURASI BU DOSYANIN EN KRİTİK PARÇASI.

  Çeviri DOM'daki metni değiştiriyor. Kullanıcının yazdığı makale de
  DOM'da. İkisini ayırmanın yolu, düzenlenebilir ve içerik taşıyan her
  bölgeyi baştan dışarıda bırakmak.

  METİN için yasak olanlar:

  - `input`, `textarea`: bir `textarea`nın metin düğümü DEĞERİNİN
    KENDİSİDİR. Orada bir düğümü değiştirmek doğrudan kaydedilecek veriyi
    değiştirir. Mutlak yasak.
  - `[contenteditable]`, `.ProseMirror`, `[role="textbox"]`: yazı gövdesinin
    editörü. Hem kullanıcının metni burada hem de ProseMirror kendi
    belgesini DOM'dan okuyor. Tek istisna aşağıda.
  - `code`, `pre`: kod örneği. Çevirmek zaten yanlış olurdu.
  - `script`, `style`, `title`: metin düğümü ama ekranda görünen metin
    değil.
  - Yazı listesinin VERİ hücreleri: aşağıda ayrıca anlatıldı.

  TEK İSTİSNA — ProseMirror pencere ögeleri (`widget`).

  Editörün "Yazmaya başla…" yer tutucusu düzenlenebilir alanın İÇİNDE
  duruyor, yani yukarıdaki kural onu da kapatıyordu. Ama o bir belge
  parçası değil: ProseMirror onu `widget` süslemesi olarak çiziyor,
  `contenteditable="false"` işaretli ve belgeyi okurken hiç görülmüyor.
  Ölçüldü — DOM'daki hâli şu:

      <span class="ProseMirror-placeholder ProseMirror-widget"
            contenteditable="false">Start writing or press "/" …</span>

  Süslemenin metnini değiştirmek kaydedilen belgeyi etkilemiyor; bu yüzden
  `.ProseMirror-widget` içi çeviriye açık, editörün geri kalanı kapalı.

  NİTELİKLER için eleme DAHA DAR.

  `aria-label` ve `placeholder` kullanıcı verisi değil, arayüz metni —
  bir `input`un `placeholder`ını çevirmek `value`suna dokunmuyor. Metin
  için `input`u komple kapatmak doğru, nitelik için yanlıştı: arama
  kutusunun "Search" yazısı bu yüzden İngilizce kalmıştı. Bu yüzden iki
  ayrı eleme var.

  IZGARA HÜCRELERİ — KULLANICI DEĞERİNİN DURDUĞU YER

  Hem yazı listesi hem de dizi (array) alanları `[role="grid"]` kullanıyor;
  değerler `[role="gridcell"]` ve `[role="rowheader"]` hücrelerinde duruyor.
  Ölçüldü: yazı başlığı bir `rowheader`, etiket adı bir `gridcell` içinde.

  Bu hücreler ölçülmeden önce iki kez yanlış kuruldu, ikisi de kayda değer:

  1. Hücreleri tamamen kapatmak. O zaman dizi alanının kendi arayüz metni de
     kapanıyordu — "Empty list" ve "Add the first item to see it here."
     İngilizce kalmıştı, çünkü ikisi de bir `gridcell` içinde.
  2. Hücreleri tamamen açmak. O zaman KULLANICININ VERİSİ çevriliyordu:
     etiketi "Code" olan bir yazıda panel "Kod" gösteriyordu. Dosyaya
     doğru yazılıyordu ama ekranda kullanıcının yazdığı şey değişmişti —
     tam da kaçınılması istenen şey.

  Şimdiki kural: hücrelerin içinde YALNIZCA aşağıdaki kısa liste
  çevriliyor. Hepsi dizi alanının kendi arayüz metni; hiçbiri bir başlık ya
  da etiket değeri olarak makul değil. Listede olmayan her şey — yani
  kullanıcının yazdığı her şey — olduğu gibi kalıyor.

  Elemenin yönü de önemli: düğümün ATALARINA bakılıyor, kendisine değil.
  Yasak bölgenin içindeki her derinlik böylece kapanıyor.
*/
const DUZENLENEBILIR_SECICI =
	'[contenteditable], [contenteditable="true"], .ProseMirror, [role="textbox"]';
const METIN_YASAK_SECICI =
	`input, textarea, ${DUZENLENEBILIR_SECICI}, code, pre, script, style, title`;
const NITELIK_YASAK_SECICI = `${DUZENLENEBILIR_SECICI}, script, style`;
const SUSLEME_SECICI = '.ProseMirror-widget, .ProseMirror-placeholder';
const VERI_HUCRESI_SECICI = 'td, [role="gridcell"], [role="rowheader"]';

/** Izgara hücresi içinde çevrilmesine izin verilen arayüz metinleri. */
const HUCREDE_IZINLI = new Set([
	'Empty list',
	'Add the first item to see it here.',
	'Add item',
	'Edit item',
	'Remove',
	'Click to start dragging.',
	'Collapse',
	'Expand',
]);
/** Hücre içinde izinli kalıplar: "Item 3", "Drag Flutter". */
const HUCREDE_IZINLI_KALIP = [/^Item \d+$/, /^Drag .+$/];

function hucredeCevrilebilirMi(kaynak) {
	const temiz = kaynak.trim();
	return HUCREDE_IZINLI.has(temiz) || HUCREDE_IZINLI_KALIP.some((d) => d.test(temiz));
}

function elemanBul(dugum) {
	return dugum.nodeType === Node.ELEMENT_NODE ? dugum : dugum.parentElement;
}

/**
 * Bu düğümün metni/niteliği çevrilebilir mi?
 *
 * `nitelikMi` ayrımı şart: `input` ve `textarea`nın METNİ değerinin
 * kendisi, ama `placeholder`ı arayüz metni. İkisini aynı kefeye koymak
 * arama kutusunun "Search" yazısını İngilizce bırakıyordu.
 */
function cevrilebilirMi(dugum, kaynak, nitelikMi) {
	const eleman = elemanBul(dugum);
	if (!eleman) return false;
	if (eleman.closest(SUSLEME_SECICI)) return true;
	if (eleman.closest(nitelikMi ? NITELIK_YASAK_SECICI : METIN_YASAK_SECICI)) return false;
	if (eleman.closest(VERI_HUCRESI_SECICI)) return hucredeCevrilebilirMi(kaynak);
	return true;
}

/* ------------------------------------------------------------------ */
/* 4) Türkçeleştirme — uygulama                                        */
/* ------------------------------------------------------------------ */

// Yalnızca arayüz metni taşıyan nitelikler. `value`, `title` (sayfa
// başlığı değil, hücre ipucu) ve `alt` gibi kullanıcı verisi taşıyabilen
// nitelikler bilinçli olarak listede YOK — `title` ipuçları yazı
// başlıklarını gösteriyor, `value` zaten kaydedilen veri.
const NITELIKLER = ['aria-label', 'aria-description', 'placeholder', 'aria-roledescription'];

function metniCevir(dugum) {
	if (!cevrilebilirMi(dugum, dugum.nodeValue, false)) return;
	const karsilik = cevir(dugum.nodeValue);
	if (karsilik === null) return;
	// Baştaki/sondaki boşluk korunuyor: bazı yerlerde satır arası boşluk
	// düğümün kendisinde duruyor ve kırpmak sözcükleri bitiştiriyor.
	const [, onEk, , sonEk] = dugum.nodeValue.match(/^(\s*)(.*?)(\s*)$/s);
	dugum.nodeValue = onEk + karsilik + sonEk;
}

function nitelikleriCevir(eleman) {
	for (const nitelik of NITELIKLER) {
		const deger = eleman.getAttribute(nitelik);
		if (deger === null) continue;
		if (!cevrilebilirMi(eleman, deger, true)) continue;
		const karsilik = cevir(deger);
		if (karsilik !== null && karsilik !== deger) eleman.setAttribute(nitelik, karsilik);
	}
}

function agaciCevir(kok) {
	if (kok.nodeType === Node.TEXT_NODE) {
		metniCevir(kok);
		return;
	}
	if (kok.nodeType !== Node.ELEMENT_NODE) return;

	nitelikleriCevir(kok);
	for (const eleman of kok.querySelectorAll(NITELIKLER.map((n) => `[${n}]`).join(','))) {
		nitelikleriCevir(eleman);
	}

	const yuruyucu = document.createTreeWalker(kok, NodeFilter.SHOW_TEXT);
	let dugum;
	while ((dugum = yuruyucu.nextNode())) metniCevir(dugum);
}

/*
  Gözlemci neden gerekli: Keystatic bir React uygulaması, ekranın tamamını
  sürekli yeniden çiziyor. Tek seferlik bir tarama yalnızca ilk kareyi
  çevirirdi; menü açıldığında, sayfa değiştiğinde, doğrulama hatası
  belirdiğinde yeni düğümler İngilizce gelir.

  Tüm ağacı baştan taramak yerine yalnızca DEĞİŞEN düğümler işleniyor.
  Keystatic tek bir tuş vuruşunda bile onlarca mutasyon üretiyor; her
  birinde bütün sayfayı yürümek, yapılan işi düğüm sayısıyla çarpardı.

  Sonsuz döngü olmuyor: çevirinin çıktısı Türkçe, sözlükte Türkçe anahtar
  yok. Kendi yazdığımız düğüm ikinci turda hiçbir kalıba uymuyor ve
  değişmiyor, dolayısıyla yeni mutasyon doğurmuyor.
*/
const gozlemci = new MutationObserver((kayitlar) => {
	for (const kayit of kayitlar) {
		if (kayit.type === 'characterData') {
			metniCevir(kayit.target);
		} else if (kayit.type === 'attributes') {
			if (kayit.target.nodeType === Node.ELEMENT_NODE) nitelikleriCevir(kayit.target);
		} else {
			for (const eklenen of kayit.addedNodes) agaciCevir(eklenen);
		}
	}
});

function baslat() {
	agaciCevir(document.body);
	gozlemci.observe(document.body, {
		childList: true,
		subtree: true,
		characterData: true,
		attributes: true,
		attributeFilter: NITELIKLER,
	});
}

/*
  `document.body` preload çalışırken henüz yok. Hazır olduğu ilk an
  `DOMContentLoaded`; React zaten ondan sonra bağlanıyor, yani ilk çizim
  de gözlemcinin kapsamına giriyor.

  Çeviri katmanının çökmesi paneli çökertmemeli: sözlükte olmayan bir
  dizge İngilizce kalıyor, beklenmedik bir hata da yalnızca terminale
  düşüyor. Keystatic güncellenip DOM'u değiştiğinde en kötü sonuç budur.
*/
try {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', baslat, { once: true });
	} else {
		baslat();
	}
} catch (hata) {
	console.error('[türkçeleştirme]', hata);
}

/**
 * İLETİŞİM BİLGİSİ — düzenlenecek tek yer burası.
 *
 * Bilgi iki ayrı bölümde gösteriliyor (ana sayfadaki koyu kart ve Hakkımda
 * sayfasındaki kanal listesi). Değerler o bölümlerin içinde dursaydı biri
 * güncellenip diğeri unutulduğunda site iki farklı adres gösterirdi; bu
 * yüzden tek kaynak burası.
 *
 * Buradaki satırları değiştirdiğinde her iki bölüm ve iletişim QR'ı
 * kendiliğinden güncellenir.
 */

/** E-posta adresi. */
export const EPOSTA = 'mstfaeybk@icloud.com';

/**
 * WhatsApp numarası. Uluslararası biçimde, başında + ve boşluk olmadan —
 * wa.me adresi başka biçim kabul etmiyor (+90 533 479 80 49 → 905334798049).
 *
 * Boş bırakılırsa düğme ve kanal satırı hiç basılmıyor: çalışmayan bir
 * WhatsApp bağlantısı, düğmenin hiç olmamasından kötü.
 */
export const WHATSAPP = '905334798049';

/** İnsan tarafından okunacak biçim; bağlantı yukarıdaki ham numaradan kuruluyor. */
export const TELEFON_GORUNEN = '+90 533 479 80 49';

/** Konum. Çevrilmiyor ama iki dilde ayrı yazılabilsin diye sözlük. */
export const KONUM = { tr: 'Kayseri, Türkiye', en: 'Kayseri, Türkiye' } as const;

/** GitHub profili. Ana sayfadaki hero düğmesi de aynı adrese gidiyor. */
export const GITHUB = 'https://github.com/ridocs';

/*
  SOSYAL PROFİLLER — arama motorlarına "bu sayfa ile bu hesaplar aynı kişi"
  bağını kuran liste (`sameAs` şeması). İsim sorgularında en hızlı etki eden
  sinyallerden biri: Google dağınık profilleri tek kimlikte topluyor.

  Boş bırakılan satır hiçbir yere basılmıyor — ne şemaya ne de sayfaya.
  YANLIŞ bir adres yazmak boş bırakmaktan KÖTÜ: başka birinin profilini
  seninmiş gibi bildirir ve kimlik bağını yanlış kişiye kurar. Emin değilsen
  boş bırak.

  Doldurunca üç yer birden güncellenir: JSON-LD `sameAs`, sosyal ray ve
  (X için) paylaşım kartındaki `twitter:creator`.
*/
export const SOSYAL = {
	github: GITHUB,
	linkedin: '',
	instagram: '',
	x: '',
} as const;

/** `sameAs` için yalnızca dolu olanlar. Boş satırlar şemaya girmiyor. */
export const SOSYAL_ADRESLER: string[] = Object.values(SOSYAL).filter(Boolean);

/**
 * X kullanıcı adı (başında @ ile). Paylaşım kartındaki `twitter:creator`
 * bunu istiyor; adres değil kullanıcı adı. Boşsa etiket hiç basılmıyor.
 */
export const X_KULLANICI = '';

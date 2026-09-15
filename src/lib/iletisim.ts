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

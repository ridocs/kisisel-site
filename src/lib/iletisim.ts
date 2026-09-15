/**
 * İLETİŞİM BİLGİSİ — düzenlenecek tek yer burası.
 *
 * Bilgi iki ayrı bölümde gösteriliyor (ana sayfadaki koyu kart ve Hakkımda
 * sayfasındaki kanal listesi). Değerler o bölümlerin içinde dursaydı biri
 * güncellenip diğeri unutulduğunda site iki farklı adres gösterirdi; bu
 * yüzden tek kaynak burası.
 *
 * DEĞERLER YER TUTUCU: gerçek bilgi gelene kadar burada duruyorlar. Site
 * yayında olduğu için uydurma bir adres yerine açıkça yer tutucu bırakıldı.
 * Buradaki satırları değiştirdiğinde her iki bölüm de kendiliğinden güncellenir.
 */

/** E-posta adresi. Yer tutucu. */
export const EPOSTA = 'eposta@example.com';

/**
 * WhatsApp numarası — YER TUTUCU. Uluslararası biçimde, başında + ve boşluk
 * olmadan yazılacak (örn. 905551112233). Boş bırakılırsa düğme ve kanal satırı
 * hiç basılmıyor: çalışmayan bir WhatsApp bağlantısı, düğmenin hiç olmamasından
 * kötü.
 */
export const WHATSAPP = '905551112233';

/** Konum. Çevrilmiyor ama iki dilde ayrı yazılabilsin diye sözlük. */
export const KONUM = { tr: 'Kayseri, Türkiye', en: 'Kayseri, Türkiye' } as const;

/** GitHub profili. Ana sayfadaki hero düğmesi de aynı adrese gidiyor. */
export const GITHUB = 'https://github.com/ridocs';

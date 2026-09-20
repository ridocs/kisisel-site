/**
 * İLETİŞİM BİLGİSİ — artık PANELDEN düzenleniyor.
 *
 * Değerler `src/icerik/iletisim-bilgisi.json` içinde; panelde soldaki
 * "İletişim bilgileri" sayfasından değiştiriliyor. Bu dosya yalnızca o veriyi
 * okuyup siteye uygun biçimde sunuyor.
 *
 * Bilgi üç ayrı yerde birden görünüyor (ana sayfadaki koyu kart, Hakkımda
 * sayfasındaki kanal listesi ve altbilginin iletişim sütunu) — ayrıca
 * yapılandırılmış veriye (`sameAs`) de giriyor. Tek kaynaktan okunmasının
 * sebebi bu: üç yerde ayrı yazılsaydı biri güncellenip öbürleri unutulurdu.
 */
import veri from '@/icerik/iletisim-bilgisi.json';

/** E-posta adresi. */
export const EPOSTA = veri.eposta;

/**
 * WhatsApp numarası — `wa.me` bağlantısı için.
 *
 * `wa.me` yalnızca rakam kabul ediyor: `+90 533 479 80 49` yazılırsa bağlantı
 * bozuluyor ve düğme hiçbir yere gitmiyor. Panelde bunu "boşluksuz yaz" diye
 * bir kurala bağlamak yerine RAKAM DIŞINDAKİ HER ŞEY BURADA TEMİZLENİYOR:
 * numarayı okunur biçimde yazmak serbest, bağlantı yine çalışıyor.
 *
 * (Bu koruma, panelde numara boşluklu yazıldığında bağlantının sessizce
 * bozulduğu görüldükten sonra eklendi.)
 *
 * Boş bırakılırsa düğme ve kanal satırı hiç basılmıyor: çalışmayan bir
 * WhatsApp bağlantısı, düğmenin hiç olmamasından kötü.
 */
export const WHATSAPP = (veri.whatsapp ?? '').replace(/\D/g, '');

/**
 * WhatsApp açıldığında yazı kutusunda HAZIR BEKLEYEN mesaj.
 *
 * `wa.me/<numara>?text=…` ile gönderiliyor; kişi düğmeye bastığında sohbet
 * bu metin yazılmış hâlde açılıyor, isterse silip kendi yazıyor. Boş
 * bırakılırsa sohbet boş açılıyor.
 *
 * İki dilde ayrı: İngilizce sayfadan gelen kişiye Türkçe bir taslak
 * göndermek istenmiyor.
 */
export const WHATSAPP_MESAJ = {
	tr: (veri.whatsappMesaj ?? '').trim(),
	en: (veri.whatsappMesajEn ?? '').trim(),
} as const;

/** İnsan tarafından okunacak biçim; bağlantı yukarıdaki ham numaradan kuruluyor. */
export const TELEFON_GORUNEN = veri.telefonGorunen;

/** Konum. Çevrilmiyor ama iki dilde ayrı yazılabilsin diye sözlük. */
export const KONUM = { tr: veri.konum, en: veri.konumEn } as const;

/**
 * İletişim kartındaki kare kodun içeriği.
 *
 * Boş bırakılırsa sitenin kendi adresi kodlanıyor (bileşen dolduruyor) —
 * en sık istenen davranış bu: masaüstünde siteyi gösterirken karşıdaki
 * telefonuyla okutup açıyor.
 *
 * Dolu bırakılırsa ne yazıldıysa o kodlanıyor. Adres olmak zorunda değil:
 * telefon (`tel:+90…`), e-posta (`mailto:…`), kablosuz ağ bilgisi ya da düz
 * metin de olabilir. Kod her derlemede yeniden üretiliyor.
 */
export const QR_ICERIK = veri.qrIcerik?.trim() ?? '';

/** GitHub profili. Ana sayfadaki hero düğmesi de aynı adrese gidiyor. */
export const GITHUB = veri.github;

/*
  SOSYAL PROFİLLER — arama motorlarına "bu sayfa ile bu hesaplar aynı kişi"
  bağını kuran liste (`sameAs` şeması). İsim sorgularında en hızlı etki eden
  sinyallerden biri: Google dağınık profilleri tek kimlikte topluyor.

  Panelde boş bırakılan satır hiçbir yere basılmıyor — ne şemaya ne de sayfaya.
  YANLIŞ bir adres yazmak boş bırakmaktan KÖTÜ: başka birinin profilini
  seninmiş gibi bildirir ve kimlik bağını yanlış kişiye kurar. Emin değilsen
  boş bırak.

  Doldurunca üç yer birden güncellenir: JSON-LD `sameAs`, sağ kenardaki
  sosyal ray ve altbilginin bağlantılar sütunu.

  X/Twitter listede YOK — hesap kullanılmıyor. Boş bir satır bırakmak yerine
  kalemi tamamen çıkarmak gerekiyordu: boş satır rayda soluk ama duran bir
  ikon basıyor ve ziyaretçiye "yakında gelecek" diye okunuyordu.

  Adresler arama sonucu bağlantısından değil profilin kendisinden alınmalı.
  LinkedIn adresindeki `?trk=...` parametresi hangi aramadan gelindiğini
  taşıyan bir izleme kuyruğu; `tr.` da yalnızca o an açık olan arayüz dili.
  İkisi de kimliğin parçası değil, bu yüzden kırpılmalı.
*/
export const SOSYAL = {
	github: veri.github,
	linkedin: veri.linkedin,
	instagram: veri.instagram,
} as const;

/** `sameAs` için yalnızca dolu olanlar. Boş satırlar şemaya girmiyor. */
export const SOSYAL_ADRESLER: string[] = Object.values(SOSYAL).filter(Boolean);

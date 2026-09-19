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
 * WhatsApp numarası. Uluslararası biçimde, başında + ve boşluk olmadan —
 * wa.me adresi başka biçim kabul etmiyor (+90 533 479 80 49 → 905334798049).
 *
 * Boş bırakılırsa düğme ve kanal satırı hiç basılmıyor: çalışmayan bir
 * WhatsApp bağlantısı, düğmenin hiç olmamasından kötü.
 */
export const WHATSAPP = veri.whatsapp;

/** İnsan tarafından okunacak biçim; bağlantı yukarıdaki ham numaradan kuruluyor. */
export const TELEFON_GORUNEN = veri.telefonGorunen;

/** Konum. Çevrilmiyor ama iki dilde ayrı yazılabilsin diye sözlük. */
export const KONUM = { tr: veri.konum, en: veri.konumEn } as const;

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

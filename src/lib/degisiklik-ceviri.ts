/**
 * DEĞİŞİKLİK GÜNLÜĞÜ BAŞLIKLARININ İNGİLİZCESİ.
 *
 * Günlükteki kayıt başlıkları `src/lib/surum.ts` içinde git'ten okunuyor ve
 * commit başlıkları Türkçe yazılıyor. İngilizce sayfada da Türkçe görünmesin
 * diye derleme anında bir sözlükten geçiriliyorlar:
 * `src/icerik/degisiklik-cevirileri.json`.
 *
 * NEDEN SÖZLÜK, NEDEN DERLEME ANINDA
 *
 * Geçmiş commit'ler yazılmış ve değiştirilemez; başlığın İngilizcesi ancak
 * dışarıdan, ayrı bir yerde tutulabilir. Ziyaretçiye JavaScript inmediği ve
 * derlemenin internetsiz de çalışması gerektiği için ne tarayıcıda çeviri ne
 * de bir çeviri servisine istek söz konusu — geriye elle yazılmış, depoda
 * duran bir sözlük kalıyor.
 *
 * NEDEN ANAHTAR COMMIT KİMLİĞİ DEĞİL, TÜRKÇE BAŞLIĞIN KENDİSİ
 *
 * 1. Sözlük panelden doldurulabilsin diye. Commit kimliği sitenin hiçbir
 *    yerinde görünmüyor; kimlikle anahtarlanan bir sözlüğe panelden satır
 *    eklemek için önce git geçmişine bakmak gerekirdi. Türkçe başlık ise
 *    sayfanın üzerinde duruyor: kopyala, karşısına İngilizcesini yaz.
 * 2. Tekrar eden başlıklar tek satırda birleşiyor. "Panelden metin
 *    düzenlemeleri" gibi bir başlık geçmişte defalarca geçiyor ve hepsi aynı
 *    şeyi anlatıyor; kimlik anahtarıyla aynı çeviri defalarca yazılırdı.
 * 3. Kısa commit kimliği kararlı bir anahtar değil. git, depo büyüdükçe
 *    kısaltma uzunluğunu kendiliğinden artırıyor (`core.abbrev=auto`); o gün
 *    kimlikle kurulmuş bütün sözlük sessizce eşleşmez olurdu.
 *
 * ÇEVİRİSİ OLMAYAN KAYIT: TÜRKÇE KALIYOR, İŞARETLENİYOR
 *
 * İki seçenek vardı — kaydı Türkçe göstermek ya da İngilizce sayfada hiç
 * göstermemek. Gizlemek seçilmedi:
 *
 *   - Sayfanın işi "ne değişti"yi eksiksiz anlatmak. Gizlenen kayıt, olmamış
 *     bir değişiklik gibi görünür; okunmayan bir başlıktan daha yanıltıcı.
 *   - Yeni atılan her commit, sözlüğe satırı yazılana kadar İngilizce sayfada
 *     GÖRÜNMEZ olurdu. Sayfa sessizce bayatlardı ve bunu kimse fark etmezdi.
 *   - Künyedeki kayıt sayısı ve soldaki tarih ağacı iki dilde ayrı düşerdi.
 *
 * Bu yüzden çevirisi olmayan başlık olduğu gibi kalıyor; bileşen onu
 * `lang="tr"` ile işaretleyip yanına küçük bir dil rozeti koyuyor. Ziyaretçi
 * metnin neden Türkçe olduğunu görüyor, ekran okuyucu da doğru sesletiyor
 * (WCAG 3.1.2, "Language of Parts").
 */
import sozluk from '../icerik/degisiklik-cevirileri.json';
import { gorunenBaslik } from './surum';

/**
 * Eşleme anahtarı: aradaki boşluk farkları, harf büyüklüğü ve tire biçimi
 * eşleşmeyi bozmasın diye başlık sadeleştiriliyor.
 *
 * Sözlük elle (ve panelden) yazılıyor; yapıştırılan bir başlığın sonunda
 * fazladan bir boşluk kalması ya da iki sözcük arasına çift boşluk girmesi
 * olağan. Bunlar yüzünden çevirinin sessizce devre dışı kalması, sözlüğü
 * güvenilmez yapardı.
 *
 * `gorunenBaslik` burada da çağrılıyor: git'ten gelen başlık sayfaya
 * basılmadan önce ondan geçiyor, dolayısıyla sözlükteki satır uzun tireli
 * yazılmış olsa bile ikisi aynı anahtarda buluşuyor.
 *
 * Küçük harfe çevirmede yerel ayar bilinçli olarak 'tr': Türkçe başlıklarda
 * "I" ve "İ" var ve varsayılan eşleme bunları yanlış katlıyor.
 */
function anahtar(baslik: string): string {
	return gorunenBaslik(baslik).trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr');
}

/*
  Sözlük derleme başına bir kez kuruluyor. Modül düzeyinde durması bilinçli:
  günlük sayfası yüzlerce kayıt basıyor ve her biri için listeyi baştan
  taramak gereksiz.

  Boş `en` alanı olan satır sözlüğe hiç girmiyor. Panelde bir satır açılıp
  İngilizcesi henüz yazılmamış olabilir; o kaydı boş bir başlıkla basmak,
  Türkçesini göstermekten kötü.
*/
const cevirilerHaritasi = new Map<string, string>(
	sozluk.kayitlar
		.filter((kayit) => kayit.tr.trim() !== '' && kayit.en.trim() !== '')
		// İngilizce karşılık da `gorunenBaslik`'ten geçiyor: uzun tire yasağı
		// metnin kaynağına değil, görünmesine bağlı bir kural. Panelden girilen
		// bir çeviri de aynı süzgece uğramalı.
		.map((kayit) => [anahtar(kayit.tr), gorunenBaslik(kayit.en.trim())]),
);

/**
 * Bir kayıt başlığının İngilizcesi; sözlükte yoksa `null`.
 *
 * `null` dönmesi "çeviri yok" demek ve çağıran taraf bunu Türkçesini
 * `lang="tr"` ile basarak karşılıyor. Sessizce Türkçeyi döndürseydik, çağıran
 * taraf metnin hangi dilde olduğunu bilemezdi.
 */
export function degisiklikCevirisi(baslik: string): string | null {
	return cevirilerHaritasi.get(anahtar(baslik)) ?? null;
}

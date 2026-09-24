/*
  YÖNETİM UYGULAMASININ SAF İŞ MANTIĞI

  Bu dosyada Electron, SQLite ve dosya sistemi YOK. Tek girdisi düz nesneler,
  tek çıktısı düz nesneler. Sebebi test edilebilirlik: para hesabı ile
  istatistik toplamı, Electron açmadan `node --test` ile doğrulanabilsin.

  Electron'a ihtiyaç duyan her şey `depo.mjs` ve `ana.mjs` içinde duruyor.

  PARA BURADA HER ZAMAN KURUŞ CİNSİNDEN TAM SAYIDIR. Ondalık sayı para
  tutmaz: 0.1 + 0.2 ikilik tabanda 0.3 etmiyor ve bu hata faturaya yansır.
  TL'ye çevirme yalnızca gösterim anında, `kurusBicimle` ile yapılıyor.

  Tek içe aktarma `veri/izinli-alanlar.mjs`: sunucuya hangi alanların
  çıkabileceğini söyleyen liste. Onun da hiçbir bağımlılığı yok, yani bu
  dosyanın saflığı bozulmuyor. Liste burada kopyalanmıyor çünkü iki kopya
  tutulursa biri güncellenip öteki unutulur.
*/

import { IZINLI_ALANLAR, HASSAS_ALAN_DESENI } from '../veri/izinli-alanlar.mjs';

/* ------------------------------------------------------------------ */
/* Sabitler                                                            */
/* ------------------------------------------------------------------ */

/** İş durumları, sıraları arayüzdeki sırayla aynı. */
export const IS_DURUMLARI = [
	{ anahtar: 'teklif', ad: 'Teklif' },
	{ anahtar: 'on_odeme_alindi', ad: 'Ön ödeme alındı' },
	{ anahtar: 'suruyor', ad: 'Sürüyor' },
	{ anahtar: 'teslim_edildi', ad: 'Teslim edildi' },
	{ anahtar: 'kapandi', ad: 'Kapandı' },
	{ anahtar: 'iptal', ad: 'İptal' },
];

export const ODEME_TURLERI = [
	{ anahtar: 'on_odeme', ad: 'Ön ödeme' },
	{ anahtar: 'ara_odeme', ad: 'Ara ödeme' },
	{ anahtar: 'son_odeme', ad: 'Son ödeme' },
	{ anahtar: 'iade', ad: 'İade' },
];

export const MUSTERI_DURUMLARI = [
	{ anahtar: 'etkin', ad: 'Etkin' },
	{ anahtar: 'askida', ad: 'Askıda' },
	{ anahtar: 'arsiv', ad: 'Arşiv' },
];

/**
 * Hesaba katılmayan iş durumu. İptal edilmiş iş ne alacak doğurur ne de
 * istatistikte "yapılan iş" sayılır; ödemesi varsa (iade) o ayrıca görünür.
 */
export const HESAP_DISI_DURUM = 'iptal';

/* ------------------------------------------------------------------ */
/* Para                                                                */
/* ------------------------------------------------------------------ */

/**
 * Kullanıcının yazdığı TL metnini kuruşa çevirir.
 *
 * Türkçe yazımda binlik ayracı nokta, ondalık ayracı virgüldür (1.250,50).
 * Ama alışkanlıkla nokta ile ondalık yazan da olur (1250.50). İkisi de
 * kabul ediliyor: son ayraçtan sonra en fazla iki basamak varsa o ayraç
 * ondalık sayılıyor, değilse binlik.
 *
 * Boş girdi 0 döner. Sayıya çevrilemeyen girdi için `null` döner, çağıran
 * taraf bunu kullanıcıya hata olarak göstermeli. Sessizce 0 yazmıyoruz:
 * yanlış tutar, hiç tutar olmamasından daha kötüdür.
 */
export function tlKurusaCevir(girdi) {
	if (girdi === null || girdi === undefined) return 0;
	if (typeof girdi === 'number') {
		if (!Number.isFinite(girdi)) return null;
		return Math.round(girdi * 100);
	}
	let metin = String(girdi).trim().replace(/\s/g, '').replace(/₺|TL/gi, '');
	if (metin === '') return 0;

	let eksi = false;
	if (metin.startsWith('-')) {
		eksi = true;
		metin = metin.slice(1);
	}
	if (!/^[0-9.,]+$/.test(metin)) return null;

	const sonNokta = metin.lastIndexOf('.');
	const sonVirgul = metin.lastIndexOf(',');
	const sonAyrac = Math.max(sonNokta, sonVirgul);

	let tamKisim = metin;
	let ondalikKisim = '';
	if (sonAyrac >= 0 && metin.length - sonAyrac - 1 <= 2 && metin.length - sonAyrac - 1 > 0) {
		tamKisim = metin.slice(0, sonAyrac);
		ondalikKisim = metin.slice(sonAyrac + 1);
	}

	tamKisim = tamKisim.replace(/[.,]/g, '');
	if (tamKisim === '') tamKisim = '0';
	if (!/^\d+$/.test(tamKisim)) return null;
	if (ondalikKisim !== '' && !/^\d{1,2}$/.test(ondalikKisim)) return null;

	const kurus = Number(tamKisim) * 100 + Number(ondalikKisim.padEnd(2, '0') || '0');
	if (!Number.isSafeInteger(kurus)) return null;
	return eksi ? -kurus : kurus;
}

/** Kuruşu TL metnine çevirir: 125050 -> "1.250,50". Para birimi eklenmez. */
export function kurusBicimle(kurus) {
	const sayi = Number(kurus) || 0;
	const eksi = sayi < 0;
	const mutlak = Math.abs(Math.trunc(sayi));
	const tam = Math.floor(mutlak / 100);
	const ondalik = String(mutlak % 100).padStart(2, '0');
	const tamMetin = String(tam).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
	return `${eksi ? '-' : ''}${tamMetin},${ondalik}`;
}

/** Form alanına yazılacak hâli: "1250,50". Binlik ayracı yok, yoksa
 *  kullanıcı kaydettiğinde kendi noktasını binlik sanıp karışıyor. */
export function kurusGirdiye(kurus) {
	const sayi = Math.trunc(Number(kurus) || 0);
	const eksi = sayi < 0;
	const mutlak = Math.abs(sayi);
	return `${eksi ? '-' : ''}${Math.floor(mutlak / 100)},${String(mutlak % 100).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* İş hesabı                                                           */
/* ------------------------------------------------------------------ */

/**
 * Bir işin para tablosu. Tahsil edilen ve kalan tutar VERİTABANINDA
 * TUTULMUYOR, her seferinde ödeme kayıtlarından hesaplanıyor. Sebebi:
 * iki yerde tutulan sayı er geç ayrışır ve hangisinin doğru olduğu
 * anlaşılmaz. Kayıtlar gerçeğin kaynağı, toplam onların sonucu.
 *
 * @param is        `is_kaydi` satırı (tutar_kurus, on_odeme_orani, durum)
 * @param odemeler  o işe bağlı `odeme` satırları
 * @param revizeler o işe bağlı `revize` satırları
 */
export function isHesabi(is, odemeler = [], revizeler = []) {
	const temelKurus = Math.trunc(Number(is?.tutar_kurus) || 0);

	// Ücretli revizeler işin bedelini artırır. Ücretsiz revize kayda geçer
	// ama tutara girmez: yapılan işi görmek için tutuluyor.
	const revizeKurus = revizeler
		.filter((r) => Number(r.ucretli) === 1)
		.reduce((toplam, r) => toplam + Math.trunc(Number(r.tutar_kurus) || 0), 0);

	const toplamKurus = temelKurus + revizeKurus;

	// İade eksi yönde sayılıyor: tahsilat geri verildiğinde müşteri yeniden
	// borçlu duruma gelmeli.
	const tahsilEdilenKurus = odemeler.reduce((toplam, o) => {
		const tutar = Math.trunc(Number(o.tutar_kurus) || 0);
		return o.tur === 'iade' ? toplam - Math.abs(tutar) : toplam + tutar;
	}, 0);

	const onOdemeAlinanKurus = odemeler
		.filter((o) => o.tur === 'on_odeme')
		.reduce((toplam, o) => toplam + Math.trunc(Number(o.tutar_kurus) || 0), 0);

	// Beklenen ön ödeme İŞİN KENDİ TUTARINDAN hesaplanıyor, revizeler hariç:
	// ön ödeme işin başında alınır, revize sonradan çıkar. Revizeyi katmak
	// geçmişteki bir tahsilatı sonradan "eksik" göstermek olurdu.
	const oran = is?.on_odeme_orani === null || is?.on_odeme_orani === undefined
		? null
		: Number(is.on_odeme_orani);
	const onOdemeBeklenenKurus =
		oran === null || Number.isNaN(oran) ? null : Math.round((temelKurus * oran) / 100);

	return {
		temelKurus,
		revizeKurus,
		toplamKurus,
		tahsilEdilenKurus,
		kalanKurus: toplamKurus - tahsilEdilenKurus,
		onOdemeBeklenenKurus,
		onOdemeAlinanKurus,
		onOdemeTamamMi:
			onOdemeBeklenenKurus === null ? null : onOdemeAlinanKurus >= onOdemeBeklenenKurus,
	};
}

/* ------------------------------------------------------------------ */
/* Ay sınırları                                                        */
/* ------------------------------------------------------------------ */

/** Bugünün ayı, "YYYY-MM" biçiminde. Yerel saate göre. */
export function buAy(simdi = new Date()) {
	const yil = simdi.getFullYear();
	const ay = String(simdi.getMonth() + 1).padStart(2, '0');
	return `${yil}-${ay}`;
}

/**
 * Bir tarih alanı verilen aya düşüyor mu?
 *
 * Tarihler veritabanında iki biçimde duruyor: gün alanları "YYYY-MM-DD",
 * damgalar tam ISO ("YYYY-MM-DDTHH:MM:SS.sssZ"). İkisinin de ilk yedi
 * karakteri "YYYY-MM" olduğu için karşılaştırma metin üzerinden yapılıyor.
 *
 * Bunu tarihe çevirip karşılaştırmaktan kaçınmanın sebebi saat dilimi:
 * `new Date('2026-09-01')` UTC gece yarısıdır ve Türkiye saatinde 31
 * Ağustos'a düşer. Ayın ilk günü sessizce bir önceki aya kayar. Metin
 * karşılaştırması bu hatayı yapamaz.
 */
export function ayaDusuyorMu(tarih, ay) {
	if (!tarih || !ay) return false;
	return String(tarih).slice(0, 7) === ay;
}

/**
 * Bir işin hangi aya sayılacağı. Sıra: teslim tarihi, yoksa başlangıç,
 * o da yoksa oluşturulma. Gerekçe: "bu ay alınacak para" sorusunun cevabı
 * işin teslim edildiği aydır; teslim tarihi girilmemişse elde kalan en
 * anlamlı tarih başlangıçtır.
 */
export function isinAyi(is) {
	const tarih = is?.teslim || is?.baslangic || is?.olusturuldu;
	return tarih ? String(tarih).slice(0, 7) : null;
}

/* ------------------------------------------------------------------ */
/* İstatistik                                                          */
/* ------------------------------------------------------------------ */

/**
 * Seçilen ayın özeti. Hepsi yerelde hesaplanıyor, sunucunun bu sayılardan
 * haberi yok (PANEL-TASARIMI.md §6.3).
 *
 * @param ay         "YYYY-MM"
 * @param musteriler musteri satırları
 * @param isler      is_kaydi satırları
 * @param odemeler   odeme satırları (hepsi, ay burada süzülüyor)
 * @param revizeler  revize satırları
 * @param talepler   talep_kopyasi satırları
 */
export function istatistikHesapla({
	ay,
	musteriler = [],
	isler = [],
	odemeler = [],
	revizeler = [],
	talepler = [],
}) {
	const revizeIsBazli = new Map();
	for (const revize of revizeler) {
		if (!revizeIsBazli.has(revize.is_id)) revizeIsBazli.set(revize.is_id, []);
		revizeIsBazli.get(revize.is_id).push(revize);
	}
	const odemeIsBazli = new Map();
	for (const odeme of odemeler) {
		if (!odemeIsBazli.has(odeme.is_id)) odemeIsBazli.set(odeme.is_id, []);
		odemeIsBazli.get(odeme.is_id).push(odeme);
	}

	const ayinIsleri = isler.filter(
		(is) => isinAyi(is) === ay && is.durum !== HESAP_DISI_DURUM,
	);

	let aylikToplamAlinacakKurus = 0;
	let aylikKalanKurus = 0;
	const turDagilimi = new Map();
	let tekrarEdenSayisi = 0;

	for (const is of ayinIsleri) {
		const hesap = isHesabi(is, odemeIsBazli.get(is.id) ?? [], revizeIsBazli.get(is.id) ?? []);
		aylikToplamAlinacakKurus += hesap.toplamKurus;
		aylikKalanKurus += hesap.kalanKurus;

		const tur = (is.tur ?? '').trim() || 'Belirtilmemiş';
		turDagilimi.set(tur, (turDagilimi.get(tur) ?? 0) + 1);
		if (Number(is.tekrar_eden) === 1) tekrarEdenSayisi++;
	}

	// Ön ödeme, işin ayına değil ÖDEMENİN kendi tarihine göre sayılıyor.
	// "Bu ay kasaya ne girdi" sorusunun cevabı budur; işin teslim ayı
	// başka bir ay olabilir.
	const aylikYapilanOnOdemeKurus = odemeler
		.filter((o) => o.tur === 'on_odeme' && ayaDusuyorMu(o.tarih, ay))
		.reduce((toplam, o) => toplam + Math.trunc(Number(o.tutar_kurus) || 0), 0);

	const aylikTahsilatKurus = odemeler
		.filter((o) => ayaDusuyorMu(o.tarih, ay))
		.reduce((toplam, o) => {
			const tutar = Math.trunc(Number(o.tutar_kurus) || 0);
			return o.tur === 'iade' ? toplam - Math.abs(tutar) : toplam + tutar;
		}, 0);

	const acikTalepDurumlari = new Set(['acik', 'yanit_bekliyor', 'islemde']);

	return {
		ay,
		musteriSayisi: musteriler.filter((m) => m.durum !== 'arsiv').length,
		arsivMusteriSayisi: musteriler.filter((m) => m.durum === 'arsiv').length,
		ayinYeniMusterisi: musteriler.filter((m) => ayaDusuyorMu(m.olusturuldu, ay)).length,
		acikTalepSayisi: talepler.filter((t) => acikTalepDurumlari.has(t.durum)).length,
		aylikYapilanOnOdemeKurus,
		aylikToplamAlinacakKurus,
		aylikKalanKurus,
		aylikTahsilatKurus,
		ayinIsSayisi: ayinIsleri.length,
		tekrarEdenSayisi,
		turDagilimi: [...turDagilimi.entries()]
			.map(([tur, adet]) => ({ tur, adet }))
			.sort((a, b) => b.adet - a.adet || a.tur.localeCompare(b.tur, 'tr')),
	};
}

/* ------------------------------------------------------------------ */
/* Eşitleme kuyruğu                                                    */
/* ------------------------------------------------------------------ */

/*
  SUNUCUYA NE GİDER, NE GİTMEZ

  Aşağıdaki üç işlemin dışında hiçbir şey kuyruğa girmiyor ve her işlemin
  izin verilen alanları burada tek tek yazılı. Beyaz liste kullanmanın
  sebebi: kara liste yeni bir alan eklendiğinde sessizce açık kalır, beyaz
  liste aynı durumda hata verir.

  Kuyrukta ASLA olmaması gerekenler: tutar, TC kimlik numarası, vergi
  numarası, telefon, adres, ilçe, şehir, ödeme, ön ödeme oranı, revize.
  (PANEL-TASARIMI.md §4)
*/
export { IZINLI_ALANLAR as KUYRUK_IZINLI_ALANLAR, HASSAS_ALAN_DESENI };

const KUYRUK_IZINLI_ALANLAR = IZINLI_ALANLAR;

/**
 * Kuyruğa yazılacak gövdeyi doğrular ve yalnızca izin verilen alanları
 * içeren yeni bir nesne döner. Kural dışı bir alan varsa HATA FIRLATIR;
 * sessizce ayıklamak, kodu yazanın yanlış varsayımını görünmez kılardı.
 */
export function kuyrukGovdesiSuz(islem, govde) {
	const izinli = KUYRUK_IZINLI_ALANLAR[islem];
	if (!izinli) throw new Error(`Bilinmeyen eşitleme işlemi: ${islem}`);
	if (!govde || typeof govde !== 'object') throw new Error('Eşitleme gövdesi nesne olmalı');

	const temiz = {};
	for (const [alan, deger] of Object.entries(govde)) {
		if (!izinli.includes(alan)) {
			throw new Error(`"${islem}" işleminde izinsiz alan: ${alan}`);
		}
		if (HASSAS_ALAN_DESENI.test(alan)) {
			throw new Error(`Hassas alan kuyruğa yazılamaz: ${alan}`);
		}
		if (deger !== null && deger !== undefined && typeof deger === 'object') {
			throw new Error(`Kuyruk gövdesi düz değer almalı, "${alan}" nesne`);
		}
		temiz[alan] = deger;
	}
	return temiz;
}

/** Müşteri kaydının sunucuya çıkan hâli: yalnızca görünen ad ve durum. */
export function musteriEsitlemeKaydi(musteri) {
	return {
		islem: 'musteri.yaz',
		govde: kuyrukGovdesiSuz('musteri.yaz', {
			id: musteri.id,
			gorunen_ad: musteri.ad_soyad,
			// Sunucuda yalnızca iki durum anlamlı: panele girebilir ya da
			// giremez. Askıda ve arşiv ikisi de "etkin değil".
			durum: musteri.durum === 'etkin' ? 'etkin' : 'kapali',
		}),
	};
}

/**
 * İşin sunucuya çıkan hâli.
 *
 * 24 EYLÜL 2026'DA GENİŞLEDİ: ad ve durumun yanına özet, tutar, para birimi
 * ve hedef teslim tarihi eklendi. Sebep sahibin kararı, müşteri kendi ödeme
 * dökümünü panelde görecek ve kalan borcunu göremeyeceği bir döküm işe
 * yaramaz (PANEL-TASARIMI.md §4).
 *
 * Çıkmaya devam ETMEYENLER: ön ödeme oranı, iş türü, başlangıç tarihi,
 * tekrar eden işaretçisi ve iç notlar. Yani müşterinin zaten bildiği rakam
 * çıkıyor, işin iç yüzü çıkmıyor.
 *
 * Boş özet ve boş hedef tarih gövdeye HİÇ konmuyor. Sunucu tarafı eksik
 * alanı `null` yazdığı için sonuç aynı: alan temizlendiğinde panelde de
 * temizleniyor. Gövdeyi gereksiz `null` ile şişirmemenin sebebi kuyruğun
 * okunabilir kalması.
 */
export function isEsitlemeKaydi(is) {
	const govde = {
		id: is.id,
		musteri_id: is.musteri_id,
		ad: is.ad,
		durum: is.durum,
		tutar_kurus: Math.trunc(Number(is.tutar_kurus) || 0),
		para_birimi: is.para_birimi || 'TRY',
	};
	const ozet = String(is.ozet ?? '').trim();
	if (ozet !== '') govde.ozet = ozet;
	const teslim = String(is.teslim_hedefi ?? '').trim();
	if (teslim !== '') govde.teslim_hedefi = teslim;
	return { islem: 'is.yaz', govde: kuyrukGovdesiSuz('is.yaz', govde) };
}

/** İş silindiğinde panelden de silinsin diye. Kimlikten başka bir şey
 *  gitmiyor; sunucuda bağlı ödeme, aşama, dosya ve mesaj satırları yabancı
 *  anahtar zinciriyle birlikte düşüyor. */
export function isSilmeKaydi(id) {
	return { islem: 'is.sil', govde: kuyrukGovdesiSuz('is.sil', { id }) };
}

/* ------------------------------------------------------------------ */
/* Ödeme dökümü                                                        */
/* ------------------------------------------------------------------ */

/**
 * Ödemenin sunucuya çıkan hâli.
 *
 * YÖNTEM VE İÇ NOT BURADA YOK ve olamaz da: beyaz liste onları kabul
 * etmiyor, `kuyrukGovdesiSuz` böyle bir alan görürse hata fırlatıyor.
 * Müşterinin bilmesi gereken ne zaman ne kadar ödediği; parayı nakit mi
 * havale mi verdiği sahibin defterinde kalıyor.
 */
export function odemeEsitlemeKaydi(odeme) {
	return {
		islem: 'odeme.yaz',
		govde: kuyrukGovdesiSuz('odeme.yaz', {
			id: odeme.id,
			is_id: odeme.is_id,
			tur: odeme.tur,
			tutar_kurus: Math.trunc(Number(odeme.tutar_kurus) || 0),
			tarih: odeme.tarih,
		}),
	};
}

export function odemeSilmeKaydi(id) {
	return { islem: 'odeme.sil', govde: kuyrukGovdesiSuz('odeme.sil', { id }) };
}

/* ------------------------------------------------------------------ */
/* İlerleme ağacı                                                      */
/* ------------------------------------------------------------------ */

/** Aşamanın kendi durumu. İşin durumuyla karıştırılmamalı: bu, ağaçtaki tek
 *  bir adımın hâli. */
export const ASAMA_DURUMLARI = [
	{ anahtar: 'tamamlandi', ad: 'Tamamlandı' },
	{ anahtar: 'suruyor', ad: 'Sürüyor' },
	{ anahtar: 'bekliyor', ad: 'Bekliyor' },
];

/**
 * İŞİN DURUMU DEĞİŞTİĞİNDE KENDİLİĞİNDEN DÜŞEN AŞAMALAR.
 *
 * Sahibin her durum değişikliğinde bir de elle aşama yazması beklenemez;
 * beklenirse yazılmaz ve müşterinin gördüğü ağaç işin gerçek hâlinden geri
 * kalır. Bu yüzden beş durum için metin burada hazır duruyor.
 *
 * `iptal` BİLEREK LİSTEDE YOK. İptal bir ilerleme değil; müşterinin ağacına
 * "iptal edildi" diye bir adım düşürmek, işin neden iptal olduğunu
 * anlatmadan kötü haber vermek olurdu. Sahip isterse elle aşama ekleyebilir.
 *
 * `sira` onarlı artıyor: sahip iki otomatik aşamanın ARASINA elle bir adım
 * koyabilsin diye. Birer birer artsaydı araya girmek için bütün ağacın
 * yeniden numaralanması gerekirdi.
 */
export const OTOMATIK_ASAMALAR = {
	teklif: {
		sira: 10,
		baslik: 'Teklif verildi',
		aciklama: 'İşin kapsamı ve bedeli paylaşıldı, onay bekleniyor.',
		durum: 'tamamlandi',
	},
	on_odeme_alindi: {
		sira: 20,
		baslik: 'Ön ödeme alındı',
		aciklama: 'Ön ödeme tahsil edildi, iş sıraya girdi.',
		durum: 'tamamlandi',
	},
	suruyor: {
		sira: 30,
		baslik: 'İş sürüyor',
		aciklama: 'Üretim başladı.',
		// Tek "sürüyor" aşama bu: ötekiler olup bitmiş anlar, bu ise bir hâl.
		durum: 'suruyor',
	},
	teslim_edildi: {
		sira: 40,
		baslik: 'Teslim edildi',
		aciklama: 'İş teslim edildi.',
		durum: 'tamamlandi',
	},
	kapandi: {
		sira: 50,
		baslik: 'Kapandı',
		aciklama: 'İş kapatıldı.',
		durum: 'tamamlandi',
	},
};

/** Bilinmeyen ya da otomatik aşaması olmayan durum için `null`. */
export function otomatikAsamaTanimi(isDurumu) {
	return OTOMATIK_ASAMALAR[isDurumu] ?? null;
}

/**
 * Otomatik aşamanın kimliği İŞİN KİMLİĞİNDEN VE DURUMDAN türetiliyor,
 * rastgele üretilmiyor.
 *
 * Sebebi ölçülebilir bir hata: sahip işi "sürüyor"dan "teslim edildi"ye
 * alıp sonra yanlışlıkla geri çevirse, rastgele kimlikle her gidiş gelişte
 * ağaca yeni bir "İş sürüyor" satırı düşerdi. Türetilmiş kimlikte aynı
 * satırın üstüne yazılıyor, hem yerelde hem sunucuda.
 */
export function otomatikAsamaKimligi(isId, isDurumu) {
	return `${isId}-oto-${isDurumu}`;
}

/** Aşama formunu doğrular. Dönen dizi boşsa kayıt geçerli. */
export function asamaDogrula(kayit) {
	const hatalar = [];
	if (!String(kayit?.is_id ?? '').trim()) hatalar.push('Aşama bir işe bağlı olmalı.');
	if (!String(kayit?.baslik ?? '').trim()) hatalar.push('Aşama başlığı boş bırakılamaz.');
	if (!ASAMA_DURUMLARI.some((d) => d.anahtar === kayit?.durum)) {
		hatalar.push('Bilinmeyen aşama durumu.');
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(String(kayit?.tarih ?? ''))) hatalar.push('Tarih seçilmedi.');
	if (!Number.isInteger(kayit?.sira)) hatalar.push('Sıra tam sayı olmalı.');
	else if (kayit.sira < 0) hatalar.push('Sıra eksi olamaz.');
	return hatalar;
}

export function asamaGirdisiHazirla(form) {
	const kayit = {
		id: form.id || null,
		is_id: String(form.is_id ?? '').trim(),
		baslik: String(form.baslik ?? '').trim(),
		aciklama: String(form.aciklama ?? '').trim(),
		durum: form.durum || 'tamamlandi',
		tarih: gunNull(form.tarih),
		sira: siraSayisi(form.sira),
		paylasildi: Number(form.paylasildi) === 1 ? 1 : 0,
	};
	const hatalar = asamaDogrula(kayit);
	return { kayit: hatalar.length ? null : kayit, hatalar };
}

/**
 * Aşamanın sunucuya çıkan hâli.
 *
 * `paylasildi` gövdede YOK ve olmamalı: paylaşılmayan aşama zaten hiç
 * gönderilmiyor, dolayısıyla sunucuda "gizli aşama" diye bir kavram
 * doğmuyor. Bayrağı göndermek, gizliliği sunucunun iyi niyetine bırakmak
 * olurdu.
 */
export function asamaEsitlemeKaydi(asama) {
	return {
		islem: 'asama.yaz',
		govde: kuyrukGovdesiSuz('asama.yaz', {
			id: asama.id,
			is_id: asama.is_id,
			sira: Math.trunc(Number(asama.sira) || 0),
			kaynak: asama.kaynak === 'otomatik' ? 'otomatik' : 'elle',
			baslik: asama.baslik,
			aciklama: String(asama.aciklama ?? '').trim() || null,
			durum: asama.durum,
			tarih: asama.tarih,
		}),
	};
}

export function asamaSilmeKaydi(id) {
	return { islem: 'asama.sil', govde: kuyrukGovdesiSuz('asama.sil', { id }) };
}

/* ------------------------------------------------------------------ */
/* Dosya künyesi                                                       */
/* ------------------------------------------------------------------ */

/**
 * Dosyanın sunucuya çıkan KÜNYESİ. İçeriği bu kuyruktan gitmiyor, ayrıca
 * kopyalanıyor (`veri/dosya-gonder.mjs`).
 *
 * `yerel_yol` gövdede YOK: sahibin diskindeki klasör yapısı müşteriyi
 * ilgilendirmiyor ve beyaz liste onu zaten kabul etmiyor. `sha256` onaltılık
 * metne çevriliyor, çünkü kuyruk JSON taşıyor ve ham bayt JSON'da durmuyor.
 */
export function dosyaEsitlemeKaydi(dosya) {
	return {
		islem: 'dosya.yaz',
		govde: kuyrukGovdesiSuz('dosya.yaz', {
			id: dosya.id,
			is_id: dosya.is_id,
			asama_id: dosya.asama_id ?? null,
			gosterilen_ad: dosya.gosterilen_ad,
			depo_adi: dosya.depo_adi,
			tur: dosya.tur,
			boyut: Math.trunc(Number(dosya.boyut) || 0),
			sha256: ozetiHexe(dosya.sha256),
			gorsel_mi: Number(dosya.gorsel_mi) === 1 ? 1 : 0,
		}),
	};
}

export function dosyaSilmeKaydi(id) {
	return { islem: 'dosya.sil', govde: kuyrukGovdesiSuz('dosya.sil', { id }) };
}

/** SHA-256 özetini onaltılık metne çevirir. Zaten metinse dokunmuyor:
 *  SQLite'tan BLOB, testten dize gelebiliyor. */
export function ozetiHexe(ozet) {
	if (typeof ozet === 'string') return ozet;
	if (!ozet) return '';
	return Buffer.from(ozet).toString('hex');
}

/* ------------------------------------------------------------------ */
/* İş bazlı yazışma                                                    */
/* ------------------------------------------------------------------ */

/*
  Destek talebi genel konular için; bu ise belirli bir işin kendi yazışması.
  Desen talep yanıtıyla AYNI: sahibin yazdığı mesaj doğrudan sunucuya
  gitmiyor, kuyruğa düşüyor ve aynı kimlikle yerel kopyaya da yazılıyor.
  Aynı kimlik şart, yoksa sunucu mesajı geri verdiğinde ekranda iki kez
  görünürdü.
*/

/** `veri/esitleme.mjs` içindeki içe alma sınırıyla aynı sayı. */
export const IS_MESAJ_SINIRI = 20000;

/** Sahibin yazdığı iş mesajını doğrular. Dönen dizi boşsa mesaj geçerli. */
export function isMesajiDogrula({ isId, metin }) {
	const hatalar = [];
	if (!String(isId ?? '').trim()) hatalar.push('Mesaj bir işe bağlı olmalı.');
	const govde = String(metin ?? '').trim();
	if (govde === '') hatalar.push('Mesaj boş bırakılamaz.');
	else if (govde.length > IS_MESAJ_SINIRI) {
		hatalar.push(`Mesaj ${IS_MESAJ_SINIRI} karakteri aşamaz.`);
	}
	return hatalar;
}

/** Sahibin iş mesajının sunucuya çıkan hâli. Yazan bilgisi gitmiyor: sunucu
 *  bu kanaldan gelen her mesajı zaten sahibin yazdığını biliyor. */
export function isMesajiEsitlemeKaydi({ id, isId, metin, zaman }) {
	return {
		islem: 'is-mesaj.yaz',
		govde: kuyrukGovdesiSuz('is-mesaj.yaz', { id, is_id: isId, metin, zaman }),
	};
}

/** Davetin sunucuya çıkan hâli: anahtarın KARMASI, anahtarın kendisi değil. */
export function davetEsitlemeKaydi({ id, musteriId, anahtarKarmasiHex, sonKullanma }) {
	return {
		islem: 'davet.yaz',
		govde: kuyrukGovdesiSuz('davet.yaz', {
			id,
			musteri_id: musteriId,
			anahtar_karmasi: anahtarKarmasiHex,
			son_kullanma: sonKullanma,
		}),
	};
}

/* ------------------------------------------------------------------ */
/* Destek talepleri                                                    */
/* ------------------------------------------------------------------ */

/*
  Talebin gerçeğin kaynağı SUNUCUDAKİ tablo; yereldeki `talep_kopyasi`
  yalnızca çekilmiş bir kopya. Bu yüzden sahibin yazdığı yanıt doğrudan
  sunucuya gitmiyor: kuyruğa `talep.yanit` işlemi olarak düşüyor ve bir
  sonraki eşitlemede gidiyor. Aynısı durum değişikliği için de geçerli.
*/

/** Talep durumları. Sunucudan başka bir değer gelirse listede aranmıyor,
 *  ham hâliyle gösteriliyor; sahibin seçebileceği durumlar bunlar. */
export const TALEP_DURUMLARI = [
	{ anahtar: 'acik', ad: 'Açık' },
	{ anahtar: 'yanit_bekliyor', ad: 'Yanıt bekliyor' },
	{ anahtar: 'islemde', ad: 'İşlemde' },
	{ anahtar: 'kapandi', ad: 'Kapandı' },
];

/** Öncelik alanı sunucudan serbest metin geliyor; bilinenler çevriliyor. */
export const TALEP_ONCELIKLERI = [
	{ anahtar: 'dusuk', ad: 'Düşük' },
	{ anahtar: 'normal', ad: 'Normal' },
	{ anahtar: 'yuksek', ad: 'Yüksek' },
];

/*
  `veri/esitleme.mjs` içindeki içe alma sınırıyla aynı sayı. Orada sunucudan
  GELEN metin kırpılıyor, burada sahibin YAZDIĞI metin reddediliyor: sessizce
  kırpılan bir yanıt, gönderildiğini sanılan yarım cümle demek olurdu.
*/
export const TALEP_METIN_SINIRI = 20000;

/** Sahibin yazdığı yanıtı doğrular. Dönen dizi boşsa yanıt geçerli. */
export function talepYanitiDogrula({ talepId, metin }) {
	const hatalar = [];
	if (!String(talepId ?? '').trim()) hatalar.push('Yanıt bir talebe bağlı olmalı.');
	const govde = String(metin ?? '').trim();
	if (govde === '') hatalar.push('Yanıt boş bırakılamaz.');
	else if (govde.length > TALEP_METIN_SINIRI) {
		hatalar.push(`Yanıt ${TALEP_METIN_SINIRI} karakteri aşamaz.`);
	}
	return hatalar;
}

/** Sahibin yanıtının sunucuya çıkan hâli. Yazan bilgisi gitmiyor: sunucu
 *  bu kanaldan gelen her mesajı zaten sahibin yazdığını biliyor. */
export function talepYanitiEsitlemeKaydi({ id, talepId, metin, zaman }) {
	return {
		islem: 'talep.yanit',
		govde: kuyrukGovdesiSuz('talep.yanit', {
			id,
			talep_id: talepId,
			metin,
			zaman,
		}),
	};
}

/** Talebin yeni durumunun sunucuya çıkan hâli: kimlik ve durum, başka hiçbir şey. */
export function talepDurumuEsitlemeKaydi({ id, durum }) {
	return {
		islem: 'talep.durum',
		govde: kuyrukGovdesiSuz('talep.durum', { id, durum }),
	};
}

/* ------------------------------------------------------------------ */
/* Eşitleme ayarları                                                   */
/* ------------------------------------------------------------------ */

/*
  SUNUCU BİLGİSİ DEPODA YOK. Adres, uzak yollar ve anahtar dosyasının yeri
  yerel veritabanının `ayar` tablosunda duruyor; buraya yalnızca alanların
  ADI ve etiketi yazılı, değerleri değil. Depo herkese açık.

  Anahtar listesi `veri/esitleme-ssh.mjs` içindeki `AYAR_ANAHTARLARI` ile
  birebir aynı olmak zorunda. O dosya SQLite ve alt süreç çağırıyor, bu
  dosya ise saf kalmalı, bu yüzden içe aktarılmıyor; ikisinin aynı kaldığını
  bir test bekçilik ediyor (`yonetim/talep-esitleme.test.mjs`).
*/
export const ESITLEME_AYARLARI = [
	{
		anahtar: 'esitleme.sunucu',
		etiket: 'Sunucu adresi',
		ornek: 'kullanici@makine',
		ipucu: 'SSH ile bağlanılan kullanıcı ve makine.',
	},
	{
		anahtar: 'esitleme.uzak_veri',
		etiket: 'Uzak veri klasörü',
		ornek: '/srv/panel/veri',
		ipucu: 'Sunucudaki betiklerin (sunucu-ice-al.mjs) durduğu klasör.',
	},
	{
		anahtar: 'esitleme.uzak_vt',
		etiket: 'Uzak veritabanı yolu',
		ornek: '/srv/panel/panel.db',
		ipucu: 'Sunucudaki panel veritabanı dosyası.',
	},
	{
		anahtar: 'esitleme.ssh_anahtari',
		etiket: 'SSH özel anahtar yolu',
		ornek: 'C:\\Users\\ad\\.ssh\\id_ed25519',
		ipucu: 'Bu bilgisayardaki özel anahtar dosyası. Anahtarın kendisi değil, yolu.',
	},
	{
		anahtar: 'esitleme.uzak_node',
		etiket: 'Uzak Node yolu',
		ornek: '/opt/node24/bin/node',
		ipucu:
			'Sunucudaki Node çalıştırılabilirinin TAM yolu. Düz "node" yazmayın: ' +
			'sunucunun PATH değişkenindeki sürüm eski olabilir ve panelin kullandığı ' +
			'node:sqlite orada bulunmayabilir.',
	},
	/*
	  Aşağıdaki ikisi İSTEĞE BAĞLI: boş bırakılırsa veri katmanındaki
	  varsayılan kullanılıyor. Zorunlu yapılmadılar, çünkü eklendiklerinde
	  sahibin ayarları çoktan doluydu ve zorunlu olsalardı eşitleme bir anda
	  "ayar eksik" deyip dururdu.
	*/
	{
		anahtar: 'esitleme.uzak_dosya',
		etiket: 'Uzak dosya klasörü',
		ornek: '/var/lib/panel/dosyalar',
		istegeBagli: true,
		ipucu:
			'Paylaşılan dosyaların sunucuda durduğu klasör. Boş bırakılırsa ' +
			'varsayılan kullanılıyor.',
	},
	{
		anahtar: 'esitleme.uzak_kullanici',
		etiket: 'Uzak panel kullanıcısı',
		ornek: 'panel',
		istegeBagli: true,
		ipucu:
			'Gönderilen dosyanın sahipliği bu kullanıcıya çevriliyor. SSH ile ' +
			'bağlanan siz root olduğunuz için, düzeltilmezse panel süreci dosyayı ' +
			'okuyamaz. Boş bırakılırsa varsayılan kullanılıyor.',
	},
];

/*
  Kabukta anlam taşıyan karakterler baştan reddediliyor: uzak yollar ve
  sunucu adı SSH üzerinden uzakta bir kabuğa giriyor.

  Bu iki desen `veri/esitleme-ssh.mjs` içindekilerle bilerek aynı. Son söz
  ORADA: bu dosyadaki denetim, kullanıcı daha kaydete basmadan hatayı
  göstermek için. Arayüzün doğrulamasına güvenip oradakini kaldırmak,
  kapıyı içeriden kilitleyip anahtarı dışarıda bırakmak olurdu.

  SSH anahtar yolu bu denetimden GEÇMİYOR, çünkü Windows'ta o yol ters eğik
  çizgi ve iki nokta içeriyor. O değer uzakta bir kabuğa değil, yerel `ssh`
  komutuna argüman olarak veriliyor.
*/
const AYAR_GUVENLI_YOL = /^[A-Za-z0-9._/-]+$/;
const AYAR_GUVENLI_SUNUCU = /^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+$/;

/** Eşitleme ayarlarını doğrular. Dönen dizi boşsa ayarlar geçerli. */
export function esitlemeAyariDogrula(ayar) {
	const hatalar = [];
	for (const alan of ESITLEME_AYARLARI) {
		// İsteğe bağlı alan boş bırakılabilir: veri katmanı varsayılanı koyuyor.
		if (alan.istegeBagli) continue;
		if (String(ayar?.[alan.anahtar] ?? '').trim() === '') {
			hatalar.push(`${alan.etiket} boş bırakılamaz.`);
		}
	}
	if (hatalar.length) return hatalar;

	const sunucu = String(ayar['esitleme.sunucu']).trim();
	if (!AYAR_GUVENLI_SUNUCU.test(sunucu)) {
		hatalar.push('Sunucu adresi "kullanici@makine" biçiminde olmalı.');
	}
	for (const anahtar of ['esitleme.uzak_veri', 'esitleme.uzak_vt']) {
		if (!AYAR_GUVENLI_YOL.test(String(ayar[anahtar]).trim())) {
			const alan = ESITLEME_AYARLARI.find((a) => a.anahtar === anahtar);
			hatalar.push(
				`${alan.etiket} yalnızca harf, rakam, nokta, alt çizgi, eğik çizgi ve tire içerebilir.`,
			);
		}
	}
	return hatalar;
}

/*
  OTOMATİK EŞİTLEME AYARLARI

  Bu iki değer de `ayar` tablosunda duruyor, bağlantı ayarlarının yanında.
  Ayrı tutulmalarının sebebi: bağlantı ayarları eksikken kayıt reddediliyor,
  bunlar ise her zaman yazılabilir olmalı. Kullanıcı sunucu adresini hiç
  girmeden de otomatik eşitlemeyi kapatabilmeli.
*/
export const OTOMATIK_ARALIK = { varsayilanDk: 3, enAzDk: 1, enCokDk: 60 };

/** `ayar` tablosundaki anahtar adları. */
export const OTOMATIK_ANAHTARLARI = {
	acik: 'esitleme.otomatik',
	aralikDk: 'esitleme.aralik_dk',
};

/**
 * Aralığı sınırların içine çeker. Bozuk ya da boş değer varsayılana düşüyor:
 * ayar tablosundaki tek bir yazım hatası yüzünden eşitleme saniyede bir
 * çalışmamalı, sonsuza kadar da susmamalı.
 */
export function otomatikAralikDuzelt(deger, varsayilan = OTOMATIK_ARALIK.varsayilanDk) {
	const metin = String(deger ?? '').trim();
	// Boş dize `Number` için sıfır. Ayarı hiç girilmemiş bir değer sıfıra
	// düşseydi alt sınıra çekilir ve varsayılan hiç geçerli olmazdı.
	if (metin === '') return varsayilan;
	const sayi = Number(metin.replace(',', '.'));
	if (!Number.isFinite(sayi)) return varsayilan;
	return Math.min(OTOMATIK_ARALIK.enCokDk, Math.max(OTOMATIK_ARALIK.enAzDk, Math.round(sayi)));
}

/** Otomatik eşitleme formunu doğrular. Dönen dizi boşsa değerler geçerli. */
export function otomatikAyariDogrula(form) {
	const hatalar = [];
	const ham = String(form?.aralikDk ?? '').trim();
	if (ham === '') {
		hatalar.push('Dinleme aralığı boş bırakılamaz.');
		return hatalar;
	}
	const sayi = Number(ham.replace(',', '.'));
	if (!Number.isFinite(sayi) || !Number.isInteger(sayi)) {
		hatalar.push('Dinleme aralığı tam sayı olmalı (dakika).');
	} else if (sayi < OTOMATIK_ARALIK.enAzDk || sayi > OTOMATIK_ARALIK.enCokDk) {
		hatalar.push(
			`Dinleme aralığı ${OTOMATIK_ARALIK.enAzDk} ile ${OTOMATIK_ARALIK.enCokDk} dakika arasında olmalı.`,
		);
	}
	return hatalar;
}

/* ------------------------------------------------------------------ */
/* Doğrulama                                                           */
/* ------------------------------------------------------------------ */

/**
 * TC kimlik numarası doğrulaması. Resmî algoritma: 11 hane, ilki sıfır
 * olamaz, 10. hane ilk dokuzun ağırlıklı toplamından, 11. hane ilk onun
 * toplamından üretilir.
 *
 * Boş bırakmak serbest: her müşteriden TC almak zorunda değiliz ve veri
 * asgariliği zaten isteneni söylüyor.
 */
export function tcGecerliMi(deger) {
	const metin = String(deger ?? '').trim();
	if (metin === '') return true;
	if (!/^[1-9][0-9]{10}$/.test(metin)) return false;
	const h = [...metin].map(Number);
	const tek = h[0] + h[2] + h[4] + h[6] + h[8];
	const cift = h[1] + h[3] + h[5] + h[7];
	if ((tek * 7 - cift) % 10 !== h[9]) return false;
	const ilkOn = h.slice(0, 10).reduce((a, b) => a + b, 0);
	return ilkOn % 10 === h[10];
}

/**
 * Vergi numarası doğrulaması. 10 hane. Gerçek kişilerde TC kimlik numarası
 * vergi numarası yerine geçtiği için 11 hane de kabul ediliyor, o durumda
 * TC algoritmasıyla bakılıyor.
 */
export function vergiGecerliMi(deger) {
	const metin = String(deger ?? '').trim();
	if (metin === '') return true;
	if (/^[0-9]{11}$/.test(metin)) return tcGecerliMi(metin);
	return /^[0-9]{10}$/.test(metin);
}

/** Telefon: rakam dışını atıp 10 ya da 11 haneye bakıyoruz. Biçim serbest. */
export function telefonGecerliMi(deger) {
	const metin = String(deger ?? '').trim();
	if (metin === '') return true;
	const rakamlar = metin.replace(/\D/g, '');
	return rakamlar.length >= 10 && rakamlar.length <= 13;
}

/** Oran alanı: boş ya da 0 ile 100 arasında tam sayı. */
export function oranGecerliMi(deger) {
	if (deger === null || deger === undefined || String(deger).trim() === '') return true;
	const sayi = Number(deger);
	return Number.isInteger(sayi) && sayi >= 0 && sayi <= 100;
}

/**
 * Müşteri formunun tamamını doğrular. Dönen dizi boşsa kayıt geçerli.
 * Hata metinleri doğrudan kullanıcıya gösterilecek hâlde yazılı.
 */
export function musteriDogrula(kayit) {
	const hatalar = [];
	if (!String(kayit?.ad_soyad ?? '').trim()) hatalar.push('Ad soyad boş bırakılamaz.');
	if (!telefonGecerliMi(kayit?.telefon)) hatalar.push('Telefon numarası eksik görünüyor.');
	if (!tcGecerliMi(kayit?.tc)) hatalar.push('TC kimlik numarası doğrulanmadı.');
	if (!vergiGecerliMi(kayit?.vergi)) hatalar.push('Vergi numarası 10 hane olmalı.');
	if (kayit?.durum && !MUSTERI_DURUMLARI.some((d) => d.anahtar === kayit.durum)) {
		hatalar.push('Bilinmeyen müşteri durumu.');
	}
	return hatalar;
}

/** İş formunu doğrular. Dönen dizi boşsa kayıt geçerli. */
export function isDogrula(kayit) {
	const hatalar = [];
	if (!String(kayit?.musteri_id ?? '').trim()) hatalar.push('İş bir müşteriye bağlı olmalı.');
	if (!String(kayit?.ad ?? '').trim()) hatalar.push('İş adı boş bırakılamaz.');
	if (!IS_DURUMLARI.some((d) => d.anahtar === kayit?.durum)) hatalar.push('Bilinmeyen iş durumu.');
	if (!Number.isInteger(kayit?.tutar_kurus)) hatalar.push('Tutar okunamadı.');
	else if (kayit.tutar_kurus < 0) hatalar.push('Tutar eksi olamaz.');
	if (!oranGecerliMi(kayit?.on_odeme_orani)) hatalar.push('Ön ödeme oranı 0 ile 100 arasında olmalı.');
	if (kayit?.baslangic && kayit?.teslim && kayit.teslim < kayit.baslangic) {
		hatalar.push('Teslim tarihi başlangıçtan önce olamaz.');
	}
	return hatalar;
}

/** Ödeme formunu doğrular. */
export function odemeDogrula(kayit) {
	const hatalar = [];
	if (!String(kayit?.is_id ?? '').trim()) hatalar.push('Ödeme bir işe bağlı olmalı.');
	if (!ODEME_TURLERI.some((t) => t.anahtar === kayit?.tur)) hatalar.push('Bilinmeyen ödeme türü.');
	if (!Number.isInteger(kayit?.tutar_kurus)) hatalar.push('Tutar okunamadı.');
	else if (kayit.tutar_kurus <= 0) hatalar.push('Ödeme tutarı sıfırdan büyük olmalı.');
	if (!/^\d{4}-\d{2}-\d{2}$/.test(String(kayit?.tarih ?? ''))) hatalar.push('Tarih seçilmedi.');
	return hatalar;
}

/** Revize formunu doğrular. */
export function revizeDogrula(kayit) {
	const hatalar = [];
	if (!String(kayit?.is_id ?? '').trim()) hatalar.push('Revize bir işe bağlı olmalı.');
	if (!String(kayit?.baslik ?? '').trim()) hatalar.push('Revize başlığı boş bırakılamaz.');
	if (!Number.isInteger(kayit?.tutar_kurus)) hatalar.push('Tutar okunamadı.');
	else if (kayit.tutar_kurus < 0) hatalar.push('Tutar eksi olamaz.');
	if (Number(kayit?.ucretli) === 1 && kayit?.tutar_kurus === 0) {
		hatalar.push('Ücretli revizenin tutarı sıfır olamaz.');
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(String(kayit?.tarih ?? ''))) hatalar.push('Tarih seçilmedi.');
	return hatalar;
}

/* ------------------------------------------------------------------ */
/* Form girdisini kayda çevirme                                        */
/* ------------------------------------------------------------------ */

/*
  Formdan gelen metinleri veritabanına yazılacak kayda çeviren işlevler.

  Arayüz de ana süreç de AYNI işlevi çağırıyor. Arayüz hatayı erken
  göstermek için, ana süreç son söz için. Doğrulamayı yalnızca arayüzde
  yapmak yanlış olurdu: arayüz kandırılabilir bir yer, ana süreç değil.
  İki ayrı doğrulama yazmak ise er geç iki ayrı kurala dönüşür.
*/

/** @returns {{ kayit: object|null, hatalar: string[] }} */
export function musteriGirdisiHazirla(form) {
	const kayit = {
		id: form.id || null,
		ad_soyad: String(form.ad_soyad ?? '').trim(),
		telefon: String(form.telefon ?? '').trim(),
		ilce: String(form.ilce ?? '').trim(),
		sehir: String(form.sehir ?? '').trim(),
		tc: String(form.tc ?? '').replace(/\s/g, ''),
		vergi: String(form.vergi ?? '').replace(/\s/g, ''),
		not_metni: String(form.not_metni ?? '').trim(),
		durum: form.durum || 'etkin',
	};
	const hatalar = musteriDogrula(kayit);
	return { kayit: hatalar.length ? null : kayit, hatalar };
}

export function isGirdisiHazirla(form) {
	const tutarKurus = tlKurusaCevir(form.tutar);
	const kayit = {
		id: form.id || null,
		musteri_id: String(form.musteri_id ?? '').trim(),
		ad: String(form.ad ?? '').trim(),
		ozet: String(form.ozet ?? '').trim(),
		tur: String(form.tur ?? '').trim(),
		durum: form.durum || 'teklif',
		tutar_kurus: tutarKurus,
		on_odeme_orani: boslukNull(form.on_odeme_orani),
		tekrar_eden: Number(form.tekrar_eden) === 1 ? 1 : 0,
		baslangic: gunNull(form.baslangic),
		teslim: gunNull(form.teslim),
	};
	const hatalar = isDogrula(kayit);
	return { kayit: hatalar.length ? null : kayit, hatalar };
}

export function odemeGirdisiHazirla(form) {
	const kayit = {
		id: form.id || null,
		is_id: String(form.is_id ?? '').trim(),
		tur: form.tur || 'ara_odeme',
		tutar_kurus: tlKurusaCevir(form.tutar),
		tarih: gunNull(form.tarih),
		yontem: String(form.yontem ?? '').trim(),
		not_metni: String(form.not_metni ?? '').trim(),
	};
	const hatalar = odemeDogrula(kayit);
	return { kayit: hatalar.length ? null : kayit, hatalar };
}

export function revizeGirdisiHazirla(form) {
	const kayit = {
		id: form.id || null,
		is_id: String(form.is_id ?? '').trim(),
		baslik: String(form.baslik ?? '').trim(),
		aciklama: String(form.aciklama ?? '').trim(),
		tutar_kurus: tlKurusaCevir(form.tutar),
		ucretli: Number(form.ucretli) === 1 ? 1 : 0,
		tarih: gunNull(form.tarih),
	};
	const hatalar = revizeDogrula(kayit);
	return { kayit: hatalar.length ? null : kayit, hatalar };
}

function boslukNull(deger) {
	const metin = String(deger ?? '').trim();
	if (metin === '') return null;
	const sayi = Number(metin);
	return Number.isFinite(sayi) ? Math.round(sayi) : metin;
}

/** Aşama sırası: boş bırakılırsa 0. Tam sayıya yuvarlanıyor, ondalık bir
 *  sıra numarasının anlamı yok. */
function siraSayisi(deger) {
	const metin = String(deger ?? '').trim();
	if (metin === '') return 0;
	const sayi = Number(metin.replace(',', '.'));
	return Number.isFinite(sayi) ? Math.round(sayi) : Number.NaN;
}

/** Tarih alanları "YYYY-MM-DD" kalıyor. Date nesnesine çevirmiyoruz: saat
 *  dilimi yüzünden gün kayması yaşanan yer tam olarak orası. */
function gunNull(deger) {
	const metin = String(deger ?? '').trim();
	return metin === '' ? null : metin;
}

/* ------------------------------------------------------------------ */
/* Arama                                                               */
/* ------------------------------------------------------------------ */

/**
 * Türkçe duyarlı arama eşleşmesi. SQL'in `LIKE` işleci Türkçe büyük harf
 * kurallarını bilmiyor ("İstanbul" araması "istanbul" kaydını bulmuyor),
 * bu yüzden süzme SQL'de değil burada yapılıyor. Kayıt sayısı birkaç yüz
 * mertebesinde olduğu için bunun bir bedeli yok.
 */
export function aramaEslesiyorMu(metinler, arama) {
	const aranan = String(arama ?? '').trim().toLocaleLowerCase('tr');
	if (aranan === '') return true;
	const havuz = metinler
		.filter((m) => m !== null && m !== undefined)
		.join(' ')
		.toLocaleLowerCase('tr');
	return aranan.split(/\s+/).every((parca) => havuz.includes(parca));
}

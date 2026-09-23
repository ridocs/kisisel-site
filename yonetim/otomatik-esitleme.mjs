/*
  OTOMATİK EŞİTLEME

  NEDEN VAR

  Eşitleme elle yapılıyordu: kullanıcı Eşitleme ekranındaki düğmeye basıyordu.
  O adım unutulabilir bir adımdı ve unutulunca sessizce yanlış bir sonuç
  doğuruyordu: sahip davet anahtarını üretiyor, müşteriye veriyor, müşteri
  "Anahtar kabul edilmedi" hatası alıyor. Anahtar yanlış değil, sunucuya hiç
  ulaşmamış. Elle yapılan ve unutulunca sessizce yanlış sonuç veren bir adım,
  otomatikleşmesi gereken adımdır.

  BU DOSYADA ELECTRON, SSH VE SAAT YOK

  Eşitlemenin kendisi dışarıdan veriliyor (`esitle`), zamanlayıcılar ve saat
  de öyle (`zamanla`, `zamaniIptal`, `simdiMs`). Uygulamada bunlar Node'un
  zamanlayıcıları, testte sahte bir saat. Toplama penceresi, kilit ve üstel
  geri çekilme böylece gerçekten bir dakika beklemeden sınanabiliyor.

  DÖRT KURAL

  1. Toplama. Her yazmada ayrı bir SSH bağlantısı açmak israf. İlk değişiklik
     kısa bir pencere açıyor, o pencerede biriken bütün değişiklikler tek
     eşitlemede gidiyor. Pencere kayan değil sabit: böylece art arda yazma
     eşitlemeyi sonsuza kadar erteleyemiyor.
  2. Tek koşu. Aynı anda iki eşitleme çalışmıyor. Sürerken gelen istek
     kaybolmuyor, sürene eklenmiyor da: biten koşudan sonra yeni bir koşu
     olarak sıraya giriyor. Sürene eklemek yanlış olurdu, çünkü çalışan koşu
     kuyruğu çoktan okumuş olabilir.
  3. Ağ yokken geri çekil. Art arda başarısızlıkta aralık ikiye katlanıyor,
     bir tavana kadar. Başarılı ilk koşuda sayaç sıfırlanıyor.
  4. Sessizce başarısız olma. Her durum değişikliği `durumDegisti` ile dışarı
     bildiriliyor; son hata ham mesajıyla duruyor. Bütün bu işin çıkış sebebi
     sessiz başarısızlıktı.
*/

/** Değişiklik toplama penceresi. Kısa: kullanıcı kaydete bastıktan sonra
 *  eşitlemenin yola çıkması için bekleyeceği süre bu. */
export const TOPLAMA_MS = 2500;

/** Üstel geri çekilmenin tavanı. Ağ günlerce yoksa bile yarım saatte bir
 *  deneniyor: tamamen susarsa ağ geri geldiğinde kimse fark etmez. */
export const EN_COK_GERI_CEKILME_MS = 30 * 60 * 1000;

/**
 * Bir sonraki koşunun ne kadar sonra olacağını söyler.
 *
 * Saf işlev: saate bakmıyor, durum tutmuyor. Art arda hata yoksa normal
 * aralık, varsa aralığın iki katı, dört katı diye gidiyor ve tavanda duruyor.
 */
export function geriCekilmeGecikmesi(aralikMs, ardArdaHata, enCokMs = EN_COK_GERI_CEKILME_MS) {
	if (!Number.isFinite(aralikMs) || aralikMs <= 0) return enCokMs;
	if (!Number.isFinite(ardArdaHata) || ardArdaHata <= 0) return Math.min(aralikMs, enCokMs);
	// Üs sınırlanıyor: 2 ** 1000 sonsuz olur ve Math.min sonsuzla anlamsızlaşır.
	const gecikme = aralikMs * 2 ** Math.min(Math.floor(ardArdaHata), 20);
	return Math.min(gecikme, enCokMs);
}

/** `esitle()` cevabını ekranda gösterilecek dört sayıya indirger. */
export function sonucuOzetle(sonuc) {
	const gonderim = sonuc?.gonderim ?? {};
	const cekis = sonuc?.cekis ?? {};
	return {
		gonderilen: Number(gonderim.gonderilen ?? 0),
		bosKuyruk: Boolean(gonderim.bosKuyruk),
		yazilan: Number(cekis.yazilan ?? 0),
		atlanan: Number(cekis.atlanan ?? 0),
	};
}

/**
 * Eşitleme yöneticisi.
 *
 * @param esitle        async () => ({ gonderim, cekis }) - gerçek eşitleme
 * @param ayarlariOku   () => ({ otomatik, aralikMs, ayarTamam, eksikler })
 * @param durumDegisti  (durum) => void - her değişiklikte çağrılıyor
 * @param zamanla       (islev, ms) => isaret
 * @param zamaniIptal   (isaret) => void
 * @param simdiMs       () => number
 */
export function esitlemeYoneticisiKur({
	esitle,
	ayarlariOku,
	durumDegisti = () => {},
	zamanla = (islev, ms) => setTimeout(islev, ms),
	zamaniIptal = (isaret) => clearTimeout(isaret),
	simdiMs = () => Date.now(),
	toplamaMs = TOPLAMA_MS,
	enCokGeriCekilmeMs = EN_COK_GERI_CEKILME_MS,
}) {
	let ayar = { otomatik: false, aralikMs: 3 * 60 * 1000, ayarTamam: false, eksikler: [] };

	/** `baslat()` çağrıldı mı. Çağrılmadan hiçbir zamanlayıcı kurulmuyor:
	 *  testte ve uygulama kapanırken arkada koşu kalmasın. */
	let calisiyor = false;
	let suruyor = false;

	/** Süren koşunun ve onun arkasına sıralanmış koşunun sözleri. */
	let suren = null;
	let siradaki = null;

	let toplamaIsareti = null;
	let araIsareti = null;

	/** Eşitlenmeyi bekleyen değişikliklerin sebepleri. Sayı değil küme:
	 *  ekranda "müşteri kaydı, talep yanıtı bekliyor" diyebilmek için. */
	const bekleyenSebepler = new Set();

	let ardArdaHata = 0;
	let sonBasari = null;
	let sonHata = null;
	let sonSonuc = null;
	let siradakiCalismaMs = null;
	/** Ayarlar eksikken her aralıkta bağırmamak için: bir kez bildirilip
	 *  beklemeye geçiliyor. */
	let ayarUyarisiVerildi = false;

	const anIso = () => new Date(simdiMs()).toISOString();

	function durum() {
		return {
			otomatik: ayar.otomatik,
			aralikDk: Math.round(ayar.aralikMs / 60000),
			ayarTamam: ayar.ayarTamam,
			ayarEksikleri: ayar.eksikler,
			suruyor,
			bekleyenSebepler: [...bekleyenSebepler],
			ardArdaHata,
			sonBasari,
			sonHata,
			sonSonuc,
			siradakiCalisma: siradakiCalismaMs === null ? null : new Date(siradakiCalismaMs).toISOString(),
			/* Otomatik eşitleme neden beklemede: ayar eksik mi, kapatılmış mı,
			   yoksa her şey yolunda mı. Arayüz bunu olduğu gibi yazıyor. */
			beklemeSebebi: !ayar.ayarTamam ? 'ayar-eksik' : !ayar.otomatik ? 'kapali' : null,
			ayarUyarisiVerildi,
		};
	}

	function bildir() {
		try {
			durumDegisti(durum());
		} catch {
			// Durum bildirimi başarısız olursa eşitleme durmamalı: pencere
			// kapanmış olabilir, bu beklenen bir durum.
		}
	}

	/* ---------------------------------------------------------------- */
	/* Zamanlayıcılar                                                    */
	/* ---------------------------------------------------------------- */

	function toplamayiIptalEt() {
		if (toplamaIsareti === null) return;
		zamaniIptal(toplamaIsareti);
		toplamaIsareti = null;
	}

	function arayiIptalEt() {
		if (araIsareti === null) return;
		zamaniIptal(araIsareti);
		araIsareti = null;
	}

	/**
	 * Düzenli dinlemeyi kurar. Her koşudan sonra yeniden kuruluyor; gecikme
	 * art arda hataya göre büyüyor.
	 *
	 * Ayarlar eksikken ya da otomatik kapalıyken hiç kurulmuyor. Eksik ayarla
	 * her aralıkta SSH denemek, dakikada bir aynı hatayı üretmek demekti.
	 */
	function arayiKur() {
		arayiIptalEt();
		siradakiCalismaMs = null;
		if (!calisiyor || !ayar.otomatik || !ayar.ayarTamam) return;
		const gecikme = geriCekilmeGecikmesi(ayar.aralikMs, ardArdaHata, enCokGeriCekilmeMs);
		siradakiCalismaMs = simdiMs() + gecikme;
		araIsareti = zamanla(() => {
			araIsareti = null;
			kosuIste('aralik').catch(bosGec);
		}, gecikme);
	}

	/**
	 * Toplama penceresini açar.
	 *
	 * Pencere KAYMIYOR: açıkken gelen yeni değişiklik süreyi yeniden
	 * başlatmıyor, açık pencereye giriyor. Kayan pencere olsaydı, arka arkaya
	 * kayıt yapan bir kullanıcı eşitlemeyi süresiz erteleyebilirdi.
	 */
	function toplamayiKur() {
		if (!calisiyor || !ayar.otomatik || !ayar.ayarTamam) return;
		if (toplamaIsareti !== null || bekleyenSebepler.size === 0) return;
		toplamaIsareti = zamanla(() => {
			toplamaIsareti = null;
			kosuIste('degisiklik').catch(bosGec);
		}, toplamaMs);
	}

	/* ---------------------------------------------------------------- */
	/* Koşu                                                              */
	/* ---------------------------------------------------------------- */

	async function kosuyuYurut(sebep) {
		suruyor = true;
		toplamayiIptalEt();
		arayiIptalEt();
		siradakiCalismaMs = null;
		const kapsanan = [...bekleyenSebepler];
		bekleyenSebepler.clear();
		bildir();

		try {
			const sonuc = await esitle();
			ardArdaHata = 0;
			sonBasari = anIso();
			sonHata = null;
			sonSonuc = sonucuOzetle(sonuc);
			return sonuc;
		} catch (hata) {
			ardArdaHata += 1;
			sonHata = { mesaj: hata?.message ?? String(hata), an: anIso(), sebep };
			/* Bekleyenler geri konuyor. Kuyruk satırları zaten veritabanında
			   duruyor ve kaybolmadı; bu yalnızca ekrandaki "ne bekliyor"
			   bilgisinin doğru kalması için. */
			for (const s of kapsanan) bekleyenSebepler.add(s);
			throw hata;
		} finally {
			suruyor = false;
			arayiKur();
			bildir();
		}
	}

	/**
	 * Bir koşu ister. Koşu sürüyorsa istek KAYBOLMUYOR: sürenin arkasına tek
	 * bir koşu sıralanıyor. Aynı anda on istek gelse bile arkada bir tane
	 * birikiyor, çünkü o bir tane hepsini kapsıyor.
	 */
	function kosuIste(sebep) {
		if (suren) {
			if (!siradaki) {
				siradaki = suren.then(bosGec, bosGec).then(() => {
					siradaki = null;
					return kosuIste(sebep);
				});
			}
			return siradaki;
		}
		const bitti = () => {
			suren = null;
		};
		suren = kosuyuYurut(sebep).then(
			(sonuc) => {
				bitti();
				return sonuc;
			},
			(hata) => {
				bitti();
				throw hata;
			},
		);
		return suren;
	}

	/* ---------------------------------------------------------------- */
	/* Dışa açılan yüzey                                                 */
	/* ---------------------------------------------------------------- */

	/**
	 * Kuyruğa kayıt düştüğünü bildirir. Müşteri kaydedilince, iş kaydedilince,
	 * talebe yanıt yazılınca, talep durumu değişince buraya geliyor.
	 *
	 * Otomatik kapalıyken hiçbir şey tetiklemiyor, yalnızca "bekliyor" olarak
	 * sayılıyor: elle eşitleme düğmesi çalışmaya devam ediyor.
	 */
	function degisiklikBildir(sebep = 'degisiklik') {
		bekleyenSebepler.add(String(sebep));
		if (calisiyor && ayar.otomatik && !ayar.ayarTamam && !ayarUyarisiVerildi) {
			ayarUyarisiVerildi = true;
		}
		toplamayiKur();
		bildir();
	}

	/** Eşitleme düğmesi ve davet üretimi buradan geçiyor: kilit ortak. */
	function elleCalistir() {
		return kosuIste('elle');
	}

	/** Ayarlar değişince (eşitleme ayarları ya da otomatik açma/kapama). */
	function ayarlariYenile() {
		const yeni = ayarlariOku() ?? {};
		const oncekiTamam = ayar.ayarTamam;
		ayar = {
			otomatik: Boolean(yeni.otomatik),
			aralikMs: Number.isFinite(yeni.aralikMs) && yeni.aralikMs > 0 ? yeni.aralikMs : ayar.aralikMs,
			ayarTamam: Boolean(yeni.ayarTamam),
			eksikler: Array.isArray(yeni.eksikler) ? yeni.eksikler : [],
		};
		// Eksik ayar tamamlandıysa uyarı bayrağı düşüyor: bir dahaki eksiklikte
		// kullanıcı yeniden bilgilendirilsin.
		if (ayar.ayarTamam && !oncekiTamam) ayarUyarisiVerildi = false;
		if (!ayar.otomatik || !ayar.ayarTamam) toplamayiIptalEt();
		arayiKur();
		toplamayiKur();
		bildir();
		return durum();
	}

	function baslat() {
		calisiyor = true;
		ayarlariYenile();
	}

	function durdur() {
		calisiyor = false;
		toplamayiIptalEt();
		arayiIptalEt();
		siradakiCalismaMs = null;
	}

	return {
		baslat,
		durdur,
		degisiklikBildir,
		elleCalistir,
		ayarlariYenile,
		durum,
		/** Yalnızca test için: koşu sürüyor mu. */
		suruyorMu: () => suruyor,
	};
}

function bosGec() {}

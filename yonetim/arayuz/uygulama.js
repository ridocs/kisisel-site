/*
  ARAYÜZ

  Bu dosya renderer'da çalışıyor: Node yok, dosya sistemi yok, ağ yok.
  Elindeki tek kapı `window.yonetim`, o da `../onyukleme.cjs` içinde adı
  tek tek yazılmış kanallardan ibaret.

  İş mantığı burada YENİDEN YAZILMIYOR: para biçimi, durum adları ve form
  doğrulaması `../is-mantigi.mjs` içinden geliyor. Aynı doğrulama ana
  süreçte bir kez daha çalışıyor; buradaki hızlı geri bildirim için, oradaki
  son söz için.

  DOM elle kuruluyor, `innerHTML` kullanılmıyor. Müşteri adı, not ve iş
  özeti kullanıcı metnidir; HTML olarak yorumlanmasının hiçbir faydası,
  yanlış yorumlanmasının ise bilinen bir bedeli var.
*/

import {
	ASAMA_DURUMLARI,
	ESITLEME_AYARLARI,
	IS_DURUMLARI,
	MUSTERI_DURUMLARI,
	ODEME_TURLERI,
	OTOMATIK_ARALIK,
	TALEP_DURUMLARI,
	TALEP_ONCELIKLERI,
	asamaGirdisiHazirla,
	buAy,
	esitlemeAyariDogrula,
	isGirdisiHazirla,
	kurusBicimle,
	kurusGirdiye,
	musteriGirdisiHazirla,
	odemeGirdisiHazirla,
	otomatikAyariDogrula,
	revizeGirdisiHazirla,
} from '../is-mantigi.mjs';

const kapi = window.yonetim;

/* ------------------------------------------------------------------ */
/* Küçük yardımcılar                                                   */
/* ------------------------------------------------------------------ */

/** Etiket, özellikler ve çocuklardan DOM düğümü kurar. */
function el(etiket, ozellikler = {}, cocuklar = []) {
	const dugum = document.createElement(etiket);
	for (const [ad, deger] of Object.entries(ozellikler)) {
		if (deger === null || deger === undefined || deger === false) continue;
		if (ad === 'sinif') dugum.className = deger;
		else if (ad === 'metin') dugum.textContent = String(deger);
		else if (ad === 'tikla') dugum.addEventListener('click', deger);
		else if (ad === 'degisti') dugum.addEventListener('change', deger);
		else if (ad === 'girdi') dugum.addEventListener('input', deger);
		else if (ad === 'deger') dugum.value = deger;
		else if (ad === 'isaretli') dugum.checked = Boolean(deger);
		else if (ad === 'tip') dugum.type = deger;
		/*
		  Ölçü değerleri CSSOM üzerinden veriliyor, `style` NİTELİĞİ olarak
		  değil. İçerik güvenlik politikasında 'unsafe-inline' yok; satır içi
		  `style` niteliği engelleniyor ve sessizce uygulanmıyor. CSSOM
		  ataması politikanın kapsamı dışında, bu yüzden çalışıyor.
		*/
		else if (ad === 'stil') Object.assign(dugum.style, deger);
		else dugum.setAttribute(ad, deger === true ? '' : String(deger));
	}
	for (const cocuk of [].concat(cocuklar)) {
		if (cocuk === null || cocuk === undefined || cocuk === false) continue;
		dugum.append(typeof cocuk === 'string' ? document.createTextNode(cocuk) : cocuk);
	}
	return dugum;
}

const tl = (kurus) => kurusBicimle(kurus);

/** "2026-09-12" -> "12.09.2026". Tarih nesnesine çevrilmiyor: `new Date`
 *  saat dilimi yüzünden günü bir geri alabiliyor. */
function gunBicim(deger) {
	if (!deger) return '';
	const [yil, ay, gun] = String(deger).slice(0, 10).split('-');
	return gun ? `${gun}.${ay}.${yil}` : String(deger);
}

/**
 * Tam ISO damgasını yerel saate çevirir: "12.09.2026 14:05".
 *
 * Gün alanlarında `gunBicim` kullanılıyor, çünkü orada `new Date` saat
 * dilimi yüzünden günü bir geri alabiliyor. Burada o tuzak yok: damga
 * saati ve dilimi kendi taşıyor, dönüştürülmesi gereken de tam olarak bu.
 */
function anBicim(deger) {
	if (!deger) return '';
	const metin = String(deger);
	if (!metin.includes('T')) return gunBicim(metin);
	const an = new Date(metin);
	if (Number.isNaN(an.getTime())) return metin;
	const iki = (sayi) => String(sayi).padStart(2, '0');
	return `${iki(an.getDate())}.${iki(an.getMonth() + 1)}.${an.getFullYear()} ${iki(an.getHours())}:${iki(an.getMinutes())}`;
}

/** "3 saat önce" gibi kaba bir yaş. Kesin an zaten yanında yazıyor. */
function gecenSure(damga) {
	if (!damga) return '';
	const an = new Date(damga).getTime();
	if (Number.isNaN(an)) return '';
	const dakika = Math.max(0, Math.round((Date.now() - an) / 60000));
	if (dakika < 1) return 'az önce';
	if (dakika < 60) return `${dakika} dakika önce`;
	const saat = Math.round(dakika / 60);
	if (saat < 24) return `${saat} saat önce`;
	return `${Math.round(saat / 24)} gün önce`;
}

/** "3 dakika sonra" gibi kaba bir uzaklık. `gecenSure` geçmişe bakıyor,
 *  bu geleceğe: planlanmış bir sonraki eşitleme için. */
function kalanSure(damga) {
	if (!damga) return '';
	const an = new Date(damga).getTime();
	if (Number.isNaN(an)) return '';
	const dakika = Math.round((an - Date.now()) / 60000);
	if (dakika <= 0) return 'birazdan';
	if (dakika < 60) return `${dakika} dakika sonra`;
	return `${Math.round(dakika / 60)} saat sonra`;
}

const AY_ADLARI = [
	'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
	'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function ayBicim(ay) {
	const [yil, no] = String(ay).split('-');
	return `${AY_ADLARI[Number(no) - 1] ?? no} ${yil}`;
}

const adiniBul = (liste, anahtar) =>
	liste.find((k) => k.anahtar === anahtar)?.ad ?? anahtar ?? '';

/* ------------------------------------------------------------------ */
/* Durum                                                               */
/* ------------------------------------------------------------------ */

const durum = {
	ekran: 'musteriler',
	sifreleme: false,
	musteriArama: '',
	arsivDahil: false,
	isArama: '',
	isMusteriSuzgeci: '',
	isDurumSuzgeci: '',
	acikIsId: null,
	odemeIsId: '',
	revizeIsId: '',
	ay: buAy(),
	/*
	  Üretilen davet anahtarı YALNIZCA burada, bellekte duruyor. Ne
	  veritabanına yazılıyor ne de bir yere kaydediliyor; ekran değişince
	  ya da uygulama kapanınca kayboluyor.
	*/
	davet: null,
	talepArama: '',
	talepDurumSuzgeci: '',
	acikTalepId: null,
	/*
	  Canlı akışın son bildirdiği bağlantı durumu ve okunmamış talepler.
	  Okunmamış küme kimlik tutuyor, sayı değil: yan çubukta sayıyı,
	  listede hangi satırın yeni olduğunu göstermek için ikisi de gerekiyor.
	  Bellek dışına yazılmıyor, uygulama kapanınca sıfırlanıyor.
	*/
	akis: null,
	okunmamisTalepler: new Set(),
	/*
	  Eşitlemenin son çalışmasından kalanlar. Hata metni OLDUĞU GİBİ
	  tutuluyor: SSH'ın söylediği şey kullanıcıya gösterilecek.
	*/
	esitlemeSuruyor: false,
	esitlemeSonucu: null,
	esitlemeHatasi: null,
	/*
	  Otomatik eşitlemenin son bildirdiği durum. Ana süreçten itiliyor,
	  arayüz sormuyor.
	*/
	otomatik: null,
};

const dugumler = {
	baslik: document.getElementById('ekran-basligi'),
	araclar: document.getElementById('ekran-araclari'),
	icerik: document.getElementById('icerik'),
	bildirim: document.getElementById('bildirim'),
	gezinti: document.getElementById('gezinti'),
	rozet: document.getElementById('sifreleme-rozeti'),
	esitlemeRozeti: document.getElementById('esitleme-rozeti'),
};

function bildir(mesaj, hataMi = false) {
	dugumler.bildirim.textContent = mesaj ?? '';
	dugumler.bildirim.hidden = !mesaj;
	dugumler.bildirim.classList.toggle('hata', Boolean(hataMi));
}

/** Kanal çağrısını sarar: hata mesajı bildirim çubuğuna düşer. */
async function guvenli(islev, basariMesaji) {
	try {
		const sonuc = await islev();
		if (basariMesaji) bildir(basariMesaji);
		return sonuc;
	} catch (hata) {
		bildir(hata.message, true);
		return null;
	}
}

/* ------------------------------------------------------------------ */
/* Tablo kurucu                                                        */
/* ------------------------------------------------------------------ */

/**
 * @param basliklar [{ ad, sinif }]
 * @param satirlar  her biri hücre dizisi döndüren kayıtlar
 */
function tablo(basliklar, satirlar, bosMesaj) {
	if (!satirlar.length) return el('p', { sinif: 'bos', metin: bosMesaj });
	return el('table', {}, [
		el('thead', {}, [
			el(
				'tr',
				{},
				basliklar.map((b) => el('th', { sinif: b.sinif ?? '', metin: b.ad })),
			),
		]),
		el(
			'tbody',
			{},
			satirlar.map((hucreler) => el('tr', {}, hucreler)),
		),
	]);
}

/* ------------------------------------------------------------------ */
/* Form penceresi                                                      */
/* ------------------------------------------------------------------ */

const pencere = document.getElementById('form-penceresi');
const pencereForm = document.getElementById('form-govdesi');
const pencereBaslik = document.getElementById('form-basligi');
const pencereHata = document.getElementById('form-hata');
const pencereAlanlar = document.getElementById('form-alanlari');
document.getElementById('form-vazgec').addEventListener('click', () => pencere.close());

let acikFormIslevi = null;

/**
 * Alan tanımlarından form kurar ve pencereyi açar.
 *
 * `kaydet` bir hata dizisi döndürürse pencere KAPANMIYOR, hatalar üstte
 * görünüyor. Yazdığı her şeyi kaybetmiş bir kullanıcı, hatayı ikinci kez
 * yapmaktan daha çok sinirlenir.
 */
function formAc({ baslik, alanlar, kaydet, kaydetEtiketi = 'Kaydet' }) {
	pencereBaslik.textContent = baslik;
	pencereHata.hidden = true;
	pencereHata.textContent = '';
	pencereAlanlar.replaceChildren();
	document.getElementById('form-kaydet').textContent = kaydetEtiketi;

	for (const alan of alanlar) {
		if (alan.tip === 'aciklama') {
			pencereAlanlar.append(
				el('p', { sinif: 'alan genis ipucu kucuk', metin: alan.metin }),
			);
			continue;
		}

		let girdi;
		if (alan.tip === 'secim') {
			girdi = el(
				'select',
				{ name: alan.ad, id: `alan-${alan.ad}`, disabled: alan.pasif },
				alan.secenekler.map((s) =>
					el('option', { value: s.deger, metin: s.ad, selected: s.deger === alan.deger }),
				),
			);
			girdi.value = alan.deger ?? '';
		} else if (alan.tip === 'metinalan') {
			girdi = el('textarea', {
				name: alan.ad,
				id: `alan-${alan.ad}`,
				rows: alan.satir ?? 3,
				deger: alan.deger ?? '',
				disabled: alan.pasif,
			});
		} else if (alan.tip === 'onay') {
			girdi = el('input', {
				tip: 'checkbox',
				name: alan.ad,
				id: `alan-${alan.ad}`,
				isaretli: Boolean(alan.deger),
				disabled: alan.pasif,
			});
		} else {
			girdi = el('input', {
				tip: alan.tip ?? 'text',
				name: alan.ad,
				id: `alan-${alan.ad}`,
				deger: alan.deger ?? '',
				placeholder: alan.ornek ?? '',
				inputmode: alan.klavye ?? null,
				disabled: alan.pasif,
			});
		}

		const sarmal = el(
			'label',
			{
				sinif: `alan${alan.genis ? ' genis' : ''}${alan.tip === 'onay' ? ' onay' : ''}`,
				for: `alan-${alan.ad}`,
			},
			alan.tip === 'onay'
				? [girdi, el('span', { metin: alan.etiket })]
				: [
						el('span', { metin: alan.etiket }),
						girdi,
						alan.ipucu ? el('span', { sinif: 'ipucu', metin: alan.ipucu }) : null,
					],
		);
		pencereAlanlar.append(sarmal);
	}

	acikFormIslevi = kaydet;
	pencere.showModal();
	const ilk = pencereAlanlar.querySelector('input:not([disabled]), select, textarea');
	ilk?.focus();
}

pencereForm.addEventListener('submit', async (olay) => {
	olay.preventDefault();
	if (!acikFormIslevi) return;

	const degerler = {};
	for (const girdi of pencereAlanlar.querySelectorAll('input, select, textarea')) {
		degerler[girdi.name] = girdi.type === 'checkbox' ? (girdi.checked ? 1 : 0) : girdi.value;
	}

	const hatalar = await acikFormIslevi(degerler);
	if (hatalar && hatalar.length) {
		pencereHata.textContent = hatalar.join(' ');
		pencereHata.hidden = false;
		return;
	}
	pencere.close();
});

/* ------------------------------------------------------------------ */
/* Ekran: Müşteriler                                                   */
/* ------------------------------------------------------------------ */

async function musteriFormuAc(id) {
	const kayit = id ? await guvenli(() => kapi.musteri.getir(id)) : null;
	if (id && !kayit) return;

	const sifrelemeKapali = !durum.sifreleme;
	const cozulemedi = (varMi, deger) => (varMi && deger === null ? 'Kayıtlı ama çözülemedi.' : null);

	formAc({
		baslik: id ? 'Müşteriyi düzenle' : 'Yeni müşteri',
		alanlar: [
			{ ad: 'ad_soyad', etiket: 'Ad soyad', deger: kayit?.ad_soyad ?? '', genis: true },
			{ ad: 'telefon', etiket: 'Telefon', deger: kayit?.telefon ?? '', ornek: '0555 000 00 00' },
			{
				ad: 'durum',
				etiket: 'Durum',
				tip: 'secim',
				deger: kayit?.durum ?? 'etkin',
				secenekler: MUSTERI_DURUMLARI.map((d) => ({ deger: d.anahtar, ad: d.ad })),
			},
			{ ad: 'ilce', etiket: 'İlçe', deger: kayit?.ilce ?? '' },
			{ ad: 'sehir', etiket: 'Şehir', deger: kayit?.sehir ?? '' },
			sifrelemeKapali
				? {
						tip: 'aciklama',
						metin:
							'İşletim sisteminin anahtarlığı açılamadı. TC kimlik ve vergi numarası ' +
							'şifrelenemeyeceği için bu iki alan kapalı. Düz metin olarak kaydedilmiyor.',
					}
				: null,
			{
				ad: 'tc',
				etiket: 'TC kimlik numarası',
				deger: kayit?.tc ?? '',
				klavye: 'numeric',
				pasif: sifrelemeKapali,
				ipucu: cozulemedi(kayit?.tcVar, kayit?.tc) ?? 'Şifrelenerek saklanıyor.',
			},
			{
				ad: 'vergi',
				etiket: 'Vergi numarası',
				deger: kayit?.vergi ?? '',
				klavye: 'numeric',
				pasif: sifrelemeKapali,
				ipucu: cozulemedi(kayit?.vergiVar, kayit?.vergi) ?? 'Şifrelenerek saklanıyor.',
			},
			{ ad: 'not_metni', etiket: 'Not', tip: 'metinalan', deger: kayit?.not_metni ?? '', genis: true },
		].filter(Boolean),
		kaydet: async (degerler) => {
			/*
			  Şifreleme kapalıyken TC ve vergi alanları pasif, yani boş
			  geliyor. `depo.mjs` boş gelen bu iki alan için sütuna hiç
			  dokunmuyor, dolayısıyla daha önce şifrelenmiş değer burada
			  kaybolmuyor.
			*/
			const form = { ...degerler, id: id ?? null };
			const { hatalar } = musteriGirdisiHazirla(form);
			if (hatalar.length) return hatalar;
			const sonuc = await guvenli(() => kapi.musteri.kaydet(form));
			if (!sonuc) return ['Kaydedilemedi.'];
			bildir(sonuc.uyari ?? 'Müşteri kaydedildi.', Boolean(sonuc.uyari));
			await ekraniCiz();
			return null;
		},
	});
}

async function musterileriCiz() {
	dugumler.araclar.replaceChildren(
		el('input', {
			tip: 'search',
			sinif: 'ara',
			placeholder: 'Ad, telefon, şehir, not…',
			deger: durum.musteriArama,
			'aria-label': 'Müşteri ara',
			girdi: (o) => {
				durum.musteriArama = o.target.value;
				listeyiTazele();
			},
		}),
		el('label', { sinif: 'satir' }, [
			el('input', {
				tip: 'checkbox',
				isaretli: durum.arsivDahil,
				degisti: (o) => {
					durum.arsivDahil = o.target.checked;
					listeyiTazele();
				},
			}),
			'Arşivi göster',
		]),
		el('button', {
			sinif: 'dugme birincil',
			metin: 'Yeni müşteri',
			tikla: () => musteriFormuAc(null),
		}),
	);

	const kap = el('div', { id: 'musteri-liste' });
	dugumler.icerik.replaceChildren(kap);
	await listeyiTazele();

	async function listeyiTazele() {
		const liste =
			(await guvenli(() =>
				kapi.musteri.liste({ arama: durum.musteriArama, arsivDahil: durum.arsivDahil }),
			)) ?? [];

		kap.replaceChildren(
			tablo(
				[
					{ ad: 'Ad soyad' },
					{ ad: 'Telefon' },
					{ ad: 'Yer' },
					{ ad: 'İş', sinif: 'sayi' },
					{ ad: 'Durum' },
					{ ad: '', sinif: 'sayi' },
				],
				liste.map((m) => [
					el('td', {}, [
						el('strong', { metin: m.ad_soyad }),
						m.not_metni ? el('span', { sinif: 'alt-metin', metin: m.not_metni }) : null,
					]),
					el('td', { metin: m.telefon ?? '' }),
					el('td', { metin: [m.ilce, m.sehir].filter(Boolean).join(', ') }),
					el('td', { sinif: 'sayi', metin: String(m.is_sayisi) }),
					el('td', {}, [
						el('span', { sinif: 'etiket', metin: adiniBul(MUSTERI_DURUMLARI, m.durum) }),
					]),
					el('td', { sinif: 'islem' }, [
						el('button', {
							sinif: 'dugme kucuk',
							metin: 'İşleri',
							tikla: () => {
								durum.isMusteriSuzgeci = m.id;
								ekranaGit('isler');
							},
						}),
						el('button', {
							sinif: 'dugme kucuk',
							metin: 'Düzenle',
							tikla: () => musteriFormuAc(m.id),
						}),
						el('button', {
							sinif: 'dugme kucuk',
							metin: m.durum === 'arsiv' ? 'Geri al' : 'Arşivle',
							tikla: async () => {
								const yeni = m.durum === 'arsiv' ? 'etkin' : 'arsiv';
								await guvenli(
									() => kapi.musteri.durum(m.id, yeni),
									yeni === 'arsiv' ? 'Müşteri arşivlendi.' : 'Müşteri geri alındı.',
								);
								await listeyiTazele();
							},
						}),
					]),
				]),
				durum.musteriArama ? 'Aramaya uyan müşteri yok.' : 'Henüz müşteri yok.',
			),
		);
	}
}

/* ------------------------------------------------------------------ */
/* Ekran: İşler                                                        */
/* ------------------------------------------------------------------ */

async function isFormuAc(id, musteriId = null) {
	const musteriler = (await guvenli(() => kapi.musteri.liste({ arsivDahil: true }))) ?? [];
	if (!musteriler.length) {
		bildir('Önce en az bir müşteri eklemelisiniz.', true);
		return;
	}
	const kayit = id ? await guvenli(() => kapi.is.getir(id)) : null;
	if (id && !kayit) return;

	formAc({
		baslik: id ? 'İşi düzenle' : 'Yeni iş',
		alanlar: [
			{
				ad: 'musteri_id',
				etiket: 'Müşteri',
				tip: 'secim',
				genis: true,
				deger: kayit?.musteri_id ?? musteriId ?? musteriler[0].id,
				secenekler: musteriler.map((m) => ({ deger: m.id, ad: m.ad_soyad })),
			},
			{ ad: 'ad', etiket: 'İş adı', deger: kayit?.ad ?? '', genis: true },
			{ ad: 'tur', etiket: 'Tür', deger: kayit?.tur ?? '', ornek: 'Web sitesi, CAD, bakım…' },
			{
				ad: 'durum',
				etiket: 'Durum',
				tip: 'secim',
				deger: kayit?.durum ?? 'teklif',
				secenekler: IS_DURUMLARI.map((d) => ({ deger: d.anahtar, ad: d.ad })),
			},
			{
				ad: 'tutar',
				etiket: 'Toplam tutar (TL)',
				deger: kayit ? kurusGirdiye(kayit.tutar_kurus) : '',
				ornek: '0,00',
				ipucu: 'Revize ücretleri ayrıca eklenir.',
			},
			{
				ad: 'on_odeme_orani',
				etiket: 'Ön ödeme oranı (%)',
				tip: 'number',
				deger: kayit?.on_odeme_orani ?? '',
				ornek: '50',
				ipucu: 'Serbest. Tipik aralık 40 ile 60 arası.',
			},
			{ ad: 'baslangic', etiket: 'Başlangıç', tip: 'date', deger: kayit?.baslangic ?? '' },
			{
					ad: 'teslim',
					etiket: 'Hedef teslim tarihi',
					tip: 'date',
					deger: kayit?.teslim ?? '',
					ipucu: 'Müşteriye söylenen tarih. Panelinde görünüyor.',
				},
			{ ad: 'tekrar_eden', etiket: 'Tekrar eden iş', tip: 'onay', deger: kayit?.tekrar_eden === 1 },
			{
					ad: 'ozet',
					etiket: 'Özet',
					tip: 'metinalan',
					deger: kayit?.ozet ?? '',
					genis: true,
					ipucu: 'Müşteri bu metni panelinde okuyor. Buraya iç not yazmayın.',
				},
				{
					tip: 'aciklama',
					metin:
						'Müşterinin paneline giden alanlar: iş adı, durum, özet, toplam tutar ve ' +
						'hedef teslim tarihi. Tür, başlangıç tarihi, ön ödeme oranı ve revizeler ' +
						'yalnızca sizde kalıyor.',
				},
		],
		kaydet: async (degerler) => {
			const form = { ...degerler, id: id ?? null };
			const { hatalar } = isGirdisiHazirla(form);
			if (hatalar.length) return hatalar;
			const sonuc = await guvenli(() => kapi.is.kaydet(form), 'İş kaydedildi.');
			if (!sonuc) return ['Kaydedilemedi.'];
			await ekraniCiz();
			return null;
		},
	});
}

async function isleriCiz() {
	const musteriler = (await guvenli(() => kapi.musteri.liste({ arsivDahil: true }))) ?? [];

	dugumler.araclar.replaceChildren(
		secim(
			'Müşteri',
			[{ deger: '', ad: 'Tüm müşteriler' }, ...musteriler.map((m) => ({ deger: m.id, ad: m.ad_soyad }))],
			durum.isMusteriSuzgeci,
			(deger) => {
				durum.isMusteriSuzgeci = deger;
				tazele();
			},
		),
		secim(
			'Durum',
			[{ deger: '', ad: 'Tüm durumlar' }, ...IS_DURUMLARI.map((d) => ({ deger: d.anahtar, ad: d.ad }))],
			durum.isDurumSuzgeci,
			(deger) => {
				durum.isDurumSuzgeci = deger;
				tazele();
			},
		),
		el('input', {
			tip: 'search',
			sinif: 'ara',
			placeholder: 'İş adı, tür, özet…',
			deger: durum.isArama,
			'aria-label': 'İş ara',
			girdi: (o) => {
				durum.isArama = o.target.value;
				tazele();
			},
		}),
		el('button', {
			sinif: 'dugme birincil',
			metin: 'Yeni iş',
			tikla: () => isFormuAc(null, durum.isMusteriSuzgeci || null),
		}),
	);

	const kap = el('div');
	dugumler.icerik.replaceChildren(kap);
	await tazele();

	async function tazele() {
		const liste =
			(await guvenli(() =>
				kapi.is.liste({
					musteriId: durum.isMusteriSuzgeci || null,
					durum: durum.isDurumSuzgeci || null,
					arama: durum.isArama,
				}),
			)) ?? [];

		kap.replaceChildren(
			tablo(
				[
					{ ad: 'İş' },
					{ ad: 'Müşteri' },
					{ ad: 'Durum' },
					{ ad: 'Toplam', sinif: 'sayi' },
					{ ad: 'Tahsil edilen', sinif: 'sayi' },
					{ ad: 'Kalan', sinif: 'sayi' },
					{ ad: 'Teslim' },
					{ ad: '', sinif: 'sayi' },
				],
				liste.map((i) => [
					el('td', {}, [
						el('strong', { metin: i.ad }),
						el('span', {
							sinif: 'alt-metin',
							metin: [i.tur, i.tekrar_eden === 1 ? 'tekrar eden' : null]
								.filter(Boolean)
								.join(' · '),
						}),
					]),
					el('td', { metin: i.musteri_adi }),
					el('td', {}, [el('span', { sinif: 'etiket', metin: adiniBul(IS_DURUMLARI, i.durum) })]),
					el('td', { sinif: 'sayi', metin: tl(i.hesap.toplamKurus) }),
					el('td', { sinif: 'sayi olumlu', metin: tl(i.hesap.tahsilEdilenKurus) }),
					el('td', {
						sinif: `sayi${i.hesap.kalanKurus > 0 ? ' bekleyen' : ''}`,
						metin: tl(i.hesap.kalanKurus),
					}),
					el('td', { metin: gunBicim(i.teslim) }),
					el('td', { sinif: 'islem' }, [
						el('button', {
							sinif: 'dugme kucuk',
							metin: 'Aç',
							tikla: () => {
								durum.acikIsId = i.id;
								ekranaGit('is-detay');
							},
						}),
						el('button', { sinif: 'dugme kucuk', metin: 'Düzenle', tikla: () => isFormuAc(i.id) }),
						el('button', {
							sinif: 'dugme kucuk tehlike',
							metin: 'Sil',
							tikla: async () => {
								const onay = await kapi.onaySor(
									'İş silinsin mi?',
									`"${i.ad}" işi, ödemeleri ve revizeleriyle birlikte silinecek. Bu geri alınamaz.`,
								);
								if (!onay) return;
								await guvenli(() => kapi.is.sil(i.id), 'İş silindi.');
								await tazele();
							},
						}),
					]),
				]),
				'Bu süzgeçlere uyan iş yok.',
			),
		);
	}
}

function secim(etiket, secenekler, deger, degisti) {
	const kutu = el(
		'select',
		{
			'aria-label': etiket,
			degisti: (o) => degisti(o.target.value),
		},
		secenekler.map((s) => el('option', { value: s.deger, metin: s.ad })),
	);
	kutu.value = deger ?? '';
	return kutu;
}

/* ------------------------------------------------------------------ */
/* Ekran: İş detayı                                                    */
/* ------------------------------------------------------------------ */

async function isDetayiniCiz() {
	if (!durum.acikIsId) {
		ekranaGit('isler');
		return;
	}
	const is = await guvenli(() => kapi.is.getir(durum.acikIsId));
	if (!is) {
		ekranaGit('isler');
		return;
	}

	dugumler.baslik.textContent = is.ad;
	dugumler.araclar.replaceChildren(
		el('span', { sinif: 'etiket', metin: is.musteri_adi }),
		el('button', { sinif: 'dugme', metin: 'Düzenle', tikla: () => isFormuAc(is.id) }),
		el('button', {
			sinif: 'dugme',
			metin: 'Ödeme ekle',
			tikla: () => odemeFormuAc(null, is.id),
		}),
		el('button', {
			sinif: 'dugme',
			metin: 'Revize ekle',
			tikla: () => revizeFormuAc(null, is.id),
		}),
		el('button', {
			sinif: 'dugme',
			metin: 'Aşama ekle',
			tikla: () => asamaFormuAc(null, is.id),
		}),
		el('button', {
			sinif: 'dugme',
			metin: 'Dosya ekle',
			tikla: () => dosyaEkle(is.id),
		}),
		el('button', { sinif: 'dugme sade', metin: 'Listeye dön', tikla: () => ekranaGit('isler') }),
	);

	const h = is.hesap;
	const olcumler = el('dl', { sinif: 'olcum-izgara' }, [
		olcum('İş bedeli', tl(h.temelKurus)),
		olcum('Revizeler', tl(h.revizeKurus)),
		olcum('Toplam', tl(h.toplamKurus)),
		olcum('Tahsil edilen', tl(h.tahsilEdilenKurus), 'olumlu'),
		olcum('Kalan', tl(h.kalanKurus), h.kalanKurus > 0 ? 'bekleyen' : 'olumlu'),
		olcum(
			is.on_odeme_orani === null ? 'Ön ödeme' : `Ön ödeme (%${is.on_odeme_orani})`,
			h.onOdemeBeklenenKurus === null
				? 'oran girilmemiş'
				: `${tl(h.onOdemeAlinanKurus)} / ${tl(h.onOdemeBeklenenKurus)}`,
			h.onOdemeTamamMi === null ? '' : h.onOdemeTamamMi ? 'olumlu' : 'bekleyen',
		),
	]);

	const bilgi = el('div', { sinif: 'kart' }, [
		el('h2', { metin: 'İş bilgisi' }),
		el('p', { sinif: 'kucuk', metin: `Durum: ${adiniBul(IS_DURUMLARI, is.durum)}` }),
		el('p', {
			sinif: 'kucuk',
			metin: `Tür: ${is.tur || 'belirtilmemiş'} · Başlangıç: ${gunBicim(is.baslangic) || '-'} · Teslim: ${gunBicim(is.teslim) || '-'} · ${is.tekrar_eden === 1 ? 'Tekrar eden' : 'Tek seferlik'}`,
		}),
		is.ozet ? el('p', { metin: is.ozet }) : null,
	]);

	/*
	  Üç yeni kart kendi verisini kendisi çekiyor ve hepsi AYNI ANDA
	  isteniyor. Sırayla beklemek üç gidiş dönüş demekti; hiçbiri ötekinin
	  sonucuna bakmıyor.
	*/
	const [asamalar, dosyalar, mesajlar] = await Promise.all([
		guvenli(() => kapi.asama.liste(is.id)),
		guvenli(() => kapi.dosya.liste(is.id)),
		guvenli(() => kapi.isMesaj.liste(is.id)),
	]);

	dugumler.icerik.replaceChildren(
		olcumler,
		el('div', { sinif: 'bosluk' }),
		bilgi,
		asamaKarti(is, asamalar ?? []),
		dosyaKarti(is, dosyalar ?? []),
		yazismaKarti(is, mesajlar ?? []),
		el('div', { sinif: 'kart' }, [
			el('h2', { metin: 'Ödemeler' }),
			el('p', {
				sinif: 'kucuk',
				metin:
					'Tarih, tür ve tutar müşterinin paneline gidiyor. Yöntem ve not yalnızca ' +
					'sizde kalıyor: eşitleme beyaz listesi onları kabul etmiyor.',
			}),
			odemeTablosu(is.odemeler, () => ekraniCiz()),
		]),
		el('div', { sinif: 'kart' }, [
			el('h2', { metin: 'Revizeler' }),
			el('p', { sinif: 'kucuk', metin: 'Revizeler sunucuya çıkmıyor.' }),
			revizeTablosu(is.revizeler, () => ekraniCiz()),
		]),
	);
}

/* ------------------------------------------------------------------ */
/* İlerleme aşamaları                                                  */
/* ------------------------------------------------------------------ */

const asamaDurumAdi = (deger) => adiniBul(ASAMA_DURUMLARI, deger);

async function asamaFormuAc(mevcut, isId) {
	const dugum = mevcut ?? null;
	formAc({
		baslik: dugum ? 'Aşamayı düzenle' : 'Yeni aşama',
		alanlar: [
			{ ad: 'baslik', etiket: 'Başlık', deger: dugum?.baslik ?? '', genis: true },
			{
				ad: 'tarih',
				etiket: 'Tarih',
				tip: 'date',
				deger: dugum?.tarih ?? new Date().toISOString().slice(0, 10),
				ipucu: 'Geçmişe dönük aşama da eklenebilir.',
			},
			{
				ad: 'durum',
				etiket: 'Durum',
				tip: 'secim',
				deger: dugum?.durum ?? 'tamamlandi',
				secenekler: ASAMA_DURUMLARI.map((d) => ({ deger: d.anahtar, ad: d.ad })),
			},
			{
				ad: 'sira',
				etiket: 'Sıra',
				tip: 'number',
				deger: dugum ? String(dugum.sira) : '25',
				ipucu:
					'Ağaçtaki yeri. Otomatik aşamalar onar onar artıyor (teklif 10, ön ödeme ' +
					'20, sürüyor 30, teslim 40, kapanış 50), aradaki sayılar size kalıyor.',
			},
			{
				ad: 'paylasildi',
				etiket: 'Müşteriyle paylaş',
				tip: 'onay',
				deger: dugum ? dugum.paylasildi === 1 : true,
			},
			{
				ad: 'aciklama',
				etiket: 'Açıklama',
				tip: 'metinalan',
				deger: dugum?.aciklama ?? '',
				genis: true,
			},
			{
				tip: 'aciklama',
				metin:
					'İşaret kaldırılırsa aşama eşitleme kuyruğuna hiç yazılmaz, yani sunucuda ' +
					'bulunmaz. Daha önce paylaşılmış bir aşamanın işareti kaldırılırsa ' +
					'sunucudaki kopyası silinir.',
			},
		],
		kaydet: async (degerler) => {
			const form = { ...degerler, id: dugum?.id ?? null, is_id: isId };
			const { hatalar } = asamaGirdisiHazirla(form);
			if (hatalar.length) return hatalar;
			const sonuc = await guvenli(() => kapi.asama.kaydet(form), 'Aşama kaydedildi.');
			if (!sonuc) return ['Kaydedilemedi.'];
			await ekraniCiz();
			return null;
		},
	});
}

function asamaKarti(is, asamalar) {
	return el('div', { sinif: 'kart' }, [
		el('h2', { metin: 'İlerleme ağacı' }),
		el('p', {
			sinif: 'kucuk',
			metin:
				'İşin durumu değiştikçe otomatik bir aşama düşüyor; aralara elle adım ' +
				'ekleyebilirsiniz. Paylaşılmayan aşama müşterinin panelinde bulunmaz.',
		}),
		tablo(
			[
				{ ad: 'Sıra', sinif: 'sayi' },
				{ ad: 'Aşama' },
				{ ad: 'Durum' },
				{ ad: 'Tarih' },
				{ ad: 'Kaynak' },
				{ ad: 'Paylaşım' },
				{ ad: '', sinif: 'sayi' },
			],
			asamalar.map((a) => [
				el('td', { sinif: 'sayi', metin: String(a.sira) }),
				el('td', {}, [
					el('strong', { metin: a.baslik }),
					a.aciklama ? el('span', { sinif: 'alt-metin', metin: a.aciklama }) : null,
				]),
				el('td', {}, [el('span', { sinif: 'etiket', metin: asamaDurumAdi(a.durum) })]),
				el('td', { metin: gunBicim(a.tarih) }),
				el('td', { metin: a.kaynak === 'otomatik' ? 'Otomatik' : 'Elle' }),
				el('td', {}, [
					el('span', {
						sinif: `etiket ${a.paylasildi === 1 ? 'olumlu' : 'bekleyen'}`,
						metin: a.paylasildi === 1 ? 'Paylaşıldı' : 'Gizli',
					}),
				]),
				el('td', { sinif: 'islem' }, [
					el('button', {
						sinif: 'dugme kucuk',
						metin: 'Düzenle',
						tikla: () => asamaFormuAc(a, is.id),
					}),
					el('button', {
						sinif: 'dugme kucuk tehlike',
						metin: 'Sil',
						tikla: async () => {
							const onay = await kapi.onaySor(
								'Aşama silinsin mi?',
								`"${a.baslik}" aşaması silinecek. Paylaşılmışsa müşterinin panelinden de kalkar.`,
							);
							if (!onay) return;
							await guvenli(() => kapi.asama.sil(a.id), 'Aşama silindi.');
							await ekraniCiz();
						},
					}),
				]),
			]),
			'Bu işte henüz aşama yok.',
		),
	]);
}

/* ------------------------------------------------------------------ */
/* Dosyalar                                                            */
/* ------------------------------------------------------------------ */

/** Bayt sayısını okunur hâle getirir: 2411724 -> "2,3 MB". */
function boyutBicim(bayt) {
	const sayi = Number(bayt) || 0;
	if (sayi < 1024) return `${sayi} B`;
	if (sayi < 1024 * 1024) return `${(sayi / 1024).toFixed(0).replace('.', ',')} KB`;
	return `${(sayi / 1048576).toFixed(1).replace('.', ',')} MB`;
}

async function dosyaEkle(isId) {
	const sonuc = await guvenli(() => kapi.dosya.ekle(isId, null));
	if (!sonuc || sonuc.iptal) return;
	if (sonuc.hatalar.length) {
		bildir(
			`${sonuc.eklenen} dosya eklendi. Eklenemeyenler: ${sonuc.hatalar.join(' · ')}`,
			true,
		);
	} else {
		bildir(`${sonuc.eklenen} dosya eklendi. Paylaşmak için "Paylaş" düğmesine basın.`);
	}
	await ekraniCiz();
}

/**
 * Görsel önizlemesi AYRI çağrılıyor ve geldiğinde yerine konuyor.
 *
 * Listeye gömülseydi her tazelemede bütün resimler base64 olarak taşınırdı.
 * Önizlemesi olmayan dosya için düğüm boş kalıyor, yerine bir şey
 * uydurulmuyor.
 */
function onizlemeKutusu(dosya) {
	const kutu = el('div', { sinif: 'onizleme' });
	if (dosya.gorsel_mi !== 1) {
		/*
		  Görsel olmayan dosyada kutu BOŞ BIRAKILMIYOR: boş gri kare kırık
		  bir resim gibi okunuyordu. Yerine uzantı yazılıyor, hem satır
		  yüksekliği aynı kalıyor hem de kutu bir şey söylüyor.
		*/
		const nokta = String(dosya.gosterilen_ad).lastIndexOf('.');
		kutu.append(
			el('span', {
				metin: nokta >= 0 ? dosya.gosterilen_ad.slice(nokta + 1).toLocaleUpperCase('tr') : '?',
			}),
		);
		return kutu;
	}
	kapi.dosya
		.onizleme(dosya.id)
		.then((adres) => {
			if (!adres) return;
			kutu.replaceChildren(
				el('img', { src: adres, alt: `${dosya.gosterilen_ad} önizlemesi`, width: 48, height: 48 }),
			);
		})
		.catch(() => {
			// Önizleme üretilememesi bir hata değil, yalnızca bir eksiklik.
		});
	return kutu;
}

function dosyaKarti(is, dosyalar) {
	return el('div', { sinif: 'kart' }, [
		el('h2', { metin: 'Dosyalar' }),
		el('p', {
			sinif: 'kucuk',
			metin:
				'Eklemek göndermek değil: dosya önce burada durur, "Paylaş" dediğinizde ' +
				'sunucuya kopyalanır ve künyesi kuyruğa yazılır. Gönderim başarısız olursa ' +
				'künye kuyruğa hiç girmez, yani panelde olmayan bir dosya görünmez.',
		}),
		tablo(
			[
				{ ad: '' },
				{ ad: 'Dosya' },
				{ ad: 'Tür' },
				{ ad: 'Boyut', sinif: 'sayi' },
				{ ad: 'Paylaşım' },
				{ ad: '', sinif: 'sayi' },
			],
			dosyalar.map((d) => [
				el('td', {}, [onizlemeKutusu(d)]),
				el('td', {}, [
					el('strong', { metin: d.gosterilen_ad }),
					el('span', { sinif: 'alt-metin', metin: d.yerel_yol }),
				]),
				el('td', { metin: d.tur }),
				el('td', { sinif: 'sayi', metin: boyutBicim(d.boyut) }),
				el('td', {}, [
					el('span', {
						sinif: `etiket ${d.paylasildi === 1 ? 'olumlu' : 'bekleyen'}`,
						metin: d.paylasildi === 1 ? `Paylaşıldı ${anBicim(d.gonderildi)}` : 'Paylaşılmadı',
					}),
				]),
				el('td', { sinif: 'islem' }, [
					d.paylasildi === 1
						? el('button', {
								sinif: 'dugme kucuk',
								metin: 'Paylaşımı geri al',
								tikla: async () => {
									await guvenli(
										() => kapi.dosya.paylasimiGeriAl(d.id),
										'Paylaşım geri alındı. Künye silme kaydı kuyruğa yazıldı.',
									);
									await ekraniCiz();
								},
							})
						: el('button', {
								sinif: 'dugme kucuk birincil',
								metin: 'Paylaş',
								tikla: async () => {
									bildir(`"${d.gosterilen_ad}" gönderiliyor, bu biraz sürebilir.`);
									const sonuc = await guvenli(() => kapi.dosya.paylas(d.id));
									if (sonuc) bildir('Dosya gönderildi, künyesi kuyruğa yazıldı.');
									await ekraniCiz();
								},
							}),
					el('button', {
						sinif: 'dugme kucuk tehlike',
						metin: 'Sil',
						tikla: async () => {
							const onay = await kapi.onaySor(
								'Dosya kaydı silinsin mi?',
								`"${d.gosterilen_ad}" defterden silinecek. Diskteki dosyanıza dokunulmaz; ` +
									'paylaşılmışsa müşterinin panelinden kalkar.',
							);
							if (!onay) return;
							await guvenli(() => kapi.dosya.sil(d.id), 'Dosya kaydı silindi.');
							await ekraniCiz();
						},
					}),
				]),
			]),
			'Bu işe eklenmiş dosya yok.',
		),
	]);
}

/* ------------------------------------------------------------------ */
/* İş bazlı yazışma                                                    */
/* ------------------------------------------------------------------ */

function yazismaKarti(is, mesajlar) {
	const musteriAdi = is.musteri_adi ?? 'Müşteri';

	const yazisma = el(
		'div',
		{ sinif: 'yazisma' },
		mesajlar.length
			? mesajlar.map((m) =>
					el('article', { sinif: `mesaj ${m.yazan === 'sahip' ? 'sahip' : 'musteri'}` }, [
						el('p', {
							sinif: 'mesaj-basligi',
							metin: `${m.yazan === 'sahip' ? 'Siz' : musteriAdi} · ${anBicim(m.zaman)}`,
						}),
						el('p', { sinif: 'mesaj-govde', metin: m.metin }),
					]),
				)
			: [el('p', { sinif: 'bos', metin: 'Bu işte henüz mesaj yok.' })],
	);

	const alan = el('textarea', {
		rows: 3,
		placeholder: 'Bu işle ilgili mesajınız…',
		'aria-label': 'İş mesajı',
	});

	return el('div', { sinif: 'kart' }, [
		el('h2', { metin: 'İş yazışması' }),
		el('p', {
			sinif: 'kucuk',
			metin:
				'Destek talebi genel konular için; bu ise yalnızca bu işin yazışması. ' +
				'Yazdığınız mesaj doğrudan sunucuya gitmez, eşitleme kuyruğuna girer ve ' +
				'aynı anda buraya da yazılır.',
		}),
		yazisma,
		alan,
		el('div', { sinif: 'dugme-sirasi' }, [
			el('button', {
				sinif: 'dugme birincil',
				metin: 'Mesajı kuyruğa ekle',
				tikla: async () => {
					const metin = alan.value.trim();
					if (metin === '') {
						bildir('Mesaj boş bırakılamaz.', true);
						return;
					}
					const sonuc = await guvenli(() => kapi.isMesaj.yaz(is.id, metin));
					if (!sonuc) return;
					alan.value = '';
					bildir('Mesaj eşitleme kuyruğuna eklendi. Bir sonraki eşitlemede gidecek.');
					await ekraniCiz();
				},
			}),
		]),
	]);
}

function olcum(baslik, deger, sinif = '') {
	return el('div', { sinif: 'olcum' }, [
		el('dt', { metin: baslik }),
		el('dd', { sinif, metin: deger }),
	]);
}

/* ------------------------------------------------------------------ */
/* Ödemeler                                                            */
/* ------------------------------------------------------------------ */

async function odemeFormuAc(id, isId, mevcut = null) {
	formAc({
		baslik: id ? 'Ödemeyi düzenle' : 'Yeni ödeme',
		alanlar: [
			{
				ad: 'tur',
				etiket: 'Tür',
				tip: 'secim',
				deger: mevcut?.tur ?? 'ara_odeme',
				secenekler: ODEME_TURLERI.map((t) => ({ deger: t.anahtar, ad: t.ad })),
			},
			{
				ad: 'tutar',
				etiket: 'Tutar (TL)',
				deger: mevcut ? kurusGirdiye(mevcut.tutar_kurus) : '',
				ornek: '0,00',
			},
			{
				ad: 'tarih',
				etiket: 'Tarih',
				tip: 'date',
				deger: mevcut?.tarih ?? new Date().toISOString().slice(0, 10),
			},
			{ ad: 'yontem', etiket: 'Yöntem', deger: mevcut?.yontem ?? '', ornek: 'Havale, nakit…' },
			{ ad: 'not_metni', etiket: 'Not', tip: 'metinalan', deger: mevcut?.not_metni ?? '', genis: true },
		],
		kaydet: async (degerler) => {
			const form = { ...degerler, id: id ?? null, is_id: isId };
			const { hatalar } = odemeGirdisiHazirla(form);
			if (hatalar.length) return hatalar;
			const sonuc = await guvenli(() => kapi.odeme.kaydet(form), 'Ödeme kaydedildi.');
			if (!sonuc) return ['Kaydedilemedi.'];
			await ekraniCiz();
			return null;
		},
	});
}

function odemeTablosu(odemeler, tazele, isSutunu = false) {
	return tablo(
		[
			{ ad: 'Tarih' },
			isSutunu ? { ad: 'İş' } : null,
			{ ad: 'Tür' },
			{ ad: 'Tutar', sinif: 'sayi' },
			{ ad: 'Yöntem' },
			{ ad: 'Not' },
			{ ad: '', sinif: 'sayi' },
		].filter(Boolean),
		odemeler.map((o) =>
			[
				el('td', { metin: gunBicim(o.tarih) }),
				isSutunu
					? el('td', {}, [
							el('strong', { metin: o.is_adi }),
							el('span', { sinif: 'alt-metin', metin: o.musteri_adi }),
						])
					: null,
				el('td', {}, [el('span', { sinif: 'etiket', metin: adiniBul(ODEME_TURLERI, o.tur) })]),
				el('td', {
					sinif: `sayi ${o.tur === 'iade' ? 'bekleyen' : 'olumlu'}`,
					metin: `${o.tur === 'iade' ? '-' : ''}${tl(Math.abs(o.tutar_kurus))}`,
				}),
				el('td', { metin: o.yontem ?? '' }),
				el('td', { metin: o.not_metni ?? '' }),
				el('td', { sinif: 'islem' }, [
					el('button', {
						sinif: 'dugme kucuk',
						metin: 'Düzenle',
						tikla: () => odemeFormuAc(o.id, o.is_id, o),
					}),
					el('button', {
						sinif: 'dugme kucuk tehlike',
						metin: 'Sil',
						tikla: async () => {
							const onay = await kapi.onaySor(
								'Ödeme silinsin mi?',
								`${gunBicim(o.tarih)} tarihli ${tl(o.tutar_kurus)} TL tutarındaki kayıt silinecek.`,
							);
							if (!onay) return;
							await guvenli(() => kapi.odeme.sil(o.id), 'Ödeme silindi.');
							await tazele();
						},
					}),
				]),
			].filter(Boolean),
		),
		'Bu işe ait ödeme kaydı yok.',
	);
}

async function odemeleriCiz() {
	const isler = (await guvenli(() => kapi.is.liste({}))) ?? [];

	dugumler.araclar.replaceChildren(
		secim(
			'İş',
			[{ deger: '', ad: 'Tüm işler' }, ...isler.map((i) => ({ deger: i.id, ad: `${i.musteri_adi} · ${i.ad}` }))],
			durum.odemeIsId,
			(deger) => {
				durum.odemeIsId = deger;
				tazele();
			},
		),
		el('button', {
			sinif: 'dugme birincil',
			metin: 'Yeni ödeme',
			tikla: () => {
				if (!durum.odemeIsId) {
					bildir('Ödeme eklemek için önce bir iş seçin.', true);
					return;
				}
				odemeFormuAc(null, durum.odemeIsId);
			},
		}),
	);

	const kap = el('div');
	dugumler.icerik.replaceChildren(kap);
	await tazele();

	async function tazele() {
		const liste =
			(await guvenli(() => kapi.odeme.liste({ isId: durum.odemeIsId || null }))) ?? [];
		kap.replaceChildren(odemeTablosu(liste, tazele, true));
	}
}

/* ------------------------------------------------------------------ */
/* Revizeler                                                           */
/* ------------------------------------------------------------------ */

async function revizeFormuAc(id, isId, mevcut = null) {
	formAc({
		baslik: id ? 'Revizeyi düzenle' : 'Yeni revize',
		alanlar: [
			{ ad: 'baslik', etiket: 'Başlık', deger: mevcut?.baslik ?? '', genis: true },
			{
				ad: 'tutar',
				etiket: 'Tutar (TL)',
				deger: mevcut ? kurusGirdiye(mevcut.tutar_kurus) : '',
				ornek: '0,00',
			},
			{
				ad: 'tarih',
				etiket: 'Tarih',
				tip: 'date',
				deger: mevcut?.tarih ?? new Date().toISOString().slice(0, 10),
			},
			{
				ad: 'ucretli',
				etiket: 'Ücretli revize',
				tip: 'onay',
				deger: mevcut ? mevcut.ucretli === 1 : true,
			},
			{ ad: 'aciklama', etiket: 'Açıklama', tip: 'metinalan', deger: mevcut?.aciklama ?? '', genis: true },
			{
				tip: 'aciklama',
				metin:
					'Ücretsiz revize kayda geçer ama işin tutarına eklenmez. Yapılan işi ' +
					'görmek için tutuluyor.',
			},
		],
		kaydet: async (degerler) => {
			const form = { ...degerler, id: id ?? null, is_id: isId };
			const { hatalar } = revizeGirdisiHazirla(form);
			if (hatalar.length) return hatalar;
			const sonuc = await guvenli(() => kapi.revize.kaydet(form), 'Revize kaydedildi.');
			if (!sonuc) return ['Kaydedilemedi.'];
			await ekraniCiz();
			return null;
		},
	});
}

function revizeTablosu(revizeler, tazele, isSutunu = false) {
	return tablo(
		[
			{ ad: 'Tarih' },
			isSutunu ? { ad: 'İş' } : null,
			{ ad: 'Başlık' },
			{ ad: 'Ücret' },
			{ ad: 'Tutar', sinif: 'sayi' },
			{ ad: '', sinif: 'sayi' },
		].filter(Boolean),
		revizeler.map((r) =>
			[
				el('td', { metin: gunBicim(r.tarih) }),
				isSutunu
					? el('td', {}, [
							el('strong', { metin: r.is_adi }),
							el('span', { sinif: 'alt-metin', metin: r.musteri_adi }),
						])
					: null,
				el('td', {}, [
					el('strong', { metin: r.baslik }),
					r.aciklama ? el('span', { sinif: 'alt-metin', metin: r.aciklama }) : null,
				]),
				el('td', {}, [
					el('span', { sinif: 'etiket', metin: r.ucretli === 1 ? 'Ücretli' : 'Ücretsiz' }),
				]),
				el('td', { sinif: 'sayi', metin: r.ucretli === 1 ? tl(r.tutar_kurus) : '-' }),
				el('td', { sinif: 'islem' }, [
					el('button', {
						sinif: 'dugme kucuk',
						metin: 'Düzenle',
						tikla: () => revizeFormuAc(r.id, r.is_id, r),
					}),
					el('button', {
						sinif: 'dugme kucuk tehlike',
						metin: 'Sil',
						tikla: async () => {
							const onay = await kapi.onaySor('Revize silinsin mi?', `"${r.baslik}" kaydı silinecek.`);
							if (!onay) return;
							await guvenli(() => kapi.revize.sil(r.id), 'Revize silindi.');
							await tazele();
						},
					}),
				]),
			].filter(Boolean),
		),
		'Bu işe ait revize kaydı yok.',
	);
}

async function revizeleriCiz() {
	const isler = (await guvenli(() => kapi.is.liste({}))) ?? [];

	dugumler.araclar.replaceChildren(
		secim(
			'İş',
			[{ deger: '', ad: 'Tüm işler' }, ...isler.map((i) => ({ deger: i.id, ad: `${i.musteri_adi} · ${i.ad}` }))],
			durum.revizeIsId,
			(deger) => {
				durum.revizeIsId = deger;
				tazele();
			},
		),
		el('button', {
			sinif: 'dugme birincil',
			metin: 'Yeni revize',
			tikla: () => {
				if (!durum.revizeIsId) {
					bildir('Revize eklemek için önce bir iş seçin.', true);
					return;
				}
				revizeFormuAc(null, durum.revizeIsId);
			},
		}),
	);

	const kap = el('div');
	dugumler.icerik.replaceChildren(kap);
	await tazele();

	async function tazele() {
		const liste =
			(await guvenli(() => kapi.revize.liste({ isId: durum.revizeIsId || null }))) ?? [];
		kap.replaceChildren(revizeTablosu(liste, tazele, true));
	}
}

/* ------------------------------------------------------------------ */
/* Ekran: İstatistikler                                                */
/* ------------------------------------------------------------------ */

async function istatistikCiz() {
	const aylar = (await guvenli(() => kapi.istatistik.aylar())) ?? [];
	const liste = [...new Set([buAy(), durum.ay, ...aylar])].filter(Boolean).sort().reverse();

	dugumler.araclar.replaceChildren(
		secim(
			'Ay',
			liste.map((a) => ({ deger: a, ad: ayBicim(a) })),
			durum.ay,
			(deger) => {
				durum.ay = deger;
				tazele();
			},
		),
	);

	const kap = el('div');
	dugumler.icerik.replaceChildren(kap);
	await tazele();

	async function tazele() {
		const s = await guvenli(() => kapi.istatistik.ay(durum.ay));
		if (!s) return;

		const enCok = Math.max(1, ...s.turDagilimi.map((t) => t.adet));

		kap.replaceChildren(
			el('dl', { sinif: 'olcum-izgara' }, [
				olcum('Müşteri', String(s.musteriSayisi)),
				olcum('Açık destek talebi', String(s.acikTalepSayisi)),
				olcum('Bu ay yapılan ön ödeme', `${tl(s.aylikYapilanOnOdemeKurus)} TL`, 'olumlu'),
				olcum('Bu ay toplam alınacak', `${tl(s.aylikToplamAlinacakKurus)} TL`),
				olcum(
					'Bu ay kalan',
					`${tl(s.aylikKalanKurus)} TL`,
					s.aylikKalanKurus > 0 ? 'bekleyen' : 'olumlu',
				),
				olcum('Bu ay tahsil edilen', `${tl(s.aylikTahsilatKurus)} TL`, 'olumlu'),
				olcum('Bu ayın işi', String(s.ayinIsSayisi)),
				olcum('Tekrar eden iş', String(s.tekrarEdenSayisi)),
				olcum('Bu ay eklenen müşteri', String(s.ayinYeniMusterisi)),
				olcum('Arşivdeki müşteri', String(s.arsivMusteriSayisi)),
			]),
			el('div', { sinif: 'bosluk' }),
			el('div', { sinif: 'kart' }, [
				el('h2', { metin: 'Ağırlıkta yapılan işler' }),
				s.turDagilimi.length
					? el(
							'div',
							{},
							s.turDagilimi.map((t) =>
								el('div', { sinif: 'cubuk-satir' }, [
									el('span', { metin: t.tur }),
									el('div', { sinif: 'cubuk' }, [
										el('span', { stil: { width: `${Math.round((t.adet / enCok) * 100)}%` } }),
									]),
									el('span', { sinif: 'sayi', metin: String(t.adet) }),
								]),
							),
						)
					: el('p', { sinif: 'bos', metin: 'Bu ayda iş kaydı yok.' }),
			]),
			el('p', {
				sinif: 'kucuk',
				metin:
					'Bir iş, teslim tarihinin ayına sayılıyor; teslim girilmemişse başlangıcın ' +
					'ayına. Ön ödeme ise ödemenin kendi tarihine sayılıyor. İptal edilen işler ' +
					'toplamlara girmiyor. Bu sayıların hiçbiri sunucuya gitmiyor.',
			}),
		);
	}
}

/* ------------------------------------------------------------------ */
/* Ekran: Davetler                                                     */
/* ------------------------------------------------------------------ */

async function davetleriCiz() {
	const musteriler = (await guvenli(() => kapi.musteri.liste({}))) ?? [];
	let secilen = musteriler[0]?.id ?? '';

	dugumler.araclar.replaceChildren(
		secim(
			'Müşteri',
			musteriler.length
				? musteriler.map((m) => ({ deger: m.id, ad: m.ad_soyad }))
				: [{ deger: '', ad: 'Müşteri yok' }],
			secilen,
			(deger) => {
				secilen = deger;
			},
		),
		el('button', {
			sinif: 'dugme birincil',
			metin: 'Davet anahtarı üret',
			disabled: !musteriler.length,
			tikla: async () => {
				if (!secilen) return;
				const davet = await guvenli(() => kapi.davet.uret(secilen));
				if (!davet) return;
				durum.davet = davet;
				bildir('Anahtar üretildi. Bu ekran kapanınca bir daha görülemez.');
				await tazele();
			},
		}),
	);

	const kap = el('div');
	dugumler.icerik.replaceChildren(kap);
	await tazele();

	async function tazele() {
		const parcalar = [];

		if (durum.davet) {
			const d = durum.davet;
			parcalar.push(
				el('div', { sinif: 'kart' }, [
					el('h2', { metin: `Davet anahtarı: ${d.musteriAdi}` }),
					el('div', { sinif: 'uyari-kutusu' }, [
						el('strong', { metin: 'Bu anahtar hiçbir yere kaydedilmedi. ' }),
						'Ne bu bilgisayarda ne sunucuda duruyor; kaydedilen tek şey anahtarın ' +
							'karması. Ekranı kapattığınızda ya da başka bir ekrana geçtiğinizde ' +
							'anahtar kaybolur ve bir daha gösterilemez. Kaybolursa yenisini üretin.',
					]),
					el('div', { sinif: 'anahtar-kutusu' }, [
						el('div', {}, [
							el('p', { sinif: 'anahtar', metin: d.metin }),
							el('div', { sinif: 'dugme-sirasi' }, [
								el('button', {
									sinif: 'dugme',
									metin: 'Panoya kopyala',
									tikla: async () => {
										await guvenli(() => kapi.panoyaYaz(d.metin), 'Anahtar panoya kopyalandı.');
									},
								}),
								el('button', {
									sinif: 'dugme sade',
									metin: 'Ekrandan sil',
									tikla: async () => {
										durum.davet = null;
										bildir('Anahtar ekrandan silindi.');
										await tazele();
									},
								}),
							]),
							el('p', {
								sinif: 'kucuk',
								sinif: 'kucuk ust-bosluk',
								metin: `Son kullanma: ${gunBicim(d.sonKullanma)} (7 gün, tek kullanımlık)`,
							}),
						]),
						el('div', { sinif: 'qr' }, [
							el('img', { src: d.qr, alt: `${d.musteriAdi} için davet anahtarının QR kodu`, width: 190, height: 190 }),
						]),
					]),
					el('p', {
						sinif: 'kucuk',
						metin:
							'Anahtarı müşteriye kendi tanıdığınız kanaldan verin: telefonda okuyun, ' +
							'mesajla yollayın ya da QR kodu gösterin. Harfler karışmasın diye I, L, ' +
							'O ve U alfabede yok.',
					}),
				]),
			);
		} else {
			parcalar.push(
				el('p', {
					sinif: 'bos',
					metin: musteriler.length
						? 'Müşteri seçip "Davet anahtarı üret" düğmesine basın.'
						: 'Önce bir müşteri ekleyin.',
				}),
			);
		}

		const kuyruk = (await guvenli(() => kapi.kuyruk.bekleyen())) ?? [];
		parcalar.push(
			el('div', { sinif: 'kart' }, [
				el('h2', { metin: 'Sunucuya gidecek kayıtlar' }),
				el('p', {
					sinif: 'kucuk',
					metin:
						'Eşitleme kuyruğunda bekleyenler. Bu listede tutar, TC kimlik numarası, ' +
						'vergi numarası, telefon ve adres bulunmaz; bulunamaz da, kuyruğa yazan ' +
						'kod izin verilen alanların dışını reddediyor.',
				}),
				tablo(
					[{ ad: 'Zaman' }, { ad: 'İşlem' }, { ad: 'Gövde' }],
					kuyruk.map((k) => [
						el('td', { metin: gunBicim(k.olusturuldu) }),
						el('td', {}, [el('span', { sinif: 'etiket', metin: k.islem })]),
						el('td', { sinif: 'kuyruk-govde', metin: k.govde }),
					]),
					'Kuyruk boş.',
				),
			]),
		);

		kap.replaceChildren(...parcalar);
	}
}

/* ------------------------------------------------------------------ */
/* Ekran: Eşitleme                                                     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Otomatik eşitlemenin durumu                                         */
/* ------------------------------------------------------------------ */

/*
  Eşitleme tetiğinin sebebi ana süreçte bir tanımlayıcı: kuyruk işleminin
  adı ya da koşunun cinsi. Ekranda tanımlayıcı değil cümle görünüyor.
  Tanınmayan bir anahtar olduğu gibi yazılıyor: uydurma bir ad göstermektense
  ham anahtarı göstermek yeğdir.
*/
const SEBEP_ADLARI = {
	acilis: 'açılışta kalan kayıt',
	elle: 'elle başlatıldı',
	aralik: 'düzenli dinleme',
	degisiklik: 'değişiklik sonrası',
	'musteri.yaz': 'müşteri kaydı',
	'musteri.sil': 'müşteri silme',
	'is.yaz': 'iş kaydı',
	'is.sil': 'iş silme',
	'davet.yaz': 'davet anahtarı',
	'davet.iptal': 'davet iptali',
	'talep.yanit': 'talep yanıtı',
	'talep.durum': 'talep durumu',
	'odeme.yaz': 'ödeme kaydı',
	'odeme.sil': 'ödeme silme',
	'asama.yaz': 'ilerleme aşaması',
	'asama.sil': 'aşama silme',
	'dosya.yaz': 'dosya künyesi',
	'dosya.sil': 'dosya künyesi silme',
	'is-mesaj.yaz': 'iş mesajı',
};

const sebepAdi = (anahtar) => SEBEP_ADLARI[anahtar] ?? String(anahtar ?? '');

/** "3 kayıt bekliyor" / "kuyruk boş". */
function bekleyenMetni(sayi) {
	const adet = Number(sayi ?? 0);
	return adet > 0 ? `${adet} kayıt bekliyor` : 'kuyruk boş';
}

/**
 * Yan çubuktaki rozetin metni.
 *
 * Tek satıra sığan en önemli bilgi: eşitleme çalışıyor mu, çalışmıyorsa
 * neden. Sessizce başarısız olmamanın en ucuz yolu bu satır.
 */
function otomatikRozetMetni(d) {
	if (!d) return 'Eşitleme durumu okunuyor…';
	const bekleyen = bekleyenMetni(d.bekleyenSayisi);
	if (d.suruyor) return `Eşitleniyor (${bekleyen}).`;
	if (d.beklemeSebebi === 'ayar-eksik') {
		return `Otomatik eşitleme beklemede, bağlantı ayarları eksik (${bekleyen}).`;
	}
	if (d.sonHata) {
		return `Eşitleme başarısız, ${d.ardArdaHata}. deneme (${bekleyen}).`;
	}
	if (d.beklemeSebebi === 'kapali') return `Otomatik eşitleme kapalı (${bekleyen}).`;
	if (d.sonBasari) return `Son eşitleme ${anBicim(d.sonBasari)} (${bekleyen}).`;
	return `Otomatik eşitleme açık, ${d.aralikDk} dakikada bir (${bekleyen}).`;
}

function otomatikRozetiCiz() {
	const d = durum.otomatik;
	const dugum = dugumler.esitlemeRozeti;
	dugum.textContent = otomatikRozetMetni(d);
	const kotu = Boolean(d && (d.sonHata || d.beklemeSebebi === 'ayar-eksik'));
	const iyi = Boolean(d && !kotu && d.otomatik && d.ayarTamam);
	dugum.classList.toggle('kotu', kotu);
	dugum.classList.toggle('iyi', iyi);
}

/**
 * Otomatik eşitleme bir şey yaptığında ekran kendiliğinden tazeleniyor.
 *
 * İki yerde tazeleniyor, hepsinde değil: Eşitleme ekranı (durumu gösteren
 * ekran) ve destek talebi ekranları (çekilen taleplerin göründüğü yer).
 * Kullanıcı bir alana yazıyorsa ya da form penceresi açıksa tazelenmiyor:
 * altından çekilen bir form, gösterilen tazeliğe değmez.
 */
function otomatikTazelemeUygunMu() {
	if (pencere.open) return false;
	const etkin = document.activeElement;
	if (etkin && ['INPUT', 'TEXTAREA', 'SELECT'].includes(etkin.tagName)) return false;
	return ['esitleme', 'talepler', 'talep-detay'].includes(durum.ekran);
}

/** Eşitleme ekranındaki "Otomatik eşitleme" kartı. */
function otomatikKarti(d) {
	if (!d) {
		return el('div', { sinif: 'kart' }, [
			el('h2', { metin: 'Otomatik eşitleme' }),
			el('p', { sinif: 'bos', metin: 'Durum henüz okunmadı.' }),
		]);
	}

	const satirlar = [
		[
			'Durum',
			d.beklemeSebebi === 'ayar-eksik'
				? 'Beklemede, bağlantı ayarları eksik'
				: d.beklemeSebebi === 'kapali'
					? 'Kapalı'
					: d.suruyor
						? 'Eşitleme sürüyor'
						: 'Açık',
		],
		['Dinleme aralığı', `${d.aralikDk} dakika`],
		[
			'Sonraki çalışma',
			d.siradakiCalisma ? `${anBicim(d.siradakiCalisma)} (${kalanSure(d.siradakiCalisma)})` : 'planlanmadı',
		],
		['Bekleyen kayıt', String(d.bekleyenSayisi ?? 0)],
		[
			'Bekleyen değişiklik',
			d.bekleyenSebepler?.length ? d.bekleyenSebepler.map(sebepAdi).join(', ') : 'yok',
		],
		['Art arda başarısız deneme', String(d.ardArdaHata ?? 0)],
		['Son başarılı eşitleme', d.sonBasari ? anBicim(d.sonBasari) : 'hiç olmadı'],
	];

	const parcalar = [
		el('h2', { metin: 'Otomatik eşitleme' }),
		...satirlar.map(([etiket, deger]) =>
			el('div', { sinif: 'ayar-satiri' }, [
				el('span', { sinif: 'ayar-etiketi', metin: etiket }),
				el('span', { sinif: 'ayar-degeri', metin: deger }),
			]),
		),
	];

	if (d.beklemeSebebi === 'ayar-eksik') {
		parcalar.push(
			el('p', {
				sinif: 'kucuk ust-bosluk hata-metni',
				metin:
					'Bağlantı ayarları girilene kadar otomatik eşitleme denemiyor: ' +
					'her aralıkta aynı hatayı üretmesinin kimseye faydası yok. ' +
					`Eksik olanlar: ${(d.ayarEksikleri ?? []).join(' ')}`,
			}),
		);
	}

	if (d.sonHata) {
		parcalar.push(
			el('p', {
				sinif: 'kucuk ust-bosluk',
				metin: `Son hata ${anBicim(d.sonHata.an)} tarihinde, ${sebepAdi(d.sonHata.sebep)} koşusunda:`,
			}),
			el('pre', { sinif: 'ham-hata', metin: d.sonHata.mesaj }),
			el('p', {
				sinif: 'kucuk ust-bosluk',
				metin:
					'Kuyruktaki kayıtlar duruyor, hiçbiri kaybolmadı. Art arda ' +
					'başarısızlıkta aralık ikiye katlanıyor (en çok yarım saat) ve ' +
					'ilk başarılı eşitlemede normale dönüyor.',
			}),
		);
	} else if (d.sonSonuc) {
		parcalar.push(
			el('p', {
				sinif: 'kucuk ust-bosluk',
				metin:
					`Son koşuda ${d.sonSonuc.gonderilen} işlem gönderildi, ` +
					`${d.sonSonuc.yazilan} talep yerel kopyaya yazıldı.`,
			}),
		);
	}

	return el('div', { sinif: 'kart' }, parcalar);
}

kapi.esitleme.durumDinle(async (yeni) => {
	const onceki = durum.otomatik;
	durum.otomatik = yeni;
	otomatikRozetiCiz();
	/*
	  Yalnızca bir koşu BİTTİĞİNDE ekran çiziliyor. Durum bildirimi koşu
	  başlarken de geliyor ve her bildirimde çizmek gereksiz iş olurdu.
	  "Bitti" ölçüsü damganın değişmesi: son başarı ya da son hata anı.
	*/
	const bittiMi =
		(yeni?.sonBasari && yeni.sonBasari !== (onceki?.sonBasari ?? null)) ||
		(yeni?.sonHata?.an && yeni.sonHata.an !== (onceki?.sonHata?.an ?? null));
	if (bittiMi && otomatikTazelemeUygunMu()) await ekraniCiz();
});

function esitlemeAyarFormuAc(ozet) {
	formAc({
		baslik: 'Eşitleme ayarları',
		kaydetEtiketi: 'Ayarları kaydet',
		alanlar: [
			{
				tip: 'aciklama',
				metin:
					'Bu dört değer yalnızca bu bilgisayardaki veritabanında duruyor. Depoya ' +
					'yazılmıyor, dışarı gönderilmiyor: depo herkese açık ve sunucunun adresi ' +
					'orada işi olan bir bilgi değil.',
			},
			...ESITLEME_AYARLARI.map((alan) => ({
				ad: alan.anahtar,
				etiket: alan.etiket,
				deger: ozet.ayar[alan.anahtar] ?? '',
				ornek: alan.ornek,
				ipucu: alan.ipucu,
				genis: true,
			})),
		],
		kaydet: async (degerler) => {
			const hatalar = esitlemeAyariDogrula(degerler);
			if (hatalar.length) return hatalar;
			const sonuc = await guvenli(
				() => kapi.esitleme.ayarYaz(degerler),
				'Eşitleme ayarları kaydedildi.',
			);
			if (!sonuc) return ['Kaydedilemedi.'];
			await ekraniCiz();
			return null;
		},
	});
}

function otomatikAyarFormuAc(ozet) {
	const mevcut = ozet.otomatikAyari ?? { otomatik: true, aralikDk: OTOMATIK_ARALIK.varsayilanDk };
	formAc({
		baslik: 'Otomatik eşitleme',
		kaydetEtiketi: 'Kaydet',
		alanlar: [
			{
				tip: 'aciklama',
				metin:
					'Açıkken iki şey oluyor. Bir: müşteri, iş ya da talep kaydı değiştiğinde ' +
					'eşitleme birkaç saniye içinde kendiliğinden başlıyor. İki: aşağıdaki ' +
					'aralıkla sunucudaki destek talepleri çekiliyor. Kapalıyken yalnızca ' +
					'"Eşitle" düğmesi çalışıyor.',
			},
			{
				ad: 'otomatik',
				etiket: 'Otomatik eşitleme',
				tip: 'secim',
				deger: mevcut.otomatik ? '1' : '0',
				secenekler: [
					{ deger: '1', ad: 'Açık' },
					{ deger: '0', ad: 'Kapalı' },
				],
			},
			{
				ad: 'aralikDk',
				etiket: 'Dinleme aralığı (dakika)',
				deger: String(mevcut.aralikDk),
				ornek: String(OTOMATIK_ARALIK.varsayilanDk),
				ipucu:
					`${OTOMATIK_ARALIK.enAzDk} ile ${OTOMATIK_ARALIK.enCokDk} arası. ` +
					'Bağlantı kurulamazsa aralık kendiliğinden büyüyor ve ilk başarılı ' +
					'eşitlemede normale dönüyor.',
			},
		],
		kaydet: async (degerler) => {
			const hatalar = otomatikAyariDogrula(degerler);
			if (hatalar.length) return hatalar;
			const sonuc = await guvenli(
				() =>
					kapi.esitleme.otomatikYaz({
						otomatik: degerler.otomatik === '1',
						aralikDk: degerler.aralikDk,
					}),
				'Otomatik eşitleme ayarı kaydedildi.',
			);
			if (!sonuc) return ['Kaydedilemedi.'];
			await ekraniCiz();
			return null;
		},
	});
}

async function esitlemeyiCalistir() {
	if (durum.esitlemeSuruyor) return;
	durum.esitlemeSuruyor = true;
	durum.esitlemeSonucu = null;
	durum.esitlemeHatasi = null;
	bildir(
		durum.otomatik?.suruyor
			? 'Bir eşitleme zaten sürüyor. İsteğiniz sıraya alındı, onun arkasından çalışacak.'
			: 'Eşitleme sürüyor. Sunucuya bağlanılıyor, bu bir dakika sürebilir.',
	);
	await ekraniCiz();

	try {
		durum.esitlemeSonucu = await kapi.esitleme.calistir();
		const g = durum.esitlemeSonucu.gonderim;
		const c = durum.esitlemeSonucu.cekis;
		bildir(
			`Eşitleme bitti: ${g.gonderilen} işlem gönderildi, ${c.yazilan} talep çekildi.`,
		);
	} catch (hata) {
		/*
		  Hata YUTULMUYOR. `guvenli` kullanılmadı çünkü bildirim çubuğu tek
		  satır: SSH'ın çok satırlı çıktısı ekranda, olduğu gibi duruyor.
		*/
		durum.esitlemeHatasi = hata.message;
		bildir('Eşitleme yapılamadı. Hatanın tamamı aşağıda.', true);
	} finally {
		durum.esitlemeSuruyor = false;
		await ekraniCiz();
	}
}

async function esitlemeCiz() {
	const ozet = await guvenli(() => kapi.esitleme.ozet());
	if (!ozet) return;

	dugumler.araclar.replaceChildren(
		el('button', {
			sinif: 'dugme',
			metin: 'Otomatik eşitleme',
			tikla: () => otomatikAyarFormuAc(ozet),
		}),
		el('button', {
			sinif: 'dugme',
			metin: 'Ayarları düzenle',
			disabled: durum.esitlemeSuruyor,
			tikla: () => esitlemeAyarFormuAc(ozet),
		}),
		el('button', {
			sinif: 'dugme birincil',
			// Otomatik açıkken bile elle düğme duruyor: "şimdi gitsin" demek
			// isteyen kullanıcıdan bu imkânı almanın sebebi yok.
			metin: durum.esitlemeSuruyor ? 'Eşitleniyor…' : 'Şimdi eşitle',
			disabled: durum.esitlemeSuruyor,
			tikla: esitlemeyiCalistir,
		}),
	);

	// Ana sürecin ittiği durum, henüz hiç bildirim gelmediyse özetten geliyor.
	const oto = durum.otomatik ?? ozet.otomatik ?? null;

	const parcalar = [
		el('dl', { sinif: 'olcum-izgara' }, [
			olcum(
				'Bekleyen işlem',
				String(ozet.bekleyenSayisi),
				ozet.bekleyenSayisi > 0 ? 'bekleyen' : 'olumlu',
			),
			olcum('En eski bekleyen', ozet.enEski ? gecenSure(ozet.enEski) : 'yok'),
			olcum('Son eşitleme', ozet.sonCalisma ? anBicim(ozet.sonCalisma) : 'hiç yapılmadı'),
			olcum('Son çekilen talep damgası', ozet.sonCekis ? anBicim(ozet.sonCekis) : 'yok'),
		]),
		el('div', { sinif: 'bosluk' }),
		otomatikKarti(oto),
	];

	if (durum.esitlemeSuruyor) {
		parcalar.push(
			el('div', { sinif: 'kart' }, [
				el('h2', { metin: 'Eşitleme sürüyor' }),
				el('p', {
					sinif: 'kucuk',
					metin:
						'Önce kuyruktakiler gönderiliyor, sunucu onayladıktan sonra talepler ' +
						'çekiliyor. Bağlantı kurulamazsa en geç bir dakikada hata döner.',
				}),
			]),
		);
	}

	/*
	  Elle çalıştırmanın hatası, otomatik eşitleme kartındakiyle AYNI hataysa
	  ikinci kez yazılmıyor: aynı SSH çıktısını üst üste iki kutuda görmek
	  bilgi değil gürültü.
	*/
	if (durum.esitlemeHatasi && durum.esitlemeHatasi !== oto?.sonHata?.mesaj) {
		parcalar.push(
			el('div', { sinif: 'kart' }, [
				el('h2', { metin: 'Son eşitleme hatası' }),
				el('pre', { sinif: 'ham-hata', metin: durum.esitlemeHatasi }),
				el('p', {
					sinif: 'kucuk',
					metin:
						'Mesaj kısaltılmadı, SSH ne dediyse o. "Permission denied" anahtarın ' +
						'kabul edilmediğini, "Host key verification failed" sunucunun ' +
						'tanınmadığını, "Connection timed out" makineye ulaşılamadığını söyler. ' +
						'Kuyruktaki işlemler duruyor, hiçbiri kaybolmadı.',
				}),
			]),
		);
	}

	if (durum.esitlemeSonucu) {
		const g = durum.esitlemeSonucu.gonderim;
		const c = durum.esitlemeSonucu.cekis;
		parcalar.push(
			el('div', { sinif: 'kart' }, [
				el('h2', { metin: 'Son eşitlemenin sonucu' }),
				el('p', {
					metin: g.bosKuyruk
						? 'Gönderilecek işlem yoktu.'
						: `${g.gonderilen} işlem gönderildi ve gönderildi olarak işaretlendi.`,
				}),
				el('p', {
					metin: `${c.yazilan} talep yerel kopyaya yazıldı${c.atlanan ? `, ${c.atlanan} kayıt beklenen biçimde olmadığı için atlandı` : ''}.`,
				}),
			]),
		);
	}

	const ayarSatirlari = ESITLEME_AYARLARI.map((alan) =>
		el('div', { sinif: 'ayar-satiri' }, [
			el('span', { sinif: 'ayar-etiketi', metin: alan.etiket }),
			el('span', {
				sinif: ozet.ayar[alan.anahtar] ? 'ayar-degeri' : 'ayar-degeri eksik',
				metin: ozet.ayar[alan.anahtar] || 'girilmemiş',
			}),
		]),
	);

	parcalar.push(
		el('div', { sinif: 'kart' }, [
			el('h2', { metin: 'Bağlantı ayarları' }),
			el('div', { sinif: 'uyari-kutusu' }, [
				el('strong', { metin: 'Bu değerler depoya asla yazılmaz. ' }),
				'Sunucu adresi, uzak yollar ve anahtar dosyasının yeri yalnızca bu ' +
					'bilgisayardaki veritabanının ayar tablosunda duruyor. Depo herkese açık; ' +
					'oraya yazılan bir adres bir daha geri alınamaz.',
			]),
			...ayarSatirlari,
			ozet.ayarHatalari.length
				? el('p', {
						sinif: 'kucuk ust-bosluk hata-metni',
						metin: `Eşitleme şu anda çalışmaz: ${ozet.ayarHatalari.join(' ')}`,
					})
				: el('p', {
						sinif: 'kucuk ust-bosluk',
						metin:
							'SSH anahtarı parola istemeyecek biçimde hazır olmalı: bağlantı ' +
							'BatchMode ile kuruluyor, parola sorulursa hata döner.',
					}),
		]),
		el('div', { sinif: 'kart' }, [
			el('h2', { metin: 'Kuyrukta bekleyenler' }),
			el('p', {
				sinif: 'kucuk',
				metin:
					'Sıradaki işlemler, eskiden yeniye. Gövdeleri burada gösterilmiyor; ' +
					'içlerinde ne olduğu Davetler ekranında görülebilir.',
			}),
			tablo(
				[
					{ ad: 'Sıra', sinif: 'sayi' },
					{ ad: 'İşlem' },
					{ ad: 'Kayıt kimliği' },
					{ ad: 'Eklendi' },
				],
				ozet.islemler.map((k) => [
					el('td', { sinif: 'sayi', metin: String(k.sira) }),
					el('td', {}, [el('span', { sinif: 'etiket', metin: k.islem })]),
					el('td', { sinif: 'kuyruk-govde', metin: k.kayitId ?? '' }),
					el('td', { metin: anBicim(k.olusturuldu) }),
				]),
				'Kuyruk boş, gönderilecek bir şey yok.',
			),
		]),
	);

	dugumler.icerik.replaceChildren(...parcalar);
}

/* ------------------------------------------------------------------ */
/* Canlı akış: gösterge, okunmamış işareti, olay dağıtımı              */
/* ------------------------------------------------------------------ */

/*
  Akış olayı EKRANA GÖRE işleniyor. Talep detayı açıkken yeni mesaj
  yazışmaya ekleniyor, liste açıkken satırlar tazeleniyor, başka bir
  ekrandayken yalnızca okunmamış işareti artıyor.

  Ekranı komple yeniden çizen tek bir yol yok, çünkü kullanıcı o sırada
  yanıt yazıyor olabilir. Altından çekilen bir metin kutusu, gösterilen
  tazeliğe değmez.
*/
let akisDinleyicisi = null;

/** O an ekranda duran akış göstergeleri. Ekran değişince sıfırlanıyor:
 *  kapanmış bir ekranın düğümünü boyamanın anlamı yok. */
let akisGostergeleri = [];

const AKIS_METINLERI = {
	canli: 'Akış canlı',
	baglaniyor: 'Akışa bağlanılıyor…',
	koptu: 'Akış koptu, yeniden bağlanıyor',
	'sessiz-koptu': 'Akıştan yanıt yok, yeniden bağlanıyor',
	hata: 'Akış hatası',
	durduruldu: 'Akış durduruldu',
	kapali: 'Akış kapalı',
	'ayar-eksik': 'Akış beklemede, bağlantı ayarları eksik',
};

const AKIS_KOTU = ['koptu', 'sessiz-koptu', 'hata', 'ayar-eksik', 'kapali'];

function akisMetni(d) {
	if (!d) return 'Akış durumu okunmadı';
	return AKIS_METINLERI[d.ad] ?? `Akış: ${d.ad}`;
}

function akisGostergesiniCiz(dugum) {
	const d = durum.akis;
	dugum.textContent = akisMetni(d);
	dugum.classList.toggle('iyi', d?.ad === 'canli');
	dugum.classList.toggle('kotu', Boolean(d && AKIS_KOTU.includes(d.ad)));
	/*
	  Ham hata metni başlıkta duruyor, ekranda değil. SSH'ın söyledikleri
	  kullanıcının görmesi gereken şeyler ama bir satırlık göstergeye
	  sığmıyor; üzerine gelince tamamı okunuyor.
	*/
	dugum.title = d?.sonHata
		? `${akisMetni(d)}. Son hata: ${d.sonHata}`
		: d?.sonOlay
			? `Son hareket ${anBicim(d.sonOlay)}`
			: akisMetni(d);
}

/** Yazışma ekranlarına konan küçük bağlantı göstergesi. */
function akisGostergesi() {
	const dugum = el('span', {
		sinif: 'akis-gostergesi',
		role: 'status',
		'aria-live': 'polite',
	});
	akisGostergeleri.push(dugum);
	akisGostergesiniCiz(dugum);
	return dugum;
}

/**
 * Yan çubuktaki "Destek talepleri" düğmesinin sayacı.
 *
 * Başka bir ekrandayken gelen müşteri mesajı burada görünüyor. Sayı talep
 * sayısı, mesaj sayısı değil: kullanıcının sorusu "kaç kişi bekliyor".
 */
function okunmamisRozetiniCiz() {
	const dugme = dugumler.gezinti.querySelector('button[data-ekran="talepler"]');
	if (!dugme) return;
	const adet = durum.okunmamisTalepler.size;
	let rozet = dugme.querySelector('.okunmamis-sayaci');
	if (!adet) {
		rozet?.remove();
		dugme.removeAttribute('title');
		return;
	}
	if (!rozet) {
		rozet = el('span', { sinif: 'okunmamis-sayaci' });
		dugme.insertBefore(rozet, dugme.querySelector('kbd'));
	}
	rozet.textContent = String(adet);
	dugme.title = `${adet} talepte okunmamış mesaj var`;
}

/** Talep açılınca okunmuş sayılıyor. */
function okunduIsaretle(talepId) {
	if (!durum.okunmamisTalepler.delete(talepId)) return;
	okunmamisRozetiniCiz();
}

kapi.talep.akisDurumDinle((yeni) => {
	durum.akis = yeni;
	for (const dugum of akisGostergeleri) akisGostergesiniCiz(dugum);
});

kapi.talep.akisDinle(async (hareket) => {
	/*
	  Okunmamış işareti YALNIZCA müşterinin ilk kez görülen mesajı için.
	  Sahibin kendi yanıtı akıştan geri döndüğünde `yeni` zaten false
	  (yerel kopyaya yazarken kullanılan kimlik sunucuya da o kimlikle
	  gitti), talep güncellemesi ise bir mesaj değil.
	*/
	const acikTalep = durum.ekran === 'talep-detay' && durum.acikTalepId === hareket.talepId;
	if (hareket.tur === 'mesaj' && hareket.yeni && hareket.yazan === 'musteri' && !acikTalep) {
		durum.okunmamisTalepler.add(hareket.talepId);
		okunmamisRozetiniCiz();
	}
	if (akisDinleyicisi) await akisDinleyicisi(hareket);
});

/* ------------------------------------------------------------------ */
/* Ekran: Destek talepleri                                             */
/* ------------------------------------------------------------------ */

const talepDurumAdi = (deger) => adiniBul(TALEP_DURUMLARI, deger);
const talepOncelikAdi = (deger) => (deger ? adiniBul(TALEP_ONCELIKLERI, deger) : '');

async function talepleriCiz() {
	dugumler.araclar.replaceChildren(
		secim(
			'Durum',
			[
				{ deger: '', ad: 'Tüm durumlar' },
				...TALEP_DURUMLARI.map((d) => ({ deger: d.anahtar, ad: d.ad })),
			],
			durum.talepDurumSuzgeci,
			(deger) => {
				durum.talepDurumSuzgeci = deger;
				tazele();
			},
		),
		el('input', {
			tip: 'search',
			sinif: 'ara',
			placeholder: 'Başlık, müşteri, iş…',
			deger: durum.talepArama,
			'aria-label': 'Destek talebi ara',
			girdi: (o) => {
				durum.talepArama = o.target.value;
				tazele();
			},
		}),
		akisGostergesi(),
		el('button', {
			sinif: 'dugme',
			metin: 'Eşitleme ekranı',
			tikla: () => ekranaGit('esitleme'),
		}),
	);

	const kap = el('div');
	dugumler.icerik.replaceChildren(kap);
	await tazele();

	/*
	  Akıştan gelen hareket listeyi tazeliyor. Tazelenen YALNIZCA tablo:
	  süzgeç ve arama kutusu araç çubuğunda duruyor, dokunulmuyor, yani
	  kullanıcı ararken yazdığı kaybolmuyor.

	  Art arda gelen olaylar tek tazelemeye toplanıyor. Sunucu yarım
	  saniyede bir tarıyor ve bir turda onlarca hareket akabilir; her biri
	  için ayrı sorgu çalıştırmanın kimseye faydası yok.
	*/
	let tazelemeIsareti = null;
	akisDinleyicisi = () => {
		clearTimeout(tazelemeIsareti);
		tazelemeIsareti = setTimeout(tazele, 150);
	};

	async function tazele() {
		const liste =
			(await guvenli(() =>
				kapi.talep.liste({
					arama: durum.talepArama,
					durum: durum.talepDurumSuzgeci || null,
				}),
			)) ?? [];

		kap.replaceChildren(
			tablo(
				[
					{ ad: 'Müşteri' },
					{ ad: 'Başlık' },
					{ ad: 'Durum' },
					{ ad: 'Öncelik' },
					{ ad: 'Mesaj', sinif: 'sayi' },
					{ ad: 'Son güncelleme' },
					{ ad: '', sinif: 'sayi' },
				],
				liste.map((t) => [
					el('td', {}, [
						el('strong', { metin: t.musteri_adi ?? 'Bağlanmamış müşteri' }),
						t.is_adi ? el('span', { sinif: 'alt-metin', metin: t.is_adi }) : null,
					]),
					el('td', {}, [
						durum.okunmamisTalepler.has(t.id)
							? el('span', { sinif: 'okunmamis-nokta', 'aria-label': 'Okunmamış mesaj' })
							: null,
						el('span', { metin: t.baslik }),
					]),
					el('td', {}, [el('span', { sinif: 'etiket', metin: talepDurumAdi(t.durum) })]),
					el('td', { metin: talepOncelikAdi(t.oncelik) }),
					el('td', { sinif: 'sayi', metin: String(t.mesajSayisi) }),
					el('td', {}, [
						el('span', { metin: anBicim(t.guncellendi) }),
						el('span', { sinif: 'alt-metin', metin: gecenSure(t.guncellendi) }),
					]),
					el('td', { sinif: 'islem' }, [
						el('button', {
							sinif: 'dugme kucuk',
							metin: 'Aç',
							tikla: () => {
								durum.acikTalepId = t.id;
								ekranaGit('talep-detay');
							},
						}),
					]),
				]),
				durum.talepArama || durum.talepDurumSuzgeci
					? 'Bu süzgeçlere uyan talep yok.'
					: 'Çekilmiş destek talebi yok. Eşitleme ekranından çekebilirsiniz.',
			),
			el('p', {
				sinif: 'kucuk ust-bosluk',
				metin:
					'Talepler sunucudan çekiliyor ve burada yalnızca kopyası duruyor. Yeni mesaj ' +
					'canlı akıştan saniyeler içinde düşüyor, akış koptuğunda düzenli eşitleme ' +
					'onu yine getiriyor. Yazdığınız yanıt doğrudan sunucuya gitmez, eşitleme ' +
					'kuyruğuna girer.',
			}),
		);
	}
}

async function talepDetayiniCiz() {
	if (!durum.acikTalepId) {
		ekranaGit('talepler');
		return;
	}
	const talep = await guvenli(() => kapi.talep.getir(durum.acikTalepId));
	if (!talep) {
		ekranaGit('talepler');
		return;
	}

	// Açılan talep okunmuş sayılıyor: yan çubuktaki sayaç buna göre düşüyor.
	okunduIsaretle(talep.id);

	const kapaliMi = talep.durum === 'kapandi';
	const musteriAdi = talep.musteri_adi ?? 'Müşteri';
	const durumEtiketi = el('span', { sinif: 'etiket', metin: talepDurumAdi(talep.durum) });

	dugumler.baslik.textContent = talep.baslik;
	dugumler.araclar.replaceChildren(
		...[
			el('span', { sinif: 'etiket', metin: musteriAdi }),
			durumEtiketi,
			akisGostergesi(),
			kapaliMi
				? null
				: el('button', {
						sinif: 'dugme',
						metin: 'Talebi kapat',
						tikla: async () => {
							const onay = await kapi.onaySor(
								'Talep kapatılsın mı?',
								`"${talep.baslik}" talebi kapatılacak. Bu değişiklik eşitleme kuyruğuna ` +
									'yazılır ve bir sonraki eşitlemede sunucuya gider.',
							);
							if (!onay) return;
							await guvenli(
								() => kapi.talep.durum(talep.id, 'kapandi'),
								'Talep kapatıldı. Değişiklik eşitleme kuyruğunda bekliyor.',
							);
							await ekraniCiz();
						},
					}),
			el('button', {
				sinif: 'dugme sade',
				metin: 'Listeye dön',
				tikla: () => ekranaGit('talepler'),
			}),
		].filter(Boolean),
	);

	const bilgi = el('div', { sinif: 'kart' }, [
		el('h2', { metin: 'Talep bilgisi' }),
		el('p', {
			sinif: 'kucuk',
			metin: [
				`Durum: ${talepDurumAdi(talep.durum)}`,
				talep.oncelik ? `Öncelik: ${talepOncelikAdi(talep.oncelik)}` : null,
				talep.is_adi ? `İş: ${talep.is_adi}` : null,
				`Açılış: ${anBicim(talep.olusturuldu)}`,
				`Son güncelleme: ${anBicim(talep.guncellendi)}`,
				`Çekilme: ${anBicim(talep.cekildi)}`,
			]
				.filter(Boolean)
				.join(' · '),
		}),
	]);

	function mesajDugumu(m) {
		const sahibinMi = m.yazan === 'sahip';
		return el('article', { sinif: `mesaj ${sahibinMi ? 'sahip' : 'musteri'}` }, [
			el('p', {
				sinif: 'mesaj-basligi',
				metin: `${sahibinMi ? 'Siz' : musteriAdi} · ${anBicim(m.zaman)}`,
			}),
			el('p', { sinif: 'mesaj-govde', metin: m.metin }),
		]);
	}

	const bosUyarisi = el('p', { sinif: 'bos', metin: 'Bu talepte henüz mesaj yok.' });
	const yazisma = el(
		'div',
		{ sinif: 'yazisma' },
		talep.mesajlar.length ? talep.mesajlar.map(mesajDugumu) : [bosUyarisi],
	);

	/*
	  Canlı akıştan gelen mesaj EKLENİYOR, ekran yeniden çizilmiyor.

	  Yeniden çizmek daha kısa kod olurdu ama kullanıcı tam o sırada yanıt
	  yazıyor olabilir ve yazdığı silinirdi. Bu işin çıkış noktası zaten
	  karşılıklı yazışma: iki taraf da aynı anda yazıyor.

	  Hangi mesajın zaten ekranda olduğu kimlikle biliniyor. Aynı mesaj hem
	  akıştan hem eşitlemeden gelebilir; kimlik ikisinde de aynı, yani iki
	  kez eklenmiyor.
	*/
	const gosterilenler = new Set(talep.mesajlar.map((m) => m.id));

	akisDinleyicisi = async (hareket) => {
		if (hareket.talepId !== talep.id) return;
		const taze = await guvenli(() => kapi.talep.getir(talep.id));
		if (!taze) return;

		durumEtiketi.textContent = talepDurumAdi(taze.durum);
		let eklendi = false;
		for (const m of taze.mesajlar) {
			if (gosterilenler.has(m.id)) continue;
			gosterilenler.add(m.id);
			bosUyarisi.remove();
			yazisma.append(mesajDugumu(m));
			eklendi = true;
		}
		// Yeni mesaj görünsün. `nearest` seçildi: zaten görünüyorsa sayfayı
		// oynatmıyor, okurken ekranı altından çekmesin.
		if (eklendi) yazisma.lastElementChild?.scrollIntoView({ block: 'nearest' });
	};

	const yanitAlani = el('textarea', {
		rows: 4,
		placeholder: kapaliMi ? 'Talep kapalı.' : 'Yanıtınız…',
		'aria-label': 'Yanıt metni',
		disabled: kapaliMi,
	});

	const yanitKarti = el('div', { sinif: 'kart' }, [
		el('h2', { metin: 'Yanıt yaz' }),
		yanitAlani,
		el('div', { sinif: 'dugme-sirasi' }, [
			el('button', {
				sinif: 'dugme birincil',
				metin: 'Yanıtı kuyruğa ekle',
				disabled: kapaliMi,
				tikla: async () => {
					const metin = yanitAlani.value.trim();
					if (metin === '') {
						bildir('Yanıt boş bırakılamaz.', true);
						return;
					}
					const sonuc = await guvenli(() => kapi.talep.yanitla(talep.id, metin));
					if (!sonuc) return;
					yanitAlani.value = '';
					bildir('Yanıt eşitleme kuyruğuna eklendi. Bir sonraki eşitlemede gidecek.');
					await ekraniCiz();
				},
			}),
		]),
		el('p', {
			sinif: 'kucuk ust-bosluk',
			metin: kapaliMi
				? 'Kapalı talebe yanıt yazılmıyor. Müşteri yeniden yazarsa talep sunucuda açılır.'
				: 'Yanıt doğrudan sunucuya gitmiyor: kuyruğa yazılıyor ve bir sonraki ' +
					'eşitlemede gidiyor. Aşağıda kendi yazdığınızı hemen görürsünüz, çünkü ' +
					'yerel kopyaya da eklendi.',
		}),
	]);

	dugumler.icerik.replaceChildren(
		bilgi,
		el('div', { sinif: 'kart' }, [el('h2', { metin: 'Yazışma' }), yazisma]),
		yanitKarti,
	);
}

/* ------------------------------------------------------------------ */
/* Yönlendirme                                                         */
/* ------------------------------------------------------------------ */

const EKRANLAR = {
	musteriler: { baslik: 'Müşteriler', ciz: musterileriCiz },
	isler: { baslik: 'İşler', ciz: isleriCiz },
	'is-detay': { baslik: 'İş', ciz: isDetayiniCiz, gizli: true },
	odemeler: { baslik: 'Ödemeler', ciz: odemeleriCiz },
	revizeler: { baslik: 'Revizeler', ciz: revizeleriCiz },
	istatistik: { baslik: 'İstatistikler', ciz: istatistikCiz },
	davetler: { baslik: 'Davetler', ciz: davetleriCiz },
	esitleme: { baslik: 'Eşitleme', ciz: esitlemeCiz },
	talepler: { baslik: 'Destek talepleri', ciz: talepleriCiz },
	'talep-detay': { baslik: 'Destek talebi', ciz: talepDetayiniCiz, gizli: true },
};

async function ekraniCiz() {
	const ekran = EKRANLAR[durum.ekran] ?? EKRANLAR.musteriler;
	dugumler.baslik.textContent = ekran.baslik;
	dugumler.araclar.replaceChildren();
	/*
	  Akış bağları her çizimde sıfırlanıyor. Eski ekranın dinleyicisi
	  kalsaydı, kapanmış bir ekranın düğümlerini boyamaya çalışırdı; ekranı
	  kuran işlev kendi dinleyicisini kendisi takıyor.
	*/
	akisDinleyicisi = null;
	akisGostergeleri = [];
	for (const dugme of dugumler.gezinti.querySelectorAll('button')) {
		const secili = dugme.dataset.ekran === durum.ekran;
		if (secili) dugme.setAttribute('aria-current', 'page');
		else dugme.removeAttribute('aria-current');
	}
	await ekran.ciz();
}

async function ekranaGit(anahtar) {
	if (anahtar === 'yenile') {
		await ekraniCiz();
		return;
	}
	if (!EKRANLAR[anahtar]) return;
	/*
	  Ekran değişince davet anahtarı bellekten siliniyor. Söz verilen şey
	  buydu: anahtar yalnızca gösterildiği ekranda yaşıyor.
	*/
	if (durum.ekran === 'davetler' && anahtar !== 'davetler') durum.davet = null;
	durum.ekran = anahtar;
	bildir(null);
	await ekraniCiz();
	dugumler.icerik.scrollTop = 0;
}

dugumler.gezinti.addEventListener('click', (olay) => {
	const dugme = olay.target.closest('button[data-ekran]');
	if (dugme) ekranaGit(dugme.dataset.ekran);
});

kapi.ekranDinle((anahtar) => ekranaGit(anahtar));

/* ------------------------------------------------------------------ */
/* Açılış                                                              */
/* ------------------------------------------------------------------ */

async function baslat() {
	const bilgi = await guvenli(() => kapi.durumOku());
	durum.sifreleme = Boolean(bilgi?.sifreleme);

	// İlk durum bir kez soruluyor; sonrası ana süreçten itiliyor.
	durum.otomatik = await guvenli(() => kapi.esitleme.durum());
	otomatikRozetiCiz();

	// Akış için de aynı: pencere yüklenmeden önce olan bir durum
	// değişikliği kaybolur, açılışta bir kez sorup hizalanıyoruz.
	durum.akis = await guvenli(() => kapi.talep.akisDurumu());
	okunmamisRozetiniCiz();

	dugumler.rozet.textContent = durum.sifreleme
		? 'Anahtarlık açık: TC ve vergi numarası şifreli.'
		: 'Anahtarlık kapalı: TC ve vergi numarası kaydedilemiyor.';
	dugumler.rozet.classList.add(durum.sifreleme ? 'iyi' : 'kotu');
	dugumler.rozet.title = bilgi?.veritabani ?? '';

	if (!durum.sifreleme) {
		bildir(
			'İşletim sisteminin anahtarlığı açılamadı. TC kimlik ve vergi numarası ' +
				'alanları kapalı; düz metin olarak kaydedilmeyecek.',
			true,
		);
	}

	await ekraniCiz();
}

baslat();

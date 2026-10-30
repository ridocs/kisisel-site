/*
  Yazışmanın CANLI katmanı: sunucu gönderimli olaylar (SSE).

  NEDEN SSE, NEDEN WEBSOCKET DEĞİL

  Taşınan şey tek yönlü: sunucudan istemciye "yeni mesaj var". Müşteri hiçbir
  şeyi bu kanaldan göndermiyor, gönderim hâlâ düz form POST'u. WebSocket iki
  yönlü bir kanal açar, yani gerekmeyen bir yazma yüzeyi ekler; ayrıca ters
  vekilde `Upgrade` başlığı için ayrı bir yapılandırma ister. SSE düz bir
  HTTP yanıtı: nginx'in önünden olduğu gibi geçiyor, tarayıcı tarafı
  `EventSource` ile birkaç satır ve kopan bağlantıyı tarayıcı kendisi geri
  bağlıyor.

  NEDEN YOKLAMA VAR

  SQLite'ta süreçler arası bildirim yok. Ama yoklama SUNUCUNUN İÇİNDE ve
  yerel bir dosyaya bakıyor: saniyede bir, damgalı ve sınırlı bir sorgu.
  Pahalı olan tarayıcının saniyede bir HTTP isteği atmasıydı; o kalktı.

  MÜŞTERİ YALITIMI

  Bu dosyadaki iki sorgu da `talep.musteri_id = ?` yazıyor, istisnasız.
  Mesaj sorgusu `talep_mesaji` tablosuna tek başına BAKMIYOR, her zaman
  `talep` ile birleşiyor; çünkü mesajın kendisinde müşteri sütunu yok ve
  süzgeç ancak birleşimle kurulabiliyor. Başka bir müşterinin mesajının bu
  akıştan geçmesi, panelde yapılabilecek en ağır hata olurdu; testi de bunu
  doğruluyor.
*/

import { HAREKETSIZLIK_MS } from './oturum.mjs';
import { talepDurumEtiketi } from './talepler.mjs';

/** Veritabanı yoklama aralığı. Yerel dosyaya bakmanın maliyeti bu sıklıkta ihmal edilebilir. */
export const YOKLAMA_MS = 1000;

/**
 * Nabız aralığı.
 * Veri akmadığında da düzenli bir şey gönderiliyor: ölü bağlantı anlaşılsın
 * ve ters vekil sessiz bağlantıyı zaman aşımına düşürmesin.
 */
export const NABIZ_MS = 20000;

/** Tarayıcıya önerilen yeniden bağlanma gecikmesi. */
export const YENIDEN_MS = 3000;

/** Tek turda akıtılacak en çok satır. Biriken bir kuyruk yanıtı kilitlemesin. */
export const EN_COK_SATIR = 200;

/**
 * Bir akışın en uzun ömrü.
 *
 * Hareketsizlik süresiyle AYNI ve bu bilinçli: açık bir sekme, oturumun
 * hareketsizlik sayacını süresiz uzatamasın (§7). Ara katman bu yolda
 * `oturumTazele` çağırmıyor, burası da bir saatin sonunda bağlantıyı
 * kapatıyor. Oturum gerçekten canlıysa tarayıcı yeniden bağlanıyor.
 */
export const AKIS_EN_COK_MS = HAREKETSIZLIK_MS;

/** Akış uç noktasının yolu. Ara katman bunu tanımak zorunda. */
export const AKIS_YOLU = '/api/talepler/akis';

/**
 * Talep bu müşteriye mi ait.
 * Sorgu iki koşulu birden istiyor; "kimliği bilen görür" bir yetki modeli
 * burada da yok.
 */
export function talepSahibiMi(db, musteriId, talepId) {
	if (!talepId) return false;
	return Boolean(
		db.prepare('SELECT 1 FROM talep WHERE id = ? AND musteri_id = ?').get(talepId, musteriId),
	);
}

function damgala(iso) {
	if (typeof iso !== 'string') return null;
	const ms = Date.parse(iso);
	return Number.isNaN(ms) ? null : iso;
}

/**
 * Akış penceresi: "şu damgadan sonrası" sorusunun durumunu tutuyor.
 *
 * DAMGA KARŞILAŞTIRMASI NEDEN `>=`, NEDEN `>` DEĞİL
 *
 * `talepAc` talebi ve ilk mesajı AYNI milisaniye damgasıyla yazıyor. İki
 * kayıt aynı damgayı taşıyabildiği için `> sonDamga` kullanmak, son görülen
 * kayıtla aynı milisaniyede yazılmış bir sonrakini sonsuza kadar atlardı.
 * Bunun yerine karşılaştırma `>=` ve son damgadaki kimlikler küçük bir
 * kümede tutulup eleniyor. Küme yalnızca AYNI milisaniyedeki kayıtları
 * tuttuğu için büyümüyor; damga ilerledikçe sıfırlanıyor.
 */
export function pencereAc(db, { musteriId, talepId = null, baslangic = null }) {
	const baslangicDamgasi = damgala(baslangic) ?? new Date().toISOString();

	let mesajDamgasi = baslangicDamgasi;
	let mesajKimlikleri = new Set();
	let talepDamgasi = baslangicDamgasi;
	let talepKimlikleri = new Set();

	/*
	  MÜŞTERİ SÜZGECİ BURADA, SORGUNUN İÇİNDE.
	  `talep_mesaji` tek başına sorgulanmıyor; `talep` ile birleşmeden bu
	  tablodan bir müşterinin kendi satırlarını ayıklamanın yolu yok.
	*/
	const mesajSorgusu = db.prepare(
		`SELECT m.id, m.talep_id, m.yazan, m.metin, m.zaman, t.baslik
		 FROM talep_mesaji m JOIN talep t ON t.id = m.talep_id
		 WHERE t.musteri_id = ? AND m.zaman >= ? AND (? IS NULL OR m.talep_id = ?)
		 ORDER BY m.zaman, m.id
		 LIMIT ${EN_COK_SATIR}`,
	);

	const talepSorgusu = db.prepare(
		`SELECT t.id, t.baslik, t.durum, t.guncellendi,
		        (SELECT COUNT(*) FROM talep_mesaji m WHERE m.talep_id = t.id) AS mesaj_sayisi
		 FROM talep t
		 WHERE t.musteri_id = ? AND t.guncellendi >= ? AND (? IS NULL OR t.id = ?)
		 ORDER BY t.guncellendi, t.id
		 LIMIT ${EN_COK_SATIR}`,
	);

	/*
	  BAŞLANGIÇ DAMGASINDAKİLER "GÖRÜLDÜ" SAYILIYOR.

	  İstemcinin verdiği damga, sayfaya basılmış en son hareketin damgası;
	  yani o damgadaki kayıtlar zaten ekranda. Karşılaştırma `>=` olduğu için
	  onlar da akardı ve açılışta son mesaj bir kez daha görünürdü. Burada
	  yalnızca O DAMGADAKİ kimlikler okunup elenmişler kümesine konuyor.
	  Tek seferlik ve dar bir sorgu: eşitlik, sıralama yok.
	*/
	for (const satir of db
		.prepare(
			`SELECT m.id FROM talep_mesaji m JOIN talep t ON t.id = m.talep_id
			 WHERE t.musteri_id = ? AND m.zaman = ? AND (? IS NULL OR m.talep_id = ?)`,
		)
		.all(musteriId, baslangicDamgasi, talepId, talepId)) {
		mesajKimlikleri.add(satir.id);
	}
	for (const satir of db
		.prepare(
			`SELECT id FROM talep
			 WHERE musteri_id = ? AND guncellendi = ? AND (? IS NULL OR id = ?)`,
		)
		.all(musteriId, baslangicDamgasi, talepId, talepId)) {
		talepKimlikleri.add(satir.id);
	}

	function ilerlet(satirlar, damga, kimlikler, alan) {
		const yeniler = [];
		for (const satir of satirlar) {
			if (satir[alan] === damga && kimlikler.has(satir.id)) continue;
			if (satir[alan] !== damga) {
				damga = satir[alan];
				kimlikler = new Set();
			}
			kimlikler.add(satir.id);
			yeniler.push(satir);
		}
		return { yeniler, damga, kimlikler };
	}

	return {
		/** O anki damga. Yeniden bağlanan istemciye söylenebilir. */
		get damga() {
			return mesajDamgasi > talepDamgasi ? mesajDamgasi : talepDamgasi;
		},

		/** Bir tur yoklama. Yeni olayları sırayla veriyor, yoksa boş dizi. */
		tur() {
			const olaylar = [];

			const talepler = ilerlet(
				talepSorgusu.all(musteriId, talepDamgasi, talepId, talepId),
				talepDamgasi,
				talepKimlikleri,
				'guncellendi',
			);
			talepDamgasi = talepler.damga;
			talepKimlikleri = talepler.kimlikler;
			/*
			  Durum etiketi SUNUCUDAN gidiyor. İstemcide ikinci bir kod ->
			  etiket eşlemesi tutulsaydı, sunucudakine yeni bir durum
			  eklendiğinde tarayıcı onu ham koduyla gösterirdi.
			*/
			for (const t of talepler.yeniler) {
				olaylar.push({ tur: 'talep', ...t, durum_etiketi: talepDurumEtiketi(t.durum) });
			}

			const mesajlar = ilerlet(
				mesajSorgusu.all(musteriId, mesajDamgasi, talepId, talepId),
				mesajDamgasi,
				mesajKimlikleri,
				'zaman',
			);
			mesajDamgasi = mesajlar.damga;
			mesajKimlikleri = mesajlar.kimlikler;
			for (const m of mesajlar.yeniler) olaylar.push({ tur: 'mesaj', ...m });

			return olaylar;
		},
	};
}

const KODLAYICI = new TextEncoder();

/**
 * SSE yanıtını kurar.
 *
 * Talep kimliği verilmiş ama o talep bu müşterinin değilse `null` dönüyor ve
 * akış HİÇ AÇILMIYOR; çağıran taraf bunu 404'e çeviriyor.
 *
 * Zamanlayıcılar dışarıdan verilebiliyor: testin gerçek zamanı beklemesi
 * gerekmesin ve "bağlantı kapanınca zamanlayıcı temizlendi mi" sorusu
 * ölçülebilsin diye.
 */
export function akisYaniti(db, { musteriId, talepId = null, baslangic = null, ...secenekler }) {
	if (talepId && !talepSahibiMi(db, musteriId, talepId)) return null;

	const pencere = pencereAc(db, { musteriId, talepId, baslangic });

	return sseYaniti(pencere, { ...secenekler, acilisEk: { talep: talepId ?? null } });
}

/**
 * SSE BORUSU. Yoklama penceresinden bağımsız: nabız, ömür sınırı, oturum
 * denetimi, temizlik ve yanıt başlıkları burada.
 *
 * Destek yazışması ile iş yazışması AYNI boruyu kullanıyor. İkinci bir kopya
 * yazılsaydı, buradaki zamanlayıcı temizliği ya da ömür sınırı bir gün
 * yalnızca birinde düzeltilirdi; açık kalan her zamanlayıcı da bir bellek
 * sızıntısı. Değişen tek şey `pencere.tur()`'ün ne döndürdüğü.
 *
 * `pencere`: `{ damga, tur() }`. `tur()` her çağrıda yeni olayları veriyor,
 * her olayda `tur` alanı SSE olayının adı oluyor.
 */
export function sseYaniti(
	pencere,
	{
		/** Oturum hâlâ geçerli mi. Nabız sıklığında soruluyor. */
		oturumGecerliMi = () => true,
		/** İstemci koptuğunda tetiklenen işaret (`request.signal`). */
		iptalIsareti = null,
		aralikMs = YOKLAMA_MS,
		nabizMs = NABIZ_MS,
		enCokMs = AKIS_EN_COK_MS,
		zamanlayiciKur = setInterval,
		zamanlayiciSil = clearInterval,
		simdi = () => Date.now(),
		/** `acildi` olayına eklenen alanlar: hangi yazışmaya bağlanıldığı. */
		acilisEk = {},
	} = {},
) {
	let sayac = null;
	let bitti = false;
	let kopmaDinleyicisi = null;

	/*
	  TEMİZLİK TEK YERDE. Açık kalan her zamanlayıcı bir bellek sızıntısıdır:
	  kapanmış bir bağlantı için saniyede bir veritabanı sorgusu koşmaya
	  devam eder ve süreç boyunca birikir. Üç yoldan da (kopma, süre, hata)
	  buraya geliniyor.
	*/
	function temizle() {
		if (sayac !== null) {
			zamanlayiciSil(sayac);
			sayac = null;
		}
		if (kopmaDinleyicisi && iptalIsareti) {
			iptalIsareti.removeEventListener('abort', kopmaDinleyicisi);
			kopmaDinleyicisi = null;
		}
	}

	const govde = new ReadableStream({
		start(denetim) {
			const basladiMs = simdi();
			let sonYazmaMs = basladiMs;
			let sonDenetimMs = basladiMs;

			function yaz(metin) {
				denetim.enqueue(KODLAYICI.encode(metin));
				sonYazmaMs = simdi();
			}

			function olayYaz(ad, veri) {
				yaz(`event: ${ad}\ndata: ${JSON.stringify(veri)}\n\n`);
			}

			function kapat(sebep) {
				if (bitti) return;
				bitti = true;
				temizle();
				try {
					olayYaz('bitti', { sebep });
					denetim.close();
				} catch {
					/* Akış zaten kapanmışsa yazmak hata veriyor; yapacak bir şey yok. */
				}
			}

			kopmaDinleyicisi = () => {
				/*
				  İstemci gitti. Burada `bitti` olayı yazılmıyor, yazacak kimse
				  yok; yalnızca zamanlayıcı söndürülüyor.
				*/
				if (bitti) return;
				bitti = true;
				temizle();
				try {
					denetim.close();
				} catch {
					/* Kopmuş akış. */
				}
			};
			iptalIsareti?.addEventListener('abort', kopmaDinleyicisi, { once: true });
			if (iptalIsareti?.aborted) {
				kopmaDinleyicisi();
				return;
			}

			/* Tarayıcıya yeniden bağlanma gecikmesini söylüyoruz. */
			yaz(`retry: ${YENIDEN_MS}\n\n`);
			olayYaz('acildi', { damga: pencere.damga, ...acilisEk });

			function tur() {
				if (bitti) return;
				try {
					const olaylar = pencere.tur();
					for (const olay of olaylar) olayYaz(olay.tur, olay);

					const s = simdi();

					/*
					  Oturum denetimi nabız sıklığında, her turda değil: açık bir
					  akışın süresiz yaşamaması gerekiyor ama bunu saniyede bir
					  sormanın da bir karşılığı yok.
					*/
					if (s - sonDenetimMs >= nabizMs) {
						sonDenetimMs = s;
						if (!oturumGecerliMi()) return kapat('oturum');
					}

					if (s - basladiMs >= enCokMs) return kapat('sure');

					if (olaylar.length === 0 && s - sonYazmaMs >= nabizMs) {
						olayYaz('nabiz', { zaman: new Date(s).toISOString() });
					}
				} catch {
					/* Veritabanı hatası akışı kapatıyor; tarayıcı yeniden bağlanıyor. */
					kapat('hata');
				}
			}

			/* İlk tur hemen: bağlantı kurulur kurulmaz birikmişler aksın. */
			tur();
			if (!bitti) sayac = zamanlayiciKur(tur, aralikMs);
		},

		/*
		  Tarayıcı sekmeyi kapattığında `cancel` geliyor. `iptalIsareti` her
		  ortamda tetiklenmiyor, bu yüzden ikinci bir temizlik kapısı.
		*/
		cancel() {
			bitti = true;
			temizle();
		},
	});

	return new Response(govde, {
		status: 200,
		headers: {
			'content-type': 'text/event-stream; charset=utf-8',
			/* Kişiye özel ve süreklilik arz eden bir yanıt: hiçbir yerde durmamalı. */
			'cache-control': 'no-store',
			/*
			  nginx varsayılan olarak vekil yanıtını ara belleğe alıyor ve SSE
			  olayları tamponda bekliyor; akış o zaman anlık olmuyor. Bu başlık
			  nginx'e o tamponu bu yanıt için kapatmasını söylüyor.
			*/
			'x-accel-buffering': 'no',
		},
	});
}

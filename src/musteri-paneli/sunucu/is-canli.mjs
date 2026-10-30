/*
  İş yazışmasının CANLI katmanı.

  Destek yazışmasının akışıyla (`sunucu/canli.mjs`) aynı boruyu kullanıyor:
  nabız, ömür sınırı, oturum denetimi ve zamanlayıcı temizliği orada, tek
  yerde. Burada yalnızca YOKLAMA PENCERESİ var, yani "bu işte ne değişti"
  sorusunun sorgusu.

  MÜŞTERİ YALITIMI, orada olduğu gibi, SORGUNUN İÇİNDE. `is_mesaji`
  tablosunda müşteri sütunu yok; sorgu her zaman `is_ozeti` ile birleşiyor,
  çünkü süzgeç ancak birleşimle kurulabiliyor. Akış ayrıca yalnızca işin
  sahibi doğrulandıktan sonra açılıyor.

  Damga karşılaştırması `>=` ve aynı milisaniyedeki kimliklerin elenmesi:
  gerekçenin tamamı `sunucu/canli.mjs` içindeki `pencereAc` başlığında.
  Aynı tuzak burada da var, çünkü mesaj ile işin `guncellendi` damgası aynı
  işlemde ve aynı milisaniyeyle yazılıyor.
*/

import { EN_COK_SATIR, sseYaniti } from './canli.mjs';
import { isDurumEtiketi } from './talepler.mjs';

/** İş akışının yolu. Ara katman bunu da tanımak zorunda (oturum tazelenmiyor). */
export const IS_AKIS_YOLU = '/api/isler/akis';

/** İş bu müşteriye mi ait. "Kimliği bilen görür" bir yetki modeli burada da yok. */
export function isSahibiMi(db, musteriId, isId) {
	if (!isId) return false;
	return Boolean(
		db.prepare('SELECT 1 FROM is_ozeti WHERE id = ? AND musteri_id = ?').get(isId, musteriId),
	);
}

function damgala(iso) {
	if (typeof iso !== 'string') return null;
	return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** Tek işin yoklama penceresi: o işin mesajları ve durum değişikliği. */
export function isPencereAc(db, { musteriId, isId, baslangic = null }) {
	const baslangicDamgasi = damgala(baslangic) ?? new Date().toISOString();

	let mesajDamgasi = baslangicDamgasi;
	let mesajKimlikleri = new Set();
	let isDamgasi = baslangicDamgasi;
	let isKimlikleri = new Set();

	const mesajSorgusu = db.prepare(
		`SELECT m.id, m.is_id, m.yazan, m.metin, m.zaman
		 FROM is_mesaji m JOIN is_ozeti i ON i.id = m.is_id
		 WHERE i.musteri_id = ? AND m.is_id = ? AND m.zaman >= ?
		 ORDER BY m.zaman, m.id
		 LIMIT ${EN_COK_SATIR}`,
	);

	const isSorgusu = db.prepare(
		`SELECT id, ad, durum, guncellendi
		 FROM is_ozeti
		 WHERE musteri_id = ? AND id = ? AND guncellendi >= ?
		 LIMIT 1`,
	);

	/* Başlangıç damgasındakiler "görüldü": gerekçe `canli.mjs` içinde. */
	for (const satir of db
		.prepare(
			`SELECT m.id FROM is_mesaji m JOIN is_ozeti i ON i.id = m.is_id
			 WHERE i.musteri_id = ? AND m.is_id = ? AND m.zaman = ?`,
		)
		.all(musteriId, isId, baslangicDamgasi)) {
		mesajKimlikleri.add(satir.id);
	}
	for (const satir of db
		.prepare('SELECT id FROM is_ozeti WHERE musteri_id = ? AND id = ? AND guncellendi = ?')
		.all(musteriId, isId, baslangicDamgasi)) {
		isKimlikleri.add(satir.id);
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
		get damga() {
			return mesajDamgasi > isDamgasi ? mesajDamgasi : isDamgasi;
		},

		tur() {
			const olaylar = [];

			const isler = ilerlet(
				isSorgusu.all(musteriId, isId, isDamgasi),
				isDamgasi,
				isKimlikleri,
				'guncellendi',
			);
			isDamgasi = isler.damga;
			isKimlikleri = isler.kimlikler;
			/* Durum etiketi SUNUCUDAN: istemcide ikinci bir eşleme tutulmuyor. */
			for (const is of isler.yeniler) {
				olaylar.push({ tur: 'is', ...is, durum_etiketi: isDurumEtiketi(is.durum) });
			}

			const mesajlar = ilerlet(
				mesajSorgusu.all(musteriId, isId, mesajDamgasi),
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

/**
 * İş yazışmasının SSE yanıtı.
 * İş bu müşterinin değilse `null` dönüyor ve akış HİÇ AÇILMIYOR; çağıran
 * taraf bunu 404'e çeviriyor.
 */
export function isAkisYaniti(db, { musteriId, isId, baslangic = null, ...secenekler }) {
	if (!isSahibiMi(db, musteriId, isId)) return null;
	const pencere = isPencereAc(db, { musteriId, isId, baslangic });
	return sseYaniti(pencere, { ...secenekler, acilisEk: { is: isId } });
}

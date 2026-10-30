/*
  Davet anahtarının doğrulanması.

  İki kural bu dosyanın şeklini belirliyor:

  1. HESAP SAYIMI YOK (§8). Anahtar bulunamadığında ERKEN DÖNÜLMÜYOR; kayıt
     yokmuş gibi değil, sahte bir kayda karşı aynı işler yapılıyor. Çağıran
     taraf her başarısızlıkta aynı mesajı, aynı HTTP kodunu ve `enAzSur` ile
     yaklaşık aynı süreyi döndürüyor.
  2. HAM ANAHTAR SAKLANMIYOR. Veritabanında yalnızca SHA-256 karması var,
     karşılaştırma sabit zamanlı.
*/

import { createHash } from 'node:crypto';
import { davetAnahtariniCoz, karmala, esitMi } from '../../../veri/kimlik.mjs';

/*
  Anahtar bulunamadığında karşılaştırılan sahte kayıt. Gerçek bir kayıtla
  aynı alanlara sahip ki aşağıdaki kontroller aynı dalları çalıştırsın.
*/
const SAHTE_KARMA = createHash('sha256').update('bulunamayan-davet').digest();
const SAHTE_SATIR = Object.freeze({
	id: '',
	musteri_id: '',
	anahtar_karmasi: SAHTE_KARMA,
	son_kullanma: new Date(0).toISOString(),
	kullanildi: null,
	gorunen_ad: '',
	musteri_durumu: 'etkin',
});

const SORGU = `SELECT d.id, d.musteri_id, d.anahtar_karmasi, d.son_kullanma, d.kullanildi,
                      m.gorunen_ad, m.durum AS musteri_durumu
               FROM davet d JOIN musteri m ON m.id = d.musteri_id
               WHERE d.anahtar_karmasi = ?`;

/**
 * Müşterinin yapıştırdığı anahtarı doğrular.
 *
 * Biçim bozuksa da sorgu yine çalışıyor: istemci tarafı zaten bozuk biçimi
 * sunucuya hiç göndermiyor, ama doğrudan uç noktaya atılan istekte "biçim
 * bozuk" ile "anahtar yok" ayrımı dışarıdan görünmemeli.
 */
export function davetiDogrula(db, { girdi, simdiMs = Date.now() }) {
	const baytlar = davetAnahtariniCoz(girdi);
	const karma = baytlar ? karmala(baytlar) : SAHTE_KARMA;

	const bulunan = db.prepare(SORGU).get(karma);
	const satir = bulunan ?? SAHTE_SATIR;

	const karmaUyuyor = esitMi(satir.anahtar_karmasi, karma);
	const suresiVar = Date.parse(satir.son_kullanma) > simdiMs;
	const kullanilmamis = !satir.kullanildi;
	const musteriEtkin = satir.musteri_durumu === 'etkin';

	const gecerli =
		Boolean(baytlar) && Boolean(bulunan) && karmaUyuyor && suresiVar && kullanilmamis && musteriEtkin;

	return {
		gecerli,
		/** Günlük için; kullanıcıya gösterilmiyor. */
		sebep: !baytlar
			? 'bicim'
			: !bulunan
				? 'yok'
				: !karmaUyuyor
					? 'karma'
					: !suresiVar
						? 'sure'
						: !kullanilmamis
							? 'kullanilmis'
							: !musteriEtkin
								? 'musteri'
								: 'gecerli',
		davet: gecerli ? { id: satir.id, musteriId: satir.musteri_id } : null,
		musteri: gecerli ? { id: satir.musteri_id, gorunenAd: satir.gorunen_ad } : null,
		/*
		  Oran sınırlama sayacı için: anahtar bir müşteriye ait çıktıysa,
		  geçerli olmasa bile o müşterinin sayacı işletiliyor. Sayaç zaten
		  saldırıyı yavaşlatmak için var.
		*/
		hedefMusteriId: bulunan ? satir.musteri_id : null,
	};
}

/** Tek kullanım: kabul edilen davet aynı anda kapanıyor. */
export function davetiKullanildiIsaretle(db, davetId, simdiMs = Date.now()) {
	return db
		.prepare('UPDATE davet SET kullanildi = ? WHERE id = ? AND kullanildi IS NULL')
		.run(new Date(simdiMs).toISOString(), davetId).changes;
}

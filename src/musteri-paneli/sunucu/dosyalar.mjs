/*
  Dosya indirme.

  PANELDEKİ EN TEHLİKELİ UÇ NOKTA BURASI ve üç ayrı açığı birden kapatması
  gerekiyor. Üçü de aşağıda, kapatan kodun yanında yazılı.

  1) YETKİ. Dosya yalnızca O MÜŞTERİNİN işine aitse veriliyor. `is_dosya`
     tablosunda müşteri sütunu yok, bu yüzden süzgeç `is_ozeti` ile
     birleşerek kuruluyor: `WHERE d.id = ? AND i.musteri_id = ?`. Başka
     müşterinin dosya kimliği elle adres çubuğuna yazılsa bile 404 dönüyor.

  2) DİZİN DIŞINA ÇIKMA (path traversal). Diskteki yol YALNIZCA
     veritabanındaki `depo_adi`'ndan kuruluyor. İstekten gelen hiçbir değer
     yola karışmıyor: adreste taşınan tek şey dosya kimliği ve o kimlik de
     veritabanında aranıyor, dosya sisteminde değil. Gösterilen ad (`../`
     içerebilecek olan) yalnızca `Content-Disposition` başlığına giriyor.

     Buna rağmen `depo_adi` ayrıca denetleniyor. `veri/dosya-gonder.mjs` onu
     rastgele üretiyor, yani bugün güvenli; ama "veri zaten güvenli" bir
     varsayımdır ve varsayımlar sessizce eskiyor. Denetim ucuz.

  3) İÇERİK TÜRÜ. `Content-Type` veritabanındaki `tur`, tahmin edilmiyor;
     `X-Content-Type-Options: nosniff` ara katmandan zaten geliyor ve
     tarayıcının kendi tahminini kapatıyor. Tarayıcıda AÇILARAK gösterilen
     (`inline`) tek şey görsel: `gorsel_mi` işaretli ve türü `image/` ile
     başlayan dosyalar. Geri kalan her şey indiriliyor, yani aynı kökene
     düşen bir HTML gövdesi hiçbir durumda çalıştırılmıyor.
*/

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { join, resolve } from 'node:path';

import { ayarlar } from './ayarlar.mjs';

/**
 * Depo adı için izinli biçim: harf, rakam, nokta, alt çizgi, tire.
 *
 * Eğik çizgi, ters eğik çizgi ve boşluk yok; ".." da bu kümeyle yazılabilir
 * olduğu için ayrıca eleniyor.
 */
const DEPO_ADI = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function depoAdiGecerliMi(ad) {
	if (typeof ad !== 'string' || ad.length === 0 || ad.length > 255) return false;
	if (!DEPO_ADI.test(ad)) return false;
	/* Nokta dizileri: ".." ve "..." gibi adlar biçime uyuyor ama yasak. */
	return !ad.split('.').some((parca) => parca === '');
}

/**
 * Dosyanın diskteki tam yolu.
 *
 * Kurulum: `dizin + depo_adi`, başka hiçbir şey. Sonuç ayrıca dizinin
 * içinde mi diye doğrulanıyor; biçim denetimini bir gün aşan bir ad olursa
 * ikinci kapı da kapalı kalsın.
 */
export function depoYolu(depoAdi, dizin = ayarlar.dosyaDizini) {
	if (!depoAdiGecerliMi(depoAdi)) return null;
	const kok = resolve(dizin);
	const tam = resolve(join(kok, depoAdi));
	/*
	  Windows'ta ayraç ters eğik çizgi, Linux'ta düz. `resolve` ikisini de
	  platformun ayracına çeviriyor, bu yüzden karşılaştırma ayraç eklenerek
	  yapılıyor: "/var/lib/panel/dosyalarXYZ" dizinin içinde DEĞİL.
	*/
	const onek = kok.endsWith('/') || kok.endsWith('\\') ? kok : kok + (kok.includes('\\') ? '\\' : '/');
	return tam.startsWith(onek) ? tam : null;
}

/**
 * Dosyanın künyesi. Müşteri süzgeci olmadan ÇAĞRILAMAZ.
 * Başkasının dosyası için `null`; dosyanın varlığı bile söylenmiyor.
 */
export function dosyaGetir(db, musteriId, dosyaId) {
	if (!dosyaId) return null;
	return (
		db
			.prepare(
				`SELECT d.id, d.is_id, d.gosterilen_ad, d.depo_adi, d.tur, d.boyut, d.gorsel_mi,
				        i.ad AS is_adi
				 FROM is_dosya d JOIN is_ozeti i ON i.id = d.is_id
				 WHERE d.id = ? AND i.musteri_id = ?`,
			)
			.get(dosyaId, musteriId) ?? null
	);
}

/**
 * `Content-Disposition` değeri.
 *
 * Gösterilen ad müşterinin göreceği addır ve Türkçe harf içerebiliyor. İki
 * biçim birden yazılıyor: ASCII'ye indirgenmiş yedek (`filename`) ve
 * RFC 5987 ile kodlanmış aslı (`filename*`). Tarayıcılar ikincisini tercih
 * ediyor, etmeyen de bozuk bir ad yerine okunabilir bir ad alıyor.
 *
 * Tırnak, ters eğik çizgi, satır sonu ve denetim karakterleri temizleniyor:
 * başlığa satır sonu sızarsa başlık enjeksiyonu olur.
 */
export function dosyaBasligi(gosterilenAd, kip = 'attachment') {
	const temiz = String(gosterilenAd ?? 'dosya')
		// eslint-disable-next-line no-control-regex
		.replace(/[\u0000-\u001f\u007f"\\/]/g, '_')
		.trim();
	const ad = temiz.length > 0 ? temiz : 'dosya';
	const yedek = ad.replace(/[^\x20-\x7e]/g, '_');
	return `${kip}; filename="${yedek}"; filename*=UTF-8''${encodeURIComponent(ad)}`;
}

/** Tarayıcıda açılarak gösterilebilecek tür mü. Yalnızca görseller. */
export function acilarakGosterilirMi(kayit) {
	return Boolean(kayit?.gorsel_mi) && typeof kayit.tur === 'string' && kayit.tur.startsWith('image/');
}

/**
 * Dosya yanıtı.
 *
 * Dönen değer her zaman bir `Response`; hiçbir yolda istisna fırlatmıyor.
 * Dosya diskte yoksa (eşitleme yarım kalmış, dosya elle silinmiş) anlaşılır
 * bir 404 dönüyor ve süreç ayakta kalıyor: bulunamayan bir dosya bir arıza
 * değil, bir durum.
 */
export async function dosyaYaniti(
	db,
	{ musteriId, dosyaId, onizleme = false, dizin = ayarlar.dosyaDizini },
) {
	const kayit = dosyaGetir(db, musteriId, dosyaId);
	/*
	  Yetkisiz ve yok olan aynı yanıtı alıyor. Farklı kodlar dönseydi
	  müşteri, göremediği bir dosyanın var olduğunu öğrenirdi.
	*/
	if (!kayit) return metinYaniti('Dosya bulunamadı.', 404);

	const yol = depoYolu(kayit.depo_adi, dizin);
	if (!yol) return metinYaniti('Dosya kaydı okunamadı.', 500);

	let bilgi;
	try {
		bilgi = await stat(yol);
	} catch {
		return metinYaniti(
			'Bu dosya şu anda sunucuda bulunamadı. Kaydı duruyor ama içeriği yüklenmemiş olabilir; bana yazarsanız yeniden gönderirim.',
			404,
		);
	}
	if (!bilgi.isFile()) return metinYaniti('Dosya bulunamadı.', 404);

	const kip = onizleme && acilarakGosterilirMi(kayit) ? 'inline' : 'attachment';

	/*
	  Akış olarak gönderiliyor, belleğe okunmuyor: tek dosya 25 MB'a kadar
	  çıkabiliyor ve aynı anda birkaç indirme süreci şişirirdi.
	*/
	const govde = Readable.toWeb(createReadStream(yol));

	return new Response(govde, {
		status: 200,
		headers: {
			/* Tür VERİTABANINDAN. Uzantıdan tahmin edilmiyor. */
			'content-type': kayit.tur || 'application/octet-stream',
			'content-length': String(bilgi.size),
			'content-disposition': dosyaBasligi(kayit.gosterilen_ad, kip),
			/* Kişiye özel dosya: ortak vekil önbelleğinde durmamalı. */
			'cache-control': 'private, no-store',
			/*
			  Ara katman bunu zaten yazıyor; burada da yazılı çünkü bu başlık
			  düşerse tarayıcı içeriğe bakıp tür tahmin etmeye başlıyor ve
			  yukarıdaki üçüncü koruma sessizce kalkıyor.
			*/
			'x-content-type-options': 'nosniff',
		},
	});
}

function metinYaniti(metin, durum) {
	return new Response(metin, {
		status: durum,
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'no-store',
			'x-content-type-options': 'nosniff',
		},
	});
}

/** Dosya boyutunun insan hâli: 1,2 MB. Liste satırında yer kaplamasın diye kısa. */
export function boyutMetni(bayt) {
	/* `Number(null)` sıfır veriyor; boş bir künye "0 B" diye yazılmamalı. */
	if (bayt === null || bayt === undefined || bayt === '') return '';
	const sayi = Number(bayt);
	if (!Number.isFinite(sayi) || sayi < 0) return '';
	if (sayi < 1024) return `${sayi} B`;
	const bicim = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
	if (sayi < 1024 * 1024) return `${bicim.format(sayi / 1024)} KB`;
	return `${bicim.format(sayi / (1024 * 1024))} MB`;
}

import { derle, geriAl, gonder } from './yayinla.mjs';

/*
  YAYIN İŞLEMLERİNİN ORTAK ÇEKİRDEĞİ

  İki yerden çağrılıyor ve bu yüzden burada duruyor:

  - Masaüstü panelinde `src/yayin/eklenti.mjs` içindeki Vite ara katmanı.
    Orada proje adaptörsüz ve statik; POST alan bir Astro rotası kurulamıyor.
  - İnternete açık panelde `src/yayin/islem.mjs` adlı Astro uç noktası. O
    yapılandırmada Node adaptörü var, yani rota POST'a cevap verebiliyor.

  Aynı mantığı iki yere yazmak, birinde düzeltilip diğerinde unutulan bir hata
  demekti — özellikle "önce derle, sonra gönder" kısıtı gibi güvenlik değeri
  olan bir kuralda.
*/

/*
  Aynı anda tek işlem. İki derleme aynı kopya dizinini silip yazardı; iki
  gönderme ise sunucuda yarı yarıya karışmış bir yayın bırakırdı. İkinci istek
  reddediliyor — kuyruğa almak, kullanıcının iptal edemeyeceği bir yayını
  sıraya koymak olurdu.
*/
let islemSuruyor = false;

/*
  Son başarılı derleme. `gonder` yalnızca bunun dolu olduğu durumda çalışıyor:
  "önce derle, gördüğünü onayla, sonra gönder" akışının sunucu tarafındaki
  karşılığı bu.
*/
let sonDerleme = null;

export function islemSuruyorMu() {
	return islemSuruyor;
}

export function islemiKilitle() {
	islemSuruyor = true;
}

export function kilidiAc() {
	islemSuruyor = false;
}

export async function islemiYurut(istem, bildir) {
	const kuru = istem?.kuru === true;

	if (istem?.islem === 'derle') {
		const sonuc = await derle(bildir);
		sonDerleme = sonuc.basarili ? { zaman: Date.now(), sayfalar: sonuc.sayfalar } : null;
		return sonuc;
	}

	if (istem?.islem === 'gonder') {
		if (!sonDerleme) {
			return {
				basarili: false,
				hata: 'Önce derleyin. Gönderilecek bir derleme çıktısı yok.',
			};
		}
		return await gonder(bildir, { kuru });
	}

	if (istem?.islem === 'geri-al') {
		return await geriAl(bildir, { kuru });
	}

	return { basarili: false, hata: `Bilinmeyen işlem: ${String(istem?.islem)}` };
}

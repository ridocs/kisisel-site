/*
  Dosya indirme uç noktası.

  ADRESTE TAŞINAN TEK ŞEY DOSYA KİMLİĞİ. Dosya adı, yol parçası ya da dizin
  adı adresten OKUNMUYOR: diskteki yol veritabanındaki `depo_adi`'ndan
  kuruluyor. Adresten gelen bir ad yola eklenseydi `../` ile dizin dışına
  çıkılabilirdi; bu uç noktanın en bilinen açığı budur ve tasarımla kapalı.

  OTURUM ZORUNLU, İKİ KATMAN. Ara katman bu yolu açık yollar listesine
  koymuyor, yani oturumsuz istek buraya HİÇ ULAŞMADAN 401 alıyor. Buradaki
  kontrol ikinci katman.

  YETKİ `sunucu/dosyalar.mjs` içinde, sorgunun kendisinde: dosya o müşterinin
  işine ait değilse 404. Yetkisiz ve yok olan aynı yanıtı alıyor.

  `?onizleme=1` yalnızca görsellerde `inline` yapıyor; geri kalan her şey
  indiriliyor. Gerekçesi `sunucu/dosyalar.mjs` başlığında.

  GET ve HEAD: bazı tarayıcılar indirmeden önce HEAD atıyor. İkisi de aynı
  denetimden geçiyor, HEAD'de yalnızca gövde düşüyor.
*/

import { dosyaYaniti } from '../../../sunucu/dosyalar.mjs';
import { json } from '../../../sunucu/istek.mjs';
import { panelVt } from '../../../sunucu/veritabani.mjs';

export const prerender = false;

async function yanitla({ locals, params, url }) {
	const musteri = locals.musteri;
	if (!musteri) return json({ tamam: false, mesaj: 'Oturum bulunamadı.' }, 401);

	return dosyaYaniti(panelVt(), {
		musteriId: musteri.id,
		dosyaId: params.id,
		onizleme: url.searchParams.get('onizleme') === '1',
	});
}

export async function GET(baglam) {
	return yanitla(baglam);
}

export async function HEAD(baglam) {
	const yanit = await yanitla(baglam);
	return new Response(null, { status: yanit.status, headers: yanit.headers });
}

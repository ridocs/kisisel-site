/*
  Giriş için meydan okuma üretir.

  Bu uç nokta hiçbir şey SORMUYOR: kullanıcı adı, e-posta, müşteri kimliği
  almıyor. `residentKey: required` ile kaydedilen passkey'ler keşfedilebilir
  olduğu için tarayıcı kimliği kendi biliyor. Sonuç olarak bu uç noktaya
  atılan istek, hiçbir hesabın var olup olmadığını söylemiyor.
*/

import { kapi } from '../../../sunucu/akis.mjs';
import { enAzSur, istemciIzleri, json } from '../../../sunucu/istek.mjs';
import { panelVt } from '../../../sunucu/veritabani.mjs';
import { girisSecenekleri, meydanOkumalariTemizle } from '../../../sunucu/webauthn.mjs';

export const prerender = false;

export async function POST({ request, clientAddress }) {
	const baslangicMs = Date.now();
	const db = panelVt();
	const simdiMs = baslangicMs;
	const izler = istemciIzleri(request, clientAddress);

	const kapiSonucu = await kapi(db, {
		musteriId: null,
		ipKarmasi: izler.sayacIp,
		baslangicMs,
		simdiMs,
	});
	if (!kapiSonucu.gecti) return kapiSonucu.yanit;

	meydanOkumalariTemizle(db, simdiMs);
	const { bilet, secenekler } = await girisSecenekleri(db, { simdiMs });

	await enAzSur(baslangicMs);
	return json({ tamam: true, bilet, secenekler });
}

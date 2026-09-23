/*
  Çıkış. Oturum kaydı SİLİNİYOR, çerez geçersiz kılınıyor (§5.4).

  Yalnızca POST: durum değiştiren bir işlem GET ile yapılmaz. Üstelik forma
  oturuma bağlı işlem anahtarı da konuyor, yani başka bir sitedeki gizli bir
  form müşteriyi habersizce çıkartamıyor.
*/

import { ayarlar } from '../sunucu/ayarlar.mjs';
import { islemAnahtariGecerliMi } from '../sunucu/csrf.mjs';
import { cereziSil } from '../sunucu/istek.mjs';
import { oturumKapat } from '../sunucu/oturum.mjs';
import { panelVt } from '../sunucu/veritabani.mjs';

export const prerender = false;

export async function POST({ request, locals, redirect }) {
	const taban = locals.taban ?? '';
	const karma = locals.oturumKarmasi;

	if (karma) {
		const form = await request.formData().catch(() => null);
		const anahtar = form?.get('islem_anahtari');
		if (islemAnahtariGecerliMi(karma, ayarlar.gizli.csrf, typeof anahtar === 'string' ? anahtar : '')) {
			oturumKapat(panelVt(), karma);
		} else {
			/*
			  Anahtar tutmadıysa çıkış YAPILMIYOR ama kullanıcı yine giriş
			  sayfasına gidiyor: saldırgana "anahtarın yanlıştı" diye bilgi
			  verilmesinin bir faydası yok.
			*/
			return redirect(`${taban}/pano`, 303);
		}
	}

	const yanit = redirect(`${taban}/`, 303);
	yanit.headers.append('set-cookie', cereziSil());
	return yanit;
}

/*
  Yazışmanın tarayıcı tarafı: `EventSource` ile canlı akış.

  NEDEN `genel/` ALTINDA, NEDEN `istemci/` ALTINDA DEĞİL

  Panelin içerik güvenliği politikası `script-src 'self' 'nonce-...'` ve bu
  betiğin nonce TAŞIMASI isteniyor. Astro'nun paketlediği `<script>` etiketine
  nonce niteliği geçirilemiyor; yalnızca `is:inline` etiketler kendi
  niteliklerini koruyor. Betik `public` klasöründen sabit adla servis edilince
  hem `'self'` kapsamında kalıyor hem de etikete nonce yazılabiliyor. Bedeli,
  Vite'ın bu dosyayı işlememesi: burada düz ES5 uyumlu betik var, içe aktarma
  yok.

  Adres sorgusundaki sürüm damgası `panel.css` ile aynı sebepten: dosya adı
  sabit olduğu için önbellek onsuz eski sürümü yapıştırıp bırakıyor.

  BU KATMAN BİR İYİLEŞTİRME. Betik hiç çalışmasa sayfa yine çalışıyor: mesaj
  listesi sunucudan basılı geliyor, form düz POST. Burada yapılan tek şey,
  gelen yeni mesajı sayfayı yenilemeden listeye eklemek.
*/

(function () {
	'use strict';

	var kok = document.querySelector('[data-canli]');
	if (!kok) return;
	if (typeof window.EventSource !== 'function') return;

	var taban = kok.getAttribute('data-taban') || '';
	var kip = kok.getAttribute('data-kip') || 'liste';
	var talepId = kok.getAttribute('data-talep') || '';
	var bilinen = kok.getAttribute('data-bilinen') || '';
	var musteriAdi = kok.getAttribute('data-ad') || '';

	/*
	  Gösterge sunucudan `hidden` geliyor ve ancak akış gerçekten
	  kurulabildiğinde açılıyor. Betiksiz bir tarayıcıda hiç görünmüyor.
	*/
	kok.removeAttribute('hidden');

	var durumKutusu = document.querySelector('[data-canli-durum]');
	var bildirimKutusu = document.querySelector('[data-canli-bildirim]');

	/* Sunucudan basılmış mesajların kimlikleri: aynı mesaj iki kez eklenmesin. */
	var gorulen = Object.create(null);
	var basilanlar = document.querySelectorAll('[data-mesaj-id]');
	for (var i = 0; i < basilanlar.length; i++) {
		gorulen[basilanlar[i].getAttribute('data-mesaj-id')] = true;
	}

	var zamanBicimi = new Intl.DateTimeFormat('tr-TR', {
		dateStyle: 'medium',
		timeStyle: 'short',
	});

	function zamanYaz(iso) {
		var ms = Date.parse(iso);
		return isNaN(ms) ? '' : zamanBicimi.format(new Date(ms));
	}

	function durumSoyle(ad, metin) {
		if (!durumKutusu) return;
		durumKutusu.setAttribute('data-durum', ad);
		durumKutusu.textContent = metin;
	}

	function bildir(metin) {
		if (!bildirimKutusu) return;
		bildirimKutusu.textContent = metin;
	}

	/* ---------- Yazışma sayfası ---------- */

	function mesajDugumu(olay) {
		var li = document.createElement('li');
		li.className = 'mesaj';
		li.setAttribute('data-yazan', olay.yazan);
		li.setAttribute('data-mesaj-id', olay.id);
		/* Akışla gelen mesaj gözle ayırt edilsin; sayfa yenilenince kalkıyor. */
		li.setAttribute('data-yeni', '1');

		var bas = document.createElement('div');
		bas.className = 'mesaj-bas';

		var yazan = document.createElement('span');
		yazan.className = 'mesaj-yazan';
		yazan.textContent = olay.yazan === 'musteri' ? musteriAdi : 'Mustafa Eybek';
		bas.appendChild(yazan);

		if (olay.yazan === 'musteri') {
			var siz = document.createElement('span');
			siz.textContent = 'siz';
			bas.appendChild(siz);
		}

		var zaman = document.createElement('time');
		zaman.setAttribute('datetime', olay.zaman);
		zaman.textContent = zamanYaz(olay.zaman);
		bas.appendChild(zaman);

		li.appendChild(bas);

		/*
		  Metin `textContent` ile yazılıyor. Mesajın içeriği karşı taraftan
		  geliyor; `innerHTML` burada doğrudan bir betik enjeksiyonu kapısı
		  olurdu.
		*/
		var p = document.createElement('p');
		p.className = 'mesaj-metin';
		p.textContent = olay.metin;
		li.appendChild(p);

		return li;
	}

	function yazismayaEkle(olay) {
		var liste = document.querySelector('.mesajlar');
		if (!liste) return;
		liste.appendChild(mesajDugumu(olay));

		var sayac = document.querySelector('[data-mesaj-sayisi]');
		if (sayac) {
			var sayi = liste.querySelectorAll('.mesaj').length;
			sayac.textContent = sayi === 1 ? '1 mesaj' : sayi + ' mesaj';
		}
	}

	function yazismaTalebiniGuncelle(olay) {
		var rozet = document.querySelector('[data-talep-rozet]');
		if (rozet) {
			rozet.setAttribute('data-durum', olay.durum);
			rozet.textContent = olay.durum_etiketi || olay.durum;
		}
	}

	/* ---------- Liste sayfası ---------- */

	function listeSatiri(talepIdsi) {
		return document.querySelector('[data-talep-id="' + String(talepIdsi).replace(/"/g, '') + '"]');
	}

	/* Listedeki satırın durum rozeti ve mesaj sayısı da tazeleniyor. */
	function listeSatiriniGuncelle(olay) {
		var satir = listeSatiri(olay.id);
		if (!satir) return;
		var rozet = satir.querySelector('.rozet[data-durum]');
		if (rozet) {
			rozet.setAttribute('data-durum', olay.durum);
			rozet.textContent = olay.durum_etiketi || olay.durum;
		}
		var sayac = satir.querySelector('[data-satir-mesaj]');
		if (sayac && typeof olay.mesaj_sayisi === 'number') {
			sayac.textContent = olay.mesaj_sayisi === 1 ? '1 mesaj' : olay.mesaj_sayisi + ' mesaj';
		}
	}

	function listedeIsaretle(talepIdsi) {
		var satir = listeSatiri(talepIdsi);
		if (!satir) {
			/* Listede olmayan bir talep: büyük ihtimalle bu sekme açıkken açıldı. */
			bildir('Listede olmayan bir talep güncellendi. Sayfayı yenileyin.');
			return;
		}
		if (satir.getAttribute('data-yeni') === '1') return;
		satir.setAttribute('data-yeni', '1');
		var bilgi = satir.querySelector('.satir-bilgi');
		if (bilgi) {
			var rozet = document.createElement('span');
			rozet.className = 'rozet';
			rozet.setAttribute('data-yeni-mesaj', '1');
			rozet.textContent = 'yeni mesaj';
			bilgi.insertBefore(rozet, bilgi.firstChild);
		}
	}

	/* ---------- Bağlantı ---------- */

	var adres = taban + '/api/talepler/akis';
	var sorgu = [];
	if (talepId) sorgu.push('talep=' + encodeURIComponent(talepId));
	if (bilinen) sorgu.push('bilinen=' + encodeURIComponent(bilinen));
	if (sorgu.length) adres += '?' + sorgu.join('&');

	durumSoyle('baglaniyor', 'Bağlanıyor');

	var kaynak = new EventSource(adres, { withCredentials: true });
	var kapandi = false;

	kaynak.addEventListener('open', function () {
		durumSoyle('canli', 'Canlı');
	});

	kaynak.addEventListener('mesaj', function (olay) {
		var veri = coz(olay.data);
		if (!veri || gorulen[veri.id]) return;
		gorulen[veri.id] = true;
		if (kip === 'yazisma') yazismayaEkle(veri);
		else listedeIsaretle(veri.talep_id);
	});

	kaynak.addEventListener('talep', function (olay) {
		var veri = coz(olay.data);
		if (!veri) return;
		if (kip === 'yazisma') yazismaTalebiniGuncelle(veri);
		else listeSatiriniGuncelle(veri);
	});

	kaynak.addEventListener('bitti', function (olay) {
		var veri = coz(olay.data) || {};
		if (veri.sebep === 'oturum') {
			/*
			  Oturum düştü. Yeniden bağlanmanın anlamı yok; kullanıcıya ne
			  olduğu söyleniyor.
			*/
			kapandi = true;
			kaynak.close();
			durumSoyle('kopuk', 'Oturum kapandı. Sayfayı yenileyip yeniden girin.');
		}
		/*
		  `sure` ve `hata` için bir şey yapılmıyor: sunucu bağlantıyı
		  kapatıyor, tarayıcı kendiliğinden yeniden bağlanıyor ve elindeki son
		  damgadan devam ediyor.
		*/
	});

	kaynak.addEventListener('error', function () {
		if (kapandi) return;
		if (kaynak.readyState === EventSource.CLOSED) {
			durumSoyle('kopuk', 'Bağlantı kapandı. Sayfayı yenileyin.');
		} else {
			durumSoyle('baglaniyor', 'Bağlantı koptu, yeniden deneniyor');
		}
	});

	/* Sekme kapanırken bağlantıyı bırak: sunucuda açık bir tur kalmasın. */
	window.addEventListener('pagehide', function () {
		kapandi = true;
		kaynak.close();
	});

	function coz(metin) {
		try {
			return JSON.parse(metin);
		} catch (hata) {
			return null;
		}
	}
})();

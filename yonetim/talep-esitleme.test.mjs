/*
  Destek talebi ve eşitleme ekranlarının testleri.

  Sorulan üç soru şu: sahibin yazdığı yanıt sunucuya gitmek üzere kuyruğa
  DOĞRU işlemle ve yalnızca izinli alanlarla mı düşüyor, talebi kapatmak
  aynı yoldan mı geçiyor, ayar doğrulaması eksik değeri yakalıyor mu.

  Electron yok, SSH yok. Gerçek SQLite var: kuyruğa yazılan satır gerçekten
  veritabanından okunup denetleniyor.

  Çalıştırma: node --test yonetim/talep-esitleme.test.mjs
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { yerelAc, simdi } from '../veri/db.mjs';
import { AYAR_ANAHTARLARI, ayarlariOku } from '../veri/esitleme-ssh.mjs';
import { IZINLI_ALANLAR } from '../veri/izinli-alanlar.mjs';
import { depoKur } from './depo.mjs';
import {
	ESITLEME_AYARLARI,
	esitlemeAyariDogrula,
	talepDurumuEsitlemeKaydi,
	talepYanitiDogrula,
	talepYanitiEsitlemeKaydi,
} from './is-mantigi.mjs';

/** Şifreleme bu testlerin konusu değil; kasa kapalı da olsa sonuç değişmiyor. */
const SAHTE_KASA = {
	kullanilabilir: () => true,
	sifrele: (metin) => Buffer.from(metin, 'utf8'),
	coz: (baytlar) => Buffer.from(baytlar).toString('utf8'),
};

function ortamKur() {
	const dizin = mkdtempSync(join(tmpdir(), 'talep-test-'));
	const db = yerelAc(join(dizin, 'yerel.db'));
	return {
		db,
		depo: depoKur(db, SAHTE_KASA),
		kapat() {
			try {
				db.close();
			} catch {
				// Zaten kapalıysa sorun değil.
			}
			rmSync(dizin, { recursive: true, force: true });
		},
	};
}

/** Sunucudan çekilmiş gibi bir talep ve bir müşteri mesajı yerleştirir. */
function ornekTalep(db, { id = 't1', durum = 'acik' } = {}) {
	const an = simdi();
	db.prepare(
		`INSERT INTO talep_kopyasi
		 (id, musteri_id, is_id, baslik, durum, oncelik, olusturuldu, guncellendi, cekildi)
		 VALUES (?, NULL, NULL, ?, ?, 'normal', ?, ?, ?)`,
	).run(id, 'Panel açılmıyor', durum, an, an, an);
	db.prepare(
		`INSERT INTO talep_mesaj_kopyasi (id, talep_id, yazan, metin, zaman)
		 VALUES (?, ?, 'musteri', ?, ?)`,
	).run(`${id}-m1`, id, 'Giriş yaparken hata alıyorum.', an);
	return id;
}

const kuyruk = (db) =>
	db
		.prepare('SELECT id, islem, govde FROM esitleme_kuyrugu ORDER BY id')
		.all()
		.map((s) => ({ ...s, govde: JSON.parse(s.govde) }));

/* ------------------------------------------------------------------ */
/* Sahibin yanıtı                                                      */
/* ------------------------------------------------------------------ */

test('sahibin yanıtı kuyruğa talep.yanit işlemiyle düşüyor', () => {
	const { db, depo, kapat } = ortamKur();
	try {
		const talepId = ornekTalep(db);
		const yanit = depo.talepYanitla(talepId, '  Parolanızı sıfırladım, tekrar deneyin.  ');

		const satirlar = kuyruk(db);
		assert.equal(satirlar.length, 1);
		assert.equal(satirlar[0].islem, 'talep.yanit');
		assert.equal(satirlar[0].govde.talep_id, talepId);
		assert.equal(satirlar[0].govde.id, yanit.id);
		assert.equal(
			satirlar[0].govde.metin,
			'Parolanızı sıfırladım, tekrar deneyin.',
			'baştaki ve sondaki boşluklar kırpılmalı',
		);
	} finally {
		kapat();
	}
});

test('yanıt gövdesinde beyaz listenin dışında alan yok', () => {
	const { db, depo, kapat } = ortamKur();
	try {
		const talepId = ornekTalep(db);
		depo.talepYanitla(talepId, 'Bakıyorum.');

		const govde = kuyruk(db)[0].govde;
		assert.deepEqual(
			Object.keys(govde).sort(),
			[...IZINLI_ALANLAR['talep.yanit']].sort(),
			'kuyruğa yalnızca izinli alanlar yazılmalı',
		);
		assert.equal('yazan' in govde, false, 'yazan bilgisi sunucuya gitmiyor');
	} finally {
		kapat();
	}
});

test('yanıt yerel kopyaya sahip olarak ekleniyor ve aynı kimliği taşıyor', () => {
	const { db, depo, kapat } = ortamKur();
	try {
		const talepId = ornekTalep(db);
		const yanit = depo.talepYanitla(talepId, 'Çözüldü.');

		const talep = depo.talepGetir(talepId);
		assert.equal(talep.mesajlar.length, 2);
		/*
		  Kimlikle aranıyor, sıradan değil: iki mesaj aynı milisaniyede
		  yazıldığında sıra kimliğe düşüyor ve o rastgele.
		*/
		const yazilan = talep.mesajlar.find((m) => m.id === yanit.id);
		assert.ok(
			yazilan,
			'yerel kopya ile kuyruk aynı kimliği kullanmalı, yoksa sunucu yanıtı geri verince iki kez görünür',
		);
		assert.equal(yazilan.yazan, 'sahip');
		assert.equal(yazilan.metin, 'Çözüldü.');
	} finally {
		kapat();
	}
});

test('boş yanıt ne kuyruğa ne yerel kopyaya giriyor', () => {
	const { db, depo, kapat } = ortamKur();
	try {
		const talepId = ornekTalep(db);
		assert.throws(() => depo.talepYanitla(talepId, '   '), /boş bırakılamaz/i);
		assert.equal(kuyruk(db).length, 0);
		assert.equal(depo.talepGetir(talepId).mesajlar.length, 1);
	} finally {
		kapat();
	}
});

test('olmayan talebe yanıt yazılamıyor', () => {
	const { db, depo, kapat } = ortamKur();
	try {
		assert.throws(() => depo.talepYanitla('yok', 'Merhaba'), /bulunamadı/i);
		assert.equal(kuyruk(db).length, 0);
	} finally {
		kapat();
	}
});

test('yanıt doğrulaması talepsizi ve sınırı aşanı reddediyor', () => {
	assert.deepEqual(talepYanitiDogrula({ talepId: 't1', metin: 'Tamam' }), []);
	assert.equal(talepYanitiDogrula({ talepId: '', metin: 'Tamam' }).length, 1);
	assert.equal(talepYanitiDogrula({ talepId: 't1', metin: '' }).length, 1);
	assert.equal(talepYanitiDogrula({ talepId: 't1', metin: 'a'.repeat(20_001) }).length, 1);
});

/* ------------------------------------------------------------------ */
/* Talebi kapatma                                                      */
/* ------------------------------------------------------------------ */

test('talebi kapatmak kuyruğa talep.durum bırakıyor', () => {
	const { db, depo, kapat } = ortamKur();
	try {
		const talepId = ornekTalep(db);
		depo.talepDurumu(talepId, 'kapandi');

		const satirlar = kuyruk(db);
		assert.equal(satirlar.length, 1);
		assert.equal(satirlar[0].islem, 'talep.durum');
		assert.deepEqual(satirlar[0].govde, { id: talepId, durum: 'kapandi' });
		assert.deepEqual(
			Object.keys(satirlar[0].govde).sort(),
			[...IZINLI_ALANLAR['talep.durum']].sort(),
		);
	} finally {
		kapat();
	}
});

test('kapatma yerel kopyaya da yansıyor', () => {
	const { db, depo, kapat } = ortamKur();
	try {
		const talepId = ornekTalep(db);
		depo.talepDurumu(talepId, 'kapandi');
		assert.equal(depo.talepGetir(talepId).durum, 'kapandi');
	} finally {
		kapat();
	}
});

test('bilinmeyen talep durumu reddediliyor ve kuyruğa hiçbir şey yazılmıyor', () => {
	const { db, depo, kapat } = ortamKur();
	try {
		const talepId = ornekTalep(db);
		assert.throws(() => depo.talepDurumu(talepId, 'silindi'), /Bilinmeyen talep durumu/);
		assert.equal(kuyruk(db).length, 0);
		assert.equal(depo.talepGetir(talepId).durum, 'acik');
	} finally {
		kapat();
	}
});

test('talep listesi duruma ve aramaya göre süzülüyor', () => {
	const { db, depo, kapat } = ortamKur();
	try {
		ornekTalep(db, { id: 't1', durum: 'acik' });
		ornekTalep(db, { id: 't2', durum: 'kapandi' });

		assert.equal(depo.talepListesi().length, 2);
		assert.equal(depo.talepListesi({ durum: 'acik' }).length, 1);
		assert.equal(depo.talepListesi({ kapaliDahil: false }).length, 1);
		assert.equal(depo.talepListesi({ arama: 'açılmıyor' }).length, 2, 'Türkçe arama');
		assert.equal(depo.talepListesi({ arama: 'fatura' }).length, 0);
		assert.equal(depo.talepListesi()[0].mesajSayisi, 1);
	} finally {
		kapat();
	}
});

/* ------------------------------------------------------------------ */
/* Eşitleme kaydı kurucuları                                           */
/* ------------------------------------------------------------------ */

test('yanıt kaydı yalnızca dört alan taşıyor', () => {
	const kayit = talepYanitiEsitlemeKaydi({
		id: 'y1',
		talepId: 't1',
		metin: 'Tamam',
		zaman: '2026-09-23T10:00:00.000Z',
	});
	assert.equal(kayit.islem, 'talep.yanit');
	assert.deepEqual(Object.keys(kayit.govde).sort(), ['id', 'metin', 'talep_id', 'zaman']);
});

test('durum kaydı yalnızca kimlik ve durum taşıyor', () => {
	const kayit = talepDurumuEsitlemeKaydi({ id: 't1', durum: 'kapandi' });
	assert.equal(kayit.islem, 'talep.durum');
	assert.deepEqual(Object.keys(kayit.govde).sort(), ['durum', 'id']);
});

/* ------------------------------------------------------------------ */
/* Eşitleme ayarları                                                   */
/* ------------------------------------------------------------------ */

test('ayar alanları veri katmanındaki anahtar listesiyle birebir aynı', () => {
	assert.deepEqual(
		ESITLEME_AYARLARI.map((a) => a.anahtar).sort(),
		[...AYAR_ANAHTARLARI].sort(),
		'iki liste ayrışırsa arayüz bir alanı sormaz ve eşitleme sebepsiz yere hata verir',
	);
});

test('ayar doğrulaması eksik değerde uyarıyor', () => {
	const hatalar = esitlemeAyariDogrula({});
	assert.equal(hatalar.length, ESITLEME_AYARLARI.length, 'dört alanın dördü de sayılmalı');
	for (const alan of ESITLEME_AYARLARI) {
		assert.ok(
			hatalar.some((h) => h.includes(alan.etiket)),
			`${alan.etiket} için uyarı yok`,
		);
	}

	const tekEksik = esitlemeAyariDogrula({
		'esitleme.sunucu': 'panel@makine',
		'esitleme.uzak_veri': '/srv/panel/veri',
		'esitleme.uzak_vt': '/srv/panel/panel.db',
		'esitleme.ssh_anahtari': '   ',
		'esitleme.uzak_node': '/opt/node24/bin/node',
	});
	assert.deepEqual(tekEksik, ['SSH özel anahtar yolu boş bırakılamaz.']);
});

test('ayar doğrulaması kabuğa yem olacak değeri reddediyor', () => {
	const temel = {
		'esitleme.sunucu': 'panel@makine',
		'esitleme.uzak_veri': '/srv/panel/veri',
		'esitleme.uzak_vt': '/srv/panel/panel.db',
		'esitleme.ssh_anahtari': 'C:\\Users\\ad\\.ssh\\id_ed25519',
		'esitleme.uzak_node': '/opt/node24/bin/node',
	};
	assert.deepEqual(esitlemeAyariDogrula(temel), [], 'Windows anahtar yolu kabul edilmeli');

	assert.equal(esitlemeAyariDogrula({ ...temel, 'esitleme.sunucu': 'makine' }).length, 1);
	assert.equal(
		esitlemeAyariDogrula({ ...temel, 'esitleme.uzak_veri': '/srv/panel; rm -rf /' }).length,
		1,
	);
});

test('ayarlar boşken eşitleme ayarları eksik diye anlaşılır hata veriyor', () => {
	const { db, kapat } = ortamKur();
	try {
		assert.throws(() => ayarlariOku(db), /Eşitleme ayarları eksik/);
	} finally {
		kapat();
	}
});

test('kaydedilen ayarları veri katmanı olduğu gibi kabul ediyor', () => {
	const { db, depo, kapat } = ortamKur();
	try {
		depo.esitlemeAyariYaz({
			'esitleme.sunucu': 'panel@makine',
			'esitleme.uzak_veri': '/srv/panel/veri',
			'esitleme.uzak_vt': '/srv/panel/panel.db',
			'esitleme.ssh_anahtari': 'C:\\Users\\ad\\.ssh\\id_ed25519',
			'esitleme.uzak_node': '/opt/node24/bin/node',
		});
		const ayar = ayarlariOku(db);
		assert.equal(ayar['esitleme.sunucu'], 'panel@makine');
		assert.equal(ayar['esitleme.uzak_vt'], '/srv/panel/panel.db');
		// Uzak Node yolu ayar olmasaydı komut düz "node" diye çağrılır ve
		// sunucudaki eski sürüme düşerdi.
		assert.equal(ayar['esitleme.uzak_node'], '/opt/node24/bin/node');
	} finally {
		kapat();
	}
});

test('eksik ayar kaydedilmiyor', () => {
	const { db, depo, kapat } = ortamKur();
	try {
		assert.throws(
			() => depo.esitlemeAyariYaz({ 'esitleme.sunucu': 'panel@makine' }),
			/boş bırakılamaz/,
		);
		assert.equal(db.prepare('SELECT COUNT(*) AS adet FROM ayar').get().adet, 0);
	} finally {
		kapat();
	}
});

/* ------------------------------------------------------------------ */
/* Eşitleme özeti                                                      */
/* ------------------------------------------------------------------ */

test('özet bekleyen işlem sayısını, en eskisini ve ayar hatalarını veriyor', () => {
	const { db, depo, kapat } = ortamKur();
	try {
		const bos = depo.esitlemeOzeti();
		assert.equal(bos.bekleyenSayisi, 0);
		assert.equal(bos.enEski, null);
		assert.equal(bos.sonCalisma, null);
		assert.equal(bos.ayarHatalari.length, ESITLEME_AYARLARI.length);

		const talepId = ornekTalep(db);
		depo.talepYanitla(talepId, 'İlk yanıt.');
		depo.talepDurumu(talepId, 'kapandi');

		const ozet = depo.esitlemeOzeti();
		assert.equal(ozet.bekleyenSayisi, 2);
		assert.ok(ozet.enEski, 'en eski bekleyenin zamanı olmalı');
		assert.deepEqual(
			ozet.islemler.map((i) => i.islem),
			['talep.yanit', 'talep.durum'],
			'sıra eskiden yeniye',
		);
		assert.equal(ozet.islemler[1].kayitId, talepId);
	} finally {
		kapat();
	}
});

test('özet kuyruk gövdesini dışarı vermiyor', () => {
	const { db, depo, kapat } = ortamKur();
	try {
		const talepId = ornekTalep(db);
		depo.talepYanitla(talepId, 'Gizli olmayan ama gereksiz bir metin.');
		const ozet = depo.esitlemeOzeti();
		assert.deepEqual(Object.keys(ozet.islemler[0]).sort(), [
			'islem',
			'kayitId',
			'olusturuldu',
			'sira',
		]);
	} finally {
		kapat();
	}
});

test('eşitleme ayarları kuyruğa yazılmıyor', () => {
	const { db, depo, kapat } = ortamKur();
	try {
		depo.esitlemeAyariYaz({
			'esitleme.sunucu': 'panel@makine',
			'esitleme.uzak_veri': '/srv/panel/veri',
			'esitleme.uzak_vt': '/srv/panel/panel.db',
			'esitleme.ssh_anahtari': '/home/ad/.ssh/id_ed25519',
			'esitleme.uzak_node': '/opt/node24/bin/node',
		});
		assert.equal(
			db.prepare('SELECT COUNT(*) AS adet FROM esitleme_kuyrugu').get().adet,
			0,
			'sunucu bilgisi eşitleme kuyruğuna girmemeli',
		);
	} finally {
		kapat();
	}
});

import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { getCollection } from 'astro:content';

import { canliSayfalar, canliYokla, sunucuDurumu } from './sunucu.mjs';

const calistir = promisify(execFile);

/*
  SİTE DURUMU

  Tek soruya cevap veriyor: "yazdığım şey sitede görünüyor mu, görünmüyorsa
  neden?" Beş ayrı yerden veri topluyor ve hepsini aynı ekranda gösteriyor —
  ayrı ayrı bakmak gerekirse kimse bakmıyor.

  Toplamanın hiçbir adımı hata FIRLATMIYOR. Sunucuya ulaşamamak olağan bir
  durum (uçakta, otelde, anahtarsız bir makinede) ve sayfanın o gün çökmek
  yerine ne bilmediğini söylemesi gerekiyor. Her alan bu yüzden kendi hata
  metnini taşıyor.

  Yalnızca panel kipinde çalışıyor; yayın derlemesi bu dosyayı hiç görmüyor.
  Gerekçe: src/yayin/eklenti.mjs.
*/

const PROJE_KOKU = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

/** Sitenin yayın öneki. Yerel yazı adresleri bununla kuruluyor. */
const SITE_YOLU = '/web-sitem';

export interface Yazi {
	baslik: string;
	dosya: string;
	yol: string;
	dil: string;
	tarih: Date;
}

export interface GitDurumu {
	/** Çalışma kopyasında kaydedilmemiş dosyalar. */
	kaydedilmemis: string[];
	/** Üst akışa gönderilmemiş commit sayısı; bilinmiyorsa null. */
	gonderilmemis: number | null;
	dal: string;
	/** Üst akış yoksa ya da git çalışmadıysa buraya düşüyor. */
	not: string | null;
}

export interface Durum {
	canli: Awaited<ReturnType<typeof canliYokla>>;
	sunucu: Awaited<ReturnType<typeof sunucuDurumu>>;
	/** Yazılmış ama yayındaki site haritasında olmayan, taslak olmayan yazılar. */
	yayinlanmamis: Yazi[];
	taslaklar: Yazi[];
	toplamYazi: number;
	/** Site haritası okunamadıysa karşılaştırma yapılamadı demektir. */
	karsilastirilabildi: boolean;
	git: GitDurumu;
}

/** Yazının yayındaki adresi. Türkçe yazılar öneksiz, İngilizceler `/en` altında. */
function yaziYolu(id: string, dil: string): string {
	return dil === 'en' ? `${SITE_YOLU}/en/blog/${id}` : `${SITE_YOLU}/blog/${id}`;
}

async function gitDurumu(): Promise<GitDurumu> {
	const sec = { cwd: PROJE_KOKU, timeout: 15_000, encoding: 'utf8' as const };

	let dal = '—';
	try {
		const { stdout } = await calistir('git', ['rev-parse', '--abbrev-ref', 'HEAD'], sec);
		dal = stdout.trim();
	} catch {
		return {
			kaydedilmemis: [],
			gonderilmemis: null,
			dal,
			not: 'git çalıştırılamadı, bu klasör bir depo olmayabilir',
		};
	}

	let kaydedilmemis: string[] = [];
	try {
		const { stdout } = await calistir('git', ['status', '--porcelain'], sec);
		kaydedilmemis = stdout.split('\n').filter((s) => s.trim());
	} catch {
		// Dal okunabildiyse buranın düşmesi beklenmiyor; yine de boş liste
		// göstermek sayfayı çökertmekten iyi.
	}

	/*
	  Üst akış tanımlı değilse `@{u}` hata veriyor — bu bir arıza değil, henüz
	  gönderilmemiş yerel bir dal. Sayı yerine ne olduğunu anlatan bir not
	  dönüyor; "0 commit gönderilmemiş" demek yanıltıcı olurdu.
	*/
	try {
		const { stdout } = await calistir('git', ['rev-list', '--count', '@{u}..HEAD'], sec);
		return { kaydedilmemis, gonderilmemis: Number(stdout.trim()), dal, not: null };
	} catch {
		return {
			kaydedilmemis,
			gonderilmemis: null,
			dal,
			not: 'uzak karşılığı yok, gönderilmemiş commit sayılamıyor',
		};
	}
}

export async function durumGetir(): Promise<Durum> {
	/*
	  Üç yavaş iş (HTTP yoklaması, site haritası, ssh) aynı anda başlatılıyor.
	  Sırayla yapılsaydı sayfa açılışı üçünün toplamı kadar sürerdi; ölçüldüğünde
	  bu ~4 saniye yerine ~2 saniye demek.
	*/
	const [canli, yayindakiler, sunucu, git, yazilar] = await Promise.all([
		canliYokla(),
		canliSayfalar(),
		sunucuDurumu(),
		gitDurumu(),
		getCollection('blog'),
	]);

	const hepsi: (Yazi & { taslak: boolean })[] = yazilar
		.map((yazi) => ({
			baslik: yazi.data.title,
			// Dosya adı, yazıyı panelde bulmanın en kısa yolu; koleksiyon kimliği
			// dosya adının uzantısız hâli olduğu için yedek olarak o kullanılıyor.
			dosya: yazi.filePath ?? `${yazi.id}.mdx`,
			yol: yaziYolu(yazi.id, yazi.data.dil),
			dil: yazi.data.dil,
			tarih: yazi.data.pubDate,
			taslak: yazi.data.draft,
		}))
		.sort((a, b) => b.tarih.valueOf() - a.tarih.valueOf());

	/*
	  Taslaklar "yayınlanmamış" sayılmıyor: yayında olmamaları zaten istenen
	  şey. İkisi karıştırılsaydı ekran her taslakta boşuna alarm verirdi.
	*/
	const taslaklar = hepsi.filter((y) => y.taslak);
	const yayinlanmamis =
		yayindakiler === null
			? []
			: hepsi.filter((y) => !y.taslak && !yayindakiler.includes(y.yol));

	return {
		canli,
		sunucu,
		yayinlanmamis,
		taslaklar,
		toplamYazi: hepsi.length,
		karsilastirilabildi: yayindakiler !== null,
		git,
	};
}

/** "2 saat önce" gibi; tarihin kendisi ayrıca gösteriliyor. */
export function neKadarOnce(tarih: Date): string {
	const saniye = Math.max(0, Math.round((Date.now() - tarih.valueOf()) / 1000));
	if (saniye < 90) return 'az önce';
	const dakika = Math.round(saniye / 60);
	if (dakika < 60) return `${dakika} dakika önce`;
	const saat = Math.round(dakika / 60);
	if (saat < 36) return `${saat} saat önce`;
	return `${Math.round(saat / 24)} gün önce`;
}

/**
 * TEKNOLOJİ KATALOĞU — yetkinlikler bölümünün hazır bilgisi.
 *
 * Panelde yetkinlik eklerken teknoloji bu listeden SEÇİLİYOR; adı, simgesi ve
 * "bu teknoloji nedir" tanımı oradan geliyor. Panelde elle yazılan tek şey
 * kişisel olan kısım: ne kadardır kullanıldığı ve NEREDE kullanıldığı.
 *
 * Bölünme bilinçli:
 *   - Tanım nesnel bir bilgi ve her sitede aynı. Her yetkinlik eklendiğinde
 *     yeniden yazılması hem zaman kaybı hem tutarsızlık kaynağıydı.
 *   - Kullanım deneyimi kişisel; onu yalnızca site sahibi yazabilir.
 *
 * YENİ TEKNOLOJİ EKLEMEK: buraya bir satır ekle, panelde seçenek olarak
 * kendiliğinden çıkar (`keystatic.config.ts` seçenekleri bu listeden üretiyor).
 * `kimlik` içerik dosyasında saklanan değer — sonradan DEĞİŞTİRME, yoksa o
 * teknolojiyi seçmiş kayıtlar eşleşmez.
 *
 * `ikon` Iconify "logos" setinden; derleme sırasında satır içi SVG olarak
 * gömülüyor. Logo seti bir teknolojiyi taşımıyorsa (PostGIS, SOLIDWORKS)
 * anlamca yakın bir `lucide` simgesi kullanılıyor — kutu görünmesindense
 * nötr bir simge daha iyi.
 */
export interface Teknoloji {
	/** İçerik dosyasında saklanan değişmez anahtar. */
	kimlik: string;
	/** Ekranda görünen ad; özel ad olduğu için çevrilmiyor. */
	ad: string;
	ikon: string;
	tanim: { tr: string; en: string };
}

export const TEKNOLOJILER: readonly Teknoloji[] = [
	// --- Diller ---
	{
		kimlik: 'python',
		ad: 'Python',
		ikon: 'logos:python',
		tanim: {
			tr: 'Okunabilirliği öne alan, betikten veri işlemeye kadar geniş bir alanda kullanılan genel amaçlı dil.',
			en: 'A general-purpose language built around readability, used for everything from small scripts to data processing.',
		},
	},
	{
		kimlik: 'javascript',
		ad: 'JavaScript',
		ikon: 'logos:javascript',
		tanim: {
			tr: 'Tarayıcının kendi dili; sunucu tarafında da Node.js ile çalışıyor.',
			en: "The browser's native language, which also runs on the server through Node.js.",
		},
	},
	{
		kimlik: 'typescript',
		ad: 'TypeScript',
		ikon: 'logos:typescript-icon',
		tanim: {
			tr: "JavaScript'in tip sistemi eklenmiş hâli; hatayı çalışma anından derleme anına taşıyor.",
			en: 'JavaScript with a type system, moving errors from runtime to compile time.',
		},
	},
	{
		kimlik: 'dart',
		ad: 'Dart',
		ikon: 'logos:dart',
		tanim: {
			tr: "Flutter'ın dili; hem yerel makine koduna hem JavaScript'e derleniyor.",
			en: 'The language behind Flutter, compiling to both native machine code and JavaScript.',
		},
	},
	{
		kimlik: 'go',
		ad: 'Go',
		ikon: 'logos:go',
		tanim: {
			tr: 'Eşzamanlılığı dilin içine gömen ve tek çalıştırılabilir dosya üreten sistem dili.',
			en: 'A systems language with concurrency built into the language and builds that produce a single executable.',
		},
	},
	{
		kimlik: 'rust',
		ad: 'Rust',
		ikon: 'logos:rust',
		tanim: {
			tr: 'Çöp toplayıcı olmadan, sahiplik modeliyle bellek güvenliğini derleme anında güvence altına alan sistem dili.',
			en: 'A systems language that guarantees memory safety through its ownership model, without a garbage collector.',
		},
	},
	{
		kimlik: 'php',
		ad: 'PHP',
		ikon: 'logos:php',
		tanim: {
			tr: 'Web sunucusunda çalışan, dinamik sayfa üretmek için yaygınlaşmış betik dili.',
			en: 'A scripting language that runs on the web server and became widespread for generating dynamic pages.',
		},
	},
	{
		kimlik: 'kotlin',
		ad: 'Kotlin',
		ikon: 'logos:kotlin-icon',
		tanim: {
			tr: "JVM üzerinde çalışan, Android'in birincil dili olan ve Java koduyla birlikte kullanılabilen dil.",
			en: 'A JVM language, the primary one for Android, that interoperates with existing Java code.',
		},
	},
	{
		kimlik: 'swift',
		ad: 'Swift',
		ikon: 'logos:swift',
		tanim: {
			tr: 'Apple platformlarında iOS ve macOS uygulamaları yazmak için kullanılan derlenen dil.',
			en: 'A compiled language used to build iOS and macOS applications across Apple platforms.',
		},
	},
	{
		kimlik: 'bash',
		ad: 'Bash',
		ikon: 'logos:bash-icon',
		tanim: {
			tr: 'Linux ve macOS terminallerinin kabuğu; komutları betiğe dönüştürüp otomatikleştiriyor.',
			en: 'The shell behind Linux and macOS terminals, turning commands into reusable scripts.',
		},
	},

	// --- Çatı ve kütüphane ---
	{
		kimlik: 'flutter',
		ad: 'Flutter',
		ikon: 'logos:flutter-icon',
		tanim: {
			tr: 'Tek kod tabanından iOS, Android, web ve masaüstüne arayüz üreten, kendi çizim motoruna sahip çatı.',
			en: 'A framework that draws its own UI and builds for iOS, Android, web and desktop from a single codebase.',
		},
	},
	{
		kimlik: 'react',
		ad: 'React',
		ikon: 'logos:react',
		tanim: {
			tr: 'Arayüzü bileşenlere bölen ve durum değiştikçe ekranı yeniden çizen JavaScript kütüphanesi.',
			en: 'A JavaScript library that splits an interface into components and re-renders them as state changes.',
		},
	},
	{
		kimlik: 'astro',
		ad: 'Astro',
		ikon: 'logos:astro-icon',
		tanim: {
			tr: "İçerik odaklı siteleri statik HTML'e derleyen, tarayıcıya yalnızca gereken JavaScript'i gönderen çatı.",
			en: 'A framework for content sites that compiles to static HTML and ships only the JavaScript a page needs.',
		},
	},
	{
		kimlik: 'nodejs',
		ad: 'Node.js',
		ikon: 'logos:nodejs-icon',
		tanim: {
			tr: "JavaScript'i tarayıcı dışında çalıştıran, sunucuların ve komut satırı araçlarının üzerine kurulduğu ortam.",
			en: 'A runtime that executes JavaScript outside the browser, underpinning servers and command-line tools.',
		},
	},
	{
		kimlik: 'tailwind',
		ad: 'Tailwind CSS',
		ikon: 'logos:tailwindcss-icon',
		tanim: {
			tr: 'Stili hazır bileşenler yerine küçük yardımcı sınıflarla doğrudan işaretlemede kuran CSS çatısı.',
			en: 'A CSS framework that styles markup directly with small utility classes instead of ready-made components.',
		},
	},

	// --- Veri ---
	{
		kimlik: 'postgresql',
		ad: 'PostgreSQL',
		ikon: 'logos:postgresql',
		tanim: {
			tr: 'Standartlara bağlılığı ve eklentilerle genişleyebilmesiyle bilinen açık kaynaklı ilişkisel veritabanı.',
			en: 'An open source relational database known for standards compliance and extensibility.',
		},
	},
	{
		kimlik: 'mongodb',
		ad: 'MongoDB',
		ikon: 'logos:mongodb-icon',
		tanim: {
			tr: 'Veriyi satır ve tablolar yerine JSON benzeri belgelerde saklayan belge tabanlı veritabanı.',
			en: 'A document database that stores data as JSON-like documents rather than rows in tables.',
		},
	},
	{
		kimlik: 'redis',
		ad: 'Redis',
		ikon: 'logos:redis',
		tanim: {
			tr: 'Veriyi bellekte tutan; önbellek, kuyruk ve oturum deposu olarak kullanılan anahtar-değer sistemi.',
			en: 'An in-memory key-value store used for caching, queues and session data.',
		},
	},
	{
		// "logos" setinde PostGIS yok; konumu anlatan nötr bir simge kullanılıyor.
		kimlik: 'postgis',
		ad: 'PostGIS',
		ikon: 'lucide:map-pin',
		tanim: {
			tr: "PostgreSQL'e coğrafi veri tipleri ve konum sorguları ekleyen uzamsal veritabanı eklentisi.",
			en: 'A PostgreSQL extension that adds geographic data types and spatial queries.',
		},
	},

	// --- Altyapı ve dağıtım ---
	{
		kimlik: 'docker',
		ad: 'Docker',
		ikon: 'logos:docker-icon',
		tanim: {
			tr: 'Uygulamayı bağımlılıklarıyla paketleyip her ortamda aynı şekilde çalıştıran kapsayıcı aracı.',
			en: 'A container tool that packages an application with its dependencies so it runs the same anywhere.',
		},
	},
	{
		kimlik: 'kubernetes',
		ad: 'Kubernetes',
		ikon: 'logos:kubernetes',
		tanim: {
			tr: 'Kapsayıcıları birden çok sunucuya dağıtan, ölçekleyen ve ayakta tutan düzenleme sistemi.',
			en: 'An orchestration system that deploys, scales and keeps containers running across many servers.',
		},
	},
	{
		kimlik: 'nginx',
		ad: 'Nginx',
		ikon: 'logos:nginx',
		tanim: {
			tr: 'Statik dosyaları sunan ve istekleri arka uç servislerine dağıtan web sunucusu ve ters vekil.',
			en: 'A web server and reverse proxy that serves static files and routes requests to backend services.',
		},
	},
	{
		kimlik: 'linux',
		ad: 'Linux',
		ikon: 'logos:linux-tux',
		tanim: {
			tr: 'Sunucuların büyük bölümünde çalışan açık kaynaklı işletim sistemi çekirdeği ve dağıtımları.',
			en: 'The open source operating system kernel, and its distributions, behind most servers.',
		},
	},
	{
		kimlik: 'git',
		ad: 'Git',
		ikon: 'logos:git-icon',
		tanim: {
			tr: 'Değişiklikleri sürüm sürüm kaydeden, dallanma ve birleştirmeye dayalı dağıtık sürüm kontrol sistemi.',
			en: 'A distributed version control system built on commits, branching and merging.',
		},
	},
	{
		kimlik: 'github-actions',
		ad: 'GitHub Actions',
		ikon: 'logos:github-actions',
		tanim: {
			tr: 'Depoya gelen her değişiklikte test ve dağıtım adımlarını çalıştıran CI/CD hizmeti.',
			en: 'A CI/CD service that runs test and deployment steps on every change pushed to a repository.',
		},
	},
	{
		kimlik: 'terraform',
		ad: 'Terraform',
		ikon: 'logos:terraform-icon',
		tanim: {
			tr: 'Sunucu ve ağ gibi altyapıyı kodla tanımlayıp sürümlenebilir biçimde kuran araç.',
			en: 'A tool that defines infrastructure such as servers and networks as versioned code.',
		},
	},

	// --- Mekanik tasarım ---
	{
		// "logos" setinde SOLIDWORKS yok; üç boyutlu parçayı anlatan nötr simge.
		kimlik: 'solidworks',
		ad: 'SOLIDWORKS',
		ikon: 'lucide:box',
		tanim: {
			tr: 'Parça ve montajları parametrik olarak modelleyen, teknik resim üreten üç boyutlu CAD yazılımı.',
			en: '3D CAD software for parametric modelling of parts and assemblies and producing technical drawings.',
		},
	},
];

/** Kimlikten teknolojiye erişim; içerik dosyası yalnızca kimliği saklıyor. */
export const teknolojiBul = (kimlik: string): Teknoloji | undefined =>
	TEKNOLOJILER.find((t) => t.kimlik === kimlik);

/** Panel seçeneklerini katalogdan üretir; liste büyüyünce panel kendiliğinden büyür. */
export const TEKNOLOJI_SECENEKLERI = TEKNOLOJILER.map((t) => ({ label: t.ad, value: t.kimlik }));

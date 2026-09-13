import * as React from 'react';
import {
	FloatingIconsHero,
	type FloatingIconsHeroProps,
} from '@/components/ui/floating-icons-hero-section';

// Iconify "logos" setinden resmi, renkli logolar. unplugin-icons bunları derleme
// sırasında satır içi SVG bileşenine çeviriyor; çalışma anında ağ isteği olmuyor.

// Bu sitenin üzerine kurulduğu teknolojiler
import IconAstro from '~icons/logos/astro-icon';
import IconTypeScript from '~icons/logos/typescript-icon';
import IconTailwind from '~icons/logos/tailwindcss-icon';
import IconReact from '~icons/logos/react';
import IconJavaScript from '~icons/logos/javascript';
import IconHtml from '~icons/logos/html-5';
import IconCss from '~icons/logos/css-3';
import IconNode from '~icons/logos/nodejs-icon';
import IconNpm from '~icons/logos/npm-icon';
import IconVite from '~icons/logos/vitejs';
import IconMarkdown from '~icons/logos/markdown';
import IconVSCode from '~icons/logos/visual-studio-code';

// Diller ve platformlar
import IconGo from '~icons/logos/go';
import IconRust from '~icons/logos/rust';
import IconPhp from '~icons/logos/php';
import IconSwift from '~icons/logos/swift';
import IconKotlin from '~icons/logos/kotlin';
import IconFlutter from '~icons/logos/flutter';
import IconBash from '~icons/logos/bash';

// DevOps ve altyapı
import IconDocker from '~icons/logos/docker-icon';
import IconKubernetes from '~icons/logos/kubernetes';
import IconGit from '~icons/logos/git-icon';
import IconGithubActions from '~icons/logos/github-actions';
import IconGitlab from '~icons/logos/gitlab';
import IconLinux from '~icons/logos/linux-tux';
import IconUbuntu from '~icons/logos/ubuntu';
import IconNginx from '~icons/logos/nginx';
import IconTerraform from '~icons/logos/terraform-icon';
import IconAnsible from '~icons/logos/ansible';
import IconJenkins from '~icons/logos/jenkins';

// Bulut ve veri
import IconCloudflare from '~icons/logos/cloudflare-icon';
import IconGoogleCloud from '~icons/logos/google-cloud';
import IconPostgres from '~icons/logos/postgresql';
import IconMongo from '~icons/logos/mongodb-icon';
import IconVercel from '~icons/logos/vercel-icon';

/*
  35 logo var; hepsi aynı anda görünürse başlık boğuluyor. İki kural uygulandı:

  1. Yerleşim: logolar üst, alt, sol ve sağ bantlara dağıtıldı. Ekranın ortası
     (yatayda %28-72, dikeyde %34-66) metin için boş bırakıldı.
  2. Kademeli görünürlük: dar ekranda yalnızca 6 logo duruyor, ekran büyüdükçe
     md / lg / xl kırılımlarında sırayla açılıyor.
*/
const ikonlar: FloatingIconsHeroProps['icons'] = [
	// --- Dar ekranda da görünen çekirdek (6) ---
	{ id: 1, icon: IconAstro, className: 'top-[12%] left-[7%]' },
	{ id: 2, icon: IconTypeScript, className: 'top-[14%] right-[7%]' },
	{ id: 3, icon: IconTailwind, className: 'bottom-[12%] left-[8%]' },
	{ id: 4, icon: IconReact, className: 'bottom-[14%] right-[8%]' },
	{ id: 5, icon: IconJavaScript, className: 'top-[6%] left-[40%]' },
	{ id: 6, icon: IconDocker, className: 'bottom-[6%] left-[42%]' },

	// --- md: orta ekran (+10) ---
	{ id: 7, icon: IconHtml, className: 'top-[7%] left-[22%] hidden md:block' },
	{ id: 8, icon: IconCss, className: 'top-[8%] right-[22%] hidden md:block' },
	{ id: 9, icon: IconNode, className: 'bottom-[7%] left-[24%] hidden md:block' },
	{ id: 10, icon: IconGit, className: 'bottom-[8%] right-[24%] hidden md:block' },
	{ id: 11, icon: IconGoogleCloud, className: 'top-[40%] left-[4%] hidden md:block' },
	{ id: 12, icon: IconGo, className: 'top-[58%] right-[4%] hidden md:block' },
	{ id: 13, icon: IconKubernetes, className: 'top-[16%] left-[32%] hidden md:block' },
	{ id: 14, icon: IconLinux, className: 'bottom-[16%] right-[33%] hidden md:block' },
	{ id: 15, icon: IconVite, className: 'top-[26%] left-[16%] hidden md:block' },
	{ id: 16, icon: IconVercel, className: 'bottom-[26%] right-[16%] hidden md:block' },

	// --- lg: geniş ekran (+10) ---
	{ id: 17, icon: IconRust, className: 'top-[5%] left-[60%] hidden lg:block' },
	{ id: 18, icon: IconPhp, className: 'bottom-[5%] left-[60%] hidden lg:block' },
	{ id: 19, icon: IconNpm, className: 'top-[24%] right-[14%] hidden lg:block' },
	{ id: 20, icon: IconMarkdown, className: 'bottom-[24%] left-[15%] hidden lg:block' },
	{ id: 21, icon: IconUbuntu, className: 'top-[62%] left-[4%] hidden lg:block' },
	{ id: 22, icon: IconNginx, className: 'top-[36%] right-[4%] hidden lg:block' },
	{ id: 23, icon: IconGitlab, className: 'top-[10%] left-[52%] hidden lg:block' },
	{ id: 24, icon: IconPostgres, className: 'bottom-[10%] left-[52%] hidden lg:block' },
	{ id: 25, icon: IconCloudflare, className: 'top-[18%] right-[36%] hidden lg:block' },
	{ id: 26, icon: IconSwift, className: 'bottom-[18%] left-[36%] hidden lg:block' },

	// --- xl: çok geniş ekran (+9) ---
	{ id: 27, icon: IconVSCode, className: 'top-[30%] left-[9%] hidden xl:block' },
	{ id: 28, icon: IconMongo, className: 'bottom-[30%] right-[9%] hidden xl:block' },
	{ id: 29, icon: IconKotlin, className: 'top-[5%] left-[14%] hidden xl:block' },
	{ id: 30, icon: IconFlutter, className: 'bottom-[5%] right-[14%] hidden xl:block' },
	{ id: 31, icon: IconGithubActions, className: 'top-[20%] left-[44%] hidden xl:block' },
	{ id: 32, icon: IconTerraform, className: 'bottom-[20%] right-[44%] hidden xl:block' },
	{ id: 33, icon: IconAnsible, className: 'top-[52%] left-[13%] hidden xl:block' },
	{ id: 34, icon: IconJenkins, className: 'top-[74%] right-[20%] hidden xl:block' },
	{ id: 35, icon: IconBash, className: 'top-[48%] right-[13%] hidden xl:block' },
];

export default function HeroBolumu() {
	return (
		<FloatingIconsHero
			title="Ben Mustafa Eybek"
			subtitle="Yazdıklarımı, üzerinde çalıştığım işleri ve öğrendiklerimi burada topluyorum. İmleci ikonların üzerine götür, kaçışlarını izle."
			ctaText="Yazıları oku"
			ctaHref="/blog"
			icons={ikonlar}
			// Sabit üst çubuk için bırakılan boşluğu geri alarak bölümü tam ekran yapar.
			className="-mt-16"
		/>
	);
}

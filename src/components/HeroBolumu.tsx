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
import IconKotlin from '~icons/logos/kotlin-icon';
import IconFlutter from '~icons/logos/flutter-icon';
import IconBash from '~icons/logos/bash-icon';

// DevOps ve altyapı
import IconDocker from '~icons/logos/docker-icon';
import IconKubernetes from '~icons/logos/kubernetes';
import IconGit from '~icons/logos/git-icon';
import IconGithubActions from '~icons/logos/github-actions';
import IconGitlab from '~icons/logos/gitlab-icon';
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
	{ id: 1, icon: IconAstro, ad: 'Astro', koyuTemadaTersle: true, className: 'top-[24%] left-[8%] md:top-[12%] md:left-[7%]' },
	{ id: 2, icon: IconTypeScript, ad: 'TypeScript', className: 'top-[15%] right-[17%] md:top-[14%] md:right-[7%]' },
	{ id: 3, icon: IconTailwind, ad: 'Tailwind CSS', className: 'bottom-[13%] left-[19%] md:bottom-[12%] md:left-[8%]' },
	{ id: 4, icon: IconReact, ad: 'React', className: 'bottom-[23%] right-[8%] md:bottom-[14%] md:right-[8%]' },
	{ id: 5, icon: IconJavaScript, ad: 'JavaScript', className: 'top-[14%] left-[36%] md:top-[6%] md:left-[40%]' },
	{ id: 6, icon: IconDocker, ad: 'Docker', className: 'bottom-[8%] left-[34%] md:bottom-[6%] md:left-[42%]' },

	// --- md: orta ekran (+10) ---
	{ id: 7, icon: IconHtml, ad: 'HTML5', className: 'top-[22%] left-[31%] md:top-[7%] md:left-[22%]' },
	{ id: 8, icon: IconCss, ad: 'CSS3', className: 'top-[19%] right-[33%] md:top-[8%] md:right-[22%]' },
	{ id: 9, icon: IconNode, ad: 'Node.js', className: 'bottom-[18%] left-[32%] md:bottom-[7%] md:left-[24%]' },
	{ id: 10, icon: IconGit, ad: 'Git', className: 'bottom-[27%] right-[23%] md:bottom-[8%] md:right-[24%]' },
	{
		id: 11,
		icon: IconGoogleCloud,
		ad: 'Google Cloud',
		className: 'top-[40%] left-[4%] hidden md:block',
	},
	{ id: 12, icon: IconGo, ad: 'Go', className: 'top-[58%] right-[4%] hidden md:block' },
	{
		id: 13,
		icon: IconKubernetes,
		ad: 'Kubernetes',
		className: 'top-[16%] left-[32%] hidden lg:block',
	},
	{ id: 14, icon: IconLinux, ad: 'Linux', className: 'bottom-[16%] right-[33%] hidden lg:block' },
	{ id: 15, icon: IconVite, ad: 'Vite', className: 'top-[26%] left-[16%] hidden lg:block' },
	{ id: 16, icon: IconVercel, ad: 'Vercel', koyuTemadaTersle: true, className: 'bottom-[26%] right-[16%] hidden lg:block' },

	// --- lg: geniş ekran (+10) ---
	{ id: 17, icon: IconRust, ad: 'Rust', className: 'top-[5%] left-[60%] hidden xl:block' },
	{ id: 18, icon: IconPhp, ad: 'PHP', className: 'bottom-[5%] left-[60%] hidden xl:block' },
	{ id: 19, icon: IconNpm, ad: 'npm', className: 'top-[24%] right-[14%] hidden xl:block' },
	{
		id: 20,
		icon: IconMarkdown,
		ad: 'Markdown',
		koyuTemadaTersle: true,
		className: 'bottom-[24%] left-[15%] hidden xl:block',
	},
	{ id: 21, icon: IconUbuntu, ad: 'Ubuntu', className: 'top-[62%] left-[4%] hidden min-[1600px]:block' },
	{ id: 22, icon: IconNginx, ad: 'Nginx', className: 'top-[36%] right-[4%] hidden min-[1600px]:block' },
	{ id: 23, icon: IconGitlab, ad: 'GitLab', className: 'top-[10%] left-[52%] hidden min-[1600px]:block' },
	{
		id: 24,
		icon: IconPostgres,
		ad: 'PostgreSQL',
		className: 'bottom-[10%] left-[52%] hidden min-[1600px]:block',
	},
	{
		id: 25,
		icon: IconCloudflare,
		ad: 'Cloudflare',
		className: 'top-[18%] right-[36%] hidden min-[1600px]:block',
	},
	{ id: 26, icon: IconSwift, ad: 'Swift', className: 'bottom-[18%] left-[36%] hidden min-[1600px]:block' },

	// --- xl: çok geniş ekran (+9) ---
	{ id: 27, icon: IconVSCode, ad: 'VS Code', className: 'top-[30%] left-[9%] hidden min-[2100px]:block' },
	{ id: 28, icon: IconMongo, ad: 'MongoDB', className: 'bottom-[30%] right-[9%] hidden min-[2100px]:block' },
	{ id: 29, icon: IconKotlin, ad: 'Kotlin', className: 'top-[5%] left-[14%] hidden min-[2100px]:block' },
	{ id: 30, icon: IconFlutter, ad: 'Flutter', className: 'bottom-[5%] right-[14%] hidden min-[2100px]:block' },
	{
		id: 31,
		icon: IconGithubActions,
		ad: 'GitHub Actions',
		className: 'top-[20%] left-[44%] hidden min-[2100px]:block',
	},
	{
		id: 32,
		icon: IconTerraform,
		ad: 'Terraform',
		className: 'bottom-[20%] right-[44%] hidden min-[2100px]:block',
	},
	{ id: 33, icon: IconAnsible, ad: 'Ansible', koyuTemadaTersle: true, className: 'top-[52%] left-[13%] hidden min-[2100px]:block' },
	{ id: 34, icon: IconJenkins, ad: 'Jenkins', className: 'top-[74%] right-[20%] hidden min-[2100px]:block' },
	{ id: 35, icon: IconBash, ad: 'Bash', className: 'top-[48%] right-[13%] hidden min-[2100px]:block' },
];

interface Props {
	baslik: string;
	altBaslik: string;
	birincilMetin: string;
	birincilHedef: string;
	ikincilMetin: string;
	ikincilHedef: string;
}

export default function HeroBolumu({
	baslik,
	altBaslik,
	birincilMetin,
	birincilHedef,
	ikincilMetin,
	ikincilHedef,
}: Props) {
	return (
		<FloatingIconsHero
			title={baslik}
			subtitle={altBaslik}
			ctaText={birincilMetin}
			ctaHref={birincilHedef}
			ikinciCtaText={ikincilMetin}
			ikinciCtaHref={ikincilHedef}
			ikinciCtaHarici
			icons={ikonlar}
			// Sabit üst çubuk için bırakılan boşluğu geri alarak bölümü tam ekran yapar.
			className="-mt-16"
		/>
	);
}

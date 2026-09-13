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
	{ id: 1, icon: IconAstro, ad: 'Astro', koyuTemadaTersle: true, className: 'top-[12%] left-[7%]' },
	{ id: 2, icon: IconTypeScript, ad: 'TypeScript', className: 'top-[14%] right-[7%]' },
	{ id: 3, icon: IconTailwind, ad: 'Tailwind CSS', className: 'bottom-[12%] left-[8%]' },
	{ id: 4, icon: IconReact, ad: 'React', className: 'bottom-[14%] right-[8%]' },
	{ id: 5, icon: IconJavaScript, ad: 'JavaScript', className: 'top-[6%] left-[40%]' },
	{ id: 6, icon: IconDocker, ad: 'Docker', className: 'bottom-[6%] left-[42%]' },

	// --- md: orta ekran (+10) ---
	{ id: 7, icon: IconHtml, ad: 'HTML5', className: 'top-[7%] left-[22%] hidden md:block' },
	{ id: 8, icon: IconCss, ad: 'CSS3', className: 'top-[8%] right-[22%] hidden md:block' },
	{ id: 9, icon: IconNode, ad: 'Node.js', className: 'bottom-[7%] left-[24%] hidden md:block' },
	{ id: 10, icon: IconGit, ad: 'Git', className: 'bottom-[8%] right-[24%] hidden md:block' },
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
		className: 'top-[16%] left-[32%] hidden md:block',
	},
	{ id: 14, icon: IconLinux, ad: 'Linux', className: 'bottom-[16%] right-[33%] hidden md:block' },
	{ id: 15, icon: IconVite, ad: 'Vite', className: 'top-[26%] left-[16%] hidden md:block' },
	{ id: 16, icon: IconVercel, ad: 'Vercel', koyuTemadaTersle: true, className: 'bottom-[26%] right-[16%] hidden md:block' },

	// --- lg: geniş ekran (+10) ---
	{ id: 17, icon: IconRust, ad: 'Rust', className: 'top-[5%] left-[60%] hidden lg:block' },
	{ id: 18, icon: IconPhp, ad: 'PHP', className: 'bottom-[5%] left-[60%] hidden lg:block' },
	{ id: 19, icon: IconNpm, ad: 'npm', className: 'top-[24%] right-[14%] hidden lg:block' },
	{
		id: 20,
		icon: IconMarkdown,
		ad: 'Markdown',
		koyuTemadaTersle: true,
		className: 'bottom-[24%] left-[15%] hidden lg:block',
	},
	{ id: 21, icon: IconUbuntu, ad: 'Ubuntu', className: 'top-[62%] left-[4%] hidden lg:block' },
	{ id: 22, icon: IconNginx, ad: 'Nginx', className: 'top-[36%] right-[4%] hidden lg:block' },
	{ id: 23, icon: IconGitlab, ad: 'GitLab', className: 'top-[10%] left-[52%] hidden lg:block' },
	{
		id: 24,
		icon: IconPostgres,
		ad: 'PostgreSQL',
		className: 'bottom-[10%] left-[52%] hidden lg:block',
	},
	{
		id: 25,
		icon: IconCloudflare,
		ad: 'Cloudflare',
		className: 'top-[18%] right-[36%] hidden lg:block',
	},
	{ id: 26, icon: IconSwift, ad: 'Swift', className: 'bottom-[18%] left-[36%] hidden lg:block' },

	// --- xl: çok geniş ekran (+9) ---
	{ id: 27, icon: IconVSCode, ad: 'VS Code', className: 'top-[30%] left-[9%] hidden xl:block' },
	{ id: 28, icon: IconMongo, ad: 'MongoDB', className: 'bottom-[30%] right-[9%] hidden xl:block' },
	{ id: 29, icon: IconKotlin, ad: 'Kotlin', className: 'top-[5%] left-[14%] hidden xl:block' },
	{ id: 30, icon: IconFlutter, ad: 'Flutter', className: 'bottom-[5%] right-[14%] hidden xl:block' },
	{
		id: 31,
		icon: IconGithubActions,
		ad: 'GitHub Actions',
		className: 'top-[20%] left-[44%] hidden xl:block',
	},
	{
		id: 32,
		icon: IconTerraform,
		ad: 'Terraform',
		className: 'bottom-[20%] right-[44%] hidden xl:block',
	},
	{ id: 33, icon: IconAnsible, ad: 'Ansible', koyuTemadaTersle: true, className: 'top-[52%] left-[13%] hidden xl:block' },
	{ id: 34, icon: IconJenkins, ad: 'Jenkins', className: 'top-[74%] right-[20%] hidden xl:block' },
	{ id: 35, icon: IconBash, ad: 'Bash', className: 'top-[48%] right-[13%] hidden xl:block' },
];

export default function HeroBolumu() {
	return (
		<FloatingIconsHero
			title="Ben Mustafa Eybek"
			// Yer tutucu metin; kendi cümlelerinle değiştirilecek.
			subtitle="Yazılım geliştirici. Web uygulamaları, altyapı ve otomasyon üzerine çalışıyorum; öğrendiklerimi burada yazıyorum."
			ctaText="Yazıları oku"
			ctaHref="/blog"
			ikinciCtaText="GitHub profilim"
			ikinciCtaHref="https://github.com/ridocs"
			ikinciCtaHarici
			icons={ikonlar}
			// Sabit üst çubuk için bırakılan boşluğu geri alarak bölümü tam ekran yapar.
			className="-mt-16"
		/>
	);
}

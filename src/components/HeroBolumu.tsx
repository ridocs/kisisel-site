import * as React from 'react';
import {
	FloatingIconsHero,
	type FloatingIconsHeroProps,
} from '@/components/ui/floating-icons-hero-section';

// Iconify "logos" setinden resmi, renkli teknoloji logoları. unplugin-icons
// bunları derleme sırasında satır içi SVG bileşenine çeviriyor; çalışma anında
// ağ isteği olmuyor ve yalnızca burada kullanılanlar pakete giriyor.
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

// Bu sitenin gerçekten üzerine kurulduğu teknolojiler. Dar ekranda kalabalık
// yapmasın diye bir kısmı yalnızca md ve üzerinde görünüyor.
const ikonlar: FloatingIconsHeroProps['icons'] = [
	{ id: 1, icon: IconAstro, className: 'top-[14%] left-[8%]' },
	{ id: 2, icon: IconTypeScript, className: 'top-[22%] right-[9%]' },
	{ id: 3, icon: IconTailwind, className: 'bottom-[16%] left-[12%]' },
	{ id: 4, icon: IconReact, className: 'bottom-[18%] right-[11%]' },
	{ id: 5, icon: IconJavaScript, className: 'top-[10%] left-[32%] hidden md:block' },
	{ id: 6, icon: IconHtml, className: 'top-[12%] right-[30%] hidden md:block' },
	{ id: 7, icon: IconCss, className: 'bottom-[10%] left-[34%] hidden md:block' },
	{ id: 8, icon: IconNode, className: 'top-[46%] left-[5%] hidden lg:block' },
	{ id: 9, icon: IconVite, className: 'top-[52%] right-[6%] hidden lg:block' },
	{ id: 10, icon: IconMarkdown, className: 'bottom-[12%] right-[34%] hidden md:block' },
	{ id: 11, icon: IconNpm, className: 'top-[34%] right-[20%] hidden lg:block' },
	{ id: 12, icon: IconVSCode, className: 'top-[62%] left-[24%] hidden lg:block' },
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

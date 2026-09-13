import { LiquidMetalButton } from '@/components/ui/liquid-metal-button';

interface Props {
	etiket: string;
	hedef: string;
}

/**
 * Gezinme çubuğundaki "İletişim" düğmesi.
 *
 * Astro adacıklarına fonksiyon özelliği geçirilemediği (serileştirilemiyor)
 * için yönlendirme burada, React tarafında yapılıyor. Etiket ve hedef dile
 * göre dışarıdan veriliyor.
 */
export default function IletisimDugmesi({ etiket, hedef }: Props) {
	return (
		<LiquidMetalButton
			label={etiket}
			onClick={() => {
				window.location.href = hedef;
			}}
		/>
	);
}

import { LiquidMetalButton } from '@/components/ui/liquid-metal-button';

/**
 * Gezinme çubuğundaki "İletişim" düğmesi.
 *
 * Astro adacıklarına fonksiyon özelliği geçirilemediği (serileştirilemiyor)
 * için yönlendirme burada, React tarafında yapılıyor.
 */
export default function IletisimDugmesi() {
	return (
		<LiquidMetalButton
			label="İletişim"
			onClick={() => {
				window.location.href = '/hakkimda#iletisim';
			}}
		/>
	);
}

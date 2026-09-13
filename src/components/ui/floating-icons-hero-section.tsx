import * as React from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Interface for the props of each individual icon.
interface IconProps {
  id: number;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  /** Üzerine gelindiğinde balonda gösterilen ad. */
  ad: string;
  /**
   * Tek renk/koyu logolar koyu zeminde kaybolduğu için koyu temada ters
   * çevrilir. Renkli logolarda kullanılmamalı; renkleri bozar.
   */
  koyuTemadaTersle?: boolean;
  className: string; // Used for custom positioning of the icon.
}

// Interface for the main hero component's props.
export interface FloatingIconsHeroProps {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
  /** İkincil düğme. Verilmezse yalnızca birincil düğme çizilir. */
  ikinciCtaText?: string;
  ikinciCtaHref?: string;
  /** İkincil düğme siteden çıkıyorsa: yeni sekmede açılır ve bu belirtilir. */
  ikinciCtaHarici?: boolean;
  icons: IconProps[];
}

// Yaklaşan imleçten kaçma davranışının ayarları.
const ETKI_YARICAPI = 170; // bu mesafeden itibaren itilmeye başlar
const ITME_GUCU = 75; // en yakın noktadaki kaçış mesafesi (piksel)

// A single icon component with its own motion logic
const Icon = ({
  mouseX,
  mouseY,
  iconData,
  index,
}: {
  mouseX: React.MutableRefObject<number>;
  mouseY: React.MutableRefObject<number>;
  iconData: IconProps;
  index: number;
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [ustunde, setUstunde] = React.useState(false);
  // Olay dinleyicisi bir kez bağlandığı için durumu ref üzerinden okuyoruz.
  const ustundeRef = React.useRef(false);

  // Motion values for the icon's position, with spring physics for smooth movement
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20 });
  const springY = useSpring(y, { stiffness: 300, damping: 20 });

  React.useEffect(() => {
    const handleMouseMove = () => {
      if (!ref.current) return;

      // İmleç simgenin üzerindeyken kaçmıyor: aksi hâlde adını okumak için
      // üzerine gelmek imkânsız olurdu.
      if (ustundeRef.current) {
        x.set(0);
        y.set(0);
        return;
      }

      const rect = ref.current.getBoundingClientRect();
      const merkezX = rect.left + rect.width / 2;
      const merkezY = rect.top + rect.height / 2;
      const distance = Math.sqrt(
        Math.pow(mouseX.current - merkezX, 2) + Math.pow(mouseY.current - merkezY, 2)
      );

      // If the cursor is close enough, repel the icon
      if (distance < ETKI_YARICAPI) {
        const angle = Math.atan2(mouseY.current - merkezY, mouseX.current - merkezX);
        // The closer the cursor, the stronger the repulsion
        const force = (1 - distance / ETKI_YARICAPI) * ITME_GUCU;
        x.set(-Math.cos(angle) * force);
        y.set(-Math.sin(angle) * force);
      } else {
        // Return to original position when cursor is away
        x.set(0);
        y.set(0);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [x, y, mouseX, mouseY]);

  return (
    <motion.div
      ref={ref}
      key={iconData.id}
      style={{
        x: springX,
        y: springY,
      }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        delay: index * 0.08,
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      }}
      onMouseEnter={() => {
        ustundeRef.current = true;
        setUstunde(true);
      }}
      onMouseLeave={() => {
        ustundeRef.current = false;
        setUstunde(false);
      }}
      className={cn('absolute', iconData.className, ustunde && 'z-20')}
    >
      {/* Ad balonu: yalnızca imleç simgenin üzerindeyken beliriyor. */}
      <AnimatePresence>
        {ustunde && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.92 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute -top-10 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-lg dark:bg-white dark:text-slate-900"
          >
            {iconData.ad}
            {/* Balonun altındaki küçük ok */}
            <span
              aria-hidden="true"
              className="absolute top-full left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] bg-slate-900 dark:bg-white"
            />
          </motion.span>
        )}
      </AnimatePresence>

      {/* Inner wrapper for the continuous floating animation */}
      <motion.div
        /* Kart, bulunduğu temaya uyuyor. Koyu temada zemin koyu; koyu zeminde
           kaybolan tek renk/koyu logolar ayrıca `dark:invert` ile ters çevriliyor
           (bkz. HeroBolumu içindeki `koyuTemadaTersle`). */
        className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 p-2.5 rounded-2xl shadow-lg bg-white/90 backdrop-blur-md border border-black/5 transition-shadow hover:shadow-xl dark:bg-slate-800/70 dark:border-white/10"
        animate={{
          y: [0, -8, 0, 8, 0],
          x: [0, 6, 0, -6, 0],
          rotate: [0, 5, 0, -5, 0],
        }}
        transition={{
          duration: 5 + Math.random() * 5,
          repeat: Infinity,
          repeatType: 'mirror',
          ease: 'easeInOut',
        }}
      >
        <iconData.icon
          className={cn(
            'w-7 h-7 md:w-8 md:h-8 text-foreground',
            iconData.koyuTemadaTersle && 'dark:invert'
          )}
        />
        <span className="sr-only">{iconData.ad}</span>
      </motion.div>
    </motion.div>
  );
};

const FloatingIconsHero = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & FloatingIconsHeroProps
>((
  {
    className,
    title,
    subtitle,
    ctaText,
    ctaHref,
    ikinciCtaText,
    ikinciCtaHref,
    ikinciCtaHarici,
    icons,
    ...props
  },
  ref
) => {
  // Refs to track the raw mouse position
  const mouseX = React.useRef(0);
  const mouseY = React.useRef(0);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    mouseX.current = event.clientX;
    mouseY.current = event.clientY;
  };

  return (
    <section
      ref={ref}
      onMouseMove={handleMouseMove}
      className={cn(
        'relative w-full h-screen min-h-[700px] flex items-center justify-center overflow-hidden bg-background',
        className
      )}
      {...props}
    >
      {/* Container for the background floating icons */}
      <div className="absolute inset-0 w-full h-full">
        {icons.map((iconData, index) => (
          <Icon
            key={iconData.id}
            mouseX={mouseX}
            mouseY={mouseY}
            iconData={iconData}
            index={index}
          />
        ))}
      </div>

      {/* Container for the foreground content */}
      <div className="relative z-10 text-center px-4">
        {/* Başlığın üzerinden soldan sağa geçen parıltı: gradyan metne
            maskeleniyor ve arka plan konumu animasyonla kaydırılıyor.
            Hareketi azaltılmış tercihte animasyon durur, metin okunur kalır. */}
        <h1 className="animate-parilti bg-gradient-to-r from-foreground/55 via-foreground to-foreground/55 bg-[length:200%_100%] bg-clip-text text-5xl font-bold tracking-tight text-transparent md:text-7xl motion-reduce:animate-none">
          {title}
        </h1>
        <p className="mt-6 max-w-xl mx-auto text-lg text-muted-foreground">
          {subtitle}
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="px-8 py-6 text-base font-semibold">
            <a href={ctaHref}>{ctaText}</a>
          </Button>
          {ikinciCtaText && ikinciCtaHref && (
            <Button
              asChild
              variant="outline"
              size="lg"
              className="px-8 py-6 text-base font-semibold"
            >
              <a
                href={ikinciCtaHref}
                {...(ikinciCtaHarici
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                {ikinciCtaText}
                {/* Yeni sekmede açıldığını ekran okuyucuya bildirir. */}
                {ikinciCtaHarici && <span className="sr-only"> (yeni sekmede açılır)</span>}
              </a>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
});

FloatingIconsHero.displayName = 'FloatingIconsHero';

export { FloatingIconsHero };

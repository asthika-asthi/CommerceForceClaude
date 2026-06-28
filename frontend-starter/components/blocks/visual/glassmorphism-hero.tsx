interface GlassmorphismHeroProps {
  backgroundImage: string
  title: string
  subtitle?: string
  ctaText?: string
  ctaUrl?: string
  overlayOpacity?: number
}

export function GlassmorphismHero({
  backgroundImage,
  title,
  subtitle,
  ctaText,
  ctaUrl,
  overlayOpacity = 0.4,
}: GlassmorphismHeroProps) {
  return (
    <section
      className="relative min-h-[500px] flex items-center justify-center px-4 py-20"
      style={{
        backgroundImage: `url("${backgroundImage}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }}
      />
      <div className="relative z-10 max-w-xl w-full mx-auto backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-10 text-center shadow-2xl">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">{title}</h1>
        {subtitle && <p className="text-white/80 text-lg mb-8">{subtitle}</p>}
        {ctaText && ctaUrl && (
          <a
            href={ctaUrl}
            className="inline-block px-8 py-3 rounded-xl bg-white text-slate-900 font-semibold hover:bg-white/90 transition-colors"
          >
            {ctaText}
          </a>
        )}
      </div>
    </section>
  )
}

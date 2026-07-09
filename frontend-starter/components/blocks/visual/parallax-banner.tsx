interface ParallaxBannerProps {
  backgroundImage: string
  title: string
  subtitle?: string
  ctaText?: string
  ctaUrl?: string
  overlayOpacity?: number
  minHeight?: string
}

export function ParallaxBanner({
  backgroundImage,
  title,
  subtitle,
  ctaText,
  ctaUrl,
  overlayOpacity = 0.5,
  minHeight = '400px',
}: ParallaxBannerProps) {
  return (
    <section
      className="relative flex items-center justify-center px-4 py-20"
      style={{
        backgroundImage: `url("${backgroundImage}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        minHeight,
      }}
    >
      {/* iOS does not support background-attachment:fixed — falls back to scroll (static bg). Acceptable. */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }}
      />
      <div className="relative z-10 text-center max-w-3xl">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">{title}</h2>
        {subtitle && <p className="text-white/80 text-lg mb-8">{subtitle}</p>}
        {ctaText && ctaUrl && (
          <a
            href={ctaUrl}
            className="inline-block px-8 py-3 rounded-xl bg-brand text-on-brand font-semibold hover:bg-brand-hover transition-colors"
          >
            {ctaText}
          </a>
        )}
      </div>
    </section>
  )
}

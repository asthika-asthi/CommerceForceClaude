interface GradientTextSectionProps {
  title: string
  subtitle?: string
  ctaText?: string
  ctaUrl?: string
  gradientFrom?: string
  gradientTo?: string
}

export function GradientTextSection({
  title,
  subtitle,
  ctaText,
  ctaUrl,
  gradientFrom,
  gradientTo,
}: GradientTextSectionProps) {
  return (
    <section className="py-20 px-4 text-center bg-bg">
      <div className="max-w-3xl mx-auto">
        <h2
          className="text-5xl md:text-7xl font-extrabold leading-tight mb-6 bg-clip-text text-transparent"
          style={{
            backgroundImage: `linear-gradient(to right, ${gradientFrom ?? 'var(--brand)'}, ${gradientTo ?? 'var(--brand-dark)'})`,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-muted text-lg mb-8 max-w-xl mx-auto leading-relaxed">{subtitle}</p>
        )}
        {ctaText && ctaUrl && (
          <a
            href={ctaUrl}
            className="inline-block px-8 py-3 rounded-xl bg-brand text-white font-semibold hover:bg-brand-hover transition-colors"
          >
            {ctaText}
          </a>
        )}
      </div>
    </section>
  )
}

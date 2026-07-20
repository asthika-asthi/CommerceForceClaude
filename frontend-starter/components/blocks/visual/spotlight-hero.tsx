interface StatChip {
  value: string
  label: string
}

interface SpotlightHeroProps {
  badge?: string
  title: string
  titleAccent?: string
  lead?: string
  subtitle?: string
  primaryCtaText?: string
  primaryCtaUrl?: string
  secondaryCtaText?: string
  secondaryCtaUrl?: string
  statChips?: StatChip[]
  anchorId?: string
}

export function SpotlightHero({
  badge, title, titleAccent, lead, subtitle,
  primaryCtaText, primaryCtaUrl = '#', secondaryCtaText, secondaryCtaUrl = '#',
  statChips = [], anchorId,
}: SpotlightHeroProps) {
  return (
    <section id={anchorId} className="relative overflow-hidden bg-dark-deep py-24 md:py-32 px-6" aria-label="Hero">
      {/* soft brand glow, token-driven */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,var(--brand-shadow),transparent_60%)]" />
      <div className="relative max-w-5xl mx-auto text-center">
        {badge && (
          <span className="inline-flex items-center gap-2 rounded-full border border-dark-border px-4 py-1.5 text-sm font-semibold text-brand-highlight mb-8">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse motion-reduce:animate-none" aria-hidden />
            {badge}
          </span>
        )}
        <h1 className="font-heading text-4xl md:text-6xl font-bold text-on-dark-strong leading-tight tracking-tight">
          {title}
          {titleAccent && <span className="block text-brand-highlight mt-2">{titleAccent}</span>}
        </h1>
        {lead && <p className="mt-6 text-xl text-on-dark max-w-2xl mx-auto">{lead}</p>}
        {subtitle && <p className="mt-4 text-base text-on-dark-muted max-w-2xl mx-auto leading-relaxed">{subtitle}</p>}
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          {primaryCtaText && (
            <a href={primaryCtaUrl} className="rounded-lg bg-brand px-8 py-3.5 font-semibold text-on-brand hover:bg-brand-hover transition-colors">
              {primaryCtaText}
            </a>
          )}
          {secondaryCtaText && (
            <a href={secondaryCtaUrl} className="rounded-lg border border-dark-border px-8 py-3.5 font-semibold text-on-dark-strong hover:border-brand hover:text-brand-highlight transition-colors">
              {secondaryCtaText}
            </a>
          )}
        </div>
        {statChips.length > 0 && (
          <dl className="mt-14 flex flex-wrap justify-center gap-x-10 gap-y-4">
            {statChips.map((chip) => (
              <div key={chip.label} className="text-center">
                <dt className="sr-only">{chip.label}</dt>
                <dd className="font-heading text-lg font-semibold text-brand-highlight">{chip.value}</dd>
                <dd className="text-sm text-on-dark-muted">{chip.label}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  )
}

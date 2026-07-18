interface PricingTier {
  name: string
  tagline?: string
  audience?: string
  pricingBasis?: string
  features?: string[]
  priceNote?: string
  highlight?: boolean
  highlightLabel?: string
  ctaText?: string
  ctaUrl?: string
}

interface PricingTiersProps {
  kicker?: string
  title: string
  subtitle?: string
  tiers: PricingTier[]
  anchorId?: string
}

export function PricingTiers({ kicker, title, subtitle, tiers, anchorId }: PricingTiersProps) {
  return (
    <section id={anchorId} className="py-20 px-6 bg-bg" aria-label="Pricing tiers">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          {kicker && <p className="text-sm font-semibold uppercase tracking-widest text-brand mb-3">{kicker}</p>}
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-fg">{title}</h2>
          {subtitle && <p className="mt-4 text-muted max-w-2xl mx-auto">{subtitle}</p>}
        </div>
        <div className="grid gap-8 md:grid-cols-3 items-stretch">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-2xl border bg-card-bg p-8 ${
                tier.highlight ? 'border-brand shadow-lg' : 'border-border'
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-brand px-4 py-1 text-xs font-bold text-on-brand">
                  {tier.highlightLabel ?? 'Most Popular'}
                </span>
              )}
              <h3 className="font-heading text-xl font-bold text-fg">{tier.name}</h3>
              {tier.tagline && <p className="mt-1 text-sm font-semibold text-brand">{tier.tagline}</p>}
              {tier.audience && <p className="mt-3 text-sm text-muted">{tier.audience}</p>}
              {tier.pricingBasis && <p className="mt-1 text-xs uppercase tracking-wide text-text-placeholder">{tier.pricingBasis}</p>}
              {tier.features && tier.features.length > 0 && (
                <ul className="mt-6 space-y-2.5 text-sm text-fg/90 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <span className="text-brand mt-0.5" aria-hidden>✦</span>
                      <span className="text-muted">{f}</span>
                    </li>
                  ))}
                </ul>
              )}
              {tier.priceNote && <p className="mt-6 font-heading text-lg font-semibold text-fg">{tier.priceNote}</p>}
              {tier.ctaText && (
                <a
                  href={tier.ctaUrl ?? '#'}
                  className={`mt-6 rounded-lg px-6 py-3 text-center font-semibold transition-colors ${
                    tier.highlight
                      ? 'bg-brand text-on-brand hover:bg-brand-hover'
                      : 'border border-border text-fg hover:border-brand hover:text-brand'
                  }`}
                >
                  {tier.ctaText}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

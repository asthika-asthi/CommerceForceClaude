import Link from 'next/link'

interface CtaCard {
  bg?: string
  eyebrow?: string
  title?: string
  body?: string
  features?: string[]
  ctaLabel?: string
  ctaHref?: string
  btnBg?: string
  btnText?: string
}

interface DualCtaBannerProps {
  cards?: CtaCard[]
}

export function DualCtaBanner({ cards = [] }: DualCtaBannerProps) {
  return (
    <section className="py-14 px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-5">
        {cards.map((card, i) => (
          <div
            key={i}
            className="relative rounded-2xl p-10 overflow-hidden"
            style={{ backgroundColor: card.bg ?? '#1B2A4A' }}
          >
            {/* decorative background circle */}
            <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-white opacity-[0.06] pointer-events-none" />

            <div className="relative z-10">
              {card.eyebrow && (
                <p className="text-[11px] font-bold tracking-widest uppercase text-white/75 mb-3">
                  {card.eyebrow}
                </p>
              )}
              {card.title && (
                <h2 className="text-[26px] font-bold text-white leading-tight mb-4">
                  {card.title}
                </h2>
              )}
              {card.body && (
                <p className="text-[14px] text-white/75 leading-relaxed mb-6 max-w-sm">
                  {card.body}
                </p>
              )}
              {card.features && card.features.length > 0 && (
                <ul className="list-none flex flex-wrap gap-2 mb-8 p-0 m-0">
                  {card.features.map((f, j) => (
                    <li
                      key={j}
                      className="text-[12px] font-medium text-white/90 bg-white/10 border border-white/15 rounded-full px-3 py-1"
                    >
                      {f}
                    </li>
                  ))}
                </ul>
              )}
              {card.ctaLabel && (
                <Link
                  href={card.ctaHref ?? '#'}
                  className="inline-block text-[14px] font-bold rounded-lg px-6 py-3 transition-colors hover:opacity-90"
                  style={{
                    backgroundColor: card.btnBg ?? '#FFFFFF',
                    color: card.btnText ?? '#1B2A4A',
                  }}
                >
                  {card.ctaLabel}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

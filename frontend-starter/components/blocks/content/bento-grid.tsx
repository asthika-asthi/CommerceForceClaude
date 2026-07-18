interface BentoCard {
  title: string
  body: string
  image?: string
  linkUrl?: string
  linkText?: string
  size: 'large' | 'small'
}

interface BentoGridProps {
  cards: BentoCard[]
  title?: string
}

export function BentoGrid({ cards, title }: BentoGridProps) {
  const display = cards.slice(0, 4)
  return (
    <section className="py-16 px-4 bg-bg">
      {title && (
        <h2 className="font-heading text-3xl font-bold text-fg text-center mb-10">{title}</h2>
      )}
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-4 auto-rows-[180px]">
        {display.map((card, i) => (
          <div
            key={i}
            className={`rounded-2xl overflow-hidden bg-card-bg border border-border p-6 flex flex-col justify-between ${
              card.size === 'large' ? 'col-span-2 row-span-2' : ''
            }`}
          >
            {card.image && (
              <div className={`overflow-hidden rounded-xl mb-4 ${card.size === 'large' ? 'h-40' : 'h-20'}`}>
                <img src={card.image} alt={card.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1">
              <h3 className={`font-heading font-bold text-fg mb-2 ${card.size === 'large' ? 'text-2xl' : 'text-base'}`}>
                {card.title}
              </h3>
              <p className="text-muted text-sm leading-relaxed line-clamp-3">{card.body}</p>
            </div>
            {card.linkUrl && card.linkText && (
              <a
                href={card.linkUrl}
                className="mt-3 text-brand-dark font-semibold text-sm hover:underline inline-flex items-center gap-1 shrink-0"
              >
                {card.linkText} →
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

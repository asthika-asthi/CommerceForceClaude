interface ShowcaseItem {
  image?: string
  imageAlt?: string
  title: string
  tag?: string
  badge?: string
  comingSoon?: boolean
  comingSoonText?: string
}

interface ShowcaseGalleryProps {
  kicker?: string
  title: string
  subtitle?: string
  items: ShowcaseItem[]
  anchorId?: string
}

export function ShowcaseGallery({ kicker, title, subtitle, items, anchorId }: ShowcaseGalleryProps) {
  return (
    <section id={anchorId} className="py-20 px-6 bg-surface-alt" aria-label="Showcase gallery">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          {kicker && <p className="text-sm font-semibold uppercase tracking-widest text-brand mb-3">{kicker}</p>}
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-fg">{title}</h2>
          {subtitle && <p className="mt-4 text-muted max-w-2xl mx-auto">{subtitle}</p>}
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <figure key={item.title} className="group relative overflow-hidden rounded-2xl border border-border bg-card-bg">
              {item.comingSoon || !item.image ? (
                <div className="aspect-[4/5] flex flex-col items-center justify-center gap-2 p-6 text-center">
                  <span className="font-heading text-lg font-semibold text-brand">{item.title}</span>
                  {item.comingSoonText && <span className="text-sm text-muted">{item.comingSoonText}</span>}
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt={item.imageAlt ?? item.title}
                  className="aspect-[4/5] w-full object-cover transition-transform duration-500 motion-reduce:transition-none group-hover:scale-105"
                  loading="lazy"
                />
              )}
              {!item.comingSoon && item.image && (
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-10">
                  <span className="block font-heading font-semibold text-white">{item.title}</span>
                  {item.tag && <span className="block text-sm text-white/70">{item.tag}</span>}
                </figcaption>
              )}
              {item.badge && (
                <span className="absolute top-3 right-3 rounded-full bg-brand px-3 py-1 text-xs font-bold text-on-brand">
                  {item.badge}
                </span>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

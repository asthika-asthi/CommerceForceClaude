'use client'
import { useEffect, useState } from 'react'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
import { PinchZoomImage } from '@/components/ui/pinch-zoom-image'

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
  /** Layer 1: tap/click opens the item full-screen; Escape or outside-click closes it. */
  zoomable?: boolean
}

export function ShowcaseGallery({ kicker, title, subtitle, items, anchorId, zoomable = false }: ShowcaseGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    if (openIndex === null) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenIndex(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openIndex])

  const openItem = openIndex !== null ? items[openIndex] : null

  return (
    <section id={anchorId} className="py-20 px-6 bg-surface-alt" aria-label="Showcase gallery">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          {kicker && <p className="text-sm font-semibold uppercase tracking-widest text-brand mb-3">{kicker}</p>}
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-fg">{title}</h2>
          {subtitle && <p className="mt-4 text-muted max-w-2xl mx-auto">{subtitle}</p>}
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => {
            const canZoom = zoomable && !item.comingSoon && !!item.image
            return (
              <ScrollReveal key={i} delay={(i % 4) * 0.08} data-testid="showcase-item">
                <figure className="group relative overflow-hidden rounded-2xl border border-border bg-card-bg">
                  {item.comingSoon || !item.image ? (
                    <div className="aspect-[4/5] flex flex-col items-center justify-center gap-2 p-6 text-center">
                      <span className="font-heading text-lg font-semibold text-brand">{item.title}</span>
                      {item.comingSoonText && <span className="text-sm text-muted">{item.comingSoonText}</span>}
                    </div>
                  ) : canZoom ? (
                    <button
                      type="button"
                      onClick={() => setOpenIndex(i)}
                      className="block w-full aspect-[4/5] cursor-zoom-in"
                      aria-label={`Open ${item.title} full size`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image}
                        alt={item.imageAlt ?? item.title}
                        className="h-full w-full object-cover transition-transform duration-500 motion-reduce:transition-none group-hover:scale-105"
                        loading="lazy"
                      />
                    </button>
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
                    <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-10">
                      <span className="block font-heading font-semibold text-white">{item.title}</span>
                      {item.tag && <span className="block text-sm text-white/70">{item.tag}</span>}
                    </figcaption>
                  )}
                  {item.badge && (
                    <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-brand px-3 py-1 text-xs font-bold text-on-brand">
                      {item.badge}
                    </span>
                  )}
                </figure>
              </ScrollReveal>
            )
          })}
        </div>
      </div>

      {openItem?.image && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${openItem.title} — zoomed view`}
          onClick={() => setOpenIndex(null)}
          data-testid="zoom-overlay"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setOpenIndex(null)
            }}
            className="absolute top-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white hover:bg-white/20"
            aria-label="Close zoomed view"
            data-testid="zoom-close"
          >
            ×
          </button>
          <div onClick={(e) => e.stopPropagation()}>
            <PinchZoomImage src={openItem.image} alt={openItem.imageAlt ?? openItem.title} />
          </div>
        </div>
      )}
    </section>
  )
}

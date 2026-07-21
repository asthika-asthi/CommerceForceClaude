'use client'
import Image from 'next/image'
import { ScrollReveal } from '@/components/ui/scroll-reveal'

interface SplitImageTextProps {
  image: string
  imageAlt: string
  title: string
  body: string
  ctaText?: string
  ctaUrl?: string
  imagePosition?: 'left' | 'right'
}

export function SplitImageText({
  image,
  imageAlt,
  title,
  body,
  ctaText,
  ctaUrl,
  imagePosition = 'left',
}: SplitImageTextProps) {
  return (
    <section className="py-16 px-4 bg-bg">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <ScrollReveal data-testid="split-image-panel" className={imagePosition === 'right' ? 'md:order-last' : ''}>
          <div className="relative rounded-2xl overflow-hidden aspect-square bg-slate-100">
            <Image src={image} alt={imageAlt} fill unoptimized sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          </div>
        </ScrollReveal>
        <ScrollReveal data-testid="split-text-panel" delay={0.15}>
          <h2 className="text-3xl md:text-4xl font-bold text-fg mb-4 leading-tight">{title}</h2>
          <p className="text-muted text-base leading-relaxed mb-8">{body}</p>
          {ctaText && ctaUrl && (
            <a
              href={ctaUrl}
              className="inline-block px-6 py-3 rounded-xl bg-brand text-on-brand font-semibold hover:bg-brand-hover transition-colors"
            >
              {ctaText}
            </a>
          )}
        </ScrollReveal>
      </div>
    </section>
  )
}

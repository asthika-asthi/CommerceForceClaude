'use client'
import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { GlowButton } from '@/components/ui/shiny-button'

interface CTABannerProps {
  title: string
  subtitle?: string
  ctaText?: string
  ctaUrl?: string
  backgroundImage?: string
}

export function CTABanner({
  title,
  subtitle,
  ctaText = 'Shop Now',
  ctaUrl = '/products',
  backgroundImage,
}: CTABannerProps) {
  const ref = useRef<HTMLElement>(null)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  // Parallax: background moves at a slower rate than the scroll
  const bgY = useTransform(scrollYProgress, [0, 1], ['-15%', '15%'])

  // Content fade-in as section enters viewport
  const contentOpacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0])
  const contentY = useTransform(scrollYProgress, [0, 0.2], [30, 0])

  return (
    <section
      ref={ref}
      className="relative py-32 overflow-hidden"
      aria-label="Call to action"
    >
      {/* Parallax background layer */}
      <motion.div
        className="absolute inset-[-20%] z-0"
        style={{ y: bgY }}
      >
        {backgroundImage ? (
          <div
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url("${backgroundImage}")` }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand-dark via-slate-800 to-slate-950" />
        )}
      </motion.div>

      {/* Dark overlay */}
      <div className="absolute inset-0 z-10 bg-black/55" />

      {/* Content */}
      <motion.div
        className="relative z-20 max-w-4xl mx-auto px-6 text-center"
        style={{ opacity: contentOpacity, y: contentY }}
      >
        {/* Decorative top rule */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-px w-16 bg-brand/50" />
          <div className="w-2 h-2 rounded-full bg-brand" />
          <div className="h-px w-16 bg-brand/50" />
        </div>

        <h2 className="text-4xl md:text-6xl font-extrabold text-white leading-tight tracking-tight mb-6">
          {title}
        </h2>

        {subtitle && (
          <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            {subtitle}
          </p>
        )}

        {/* CTA button */}
        <GlowButton href={ctaUrl}>{ctaText}</GlowButton>
      </motion.div>

      {/* Bottom decorative gradient bleed */}
      <div className="absolute inset-x-0 bottom-0 h-16 z-10 bg-gradient-to-t from-bg/30 to-transparent pointer-events-none" />
    </section>
  )
}

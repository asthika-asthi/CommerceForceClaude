'use client'
import type { ReactNode } from 'react'
import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'

interface ScrollExpandHeroProps {
  mediaType?: 'video' | 'image'
  mediaSrc: string
  posterSrc?: string
  bgImageSrc?: string
  background?: string
  title: string
  eyebrow?: string | { text?: string; [key: string]: unknown }
  subtitle?: string
  date?: string
  scrollToExpand?: string
  textBlend?: boolean
  children?: ReactNode
}

export function ScrollExpandHero({
  mediaType = 'image',
  mediaSrc,
  posterSrc,
  bgImageSrc,
  background = '#0f172a',
  title,
  eyebrow,
  subtitle,
  date,
  scrollToExpand = 'Scroll to explore',
  textBlend = false,
  children,
}: ScrollExpandHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  })

  // Media container: width 60% → 100%, borderRadius 16px → 0px
  const mediaWidth = useTransform(scrollYProgress, [0, 0.6], ['60%', '100%'])
  const mediaBorderRadius = useTransform(scrollYProgress, [0, 0.5], [16, 0])

  // Title: fades/slides up slightly as scroll progresses
  const titleY = useTransform(scrollYProgress, [0, 0.4], [0, -30])
  const titleOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0])

  // Hint text fades out early
  const hintOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0])

  return (
    <div
      ref={containerRef}
      className="relative min-h-[150vh]"
      style={
        bgImageSrc
          ? { backgroundImage: `url("${bgImageSrc}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { backgroundColor: background }
      }
    >
      {/* Sticky viewport-filling section */}
      <div className="sticky top-0 h-screen overflow-hidden flex flex-col items-center justify-center" style={{ backgroundColor: background }}>
        {/* Background tint */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Title block — above media */}
        <motion.div
          className="relative z-20 text-center px-6 mb-8 pointer-events-none max-w-3xl"
          style={{ y: titleY, opacity: titleOpacity }}
        >
          {(eyebrow || date) && (
            <p className="text-white/70 text-xs font-semibold uppercase tracking-[0.8px] mb-4">
              {typeof eyebrow === 'object' ? eyebrow?.text : (eyebrow ?? date)}
            </p>
          )}
          <h1
            className={`text-4xl md:text-6xl font-extrabold leading-tight tracking-tight mb-4 ${
              textBlend ? 'mix-blend-overlay text-white' : 'text-white'
            }`}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-white/70 text-base md:text-lg leading-relaxed max-w-xl mx-auto">
              {subtitle}
            </p>
          )}
        </motion.div>

        {/* Expanding media container */}
        <motion.div
          className="relative z-10 overflow-hidden"
          style={{
            width: mediaWidth,
            borderRadius: mediaBorderRadius,
          }}
        >
          <div className="relative aspect-video w-full">
            {mediaType === 'video' ? (
              <video
                src={mediaSrc}
                poster={posterSrc}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={mediaSrc}
                alt={title}
                className="w-full h-full object-cover"
              />
            )}

            {/* Bottom gradient overlay on media */}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
          </div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2"
          style={{ opacity: hintOpacity }}
        >
          <p className="text-white/70 text-sm tracking-widest uppercase">{scrollToExpand}</p>
          <motion.div
            className="w-0.5 h-8 bg-white/40 rounded-full origin-top"
            animate={{ scaleY: [1, 0.4, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </div>

      {/* Content revealed below sticky section */}
      {children && (
        <div className="relative z-10 bg-bg">
          {children}
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react'

interface Testimonial {
  name: string
  role?: string
  quote: string
  avatar?: string
}

interface TestimonialsCarouselProps {
  title?: string
  subtitle?: string
  testimonials: Testimonial[]
  autoAdvanceMs?: number
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ')
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : parts[0].slice(0, 2)
  return (
    <div className="w-14 h-14 rounded-full bg-brand/20 border-2 border-brand flex items-center justify-center text-brand font-bold text-lg uppercase select-none">
      {initials}
    </div>
  )
}

export function TestimonialsCarousel({
  title = 'What Our Customers Say',
  subtitle,
  testimonials,
  autoAdvanceMs = 4000,
}: TestimonialsCarouselProps) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [paused, setPaused] = useState(false)

  const count = testimonials.length

  const go = useCallback(
    (next: number) => {
      const wrapped = ((next % count) + count) % count
      setDirection(next > index ? 1 : -1)
      setIndex(wrapped)
    },
    [index, count]
  )

  const next = useCallback(() => go(index + 1), [go, index])
  const prev = useCallback(() => go(index - 1), [go, index])

  useEffect(() => {
    if (paused || count < 2) return
    const id = setTimeout(next, autoAdvanceMs)
    return () => clearTimeout(id)
  }, [index, paused, autoAdvanceMs, next, count])

  if (count === 0) return null

  const current = testimonials[index]

  return (
    <section
      className="py-24 px-4 bg-slate-900 text-white overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3">{title}</h2>
          {subtitle && (
            <p className="text-slate-400 text-lg max-w-xl mx-auto">{subtitle}</p>
          )}
        </div>

        {/* Carousel */}
        <div className="relative flex items-center gap-4">
          {/* Prev */}
          <button
            onClick={prev}
            aria-label="Previous testimonial"
            className="shrink-0 w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center text-slate-400 hover:border-brand hover:text-brand transition-colors"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Card area */}
          <div className="flex-1 overflow-hidden min-h-[280px] flex items-center">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={index}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: 'easeInOut' }}
                className="w-full"
              >
                <div className="bg-slate-800/60 border border-slate-700 rounded-3xl px-8 py-10 text-center">
                  {/* Quote icon */}
                  <div className="flex justify-center mb-5">
                    <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
                      <Quote size={18} className="text-brand" />
                    </div>
                  </div>

                  {/* Quote text */}
                  <blockquote className="text-xl md:text-2xl font-light leading-relaxed text-slate-100 italic mb-8">
                    &ldquo;{current.quote}&rdquo;
                  </blockquote>

                  {/* Author */}
                  <div className="flex flex-col items-center gap-3">
                    {current.avatar ? (
                      <img
                        src={current.avatar}
                        alt={current.name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-brand"
                      />
                    ) : (
                      <Initials name={current.name} />
                    )}
                    <div>
                      <p className="font-semibold text-white">{current.name}</p>
                      {current.role && (
                        <p className="text-sm text-slate-400">{current.role}</p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Next */}
          <button
            onClick={next}
            aria-label="Next testimonial"
            className="shrink-0 w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center text-slate-400 hover:border-brand hover:text-brand transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Dot indicators */}
        {count > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                aria-label={`Go to testimonial ${i + 1}`}
                className={`rounded-full transition-all ${
                  i === index
                    ? 'w-6 h-2 bg-brand'
                    : 'w-2 h-2 bg-slate-600 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

'use client'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

interface ScrollRevealProps extends Omit<ComponentPropsWithoutRef<'div'>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
  children: ReactNode
  /** Stagger delay in seconds — pass `index * 0.08` for a grid of siblings. */
  delay?: number
}

/**
 * Fades and slides content up the first time it scrolls into view. Renders
 * content immediately visible, with no animation, when the visitor prefers
 * reduced motion. Any other props (className, data-testid, etc.) pass
 * straight through to the wrapping element.
 */
export function ScrollReveal({ children, delay = 0, ...rest }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      ref={ref}
      {...rest}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
      animate={prefersReducedMotion ? false : (isInView ? { opacity: 1, y: 0 } : undefined)}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

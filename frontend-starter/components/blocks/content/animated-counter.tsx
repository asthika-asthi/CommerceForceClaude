'use client'
import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'

interface Stat {
  value: number
  label: string
  prefix?: string
  suffix?: string
}

interface AnimatedCounterProps {
  stats: Stat[]
  title?: string
}

function Counter({ value, prefix = '', suffix = '' }: Pick<Stat, 'value' | 'prefix' | 'suffix'>) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (!isInView) return
    let current = 0
    const duration = 1500
    const intervalMs = 16
    const increment = value / (duration / intervalMs)
    const timer = setInterval(() => {
      current += increment
      if (current >= value) {
        setCount(value)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, intervalMs)
    return () => clearInterval(timer)
  }, [isInView, value])

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>
}

export function AnimatedCounter({ stats, title }: AnimatedCounterProps) {
  const display = stats.slice(0, 4)
  return (
    <section className="py-16 px-4 bg-bg">
      <div className="max-w-5xl mx-auto">
        {title && (
          <h2 className="text-3xl font-bold text-fg text-center mb-12">{title}</h2>
        )}
        <div className={`grid gap-8 text-center grid-cols-2 ${display.length >= 3 ? 'md:grid-cols-4' : 'md:grid-cols-2'}`}>
          {display.map((stat, i) => (
            <div key={i}>
              <div className="text-4xl md:text-5xl font-extrabold text-brand-dark mb-2">
                <Counter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
              </div>
              <p className="text-muted text-sm font-medium uppercase tracking-wide">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

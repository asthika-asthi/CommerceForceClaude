'use client'
import Link from 'next/link'

interface ButtonDef {
  label: string
  url: string
  variant?: 'primary' | 'secondary' | 'outline'
}

interface ButtonGroupProps {
  buttons?: ButtonDef[]
  alignment?: 'left' | 'center' | 'right'
}

export function ButtonGroup({ buttons = [], alignment = 'center' }: ButtonGroupProps) {
  const alignClass =
    alignment === 'right' ? 'justify-end' :
    alignment === 'left'  ? 'justify-start' :
    'justify-center'

  return (
    <section className="py-10 px-4">
      <div className={`flex flex-wrap gap-4 ${alignClass}`}>
        {buttons.map((btn, i) => (
          <Link
            key={i}
            href={btn.url}
            className={
              btn.variant === 'outline'
                ? 'px-6 py-3 rounded-xl border-2 border-brand text-brand font-semibold hover:bg-brand/10 transition-colors'
                : btn.variant === 'secondary'
                ? 'px-6 py-3 rounded-xl bg-brand-secondary text-white font-semibold hover:opacity-90 transition-opacity'
                : 'px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover text-on-brand font-semibold transition-colors'
            }
          >
            {btn.label}
          </Link>
        ))}
      </div>
    </section>
  )
}

interface MarqueeTickerProps {
  items: string[]
  speed?: number
  backgroundColor?: string
  textColor?: string
  separator?: string
}

export function MarqueeTicker({
  items,
  speed = 40,
  backgroundColor,
  textColor,
  separator = '·',
}: MarqueeTickerProps) {
  if (!items || items.length === 0) return null
  const doubled = [...items, ...items]
  const duration = `${Math.max(5, Math.round(items.length * (80 / speed)))}s`

  return (
    <div
      className="overflow-hidden py-3 whitespace-nowrap"
      style={{
        backgroundColor: backgroundColor ?? 'var(--brand-dark)',
        color: textColor ?? '#ffffff',
      }}
    >
      <div
        className="inline-flex items-center"
        style={{ animation: `cf-marquee ${duration} linear infinite` }}
      >
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center">
            <span className="text-sm font-medium tracking-wide px-4">{item}</span>
            <span className="opacity-40 text-sm">{separator}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

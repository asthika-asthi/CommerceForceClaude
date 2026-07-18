interface TrustItem {
  icon: string
  heading: string
  subtext?: string
}

interface TrustStripProps {
  items?: TrustItem[]
}

export function TrustStrip({ items = [] }: TrustStripProps) {
  return (
    <div className="bg-card-bg border-b border-border">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap justify-between gap-4">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-brand-tint text-xl">
              {item.icon}
            </span>
            <div>
              <p className="text-[13px] font-semibold text-brand-dark leading-tight">{item.heading}</p>
              {item.subtext && (
                <p className="text-[11px] text-muted leading-tight">{item.subtext}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

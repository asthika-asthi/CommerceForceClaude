import Link from 'next/link'

interface TableRow {
  product: string
  category?: string
  sizes?: string
  useCase?: string
  availability?: string
}

interface StatusConfig {
  label: string
  color: string
  bg: string
}

interface ProductRangeTableProps {
  title?: string
  seeAllLabel?: string
  seeAllHref?: string
  columns?: string[]
  rows?: TableRow[]
  statusInStock?: StatusConfig
  statusLimited?: StatusConfig
}

export function ProductRangeTable({
  title,
  seeAllLabel,
  seeAllHref,
  columns = ['Product', 'Category', 'Sizes / Variants', 'Use case', 'Availability'],
  rows = [],
  statusInStock = { label: 'In stock', color: '#059669', bg: '#D1FAE5' },
  statusLimited = { label: 'Limited qty', color: '#D97706', bg: '#FEF3C7' },
}: ProductRangeTableProps) {
  return (
    <section className="py-14 px-6 bg-bg">
      <div className="max-w-6xl mx-auto">
        {(title || seeAllLabel) && (
          <div className="flex items-center justify-between mb-8">
            {title && (
              <h2 className="text-2xl font-bold text-brand-dark">{title}</h2>
            )}
            {seeAllLabel && seeAllHref && (
              <Link
                href={seeAllHref}
                className="text-[13px] font-semibold text-brand hover:underline"
              >
                {seeAllLabel}
              </Link>
            )}
          </div>
        )}
        <div className="bg-card-bg border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-brand-dark">
                  {columns.map((col, i) => (
                    <th
                      key={i}
                      className="text-left px-5 py-3.5 text-[12px] font-semibold text-on-dark-strong tracking-wide uppercase whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const isLimited = row.availability === 'limited'
                  const status = isLimited ? statusLimited : statusInStock
                  return (
                    <tr
                      key={i}
                      className="border-b border-border-subtle hover:bg-brand-tint transition-colors"
                      style={{ backgroundColor: i % 2 === 1 ? 'var(--surface-alt)' : 'var(--card-bg)' }}
                    >
                      <td className="px-5 py-3 font-semibold text-brand-dark whitespace-nowrap">{row.product}</td>
                      <td className="px-5 py-3 text-muted whitespace-nowrap">{row.category}</td>
                      <td className="px-5 py-3 text-muted whitespace-nowrap">{row.sizes}</td>
                      <td className="px-5 py-3 text-muted">{row.useCase}</td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span
                          className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                          style={{ color: status.color, backgroundColor: status.bg }}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

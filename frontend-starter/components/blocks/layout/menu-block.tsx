'use client'
interface MenuItem {
  label: string
  url: string
  children?: Array<{ label: string; url: string }>
}

interface MenuBlockProps {
  title?: string
  items?: MenuItem[]
  layout?: 'horizontal' | 'vertical' | 'grid'
}

export function MenuBlock({ title, items = [], layout = 'horizontal' }: MenuBlockProps) {
  const wrapClass =
    layout === 'vertical' ? 'flex flex-col gap-2' :
    layout === 'grid'     ? 'grid grid-cols-2 md:grid-cols-4 gap-4' :
    'flex flex-wrap gap-6'

  return (
    <section className="py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {title && <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">{title}</h3>}
        <ul className={wrapClass}>
          {items.map((item, i) => (
            <li key={i}>
              <a href={item.url} className="text-sm font-medium text-fg hover:text-brand-dark transition-colors">
                {item.label}
              </a>
              {item.children && item.children.length > 0 && (
                <ul className="mt-1 ml-3 space-y-1">
                  {item.children.map((child, j) => (
                    <li key={j}>
                      <a href={child.url} className="text-xs text-muted hover:text-brand-dark transition-colors">
                        {child.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

import Link from 'next/link'

interface Category {
  id?: string
  name: string
  href?: string
  icon?: string
  imgGradient?: string
  productCount?: number
  description?: string
  cta?: string
}

interface CategoryGridProps {
  title?: string
  seeAllLabel?: string
  seeAllHref?: string
  categories?: Category[]
}

export function CategoryGrid({
  title,
  seeAllLabel,
  seeAllHref,
  categories = [],
}: CategoryGridProps) {
  return (
    <section className="py-14 px-6 bg-[#F5F5F3]">
      <div className="max-w-6xl mx-auto">
        {(title || seeAllLabel) && (
          <div className="flex items-center justify-between mb-8">
            {title && (
              <h2 className="text-2xl font-bold text-[#1B2A4A]">{title}</h2>
            )}
            {seeAllLabel && seeAllHref && (
              <Link
                href={seeAllHref}
                className="text-[13px] font-semibold text-[#C8102E] hover:underline"
              >
                {seeAllLabel}
              </Link>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((cat, i) => (
            <Link
              key={i}
              href={cat.href ?? '/products'}
              className="group bg-white border border-[#E0DED8] rounded-xl overflow-hidden
                         hover:border-[#C8102E] hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
            >
              <div
                className="h-32 flex items-center justify-center text-5xl"
                style={{ background: cat.imgGradient ?? 'linear-gradient(135deg,#f0f0f0,#e0e0e0)' }}
              >
                {cat.icon}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-bold text-[#1B2A4A] text-[15px] leading-tight">{cat.name}</h3>
                  {cat.productCount != null && (
                    <span className="text-[10px] font-semibold text-[#5C5C5C] whitespace-nowrap flex-shrink-0 mt-0.5">
                      {cat.productCount} items
                    </span>
                  )}
                </div>
                {cat.description && (
                  <p className="text-[12px] text-[#5C5C5C] leading-snug mb-3 line-clamp-2">{cat.description}</p>
                )}
                {cat.cta && (
                  <p className="text-[12px] font-semibold text-[#C8102E] group-hover:underline">{cat.cta}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

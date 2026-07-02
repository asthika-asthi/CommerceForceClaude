import Link from "next/link"
import type { Category } from "@/lib/types"

const CAT_STYLES: Record<string, { emoji: string; bg: string }> = {
  tarpaulins: { emoji: "🛡️", bg: "linear-gradient(135deg,#E8F4FD,#C8E6FA)" },
  "dust-sheets": { emoji: "🧹", bg: "linear-gradient(135deg,#FFF8E1,#FFF0C0)" },
  "sacks-bags": { emoji: "🪣", bg: "linear-gradient(135deg,#F3E5F5,#E1BEE7)" },
  "paint-brushes": { emoji: "🖌️", bg: "linear-gradient(135deg,#E8F5E9,#C8E6C9)" },
}

const FALLBACK_STYLES = [
  { emoji: "🛡️", bg: "linear-gradient(135deg,#E8F4FD,#C8E6FA)" },
  { emoji: "📦", bg: "linear-gradient(135deg,#FFF8E1,#FFF0C0)" },
  { emoji: "🪣", bg: "linear-gradient(135deg,#F3E5F5,#E1BEE7)" },
  { emoji: "🔧", bg: "linear-gradient(135deg,#E8F5E9,#C8E6C9)" },
]

interface Props {
  categories: Category[]
}

export function CategoryGrid({ categories }: Props) {
  const display = categories.slice(0, 4)

  return (
    <div className="max-w-[1280px] mx-auto px-10 py-14">
      <div className="flex justify-between items-baseline mb-8">
        <h2 className="text-[26px] font-bold text-brand-dark">
          Shop by <span className="text-brand">product range</span>
        </h2>
        <Link href="/products" className="text-[13px] font-semibold text-brand flex items-center gap-1 hover:text-brand-hover transition-colors">
          All categories →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {display.map((cat, i) => {
          const style = CAT_STYLES[cat.slug] ?? FALLBACK_STYLES[i % 4]
          return (
            <Link
              key={cat.id}
              href={`/products?category=${cat.id}`}
              className="bg-white border border-[#E0DED8] rounded-xl overflow-hidden hover:border-brand hover:shadow-[0_4px_20px_rgba(200,16,46,0.12)] hover:-translate-y-0.5 transition-all group"
            >
              <div className="h-40 flex items-center justify-center text-[64px] relative overflow-hidden" style={cat.image_url ? {} : { background: style.bg }}>
                {cat.image_url ? (
                  <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                ) : (
                  style.emoji
                )}
                <span className="absolute top-2.5 right-2.5 bg-white/90 text-[#5C5C5C] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#E0DED8]">
                  products
                </span>
              </div>
              <div className="p-4">
                <div className="text-base font-bold text-brand-dark mb-1">{cat.name}</div>
                <div className="text-[12px] text-[#5C5C5C] leading-[1.55] mb-3">
                  Quality {cat.name.toLowerCase()} for trade and retail.
                </div>
                <div className="text-[12px] font-semibold text-brand flex items-center gap-1 group-hover:gap-2 transition-all">
                  Browse {cat.name.toLowerCase()} →
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

"use client"
import Link from "next/link"
import Image from "next/image"
import type { Category } from "@/lib/types"

function resolveImageUrl(url: string): string {
  if (url.startsWith("/")) {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
    return `${base}${url}`
  }
  return url
}

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
  title?: string
  titleHighlight?: string
}

export function CategoryGrid({ categories, title = "Shop by", titleHighlight = "product range" }: Props) {
  const display = categories.slice(0, 4)

  return (
    <div className="max-w-[1280px] mx-auto px-10 py-14">
      <div className="flex justify-between items-baseline mb-8">
        <h2 className="text-[26px] font-bold text-brand-dark">
          {title} <span className="text-brand">{titleHighlight}</span>
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
              className="bg-white border border-border rounded-xl overflow-hidden hover:border-brand hover:shadow-[0_4px_20px_var(--brand-shadow)] hover:-translate-y-0.5 transition-all group"
            >
              <div className="h-40 relative overflow-hidden flex items-center justify-center text-[64px]" style={{ background: style.bg }}>
                {/* Emoji always rendered as background fallback */}
                {style.emoji}
                {/* Image overlaid on top — hidden via onError if URL is broken */}
                {cat.image_url && (
                  <Image
                    src={resolveImageUrl(cat.image_url)}
                    alt=""
                    fill
                    unoptimized
                    sizes="(min-width: 768px) 25vw, 50vw"
                    className="object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                  />
                )}
                <span className="absolute top-2.5 right-2.5 bg-white/90 text-muted text-[10px] font-semibold px-2 py-0.5 rounded-full border border-border">
                  products
                </span>
              </div>
              <div className="p-4">
                <div className="text-base font-bold text-brand-dark mb-1">{cat.name}</div>
                <div className="text-[12px] text-muted leading-[1.55] mb-3">
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

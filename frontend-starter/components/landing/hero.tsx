import Link from "next/link"
import type { Product } from "@/lib/types"

const HERO_ICONS: Record<string, string> = {
  tarpaulin: "🛡️",
  "dust-sheet": "🧹",
  sack: "🪣",
  brush: "🖌️",
}

const HERO_ICON_BG: Record<string, string> = {
  tarpaulin: "#E8F4FD",
  "dust-sheet": "#FFF8E1",
  sack: "#F3E5F5",
  brush: "#E8F5E9",
}

const PRODUCT_TAGS = ["Best seller", "Trade fave", "In stock", "New range"]

interface Props {
  bestSellers?: Product[]
}

export function Hero({ bestSellers = [] }: Props) {
  const svgBg = `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C%2Fsvg%3E")`

  const placeholderProducts = [
    { name: "Extra Strong PVC Tarpaulin", meta: "Multiple sizes · Blue & Green", icon: "🛡️", iconBg: "#E8F4FD", tag: "Best seller" },
    { name: "Calico Cotton Dust Sheet 12×9ft", meta: "100% cotton · 10 per bale", icon: "🟡", iconBg: "#FFF8E1", tag: "Trade fave" },
    { name: "Heavy Duty Rubble Sacks", meta: "Bulk packs · Various sizes", icon: "🪣", iconBg: "#F3E5F5", tag: "In stock" },
    { name: "Paint Brush & Roller Sets", meta: "Emulsion, gloss, mixed packs", icon: "🖌️", iconBg: "#E8F5E9", tag: "New range" },
  ]

  const displayProducts = bestSellers.length > 0
    ? bestSellers.slice(0, 4).map((p, i) => ({
        name: p.name,
        meta: p.description?.slice(0, 40) ?? "",
        icon: placeholderProducts[i % 4].icon,
        iconBg: placeholderProducts[i % 4].iconBg,
        tag: PRODUCT_TAGS[i % 4],
        slug: p.slug,
      }))
    : placeholderProducts.map(p => ({ ...p, slug: undefined }))

  return (
    <div
      className="relative overflow-hidden min-h-[500px] flex items-center"
      style={{ backgroundColor: "#1B2A4A", backgroundImage: svgBg }}
    >
      {/* Diagonal red bar */}
      <div
        className="absolute right-0 top-0 bottom-0 w-[38%] bg-brand"
        style={{ clipPath: "polygon(12% 0, 100% 0, 100% 100%, 0 100%)" }}
      />

      <div className="max-w-[1280px] mx-auto px-10 py-[60px] relative z-10 grid grid-cols-[1fr_420px] gap-[60px] items-center w-full">

        {/* Left: content */}
        <div>
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-[14px] py-[5px] text-[11px] text-[#CBD8EE] tracking-[0.8px] uppercase mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] inline-block" />
            Sourced from Europe, India &amp; Far East · Est. 1995
          </div>

          <h1 className="text-[42px] font-bold text-white leading-[1.18] mb-4">
            Quality protective<br />covers at <em className="text-[#ffb3bf] not-italic">trade prices</em>
          </h1>

          <p className="text-[#A8BDD8] text-base leading-[1.65] mb-8 max-w-[440px]">
            Tri Star UK Ltd — Hertfordshire&apos;s leading importer and distributor of tarpaulins, cotton dust sheets, sacks, bags, and decorating supplies. Trade and retail welcome.
          </p>

          <div className="flex gap-3 flex-wrap mb-10">
            <Link href="/products" className="bg-brand hover:bg-brand-hover text-white font-semibold px-7 py-3.5 text-[15px] rounded-lg transition-colors">
              Shop all products
            </Link>
            <a href="/price-list" className="bg-transparent text-white border-[1.5px] border-white/40 hover:border-white hover:bg-white/8 font-medium px-7 py-3.5 text-[15px] rounded-lg transition-all">
              Download price list
            </a>
          </div>

          <div className="flex gap-6 flex-wrap">
            {["30 years' experience", "Trade & retail pricing", "UK-wide delivery", "Superior quality sourcing"].map(item => (
              <div key={item} className="flex items-center gap-2 text-[13px] text-[#A8BDD8]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2.5" className="flex-shrink-0">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Right: best sellers card */}
        <div className="bg-white rounded-xl p-7 shadow-[0_8px_40px_rgba(0,0,0,0.25)]">
          <div className="text-[13px] font-bold text-[#5C5C5C] uppercase tracking-[0.6px] mb-4 pb-3 border-b border-[#E0DED8]">
            🔥 Best selling products
          </div>

          {displayProducts.map((p, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-[#F0EEEA] last:border-none hover:bg-[#FDF0F2] rounded-md pl-1 cursor-pointer transition-colors">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: p.iconBg }}>
                {p.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-brand-dark leading-tight">{p.name}</div>
                <div className="text-[12px] text-[#5C5C5C] truncate">{p.meta}</div>
              </div>
              <span className="text-[11px] font-semibold text-brand bg-[#FDF0F2] px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">{p.tag}</span>
            </div>
          ))}

          <div className="mt-4 pt-3.5 border-t border-[#E0DED8] flex justify-between items-center">
            <span className="text-[12px] text-[#5C5C5C]">Login to see trade prices</span>
            <Link href="/register" className="text-[13px] font-semibold text-brand hover:text-brand-hover transition-colors">
              Register for trade →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

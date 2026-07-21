import Link from "next/link"
import Image from "next/image"
import type { Product } from "@/lib/types"

function resolveImageUrl(url: string): string {
  if (url.startsWith("/")) {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
    return `${base}${url}`
  }
  return url
}

const PRODUCT_TAGS = ["Best seller", "Trade fave", "In stock", "New range"]
const PRODUCT_ICONS = ["🛡️", "🧹", "🪣", "🖌️"]
const PRODUCT_ICON_BGS = ["#E8F4FD", "#FFF8E1", "#F3E5F5", "#E8F5E9"]

interface Props {
  bestSellers?: Product[]
  /** Superadmin switch (landing-page.config.json → homepage.showBestSellersCard) */
  showBestSellersCard?: boolean
  title?: string
  titleHighlight?: string
  subtitle?: string
}

export function Hero({
  bestSellers = [],
  showBestSellersCard = true,
  title = "Quality protective",
  titleHighlight = "trade prices",
  subtitle = "Tri Star UK Ltd — Hertfordshire's leading importer and distributor of tarpaulins, cotton dust sheets, sacks, bags, and decorating supplies. Trade and retail welcome.",
}: Props) {
  const svgBg = `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C%2Fsvg%3E")`

  const displayProducts = bestSellers.slice(0, 4).map((p, i) => {
    const rawImage = p.primary_image ?? p.images?.[0]?.url ?? null
    return {
      name: p.name,
      meta: p.description?.slice(0, 45) ?? "",
      image: rawImage ? resolveImageUrl(rawImage) : null,
      icon: PRODUCT_ICONS[i % 4],
      iconBg: PRODUCT_ICON_BGS[i % 4],
      tag: PRODUCT_TAGS[i % 4],
      slug: p.slug,
    }
  })

  return (
    <div
      className="relative overflow-hidden min-h-[500px] flex items-center"
      style={{ backgroundColor: "var(--brand-dark)", backgroundImage: svgBg }}
    >
      {/* Diagonal red bar */}
      <div
        className="absolute right-0 top-0 bottom-0 w-[38%] bg-brand"
        style={{ clipPath: "polygon(12% 0, 100% 0, 100% 100%, 0 100%)" }}
      />

      <div className={`max-w-[1280px] mx-auto px-10 py-[60px] relative z-10 grid gap-[60px] items-center w-full ${showBestSellersCard ? "grid-cols-[1fr_420px]" : "grid-cols-1"}`}>

        {/* Left: content */}
        <div>
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-[14px] py-[5px] text-[11px] text-on-dark-strong tracking-[0.8px] uppercase mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] inline-block" />
            Sourced from Europe, India &amp; Far East · Est. 1995
          </div>

          <h1 className="text-[42px] font-bold text-white leading-[1.18] mb-4">
            {title}<br />covers at <em className="text-brand-highlight not-italic">{titleHighlight}</em>
          </h1>

          <p className="text-on-dark text-base leading-[1.65] mb-8 max-w-[440px]">
            {subtitle}
          </p>

          <div className="flex gap-3 flex-wrap mb-10">
            <Link href="/products" className="bg-brand hover:bg-brand-hover text-on-brand font-semibold px-7 py-3.5 text-[15px] rounded-lg transition-colors">
              Shop all products
            </Link>
            <a href="/price-list" className="bg-transparent text-white border-[1.5px] border-white/40 hover:border-white hover:bg-white/8 font-medium px-7 py-3.5 text-[15px] rounded-lg transition-all">
              Download price list
            </a>
          </div>

          <div className="flex gap-6 flex-wrap">
            {["30 years' experience", "Trade & retail pricing", "UK-wide delivery", "Superior quality sourcing"].map(item => (
              <div key={item} className="flex items-center gap-2 text-[13px] text-on-dark">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2.5" className="flex-shrink-0">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Right: best sellers card (superadmin switch: homepage.showBestSellersCard) */}
        {showBestSellersCard && (
        <div className="bg-white rounded-xl p-7 shadow-[0_8px_40px_rgba(0,0,0,0.25)]">
          <div className="text-[13px] font-bold text-muted uppercase tracking-[0.6px] mb-4 pb-3 border-b border-border">
            🔥 Best selling products
          </div>

          {displayProducts.length > 0 ? (
            displayProducts.map((p, i) => (
              <Link
                key={i}
                href={p.slug ? `/products/${p.slug}` : "/products"}
                className="flex items-center gap-3 py-2.5 border-b border-border-subtle last:border-none hover:bg-brand-tint rounded-md pl-1 transition-colors"
              >
                <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl flex-shrink-0 overflow-hidden" style={{ backgroundColor: p.iconBg }}>
                  {p.image ? (
                    <Image src={p.image} alt={p.name} width={44} height={44} unoptimized className="w-full h-full object-cover" />
                  ) : (
                    p.icon
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-brand-dark leading-tight">{p.name}</div>
                  {p.meta && <div className="text-[12px] text-muted truncate">{p.meta}</div>}
                </div>
                <span className="text-[11px] font-semibold text-brand bg-brand-tint px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">{p.tag}</span>
              </Link>
            ))
          ) : (
            <div className="py-6 text-center">
              <div className="text-4xl mb-3">🛡️</div>
              <p className="text-[14px] text-muted mb-4">Tarpaulins, dust sheets, sacks, bags &amp; more</p>
              <Link href="/products" className="inline-block bg-brand text-on-brand text-[13px] font-semibold px-5 py-2.5 rounded-lg hover:bg-brand-hover transition-colors">
                Browse full range →
              </Link>
            </div>
          )}

          <div className="mt-4 pt-3.5 border-t border-border flex justify-between items-center">
            <span className="text-[12px] text-muted">Login to see trade prices</span>
            <Link href="/register" className="text-[13px] font-semibold text-brand hover:text-brand-hover transition-colors">
              Register for trade →
            </Link>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

import Link from "next/link"
import type { Product } from "@/lib/types"

function resolveImageUrl(url: string): string {
  if (url.startsWith("/")) {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
    return `${base}${url}`
  }
  return url
}

const GRADIENTS = [
  "linear-gradient(135deg,#DBEAFE,#BFDBFE)",
  "linear-gradient(135deg,#DCFCE7,#BBF7D0)",
  "linear-gradient(135deg,#FEF9C3,#FEF08A)",
  "linear-gradient(135deg,#FFEDD5,#FED7AA)",
  "linear-gradient(135deg,#F3E8FF,#E9D5FF)",
  "linear-gradient(135deg,#CCFBF1,#99F6E4)",
  "linear-gradient(135deg,#F1F5F9,#E2E8F0)",
  "linear-gradient(135deg,#FEE2E2,#FECACA)",
]

const EMOJIS = ["🛡️", "🧹", "🪣", "🖌️", "📦", "🏗️", "💪", "🔍"]

interface Props {
  title: string
  titleHighlight?: string
  products: Product[]
  viewAllHref?: string
  viewAllLabel?: string
  sectionOffset?: number
}

export function ProductGridSection({
  title,
  titleHighlight,
  products,
  viewAllHref = "/products",
  viewAllLabel = "See all products →",
  sectionOffset = 0,
}: Props) {
  if (products.length === 0) return null

  return (
    <div>
      <div className="max-w-[1280px] mx-auto px-10 py-14">
        <div className="flex justify-between items-baseline mb-8">
          <h2 className="text-[26px] font-bold text-brand-dark">
            {title}{titleHighlight && <> <span className="text-brand">{titleHighlight}</span></>}
          </h2>
          <Link href={viewAllHref} className="text-[13px] font-semibold text-brand flex items-center gap-1 hover:text-brand-hover transition-colors">
            {viewAllLabel}
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map((product, i) => {
            const idx = (sectionOffset + i) % 8
            const rawImage = product.primary_image ?? product.images?.[0]?.url ?? null
            const imageUrl = rawImage ? resolveImageUrl(rawImage) : null
            const price = parseFloat(product.price)
            const salePrice = product.sale_price ? parseFloat(product.sale_price) : null
            const isOnSale = salePrice !== null && salePrice < price

            return (
              <div
                key={product.id}
                className="bg-white border border-[#E0DED8] rounded-xl overflow-hidden hover:border-brand hover:shadow-[0_4px_20px_rgba(200,16,46,0.1)] hover:-translate-y-0.5 transition-all flex flex-col group"
              >
                {/* Image */}
                <div className="h-[180px] flex items-center justify-center text-[72px] relative flex-shrink-0" style={{ background: imageUrl ? undefined : GRADIENTS[idx] }}>
                  {imageUrl ? (
                    <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    EMOJIS[idx]
                  )}
                  <span className={`absolute top-2.5 left-2.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full text-white ${isOnSale ? "bg-brand" : "bg-brand-dark"}`}>
                    {isOnSale ? "Sale" : "In Stock"}
                  </span>
                  <button className="absolute top-2.5 right-2.5 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center text-[14px] border border-[#E0DED8] hover:bg-[#FDF0F2] hover:border-brand transition-all">
                    🤍
                  </button>
                </div>

                {/* Body */}
                <div className="p-3.5 pb-0 flex-1 flex flex-col">
                  <div className="text-[10px] font-bold text-brand uppercase tracking-[0.6px] mb-1">Product</div>
                  <div className="text-[14px] font-semibold text-brand-dark mb-1 leading-[1.35]">{product.name}</div>
                  {product.description && (
                    <p className="text-[12px] text-[#5C5C5C] leading-[1.5] line-clamp-2 mb-auto pb-3">{product.description}</p>
                  )}
                </div>

                {/* Footer */}
                <div className="p-3.5 pt-3 border-t border-[#F0EEEA] mt-3 flex items-center justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[17px] font-bold text-brand-dark">
                      £{isOnSale ? salePrice!.toFixed(2) : price.toFixed(2)}
                    </span>
                    {isOnSale && (
                      <span className="text-[12px] text-[#9a9a9a] line-through">£{price.toFixed(2)}</span>
                    )}
                  </div>
                  <Link
                    href={`/products/${product.slug}`}
                    className="bg-brand-dark hover:bg-brand text-white text-[12px] font-semibold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap"
                  >
                    + View
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

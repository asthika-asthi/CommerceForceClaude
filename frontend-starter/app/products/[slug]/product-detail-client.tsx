"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import type { Product, ReviewSummary } from "@/lib/types"
import { AddToCartButton } from "./add-to-cart-button"
import { WishlistButton } from "@/components/shop/wishlist-button"
import { formatMoney } from "@/lib/currency"

interface Props {
  product: Product
  inStock: boolean
  defaultVariantId: string
  summary: ReviewSummary | null
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} className={`w-4 h-4 ${n <= Math.round(rating) ? "text-amber-400" : "text-slate-200"} fill-current`} viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

export function ProductDetailClient({ product, inStock, defaultVariantId, summary }: Props) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)

  const images = product.images ?? []
  const [displayedImageUrl, setDisplayedImageUrl] = useState<string | null>((images.find(img => img.is_primary) ?? images[0])?.url ?? null)

  // Switch main image when a variant with tagged images is selected
  useEffect(() => {
    if (!selectedVariantId) return
    const variantImages = images.filter(img => img.variant_id === selectedVariantId)
    if (variantImages.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- correct sync of displayed image to selected variant; proper refactor tracked in backlog "Storefront lint debt"
      setDisplayedImageUrl(variantImages[0].url)
    }
  }, [selectedVariantId])

  const variants = product.variants ?? []
  const basePrice = parseFloat(product.price)
  const salePrice = product.sale_price ? parseFloat(product.sale_price) : null
  const effectiveBasePrice = salePrice ?? basePrice
  const selectedVariant = variants.find(v => v.id === selectedVariantId)
  const adjustment = selectedVariant?.price_adjustment ? parseFloat(selectedVariant.price_adjustment) : 0
  const displayPrice = effectiveBasePrice + adjustment

  const displayedAlt = images.find(img => img.url === displayedImageUrl)?.alt_text ?? product.name

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-8">
      {/* Left: image gallery */}
      <div>
        {images.length > 0 ? (
          <div className="space-y-3">
            <div className="relative aspect-square bg-slate-50 rounded-2xl overflow-hidden">
              <Image
                src={displayedImageUrl ?? images[0].url}
                alt={displayedAlt}
                fill
                unoptimized
                priority
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {images.slice(0, 4).map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setDisplayedImageUrl(img.url)}
                    className={[
                      "relative aspect-square bg-slate-50 rounded-xl overflow-hidden border-2 transition-colors",
                      displayedImageUrl === img.url
                        ? "border-brand-dark"
                        : "border-transparent hover:border-slate-300",
                    ].join(" ")}
                  >
                    <Image src={img.url} alt={img.alt_text ?? ""} fill unoptimized sizes="25vw" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="aspect-square bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 text-6xl">
            &#128230;
          </div>
        )}
      </div>

      {/* Right: product info */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-3xl font-bold text-slate-900">{product.name}</h1>
          <WishlistButton productId={product.id} size={20} className="mt-1" />
        </div>

        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-2xl font-bold text-slate-900">{formatMoney(displayPrice.toFixed(2))}</span>
          {salePrice && <span className="text-lg text-slate-400 line-through">{formatMoney(basePrice.toFixed(2))}</span>}
        </div>

        {summary && summary.total_reviews > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <StarRow rating={summary.average_rating} />
            <span className="text-sm text-slate-500">
              {summary.average_rating.toFixed(1)} ({summary.total_reviews} {summary.total_reviews === 1 ? "review" : "reviews"})
            </span>
          </div>
        )}

        {inStock ? (
          <p className="text-sm text-green-600 font-medium mb-4">
            In stock ({product.stock_quantity} available)
          </p>
        ) : (
          <p className="text-sm text-red-500 font-medium mb-4">Out of stock</p>
        )}

        {product.description && (
          <div className="prose prose-sm prose-slate mb-6">
            <p>{product.description}</p>
          </div>
        )}

        <AddToCartButton
          productId={product.id}
          inStock={inStock}
          defaultVariantId={defaultVariantId}
          optionTypes={product.option_types ?? []}
          variants={variants}
          selectedVariantId={selectedVariantId}
          onVariantSelect={setSelectedVariantId}
        />
      </div>
    </div>
  )
}

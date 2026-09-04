"use client"

import { useState } from "react"
import type { BrandingConfig, CategoryPathItem, Product, ReviewSummary } from "@/lib/types"
import { AddToCartButton } from "./add-to-cart-button"
import { WishlistButton } from "@/components/shop/wishlist-button"
import { ProductGallery } from "./product-gallery"
import { DeliveryEstimate } from "./delivery-estimate"
import { PaymentButtons } from "./payment-buttons"
import { ProductMeta } from "./product-meta"
import { ShortDescription } from "./short-description"
import { StarRow } from "./star-row"
import { formatMoney } from "@/lib/currency"
import { VARIANT_PRICING_MODE } from "@/lib/pricing-config"

interface Props {
  product: Product
  inStock: boolean
  defaultVariantId: string
  summary: ReviewSummary | null
  branding: BrandingConfig | null
  categoryLeaf: CategoryPathItem | null
}

export function ProductDetailClient({
  product,
  inStock,
  defaultVariantId,
  summary,
  branding,
  categoryLeaf,
}: Props) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)

  const images = product.images ?? []
  const variants = product.variants ?? []
  const basePrice = parseFloat(product.price)
  const effectiveBasePrice = product.effective_price ? parseFloat(product.effective_price) : basePrice

  const selectedVariant = variants.find(v => v.id === selectedVariantId)
  const adjustment = selectedVariant?.price_adjustment ? parseFloat(selectedVariant.price_adjustment) : 0
  const variantNormalPrice =
    VARIANT_PRICING_MODE === "direct" && selectedVariant?.direct_price != null
      ? parseFloat(selectedVariant.direct_price)
      : basePrice + adjustment
  const displayPrice =
    selectedVariant?.effective_price != null
      ? parseFloat(selectedVariant.effective_price)
      : effectiveBasePrice
  const isOnSale = displayPrice < variantNormalPrice

  // Price range across sellable variants — shown until a specific variant is chosen.
  const activeVariantPrices = variants
    .filter(v => v.is_active && !v.is_default && v.effective_price != null)
    .map(v => parseFloat(v.effective_price as string))
    .filter(n => !Number.isNaN(n))
  const rangeMin = activeVariantPrices.length ? Math.min(...activeVariantPrices) : effectiveBasePrice
  const rangeMax = activeVariantPrices.length ? Math.max(...activeVariantPrices) : effectiveBasePrice
  const showRange = !selectedVariant && rangeMax - rangeMin > 0.005

  const promo = (branding?.delivery_promo_text ?? "").trim()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-8">
      {/* Left: image gallery */}
      <div>
        <ProductGallery images={images} selectedVariantId={selectedVariantId} productName={product.name} />
      </div>

      {/* Right: product info */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-3xl font-bold text-slate-900">{product.name}</h1>
          <WishlistButton productId={product.id} size={20} className="mt-1" />
        </div>

        <DeliveryEstimate branding={branding} />

        {summary && summary.total_reviews > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <StarRow rating={summary.average_rating} />
            <a href="#reviews" className="text-sm text-slate-500 hover:text-brand-dark transition-colors">
              {summary.average_rating.toFixed(1)} ({summary.total_reviews}{" "}
              {summary.total_reviews === 1 ? "customer review" : "customer reviews"})
            </a>
          </div>
        )}

        <div className="flex items-baseline gap-3 mb-2">
          {showRange ? (
            <span className="text-2xl font-bold text-slate-900">
              {formatMoney(rangeMin.toFixed(2))} – {formatMoney(rangeMax.toFixed(2))}
            </span>
          ) : (
            <>
              <span className="text-2xl font-bold text-slate-900">{formatMoney(displayPrice.toFixed(2))}</span>
              {isOnSale && (
                <span className="text-lg text-slate-400 line-through">
                  {formatMoney(variantNormalPrice.toFixed(2))}
                </span>
              )}
            </>
          )}
        </div>

        {promo && <p className="text-sm font-bold text-red-600 mb-3">{promo}</p>}

        <ShortDescription text={product.short_description} />

        {inStock ? (
          <p className="text-sm text-green-600 font-medium mb-4">
            In stock ({product.stock_quantity} available)
          </p>
        ) : (
          <p className="text-sm text-red-500 font-medium mb-4">Out of stock</p>
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

        <PaymentButtons branding={branding} />

        <ProductMeta sku={product.sku} categoryLeaf={categoryLeaf} tags={product.tags} />
      </div>
    </div>
  )
}

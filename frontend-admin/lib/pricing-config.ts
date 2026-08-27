// Variant pricing model, set per client at build time via NEXT_PUBLIC_VARIANT_PRICING_MODE:
// "adjustment" (delta added to base/sale price) or "direct" (each variant carries its own
// absolute price). Mirrors the NEXT_PUBLIC_CURRENCY_CODE pattern in lib/currency.ts.
export const VARIANT_PRICING_MODE =
  (process.env.NEXT_PUBLIC_VARIANT_PRICING_MODE ?? "adjustment") as "adjustment" | "direct"

// Sale price model, set per client at build time via NEXT_PUBLIC_SALE_PRICE_MODE:
// "absolute" (Product.sale_price overrides price when on sale) or "percentage"
// (Product.sale_percent discounts price/direct_price when on sale).
export const SALE_PRICE_MODE =
  (process.env.NEXT_PUBLIC_SALE_PRICE_MODE ?? "absolute") as "absolute" | "percentage"

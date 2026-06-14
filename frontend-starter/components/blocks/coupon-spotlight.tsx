import { serverFetch } from "@/lib/api"

interface FeaturedCoupon {
  id: string
  code: string
  discount_type: string
  discount_value: number
  expires_at?: string | null
  is_active: boolean
}

interface Props {
  [key: string]: unknown
}

export async function CouponSpotlight(_props: Props) {
  const coupon = await serverFetch<FeaturedCoupon | null>("/api/coupons/featured")
  if (!coupon) return null

  const discountLabel =
    coupon.discount_type === "percentage"
      ? `${coupon.discount_value}% OFF`
      : `$${coupon.discount_value} OFF`

  return (
    <section className="w-full bg-card-bg border-y border-border py-8 px-4">
      <div className="max-w-md mx-auto text-center">
        <p className="text-muted text-sm uppercase tracking-wide mb-2">Exclusive Offer</p>
        <div className="bg-white border-2 border-dashed border-brand rounded-xl p-6">
          <p className="text-3xl font-bold text-brand-dark mb-1">{discountLabel}</p>
          <p className="text-muted text-sm mb-3">Use code at checkout</p>
          <div className="bg-brand/10 rounded-lg px-4 py-2 inline-block">
            <span className="font-mono text-xl font-bold text-brand-dark tracking-widest">
              {coupon.code}
            </span>
          </div>
          {coupon.expires_at && (
            <p className="text-muted text-xs mt-3">
              Expires {new Date(coupon.expires_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

import Link from "next/link"
import { CreditCard, Banknote, Wallet, Landmark } from "lucide-react"
import type { BrandingConfig } from "@/lib/types"
import {
  enabledStorefrontPaymentMethods,
  paymentAvailabilityFromBranding,
  type PaymentMethodKey,
} from "@/lib/payment-methods"

interface Props {
  branding: BrandingConfig | null
}

const ICONS: Record<PaymentMethodKey, typeof CreditCard> = {
  cash: Banknote,
  credit_limit: Landmark,
  stripe: CreditCard,
  bank_transfer: Landmark,
  paypal: Wallet,
}

const CTA_LABELS: Record<PaymentMethodKey, string> = {
  cash: "Cash on delivery",
  credit_limit: "Trade credit account",
  stripe: "Pay by card",
  bank_transfer: "Bank transfer",
  paypal: "PayPal",
}

/**
 * Product-page checkout affordances — one button per payment method the store has
 * configured (trade credit excluded; it needs a signed-in trade account). These
 * link through to the normal checkout; they are not express-checkout integrations.
 */
export function PaymentButtons({ branding }: Props) {
  const methods = enabledStorefrontPaymentMethods(
    paymentAvailabilityFromBranding(branding, { includeCredit: false }),
  )
  // "Cash on delivery" alone adds nothing over the Add-to-cart button.
  const meaningful = methods.filter((m) => m.value !== "cash")
  if (meaningful.length === 0) return null

  return (
    <div className="mt-4">
      <p className="text-xs text-muted mb-2">Checkout options</p>
      <div className="space-y-2">
        {meaningful.map((m) => {
          const Icon = ICONS[m.value]
          return (
            <Link
              key={m.value}
              href="/checkout"
              // Same raised "3D" look as the variant buttons: dark-accent border and a solid
              // ledge shadow that lifts on hover and presses in on click.
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-brand-dark bg-card-bg text-sm font-semibold text-brand-dark shadow-[0_3px_0_0_var(--brand-dark)] transition-all duration-100 hover:-translate-y-px hover:shadow-[0_4px_0_0_var(--brand-dark)] active:translate-y-[3px] active:shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-dark"
            >
              <Icon size={16} aria-hidden="true" />
              {CTA_LABELS[m.value]}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

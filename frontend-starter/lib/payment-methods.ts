import type { BrandingConfig } from "./types"

export type PaymentMethodKey = "cash" | "credit_limit" | "stripe" | "bank_transfer" | "paypal"

export interface PaymentMethodDescriptor {
  value: PaymentMethodKey
  label: string
  description: string
}

/** Canonical descriptor list — order is the display order at checkout. */
export const PAYMENT_METHODS: PaymentMethodDescriptor[] = [
  { value: "cash", label: "Cash on Delivery", description: "Pay when your order arrives" },
  { value: "credit_limit", label: "Trade Credit Account", description: "Charge to your pre-approved business credit account" },
  { value: "stripe", label: "Pay by Card", description: "Pay securely with credit or debit card" },
  { value: "bank_transfer", label: "Bank Transfer", description: "Pay directly via bank transfer using the details provided" },
  { value: "paypal", label: "PayPal", description: "Send payment via PayPal using the details provided" },
]

export interface PaymentAvailability {
  /** Cash on delivery — on unless the store turned it off in Branding. */
  cashEnabled?: boolean
  stripeEnabled?: boolean
  bankTransferEnabled?: boolean
  paypalEnabled?: boolean
  /** Whether the current viewer has a trade-credit account (per-user, not branding). */
  hasCreditAccount?: boolean
  /** Set false to drop trade credit entirely (e.g. on the product page). */
  includeCredit?: boolean
}

/** The payment methods that should be offered, given what the store has configured. */
export function enabledStorefrontPaymentMethods(a: PaymentAvailability): PaymentMethodDescriptor[] {
  return PAYMENT_METHODS.filter((m) => {
    if (m.value === "credit_limit") return a.includeCredit !== false && !!a.hasCreditAccount
    if (m.value === "stripe") return !!a.stripeEnabled
    if (m.value === "bank_transfer") return !!a.bankTransferEnabled
    if (m.value === "paypal") return !!a.paypalEnabled
    return a.cashEnabled !== false // cash — on by default
  })
}

/** Build a {@link PaymentAvailability} from a branding record. */
export function paymentAvailabilityFromBranding(
  branding: BrandingConfig | null | undefined,
  extra: Pick<PaymentAvailability, "hasCreditAccount" | "includeCredit"> = {},
): PaymentAvailability {
  return {
    cashEnabled: branding?.enable_cash_on_delivery !== false,
    stripeEnabled: !!branding?.stripe_publishable_key,
    bankTransferEnabled: !!branding?.bank_transfer_details,
    paypalEnabled: !!branding?.paypal_email,
    ...extra,
  }
}

"use client"
import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { loadStripe } from "@stripe/stripe-js"
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { useCartStore } from "@/store/cart"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import Link from "next/link"
import type { Address } from "@/lib/types"
import { formatMoney } from "@/lib/currency"

type PaymentMethodKey = "cash" | "credit_limit" | "stripe"

interface CheckoutForm {
  name: string
  line1: string
  line2: string
  city: string
  county: string
  zip: string
  country: string
  coupon_code: string
  redeem_points: number
  guest_email: string
  payment_method: PaymentMethodKey
}

const PAYMENT_METHODS: { value: PaymentMethodKey; label: string; description: string }[] = [
  { value: "cash", label: "Cash on Delivery", description: "Pay when your order arrives" },
  { value: "credit_limit", label: "Credit Account", description: "Charge to your business credit account" },
  { value: "stripe", label: "Pay by Card", description: "Pay securely with credit or debit card" },
]

export default function CheckoutPage() {
  const [stripeKey, setStripeKey] = useState("")

  useEffect(() => {
    api.get<{ stripe_publishable_key?: string }>("/api/branding")
      .then(b => setStripeKey(b?.stripe_publishable_key ?? ""))
      .catch(() => {})
  }, [])

  const stripePromise = useMemo(
    () => stripeKey ? loadStripe(stripeKey) : null,
    [stripeKey]
  )

  return (
    <Elements stripe={stripePromise}>
      <CheckoutContent stripeEnabled={!!stripeKey} />
    </Elements>
  )
}

function CheckoutContent({ stripeEnabled }: { stripeEnabled: boolean }) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { cart, fetch, clear } = useCartStore()
  const [form, setForm] = useState<CheckoutForm>({
    name: "", line1: "", line2: "", city: "", county: "", zip: "", country: "GB",
    coupon_code: "", redeem_points: 0, guest_email: "", payment_method: "cash",
  })
  const [guestMode, setGuestMode] = useState<"choose" | "guest">("choose")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [shippingCost, setShippingCost] = useState<number>(0)
  const shippingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [couponApplying, setCouponApplying] = useState(false)
  const [loyaltyRate, setLoyaltyRate] = useState<{ rate: number; min: number; active: boolean } | null>(null)

  const stripe = useStripe()
  const elements = useElements()

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    api.get<{ redemption_rate: string; min_redemption: number; is_active: boolean }>("/api/loyalty/config")
      .then((c) => setLoyaltyRate({ rate: Number(c.redemption_rate), min: c.min_redemption, active: c.is_active }))
      .catch(() => setLoyaltyRate(null))
  }, [])

  useEffect(() => {
    if (!form.country) return
    if (shippingDebounce.current) clearTimeout(shippingDebounce.current)
    shippingDebounce.current = setTimeout(() => {
      api.get<{ flat_rate: number }>(`/api/shipping/rate?country=${encodeURIComponent(form.country)}`)
        .then((r) => setShippingCost(Number(r.flat_rate) ?? 0))
        .catch(() => setShippingCost(0))
    }, 400)
    return () => { if (shippingDebounce.current) clearTimeout(shippingDebounce.current) }
  }, [form.country])

  useEffect(() => {
    if (!user) return
    api.get<Address[]>("/api/addresses").then((addrs) => {
      setSavedAddresses(addrs)
      const def = addrs.find((a) => a.is_default) ?? addrs[0]
      if (def) {
        setSelectedAddressId(def.id)
        setForm((f) => ({
          ...f,
          line1: def.line1,
          line2: def.line2 ?? "",
          city: def.city,
          county: def.county ?? "",
          zip: def.postcode,
          country: def.country,
        }))
      }
    }).catch(() => {})
  }, [user])

  if (!user && guestMode === "choose") {
    return (
      <div className="max-w-md mx-auto px-4 py-20">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">How would you like to continue?</h1>
        <p className="text-slate-500 text-sm mb-8">Sign in for faster checkout and order tracking, or continue as a guest.</p>
        <div className="space-y-3">
          <Link
            href="/login?redirect=/checkout"
            className="flex items-center justify-between w-full bg-brand hover:bg-brand-hover text-white font-semibold px-5 py-3.5 rounded-xl transition-colors"
          >
            <span>Sign in to your account</span>
            <span className="text-sm opacity-80">Faster checkout</span>
          </Link>
          <button
            onClick={() => setGuestMode("guest")}
            className="flex items-center justify-between w-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold px-5 py-3.5 rounded-xl transition-colors"
          >
            <span>Continue as guest</span>
            <span className="text-sm text-slate-400">No account needed</span>
          </button>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-brand-dark font-medium hover:underline">Create one</Link>
        </p>
      </div>
    )
  }

  const items = cart?.items ?? []
  const subtotal = parseFloat(cart?.subtotal ?? "0")

  // Mirror the backend's discount maths so the displayed total matches what's charged.
  const loyaltyDiscount =
    loyaltyRate?.active && form.redeem_points >= loyaltyRate.min
      ? form.redeem_points * loyaltyRate.rate
      : 0
  const discountTotal = Math.min(couponDiscount + loyaltyDiscount, subtotal)
  const orderTotal = subtotal - discountTotal + shippingCost

  function field(key: keyof CheckoutForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function applyCoupon() {
    const code = form.coupon_code.trim()
    if (!code) { setCouponDiscount(0); setCouponMsg(null); return }
    setCouponApplying(true)
    try {
      const res = await api.get<{ valid: boolean; discount_value?: string; message: string }>(
        `/api/coupons/validate?code=${encodeURIComponent(code)}&subtotal=${subtotal}`,
      )
      if (res.valid) {
        setCouponDiscount(Number(res.discount_value ?? 0))
        setCouponMsg({ ok: true, text: res.message })
      } else {
        setCouponDiscount(0)
        setCouponMsg({ ok: false, text: res.message })
      }
    } catch {
      setCouponDiscount(0)
      setCouponMsg({ ok: false, text: "Could not validate coupon — please try again." })
    } finally {
      setCouponApplying(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const addressParts = [form.name, form.line1, form.line2, `${form.city}, ${form.county} ${form.zip}`, form.country]
        .filter(Boolean)
      const payload: Record<string, unknown> = {
        shipping_address: addressParts.join("\n"),
        delivery_country: form.country || undefined,
        use_cart: true,
        payment_method: form.payment_method,
      }
      if (form.coupon_code) payload.coupon_code = form.coupon_code
      if (form.redeem_points > 0) payload.redeem_points = form.redeem_points
      if (!user && form.guest_email) payload.guest_email = form.guest_email

      const res = await api.post<{
        order_id: string
        order_number: string
        client_secret?: string
      }>("/api/checkout", payload)

      if (form.payment_method === "stripe") {
        if (!res.client_secret) throw new Error("Payment session not created. Please try again.")
        if (!stripe || !elements) throw new Error("Card payment not ready. Please try again.")

        const cardElement = elements.getElement(CardElement)
        if (!cardElement) throw new Error("Card details not entered.")

        const { error: stripeError } = await stripe.confirmCardPayment(res.client_secret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: form.name,
              address: { postal_code: form.zip, country: form.country },
            },
          },
        })
        if (stripeError) {
          throw new Error(stripeError.message ?? "Card payment failed.")
        }
      }

      clear()
      router.push(`/checkout/success?order_id=${res.order_id}&order_number=${encodeURIComponent(res.order_number)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed")
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-slate-600 mb-4">Your cart is empty</p>
        <Link href="/products" className="inline-block bg-brand hover:bg-brand-hover text-white px-6 py-2.5 rounded-lg">Browse products</Link>
      </div>
    )
  }

  const availablePaymentMethods = PAYMENT_METHODS.filter((m) => {
    if (m.value === "credit_limit" && !user) return false
    if (m.value === "stripe" && !stripeEnabled) return false
    return true
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-8">Checkout</h1>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Shipping */}
          <div className="bg-white border border-slate-100 rounded-xl p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Shipping address</h2>
            {user && savedAddresses.length > 0 && (
              <div className="mb-4 pb-4 border-b border-slate-100">
                <p className="text-sm text-slate-600 mb-2">Saved addresses</p>
                <div className="space-y-2">
                  {savedAddresses.map((addr) => (
                    <label key={addr.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selectedAddressId === addr.id ? "border-brand-dark bg-brand/5" : "border-slate-200 hover:border-slate-300"}`}>
                      <input
                        type="radio"
                        name="saved_address"
                        checked={selectedAddressId === addr.id}
                        onChange={() => {
                          setSelectedAddressId(addr.id)
                          setForm((f) => ({
                            ...f,
                            line1: addr.line1,
                            line2: addr.line2 ?? "",
                            city: addr.city,
                            county: addr.county ?? "",
                            zip: addr.postcode,
                            country: addr.country,
                          }))
                        }}
                        className="mt-0.5 accent-brand-dark"
                      />
                      <div className="text-xs text-slate-700">
                        {addr.label && <p className="font-semibold uppercase tracking-wide text-slate-500 mb-0.5">{addr.label}</p>}
                        <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
                        <p>{addr.city}{addr.county ? `, ${addr.county}` : ""} {addr.postcode}</p>
                      </div>
                    </label>
                  ))}
                  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selectedAddressId === null ? "border-brand-dark bg-brand/5" : "border-slate-200 hover:border-slate-300"}`}>
                    <input type="radio" name="saved_address" checked={selectedAddressId === null} onChange={() => setSelectedAddressId(null)} className="mt-0.5 accent-brand-dark" />
                    <span className="text-xs text-slate-600 font-medium">Enter a different address</span>
                  </label>
                </div>
              </div>
            )}
            {!user && (
              <div className="mb-4 pb-4 border-b border-slate-100">
                <label className="block text-sm text-slate-600 mb-1">Email address *</label>
                <input
                  required
                  type="email"
                  value={form.guest_email}
                  onChange={(e) => setForm((f) => ({ ...f, guest_email: e.target.value }))}
                  placeholder="you@example.com"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
                />
                <p className="mt-1 text-xs text-slate-400">Order confirmation will be sent here.{" "}
                  <Link href="/login?redirect=/checkout" className="text-brand-dark hover:underline">Sign in instead</Link>
                </p>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Full name</label>
                <input required value={form.name} onChange={field("name")}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Address line 1</label>
                <input required value={form.line1} onChange={field("line1")}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Address line 2 (optional)</label>
                <input value={form.line2} onChange={field("line2")}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Town / City</label>
                  <input required value={form.city} onChange={field("city")}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">County (optional)</label>
                  <input value={form.county} onChange={field("county")}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Postcode</label>
                  <input required value={form.zip} onChange={field("zip")}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Country</label>
                  <input required value={form.country} onChange={field("country")}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
                </div>
              </div>
            </div>
          </div>

          {/* Payment method */}
          <div className="bg-white border border-slate-100 rounded-xl p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Payment method</h2>
            <div className="space-y-3">
              {availablePaymentMethods.map((pm) => (
                <label
                  key={pm.value}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                    form.payment_method === pm.value
                      ? "border-brand-dark bg-brand/5"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value={pm.value}
                    checked={form.payment_method === pm.value}
                    onChange={() => setForm((f) => ({ ...f, payment_method: pm.value }))}
                    className="mt-0.5 accent-brand-dark"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{pm.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{pm.description}</p>
                  </div>
                </label>
              ))}
            </div>

            {form.payment_method === "cash" && (
              <p className="mt-3 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                Your order will be confirmed immediately. Payment is collected on delivery.
              </p>
            )}

            {form.payment_method === "stripe" && (
              <div className="mt-4 border border-slate-200 rounded-xl p-4">
                <label className="block text-sm text-slate-600 mb-2">Card details</label>
                <CardElement
                  options={{
                    hidePostalCode: true,
                    style: {
                      base: {
                        fontSize: "14px",
                        color: "#1e293b",
                        "::placeholder": { color: "#94a3b8" },
                      },
                    },
                  }}
                  className="border border-slate-200 rounded-lg px-3 py-2.5"
                />
                <p className="mt-2 text-xs text-slate-400">
                  Payments are processed securely by Stripe. We never store your card details.
                </p>
              </div>
            )}
          </div>

          {/* Discounts */}
          <div className="bg-white border border-slate-100 rounded-xl p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Discounts</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Coupon code</label>
                <div className="flex gap-2">
                  <input value={form.coupon_code}
                    onChange={(e) => { setForm((f) => ({ ...f, coupon_code: e.target.value })); setCouponDiscount(0); setCouponMsg(null) }}
                    placeholder="Enter code"
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
                  <button type="button" onClick={applyCoupon} disabled={couponApplying || !form.coupon_code.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    {couponApplying ? "…" : "Apply"}
                  </button>
                </div>
                {couponMsg && (
                  <p className={`text-xs mt-1 ${couponMsg.ok ? "text-green-600" : "text-red-600"}`}>{couponMsg.text}</p>
                )}
              </div>
              {user && (
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Loyalty points to redeem</label>
                  <input type="number" min={0} value={form.redeem_points}
                    onChange={(e) => setForm((f) => ({ ...f, redeem_points: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Order summary */}
        <div>
          <div className="bg-white border border-slate-100 rounded-xl p-6 sticky top-20">
            <h2 className="font-semibold text-slate-900 mb-4">Order summary</h2>
            <div className="space-y-2 mb-4">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-slate-600">{item.product_name} x {item.quantity}</span>
                  <span className="text-slate-900">{formatMoney(parseFloat(item.line_total).toFixed(2))}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-3 space-y-2 mb-6">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span>{formatMoney(subtotal.toFixed(2))}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Coupon discount</span>
                  <span>-{formatMoney(couponDiscount.toFixed(2))}</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Loyalty points</span>
                  <span>-{formatMoney(loyaltyDiscount.toFixed(2))}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-slate-600">
                <span>Shipping</span>
                <span>{shippingCost > 0 ? <>{formatMoney(shippingCost.toFixed(2))}</> : "Free"}</span>
              </div>
              <div className="flex justify-between font-semibold text-slate-900 pt-2 border-t border-slate-100">
                <span>Total</span>
                <span>{formatMoney(orderTotal.toFixed(2))}</span>
              </div>
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mb-4">{error}</div>}
            <button type="submit" disabled={loading || (form.payment_method === "stripe" && !stripe)}
              className="w-full bg-brand hover:bg-brand-hover text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
              {loading
                ? form.payment_method === "stripe" ? "Processing payment..." : "Placing order..."
                : form.payment_method === "stripe" ? "Pay now" : "Place order"}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

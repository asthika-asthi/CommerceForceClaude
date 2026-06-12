"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useCartStore } from "@/store/cart"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import Link from "next/link"

interface CheckoutForm {
  name: string
  line1: string
  line2: string
  city: string
  state: string
  zip: string
  country: string
  coupon_code: string
  redeem_points: number
  guest_email: string
}

export default function CheckoutPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { cart, fetch, clear } = useCartStore()
  const [form, setForm] = useState<CheckoutForm>({
    name: "", line1: "", line2: "", city: "", state: "", zip: "", country: "US",
    coupon_code: "", redeem_points: 0, guest_email: "",
  })
  const [guestMode, setGuestMode] = useState<"choose" | "guest" | "signin">("choose")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => { fetch() }, [fetch])

  // Unauthenticated: show sign-in vs guest choice, or guest email entry
  if (!user) {
    if (guestMode === "choose") {
      return (
        <div className="max-w-md mx-auto px-4 py-20">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">How would you like to continue?</h1>
          <p className="text-slate-500 text-sm mb-8">Sign in for faster checkout and order tracking, or continue as a guest.</p>
          <div className="space-y-3">
            <Link
              href={`/login?redirect=/checkout`}
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

    if (guestMode === "guest") {
      // Guest continues — show email capture then fall through to form below
    }
  }

  const items = cart?.items ?? []
  const subtotal = parseFloat(cart?.subtotal ?? "0")

  function field(key: keyof CheckoutForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const addressParts = [form.name, form.line1, form.line2, `${form.city}, ${form.state} ${form.zip}`, form.country]
        .filter(Boolean)
      const payload: Record<string, unknown> = {
        shipping_address: addressParts.join("\n"),
        use_cart: true,
      }
      if (form.coupon_code) payload.coupon_code = form.coupon_code
      if (form.redeem_points > 0) payload.redeem_points = form.redeem_points
      if (!user && form.guest_email) payload.guest_email = form.guest_email

      const res = await api.post<{ order_id: string }>("/api/checkout", payload)
      clear()
      router.push(`/checkout/success?order=${res.order_id}`)
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-8">Checkout</h1>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Shipping */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-100 rounded-xl p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Shipping address</h2>
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
                  <Link href={`/login?redirect=/checkout`} className="text-brand-dark hover:underline">Sign in instead</Link>
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
                  <label className="block text-sm text-slate-600 mb-1">City</label>
                  <input required value={form.city} onChange={field("city")}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">State</label>
                  <input required value={form.state} onChange={field("state")}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Postal code</label>
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

          {/* Discounts */}
          <div className="bg-white border border-slate-100 rounded-xl p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Discounts</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Coupon code</label>
                <input value={form.coupon_code} onChange={field("coupon_code")} placeholder="Enter code"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Loyalty points to redeem</label>
                <input type="number" min={0} value={form.redeem_points}
                  onChange={(e) => setForm((f) => ({ ...f, redeem_points: parseInt(e.target.value) || 0 }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
              </div>
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
                  <span className="text-slate-600">{item.product_name} × {item.quantity}</span>
                  <span className="text-slate-900">${parseFloat(item.line_total).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-4 flex justify-between font-semibold text-slate-900 mb-6">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mb-4">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full bg-brand hover:bg-brand-hover text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
              {loading ? "Placing order…" : "Place order"}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

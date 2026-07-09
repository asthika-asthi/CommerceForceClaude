"use client"
import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { api } from "@/lib/api"
import type { Order } from "@/lib/types"
import { OrderDetailCard } from "@/components/shop/order-detail-card"

export default function TrackOrderPage() {
  return (
    <Suspense fallback={null}>
      <TrackOrderForm />
    </Suspense>
  )
}

function TrackOrderForm() {
  const searchParams = useSearchParams()
  const [orderNumber, setOrderNumber] = useState(searchParams.get("order_number") ?? "")
  const [email, setEmail] = useState("")
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setOrder(null)
    setLoading(true)
    try {
      const result = await api.post<Order>("/api/orders/track", {
        order_number: orderNumber.trim(),
        email: email.trim(),
      })
      setOrder(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find that order.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Track your order</h1>
      <p className="text-sm text-slate-500 mb-8">
        Enter your order number and the email address you used at checkout.
      </p>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-100 rounded-2xl p-6 space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Order number</label>
          <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required
            placeholder="CF-20260101-ABC123"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            placeholder="you@example.com"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading}
          className="bg-brand hover:bg-brand-hover text-on-brand font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50">
          {loading ? "Looking up…" : "Track order"}
        </button>
      </form>

      {order && <OrderDetailCard order={order} />}
    </div>
  )
}

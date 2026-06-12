"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import type { Order } from "@/lib/types"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  confirmed: "bg-brand/10 text-brand-dark",
  processing: "bg-purple-50 text-purple-700",
  shipped: "bg-indigo-50 text-indigo-700",
  delivered: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
}

export default function OrdersPage() {
  const user = useAuthStore((s) => s.user)
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { router.push("/login?redirect=/account/orders"); return }
    api.get<{ items: Order[] }>("/api/orders?page_size=50")
      .then((r) => setOrders(r?.items ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [user, router])

  if (!user || loading) return <div className="flex justify-center py-20 text-slate-400">Loading…</div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link href="/account" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={14} /> Back to account
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">My orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="mb-4">No orders yet</p>
          <Link href="/products" className="inline-block bg-brand hover:bg-brand-hover text-white px-6 py-2.5 rounded-lg text-sm transition-colors">
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50">
          {orders.map((order) => (
            <Link key={order.id} href={`/account/orders/${order.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
              <div>
                <p className="text-sm font-medium text-slate-900">Order {order.order_number}</p>
                {"created_at" in order && order.created_at && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(order.created_at as string).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <p className="text-sm font-semibold text-slate-900">${parseFloat(order.total).toFixed(2)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] ?? "bg-slate-50 text-slate-700"}`}>
                  {order.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

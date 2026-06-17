"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import type { Order, LoyaltyAccount } from "@/lib/types"
import Link from "next/link"

export default function AccountPage() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loyalty, setLoyalty] = useState<LoyaltyAccount | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { router.push("/login"); return }
    Promise.all([
      api.get<{ items: Order[] }>("/api/orders?limit=5").catch(() => ({ items: [] as Order[] })),
      api.get<LoyaltyAccount>("/api/loyalty/my-account").catch(() => null),
    ]).then(([ordersRes, loyaltyRes]) => {
      setOrders(ordersRes?.items ?? [])
      setLoyalty(loyaltyRes)
      setLoading(false)
    })
  }, [user, router])

  async function handleLogout() {
    await logout()
    router.push("/")
  }

  if (!user || loading) return <div className="flex justify-center py-20 text-slate-400">Loading…</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My account</h1>
          <p className="text-slate-500 text-sm mt-1">{user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/account/orders" className="text-sm text-slate-500 hover:text-slate-800">All orders</Link>
          <Link href="/account/wishlist" className="text-sm text-slate-500 hover:text-slate-800">Wishlist</Link>
          <Link href="/account/addresses" className="text-sm text-slate-500 hover:text-slate-800">Addresses</Link>
          <Link href="/account/settings" className="text-sm text-slate-500 hover:text-slate-800">Settings</Link>
          <button onClick={handleLogout} className="text-sm text-slate-400 hover:text-slate-700">Sign out</button>
        </div>
      </div>

      {/* Loyalty */}
      {loyalty && (
        <div className="bg-gradient-to-br from-brand to-brand-hover text-white rounded-2xl p-6 mb-6">
          <p className="text-white/70 text-sm font-medium mb-1">Loyalty points</p>
          <p className="text-3xl font-bold">{loyalty.points_balance.toLocaleString()}</p>
          <p className="text-white/70 text-sm mt-1">{loyalty.total_earned.toLocaleString()} earned · {loyalty.total_redeemed.toLocaleString()} redeemed</p>
        </div>
      )}

      {/* Recent orders */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent orders</h2>
        </div>
        {orders.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-400 text-sm">No orders yet</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {orders.map((order) => (
              <Link key={order.id} href={`/account/orders/${order.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-slate-900">Order {order.order_number}</p>
                  {order.created_at && <p className="text-xs text-slate-400 mt-0.5">{new Date(order.created_at).toLocaleDateString()}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">&#163;{parseFloat(order.total).toFixed(2)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    order.status === "delivered" ? "bg-green-50 text-green-700"
                    : order.status === "cancelled" ? "bg-red-50 text-red-700"
                    : "bg-brand/10 text-brand-dark"
                  }`}>{order.status}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

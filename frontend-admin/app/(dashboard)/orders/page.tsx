"use client"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { api } from "@/lib/api"
import type { PaginatedOrders } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"

export default function OrdersPage() {
  const { data, isLoading } = useQuery<PaginatedOrders>({
    queryKey: ["orders"],
    queryFn: () => api.get("/api/orders?limit=50"),
  })
  const orders = data?.items ?? []

  return (
    <div>
      <PageHeader title="Orders" description={data ? `${data.total} total orders` : undefined} />
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Order #</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Payment</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400">No orders yet</td></tr>
              )}
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{o.order_number}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {o.guest_email ?? (o.user_id ? `User ${o.user_id.slice(0, 8)}` : "—")}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">${o.total}</td>
                  <td className="px-4 py-3"><StatusBadge value={o.status} /></td>
                  <td className="px-4 py-3"><StatusBadge value={o.payment_status} /></td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/orders/${o.id}`}
                      className="text-blue-600 hover:underline text-xs">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

"use client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import type { Order, OrderStatus } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { ArrowLeft } from "lucide-react"

const ORDER_STATUSES: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]

export default async function OrderDetailPage(props: PageProps<"/orders/[id]">) {
  const { id } = await props.params
  return <OrderDetail id={id} />
}

function OrderDetail({ id }: { id: string }) {
  const qc = useQueryClient()
  const router = useRouter()
  const { data: order, isLoading } = useQuery<Order>({
    queryKey: ["order", id],
    queryFn: () => api.get(`/api/orders/${id}`),
  })
  const [status, setStatus] = useState<OrderStatus | "">("")

  const updateStatus = useMutation({
    mutationFn: (newStatus: OrderStatus) =>
      api.put(`/api/orders/${id}/status`, { status: newStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", id] })
      qc.invalidateQueries({ queryKey: ["orders"] })
    },
  })

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  }
  if (!order) return <p className="text-slate-500">Order not found.</p>

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-800">
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-xl font-semibold text-slate-900">{order.order_number}</h2>
        <StatusBadge value={order.status} />
        <StatusBadge value={order.payment_status} />
      </div>

      {/* Update status */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Update Status</h3>
        <div className="flex gap-2 flex-wrap">
          {ORDER_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => updateStatus.mutate(s)}
              disabled={order.status === s || updateStatus.isPending}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                order.status === s
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              } disabled:opacity-50`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Order details */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Customer</h3>
          <dl className="space-y-1.5 text-sm">
            <Row label="Email" value={order.guest_email ?? (order.user_id ? `User ${order.user_id.slice(0, 8)}…` : "—")} />
            <Row label="Payment" value={order.payment_method} />
            <Row label="Date" value={new Date(order.created_at).toLocaleString()} />
          </dl>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Totals</h3>
          <dl className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={`$${order.subtotal}`} />
            {parseFloat(order.discount_amount) > 0 && (
              <Row label="Discount" value={`-$${order.discount_amount}`} />
            )}
            <Row label="Total" value={`$${order.total}`} />
          </dl>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Items</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">Product</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">SKU</th>
              <th className="text-right px-4 py-2.5 font-medium text-slate-600">Qty</th>
              <th className="text-right px-4 py-2.5 font-medium text-slate-600">Unit</th>
              <th className="text-right px-4 py-2.5 font-medium text-slate-600">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2.5 text-slate-800">{item.product_name}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{item.product_sku ?? "—"}</td>
                <td className="px-4 py-2.5 text-right text-slate-700">{item.quantity}</td>
                <td className="px-4 py-2.5 text-right text-slate-700">${item.unit_price}</td>
                <td className="px-4 py-2.5 text-right font-medium text-slate-900">${item.subtotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-800 font-medium">{value}</dd>
    </div>
  )
}

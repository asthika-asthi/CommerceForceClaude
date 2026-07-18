import type { Order } from "@/lib/types"
import { formatMoney } from "@/lib/currency"

export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  confirmed: "bg-brand/10 text-brand-dark",
  processing: "bg-purple-50 text-purple-700",
  shipped: "bg-indigo-50 text-indigo-700",
  delivered: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
}

/**
 * Shared order-detail presentation — used by the authenticated account order
 * page and the public guest tracking page, so totals math (subtotal/discount/
 * tax/shipping/total) only lives in one place.
 */
export function OrderDetailCard({ order }: { order: Order }) {
  const colorClass = STATUS_COLORS[order.status] ?? "bg-slate-50 text-slate-700"

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Order {order.order_number}</h1>
        <span className={`text-sm px-3 py-1 rounded-full font-medium ${colorClass}`}>{order.status}</span>
      </div>

      <div className="bg-card-bg border border-slate-100 rounded-2xl divide-y divide-slate-50 mb-6">
        {order.items?.map((item) => (
          <div key={item.id} className="flex justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-slate-900">{item.product_name}</p>
              <p className="text-xs text-slate-400 mt-0.5">Qty: {item.quantity}</p>
            </div>
            <p className="text-sm font-semibold text-slate-900">{formatMoney((parseFloat(item.unit_price) * item.quantity).toFixed(2))}</p>
          </div>
        ))}
      </div>

      <div className="bg-card-bg border border-slate-100 rounded-2xl p-6 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Subtotal</span>
          <span className="text-slate-900">{formatMoney(parseFloat(order.subtotal).toFixed(2))}</span>
        </div>
        {parseFloat(order.discount_amount) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Discount</span>
            <span className="text-green-600">−{formatMoney(parseFloat(order.discount_amount).toFixed(2))}</span>
          </div>
        )}
        {parseFloat(order.tax_amount) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Tax (VAT)</span>
            <span className="text-slate-900">{formatMoney(parseFloat(order.tax_amount).toFixed(2))}</span>
          </div>
        )}
        {parseFloat(order.shipping_cost) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Shipping</span>
            <span className="text-slate-900">{formatMoney(parseFloat(order.shipping_cost).toFixed(2))}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold text-slate-900 pt-2 border-t border-slate-100">
          <span>Total</span>
          <span>{formatMoney(parseFloat(order.total).toFixed(2))}</span>
        </div>
      </div>

      {order.shipping_address && (
        <div className="mt-6 bg-card-bg border border-slate-100 rounded-2xl p-6">
          <h2 className="font-semibold text-slate-900 mb-3">Shipping address</h2>
          <p className="text-sm text-slate-600 whitespace-pre-line">{order.shipping_address}</p>
        </div>
      )}
    </>
  )
}

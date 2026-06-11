"use client"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import Link from "next/link"
import type { PaginatedOrders } from "@/lib/types"

interface ProductsResponse { items: { id: string; stock_quantity: number; is_active: boolean }[]; total: number }

export default function DashboardPage() {
  const { data: ordersData, isLoading: ordersLoading, isError: ordersError } = useQuery<PaginatedOrders>({
    queryKey: ["dashboard-orders"],
    queryFn: () => api.get("/api/orders?limit=100"),
  })
  const { data: productsData, isLoading: productsLoading, isError: productsError } = useQuery<ProductsResponse>({
    queryKey: ["dashboard-products"],
    queryFn: () => api.get("/api/products?limit=200&is_active=true"),
  })

  const isLoading = ordersLoading || productsLoading
  const isError = ordersError || productsError

  if (isLoading) return (
    <div>
      <PageHeader title="Dashboard" description="Store overview" />
      <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
    </div>
  )

  if (isError) return (
    <div>
      <PageHeader title="Dashboard" description="Store overview" />
      <p className="text-sm text-red-600 mt-4">Failed to load dashboard data. Please refresh.</p>
    </div>
  )

  const orders = ordersData?.items ?? []
  const totalOrders = ordersData?.total ?? 0
  const pendingOrders = orders.filter((o) => o.status === "pending").length
  const revenue = orders
    .filter((o) => o.payment_status === "paid")
    .reduce((sum, o) => sum + parseFloat(o.total), 0)
  const totalProducts = productsData?.total ?? 0
  const lowStockProducts = (productsData?.items ?? []).filter((p) => p.stock_quantity < 10).length

  const recentOrders = orders.slice(0, 5)

  const kpis = [
    { label: "Total Orders", value: totalOrders, color: "text-blue-600" },
    { label: "Pending Orders", value: pendingOrders, color: "text-yellow-600" },
    { label: "Revenue (paid, first 100)", value: `$${revenue.toFixed(2)}`, color: "text-green-600" },
    { label: "Active Products", value: totalProducts, color: "text-slate-800" },
    { label: "Low Stock (<10)", value: lowStockProducts, color: lowStockProducts > 0 ? "text-red-600" : "text-green-600" },
  ]

  return (
    <div>
      <PageHeader title="Dashboard" description="Store overview" />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {kpis.map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-sm">Recent Orders</h3>
          <Link href="/orders" className="text-xs text-blue-600 hover:underline">View all</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Order #", "Status", "Payment", "Total", "Date"].map((h) => (
                <th key={h} className="text-left px-4 py-2 text-xs font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {recentOrders.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400 text-sm">No orders yet</td></tr>
            )}
            {recentOrders.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link href={`/orders/${o.id}`} className="font-mono text-xs text-blue-600 hover:underline">{o.order_number}</Link>
                </td>
                <td className="px-4 py-2.5"><StatusBadge value={o.status} /></td>
                <td className="px-4 py-2.5"><StatusBadge value={o.payment_status} /></td>
                <td className="px-4 py-2.5 font-medium text-slate-800">${parseFloat(o.total).toFixed(2)}</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">
                  {o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

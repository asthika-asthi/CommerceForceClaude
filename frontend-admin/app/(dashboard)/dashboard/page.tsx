"use client"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import Link from "next/link"
import type { PaginatedOrders } from "@/lib/types"
import { CURRENCY_SYMBOL, formatMoney } from "@/lib/currency"

interface ProductsResponse { items: { id: string; stock_quantity: number; is_active: boolean }[]; total: number }
interface DailyRevenue { date: string; revenue: number; count: number }
interface TopProduct { name: string; revenue: number; units: number }
interface Analytics { daily_revenue: DailyRevenue[]; top_products: TopProduct[] }

function RevenueChart({ data }: { data: DailyRevenue[] }) {
  if (!data.length) return <p className="text-sm text-slate-400 text-center py-8">No revenue data in the last 30 days</p>

  const W = 600, H = 180
  const pad = { top: 10, right: 16, bottom: 28, left: 52 }
  const cW = W - pad.left - pad.right
  const cH = H - pad.top - pad.bottom
  const maxRev = Math.max(...data.map(d => d.revenue), 1)

  const pts = data.map((d, i) => ({
    x: pad.left + (i / Math.max(data.length - 1, 1)) * cW,
    y: pad.top + cH - (d.revenue / maxRev) * cH,
    ...d,
  }))

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")
  const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${(pad.top + cH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(pad.top + cH).toFixed(1)} Z`

  const gridLines = [0, 0.5, 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {gridLines.map(t => (
        <g key={t}>
          <text x={pad.left - 6} y={pad.top + cH - t * cH + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
            {formatMoney((maxRev * t).toFixed(0))}
          </text>
          <line x1={pad.left} y1={pad.top + cH - t * cH} x2={pad.left + cW} y2={pad.top + cH - t * cH} stroke="#e2e8f0" strokeWidth="1" />
        </g>
      ))}
      <path d={area} fill="#3b82f6" fillOpacity="0.08" />
      <path d={line} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
      {pts.filter((_, i) => i === 0 || i === pts.length - 1 || i % 7 === 0).map(p => (
        <text key={p.date} x={p.x} y={H - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">
          {new Date(p.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </text>
      ))}
    </svg>
  )
}

function TopProductsChart({ data }: { data: TopProduct[] }) {
  if (!data.length) return <p className="text-sm text-slate-400 text-center py-8">No product sales yet</p>
  const max = Math.max(...data.map(d => d.revenue), 1)
  return (
    <div className="space-y-2.5">
      {data.map(d => (
        <div key={d.name} className="flex items-center gap-3">
          <div className="w-32 text-xs text-slate-600 truncate shrink-0" title={d.name}>{d.name}</div>
          <div className="flex-1 bg-slate-100 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${(d.revenue / max) * 100}%` }} />
          </div>
          <div className="text-xs font-medium text-slate-700 w-16 text-right shrink-0">{formatMoney(d.revenue.toFixed(2))}</div>
          <div className="text-xs text-slate-400 w-12 text-right shrink-0">{d.units} sold</div>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { data: ordersData, isLoading: ordersLoading, isError: ordersError } = useQuery<PaginatedOrders>({
    queryKey: ["dashboard-orders"],
    queryFn: () => api.get("/api/orders?limit=100"),
  })
  const { data: productsData, isLoading: productsLoading, isError: productsError } = useQuery<ProductsResponse>({
    queryKey: ["dashboard-products"],
    queryFn: () => api.get("/api/products?limit=200&is_active=true"),
  })
  const { data: analytics } = useQuery<Analytics>({
    queryKey: ["dashboard-analytics"],
    queryFn: () => api.get("/api/orders/analytics"),
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
    { label: "Revenue (paid)", value: `${CURRENCY_SYMBOL}${revenue.toFixed(2)}`, color: "text-green-600" },
    { label: "Active Products", value: totalProducts, color: "text-slate-800" },
    { label: "Low Stock (<10)", value: lowStockProducts, color: lowStockProducts > 0 ? "text-red-600" : "text-green-600" },
  ]

  return (
    <div>
      <PageHeader title="Dashboard" description="Store overview" />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {kpis.map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Revenue — last 30 days</h3>
          <RevenueChart data={analytics?.daily_revenue ?? []} />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Top products by revenue</h3>
          <TopProductsChart data={analytics?.top_products ?? []} />
        </div>
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
                <td className="px-4 py-2.5 font-medium text-slate-800">{formatMoney(parseFloat(o.total).toFixed(2))}</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">
                  {o.created_at ? new Date(o.created_at).toLocaleDateString("en-GB") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

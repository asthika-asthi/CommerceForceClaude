"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { ChevronDown, ChevronRight } from "lucide-react"

import type { Warehouse } from "@/lib/types"

const DEFAULT_SF = { product_id: "", quantity: "", threshold: "10", delta: "" }

export default function InventoryPage() {
  const qc = useQueryClient()
  const { data: warehouses = [], isLoading } = useQuery<Warehouse[]>({
    queryKey: ["warehouses"],
    queryFn: () => api.get("/api/inventory/warehouses"),
  })
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [stockForms, setStockForms] = useState<Record<string, { product_id: string; quantity: string; threshold: string; delta: string }>>({})
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({ name: "", code: "", address: "", is_default: false })
  const [createError, setCreateError] = useState("")
  const [stockError, setStockError] = useState("")
  const [pendingWhId, setPendingWhId] = useState<string | null>(null)

  const createWH = useMutation({
    mutationFn: (d: typeof createForm) => api.post("/api/inventory/warehouses", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["warehouses"] }); setShowCreateForm(false); setCreateForm({ name: "", code: "", address: "", is_default: false }); setCreateError("") },
    onError: (e) => setCreateError(e instanceof Error ? e.message : "Failed"),
  })

  const setStock = useMutation({
    mutationFn: ({ whId, data }: { whId: string; data: { product_id: string; quantity: number; low_stock_threshold: number } }) => {
      setPendingWhId(whId)
      return api.post(`/api/inventory/warehouses/${whId}/stock`, data)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["warehouses"] }); setPendingWhId(null); setStockError("") },
    onError: (e) => { setStockError(e instanceof Error ? e.message : "Failed"); setPendingWhId(null) },
  })

  const adjustStock = useMutation({
    mutationFn: ({ whId, data }: { whId: string; data: { product_id: string; delta: number } }) => {
      setPendingWhId(whId)
      return api.post(`/api/inventory/warehouses/${whId}/stock/adjust`, data)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["warehouses"] }); setPendingWhId(null); setStockError("") },
    onError: (e) => { setStockError(e instanceof Error ? e.message : "Failed"); setPendingWhId(null) },
  })

  function getStockForm(whId: string) {
    return stockForms[whId] ?? DEFAULT_SF
  }

  function setStockFormField(whId: string, field: string, value: string) {
    setStockForms((f) => ({ ...f, [whId]: { ...(f[whId] ?? DEFAULT_SF), [field]: value } }))
  }

  return (
    <div>
      <PageHeader
        title="Warehouses & Inventory"
        description="Multi-location stock management"
        action={{ label: showCreateForm ? "Cancel" : "+ New Warehouse", onClick: () => { setShowCreateForm((v) => !v); setCreateError("") } }}
      />

      {showCreateForm && (
        <form onSubmit={(e) => { e.preventDefault(); createWH.mutate(createForm) }}
          className="bg-white rounded-xl border border-slate-200 p-5 mb-6 flex gap-4 items-end flex-wrap">
          {[{ key: "name", label: "Name *" }, { key: "code", label: "Code *" }, { key: "address", label: "Address" }].map(({ key, label }) => (
            <div key={key} className="flex-1 min-w-32">
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              <input required={label.endsWith("*")} value={(createForm as Record<string, string | boolean>)[key] as string}
                onChange={(e) => setCreateForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm text-slate-700 pb-1">
            <input type="checkbox" checked={createForm.is_default} onChange={(e) => setCreateForm((f) => ({ ...f, is_default: e.target.checked }))} />
            Default
          </label>
          {createError && <p className="w-full text-sm text-red-600">{createError}</p>}
          <button type="submit" disabled={createWH.isPending} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm disabled:opacity-50">
            Create
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {warehouses.length === 0 && <p className="text-center py-10 text-slate-400">No warehouses</p>}
          {warehouses.map((wh) => {
            const sf = getStockForm(wh.id)
            return (
              <div key={wh.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpanded((e) => ({ ...e, [wh.id]: !e[wh.id] }))}>
                  <div className="flex items-center gap-3">
                    {expanded[wh.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span className="font-semibold text-slate-800">{wh.name}</span>
                    <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{wh.code}</span>
                    {wh.is_default && <span className="text-xs text-blue-600 font-medium">Default</span>}
                  </div>
                  <StatusBadge value={wh.is_active ? "active" : "inactive"} />
                </div>

                {expanded[wh.id] && (
                  <>
                    {wh.stock_items.length > 0 && (
                      <table className="w-full text-sm border-t border-slate-100">
                        <thead className="bg-slate-50">
                          <tr>
                            {["Product ID", "Qty", "Reserved", "Available", "Low Stock"].map((h) => (
                              <th key={h} className="text-left px-4 py-2 text-xs font-medium text-slate-500">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {wh.stock_items.map((s) => (
                            <tr key={s.id}>
                              <td className="px-4 py-2 font-mono text-xs text-slate-600">{s.product_id.slice(0, 12)}…</td>
                              <td className="px-4 py-2 text-slate-700">{s.quantity}</td>
                              <td className="px-4 py-2 text-slate-500">{s.reserved_quantity}</td>
                              <td className={`px-4 py-2 font-medium ${s.available_quantity < (s.low_stock_threshold ?? 10) ? "text-red-600" : "text-green-700"}`}>
                                {s.available_quantity}
                              </td>
                              <td className="px-4 py-2 text-slate-400 text-xs">{s.low_stock_threshold ?? 10}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {wh.stock_items.length === 0 && (
                      <p className="px-5 py-4 text-sm text-slate-400 border-t border-slate-100">No stock entries yet.</p>
                    )}

                    {/* Stock management panel */}
                    <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-3">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Manage Stock</p>
                      <div className="flex gap-3 flex-wrap items-end">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Product ID</label>
                          <input value={sf.product_id} onChange={(e) => setStockFormField(wh.id, "product_id", e.target.value)}
                            placeholder="UUID"
                            className="w-52 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Set Qty</label>
                          <input type="number" min="0" value={sf.quantity} onChange={(e) => setStockFormField(wh.id, "quantity", e.target.value)}
                            className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Low Stock</label>
                          <input type="number" min="0" value={sf.threshold} onChange={(e) => setStockFormField(wh.id, "threshold", e.target.value)}
                            className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                        </div>
                        <button
                          onClick={() => setStock.mutate({ whId: wh.id, data: { product_id: sf.product_id, quantity: parseInt(sf.quantity, 10), low_stock_threshold: parseInt(sf.threshold || "10", 10) } })}
                          disabled={!sf.product_id || !sf.quantity || !sf.threshold || pendingWhId === wh.id}
                          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs disabled:opacity-50">
                          Set Stock
                        </button>
                        <div className="border-l border-slate-300 pl-3">
                          <label className="block text-xs text-slate-500 mb-1">Adjust (+/-)</label>
                          <input type="number" value={sf.delta} onChange={(e) => setStockFormField(wh.id, "delta", e.target.value)}
                            placeholder="e.g. -5 or 10"
                            className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                        </div>
                        <button
                          onClick={() => adjustStock.mutate({ whId: wh.id, data: { product_id: sf.product_id, delta: parseInt(sf.delta, 10) } })}
                          disabled={!sf.product_id || !sf.delta || pendingWhId === wh.id}
                          className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs disabled:opacity-50">
                          Adjust
                        </button>
                      </div>
                      {stockError && <p className="text-xs text-red-600">{stockError}</p>}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

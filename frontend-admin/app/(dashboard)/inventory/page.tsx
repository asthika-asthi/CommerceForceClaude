"use client"
import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { ProductSearchCombobox } from "@/components/ui/product-search-combobox"
import { ChevronDown, ChevronRight } from "lucide-react"

import type { Warehouse, ProductVariantSummary, StockTransferResult } from "@/lib/types"

const DEFAULT_SF = { product_id: "", variant_id: "", quantity: "", threshold: "10", delta: "" }

function VariantPicker({
  whId,
  productId,
  variantId,
  onProductChange,
  onVariantChange,
}: {
  whId: string
  productId: string
  variantId: string
  onProductChange: (whId: string, productId: string) => void
  onVariantChange: (whId: string, variantId: string) => void
}) {
  const { data: variants = [] } = useQuery<ProductVariantSummary[]>({
    queryKey: ["variants", productId],
    queryFn: () => api.get(`/api/products/${productId}/variants`),
    enabled: !!productId,
  })

  function variantLabel(v: ProductVariantSummary): string {
    if (v.label) return `${v.label} (${v.sku})`
    return v.sku
  }

  return (
    <>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Product</label>
        <ProductSearchCombobox
          value={productId}
          onChange={(id) => onProductChange(whId, id)}
          className="w-48"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Variant</label>
        <select
          value={variantId}
          onChange={(e) => onVariantChange(whId, e.target.value)}
          disabled={!productId}
          className="w-48 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
        >
          <option value="">Select variant…</option>
          {variants.map((v) => (
            <option key={v.id} value={v.id}>{variantLabel(v)}</option>
          ))}
        </select>
      </div>
    </>
  )
}

export default function InventoryPage() {
  const qc = useQueryClient()
  const { data: warehouses = [], isLoading } = useQuery<Warehouse[]>({
    queryKey: ["warehouses"],
    queryFn: () => api.get("/api/inventory/warehouses"),
  })
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [stockForms, setStockForms] = useState<Record<string, { product_id: string; variant_id: string; quantity: string; threshold: string; delta: string }>>({})
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({ name: "", code: "", address: "", is_default: false })
  const [createError, setCreateError] = useState("")
  const [stockError, setStockError] = useState("")
  const [pendingWhId, setPendingWhId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const [xferFrom, setXferFrom] = useState("")
  const [xferTo, setXferTo] = useState("")
  const [xferProduct, setXferProduct] = useState("")
  const [xferVariants, setXferVariants] = useState<ProductVariantSummary[]>([])
  const [xferVariant, setXferVariant] = useState("")
  const [xferQty, setXferQty] = useState(1)
  const [xferLoading, setXferLoading] = useState(false)
  const [xferMsg, setXferMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!xferProduct) {
      setXferVariants([])
      setXferVariant("")
      return
    }
    api.get<ProductVariantSummary[]>(`/api/products/${xferProduct}/variants`)
      .then((data) => { setXferVariants(data); setXferVariant("") })
      .catch(() => { setXferVariants([]); setXferVariant("") })
  }, [xferProduct])

  async function handleTransfer() {
    setXferLoading(true)
    setXferMsg(null)
    try {
      const result: StockTransferResult = await api.post("/api/inventory/transfers", {
        from_warehouse_id: xferFrom,
        to_warehouse_id: xferTo,
        variant_id: xferVariant,
        quantity: xferQty,
      })
      setXferMsg({ ok: true, text: `Transfer complete. From: ${result.from_stock.quantity} units remaining. To: ${result.to_stock.quantity} units total.` })
      qc.invalidateQueries({ queryKey: ["warehouses"] })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transfer failed"
      setXferMsg({ ok: false, text: msg })
    } finally {
      setXferLoading(false)
    }
  }

  const deleteWH = useMutation({
    mutationFn: (id: string) => api.del(`/api/inventory/warehouses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["warehouses"] }); setDeleteTarget(null) },
  })

  const createWH = useMutation({
    mutationFn: (d: typeof createForm) => api.post("/api/inventory/warehouses", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["warehouses"] }); setShowCreateForm(false); setCreateForm({ name: "", code: "", address: "", is_default: false }); setCreateError("") },
    onError: (e) => setCreateError(e instanceof Error ? e.message : "Failed"),
  })

  const setStock = useMutation({
    mutationFn: ({ whId, data }: { whId: string; data: { variant_id: string; quantity: number; low_stock_threshold: number } }) => {
      setPendingWhId(whId)
      return api.post(`/api/inventory/warehouses/${whId}/stock`, data)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["warehouses"] }); setPendingWhId(null); setStockError("") },
    onError: (e) => { setStockError(e instanceof Error ? e.message : "Failed"); setPendingWhId(null) },
  })

  const adjustStock = useMutation({
    mutationFn: ({ whId, data }: { whId: string; data: { variant_id: string; delta: number } }) => {
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

  function handleProductChange(whId: string, productId: string) {
    setStockForms((f) => ({ ...f, [whId]: { ...(f[whId] ?? DEFAULT_SF), product_id: productId, variant_id: "" } }))
  }

  function handleVariantChange(whId: string, variantId: string) {
    setStockFormField(whId, "variant_id", variantId)
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
                  <div className="flex items-center gap-3">
                    <StatusBadge value={wh.is_active ? "active" : "inactive"} />
                    {!wh.is_default && (
                      <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: wh.id, name: wh.name }) }}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {expanded[wh.id] && (
                  <>
                    {wh.stock_items.length > 0 && (
                      <table className="w-full text-sm border-t border-slate-100">
                        <thead className="bg-slate-50">
                          <tr>
                            {["Variant", "Qty", "Reserved", "Available", "Low Stock"].map((h) => (
                              <th key={h} className="text-left px-4 py-2 text-xs font-medium text-slate-500">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {wh.stock_items.map((s) => (
                            <tr key={s.id}>
                              <td className="px-4 py-2 font-mono text-xs text-slate-600">
                                {s.variant_label ? s.variant_label : s.variant_id.slice(0, 12) + "…"}
                              </td>
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
                        <VariantPicker
                          whId={wh.id}
                          productId={sf.product_id}
                          variantId={sf.variant_id}
                          onProductChange={handleProductChange}
                          onVariantChange={handleVariantChange}
                        />
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
                          onClick={() => setStock.mutate({ whId: wh.id, data: { variant_id: sf.variant_id, quantity: parseInt(sf.quantity, 10), low_stock_threshold: parseInt(sf.threshold || "10", 10) } })}
                          disabled={!sf.variant_id || !sf.quantity || !sf.threshold || pendingWhId === wh.id}
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
                          onClick={() => adjustStock.mutate({ whId: wh.id, data: { variant_id: sf.variant_id, delta: parseInt(sf.delta, 10) } })}
                          disabled={!sf.variant_id || !sf.delta || pendingWhId === wh.id}
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

      {/* Transfer Stock card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 mt-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Transfer Stock</h2>
        <p className="text-sm text-slate-500 mb-4">
          Move stock of a variant from one warehouse to another in a single atomic operation.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* From warehouse */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From warehouse</label>
            <select value={xferFrom} onChange={e => setXferFrom(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select…</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
            </select>
          </div>

          {/* To warehouse */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To warehouse</label>
            <select value={xferTo} onChange={e => setXferTo(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select…</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
            </select>
          </div>

          {/* Product search */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Product</label>
            <ProductSearchCombobox
              value={xferProduct}
              onChange={(id) => { setXferProduct(id); setXferVariant("") }}
            />
          </div>

          {/* Variant dropdown */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Variant</label>
            <select value={xferVariant} onChange={e => setXferVariant(e.target.value)}
              disabled={!xferProduct}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50">
              <option value="">Select…</option>
              {xferVariants.filter(v => !v.is_default).map(v => <option key={v.id} value={v.id}>{v.label} ({v.sku})</option>)}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
            <input type="number" min={1} value={xferQty}
              onChange={e => setXferQty(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <button
          onClick={handleTransfer}
          disabled={xferLoading || !xferFrom || !xferTo || !xferVariant || xferQty < 1}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {xferLoading ? "Transferring…" : "Transfer"}
        </button>

        {xferMsg && (
          <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${xferMsg.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {xferMsg.text}
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-slate-800 mb-2">Delete warehouse?</h3>
            <p className="text-sm text-slate-600 mb-4">This will permanently delete <span className="font-semibold">{deleteTarget.name}</span> and all its stock records.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600">Cancel</button>
              <button onClick={() => deleteWH.mutate(deleteTarget.id)} disabled={deleteWH.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-50">
                {deleteWH.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

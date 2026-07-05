"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { DiscountRule } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { CURRENCY_SYMBOL } from "@/lib/currency"

const emptyForm = {
  name: "",
  description: "",
  discount_type: "percentage",
  discount_value: "",
  min_order_value: "",
  priority: "0",
  is_active: true,
}

export default function DiscountRulesPage() {
  const qc = useQueryClient()
  const { data: rules = [], isLoading } = useQuery<DiscountRule[]>({
    queryKey: ["discount_rules"],
    queryFn: () => api.get("/api/discount_rules"),
  })
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)

  const create = useMutation({
    mutationFn: (d: typeof form) =>
      api.post("/api/discount_rules", {
        name: d.name,
        description: d.description || undefined,
        discount_type: d.discount_type,
        discount_value: d.discount_value,
        min_order_value: d.min_order_value || undefined,
        priority: Number(d.priority),
        is_active: d.is_active,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discount_rules"] })
      setShowForm(false)
      setForm(emptyForm)
      setError("")
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed"),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/api/discount_rules/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discount_rules"] }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/discount_rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discount_rules"] }),
  })

  return (
    <div>
      <PageHeader
        title="Discount Rules"
        description="Automatic discounts applied at checkout"
        action={{ label: "+ New Rule", onClick: () => setShowForm((v) => !v) }}
      />

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(form) }}
          className="bg-white rounded-xl border border-slate-200 p-5 mb-6 grid grid-cols-3 gap-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
            <select
              value={form.discount_type}
              onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed ({CURRENCY_SYMBOL})</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Value *</label>
            <input
              type="number"
              step="0.01"
              value={form.discount_value}
              onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Min Order Value</label>
            <input
              type="number"
              step="0.01"
              value={form.min_order_value}
              onChange={(e) => setForm((f) => ({ ...f, min_order_value: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
            <input
              type="number"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input
              id="is_active"
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            <label htmlFor="is_active" className="text-sm text-slate-700">Active</label>
          </div>
          {error && <p className="col-span-3 text-sm text-red-600">{error}</p>}
          <div className="col-span-3 flex gap-2">
            <button
              type="submit"
              disabled={create.isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {create.isPending ? "Creating…" : "Create Rule"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError("") }}
              className="px-4 py-2 rounded-lg text-sm border border-slate-300 text-slate-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Name", "Type", "Value", "Min Order", "Priority", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">No discount rules</td>
                </tr>
              )}
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    {r.name}
                    {r.description && (
                      <p className="text-xs text-slate-400 font-normal">{r.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 capitalize">{r.discount_type}</td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {r.discount_type === "percentage" ? `${r.discount_value}%` : `${CURRENCY_SYMBOL}${r.discount_value}`}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {r.min_order_value ? `${CURRENCY_SYMBOL}${r.min_order_value}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{r.priority}</td>
                  <td className="px-4 py-2.5">
                    <button
                      title={r.is_active ? "Click to deactivate" : "Click to activate"}
                      onClick={() => toggleActive.mutate({ id: r.id, is_active: !r.is_active })}
                      disabled={toggleActive.isPending}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${r.is_active ? "bg-blue-600" : "bg-slate-200"}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${r.is_active ? "translate-x-4" : "translate-x-0"}`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => remove.mutate(r.id)}
                      disabled={remove.isPending}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
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

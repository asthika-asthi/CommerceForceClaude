"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Coupon } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"

export default function CouponsPage() {
  const qc = useQueryClient()
  const { data: coupons = [], isLoading } = useQuery<Coupon[]>({
    queryKey: ["coupons"],
    queryFn: () => api.get("/api/coupons"),
  })
  const [form, setForm] = useState({
    code: "", name: "", discount_type: "percentage", discount_value: "",
    min_order_value: "", max_uses: "", expires_at: "",
  })
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; code: string } | null>(null)

  const create = useMutation({
    mutationFn: (d: typeof form) =>
      api.post("/api/coupons", {
        code: d.code, name: d.name,
        discount_type: d.discount_type,
        discount_value: d.discount_value,
        min_order_value: d.min_order_value || undefined,
        max_uses: d.max_uses ? Number(d.max_uses) : undefined,
        expires_at: d.expires_at || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coupons"] })
      setShowForm(false)
      setForm({ code: "", name: "", discount_type: "percentage", discount_value: "", min_order_value: "", max_uses: "", expires_at: "" })
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed"),
  })

  const deactivate = useMutation({
    mutationFn: ({ id }: { id: string }) => api.put(`/api/coupons/${id}`, { is_active: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  })

  const toggleHomepage = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      api.put(`/api/coupons/${id}`, { show_on_homepage: value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  })

  const deleteCoupon = useMutation({
    mutationFn: (id: string) => api.del(`/api/coupons/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coupons"] }); setDeleteTarget(null) },
  })

  return (
    <div>
      <PageHeader
        title="Coupons"
        description="Discount codes and promotions"
        action={{ label: "+ New Coupon", onClick: () => setShowForm((v) => !v) }}
      />

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form) }}
          className="bg-white rounded-xl border border-slate-200 p-5 mb-6 grid grid-cols-3 gap-4">
          {[
            { key: "code", label: "Code *" },
            { key: "name", label: "Name *" },
            { key: "discount_value", label: "Discount Value *", type: "number" },
            { key: "min_order_value", label: "Min Order Value", type: "number" },
            { key: "max_uses", label: "Max Uses", type: "number" },
            { key: "expires_at", label: "Expires At", type: "datetime-local" },
          ].map(({ key, label, type = "text" }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              <input type={type} value={(form as Record<string, string>)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                required={label.endsWith("*")}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
            <select value={form.discount_type}
              onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed ($)</option>
            </select>
          </div>
          {error && <p className="col-span-3 text-sm text-red-600">{error}</p>}
          <div className="col-span-3 flex gap-2">
            <button type="submit" disabled={create.isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {create.isPending ? "Creating…" : "Create Coupon"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm border border-slate-300 text-slate-600">
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Code", "Name", "Type", "Value", "Uses", "Status", "Expires", "Homepage", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coupons.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-slate-400">No coupons</td></tr>
              )}
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono font-bold text-slate-800">{c.code}</td>
                  <td className="px-4 py-2.5 text-slate-700">{c.name}</td>
                  <td className="px-4 py-2.5 text-slate-500 capitalize">{c.discount_type}</td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {c.discount_type === "percentage" ? `${c.discount_value}%` : `£${c.discount_value}`}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {c.used_count}{c.max_uses ? `/${c.max_uses}` : ""}
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge value={c.is_active ? "active" : "inactive"} /></td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">
                    {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        title={c.show_on_homepage ? "Shown on homepage — click to hide" : "Click to show on homepage (only one coupon can be shown at a time)"}
                        onClick={() => toggleHomepage.mutate({ id: c.id, value: !c.show_on_homepage })}
                        disabled={toggleHomepage.isPending}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${c.show_on_homepage ? "bg-blue-600" : "bg-slate-200"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${c.show_on_homepage ? "translate-x-4" : "translate-x-0"}`} />
                      </button>
                      {c.show_on_homepage && <span className="text-xs text-blue-600 font-medium">On</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 flex items-center gap-2">
                    {c.is_active && (
                      <button onClick={() => deactivate.mutate({ id: c.id })}
                        className="text-xs text-orange-500 hover:text-orange-700">Deactivate</button>
                    )}
                    <button onClick={() => setDeleteTarget({ id: c.id, code: c.code })}
                      className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-slate-800 mb-2">Delete coupon?</h3>
            <p className="text-sm text-slate-600 mb-4">This will permanently delete coupon <span className="font-mono font-bold">{deleteTarget.code}</span>. This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600">Cancel</button>
              <button onClick={() => deleteCoupon.mutate(deleteTarget.id)} disabled={deleteCoupon.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-50">
                {deleteCoupon.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

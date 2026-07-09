"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { Trash2, Plus, Pencil, Check, X } from "lucide-react"

interface TaxZone {
  id: string
  name: string
  countries: string
  rate_percent: string
  is_active: boolean
}

const BLANK: Omit<TaxZone, "id"> = { name: "", countries: "", rate_percent: "0.00", is_active: true }

function ZoneRow({
  zone, onSave, onDelete,
}: {
  zone: TaxZone | null
  onSave: (data: Omit<TaxZone, "id">) => void
  onDelete?: () => void
}) {
  const [editing, setEditing] = useState(zone === null)
  const [form, setForm] = useState<Omit<TaxZone, "id">>(
    zone ? { name: zone.name, countries: zone.countries, rate_percent: zone.rate_percent, is_active: zone.is_active } : BLANK
  )

  function save() { onSave(form); if (zone) setEditing(false) }

  if (!editing && zone) {
    return (
      <tr className="border-t border-slate-100">
        <td className="py-2.5 px-3 text-sm">{zone.name}</td>
        <td className="py-2.5 px-3 text-sm font-mono text-slate-600">{zone.countries}</td>
        <td className="py-2.5 px-3 text-sm">{parseFloat(zone.rate_percent).toFixed(2)}%</td>
        <td className="py-2.5 px-3 text-sm">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${zone.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
            {zone.is_active ? "Active" : "Inactive"}
          </span>
        </td>
        <td className="py-2.5 px-3">
          <div className="flex gap-1">
            <button onClick={() => setEditing(true)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {onDelete && (
              <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-t border-slate-100 bg-slate-50">
      <td className="py-2 px-3">
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="UK VAT" className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
      </td>
      <td className="py-2 px-3">
        <input value={form.countries} onChange={e => setForm(f => ({ ...f, countries: e.target.value }))}
          placeholder="GB,IE or *" className="w-full border border-slate-300 rounded px-2 py-1 text-sm font-mono" />
      </td>
      <td className="py-2 px-3">
        <div className="flex items-center gap-1">
          <input type="number" step="0.01" min="0" max="100" value={form.rate_percent}
            onChange={e => setForm(f => ({ ...f, rate_percent: e.target.value }))}
            className="w-20 border border-slate-300 rounded px-2 py-1 text-sm" />
          <span className="text-sm text-slate-500">%</span>
        </div>
      </td>
      <td className="py-2 px-3">
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
          Active
        </label>
      </td>
      <td className="py-2 px-3">
        <div className="flex gap-1">
          <button onClick={save} className="p-1.5 rounded hover:bg-green-50 text-green-600">
            <Check className="w-3.5 h-3.5" />
          </button>
          {zone && (
            <button onClick={() => setEditing(false)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function TaxPage() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)

  const { data: zones = [], isLoading } = useQuery<TaxZone[]>({
    queryKey: ["tax-zones"],
    queryFn: () => api.get("/api/tax/zones"),
  })

  const create = useMutation({
    mutationFn: (data: Omit<TaxZone, "id">) => api.post("/api/tax/zones", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tax-zones"] }); setAdding(false) },
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<TaxZone, "id"> }) =>
      api.put(`/api/tax/zones/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax-zones"] }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/tax/zones/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax-zones"] }),
  })

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Tax Zones"
        description="Configure VAT/tax rates per destination. Enter country codes (e.g. GB,IE) or * for a catch-all zone. Tax is calculated on the order subtotal after discounts, before shipping."
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Zone</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Countries</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Rate</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="py-2.5 px-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">Loading…</td></tr>
            )}
            {!isLoading && zones.length === 0 && !adding && (
              <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">No tax zones yet. Add one below.</td></tr>
            )}
            {zones.map(zone => (
              <ZoneRow key={zone.id} zone={zone}
                onSave={data => update.mutate({ id: zone.id, data })}
                onDelete={() => remove.mutate(zone.id)} />
            ))}
            {adding && (
              <ZoneRow zone={null} onSave={data => create.mutate(data)} />
            )}
          </tbody>
        </table>

        <div className="p-3 border-t border-slate-100">
          <button onClick={() => setAdding(true)} disabled={adding}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50">
            <Plus className="w-4 h-4" />
            Add zone
          </button>
        </div>
      </div>

      <div className="mt-4 p-4 bg-slate-50 rounded-xl text-xs text-slate-500 space-y-1">
        <p><strong>Country codes:</strong> Use ISO 3166-1 alpha-2 codes, comma-separated (e.g. <code className="bg-white px-1 rounded">GB,IE</code>).</p>
        <p><strong>Catch-all:</strong> Use <code className="bg-white px-1 rounded">*</code> to match any country not covered by a specific zone.</p>
        <p><strong>Priority:</strong> Exact country match wins over catch-all. 0% = no tax charged for that zone.</p>
      </div>
    </div>
  )
}

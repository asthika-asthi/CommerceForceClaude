"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { Trash2, Plus, Pencil, Check, X } from "lucide-react"

interface ShippingZone {
  id: string
  name: string
  countries: string
  flat_rate: string
  is_active: boolean
}

const BLANK: Omit<ShippingZone, "id"> = { name: "", countries: "", flat_rate: "0.00", is_active: true }

function ZoneRow({
  zone, onSave, onDelete,
}: {
  zone: ShippingZone | null
  onSave: (data: Omit<ShippingZone, "id">) => void
  onDelete?: () => void
}) {
  const [editing, setEditing] = useState(zone === null)
  const [form, setForm] = useState<Omit<ShippingZone, "id">>(
    zone ? { name: zone.name, countries: zone.countries, flat_rate: zone.flat_rate, is_active: zone.is_active } : BLANK
  )

  function save() { onSave(form); if (zone) setEditing(false) }

  if (!editing && zone) {
    return (
      <tr className="border-t border-slate-100">
        <td className="py-2.5 px-3 text-sm">{zone.name}</td>
        <td className="py-2.5 px-3 text-sm font-mono text-slate-600">{zone.countries}</td>
        <td className="py-2.5 px-3 text-sm">£{parseFloat(zone.flat_rate).toFixed(2)}</td>
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
          placeholder="UK Standard" className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
      </td>
      <td className="py-2 px-3">
        <input value={form.countries} onChange={e => setForm(f => ({ ...f, countries: e.target.value }))}
          placeholder="GB,IE or *" className="w-full border border-slate-300 rounded px-2 py-1 text-sm font-mono" />
      </td>
      <td className="py-2 px-3">
        <div className="flex items-center gap-1">
          <span className="text-sm text-slate-500">£</span>
          <input type="number" step="0.01" min="0" value={form.flat_rate}
            onChange={e => setForm(f => ({ ...f, flat_rate: e.target.value }))}
            className="w-20 border border-slate-300 rounded px-2 py-1 text-sm" />
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

export default function ShippingPage() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)

  const { data: zones = [], isLoading } = useQuery<ShippingZone[]>({
    queryKey: ["shipping-zones"],
    queryFn: () => api.get("/api/shipping/zones"),
  })

  const create = useMutation({
    mutationFn: (data: Omit<ShippingZone, "id">) => api.post("/api/shipping/zones", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shipping-zones"] }); setAdding(false) },
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<ShippingZone, "id"> }) =>
      api.put(`/api/shipping/zones/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shipping-zones"] }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/shipping/zones/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shipping-zones"] }),
  })

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Shipping Zones"
        description="Configure flat-rate shipping costs per destination. Enter country codes (e.g. GB,IE) or * for a catch-all zone."
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Zone</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Countries</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Flat Rate</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="py-2.5 px-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">Loading…</td></tr>
            )}
            {!isLoading && zones.length === 0 && !adding && (
              <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">No shipping zones yet. Add one below.</td></tr>
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
        <p><strong>Priority:</strong> Exact country match wins over catch-all. £0.00 = free shipping for that zone.</p>
      </div>
    </div>
  )
}

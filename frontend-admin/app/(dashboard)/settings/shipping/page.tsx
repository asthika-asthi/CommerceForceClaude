"use client"
import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { Trash2, Plus, Pencil, Check, X } from "lucide-react"
import { CURRENCY_SYMBOL, formatMoney } from "@/lib/currency"

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

interface DeliveryBand { min_order_value: string; charge: string }
interface DeliveryBandsData { bands: DeliveryBand[]; free_threshold: string | null }

function DeliveryBandsCard() {
  const qc = useQueryClient()
  const { data } = useQuery<DeliveryBandsData>({
    queryKey: ["shipping-bands"],
    queryFn: () => api.get("/api/shipping/bands"),
  })
  const [rows, setRows] = useState<DeliveryBand[]>([])
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed the editor once the saved bands load
    if (data) setRows(data.bands.map(b => ({ min_order_value: String(parseFloat(b.min_order_value)), charge: String(parseFloat(b.charge)) })))
  }, [data])

  const save = useMutation({
    mutationFn: (bands: DeliveryBand[]) => api.put("/api/shipping/bands", { bands }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipping-bands"] })
      setError(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Save failed"),
  })

  // Mirrors the backend rules so problems show before saving.
  const mins = rows.map(r => parseFloat(r.min_order_value))
  const problem =
    rows.length === 0 ? "Add at least one band."
    : rows.some(r => isNaN(parseFloat(r.min_order_value)) || isNaN(parseFloat(r.charge))) ? "Fill in every amount."
    : rows.some(r => parseFloat(r.min_order_value) < 0 || parseFloat(r.charge) < 0) ? "Amounts can't be negative."
    : new Set(mins).size !== mins.length ? "Each band must start at a different order value."
    : Math.min(...mins) !== 0 ? "The first band must start at 0 so every order has a charge."
    : null

  const sorted = [...rows].sort((a, b) => parseFloat(a.min_order_value) - parseFloat(b.min_order_value))
  const money = (v: string | number) => formatMoney(parseFloat(String(v)).toFixed(2))
  const preview = problem ? [] : sorted.map((b, i) => {
    const next = sorted[i + 1]
    const charge = parseFloat(b.charge) === 0 ? "Free" : money(b.charge)
    const range = !next ? `${money(b.min_order_value)} or more`
      : parseFloat(b.min_order_value) === 0 ? `Under ${money(next.min_order_value)}`
      : `${money(b.min_order_value)} to under ${money(next.min_order_value)}`
    return `${range}: ${charge}`
  })
  const allZero = rows.length > 0 && rows.every(r => parseFloat(r.charge) === 0)

  function setRow(i: number, patch: Partial<DeliveryBand>) {
    setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
      <h3 className="text-sm font-semibold text-slate-800 mb-1">Delivery charges by order value</h3>
      <p className="text-xs text-slate-500 mb-3">
        An order pays the charge of the highest band it reaches. Order value is measured after discounts and
        before VAT. A charge of 0 means free delivery. These amounts drive checkout and the delivery
        wording on the home page, cart, terms and FAQs.
      </p>
      {allZero && (
        <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 mb-3">
          Every band is currently free, so customers are not charged for delivery. Enter your charges below.
        </p>
      )}
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-sm text-slate-500 w-20">Orders from</span>
            <span className="text-sm text-slate-500">{CURRENCY_SYMBOL}</span>
            <input type="number" step="0.01" min="0" value={row.min_order_value}
              onChange={e => setRow(i, { min_order_value: e.target.value })}
              className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-sm text-slate-500 ml-2">pay</span>
            <span className="text-sm text-slate-500">{CURRENCY_SYMBOL}</span>
            <input type="number" step="0.01" min="0" value={row.charge}
              onChange={e => setRow(i, { charge: e.target.value })}
              className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="button" aria-label="Remove band" disabled={rows.length <= 1}
              onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}
              className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-500 disabled:opacity-30">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setRows(rs => [...rs, { min_order_value: "", charge: "" }])}
        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium mt-3">
        <Plus className="w-4 h-4" /> Add band
      </button>
      {problem ? (
        <p className="text-xs text-red-600 mt-3">{problem}</p>
      ) : (
        <ul className="mt-3 text-xs text-slate-600 space-y-0.5">
          {preview.map(line => <li key={line}>{line}</li>)}
        </ul>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button type="button" disabled={!!problem || save.isPending} onClick={() => save.mutate(rows)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {save.isPending ? "Saving…" : saved ? "Saved!" : "Save bands"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}

function DefaultWeightCard() {
  const qc = useQueryClient()
  const { data } = useQuery<{ default_weight_kg: string }>({
    queryKey: ["shipping-settings"],
    queryFn: () => api.get("/api/shipping/settings"),
  })
  const [value, setValue] = useState("")
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed the input once the saved value loads
    if (data) setValue(String(parseFloat(data.default_weight_kg)))
  }, [data])

  const save = useMutation({
    mutationFn: (kg: string) => api.put("/api/shipping/settings", { default_weight_kg: kg }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipping-settings"] })
      setError(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Save failed"),
  })

  const invalid = value.trim() === "" || isNaN(parseFloat(value)) || parseFloat(value) < 0

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
      <h3 className="text-sm font-semibold text-slate-800 mb-1">Default parcel weight</h3>
      <p className="text-xs text-slate-500 mb-3">
        Used at checkout for any product (or variant) with no weight entered, so the cart&apos;s total
        parcel weight is never undercounted. Products missing a weight are flagged &ldquo;No weight&rdquo;
        in the product list.
      </p>
      <div className="flex items-center gap-2">
        <input type="number" step="0.001" min="0" value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-28 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-sm text-slate-500">kg</span>
        <button type="button" disabled={invalid || save.isPending} onClick={() => save.mutate(value.trim())}
          className="ml-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {save.isPending ? "Saving…" : saved ? "Saved!" : "Save"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
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
        title="Shipping"
        description="Set delivery charges by order value, and choose which countries you deliver to. Enter country codes (e.g. GB,IE) or * for a catch-all zone."
      />

      <DeliveryBandsCard />

      <DefaultWeightCard />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Zone</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Countries</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="py-2.5 px-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={4} className="py-8 text-center text-sm text-slate-400">Loading…</td></tr>
            )}
            {!isLoading && zones.length === 0 && !adding && (
              <tr><td colSpan={4} className="py-8 text-center text-sm text-slate-400">No shipping zones yet. Add one below.</td></tr>
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
        <p><strong>Priority:</strong> Exact country match wins over catch-all. Zones only decide where you deliver; the charge comes from the delivery bands above. Countries with no zone are not charged.</p>
      </div>
    </div>
  )
}

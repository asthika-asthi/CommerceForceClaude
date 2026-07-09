"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import type { Address } from "@/lib/types"
import { ArrowLeft, Plus, Star, Trash2, Pencil, Check, X } from "lucide-react"

const blank = { label: "", line1: "", line2: "", city: "", county: "", postcode: "", country: "GB", is_default: false }

export default function AddressesPage() {
  const user = useAuthStore((s) => s.user)
  const router = useRouter()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...blank })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!user) { router.push("/login"); return }
    api.get<Address[]>("/api/addresses").then(setAddresses).catch(() => setAddresses([])).finally(() => setLoading(false))
  }, [user, router])

  function startAdd() {
    setEditId(null)
    setForm({ ...blank })
    setShowForm(true)
  }

  function startEdit(addr: Address) {
    setEditId(addr.id)
    setForm({ label: addr.label ?? "", line1: addr.line1, line2: addr.line2 ?? "", city: addr.city, county: addr.county ?? "", postcode: addr.postcode, country: addr.country, is_default: addr.is_default })
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setEditId(null)
    setError("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      if (editId) {
        const updated = await api.put<Address>(`/api/addresses/${editId}`, form)
        setAddresses((prev) => prev.map((a) => a.id === editId ? updated : (form.is_default ? { ...a, is_default: false } : a)))
      } else {
        const created = await api.post<Address>("/api/addresses", form)
        setAddresses((prev) => {
          const cleared = form.is_default ? prev.map((a) => ({ ...a, is_default: false })) : prev
          return [...cleared, created]
        })
      }
      setShowForm(false)
      setEditId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this address?")) return
    try {
      await api.del(`/api/addresses/${id}`)
      setAddresses((prev) => prev.filter((a) => a.id !== id))
    } catch {
      setError("Failed to delete address. Please try again.")
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await api.post<Address>(`/api/addresses/${id}/set-default`, {})
      setAddresses((prev) => prev.map((a) => ({ ...a, is_default: a.id === id })))
    } catch {
      setError("Failed to update default address. Please try again.")
    }
  }

  function f(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  if (!user || loading) return <div className="flex justify-center py-20 text-slate-400">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link href="/account" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={14} /> Back to account
      </Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Saved addresses</h1>
        {!showForm && (
          <button onClick={startAdd} className="flex items-center gap-1.5 bg-brand hover:bg-brand-hover text-on-brand text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={14} /> Add address
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-100 rounded-2xl p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-slate-900">{editId ? "Edit address" : "New address"}</h2>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Label (optional)</label>
            <input value={form.label} onChange={f("label")} placeholder="e.g. Home, Work"
              className={inp} />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Address line 1 *</label>
            <input required value={form.line1} onChange={f("line1")} className={inp} />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Address line 2</label>
            <input value={form.line2} onChange={f("line2")} className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Town / City *</label>
              <input required value={form.city} onChange={f("city")} className={inp} />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">County</label>
              <input value={form.county} onChange={f("county")} className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Postcode *</label>
              <input required value={form.postcode} onChange={f("postcode")} className={inp} />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Country *</label>
              <input required value={form.country} onChange={f("country")} className={inp} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.is_default} onChange={(e) => setForm((p) => ({ ...p, is_default: e.target.checked }))} className="rounded" />
            Set as default address
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="bg-brand hover:bg-brand-hover text-on-brand text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-50 transition-colors">
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={cancel} className="text-sm text-slate-500 hover:text-slate-800 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {addresses.length === 0 && !showForm ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400">
          <p className="mb-3">No saved addresses yet.</p>
          <button onClick={startAdd} className="text-brand-dark text-sm hover:underline">Add your first address</button>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <div key={addr.id} className={`bg-white border rounded-2xl p-5 ${addr.is_default ? "border-brand-dark ring-1 ring-brand-dark/20" : "border-slate-100"}`}>
              <div className="flex items-start justify-between">
                <div>
                  {addr.label && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{addr.label}</p>}
                  {addr.is_default && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-dark bg-brand/10 px-2 py-0.5 rounded-full mb-2">
                      <Star size={10} fill="currentColor" /> Default
                    </span>
                  )}
                  <p className="text-sm text-slate-800">{addr.line1}</p>
                  {addr.line2 && <p className="text-sm text-slate-800">{addr.line2}</p>}
                  <p className="text-sm text-slate-800">{addr.city}{addr.county ? `, ${addr.county}` : ""} {addr.postcode}</p>
                  <p className="text-sm text-slate-600">{addr.country}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  {!addr.is_default && (
                    <button onClick={() => handleSetDefault(addr.id)} className="text-xs text-slate-500 hover:text-brand-dark border border-slate-200 hover:border-brand-dark px-2 py-1 rounded-lg transition-colors">
                      Set default
                    </button>
                  )}
                  <button onClick={() => startEdit(addr)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(addr.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"

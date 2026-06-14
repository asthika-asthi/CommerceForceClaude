"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { ImageUpload } from "@/components/ui/image-upload"

interface PromotionBanner {
  id: string
  headline: string
  body: string
  cta_text: string
  cta_url: string
  image_url?: string
  expires_at?: string
  is_active: boolean
}

const EMPTY_FORM = {
  headline: "",
  body: "",
  cta_text: "",
  cta_url: "",
  image_url: "",
  expires_at: "",
  is_active: true,
}

export default function PromotionsPage() {
  const qc = useQueryClient()
  const { data: promotions = [], isLoading } = useQuery<PromotionBanner[]>({
    queryKey: ["promotions"],
    queryFn: () => api.get("/api/promotions"),
  })
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)

  const create = useMutation({
    mutationFn: (d: typeof form) =>
      api.post("/api/promotions", {
        headline: d.headline,
        body: d.body,
        cta_text: d.cta_text,
        cta_url: d.cta_url,
        image_url: d.image_url || undefined,
        expires_at: d.expires_at || undefined,
        is_active: d.is_active,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promotions"] })
      setShowForm(false)
      setForm(EMPTY_FORM)
      setError("")
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed to create promotion"),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.put(`/api/promotions/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promotions"] }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/promotions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promotions"] }),
  })

  function handleDelete(id: string, headline: string) {
    if (confirm(`Delete promotion "${headline}"? This cannot be undone.`)) {
      remove.mutate(id)
    }
  }

  return (
    <div>
      <PageHeader
        title="Promotions"
        description="Manage promotional banners shown on the storefront"
        action={{ label: "+ New Promotion", onClick: () => setShowForm((v) => !v) }}
      />

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(form) }}
          className="bg-white rounded-xl border border-slate-200 p-5 mb-6 grid grid-cols-2 gap-4"
        >
          {/* Headline */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Headline *</label>
            <input
              type="text"
              value={form.headline}
              onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* CTA Text */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">CTA Text *</label>
            <input
              type="text"
              value={form.cta_text}
              onChange={(e) => setForm((f) => ({ ...f, cta_text: e.target.value }))}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Body */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Body *</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              required
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* CTA URL */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">CTA URL *</label>
            <input
              type="text"
              value={form.cta_url}
              onChange={(e) => setForm((f) => ({ ...f, cta_url: e.target.value }))}
              required
              placeholder="/products"
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Expires At */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Expires At</label>
            <input
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Image URL + Upload */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Image URL</label>
            <input
              type="text"
              value={form.image_url}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
              placeholder="https://…"
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <ImageUpload
              value={form.image_url}
              onUpload={(url) => setForm((f) => ({ ...f, image_url: url }))}
              label="Upload Banner Image"
            />
          </div>

          {/* Active checkbox */}
          <div className="col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Active (show on storefront immediately)
            </label>
          </div>

          {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}

          <div className="col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={create.isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {create.isPending ? "Creating…" : "Create Promotion"}
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
                {["Headline", "Body", "CTA", "Status", "Expires", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {promotions.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    No promotions yet
                  </td>
                </tr>
              )}
              {promotions.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[180px]">
                    <div className="flex items-center gap-2">
                      {p.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image_url}
                          alt=""
                          className="w-8 h-8 object-cover rounded border border-slate-200 flex-shrink-0"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
                        />
                      )}
                      <span className="truncate">{p.headline}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 max-w-[220px]">
                    <span className="line-clamp-2 block" title={p.body}>
                      {p.body.length > 80 ? p.body.slice(0, 80) + "…" : p.body}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    <a
                      href={p.cta_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {p.cta_text}
                    </a>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => toggleActive.mutate({ id: p.id, is_active: !p.is_active })}
                      disabled={toggleActive.isPending}
                      className="disabled:opacity-50"
                      title={p.is_active ? "Click to deactivate" : "Click to activate"}
                    >
                      <StatusBadge value={p.is_active ? "active" : "inactive"} />
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">
                    {p.expires_at ? new Date(p.expires_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleDelete(p.id, p.headline)}
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

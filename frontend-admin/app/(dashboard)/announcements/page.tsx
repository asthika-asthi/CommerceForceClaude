"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"

interface Announcement {
  id: string
  text: string
  link_url?: string
  link_text?: string
  is_active: boolean
  starts_at?: string
  ends_at?: string
}

const EMPTY_FORM = {
  text: "",
  link_url: "",
  link_text: "",
  starts_at: "",
  ends_at: "",
  is_active: true,
}

export default function AnnouncementsPage() {
  const qc = useQueryClient()
  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ["announcements"],
    queryFn: () => api.get("/api/announcements"),
  })
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)

  const create = useMutation({
    mutationFn: (d: typeof form) =>
      api.post("/api/announcements", {
        text: d.text,
        link_url: d.link_url || undefined,
        link_text: d.link_text || undefined,
        starts_at: d.starts_at || undefined,
        ends_at: d.ends_at || undefined,
        is_active: d.is_active,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] })
      setShowForm(false)
      setForm(EMPTY_FORM)
      setError("")
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed to create announcement"),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.put(`/api/announcements/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/announcements/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  })

  function handleDelete(id: string, text: string) {
    if (confirm(`Delete announcement "${text.slice(0, 60)}…"? This cannot be undone.`)) {
      remove.mutate(id)
    }
  }

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Manage announcement banners shown on the storefront"
        action={{ label: "+ New Announcement", onClick: () => setShowForm((v) => !v) }}
      />

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(form) }}
          className="bg-white rounded-xl border border-slate-200 p-5 mb-6 grid grid-cols-2 gap-4"
        >
          {/* Text */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Text *</label>
            <textarea
              value={form.text}
              onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              required
              rows={3}
              placeholder="Announcement message…"
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Link URL */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Link URL</label>
            <input
              type="text"
              value={form.link_url}
              onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
              placeholder="/products/sale"
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Link Text */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Link Text</label>
            <input
              type="text"
              value={form.link_text}
              onChange={(e) => setForm((f) => ({ ...f, link_text: e.target.value }))}
              placeholder="Shop now"
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Starts At */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Starts At</label>
            <input
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Ends At */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ends At</label>
            <input
              type="datetime-local"
              value={form.ends_at}
              onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              {create.isPending ? "Creating…" : "Create Announcement"}
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
                {["Text", "Link", "Status", "Starts", "Ends", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {announcements.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    No announcements yet
                  </td>
                </tr>
              )}
              {announcements.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-800 max-w-[280px]">
                    <span className="line-clamp-2 block" title={a.text}>
                      {a.text.length > 100 ? a.text.slice(0, 100) + "…" : a.text}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {a.link_url ? (
                      <a
                        href={a.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {a.link_text || a.link_url}
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => toggleActive.mutate({ id: a.id, is_active: !a.is_active })}
                      disabled={toggleActive.isPending}
                      className="disabled:opacity-50"
                      title={a.is_active ? "Click to deactivate" : "Click to activate"}
                    >
                      <StatusBadge value={a.is_active ? "active" : "inactive"} />
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">
                    {a.starts_at ? new Date(a.starts_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">
                    {a.ends_at ? new Date(a.ends_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleDelete(a.id, a.text)}
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

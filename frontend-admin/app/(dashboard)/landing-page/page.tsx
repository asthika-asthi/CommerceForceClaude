"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { LandingSection, SectionType } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Trash2, GripVertical, Eye, EyeOff } from "lucide-react"

const SECTION_TYPES: SectionType[] = ["hero", "features", "testimonials", "cta", "html", "products"]

export default function LandingPagePage() {
  const qc = useQueryClient()
  const { data: sections = [], isLoading } = useQuery<LandingSection[]>({
    queryKey: ["landing-sections"],
    queryFn: () => api.get("/api/landing_page?active_only=false"),
  })
  const [form, setForm] = useState({
    section_type: "hero" as SectionType,
    title: "", subtitle: "", content: "",
    image_url: "", cta_text: "", cta_url: "",
    sort_order: "0", background_color: "",
  })
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState("")

  const create = useMutation({
    mutationFn: (d: typeof form) =>
      api.post("/api/landing_page", {
        ...d, sort_order: Number(d.sort_order),
        title: d.title || undefined, subtitle: d.subtitle || undefined,
        content: d.content || undefined, image_url: d.image_url || undefined,
        cta_text: d.cta_text || undefined, cta_url: d.cta_url || undefined,
        background_color: d.background_color || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["landing-sections"] })
      setShowForm(false)
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed"),
  })

  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.put(`/api/landing_page/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["landing-sections"] }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/landing_page/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["landing-sections"] }),
  })

  const sorted = [...sections].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div>
      <PageHeader
        title="Landing Page Sections"
        description="Drag-and-drop builder for your storefront homepage"
        action={{ label: "+ Add Section", onClick: () => setShowForm((v) => !v) }}
      />

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form) }}
          className="bg-white rounded-xl border border-slate-200 p-5 mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Section Type</label>
            <select value={form.section_type}
              onChange={(e) => setForm((f) => ({ ...f, section_type: e.target.value as SectionType }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
              {SECTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sort Order</label>
            <input type="number" value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          {[
            { key: "title", label: "Title" },
            { key: "subtitle", label: "Subtitle" },
            { key: "cta_text", label: "CTA Button Text" },
            { key: "cta_url", label: "CTA URL" },
            { key: "image_url", label: "Image URL" },
            { key: "background_color", label: "Background Color" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              <input value={(form as Record<string, string>)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Content (JSON or HTML)</label>
            <textarea value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm h-20 resize-none font-mono" />
          </div>
          {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
          <div className="col-span-2 flex gap-2">
            <button type="submit" disabled={create.isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {create.isPending ? "Adding…" : "Add Section"}
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
        <div className="space-y-2">
          {sorted.length === 0 && (
            <p className="text-center py-10 text-slate-400">No sections. Add one to get started.</p>
          )}
          {sorted.map((sec) => (
            <div key={sec.id}
              className={`bg-white rounded-xl border p-4 flex items-start gap-4 ${sec.is_active ? "border-slate-200" : "border-dashed border-slate-300 opacity-60"}`}>
              <GripVertical size={16} className="text-slate-300 mt-1 cursor-grab" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{sec.section_type}</span>
                  <span className="text-xs text-slate-400">order: {sec.sort_order}</span>
                  <StatusBadge value={sec.is_active ? "active" : "inactive"} />
                </div>
                {sec.title && <p className="text-sm font-medium text-slate-800">{sec.title}</p>}
                {sec.subtitle && <p className="text-xs text-slate-500">{sec.subtitle}</p>}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => toggle.mutate({ id: sec.id, is_active: !sec.is_active })}
                  className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                  title={sec.is_active ? "Deactivate" : "Activate"}
                >
                  {sec.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button onClick={() => remove.mutate(sec.id)}
                  className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600"
                  title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

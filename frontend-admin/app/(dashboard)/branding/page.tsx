"use client"
import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { BrandingConfig } from "@/lib/types"
import { PageHeader } from "@/components/page-header"

const FIELDS = [
  { key: "store_name", label: "Store Name", placeholder: "My Store" },
  { key: "tagline", label: "Tagline", placeholder: "Your store tagline" },
  { key: "logo_url", label: "Logo URL", placeholder: "https://..." },
  { key: "favicon_url", label: "Favicon URL", placeholder: "https://..." },
  { key: "primary_color", label: "Primary Color", placeholder: "#1d4ed8", type: "color" },
  { key: "secondary_color", label: "Secondary Color", placeholder: "#ffffff", type: "color" },
  { key: "font_family", label: "Font Family", placeholder: "Inter" },
  { key: "contact_email", label: "Contact Email", placeholder: "hello@store.com" },
  { key: "contact_phone", label: "Contact Phone", placeholder: "+1 555-0100" },
]

type FormState = Partial<Record<string, string>>

export default function BrandingPage() {
  const qc = useQueryClient()
  const { data: config, isLoading } = useQuery<BrandingConfig>({
    queryKey: ["branding"],
    queryFn: () => api.get("/api/branding"),
  })
  const [form, setForm] = useState<FormState>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (config) {
      const f: FormState = {}
      FIELDS.forEach(({ key }) => { f[key] = (config as unknown as Record<string, string>)[key] ?? "" })
      f.custom_css = config.custom_css ?? ""
      f.social_links = config.social_links ?? ""
      setForm(f)
    }
  }, [config])

  const update = useMutation({
    mutationFn: (d: FormState) => api.put("/api/branding", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branding"] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Branding" description="Storefront identity and visual settings" />
      <form onSubmit={(e) => { e.preventDefault(); update.mutate(form) }}
        className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">

        <div className="grid grid-cols-2 gap-5">
          {FIELDS.map(({ key, label, placeholder, type }) => (
            <div key={key} className={type === "color" ? "flex flex-col" : ""}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              {type === "color" ? (
                <div className="flex items-center gap-2">
                  <input type="color" value={form[key] || "#000000"}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="h-9 w-12 cursor-pointer rounded border border-slate-300" />
                  <input value={form[key] || ""}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={placeholder} />
                </div>
              ) : (
                <input value={form[key] || ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={placeholder} />
              )}
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Social Links (JSON)</label>
          <input value={form.social_links || ""}
            onChange={(e) => setForm((f) => ({ ...f, social_links: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder='{"twitter": "https://...", "instagram": "https://..."}' />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Custom CSS</label>
          <textarea value={form.custom_css || ""}
            onChange={(e) => setForm((f) => ({ ...f, custom_css: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 h-28 resize-none"
            placeholder=":root { --brand: #1d4ed8; }" />
        </div>

        <button type="submit" disabled={update.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {update.isPending ? "Saving…" : saved ? "Saved!" : "Save Branding"}
        </button>
      </form>
    </div>
  )
}

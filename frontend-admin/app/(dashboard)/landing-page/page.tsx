"use client"
import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { EditableSection } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { ImageUpload } from "@/components/ui/image-upload"

type FormState = Record<string, { overrides: Record<string, string>; is_hidden: boolean }>

export default function LandingPagePage() {
  const qc = useQueryClient()
  const { data: sections = [], isLoading } = useQuery<EditableSection[]>({
    queryKey: ["editable-sections"],
    queryFn: () => api.get("/api/landing_page/editable"),
  })

  const [form, setForm] = useState<FormState>({})
  const [saveError, setSaveError] = useState<{ section_key: string; message: string } | null>(null)

  // Seed local form state from the fetched sections, once per fetch.
  useEffect(() => {
    if (sections.length === 0) return
    setForm((prev) => {
      const next: FormState = { ...prev }
      for (const s of sections) {
        if (next[s.section_key]) continue
        next[s.section_key] = {
          overrides: Object.fromEntries(s.fields.map((f) => [f.name, f.value])),
          is_hidden: s.is_hidden,
        }
      }
      return next
    })
  }, [sections])

  const save = useMutation({
    mutationFn: ({ section_key, overrides, is_hidden }: { section_key: string; overrides: Record<string, string>; is_hidden: boolean }) =>
      api.put(`/api/landing_page/${section_key}`, { overrides, is_hidden }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["editable-sections"] })
      setSaveError(null)
    },
    onError: (e, variables) =>
      setSaveError({ section_key: variables.section_key, message: e instanceof Error ? e.message : "Failed to save" }),
  })

  function updateField(sectionKey: string, fieldName: string, value: string) {
    setForm((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        overrides: { ...prev[sectionKey].overrides, [fieldName]: value },
      },
    }))
  }

  function toggleHidden(sectionKey: string) {
    setForm((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], is_hidden: !prev[sectionKey].is_hidden },
    }))
  }

  return (
    <div>
      <PageHeader
        title="Page Content"
        description="Edit text, images, and links on the homepage sections your agency has made editable."
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sections.length === 0 ? (
        <p className="text-center py-10 text-slate-400">
          No sections are editable yet. Your agency controls which sections appear here.
        </p>
      ) : (
        <div className="space-y-4">
          {sections.map((s) => {
            const local = form[s.section_key]
            if (!local) return null
            return (
              <div key={s.section_key} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-800 capitalize">
                    {s.section_key.replace(/-/g, " ")}
                  </h3>
                  <label className="flex items-center gap-2 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={!local.is_hidden}
                      onChange={() => toggleHidden(s.section_key)}
                    />
                    Visible on homepage
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {s.fields.map((f) => (
                    <div key={f.name}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                      {f.type === "image" ? (
                        <>
                          <input
                            value={local.overrides[f.name] ?? ""}
                            onChange={(e) => updateField(s.section_key, f.name, e.target.value)}
                            placeholder="https://…"
                            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                          />
                          <ImageUpload
                            value={local.overrides[f.name]}
                            onUpload={(url) => updateField(s.section_key, f.name, url)}
                          />
                        </>
                      ) : (
                        <input
                          value={local.overrides[f.name] ?? ""}
                          onChange={(e) => updateField(s.section_key, f.name, e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <button
                    onClick={() =>
                      save.mutate({
                        section_key: s.section_key,
                        overrides: local.overrides,
                        is_hidden: local.is_hidden,
                      })
                    }
                    disabled={save.isPending}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                  >
                    {save.isPending ? "Saving…" : "Save"}
                  </button>
                  {saveError?.section_key === s.section_key && (
                    <p className="mt-2 text-sm text-red-600">{saveError.message}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

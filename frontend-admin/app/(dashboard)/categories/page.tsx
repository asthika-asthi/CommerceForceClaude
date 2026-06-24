"use client"
import { useRef, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Category } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Trash2, Pencil, X, Upload } from "lucide-react"

function downloadCsv(path: string, filename: string) {
  const token = localStorage.getItem("cf_access_token")
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
  fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    })
}

interface CsvImportError { row: number; error: string }
interface CsvResult { created: number; updated: number; errors: CsvImportError[] }

export default function CategoriesPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [csvResult, setCsvResult] = useState<CsvResult | null>(null)
  const [csvUploading, setCsvUploading] = useState(false)
  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/api/categories"),
  })
  const [createForm, setCreateForm] = useState({ name: "", slug: "", description: "", parent_id: "" })
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [editForm, setEditForm] = useState({ name: "", description: "", is_active: true })
  const [error, setError] = useState("")

  async function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvUploading(true)
    setCsvResult(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const result = await api.upload<CsvResult>("/api/categories/import/csv", formData)
      setCsvResult(result)
      qc.invalidateQueries({ queryKey: ["categories"] })
    } catch (err) {
      setCsvResult({ created: 0, updated: 0, errors: [{ row: 0, error: err instanceof Error ? err.message : "Upload failed" }] })
    } finally {
      setCsvUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const create = useMutation({
    mutationFn: (d: typeof createForm) =>
      api.post("/api/categories", { ...d, parent_id: d.parent_id || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] })
      setCreateForm({ name: "", slug: "", description: "", parent_id: "" })
      setError("")
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed"),
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof editForm }) =>
      api.put(`/api/categories/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] })
      setEditTarget(null)
      setError("")
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed"),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] })
      setEditTarget(null)
    },
  })

  function startEdit(cat: Category) {
    setEditTarget(cat)
    setEditForm({ name: cat.name, description: cat.description ?? "", is_active: cat.is_active })
    setError("")
  }

  function flattenCategories(cats: Category[], depth = 0): (Category & { depth: number })[] {
    return cats.flatMap((c) => [
      { ...c, depth },
      ...flattenCategories(c.children ?? [], depth + 1),
    ])
  }

  const flat = flattenCategories(categories)

  return (
    <div>
      {/* CSV toolbar */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
          <button
            onClick={() => downloadCsv("/api/categories/export/csv", "categories.csv")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={csvUploading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <Upload size={14} />
            {csvUploading ? "Importing…" : "Import CSV"}
          </button>
        </div>
      </div>

      {/* CSV result banner */}
      {csvResult && (
        <div className={`mb-4 rounded-xl border px-4 py-3 flex items-start gap-3 ${
          csvResult.errors.length === 0
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-yellow-50 border-yellow-200 text-yellow-800"
        }`}>
          <div className="flex-1 text-sm">
            <p className="font-semibold mb-1">
              Import complete — {csvResult.created} created, {csvResult.updated} updated
              {csvResult.errors.length > 0 && `, ${csvResult.errors.length} row${csvResult.errors.length !== 1 ? "s" : ""} skipped`}
            </p>
            {csvResult.errors.length > 0 && (
              <ul className="space-y-0.5 text-xs mt-1">
                {csvResult.errors.map((e, i) => (
                  <li key={i} className="font-mono">{e.row > 0 ? `Row ${e.row}: ` : ""}{e.error}</li>
                ))}
              </ul>
            )}
          </div>
          <button onClick={() => setCsvResult(null)} className="flex-shrink-0 mt-0.5 opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

    <div className="grid grid-cols-2 gap-6">
      {/* List */}
      <div>
        <PageHeader title="Categories" description="Product taxonomy" />
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flat.length === 0 && (
                  <tr><td colSpan={3} className="text-center py-8 text-slate-400">No categories</td></tr>
                )}
                {flat.map((c) => (
                  <tr key={c.id} className={`hover:bg-slate-50 ${editTarget?.id === c.id ? "bg-blue-50" : ""}`}>
                    <td className="px-4 py-2.5 text-slate-800" style={{ paddingLeft: `${16 + c.depth * 20}px` }}>
                      {c.depth > 0 && <span className="text-slate-300 mr-1">└</span>}
                      {c.name}
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge value={c.is_active ? "active" : "inactive"} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(c)}
                          className="p-1.5 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => remove.mutate(c.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create or Edit Form */}
      <div>
        {editTarget ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Edit Category</h2>
                <p className="text-sm text-slate-500 mt-0.5">Editing: {editTarget.name}</p>
              </div>
              <button onClick={() => setEditTarget(null)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); update.mutate({ id: editTarget.id, data: editForm }) }}
              className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input required value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={editForm.is_active}
                  onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))} />
                Active
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={update.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {update.isPending ? "Saving…" : "Save Changes"}
                </button>
                <button type="button" onClick={() => setEditTarget(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600">
                  Cancel
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <PageHeader title="New Category" />
            <form
              onSubmit={(e) => { e.preventDefault(); create.mutate(createForm) }}
              className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
            >
              {["name", "slug", "description"].map((key) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1 capitalize">{key}</label>
                  <input value={(createForm as Record<string, string>)[key]}
                    onChange={(e) => setCreateForm((f) => ({ ...f, [key]: e.target.value }))}
                    required={key === "name"}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={key === "slug" ? "auto-generated if blank" : ""}
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parent Category</label>
                <select value={createForm.parent_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, parent_id: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">None (top-level)</option>
                  {flat.filter((c) => c.depth === 0).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={create.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {create.isPending ? "Creating…" : "Create Category"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
    </div>
  )
}

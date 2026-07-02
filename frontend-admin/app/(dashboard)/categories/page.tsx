"use client"
import { useRef, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Category } from "@/lib/types"
import { StatusBadge } from "@/components/status-badge"
import { Trash2, Pencil, X, Upload, Plus } from "lucide-react"

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

const EMPTY_CREATE = { name: "", slug: "", description: "", parent_id: "", image_url: "", sort_order: "0" }
const EMPTY_EDIT = { name: "", description: "", image_url: "", is_active: true, sort_order: 0 }

export default function CategoriesPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [csvResult, setCsvResult] = useState<CsvResult | null>(null)
  const [csvUploading, setCsvUploading] = useState(false)
  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/api/categories"),
  })
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE)
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_EDIT)
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
      api.post("/api/categories", {
        name: d.name,
        slug: d.slug || undefined,
        description: d.description || undefined,
        parent_id: d.parent_id || undefined,
        image_url: d.image_url || undefined,
        sort_order: parseInt(d.sort_order) || 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] })
      setCreateForm(EMPTY_CREATE)
      setShowCreate(false)
      setError("")
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed"),
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof editForm }) =>
      api.put(`/api/categories/${id}`, {
        name: data.name,
        description: data.description || undefined,
        image_url: data.image_url || undefined,
        is_active: data.is_active,
        sort_order: data.sort_order,
      }),
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
    setShowCreate(false)
    setEditTarget(cat)
    setEditForm({
      name: cat.name,
      description: cat.description ?? "",
      image_url: cat.image_url ?? "",
      is_active: cat.is_active,
      sort_order: cat.sort_order,
    })
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
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
          <p className="text-sm text-slate-500 mt-0.5">{flat.length} {flat.length === 1 ? "category" : "categories"}</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
          <button
            onClick={() => downloadCsv("/api/categories/export/csv", "categories.csv")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={csvUploading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <Upload size={14} />
            {csvUploading ? "Importing…" : "Import CSV"}
          </button>
          <button
            onClick={() => { setShowCreate(v => !v); setEditTarget(null); setError("") }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            <Plus size={14} />
            Add Category
          </button>
        </div>
      </div>

      {/* CSV result banner */}
      {csvResult && (
        <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
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

      {/* Category table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Slug</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Image</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-16">Order</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-24">Status</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-10">
                <div className="inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </td></tr>
            )}
            {!isLoading && flat.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-slate-400">No categories yet</td></tr>
            )}
            {flat.map((c) => (
              <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${editTarget?.id === c.id ? "bg-blue-50 hover:bg-blue-50" : ""}`}>
                <td className="px-4 py-3 text-slate-800 font-medium" style={{ paddingLeft: `${16 + c.depth * 20}px` }}>
                  {c.depth > 0 && <span className="text-slate-300 mr-1.5">└</span>}
                  {c.name}
                </td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{c.slug}</td>
                <td className="px-4 py-3">
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.name}
                      className="h-8 w-8 rounded object-cover border border-slate-200"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                  ) : (
                    <span className="text-slate-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 text-center">{c.sort_order}</td>
                <td className="px-4 py-3"><StatusBadge value={c.is_active ? "active" : "inactive"} /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => startEdit(c)}
                      className="p-1.5 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => remove.mutate(c.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-slate-900">New Category</h2>
            <button onClick={() => { setShowCreate(false); setError("") }} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); create.mutate(createForm) }}
            className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
              <input required value={createForm.name}
                onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Slug <span className="text-slate-400 font-normal text-xs">(auto-generated if blank)</span></label>
              <input value={createForm.slug}
                onChange={(e) => setCreateForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="auto-generated"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input value={createForm.description}
                onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Image URL</label>
              <input value={createForm.image_url}
                onChange={(e) => setCreateForm(f => ({ ...f, image_url: e.target.value }))}
                placeholder="https://…"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Parent Category</label>
              <select value={createForm.parent_id}
                onChange={(e) => setCreateForm(f => ({ ...f, parent_id: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">None (top-level)</option>
                {flat.filter(c => c.depth === 0).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
              <input type="number" value={createForm.sort_order}
                onChange={(e) => setCreateForm(f => ({ ...f, sort_order: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
            <div className="col-span-2 flex gap-2 pt-1">
              <button type="submit" disabled={create.isPending}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                {create.isPending ? "Creating…" : "Create Category"}
              </button>
              <button type="button" onClick={() => { setShowCreate(false); setError("") }}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit form */}
      {editTarget && (
        <div className="bg-white rounded-xl border border-blue-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Edit Category</h2>
              <p className="text-xs text-slate-500 mt-0.5">Editing: {editTarget.name}</p>
            </div>
            <button onClick={() => { setEditTarget(null); setError("") }} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); update.mutate({ id: editTarget.id, data: editForm }) }}
            className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
              <input required value={editForm.name}
                onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input value={editForm.description}
                onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Image URL</label>
              <div className="flex gap-3 items-start">
                <input value={editForm.image_url}
                  onChange={(e) => setEditForm(f => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://… or http://localhost:8000/uploads/…"
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {editForm.image_url && (
                  <img src={editForm.image_url} alt="preview"
                    className="h-10 w-10 rounded object-cover border border-slate-200 flex-shrink-0"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">Used as the category card image on the storefront</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
              <input type="number" value={editForm.sort_order}
                onChange={(e) => setEditForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={editForm.is_active}
                  onChange={(e) => setEditForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300" />
                Active (visible on storefront)
              </label>
            </div>
            {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
            <div className="col-span-2 flex gap-2 pt-1">
              <button type="submit" disabled={update.isPending}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                {update.isPending ? "Saving…" : "Save Changes"}
              </button>
              <button type="button" onClick={() => { setEditTarget(null); setError("") }}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

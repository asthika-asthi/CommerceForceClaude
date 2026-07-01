"use client"
import { useRef, useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { api } from "@/lib/api"
import type { Product } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Pagination } from "@/components/ui/pagination"
import { Pencil, Trash2, Upload, X, Copy, Search } from "lucide-react"

interface DuplicateEntry { id: string; name: string; price: string; stock_quantity: number; category_id: string | null; created_at: string | null }
interface DuplicateGroup { name: string; products: DuplicateEntry[] }

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

interface ProductsResponse { items: Product[]; total: number }
interface CsvImportError { row: number; error: string }
interface CsvResult { created: number; updated?: number; errors: CsvImportError[] }

export default function ProductsPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [csvResult, setCsvResult] = useState<CsvResult | null>(null)
  const [csvUploading, setCsvUploading] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)

  // Duplicate finder state
  const [dupPanelOpen, setDupPanelOpen] = useState(false)
  const [dupGroups, setDupGroups] = useState<DuplicateGroup[] | null>(null)
  const [dupLoading, setDupLoading] = useState(false)
  // keepIds: one per group — the product ID to keep. Default: newest (last in list)
  const [keepIds, setKeepIds] = useState<Record<string, string>>({})
  const [dupDeleting, setDupDeleting] = useState(false)
  const [dupResult, setDupResult] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: ["products", page, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: "20" })
      if (debouncedSearch) params.set("search", debouncedSearch)
      return api.get(`/api/products?${params}`)
    },
  })
  const products = data?.items ?? []
  const totalPages = data ? Math.ceil(data.total / 20) : 1

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  })

  function handleDelete(product: Product) {
    if (!confirm(`Delete "${product.name}"?`)) return
    deleteMutation.mutate(product.id)
  }

  async function handleFindDuplicates() {
    setDupPanelOpen(true)
    setDupLoading(true)
    setDupGroups(null)
    setDupResult(null)
    try {
      const groups = await api.get<DuplicateGroup[]>("/api/products/duplicates")
      setDupGroups(groups)
      // Default selection: keep the newest (last) in each group
      const defaults: Record<string, string> = {}
      for (const g of groups) {
        defaults[g.name.toLowerCase()] = g.products[g.products.length - 1].id
      }
      setKeepIds(defaults)
    } catch {
      setDupGroups([])
    } finally {
      setDupLoading(false)
    }
  }

  async function handleDeleteDuplicates() {
    if (!dupGroups || dupGroups.length === 0) return
    const toDelete = dupGroups.flatMap(g =>
      g.products.filter(p => p.id !== keepIds[g.name.toLowerCase()]).map(p => p.name)
    )
    if (!confirm(`This will permanently delete ${toDelete.length} product(s):\n\n${toDelete.join("\n")}\n\nContinue?`)) return
    setDupDeleting(true)
    try {
      const result = await api.del<{ deleted: number }>("/api/products/duplicates", { keep_ids: Object.values(keepIds) })
      setDupResult(`Deleted ${result.deleted} duplicate product${result.deleted !== 1 ? "s" : ""}.`)
      setDupGroups([])
      qc.invalidateQueries({ queryKey: ["products"] })
    } catch {
      setDupResult("Delete failed — please try again.")
    } finally {
      setDupDeleting(false)
    }
  }

  async function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvUploading(true)
    setCsvResult(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const result = await api.upload<CsvResult>("/api/products/import/csv", formData)
      setCsvResult(result)
      qc.invalidateQueries({ queryKey: ["products"] })
    } catch (err) {
      setCsvResult({ created: 0, errors: [{ row: 0, error: err instanceof Error ? err.message : "Upload failed" }] })
    } finally {
      setCsvUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data ? `${data.total} products` : "Manage your product catalog"}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search products…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCsvFile}
          />
          <button
            onClick={() => downloadCsv("/api/products/export/csv", "products.csv")}
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
          <button
            onClick={handleFindDuplicates}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-orange-200 text-orange-700 hover:bg-orange-50 transition-colors"
          >
            <Copy size={14} />
            Find duplicates
          </button>
          <Link
            href="/products/new"
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            + New Product
          </Link>
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
              Import complete — {csvResult.created} created
              {(csvResult.updated ?? 0) > 0 && `, ${csvResult.updated} updated`}
              {csvResult.errors.length > 0 && `, ${csvResult.errors.length} row${csvResult.errors.length !== 1 ? "s" : ""} skipped`}
            </p>
            {csvResult.errors.length > 0 && (
              <ul className="space-y-0.5 text-xs mt-1">
                {csvResult.errors.map((e, i) => (
                  <li key={i} className="font-mono">
                    {e.row > 0 ? `Row ${e.row}: ` : ""}{e.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button onClick={() => setCsvResult(null)} className="flex-shrink-0 mt-0.5 opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Duplicate finder panel */}
      {dupPanelOpen && (
        <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-orange-900 text-sm">Find &amp; remove duplicate products</h2>
            <button onClick={() => setDupPanelOpen(false)} className="text-orange-400 hover:text-orange-700">
              <X size={14} />
            </button>
          </div>

          {dupLoading && (
            <div className="flex items-center gap-2 text-sm text-orange-700">
              <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              Scanning…
            </div>
          )}

          {dupResult && (
            <p className="text-sm text-orange-900 font-medium">{dupResult}</p>
          )}

          {dupGroups !== null && !dupLoading && dupGroups.length === 0 && !dupResult && (
            <p className="text-sm text-orange-700">No duplicate product names found.</p>
          )}

          {dupGroups && dupGroups.length > 0 && (
            <>
              <p className="text-xs text-orange-700 mb-4">
                {dupGroups.length} duplicate group{dupGroups.length !== 1 ? "s" : ""} found.
                Select which version to <strong>keep</strong> per group — the others will be deleted.
              </p>
              <div className="space-y-4">
                {dupGroups.map((group) => (
                  <div key={group.name} className="bg-white rounded-lg border border-orange-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-orange-100 border-b border-orange-200">
                      <span className="text-xs font-semibold text-orange-800 uppercase tracking-wide">{group.name}</span>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-orange-100">
                          <th className="px-3 py-2 text-left font-medium text-slate-500 w-8">Keep</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Name</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Price</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Stock</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orange-50">
                        {group.products.map((p) => (
                          <tr key={p.id} className={keepIds[group.name.toLowerCase()] === p.id ? "bg-green-50" : ""}>
                            <td className="px-3 py-2">
                              <input
                                type="radio"
                                name={`keep-${group.name}`}
                                checked={keepIds[group.name.toLowerCase()] === p.id}
                                onChange={() => setKeepIds(prev => ({ ...prev, [group.name.toLowerCase()]: p.id }))}
                                className="accent-green-600"
                              />
                            </td>
                            <td className="px-3 py-2 text-slate-700 font-medium">{p.name}</td>
                            <td className="px-3 py-2 text-slate-600">£{parseFloat(p.price).toFixed(2)}</td>
                            <td className="px-3 py-2 text-slate-600">{p.stock_quantity}</td>
                            <td className="px-3 py-2 text-slate-500">
                              {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleDeleteDuplicates}
                  disabled={dupDeleting}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors"
                >
                  {dupDeleting ? "Deleting…" : "Delete selected duplicates"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {isLoading && !data ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">SKU</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Price</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Stock</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    No products yet.{" "}
                    <Link href="/products/new" className="text-blue-600 hover:underline">Create one</Link>
                    {" "}or{" "}
                    <button onClick={() => fileRef.current?.click()} className="text-blue-600 hover:underline">import a CSV</button>.
                  </td>
                </tr>
              )}
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <div>{p.name}</div>
                    {p.sale_price && (
                      <div className="text-xs text-slate-400 line-through">£{p.price}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{p.sku ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">£{p.sale_price ?? p.price}</td>
                  <td className="px-4 py-3 text-slate-700">{p.stock_quantity}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={p.is_active ? "active" : "inactive"} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        href={`/products/${p.id}`}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </Link>
                      <button
                        onClick={() => handleDelete(p)}
                        className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage(p => p - 1)}
        onNext={() => setPage(p => p + 1)}
      />
    </div>
  )
}

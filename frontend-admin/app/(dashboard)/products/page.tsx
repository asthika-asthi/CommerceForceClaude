"use client"
import { useRef, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { api } from "@/lib/api"
import type { Product } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Pencil, Trash2, Upload, X } from "lucide-react"

interface ProductsResponse { items: Product[]; total: number }
interface CsvImportError { row: number; error: string }
interface CsvResult { created: number; errors: CsvImportError[] }

export default function ProductsPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [csvResult, setCsvResult] = useState<CsvResult | null>(null)
  const [csvUploading, setCsvUploading] = useState(false)

  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: ["products"],
    queryFn: () => api.get("/api/products"),
  })
  const products = data?.items ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  })

  function handleDelete(product: Product) {
    if (!confirm(`Delete "${product.name}"?`)) return
    deleteMutation.mutate(product.id)
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
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCsvFile}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={csvUploading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <Upload size={14} />
            {csvUploading ? "Importing…" : "Import CSV"}
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
              Import complete — {csvResult.created} product{csvResult.created !== 1 ? "s" : ""} created
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

      {isLoading ? (
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
    </div>
  )
}

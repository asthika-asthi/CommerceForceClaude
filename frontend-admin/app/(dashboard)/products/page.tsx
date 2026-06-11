"use client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { api } from "@/lib/api"
import type { Product } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Pencil, Trash2 } from "lucide-react"

export default function ProductsPage() {
  const qc = useQueryClient()
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => api.get("/api/products"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  })

  function handleDelete(product: Product) {
    if (!confirm(`Delete "${product.name}"?`)) return
    deleteMutation.mutate(product.id)
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage your product catalog"
        action={{ label: "+ New Product", href: "/products/new" }}
      />

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
                    No products yet. <Link href="/products/new" className="text-blue-600 hover:underline">Create one</Link>.
                  </td>
                </tr>
              )}
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <div>{p.name}</div>
                    {p.sale_price && (
                      <div className="text-xs text-slate-400 line-through">${p.price}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{p.sku ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">
                    ${p.sale_price ?? p.price}
                  </td>
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

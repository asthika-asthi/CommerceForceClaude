"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Category } from "@/lib/types"
import { PageHeader } from "@/components/page-header"

export default function NewProductPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: "", description: "", sku: "",
    price: "", sale_price: "", stock_quantity: "0",
    category_id: "", is_active: true,
  })
  const [error, setError] = useState("")

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/api/categories"),
  })

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      api.post("/api/products", {
        ...data,
        stock_quantity: Number(data.stock_quantity),
        sale_price: data.sale_price || undefined,
        category_id: data.category_id || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] })
      router.push("/products")
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed"),
  })

  function set(key: string, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="New Product" />
      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(form) }}
        className="bg-white rounded-xl border border-slate-200 p-6 space-y-5"
      >
        <Field label="Name *">
          <input required value={form.name} onChange={(e) => set("name", e.target.value)}
            className={input} placeholder="Product name" />
        </Field>
        <Field label="Description">
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
            className={`${input} h-24 resize-none`} placeholder="Optional description" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="SKU">
            <input value={form.sku} onChange={(e) => set("sku", e.target.value)}
              className={input} placeholder="SKU-001" />
          </Field>
          <Field label="Category">
            <select value={form.category_id} onChange={(e) => set("category_id", e.target.value)}
              className={input}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Price *">
            <input required value={form.price} onChange={(e) => set("price", e.target.value)}
              className={input} placeholder="0.00" type="number" step="0.01" min="0" />
          </Field>
          <Field label="Sale Price">
            <input value={form.sale_price} onChange={(e) => set("sale_price", e.target.value)}
              className={input} placeholder="0.00" type="number" step="0.01" min="0" />
          </Field>
          <Field label="Stock">
            <input value={form.stock_quantity} onChange={(e) => set("stock_quantity", e.target.value)}
              className={input} type="number" min="0" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={form.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
            className="rounded border-slate-300" />
          Active (visible to customers)
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={mutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {mutation.isPending ? "Saving…" : "Create Product"}
          </button>
          <button type="button" onClick={() => router.back()}
            className="px-5 py-2 rounded-lg text-sm border border-slate-300 text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

const input = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

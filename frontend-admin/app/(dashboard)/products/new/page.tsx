"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Category } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { ImageUpload } from "@/components/ui/image-upload"
import { Star, Trash2 } from "lucide-react"

type ProductImageCreate = { url: string; alt_text?: string; is_primary: boolean; sort_order: number }

export default function NewProductPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: "", description: "", sku: "", barcode: "",
    price: "", sale_price: "", stock_quantity: "0",
    category_id: "", is_active: true, is_featured: false,
  })
  const [images, setImages] = useState<ProductImageCreate[]>([])
  const [newImageUrl, setNewImageUrl] = useState("")
  const [error, setError] = useState("")

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/api/categories?include_empty=true"),
  })

  const flatCategories = flattenCategories(categories)

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      api.post("/api/products", {
        ...data,
        stock_quantity: Number(data.stock_quantity),
        sale_price: data.sale_price || undefined,
        category_id: data.category_id || undefined,
        barcode: data.barcode || undefined,
        images: images.map(img => img),
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

  function addImage(url: string) {
    if (!url.trim()) return
    setImages((prev) => [
      ...prev,
      { url: url.trim(), is_primary: prev.length === 0, sort_order: prev.length },
    ])
    setNewImageUrl("")
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index).map((img, i) => ({ ...img, sort_order: i }))
      if (next.length > 0 && !next.some(img => img.is_primary)) {
        next[0] = { ...next[0], is_primary: true }
      }
      return next
    })
  }

  function setPrimary(index: number) {
    setImages((prev) => prev.map((img, i) => ({ ...img, is_primary: i === index })))
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
        <Field label="Images">
          {images.length > 0 && (
            <div className="mb-3 space-y-2">
              {images.map((img, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                  <img src={img.url} alt="" className="w-10 h-10 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-600 truncate">{img.url}</p>
                    {img.is_primary && (
                      <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-0.5">
                        <Star size={9} fill="currentColor" /> Primary
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setPrimary(i)}
                      disabled={img.is_primary}
                      className="p-1 rounded hover:bg-amber-50 disabled:text-amber-400 text-slate-300 hover:text-amber-500"
                      title="Set as primary"
                    >
                      <Star size={14} fill={img.is_primary ? "currentColor" : "none"} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              placeholder="Image URL or upload below"
              className={`${input} flex-1`}
            />
            <button
              type="button"
              onClick={() => addImage(newImageUrl)}
              disabled={!newImageUrl.trim()}
              className="px-3 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 whitespace-nowrap"
            >
              Add
            </button>
          </div>
          <div className="mt-2">
            <ImageUpload value="" onUpload={(url) => addImage(url)} />
          </div>
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="SKU">
            <input value={form.sku} onChange={(e) => set("sku", e.target.value)}
              className={input} placeholder="SKU-001" />
          </Field>
          <Field label="Barcode">
            <input value={form.barcode} onChange={(e) => set("barcode", e.target.value)}
              className={input} placeholder="e.g. 5012345678900" />
          </Field>
          <Field label="Category">
            <select value={form.category_id} onChange={(e) => set("category_id", e.target.value)}
              className={input}>
              <option value="">None</option>
              {flatCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
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
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={form.is_featured}
            onChange={(e) => set("is_featured", e.target.checked)}
            className="rounded border-slate-300" />
          Featured (highlighted on the storefront)
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

function flattenCategories(
  cats: Category[],
  depth = 0
): { id: string; label: string }[] {
  const result: { id: string; label: string }[] = []
  for (const c of cats) {
    result.push({ id: c.id, label: depth === 0 ? c.name : `${"— ".repeat(depth)}${c.name}` })
    if (c.children?.length) result.push(...flattenCategories(c.children, depth + 1))
  }
  return result
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

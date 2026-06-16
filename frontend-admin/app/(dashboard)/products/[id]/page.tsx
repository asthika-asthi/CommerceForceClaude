"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Product, Category, ProductImage } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { ImageUpload } from "@/components/ui/image-upload"
import { Trash2, ChevronUp, ChevronDown, Star } from "lucide-react"

export default async function EditProductPage(props: PageProps<"/products/[id]">) {
  const { id } = await props.params
  return <EditProduct id={id} />
}

function EditProduct({ id }: { id: string }) {
  const router = useRouter()
  const qc = useQueryClient()

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: () => api.get(`/api/products/${id}`),
  })
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/api/categories"),
  })

  const flatCategories = flattenCategories(categories)

  const [form, setForm] = useState({
    name: "", description: "", sku: "",
    price: "", sale_price: "", stock_quantity: "0",
    category_id: "", is_active: true,
  })
  const [error, setError] = useState("")

  // Locally managed image list (ordered)
  const [images, setImages] = useState<ProductImage[]>([])
  const [newImageUrl, setNewImageUrl] = useState("")

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        description: product.description ?? "",
        sku: product.sku ?? "",
        price: product.price,
        sale_price: product.sale_price ?? "",
        stock_quantity: String(product.stock_quantity),
        category_id: product.category_id ?? "",
        is_active: product.is_active,
      })
      const sorted = [...(product.images ?? [])].sort((a, b) => a.sort_order - b.sort_order)
      setImages(sorted)
    }
  }, [product])

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) =>
      api.put(`/api/products/${id}`, {
        ...data,
        stock_quantity: Number(data.stock_quantity),
        sale_price: data.sale_price || undefined,
        category_id: data.category_id || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["product", id] })
      router.push("/products")
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed"),
  })

  const addImageMutation = useMutation({
    mutationFn: (url: string) =>
      api.post<ProductImage>(`/api/products/${id}/images`, { url, sort_order: images.length }),
    onSuccess: (img) => {
      setImages((prev) => [...prev, img])
      setNewImageUrl("")
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to add image"),
  })

  const deleteImageMutation = useMutation({
    mutationFn: (imageId: string) => api.del(`/api/products/${id}/images/${imageId}`),
    onSuccess: (_, imageId) =>
      setImages((prev) => prev.filter((img) => img.id !== imageId)),
  })

  const reorderMutation = useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      api.patch<ProductImage[]>(`/api/products/${id}/images`, items),
    onSuccess: (updated) => setImages([...updated].sort((a, b) => a.sort_order - b.sort_order)),
  })

  function moveImage(index: number, direction: -1 | 1) {
    const next = [...images]
    const swapIndex = index + direction
    if (swapIndex < 0 || swapIndex >= next.length) return
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
    const withOrders = next.map((img, i) => ({ ...img, sort_order: i }))
    setImages(withOrders)
    reorderMutation.mutate(withOrders.map(({ id: imgId, sort_order }) => ({ id: imgId, sort_order })))
  }

  function set(key: string, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Edit Product" />
      <form
        onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form) }}
        className="bg-white rounded-xl border border-slate-200 p-6 space-y-5"
      >
        <Field label="Name *">
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={input} />
        </Field>
        <Field label="Description">
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
            className={`${input} h-24 resize-none`} />
        </Field>

        {/* Image management */}
        <Field label="Images">
          {images.length > 0 && (
            <div className="mb-3 space-y-2">
              {images.map((img, i) => (
                <div key={img.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
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
                      onClick={() => moveImage(i, -1)}
                      disabled={i === 0 || reorderMutation.isPending}
                      className="p-1 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-30"
                      title="Move up"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveImage(i, 1)}
                      disabled={i === images.length - 1 || reorderMutation.isPending}
                      className="p-1 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-30"
                      title="Move down"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteImageMutation.mutate(img.id)}
                      disabled={deleteImageMutation.isPending}
                      className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                      title="Delete"
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
              onClick={() => newImageUrl && addImageMutation.mutate(newImageUrl)}
              disabled={!newImageUrl || addImageMutation.isPending}
              className="px-3 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 whitespace-nowrap"
            >
              Add
            </button>
          </div>
          <div className="mt-2">
            <ImageUpload
              value=""
              onUpload={(url) => addImageMutation.mutate(url)}
            />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="SKU">
            <input value={form.sku} onChange={(e) => set("sku", e.target.value)} className={input} />
          </Field>
          <Field label="Category">
            <select value={form.category_id} onChange={(e) => set("category_id", e.target.value)} className={input}>
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
              className={input} type="number" step="0.01" min="0" />
          </Field>
          <Field label="Sale Price">
            <input value={form.sale_price} onChange={(e) => set("sale_price", e.target.value)}
              className={input} type="number" step="0.01" min="0" />
          </Field>
          <Field label="Stock">
            <input value={form.stock_quantity} onChange={(e) => set("stock_quantity", e.target.value)}
              className={input} type="number" min="0" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={form.is_active}
            onChange={(e) => set("is_active", e.target.checked)} className="rounded" />
          Active
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saveMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {saveMutation.isPending ? "Saving…" : "Save Changes"}
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
  depth = 0,
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

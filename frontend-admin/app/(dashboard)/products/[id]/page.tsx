"use client"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Product, Category, ProductImage } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { ImageUpload } from "@/components/ui/image-upload"
import { Trash2, ChevronUp, ChevronDown, Star } from "lucide-react"

// ── Variant domain types ──────────────────────────────────────────────────────
interface OptionValue {
  id: string
  label: string
  sort_order?: number
}

interface ProductOption {
  id: string
  name: string
  sort_order?: number
  values: OptionValue[]
}

interface ProductVariant {
  id: string
  label: string
  sku: string | null
  is_active: boolean
}

// ── Page entry (async server component wrapper) ───────────────────────────────
export default async function EditProductPage(props: PageProps<"/products/[id]">) {
  const { id } = await props.params
  return <EditProduct id={id} />
}

// ── Main client component ─────────────────────────────────────────────────────
function EditProduct({ id }: { id: string }) {
  const router = useRouter()
  const qc = useQueryClient()

  // Active tab: "details" or "variants"
  const [activeTab, setActiveTab] = useState<"details" | "variants">("details")

  // ── Product details state ─────────────────────────────────────────────────
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

  // ── Variants state ────────────────────────────────────────────────────────
  const [options, setOptions] = useState<ProductOption[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [variantsError, setVariantsError] = useState("")
  const [variantsLoading, setVariantsLoading] = useState(false)

  // Section A: add option
  const [newOptionName, setNewOptionName] = useState("")
  const [addOptionLoading, setAddOptionLoading] = useState(false)

  // Section B: per-option "add value" input state keyed by option id
  const [addValueInputs, setAddValueInputs] = useState<Record<string, string>>({})
  const [addValueLoading, setAddValueLoading] = useState<Record<string, boolean>>({})

  // Section C: generate variants
  const [generateLoading, setGenerateLoading] = useState(false)
  // Per-variant SKU editing state
  const [variantSkus, setVariantSkus] = useState<Record<string, string>>({})

  const loadVariantData = useCallback(async () => {
    setVariantsLoading(true)
    setVariantsError("")
    try {
      const [opts, vars] = await Promise.all([
        api.get<ProductOption[]>(`/api/products/${id}/options`),
        api.get<ProductVariant[]>(`/api/products/${id}/variants`),
      ])
      setOptions(opts)
      setVariants(vars)
      // Seed SKU editing state from fetched variants
      const skuMap: Record<string, string> = {}
      for (const v of vars) {
        skuMap[v.id] = v.sku ?? ""
      }
      setVariantSkus(skuMap)
    } catch (err) {
      setVariantsError(err instanceof Error ? err.message : "Failed to load variant data")
    } finally {
      setVariantsLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (activeTab === "variants") {
      loadVariantData()
    }
  }, [activeTab, loadVariantData])

  async function handleAddOption() {
    if (!newOptionName.trim()) return
    setAddOptionLoading(true)
    setVariantsError("")
    try {
      await api.post(`/api/products/${id}/options`, { name: newOptionName.trim(), sort_order: 0 })
      setNewOptionName("")
      await loadVariantData()
    } catch (err) {
      setVariantsError(err instanceof Error ? err.message : "Failed to add option")
    } finally {
      setAddOptionLoading(false)
    }
  }

  async function handleDeleteOption(optId: string) {
    setVariantsError("")
    try {
      await api.del(`/api/products/${id}/options/${optId}`)
      await loadVariantData()
    } catch (err) {
      setVariantsError(err instanceof Error ? err.message : "Failed to delete option")
    }
  }

  async function handleDeleteValue(optId: string, valueId: string) {
    setVariantsError("")
    try {
      await api.del(`/api/products/${id}/options/${optId}/values/${valueId}`)
      await loadVariantData()
    } catch (err) {
      setVariantsError(err instanceof Error ? err.message : "Failed to delete value")
    }
  }

  async function handleAddValue(optId: string) {
    const label = (addValueInputs[optId] ?? "").trim()
    if (!label) return
    setAddValueLoading((prev) => ({ ...prev, [optId]: true }))
    setVariantsError("")
    try {
      await api.post(`/api/products/${id}/options/${optId}/values`, { label })
      setAddValueInputs((prev) => ({ ...prev, [optId]: "" }))
      await loadVariantData()
    } catch (err) {
      setVariantsError(err instanceof Error ? err.message : "Failed to add value")
    } finally {
      setAddValueLoading((prev) => ({ ...prev, [optId]: false }))
    }
  }

  async function handleGenerate() {
    setGenerateLoading(true)
    setVariantsError("")
    try {
      await api.post(`/api/products/${id}/variants/generate`)
      await loadVariantData()
    } catch (err) {
      setVariantsError(err instanceof Error ? err.message : "Failed to generate variants")
    } finally {
      setGenerateLoading(false)
    }
  }

  async function handleVariantSkuBlur(variantId: string) {
    const sku = variantSkus[variantId] ?? ""
    const current = variants.find((v) => v.id === variantId)
    if (!current) return
    // Only patch if changed
    if (sku === (current.sku ?? "")) return
    setVariantsError("")
    try {
      await api.patch(`/api/products/${id}/variants/${variantId}`, { sku: sku || null })
      // Update local state to reflect saved value
      setVariants((prev) =>
        prev.map((v) => (v.id === variantId ? { ...v, sku: sku || null } : v)),
      )
    } catch (err) {
      setVariantsError(err instanceof Error ? err.message : "Failed to update variant")
    }
  }

  async function handleVariantActiveChange(variantId: string, checked: boolean) {
    setVariantsError("")
    try {
      await api.patch(`/api/products/${id}/variants/${variantId}`, { is_active: checked })
      setVariants((prev) =>
        prev.map((v) => (v.id === variantId ? { ...v, is_active: checked } : v)),
      )
    } catch (err) {
      setVariantsError(err instanceof Error ? err.message : "Failed to update variant")
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Only show "new product" mode if id is "new" — in this page id is always a
  // real product id passed from the server component, so variants tab is always shown.
  const isNewProduct = id === "new"

  return (
    <div className="max-w-2xl">
      <PageHeader title="Edit Product" />

      {/* Tab navigation — only show Variants tab for saved products */}
      {!isNewProduct && (
        <div className="flex border-b border-slate-200 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "details"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Product Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("variants")}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "variants"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Variants
          </button>
        </div>
      )}

      {/* ── Product Details tab ──────────────────────────────────────────────── */}
      {(activeTab === "details" || isNewProduct) && (
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
      )}

      {/* ── Variants tab ────────────────────────────────────────────────────── */}
      {activeTab === "variants" && !isNewProduct && (
        <div className="space-y-6">
          {variantsError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {variantsError}
            </p>
          )}

          {variantsLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Section A — Add option type */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Add option type</h3>
                <div className="flex gap-2">
                  <input
                    value={newOptionName}
                    onChange={(e) => setNewOptionName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddOption() } }}
                    placeholder="e.g. Size, Colour"
                    className={`${input} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={handleAddOption}
                    disabled={!newOptionName.trim() || addOptionLoading}
                    className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 whitespace-nowrap"
                  >
                    {addOptionLoading ? "Adding…" : "Add option"}
                  </button>
                </div>
              </div>

              {/* Section B — Options list */}
              {options.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                  <h3 className="text-sm font-semibold text-slate-700">Option types</h3>
                  {options.map((opt) => (
                    <div key={opt.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-slate-800">{opt.name}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteOption(opt.id)}
                          className="text-xs px-3 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                        >
                          Delete option
                        </button>
                      </div>

                      {/* Value chips */}
                      {opt.values.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {opt.values.map((val) => (
                            <span
                              key={val.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200"
                            >
                              {val.label}
                              <button
                                type="button"
                                onClick={() => handleDeleteValue(opt.id, val.id)}
                                className="text-slate-400 hover:text-red-500 leading-none"
                                aria-label={`Remove ${val.label}`}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Add value inline form */}
                      <div className="flex gap-2">
                        <input
                          value={addValueInputs[opt.id] ?? ""}
                          onChange={(e) =>
                            setAddValueInputs((prev) => ({ ...prev, [opt.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); handleAddValue(opt.id) }
                          }}
                          placeholder="Add value"
                          className={`${input} flex-1 text-xs py-1.5`}
                        />
                        <button
                          type="button"
                          onClick={() => handleAddValue(opt.id)}
                          disabled={!(addValueInputs[opt.id] ?? "").trim() || addValueLoading[opt.id]}
                          className="px-3 py-1.5 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 whitespace-nowrap"
                        >
                          {addValueLoading[opt.id] ? "Adding…" : "Add"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Section C — Variants */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Variants</h3>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generateLoading || options.length === 0}
                    className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 whitespace-nowrap"
                  >
                    {generateLoading ? "Generating…" : "Generate combinations"}
                  </button>
                </div>

                {options.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No option types defined. Add an option above to create variants.
                  </p>
                ) : variants.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No variants yet. Click &ldquo;Generate combinations&rdquo; to create them from your options.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 pr-4 font-medium text-slate-600">Variant</th>
                          <th className="text-left py-2 pr-4 font-medium text-slate-600">SKU</th>
                          <th className="text-left py-2 font-medium text-slate-600">Active</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {variants.map((variant) => (
                          <tr key={variant.id}>
                            <td className="py-2 pr-4 text-slate-700">{variant.label}</td>
                            <td className="py-2 pr-4">
                              <input
                                value={variantSkus[variant.id] ?? ""}
                                onChange={(e) =>
                                  setVariantSkus((prev) => ({ ...prev, [variant.id]: e.target.value }))
                                }
                                onBlur={() => handleVariantSkuBlur(variant.id)}
                                placeholder="SKU"
                                className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-40"
                              />
                            </td>
                            <td className="py-2">
                              <input
                                type="checkbox"
                                checked={variant.is_active}
                                onChange={(e) => handleVariantActiveChange(variant.id, e.target.checked)}
                                className="rounded"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

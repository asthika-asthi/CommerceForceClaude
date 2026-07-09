import { Suspense } from "react"
import { serverFetch } from "@/lib/api"
import type { Category, PaginatedResponse, Product } from "@/lib/types"
import { ProductCard } from "@/components/shop/product-card"
import { FilterBar } from "@/components/shop/filter-bar"
import { PriceRangeFilter } from "@/components/shop/price-range-filter"

interface Props {
  searchParams: Promise<{ category?: string; q?: string; page?: string; sort?: string; in_stock?: string; min_price?: string; max_price?: string }>
}

export async function generateMetadata({ searchParams }: Props) {
  const params = await searchParams
  const base = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? ""
  if (params.category) {
    const categories = await serverFetch<Category[]>("/api/categories").catch(() => null)
    const cat = categories?.find((c) => c.id === params.category)
    const title = cat ? `${cat.name} Products` : "Shop"
    return {
      title,
      openGraph: { title, url: `${base}/products?category=${params.category}`, type: "website" },
    }
  }
  return {
    title: "Shop",
    openGraph: { title: "Shop", url: `${base}/products`, type: "website" },
  }
}

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams
  const page = parseInt(params.page ?? "1")
  const limit = 24

  const qs = new URLSearchParams({ page: String(page), page_size: String(limit), is_active: "true" })
  if (params.category) qs.set("category_id", params.category)
  if (params.q) qs.set("search", params.q)
  if (params.in_stock === "1") qs.set("in_stock_only", "true")
  if (params.sort) {
    const lastUnderscore = params.sort.lastIndexOf("_")
    if (lastUnderscore !== -1) {
      qs.set("sort_by", params.sort.slice(0, lastUnderscore))
      qs.set("sort_dir", params.sort.slice(lastUnderscore + 1))
    }
  }
  if (params.min_price) qs.set("min_price", params.min_price)
  if (params.max_price) qs.set("max_price", params.max_price)

  const [productsRes, categoriesRes] = await Promise.all([
    serverFetch<PaginatedResponse<Product>>(`/api/products?${qs}`),
    serverFetch<Category[]>("/api/categories"),
  ])

  const products = productsRes?.items ?? []
  const total = productsRes?.total ?? 0
  const categories = categoriesRes ?? []
  const pages = Math.ceil(total / limit)

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p: Record<string, string | undefined> = {
      category: params.category,
      q: params.q,
      sort: params.sort,
      in_stock: params.in_stock,
      min_price: params.min_price,
      max_price: params.max_price,
    }
    Object.assign(p, overrides)
    const filtered: Record<string, string> = {}
    for (const k of Object.keys(p)) {
      if (p[k]) filtered[k] = p[k] as string
    }
    const s = new URLSearchParams(filtered).toString()
    return `/products${s ? `?${s}` : ""}`
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full md:w-56 flex-shrink-0">
          <h2 className="font-semibold text-slate-900 mb-3">Categories</h2>
          <ul className="space-y-1">
            <li>
              <a href={buildUrl({ category: undefined, page: undefined })}
                className={`block text-sm px-2 py-1.5 rounded-lg ${!params.category ? "bg-brand/10 text-brand-dark font-medium" : "text-slate-600 hover:text-slate-900"}`}>
                All Products
              </a>
            </li>
            {categories.map((cat) => (
              <li key={cat.id}>
                <a href={buildUrl({ category: cat.id, page: undefined })}
                  className={`block text-sm px-2 py-1.5 rounded-lg ${params.category === cat.id ? "bg-brand/10 text-brand-dark font-medium" : "text-slate-600 hover:text-slate-900"}`}>
                  {cat.name}
                </a>
              </li>
            ))}
          </ul>
          <Suspense fallback={null}>
            <PriceRangeFilter
              currentMin={params.min_price}
              currentMax={params.max_price}
            />
          </Suspense>
        </aside>

        {/* Main */}
        <div className="flex-1">
          {/* Search + filters */}
          <form method="GET" action="/products" className="mb-6 space-y-3">
            <div className="flex gap-2">
              <input name="q" defaultValue={params.q ?? ""} placeholder="Search products…"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
              <button type="submit" className="px-4 py-2 bg-brand hover:bg-brand-hover text-on-brand text-sm rounded-lg transition-colors">
                Search
              </button>
            </div>
            <div className="flex gap-4 items-center">
              <FilterBar
                currentSort={params.sort}
                currentInStock={params.in_stock}
                currentCategory={params.category}
                total={total}
              />
            </div>
          </form>

          {products.length === 0 ? (
            <div className="text-center py-20 text-slate-400">No products found.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
              {pages > 1 && (
                <div className="flex justify-center gap-2 mt-10">
                  {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                    <a key={p} href={buildUrl({ page: String(p) })}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm border ${p === page ? "bg-brand text-on-brand border-brand" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                      {p}
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

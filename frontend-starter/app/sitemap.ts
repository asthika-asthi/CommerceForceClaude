import type { MetadataRoute } from "next"
import { serverFetch } from "@/lib/api"
import type { Category, ProductsResponse } from "@/lib/types"

const BASE = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000"

async function fetchAllProductSlugs(): Promise<string[]> {
  const slugs: string[] = []
  let page = 1
  const pageSize = 100

  while (true) {
    const res = await serverFetch<ProductsResponse>(
      `/api/products?page=${page}&page_size=${pageSize}&is_active=true`
    )
    if (!res || res.items.length === 0) break
    res.items.forEach((p) => slugs.push(p.slug))
    if (slugs.length >= res.total) break
    page++
  }

  return slugs
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, categories] = await Promise.all([
    fetchAllProductSlugs(),
    serverFetch<Category[]>("/api/categories").catch(() => [] as Category[]),
  ])

  const activeCategories = (categories ?? []).filter((c) => c.is_active)

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/contact`, changeFrequency: "monthly", priority: 0.4 },
  ]

  const categoryPages: MetadataRoute.Sitemap = activeCategories.map((cat) => ({
    url: `${BASE}/products?category=${cat.id}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }))

  const productPages: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${BASE}/products/${slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }))

  return [...staticPages, ...categoryPages, ...productPages]
}

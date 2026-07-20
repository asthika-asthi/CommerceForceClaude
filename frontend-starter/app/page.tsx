import { serverFetch } from "@/lib/api"
import { getFilteredSections, getHomepageConfig, mergeContentOverrides, type ContentOverrideMap } from "@/lib/landing-config"
import type { Category, LandingRuntimeData, PaginatedResponse, Product } from "@/lib/types"
import { LandingSectionRenderer } from "@/components/shop/landing-section"

export default async function HomePage() {
  const [featuredRes, categories, overridesMap] = await Promise.all([
    serverFetch<PaginatedResponse<Product>>("/api/products?featured_only=true&page_size=8"),
    serverFetch<Category[]>("/api/categories").catch(() => [] as Category[]),
    serverFetch<ContentOverrideMap>("/api/landing_page/overrides"),
  ])

  const products = [...(featuredRes?.items ?? [])]

  // Top up to 8 with other active products so both homepage grids stay populated
  // even when fewer than 8 products are marked as featured.
  if (products.length < 8) {
    const fillRes = await serverFetch<PaginatedResponse<Product>>("/api/products?page_size=16")
    const seen = new Set(products.map(p => p.id))
    for (const p of fillRes?.items ?? []) {
      if (products.length >= 8) break
      if (!seen.has(p.id)) { products.push(p); seen.add(p.id) }
    }
  }

  const data: LandingRuntimeData = {
    products,
    categories: (categories ?? []).filter(c => c.is_active),
    showBestSellersCard: getHomepageConfig().showBestSellersCard !== false,
  }

  const sections = mergeContentOverrides(getFilteredSections(), overridesMap ?? {})

  return (
    <div className="bg-bg" data-landing-source="config-pipeline">
      {sections.map((section, i) => (
        <LandingSectionRenderer
          key={`${section.__block}-${i}`}
          section={section}
          data={data}
        />
      ))}
    </div>
  )
}

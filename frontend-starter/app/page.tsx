import { serverFetch } from "@/lib/api"
import type { Category, PaginatedResponse, Product } from "@/lib/types"
import { Hero } from "@/components/landing/hero"
import { PromoBanner } from "@/components/landing/promo-banner"
import { TrustStrip } from "@/components/landing/trust-strip"
import { CategoryGrid } from "@/components/landing/category-grid"
import { ProductGridSection } from "@/components/landing/product-grid-section"
import { SplitCards } from "@/components/landing/split-cards"
import { StatsBand } from "@/components/landing/stats-band"
import { HowToOrder } from "@/components/landing/how-to-order"
import { RangeTable } from "@/components/landing/range-table"
import { Testimonials } from "@/components/landing/testimonials"
import { Newsletter } from "@/components/landing/newsletter"

export default async function HomePage() {
  const [featuredRes, categories] = await Promise.all([
    serverFetch<PaginatedResponse<Product>>("/api/products?featured_only=true&page_size=8"),
    serverFetch<Category[]>("/api/categories").catch(() => [] as Category[]),
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

  const activeCategories = (categories ?? []).filter(c => c.is_active)

  const section1Products = products.slice(0, 4)
  const section2Products = products.slice(4, 8)

  return (
    <div className="bg-bg">
      <PromoBanner />
      <Hero bestSellers={products.slice(0, 4)} />
      <TrustStrip />
      <CategoryGrid categories={activeCategories} />

      {section1Products.length > 0 && (
        <div className="bg-white">
          <ProductGridSection
            title="Featured"
            titleHighlight="products"
            products={section1Products}
            viewAllHref="/products"
            viewAllLabel="View all products →"
            sectionOffset={0}
          />
        </div>
      )}

      {section2Products.length > 0 && (
        <ProductGridSection
          title="More from"
          titleHighlight="our range"
          products={section2Products}
          viewAllHref="/products"
          viewAllLabel="See all products →"
          sectionOffset={4}
        />
      )}

      <SplitCards />
      <StatsBand />
      <HowToOrder />
      <RangeTable products={products} categories={activeCategories} />
      <Testimonials />
      <Newsletter />
    </div>
  )
}

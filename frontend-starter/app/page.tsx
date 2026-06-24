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
    serverFetch<PaginatedResponse<Product>>("/api/products?is_featured=true&page_size=8"),
    serverFetch<Category[]>("/api/categories").catch(() => [] as Category[]),
  ])

  let products = featuredRes?.items ?? []

  // Fall back to any active products if none are marked as featured
  if (products.length === 0) {
    const fallbackRes = await serverFetch<PaginatedResponse<Product>>("/api/products?page_size=8")
    products = fallbackRes?.items ?? []
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
            titleHighlight={activeCategories[0]?.name?.toLowerCase() ?? "products"}
            products={section1Products}
            viewAllHref={activeCategories[0]?.slug ? `/products?category=${activeCategories[0].slug}` : "/products"}
            viewAllLabel={`View all ${activeCategories[0]?.name?.toLowerCase() ?? "products"} →`}
            sectionOffset={0}
          />
        </div>
      )}

      {section2Products.length > 0 && (
        <ProductGridSection
          title="🧹 Cotton dust sheets,"
          titleHighlight="sacks & brushes"
          products={section2Products}
          viewAllHref="/products"
          viewAllLabel="See all products →"
          sectionOffset={4}
        />
      )}

      <SplitCards />
      <StatsBand />
      <HowToOrder />
      <RangeTable products={products} />
      <Testimonials />
      <Newsletter />
    </div>
  )
}

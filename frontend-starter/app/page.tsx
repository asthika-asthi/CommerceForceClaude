import { getFilteredSections } from "@/lib/landing-config"
import type { LandingConfigSection } from "@/lib/landing-config"
import { serverFetch } from "@/lib/api"
import type { LandingSection, PaginatedResponse, Product } from "@/lib/types"
import { LandingSectionRenderer } from "@/components/shop/landing-section"
import { ProductCard } from "@/components/shop/product-card"

export default async function HomePage() {
  let sections: LandingConfigSection[]
  try {
    sections = getFilteredSections()
  } catch {
    // Config file absent — fall back to DB-driven sections
    const data = await serverFetch<LandingSection[]>("/api/landing_page?active_only=true")
    sections = (data ?? []) as unknown as LandingConfigSection[]
  }

  const [productsRes] = await Promise.all([
    serverFetch<PaginatedResponse<Product>>("/api/products?page_size=8&featured_only=true"),
  ])

  const products = productsRes?.items ?? []

  const hasFeaturedProducts = sections.some((s) => (s as unknown as LandingSection).section_type === "products")

  return (
    <div>
      {sections.map((section, i) => (
        <LandingSectionRenderer key={(section as unknown as LandingSection).id ?? i} section={section as unknown as LandingSection} />
      ))}

      {hasFeaturedProducts && products.length > 0 && (
        <section className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">Featured Products</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {sections.length === 0 && (
        <section className="py-24 px-4 text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Welcome to our store</h1>
          <p className="text-slate-500 mb-8">Browse our products below</p>
          {products.length > 0 && (
            <div className="max-w-6xl mx-auto mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

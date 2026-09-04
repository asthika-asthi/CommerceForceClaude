import { serverFetch } from "@/lib/api"
import type {
  BrandingConfig,
  CategoryPathItem,
  PaginatedResponse,
  Product,
  Review,
  ReviewSummary,
} from "@/lib/types"
import { notFound } from "next/navigation"
import { ProductDetailClient } from "./product-detail-client"
import { ProductTabs } from "./product-tabs"
import { Breadcrumbs } from "./breadcrumbs"
import { RelatedProducts } from "./related-products"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const product = await serverFetch<Product>(`/api/products/by-slug/${slug}`)
  if (!product) return {}
  const base = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? ""
  const summary = (product.short_description ?? product.description ?? "").trim() || undefined
  const images = product.images?.length > 0
    ? [{ url: product.images[0].url, alt: product.images[0].alt_text ?? product.name }]
    : []
  return {
    title: product.name,
    description: summary,
    openGraph: {
      title: product.name,
      description: summary,
      url: `${base}/products/${slug}`,
      type: "website",
      images,
    },
    twitter: { card: images.length > 0 ? "summary_large_image" : "summary", title: product.name, description: summary, images: images.map(i => i.url) },
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  const product = await serverFetch<Product>(`/api/products/by-slug/${slug}`)
  if (!product) notFound()

  const [reviews, summary, branding, categoryPath, related] = await Promise.all([
    serverFetch<Review[]>(`/api/reviews?product_id=${product.id}`).catch(() => [] as Review[]),
    serverFetch<ReviewSummary>(`/api/reviews/summary?product_id=${product.id}`).catch(() => null),
    serverFetch<BrandingConfig>("/api/branding").catch(() => null),
    product.category_id
      ? serverFetch<CategoryPathItem[]>(`/api/categories/${product.category_id}/path`).catch(() => null)
      : Promise.resolve(null),
    product.category_id
      ? serverFetch<PaginatedResponse<Product>>(
          `/api/products?category_id=${product.category_id}&page_size=5`,
        ).catch(() => null)
      : Promise.resolve(null),
  ])

  const inStock = product.stock_quantity > 0
  const defaultVariantId = product.variants?.find(v => v.is_default)?.id ?? ""
  const categoryLeaf = categoryPath && categoryPath.length > 0 ? categoryPath[categoryPath.length - 1] : null

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <Breadcrumbs path={categoryPath} productName={product.name} />

      <ProductDetailClient
        product={product}
        inStock={inStock}
        defaultVariantId={defaultVariantId}
        summary={summary}
        branding={branding}
        categoryLeaf={categoryLeaf}
      />

      <ProductTabs product={product} reviews={reviews ?? []} summary={summary} />

      <RelatedProducts products={related?.items ?? []} currentId={product.id} />
    </div>
  )
}

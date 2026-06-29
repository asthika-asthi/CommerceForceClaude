import { serverFetch } from "@/lib/api"
import type { Product, Review, ReviewSummary } from "@/lib/types"
import { notFound } from "next/navigation"
import Link from "next/link"
import { WishlistButton } from "@/components/shop/wishlist-button"
import { ProductReviews } from "./reviews"
import { ProductDetailClient } from "./product-detail-client"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const product = await serverFetch<Product>(`/api/products/by-slug/${slug}`)
  if (!product) return {}
  const base = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? ""
  const images = product.images?.length > 0
    ? [{ url: product.images[0].url, alt: product.images[0].alt_text ?? product.name }]
    : []
  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
      url: `${base}/products/${slug}`,
      type: "website",
      images,
    },
    twitter: { card: images.length > 0 ? "summary_large_image" : "summary", title: product.name, description: product.description, images: images.map(i => i.url) },
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  const product = await serverFetch<Product>(`/api/products/by-slug/${slug}`)
  if (!product) notFound()

  const [reviews, summary] = await Promise.all([
    serverFetch<Review[]>(`/api/reviews?product_id=${product.id}`).catch(() => [] as Review[]),
    serverFetch<ReviewSummary>(`/api/reviews/summary?product_id=${product.id}`).catch(() => null),
  ])

  const inStock = product.stock_quantity > 0
  const defaultVariantId = product.variants?.find(v => v.is_default)?.id ?? ""

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link href="/products" className="inline-flex items-center gap-1.5 text-[13px] text-[#5C5C5C] hover:text-brand-dark mb-6 transition-colors">
        Back to products
      </Link>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div>
          {product.images && product.images.length > 0 ? (
            <div className="space-y-3">
              <div className="aspect-square bg-slate-50 rounded-2xl overflow-hidden">
                <img src={product.images[0].url} alt={product.images[0].alt_text ?? product.name}
                  className="w-full h-full object-cover" />
              </div>
              {product.images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {product.images.slice(1, 5).map((img) => (
                    <div key={img.id} className="aspect-square bg-slate-50 rounded-xl overflow-hidden">
                      <img src={img.url} alt={img.alt_text ?? ""} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-square bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 text-6xl">
              &#128230;
            </div>
          )}
        </div>

        <div>
          <div className="flex items-start justify-between gap-3 mb-3">
            <h1 className="text-3xl font-bold text-slate-900">{product.name}</h1>
            <WishlistButton productId={product.id} size={20} className="mt-1" />
          </div>

          <ProductDetailClient
            product={product}
            inStock={inStock}
            defaultVariantId={defaultVariantId}
            summary={summary}
          />
        </div>
      </div>

      <ProductReviews productId={product.id} initialReviews={reviews ?? []} summary={summary} />
    </div>
  )
}

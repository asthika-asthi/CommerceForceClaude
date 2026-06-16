import { serverFetch } from "@/lib/api"
import type { Product, Review, ReviewSummary } from "@/lib/types"
import { notFound } from "next/navigation"
import Link from "next/link"
import { AddToCartButton } from "./add-to-cart-button"
import { WishlistButton } from "@/components/shop/wishlist-button"
import { ProductReviews } from "./reviews"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const product = await serverFetch<Product>(`/api/products/by-slug/${slug}`)
  if (!product) return {}
  return { title: product.name, description: product.description }
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  const product = await serverFetch<Product>(`/api/products/by-slug/${slug}`)
  if (!product) notFound()

  const [reviews, summary] = await Promise.all([
    serverFetch<Review[]>(`/api/reviews?product_id=${product.id}`).catch(() => [] as Review[]),
    serverFetch<ReviewSummary>(`/api/reviews/summary?product_id=${product.id}`).catch(() => null),
  ])

  const price = parseFloat(product.price)
  const salePrice = product.sale_price ? parseFloat(product.sale_price) : null
  const displayPrice = salePrice ?? price

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

          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-2xl font-bold text-slate-900">&#163;{displayPrice.toFixed(2)}</span>
            {salePrice && <span className="text-lg text-slate-400 line-through">&#163;{price.toFixed(2)}</span>}
          </div>

          {summary && summary.total_reviews > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <StarRow rating={summary.average_rating} />
              <span className="text-sm text-slate-500">
                {summary.average_rating.toFixed(1)} ({summary.total_reviews} {summary.total_reviews === 1 ? "review" : "reviews"})
              </span>
            </div>
          )}

          {product.stock_quantity > 0 ? (
            <p className="text-sm text-green-600 font-medium mb-4">In stock ({product.stock_quantity} available)</p>
          ) : (
            <p className="text-sm text-red-500 font-medium mb-4">Out of stock</p>
          )}

          {product.description && (
            <div className="prose prose-sm prose-slate mb-6">
              <p>{product.description}</p>
            </div>
          )}

          <AddToCartButton productId={product.id} inStock={product.stock_quantity > 0} />
        </div>
      </div>

      <ProductReviews productId={product.id} initialReviews={reviews ?? []} summary={summary} />
    </div>
  )
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} className={`w-4 h-4 ${n <= Math.round(rating) ? "text-amber-400" : "text-slate-200"} fill-current`} viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}
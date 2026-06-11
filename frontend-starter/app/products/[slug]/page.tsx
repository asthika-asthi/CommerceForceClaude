import { serverFetch } from "@/lib/api"
import type { Product } from "@/lib/types"
import { notFound } from "next/navigation"
import { AddToCartButton } from "./add-to-cart-button"

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

  const price = parseFloat(product.price)
  const salePrice = product.sale_price ? parseFloat(product.sale_price) : null
  const displayPrice = salePrice ?? price

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Images */}
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
            <div className="aspect-square bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 text-4xl">
              📦
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">{product.name}</h1>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-2xl font-bold text-slate-900">${displayPrice.toFixed(2)}</span>
            {salePrice && <span className="text-lg text-slate-400 line-through">${price.toFixed(2)}</span>}
          </div>

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
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ShoppingCart, Check, Package, X } from 'lucide-react'
import { api } from '@/lib/api'
import { useCartStore } from '@/store/cart'
import type { Product, ProductsResponse } from '@/lib/types'
import { formatMoney } from "@/lib/currency"

interface FeaturedProductsGridProps {
  title?: string
  subtitle?: string
  maxProducts?: number
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-card-bg overflow-hidden animate-pulse">
      <div className="aspect-square bg-slate-200" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-4 bg-slate-200 rounded w-1/3" />
        <div className="h-9 bg-slate-200 rounded-lg mt-2" />
      </div>
    </div>
  )
}

function ProductGridCard({ product }: { product: Product }) {
  const addProduct = useCartStore((s) => s.addProduct)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [failed, setFailed] = useState(false)

  const imageUrl = product.primary_image ?? product.images?.[0]?.url ?? null
  const price = parseFloat(product.price)
  const salePrice = product.sale_price ? parseFloat(product.sale_price) : null

  async function handleAdd() {
    if (adding) return
    setAdding(true)
    setFailed(false)
    try {
      const ok = await addProduct(product.id)
      if (ok) {
        setAdded(true)
        setTimeout(() => setAdded(false), 2000)
      } else {
        setFailed(true)
        setTimeout(() => setFailed(false), 2500)
      }
    } finally {
      setAdding(false)
    }
  }

  return (
    <motion.div
      className="rounded-2xl border border-border bg-card-bg overflow-hidden group flex flex-col"
      whileHover={{ y: -6, boxShadow: '0 20px 40px -12px rgba(0,0,0,0.15)' }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <Link href={`/products/${product.slug}`} className="block overflow-hidden">
        <div className="relative aspect-square bg-slate-100 overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              unoptimized
              sizes="(min-width: 768px) 25vw, 50vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <Package size={48} />
            </div>
          )}
        </div>
      </Link>

      <div className="p-4 flex flex-col flex-1">
        <Link href={`/products/${product.slug}`}>
          <h3 className="font-semibold text-fg text-sm leading-snug hover:text-brand-dark transition-colors line-clamp-2 mb-1">
            {product.name}
          </h3>
        </Link>

        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-brand-dark text-base">
              {formatMoney((salePrice ?? price).toFixed(2))}
            </span>
            {salePrice && (
              <span className="text-xs text-muted line-through">{formatMoney(price.toFixed(2))}</span>
            )}
          </div>

          {product.stock_quantity > 0 ? (
            <button
              onClick={handleAdd}
              disabled={adding}
              aria-label={added ? 'Added to cart' : failed ? 'Failed to add' : 'Add to cart'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-60 ${
                added
                  ? 'bg-green-600 text-white'
                  : failed
                  ? 'bg-red-600 text-white'
                  : 'bg-brand hover:bg-brand-hover text-on-brand'
              }`}
            >
              {added ? (
                <>
                  <Check size={13} />
                  Added
                </>
              ) : failed ? (
                <>
                  <X size={13} />
                  Try again
                </>
              ) : (
                <>
                  <ShoppingCart size={13} />
                  Add to cart
                </>
              )}
            </button>
          ) : (
            <span className="text-xs text-muted font-medium">Out of stock</span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function FeaturedProductsGrid({
  title = 'Featured Products',
  subtitle,
  maxProducts = 8,
}: FeaturedProductsGridProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<ProductsResponse>(`/api/products?featured_only=true&page_size=${maxProducts}`)
      .then((data) => setProducts(data.items))
      .catch((err) => setError(err.message ?? 'Failed to load products'))
      .finally(() => setLoading(false))
  }, [maxProducts])

  return (
    <section className="py-20 px-4 bg-bg">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold text-brand-dark mb-3">{title}</h2>
          {subtitle && <p className="text-muted text-lg max-w-xl mx-auto">{subtitle}</p>}
        </div>

        {error && (
          <div className="text-center py-16 text-muted">
            <p>Unable to load products right now.</p>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : products.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.06, ease: 'easeOut' }}
                >
                  <ProductGridCard product={product} />
                </motion.div>
              ))}
        </div>

        {!loading && !error && products.length === 0 && (
          <div className="text-center py-16 text-muted">
            <p>No featured products yet.</p>
          </div>
        )}

        {!loading && products.length > 0 && (
          <div className="text-center mt-10">
            <Link
              href="/products"
              className="inline-block px-8 py-3 rounded-xl bg-brand-dark text-white font-semibold hover:opacity-90 transition-opacity"
            >
              View all products
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

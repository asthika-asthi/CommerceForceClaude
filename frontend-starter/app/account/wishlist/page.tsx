"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import type { WishlistItem, Product } from "@/lib/types"
import { ArrowLeft, Heart, ShoppingCart } from "lucide-react"
import { useCartStore } from "@/store/cart"
import { formatMoney } from "@/lib/currency"

export default function WishlistPage() {
  const user = useAuthStore((s) => s.user)
  const router = useRouter()
  const addProduct = useCartStore((s) => s.addProduct)
  const [items, setItems] = useState<(WishlistItem & { product?: Product })[]>([])
  const [loading, setLoading] = useState(true)

  const loadWishlist = useCallback(async () => {
    try {
      const wishlist = await api.get<WishlistItem[]>("/api/wishlist")
      const withProducts = await Promise.all(
        wishlist.map(async (w) => {
          try {
            const product = await api.get<Product>(`/api/products/${w.product_id}`)
            return { ...w, product }
          } catch {
            return w
          }
        })
      )
      setItems(withProducts)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) { router.push("/login"); return }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- calls the async loader on mount (setState happens post-await, not synchronously); proper refactor tracked in backlog "Storefront lint debt"
    loadWishlist()
  }, [user, router, loadWishlist])

  async function remove(productId: string) {
    try {
      await api.del(`/api/wishlist/${productId}`)
      setItems((prev) => prev.filter((i) => i.product_id !== productId))
    } catch {
      // silently ignore — item stays visible if delete fails
    }
  }

  async function moveToCart(productId: string) {
    // Only remove from the wishlist if the item actually made it into the cart.
    const ok = await addProduct(productId)
    if (ok) await remove(productId)
  }

  if (!user || loading) return <div className="flex justify-center py-20 text-slate-400">Loading...</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/account" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={14} /> Back to account
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Wishlist</h1>

      {items.length === 0 ? (
        <div className="bg-card-bg border border-slate-100 rounded-2xl p-10 text-center text-slate-400">
          <Heart size={32} className="mx-auto mb-3 text-slate-200" />
          <p className="mb-3">Your wishlist is empty.</p>
          <Link href="/products" className="text-brand-dark text-sm hover:underline">Browse products</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const p = item.product
            return (
              <div key={item.id} className="bg-card-bg border border-slate-100 rounded-2xl p-4 flex items-center gap-4">
                {p?.images?.[0]?.url ? (
                  <Image src={p.images[0].url} alt={p.name} width={64} height={64} unoptimized className="w-16 h-16 object-cover rounded-xl flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 bg-slate-100 rounded-xl flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  {p ? (
                    <>
                      <Link href={`/products/${p.slug}`} className="font-medium text-slate-900 hover:text-brand-dark text-sm line-clamp-1">{p.name}</Link>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">
                        {formatMoney(parseFloat(p.sale_price ?? p.price).toFixed(2))}
                      </p>
                      <p className={`text-xs mt-0.5 ${p.stock_quantity > 0 ? "text-green-600" : "text-red-500"}`}>
                        {p.stock_quantity > 0 ? "In stock" : "Out of stock"}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">Product unavailable</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {p && p.stock_quantity > 0 && (
                    <button
                      onClick={() => moveToCart(item.product_id)}
                      className="flex items-center gap-1.5 text-xs font-medium bg-brand hover:bg-brand-hover text-on-brand px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <ShoppingCart size={12} /> Add to cart
                    </button>
                  )}
                  <button
                    onClick={() => remove(item.product_id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                    title="Remove"
                  >
                    <Heart size={16} fill="currentColor" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

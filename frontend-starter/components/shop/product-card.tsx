"use client"
import { useState } from "react"
import Link from "next/link"
import { ShoppingCart, Check } from "lucide-react"
import { useCartStore } from "@/store/cart"
import type { Product } from "@/lib/types"

export function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem)
  const image = product.images?.[0]
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  const price = parseFloat(product.price)
  const salePrice = product.sale_price ? parseFloat(product.sale_price) : null
  const displayPrice = salePrice ?? price

  async function handleAdd() {
    if (adding) return
    setAdding(true)
    try {
      await addItem(product.id)
      setAdded(true)
      setTimeout(() => setAdded(false), 2000)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group">
      <Link href={`/products/${product.slug}`}>
        <div className="aspect-square bg-slate-50 overflow-hidden">
          {image ? (
            <img src={image.url} alt={image.alt_text ?? product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-200">
              <ShoppingCart size={40} />
            </div>
          )}
        </div>
      </Link>

      <div className="p-4">
        <Link href={`/products/${product.slug}`}>
          <h3 className="font-medium text-slate-900 text-sm hover:text-brand-dark transition-colors line-clamp-2">
            {product.name}
          </h3>
        </Link>

        <div className="flex items-center justify-between mt-3">
          <div>
            <span className="font-bold text-slate-900">${displayPrice.toFixed(2)}</span>
            {salePrice && (
              <span className="ml-2 text-xs text-slate-400 line-through">${price.toFixed(2)}</span>
            )}
          </div>
          {product.stock_quantity > 0 ? (
            <button
              onClick={handleAdd}
              disabled={adding}
              className={`p-2 rounded-lg transition-colors disabled:opacity-60 ${
                added ? "bg-green-600 text-white" : "bg-brand hover:bg-brand-hover text-white"
              }`}
              title={added ? "Added!" : "Add to cart"}
            >
              {added ? <Check size={15} /> : <ShoppingCart size={15} />}
            </button>
          ) : (
            <span className="text-xs text-slate-400 font-medium">Out of stock</span>
          )}
        </div>
      </div>
    </div>
  )
}

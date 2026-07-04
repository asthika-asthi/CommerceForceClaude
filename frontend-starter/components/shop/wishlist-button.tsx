"use client"
import { useState, useEffect } from "react"
import { Heart } from "lucide-react"
import { useAuthStore } from "@/store/auth"
import { usePlugin } from "@/lib/plugins-context"
import { api } from "@/lib/api"

interface WishlistButtonProps {
  productId: string
  className?: string
  size?: number
}

export function WishlistButton({ productId, className = "", size = 16 }: WishlistButtonProps) {
  const user = useAuthStore((s) => s.user)
  const wishlistEnabled = usePlugin("wishlist")
  const [inWishlist, setInWishlist] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!user || !wishlistEnabled) return
    api.get<string[]>("/api/wishlist/ids")
      .then((ids) => setInWishlist(ids.includes(productId)))
      .catch(() => {})
  }, [user, productId, wishlistEnabled])

  if (!user || !wishlistEnabled) return null

  async function toggle() {
    if (loading) return
    const prev = inWishlist
    setLoading(true)
    setFailed(false)
    try {
      if (inWishlist) {
        await api.del(`/api/wishlist/${productId}`)
        setInWishlist(false)
      } else {
        await api.post(`/api/wishlist/${productId}`, {})
        setInWishlist(true)
      }
    } catch {
      setInWishlist(prev)
      setFailed(true)
      setTimeout(() => setFailed(false), 2500)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); toggle() }}
      disabled={loading}
      className={`p-1.5 rounded-full transition-colors disabled:opacity-50 ${
        failed ? "text-red-600 ring-1 ring-red-300" : inWishlist ? "text-red-500 hover:text-red-600" : "text-slate-400 hover:text-red-400"
      } ${className}`}
      title={failed ? "Couldn't update wishlist — try again" : inWishlist ? "Remove from wishlist" : "Add to wishlist"}
      aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Heart size={size} fill={inWishlist ? "currentColor" : "none"} />
    </button>
  )
}

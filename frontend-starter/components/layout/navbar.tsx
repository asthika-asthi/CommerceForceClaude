"use client"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState, useRef } from "react"
import { useAuthStore } from "@/store/auth"
import { useCartStore } from "@/store/cart"
import { usePlugin } from "@/lib/plugins-context"
import type { BrandingConfig } from "@/lib/types"

interface Props {
  branding: BrandingConfig | null
  enabledPlugins: string[]
}

function getInitials(name: string) {
  return name.replace(/[^A-Za-z\s]/g, "").split(/\s+/).filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2) || "ST"
}

export function Navbar({ branding }: Props) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const cart = useCartStore((s) => s.cart)
  const cartEnabled = usePlugin("cart")
  const schedulingEnabled = usePlugin("scheduling")
  const itemCount = cart?.item_count ?? 0
  const [query, setQuery] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const storeName = (branding?.store_name ?? "").trim()
  const tagline = branding?.tagline ?? ""
  const logoUrl = branding?.logo_url
  const initials = storeName ? getInitials(storeName) : ""

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) router.push(`/products?q=${encodeURIComponent(query.trim())}`)
  }

  async function handleLogout() {
    await logout()
    router.push("/")
  }

  return (
    <header className="bg-card-bg border-b border-border sticky top-0 z-50">
      <div className="max-w-[1280px] mx-auto px-10 flex items-center h-[72px] gap-6">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 flex-shrink-0">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={storeName || "Home"}
              width={160}
              height={40}
              unoptimized
              style={{ width: "auto", height: "40px" }}
            />
          ) : initials ? (
            <div className="w-11 h-11 bg-brand rounded-lg flex items-center justify-center text-on-brand font-bold text-lg leading-none">
              {initials}
            </div>
          ) : null}
          {storeName && (
            <div className="leading-tight">
              <div className="text-[18px] font-bold text-brand-dark">{storeName}</div>
              {tagline && <div className="text-[10px] text-muted tracking-[0.5px] uppercase">{tagline}</div>}
            </div>
          )}
        </Link>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-[480px] relative">
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search products…"
            className="w-full border-[1.5px] border-border rounded-lg px-4 py-[10px] pr-11 text-sm text-fg bg-bg focus:border-brand-dark focus:bg-card-bg outline-none transition-colors placeholder:text-text-placeholder"
          />
          <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-lg bg-transparent border-none cursor-pointer">
            🔍
          </button>
        </form>

        {/* Actions */}
        <div className="flex items-center gap-1.5 ml-auto">
          {user ? (
            <div className="hidden md:flex items-center gap-2">
              <Link href="/account" className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg hover:bg-bg transition-colors">
                <span className="text-[22px] text-brand-dark">👤</span>
                <span className="text-[10px] text-muted whitespace-nowrap">{user.first_name}</span>
              </Link>
              <button onClick={handleLogout} className="text-xs text-muted hover:text-fg px-2">Sign out</button>
            </div>
          ) : (
            <Link href="/login" className="hidden md:flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg hover:bg-bg transition-colors">
              <span className="text-[22px] text-brand-dark">👤</span>
              <span className="text-[10px] text-muted">Account</span>
            </Link>
          )}

          {cartEnabled && (
            <Link href="/cart" className="relative flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg hover:bg-bg transition-colors">
              <span className="text-[22px] text-brand-dark">🛒</span>
              <span className="text-[10px] text-muted">Cart</span>
              {itemCount > 0 && (
                <span className="absolute top-0.5 right-1.5 bg-brand text-on-brand text-[9px] font-bold w-[15px] h-[15px] rounded-full flex items-center justify-center leading-none">
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              )}
            </Link>
          )}

          {schedulingEnabled && (
            <Link href="/book" className="hidden md:block text-sm font-medium text-brand-dark hover:underline px-2 whitespace-nowrap">
              Book
            </Link>
          )}

          <a href="/contact" className="hidden md:block bg-brand hover:bg-brand-hover text-on-brand text-sm font-semibold px-5 py-[10px] rounded-lg transition-colors whitespace-nowrap">
            Get a Quote
          </a>

          {/* Mobile hamburger */}
          <button className="md:hidden p-2 text-fg" onClick={() => setMenuOpen(v => !v)} aria-label="Menu">
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-card-bg px-6 py-4 space-y-3">
          <Link href="/products" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-fg py-1">All Products</Link>
          {schedulingEnabled && (
            <Link href="/book" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-fg py-1">Book</Link>
          )}
          {cartEnabled && (
            <Link href="/cart" onClick={() => setMenuOpen(false)} className="block text-sm text-fg py-1">Cart</Link>
          )}
          {user ? (
            <>
              <Link href="/account" onClick={() => setMenuOpen(false)} className="block text-sm text-fg py-1">My Account</Link>
              <button onClick={handleLogout} className="block text-sm text-muted py-1 w-full text-left">Sign out</button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMenuOpen(false)} className="block text-sm text-fg py-1">Sign in</Link>
              <Link href="/register" onClick={() => setMenuOpen(false)} className="block text-sm text-brand py-1">Register</Link>
            </>
          )}
          <a href="/contact" className="block text-sm font-semibold text-brand py-1">Get a Quote</a>
        </div>
      )}
    </header>
  )
}

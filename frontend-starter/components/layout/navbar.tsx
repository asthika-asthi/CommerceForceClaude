"use client"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState, useRef, useEffect } from "react"
import { useAuthStore } from "@/store/auth"
import { useCartStore } from "@/store/cart"
import { usePlugin } from "@/lib/plugins-context"
import { getStoreInitials } from "@/lib/store-initials"
import { headerSizeVars } from "@/lib/header-config"
import type { BrandingConfig } from "@/lib/types"

interface Props {
  branding: BrandingConfig | null
  enabledPlugins: string[]
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
  const [scrolled, setScrolled] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const storeName = (branding?.store_name ?? "").trim()
  // Clients who want a blank brand lockup unless a real logo image is set can
  // turn this off in Branding — it hides the store-name text, the tagline, and
  // the initials monogram that otherwise stands in for a missing logo.
  const showName = branding?.show_store_name !== false
  const tagline = showName ? (branding?.tagline ?? "") : ""
  const logoUrl = branding?.logo_url
  const initials = showName && storeName ? (getStoreInitials(storeName) || "ST") : ""

  // Branding-driven header look & feel (all default off / "standard").
  const headerSize = branding?.header_size ?? "standard"
  const elevated = branding?.header_elevated === true
  const filled = branding?.header_filled === true
  const shrinkOnScroll = branding?.header_shrink_on_scroll === true
  const shrunk = shrinkOnScroll && scrolled

  useEffect(() => {
    if (!shrinkOnScroll) {
      setScrolled(false)
      return
    }
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [shrinkOnScroll])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) router.push(`/products?q=${encodeURIComponent(query.trim())}`)
  }

  async function handleLogout() {
    await logout()
    router.push("/")
  }

  // Theme-token class sets that flip when the header is filled with --brand-dark.
  const headerBg = filled ? "bg-brand-dark" : "bg-card-bg"
  const borderCls = filled ? "border-dark-border" : "border-border"
  const brandText = filled ? "text-on-dark-strong" : "text-brand-dark"
  const labelText = filled ? "text-on-dark-muted" : "text-muted"
  const hoverBg = filled ? "hover:bg-white/10" : "hover:bg-bg"
  const searchCls = filled
    ? "border-white/25 bg-white/10 text-on-dark-strong placeholder:text-on-dark-muted focus:border-white/60 focus:bg-white/15"
    : "border-border bg-bg text-fg placeholder:text-text-placeholder focus:border-brand-dark focus:bg-card-bg"
  const shadowCls = shrunk
    ? "shadow-[0_6px_24px_rgba(0,0,0,0.14)]"
    : elevated
      ? "shadow-[0_4px_20px_rgba(0,0,0,0.10)]"
      : ""
  const accentCls = elevated
    ? "border-b-2 after:absolute after:inset-x-0 after:-bottom-[2px] after:h-[2px] after:bg-brand after:content-['']"
    : "border-b"

  return (
    <header
      className={`relative ${headerBg} ${borderCls} ${accentCls} ${shadowCls} sticky top-0 z-50 transition-shadow duration-200`}
      style={shrunk ? (headerSizeVars(headerSize, { shrunk: true }) as React.CSSProperties) : undefined}
    >
      <div className="max-w-[1280px] mx-auto px-[var(--header-pad-x,2.5rem)] flex items-center h-[var(--header-height,72px)] gap-6 transition-[height,padding] duration-200">

        {/* Logo */}
        <Link href="/" aria-label={storeName || "Home"} className="flex items-center gap-3 flex-shrink-0">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={storeName || "Home"}
              width={160}
              height={40}
              unoptimized
              style={{ width: "auto", height: "var(--header-logo-h, 40px)" }}
            />
          ) : initials ? (
            <div className={`w-[var(--header-monogram,2.75rem)] h-[var(--header-monogram,2.75rem)] bg-brand rounded-lg flex items-center justify-center text-on-brand font-bold text-lg leading-none`}>
              {initials}
            </div>
          ) : null}
          {showName && storeName && (
            <div className="leading-tight">
              <div className={`text-[length:var(--header-brand-size,18px)] font-bold ${brandText}`}>{storeName}</div>
              {tagline && <div className={`text-[10px] ${labelText} tracking-[0.5px] uppercase`}>{tagline}</div>}
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
            className={`w-full border-[1.5px] rounded-lg px-4 py-[10px] pr-11 text-sm outline-none transition-colors ${searchCls}`}
          />
          <button type="submit" className={`absolute right-3 top-1/2 -translate-y-1/2 ${labelText} text-lg bg-transparent border-none cursor-pointer`}>
            🔍
          </button>
        </form>

        {/* Actions */}
        <div className="flex items-center gap-1.5 ml-auto">
          {user ? (
            <div className="hidden md:flex items-center gap-2">
              <Link href="/account" className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg ${hoverBg} transition-colors`}>
                <span className={`text-[length:var(--header-icon-size,22px)] ${brandText}`}>👤</span>
                <span className={`text-[10px] ${labelText} whitespace-nowrap`}>{user.first_name}</span>
              </Link>
              <button onClick={handleLogout} className={`text-xs ${labelText} ${filled ? "hover:text-on-dark-strong" : "hover:text-fg"} px-2`}>Sign out</button>
            </div>
          ) : (
            <Link href="/login" className={`hidden md:flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg ${hoverBg} transition-colors`}>
              <span className={`text-[length:var(--header-icon-size,22px)] ${brandText}`}>👤</span>
              <span className={`text-[10px] ${labelText}`}>Account</span>
            </Link>
          )}

          {cartEnabled && (
            <Link href="/cart" className={`relative flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg ${hoverBg} transition-colors`}>
              <span className={`text-[length:var(--header-icon-size,22px)] ${brandText}`}>🛒</span>
              <span className={`text-[10px] ${labelText}`}>Cart</span>
              {itemCount > 0 && (
                <span className="absolute top-0.5 right-1.5 bg-brand text-on-brand text-[9px] font-bold w-[15px] h-[15px] rounded-full flex items-center justify-center leading-none">
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              )}
            </Link>
          )}

          {schedulingEnabled && (
            <Link href="/book" className={`hidden md:block text-sm font-medium ${brandText} hover:underline px-2 whitespace-nowrap`}>
              Book
            </Link>
          )}

          <a href="/contact" className="hidden md:block bg-brand hover:bg-brand-hover text-on-brand text-sm font-semibold px-5 py-[10px] rounded-lg transition-colors whitespace-nowrap">
            Get a Quote
          </a>

          {/* Mobile hamburger */}
          <button className={`md:hidden p-2 ${filled ? "text-on-dark-strong" : "text-fg"}`} onClick={() => setMenuOpen(v => !v)} aria-label="Menu">
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className={`md:hidden border-t ${borderCls} ${headerBg} px-6 py-4 space-y-3`}>
          <Link href="/products" onClick={() => setMenuOpen(false)} className={`block text-sm font-medium ${filled ? "text-on-dark-strong" : "text-fg"} py-1`}>All Products</Link>
          {schedulingEnabled && (
            <Link href="/book" onClick={() => setMenuOpen(false)} className={`block text-sm font-medium ${filled ? "text-on-dark-strong" : "text-fg"} py-1`}>Book</Link>
          )}
          {cartEnabled && (
            <Link href="/cart" onClick={() => setMenuOpen(false)} className={`block text-sm ${filled ? "text-on-dark-strong" : "text-fg"} py-1`}>Cart</Link>
          )}
          {user ? (
            <>
              <Link href="/account" onClick={() => setMenuOpen(false)} className={`block text-sm ${filled ? "text-on-dark-strong" : "text-fg"} py-1`}>My Account</Link>
              <button onClick={handleLogout} className={`block text-sm ${labelText} py-1 w-full text-left`}>Sign out</button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMenuOpen(false)} className={`block text-sm ${filled ? "text-on-dark-strong" : "text-fg"} py-1`}>Sign in</Link>
              <Link href="/register" onClick={() => setMenuOpen(false)} className={`block text-sm ${filled ? "text-brand-highlight" : "text-brand"} py-1`}>Register</Link>
            </>
          )}
          <a href="/contact" className={`block text-sm font-semibold ${filled ? "text-brand-highlight" : "text-brand"} py-1`}>Get a Quote</a>
        </div>
      )}
    </header>
  )
}

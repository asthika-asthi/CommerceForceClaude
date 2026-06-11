"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ShoppingCart, User, Menu, X } from "lucide-react"
import { useState } from "react"
import { useAuthStore } from "@/store/auth"
import { useCartStore } from "@/store/cart"
import type { BrandingConfig } from "@/lib/types"

interface Props { branding: BrandingConfig | null }

export function Navbar({ branding }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const cart = useCartStore((s) => s.cart)
  const [menuOpen, setMenuOpen] = useState(false)

  const itemCount = cart?.item_count ?? 0

  const links = [
    { href: "/products", label: "Shop" },
  ]

  async function handleLogout() {
    await logout()
    router.push("/")
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="text-xl font-bold text-slate-900 tracking-tight">
          {branding?.store_name ?? "Store"}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-sm font-medium transition-colors ${
                pathname.startsWith(href) ? "text-brand-dark" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <Link href="/cart" className="relative p-2 text-slate-600 hover:text-slate-900">
            <ShoppingCart size={20} />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-brand text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {itemCount > 9 ? "9+" : itemCount}
              </span>
            )}
          </Link>
          {user ? (
            <div className="hidden md:flex items-center gap-3">
              <Link href="/account" className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1">
                <User size={16} /> {user.first_name}
              </Link>
              <button onClick={handleLogout} className="text-sm text-slate-400 hover:text-slate-700">
                Sign out
              </button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-3">
              <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900">Sign in</Link>
              <Link
                href="/register"
                className="text-sm bg-brand hover:bg-brand-hover text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Register
              </Link>
            </div>
          )}
          <button className="md:hidden p-2 text-slate-600" onClick={() => setMenuOpen((v) => !v)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-4 space-y-3">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setMenuOpen(false)}
              className="block text-sm font-medium text-slate-700 py-1">{label}</Link>
          ))}
          {user ? (
            <>
              <Link href="/account" onClick={() => setMenuOpen(false)} className="block text-sm text-slate-700 py-1">Account</Link>
              <button onClick={handleLogout} className="block text-sm text-slate-400 py-1 w-full text-left">Sign out</button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMenuOpen(false)} className="block text-sm text-slate-700 py-1">Sign in</Link>
              <Link href="/register" onClick={() => setMenuOpen(false)} className="block text-sm text-brand-dark py-1">Register</Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}

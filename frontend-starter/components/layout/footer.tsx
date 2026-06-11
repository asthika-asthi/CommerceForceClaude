import Link from "next/link"
import type { BrandingConfig } from "@/lib/types"

interface Props { branding: BrandingConfig | null }

export function Footer({ branding }: Props) {
  return (
    <footer className="bg-slate-900 text-slate-400 text-sm mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <p className="text-white font-semibold text-base mb-2">{branding?.store_name ?? "Store"}</p>
          {branding?.tagline && <p className="text-slate-400">{branding.tagline}</p>}
        </div>
        <div>
          <p className="text-white font-medium mb-2">Shop</p>
          <ul className="space-y-1">
            <li><Link href="/products" className="hover:text-white transition-colors">All Products</Link></li>
            <li><Link href="/cart" className="hover:text-white transition-colors">Cart</Link></li>
            <li><Link href="/account" className="hover:text-white transition-colors">My Account</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-white font-medium mb-2">Contact</p>
          {branding?.contact_email && (
            <a href={`mailto:${branding.contact_email}`} className="hover:text-white transition-colors block">
              {branding.contact_email}
            </a>
          )}
          {branding?.contact_phone && <p>{branding.contact_phone}</p>}
        </div>
      </div>
      <div className="border-t border-slate-800 text-center py-4 text-xs text-slate-500">
        © {new Date().getFullYear()} {branding?.store_name ?? "Store"}. All rights reserved.
      </div>
    </footer>
  )
}

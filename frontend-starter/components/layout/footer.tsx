import Link from "next/link"
import type { BrandingConfig, Category } from "@/lib/types"

interface Props {
  branding: BrandingConfig | null
  categories: Category[]
}

function storeInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return name.slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export function Footer({ branding, categories }: Props) {
  const storeName = (branding?.store_name ?? "").trim()
  const tagline = branding?.tagline ?? ""
  const phone = branding?.contact_phone ?? ""
  const email = branding?.contact_email ?? ""
  const year = new Date().getFullYear()
  const initials = storeName ? storeInitials(storeName) : ""

  const topCategories = categories.slice(0, 6)

  return (
    <footer className="bg-dark-deep pt-[60px]">
      <div className="max-w-[1280px] mx-auto px-10">
        <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr_1.5fr] gap-10 mb-12">

          {/* Brand */}
          <div>
            {(storeName || branding?.logo_url) && (
              <div className="flex items-center gap-2.5">
                {branding?.logo_url ? (
                  <img src={branding.logo_url} alt={storeName || "Logo"} className="h-10 w-auto" />
                ) : (
                  <div className="w-10 h-10 bg-brand rounded-lg flex items-center justify-center text-base font-bold text-on-brand">{initials}</div>
                )}
                {storeName && (
                  <div>
                    <div className="text-base font-bold text-white">{storeName}</div>
                    {tagline && <div className="text-[10px] text-on-dark-faint uppercase tracking-[0.5px]">{tagline}</div>}
                  </div>
                )}
              </div>
            )}
            {tagline && (
              <p className="text-[13px] text-on-dark-muted leading-[1.7] mt-3.5 max-w-[260px]">{tagline}</p>
            )}
          </div>

          {/* Products — driven by DB categories */}
          <div>
            <h4 className="text-[12px] font-bold text-on-dark-strong uppercase tracking-[0.8px] mb-4">Products</h4>
            {topCategories.length > 0 ? (
              topCategories.map(cat => (
                <Link key={cat.id} href={`/products?category=${cat.id}`} className="block text-[13px] text-on-dark-muted mb-2.5 hover:text-on-dark-strong transition-colors">
                  {cat.name}
                </Link>
              ))
            ) : (
              <Link href="/products" className="block text-[13px] text-on-dark-muted mb-2.5 hover:text-on-dark-strong transition-colors">
                View all products
              </Link>
            )}
          </div>

          {/* Trade */}
          <div>
            <h4 className="text-[12px] font-bold text-on-dark-strong uppercase tracking-[0.8px] mb-4">Trade</h4>
            {[
              { label: "Register for trade", href: "/register" },
              { label: "Trade login", href: "/login" },
              { label: "Bulk & bespoke orders", href: "/bespoke" },
              { label: "30-day terms", href: "/trade" },
            ].map(({ label, href }) => (
              <Link key={label} href={href} className="block text-[13px] text-on-dark-muted mb-2.5 hover:text-on-dark-strong transition-colors">{label}</Link>
            ))}
          </div>

          {/* Help */}
          <div>
            <h4 className="text-[12px] font-bold text-on-dark-strong uppercase tracking-[0.8px] mb-4">Help</h4>
            {[
              { label: "Delivery information", href: "/contact" },
              { label: "Returns policy", href: "/contact" },
              { label: "Track your order", href: "/track-order" },
              { label: "FAQs", href: "/faq" },
              { label: "Contact us", href: "/contact" },
            ].map(({ label, href }) => (
              <Link key={label} href={href} className="block text-[13px] text-on-dark-muted mb-2.5 hover:text-on-dark-strong transition-colors">{label}</Link>
            ))}
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-[12px] font-bold text-on-dark-strong uppercase tracking-[0.8px] mb-4">Contact</h4>
            {phone && (
              <div className="flex items-start gap-2 mb-2.5">
                <span className="text-brand text-sm flex-shrink-0 mt-px">📞</span>
                <span className="text-[13px] text-on-dark-muted">{phone}</span>
              </div>
            )}
            {email && (
              <div className="flex items-start gap-2 mb-2.5">
                <span className="text-brand text-sm flex-shrink-0 mt-px">✉️</span>
                <a href={`mailto:${email}`} className="text-[13px] text-on-dark-muted hover:text-on-dark-strong transition-colors">{email}</a>
              </div>
            )}
            {!phone && !email && (
              <Link href="/contact" className="text-[13px] text-on-dark-muted hover:text-on-dark-strong transition-colors">Get in touch →</Link>
            )}
          </div>
        </div>
      </div>

      <hr className="border-none border-t border-brand-dark" />

      <div className="max-w-[1280px] mx-auto px-10 py-5 flex justify-between items-center flex-wrap gap-2.5">
        <div className="text-[12px] text-on-dark-faint">
          © {year}{storeName ? ` ${storeName}` : ""}. All rights reserved.&nbsp;|&nbsp;
          <Link href="/privacy" className="hover:text-on-dark-muted transition-colors">Privacy Policy</Link>&nbsp;|&nbsp;
          <Link href="/terms" className="hover:text-on-dark-muted transition-colors">Terms</Link>&nbsp;|&nbsp;
          <Link href="/cookies" className="hover:text-on-dark-muted transition-colors">Cookie Policy</Link>
        </div>
        <div className="flex gap-1.5">
          {["VISA", "MC", "AMEX", "BACS"].map(p => (
            <span key={p} className="bg-brand-dark border border-dark-border rounded px-2 py-0.5 text-[11px] text-on-dark font-semibold">{p}</span>
          ))}
        </div>
      </div>
    </footer>
  )
}

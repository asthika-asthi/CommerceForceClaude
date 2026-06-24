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
  const storeName = branding?.store_name ?? "Store"
  const tagline = branding?.tagline ?? ""
  const phone = branding?.contact_phone ?? ""
  const email = branding?.contact_email ?? ""
  const year = new Date().getFullYear()
  const initials = storeInitials(storeName)

  const topCategories = categories.slice(0, 6)

  return (
    <footer className="bg-[#0F1E38] pt-[60px]">
      <div className="max-w-[1280px] mx-auto px-10">
        <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr_1.5fr] gap-10 mb-12">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-brand rounded-lg flex items-center justify-center text-base font-bold text-white">{initials}</div>
              <div>
                <div className="text-base font-bold text-white">{storeName}</div>
                {tagline && <div className="text-[10px] text-[#4A6280] uppercase tracking-[0.5px]">{tagline}</div>}
              </div>
            </div>
            {tagline && (
              <p className="text-[13px] text-[#7A92B0] leading-[1.7] mt-3.5 max-w-[260px]">{tagline}</p>
            )}
          </div>

          {/* Products — driven by DB categories */}
          <div>
            <h4 className="text-[12px] font-bold text-[#CBD8EE] uppercase tracking-[0.8px] mb-4">Products</h4>
            {topCategories.length > 0 ? (
              topCategories.map(cat => (
                <Link key={cat.id} href={`/products?category=${cat.slug}`} className="block text-[13px] text-[#7A92B0] mb-2.5 hover:text-[#CBD8EE] transition-colors">
                  {cat.name}
                </Link>
              ))
            ) : (
              <Link href="/products" className="block text-[13px] text-[#7A92B0] mb-2.5 hover:text-[#CBD8EE] transition-colors">
                View all products
              </Link>
            )}
          </div>

          {/* Trade */}
          <div>
            <h4 className="text-[12px] font-bold text-[#CBD8EE] uppercase tracking-[0.8px] mb-4">Trade</h4>
            {[
              { label: "Register for trade", href: "/register" },
              { label: "Trade login", href: "/login" },
              { label: "Bulk & bespoke orders", href: "/bespoke" },
              { label: "30-day terms", href: "/trade" },
            ].map(({ label, href }) => (
              <Link key={label} href={href} className="block text-[13px] text-[#7A92B0] mb-2.5 hover:text-[#CBD8EE] transition-colors">{label}</Link>
            ))}
          </div>

          {/* Help */}
          <div>
            <h4 className="text-[12px] font-bold text-[#CBD8EE] uppercase tracking-[0.8px] mb-4">Help</h4>
            {[
              "Delivery information", "Returns policy", "FAQs", "Contact us"
            ].map(label => (
              <Link key={label} href="/contact" className="block text-[13px] text-[#7A92B0] mb-2.5 hover:text-[#CBD8EE] transition-colors">{label}</Link>
            ))}
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-[12px] font-bold text-[#CBD8EE] uppercase tracking-[0.8px] mb-4">Contact</h4>
            {phone && (
              <div className="flex items-start gap-2 mb-2.5">
                <span className="text-brand text-sm flex-shrink-0 mt-px">📞</span>
                <span className="text-[13px] text-[#7A92B0]">{phone}</span>
              </div>
            )}
            {email && (
              <div className="flex items-start gap-2 mb-2.5">
                <span className="text-brand text-sm flex-shrink-0 mt-px">✉️</span>
                <a href={`mailto:${email}`} className="text-[13px] text-[#7A92B0] hover:text-[#CBD8EE] transition-colors">{email}</a>
              </div>
            )}
            {!phone && !email && (
              <Link href="/contact" className="text-[13px] text-[#7A92B0] hover:text-[#CBD8EE] transition-colors">Get in touch →</Link>
            )}
          </div>
        </div>
      </div>

      <hr className="border-none border-t border-[#1B2A4A]" />

      <div className="max-w-[1280px] mx-auto px-10 py-5 flex justify-between items-center flex-wrap gap-2.5">
        <div className="text-[12px] text-[#4A6280]">
          © {year} {storeName}. All rights reserved.&nbsp;|&nbsp;
          <Link href="/privacy" className="hover:text-[#7A92B0] transition-colors">Privacy Policy</Link>&nbsp;|&nbsp;
          <Link href="/terms" className="hover:text-[#7A92B0] transition-colors">Terms</Link>&nbsp;|&nbsp;
          <Link href="/cookies" className="hover:text-[#7A92B0] transition-colors">Cookie Policy</Link>
        </div>
        <div className="flex gap-1.5">
          {["VISA", "MC", "AMEX", "BACS"].map(p => (
            <span key={p} className="bg-brand-dark border border-[#253A58] rounded px-2 py-0.5 text-[11px] text-[#A8BDD8] font-semibold">{p}</span>
          ))}
        </div>
      </div>
    </footer>
  )
}

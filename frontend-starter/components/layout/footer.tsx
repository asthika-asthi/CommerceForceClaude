import Link from "next/link"
import type { BrandingConfig } from "@/lib/types"

interface Props { branding: BrandingConfig | null }

export function Footer({ branding }: Props) {
  const storeName = branding?.store_name ?? "Tri Star UK Ltd"
  const phone = branding?.contact_phone ?? "01438 880 178"
  const email = branding?.contact_email ?? "sales@tristarltd.co.uk"
  const year = new Date().getFullYear()

  return (
    <footer className="bg-[#0F1E38] pt-[60px]">
      <div className="max-w-[1280px] mx-auto px-10">
        <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr_1.5fr] gap-10 mb-12">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-brand rounded-lg flex items-center justify-center text-base font-bold text-white">TS</div>
              <div>
                <div className="text-base font-bold text-white">{storeName}</div>
                <div className="text-[10px] text-[#4A6280] uppercase tracking-[0.5px]">Est. 1995 · Stevenage, Hertfordshire</div>
              </div>
            </div>
            <p className="text-[13px] text-[#7A92B0] leading-[1.7] mt-3.5 max-w-[260px]">
              Leading importer and distributor of cotton dust sheets, tarpaulins, sacks, bags, and painting accessories. Serving the UK trade and retail for 30 years.
            </p>
          </div>

          {/* Products */}
          <div>
            <h4 className="text-[12px] font-bold text-[#CBD8EE] uppercase tracking-[0.8px] mb-4">Products</h4>
            {["Tarpaulins", "Dust Sheets", "Sacks & Bags", "Paint Brushes", "Rollers", "Special Offers"].map(label => (
              <Link key={label} href="/products" className="block text-[13px] text-[#7A92B0] mb-2.5 hover:text-[#CBD8EE] transition-colors">{label}</Link>
            ))}
          </div>

          {/* Trade */}
          <div>
            <h4 className="text-[12px] font-bold text-[#CBD8EE] uppercase tracking-[0.8px] mb-4">Trade</h4>
            {[
              { label: "Register for trade", href: "/register" },
              { label: "Trade login", href: "/login" },
              { label: "Download price list", href: "/price-list" },
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
              "Delivery information", "Returns policy", "FAQs", "Choosing a tarpaulin", "Contact us"
            ].map(label => (
              <Link key={label} href="/contact" className="block text-[13px] text-[#7A92B0] mb-2.5 hover:text-[#CBD8EE] transition-colors">{label}</Link>
            ))}
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-[12px] font-bold text-[#CBD8EE] uppercase tracking-[0.8px] mb-4">Contact</h4>
            <div className="flex items-start gap-2 mb-2.5">
              <span className="text-brand text-sm flex-shrink-0 mt-px">📍</span>
              <span className="text-[13px] text-[#7A92B0] leading-[1.55]">Redwings Farm, Lanterns Lane, Aston End, Stevenage, Hertfordshire SG2 7HP</span>
            </div>
            <div className="flex items-start gap-2 mb-2.5">
              <span className="text-brand text-sm flex-shrink-0 mt-px">📞</span>
              <span className="text-[13px] text-[#7A92B0]">{phone}<br />01438 221 009</span>
            </div>
            <div className="flex items-start gap-2 mb-2.5">
              <span className="text-brand text-sm flex-shrink-0 mt-px">📠</span>
              <span className="text-[13px] text-[#7A92B0]">Fax: 01438 880 862</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-brand text-sm flex-shrink-0 mt-px">✉️</span>
              <a href={`mailto:${email}`} className="text-[13px] text-[#7A92B0] hover:text-[#CBD8EE] transition-colors">{email}</a>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-none border-t border-[#1B2A4A]" />

      <div className="max-w-[1280px] mx-auto px-10 py-5 flex justify-between items-center flex-wrap gap-2.5">
        <div className="text-[12px] text-[#4A6280]">
          © {year} {storeName}. All rights reserved. Registered in England &amp; Wales.&nbsp;|&nbsp;
          <Link href="/privacy" className="hover:text-[#7A92B0] transition-colors">Privacy Policy</Link>&nbsp;|&nbsp;
          <Link href="/terms" className="hover:text-[#7A92B0] transition-colors">Terms</Link>&nbsp;|&nbsp;
          <Link href="/cookies" className="hover:text-[#7A92B0] transition-colors">Cookie Policy</Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {["UK Importer", "VAT Registered"].map(c => (
              <span key={c} className="bg-brand-dark text-[#7A92B0] text-[10px] font-semibold px-2.5 py-1 rounded border border-[#253A58]">{c}</span>
            ))}
          </div>
          <div className="flex gap-1.5">
            {["VISA", "MC", "AMEX", "BACS"].map(p => (
              <span key={p} className="bg-brand-dark border border-[#253A58] rounded px-2 py-0.5 text-[11px] text-[#A8BDD8] font-semibold">{p}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

import type { BrandingConfig } from "@/lib/types"

interface Props { branding: BrandingConfig | null }

export function Topbar({ branding }: Props) {
  const phone = branding?.contact_phone ?? "01438 880 178"
  const email = branding?.contact_email ?? "sales@tristarltd.co.uk"

  return (
    <div className="bg-brand-dark text-[#CBD8EE] text-[12px] hidden md:block">
      <div className="max-w-[1280px] mx-auto px-10 py-[7px] flex justify-between items-center">
        <div className="flex items-center gap-5">
          <span>📍 Redwings Farm, Stevenage, Hertfordshire SG2 7HP</span>
          <span>📞 {phone}</span>
          <span>✉️ {email}</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/login" className="hover:text-white transition-colors">Trade Login</a>
          <a href="/register" className="hover:text-white transition-colors">Register</a>
          <a href="/price-list" className="hover:text-white transition-colors">Download Price List</a>
        </div>
      </div>
    </div>
  )
}

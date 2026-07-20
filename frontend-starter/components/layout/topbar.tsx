import type { BrandingConfig } from "@/lib/types"

// No hardcoded fallback for address (unlike phone/email): defaulting an
// unset client to Tri Star's real physical address would misrepresent
// their business, not just look unstyled.
interface Props { branding: BrandingConfig | null; address?: string }

export function Topbar({ branding, address }: Props) {
  const phone = branding?.contact_phone ?? "01438 880 178"
  const email = branding?.contact_email ?? "sales@tristarltd.co.uk"

  return (
    <div className="bg-brand-dark text-on-dark-strong text-[12px] hidden md:block">
      <div className="max-w-[1280px] mx-auto px-10 py-[7px] flex justify-between items-center">
        <div className="flex items-center gap-5">
          {address && <span>📍 {address}</span>}
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

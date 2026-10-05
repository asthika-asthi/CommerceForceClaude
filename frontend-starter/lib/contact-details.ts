import { serverFetch } from "@/lib/api"
import type { BrandingConfig } from "@/lib/types"

export interface ContactDetails {
  email: string | null
  phone: string | null
  address: string | null
  hours: string | null
}

/** The store's contact details from admin Branding; any unset field is null. */
export async function getContactDetails(): Promise<ContactDetails> {
  let branding: BrandingConfig | null = null
  try {
    branding = await serverFetch<BrandingConfig>("/api/branding")
  } catch {
    // fall through with everything unset
  }
  const clean = (v?: string | null) => v?.trim() || null
  return {
    email: clean(branding?.contact_email),
    phone: clean(branding?.contact_phone),
    address: clean(branding?.contact_address),
    hours: clean(branding?.opening_hours),
  }
}

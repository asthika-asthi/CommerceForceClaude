import { serverFetch } from "@/lib/api"
import type { BrandingConfig } from "@/lib/types"

/** The store's contact email from admin Branding, or null when none is set. */
export async function getContactEmail(): Promise<string | null> {
  try {
    const branding = await serverFetch<BrandingConfig>("/api/branding")
    return branding?.contact_email?.trim() || null
  } catch {
    return null
  }
}

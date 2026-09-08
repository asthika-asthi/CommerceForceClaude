import { notFound } from "next/navigation"
import { serverFetch } from "@/lib/api"
import type { BrandingConfig } from "@/lib/types"
import { BespokeForm } from "./bespoke-form"

// The bespoke enquiry form is opt-in per client (Branding → "Bespoke enquiry
// form"). When it's off the route is unreachable, not just unlinked.
export default async function BespokePage() {
  const branding = await serverFetch<BrandingConfig>("/api/branding").catch(() => null)
  if (!branding?.show_bespoke_enquiry) notFound()

  return <BespokeForm />
}

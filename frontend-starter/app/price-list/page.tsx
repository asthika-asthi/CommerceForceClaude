import Link from "next/link"
import type { BrandingConfig } from "@/lib/types"
import { serverFetch } from "@/lib/api"

export const metadata = { title: "Price List — Tri Star UK Ltd" }

export default async function PriceListPage() {
  const branding = await serverFetch<BrandingConfig>("/api/branding")
  const catalogueUrl = branding?.catalogue_url

  return (
    <div className="max-w-[1280px] mx-auto px-10 py-16">
      <div className="max-w-xl mx-auto text-center">
        <div className="text-5xl mb-6">📋</div>
        <h1 className="text-[32px] font-bold text-brand-dark mb-4">
          Tri Star UK Ltd Price List
        </h1>
        <p className="text-[15px] text-muted leading-[1.7] mb-8">
          Download our full product price list covering tarpaulins, cotton dust sheets,
          rubble sacks, tonne bags, paint brushes and rollers. Updated regularly to
          reflect current stock and pricing.
        </p>

        {catalogueUrl ? (
          <a
            href={catalogueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-brand hover:bg-brand-hover text-on-brand font-bold text-[16px] px-8 py-4 rounded-xl transition-colors shadow-md"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Price List (PDF)
          </a>
        ) : (
          <p className="text-[14px] text-muted bg-card-bg border border-border rounded-xl px-6 py-4">
            The price list isn&apos;t available for download right now — please{" "}
            <Link href="/contact" className="text-brand hover:underline">contact us</Link> and we&apos;ll send it over.
          </p>
        )}

        <p className="text-[12px] text-text-placeholder mt-4">
          For trade pricing and volume discounts,{" "}
          <Link href="/trade" className="text-brand hover:underline">register for a trade account</Link>.
        </p>

        <div className="mt-12 bg-card-bg border border-border rounded-xl p-6 text-left">
          <h2 className="text-[15px] font-bold text-brand-dark mb-3">What&apos;s included</h2>
          <ul className="space-y-2 text-[14px] text-muted">
            {[
              "All-purpose and extra-strong tarpaulins (6×4ft to 30×20ft)",
              "Calico cotton dust sheets (various sizes, single and bale pricing)",
              "Heavy duty rubble sacks and FIBC tonne bags",
              "Polythene dust sheets and wheelie bin liners",
              "Paint brushes, roller frames and sleeves",
              "Trade account and volume discount tiers",
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5" className="flex-shrink-0 mt-0.5">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[13px] text-text-placeholder mt-6">
          Need a specific quote?{" "}
          <Link href="/contact" className="text-brand hover:underline">Contact us</Link> or{" "}
          <Link href="/bespoke" className="text-brand hover:underline">submit a bespoke enquiry</Link>.
        </p>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import type { Product, Review, ReviewSummary } from "@/lib/types"
import { ProductReviews } from "./reviews"
import { AdditionalInfoTable, buildAdditionalInfoRows } from "./additional-info-table"

interface Props {
  product: Product
  reviews: Review[]
  summary: ReviewSummary | null
}

type TabKey = "description" | "additional" | "reviews"

export function ProductTabs({ product, reviews, summary }: Props) {
  const infoRows = buildAdditionalInfoRows(product)
  const hasDescription = !!(product.description ?? "").trim()
  const reviewCount = summary?.total_reviews ?? reviews.length

  const tabs: { key: TabKey; label: string }[] = []
  if (hasDescription) tabs.push({ key: "description", label: "Description" })
  if (infoRows.length > 0) tabs.push({ key: "additional", label: "Additional information" })
  tabs.push({ key: "reviews", label: `Reviews (${reviewCount})` })

  const [active, setActive] = useState<TabKey>(tabs[0]?.key ?? "reviews")

  // Deep link + in-page "(N customer reviews)" link: #reviews opens the Reviews tab.
  useEffect(() => {
    const openIfReviewsHash = () => {
      if (window.location.hash === "#reviews") setActive("reviews")
    }
    openIfReviewsHash()
    window.addEventListener("hashchange", openIfReviewsHash)
    return () => window.removeEventListener("hashchange", openIfReviewsHash)
  }, [])

  if (tabs.length === 0) return null

  return (
    <div id="reviews" className="mt-14 scroll-mt-24">
      <div className="flex flex-wrap gap-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={[
              "-mb-px pb-3 text-sm font-semibold border-b-2 transition-colors",
              active === tab.key
                ? "border-brand-dark text-brand-dark"
                : "border-transparent text-muted hover:text-fg",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pt-6">
        {active === "description" && hasDescription && (
          <div className="prose prose-sm prose-slate max-w-none whitespace-pre-line">
            {product.description}
          </div>
        )}

        {active === "additional" && (
          <div className="overflow-x-auto">
            <AdditionalInfoTable rows={infoRows} />
          </div>
        )}

        {active === "reviews" && (
          <ProductReviews productId={product.id} initialReviews={reviews} summary={summary} />
        )}
      </div>
    </div>
  )
}

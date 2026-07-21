/**
 * One-for-one block wrappers around the original hardcoded landing components,
 * so the Tri Star homepage renders pixel-identically through the config
 * pipeline (see docs/superpowers/specs/2026-07-16-per-client-ui-pipeline-design.md,
 * "coarse wrap"). Finer decomposition can happen in the Phase 3 library session.
 */
import type { LandingRuntimeData } from '@/lib/types'
import { Hero } from '@/components/landing/hero'
import { PromoBanner } from '@/components/landing/promo-banner'
import { TrustStrip } from '@/components/landing/trust-strip'
import { CategoryGrid } from '@/components/landing/category-grid'
import { ProductGridSection } from '@/components/landing/product-grid-section'
import { SplitCards } from '@/components/landing/split-cards'
import { StatsBand } from '@/components/landing/stats-band'
import { HowToOrder } from '@/components/landing/how-to-order'
import { RangeTable } from '@/components/landing/range-table'
import { Testimonials } from '@/components/landing/testimonials'
import { Newsletter } from '@/components/landing/newsletter'

interface DataProps {
  data?: LandingRuntimeData
}

export function LandingPromoBannerBlock() {
  return <PromoBanner />
}

interface LandingHeroProps extends DataProps {
  title?: string
  titleHighlight?: string
  subtitle?: string
}

export function LandingHeroBlock({ data, title, titleHighlight, subtitle }: LandingHeroProps) {
  return (
    <Hero
      bestSellers={(data?.products ?? []).slice(0, 4)}
      showBestSellersCard={data?.showBestSellersCard ?? true}
      title={title}
      titleHighlight={titleHighlight}
      subtitle={subtitle}
    />
  )
}

export function LandingTrustStripBlock() {
  return <TrustStrip />
}

interface LandingCategoryGridProps extends DataProps {
  title?: string
  titleHighlight?: string
}

export function LandingCategoryGridBlock({ data, title, titleHighlight }: LandingCategoryGridProps) {
  return <CategoryGrid categories={data?.categories ?? []} title={title} titleHighlight={titleHighlight} />
}

interface LandingProductGridProps extends DataProps {
  title: string
  titleHighlight: string
  viewAllHref: string
  viewAllLabel: string
  sliceStart: number
  sliceEnd: number
  whiteBackground?: boolean
}

export function LandingProductGridBlock({
  data, title, titleHighlight, viewAllHref, viewAllLabel, sliceStart, sliceEnd, whiteBackground,
}: LandingProductGridProps) {
  const products = (data?.products ?? []).slice(sliceStart, sliceEnd)
  if (products.length === 0) return null
  const grid = (
    <ProductGridSection
      title={title}
      titleHighlight={titleHighlight}
      products={products}
      viewAllHref={viewAllHref}
      viewAllLabel={viewAllLabel}
      sectionOffset={sliceStart}
    />
  )
  return whiteBackground ? <div className="bg-card-bg">{grid}</div> : grid
}

export function LandingSplitCardsBlock() {
  return <SplitCards />
}

export function LandingStatsBandBlock() {
  return <StatsBand />
}

interface LandingHowToOrderProps {
  title?: string
  titleHighlight?: string
}

export function LandingHowToOrderBlock({ title, titleHighlight }: LandingHowToOrderProps) {
  return <HowToOrder title={title} titleHighlight={titleHighlight} />
}

interface LandingRangeTableProps extends DataProps {
  title?: string
  titleHighlight?: string
}

export function LandingRangeTableBlock({ data, title, titleHighlight }: LandingRangeTableProps) {
  return <RangeTable products={data?.products ?? []} categories={data?.categories ?? []} title={title} titleHighlight={titleHighlight} />
}

interface LandingTestimonialsProps {
  title?: string
  titleHighlight?: string
}

export function LandingTestimonialsBlock({ title, titleHighlight }: LandingTestimonialsProps) {
  return <Testimonials title={title} titleHighlight={titleHighlight} />
}

interface LandingNewsletterProps {
  title?: string
  subtitle?: string
}

export function LandingNewsletterBlock({ title, subtitle }: LandingNewsletterProps) {
  return <Newsletter title={title} subtitle={subtitle} />
}

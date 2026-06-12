import type { ComponentType } from 'react'
import { ScrollExpandHero } from '@/components/blocks/scroll-expand-hero'
import { FeaturedProductsGrid } from '@/components/blocks/featured-products-grid'
import { TestimonialsCarousel } from '@/components/blocks/testimonials-carousel'
import { NewsletterSection } from '@/components/blocks/newsletter-section'
import { LoyaltyWidgetSection } from '@/components/blocks/loyalty-widget-section'
import { CTABanner } from '@/components/blocks/cta-banner'

export interface BlockRegistryEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>
}

export const BLOCK_REGISTRY: Record<string, BlockRegistryEntry> = {
  'scroll-expand-hero': { component: ScrollExpandHero },
  'featured-products-grid': { component: FeaturedProductsGrid },
  'testimonials-carousel': { component: TestimonialsCarousel },
  'newsletter-section': { component: NewsletterSection },
  'loyalty-widget': { component: LoyaltyWidgetSection },
  'cta-banner': { component: CTABanner },
}

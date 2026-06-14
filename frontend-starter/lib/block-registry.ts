import type { ComponentType } from 'react'
import { ScrollExpandHero } from '@/components/blocks/scroll-expand-hero'
import { FeaturedProductsGrid } from '@/components/blocks/featured-products-grid'
import { TestimonialsCarousel } from '@/components/blocks/testimonials-carousel'
import { NewsletterSection } from '@/components/blocks/newsletter-section'
import { LoyaltyWidgetSection } from '@/components/blocks/loyalty-widget-section'
import { CTABanner } from '@/components/blocks/cta-banner'
import { ButtonGroup } from '@/components/blocks/button-group'
import { NavbarBlock } from '@/components/blocks/navbar-block'
import { FooterBlock } from '@/components/blocks/footer-block'
import { MenuBlock } from '@/components/blocks/menu-block'
import { ShinyButtonBlock } from '@/components/blocks/shiny-button'
import { GlowingShadow } from '@/components/blocks/glowing-shadow'
import { TubelightNavbarBlock } from '@/components/blocks/tubelight-navbar-block'
import { PromotionsBanner } from '@/components/blocks/promotions-banner'
import { AnnouncementBar } from '@/components/blocks/announcement-bar'
import { CouponSpotlight } from '@/components/blocks/coupon-spotlight'

export interface BlockRegistryEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>
  requiredPlugin?: string
}

export const BLOCK_REGISTRY: Record<string, BlockRegistryEntry> = {
  'scroll-expand-hero': { component: ScrollExpandHero },
  'featured-products-grid': { component: FeaturedProductsGrid },
  'testimonials-carousel': { component: TestimonialsCarousel },
  'newsletter-section': { component: NewsletterSection },
  'loyalty-widget': { component: LoyaltyWidgetSection },
  'cta-banner': { component: CTABanner },
  'button-group': { component: ButtonGroup },
  'navbar': { component: NavbarBlock },
  'footer': { component: FooterBlock },
  'menu': { component: MenuBlock },
  'shiny-button': { component: ShinyButtonBlock },
  'glowing-shadow': { component: GlowingShadow },
  'tubelight-navbar': { component: TubelightNavbarBlock },
  'promotions-banner': { component: PromotionsBanner },
  'announcement-bar': { component: AnnouncementBar },
  'coupon-spotlight': { component: CouponSpotlight },
}

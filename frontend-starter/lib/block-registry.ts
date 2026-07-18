import type { ComponentType } from 'react'
import { ScrollExpandHero } from '@/components/blocks/visual/scroll-expand-hero'
import { FeaturedProductsGrid } from '@/components/blocks/commerce/featured-products-grid'
import { TestimonialsCarousel } from '@/components/blocks/content/testimonials-carousel'
import { NewsletterSection } from '@/components/blocks/content/newsletter-section'
import { LoyaltyWidgetSection } from '@/components/blocks/commerce/loyalty-widget-section'
import { CTABanner } from '@/components/blocks/content/cta-banner'
import { ButtonGroup } from '@/components/blocks/content/button-group'
import { NavbarBlock } from '@/components/blocks/layout/navbar-block'
import { FooterBlock } from '@/components/blocks/layout/footer-block'
import { MenuBlock } from '@/components/blocks/layout/menu-block'
import { ShinyButtonBlock } from '@/components/blocks/visual/shiny-button'
import { GlowingShadow } from '@/components/blocks/visual/glowing-shadow'
import { TubelightNavbarBlock } from '@/components/blocks/layout/tubelight-navbar-block'
import { PromotionsBanner } from '@/components/blocks/visual/promotions-banner'
import { AnnouncementBar } from '@/components/blocks/layout/announcement-bar'
import { CouponSpotlight } from '@/components/blocks/commerce/coupon-spotlight'
import { TrustStrip } from '@/components/blocks/commerce/trust-strip'
import { CategoryGrid } from '@/components/blocks/commerce/category-grid'
import { DualCtaBanner } from '@/components/blocks/content/dual-cta-banner'
import { StatsBand } from '@/components/blocks/content/stats-band'
import { HowToOrder } from '@/components/blocks/content/how-to-order'
import { ProductRangeTable } from '@/components/blocks/commerce/product-range-table'
import { GlassmorphismHero } from '@/components/blocks/visual/glassmorphism-hero'
import { ParallaxBanner } from '@/components/blocks/visual/parallax-banner'
import { MarqueeTicker } from '@/components/blocks/visual/marquee-ticker'
import { GradientTextSection } from '@/components/blocks/visual/gradient-text-section'
import { ImageMosaic } from '@/components/blocks/visual/image-mosaic'
import { SplitImageText } from '@/components/blocks/content/split-image-text'
import { AnimatedCounter } from '@/components/blocks/content/animated-counter'
import { BentoGrid } from '@/components/blocks/content/bento-grid'
import { SpotlightHero } from '@/components/blocks/visual/spotlight-hero'
import { PricingTiers } from '@/components/blocks/commerce/pricing-tiers'
import { ShowcaseGallery } from '@/components/blocks/content/showcase-gallery'
import { VideoShowcase } from '@/components/blocks/content/video-showcase'
import { StreamSpotlight } from '@/components/blocks/content/stream-spotlight'
import { FaqAccordion } from '@/components/blocks/content/faq-accordion'
import { EnquiryForm } from '@/components/blocks/commerce/enquiry-form'
import {
  LandingPromoBannerBlock, LandingHeroBlock, LandingTrustStripBlock,
  LandingCategoryGridBlock, LandingProductGridBlock, LandingSplitCardsBlock,
  LandingStatsBandBlock, LandingHowToOrderBlock, LandingRangeTableBlock,
  LandingTestimonialsBlock, LandingNewsletterBlock,
} from '@/components/blocks/landing/legacy-landing-blocks'

export interface BlockRegistryEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>
  requiredPlugin?: string
  /** When true, LandingSectionRenderer passes the page's LandingRuntimeData as a `data` prop. */
  acceptsData?: boolean
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
  'trust-strip': { component: TrustStrip },
  'category-grid': { component: CategoryGrid },
  'dual-cta-banner': { component: DualCtaBanner },
  'stats-band': { component: StatsBand },
  'how-to-order': { component: HowToOrder },
  'product-range-table': { component: ProductRangeTable },
  'glassmorphism-hero': { component: GlassmorphismHero },
  'parallax-banner': { component: ParallaxBanner },
  'marquee-ticker': { component: MarqueeTicker },
  'gradient-text-section': { component: GradientTextSection },
  'image-mosaic': { component: ImageMosaic },
  'split-image-text': { component: SplitImageText },
  'animated-counter': { component: AnimatedCounter },
  'bento-grid': { component: BentoGrid },

  // Phase 2 generic blocks (added for the Surkut pilot; reusable by any client)
  'spotlight-hero': { component: SpotlightHero },
  'pricing-tiers': { component: PricingTiers },
  'showcase-gallery': { component: ShowcaseGallery },
  'video-showcase': { component: VideoShowcase },
  'stream-spotlight': { component: StreamSpotlight },
  'faq-accordion': { component: FaqAccordion },
  'enquiry-form': { component: EnquiryForm, requiredPlugin: 'contact' },

  // Coarse-wrapped originals of the hardcoded Tri Star landing sections
  'landing-promo-banner': { component: LandingPromoBannerBlock },
  'landing-hero': { component: LandingHeroBlock, acceptsData: true },
  'landing-trust-strip': { component: LandingTrustStripBlock },
  'landing-category-grid': { component: LandingCategoryGridBlock, acceptsData: true },
  'landing-product-grid': { component: LandingProductGridBlock, acceptsData: true },
  'landing-split-cards': { component: LandingSplitCardsBlock },
  'landing-stats-band': { component: LandingStatsBandBlock },
  'landing-how-to-order': { component: LandingHowToOrderBlock },
  'landing-range-table': { component: LandingRangeTableBlock, acceptsData: true },
  'landing-testimonials': { component: LandingTestimonialsBlock },
  'landing-newsletter': { component: LandingNewsletterBlock },
}

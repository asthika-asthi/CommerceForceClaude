import type { Metadata } from 'next'
import { ScrollExpandHero } from '@/components/blocks/visual/scroll-expand-hero'
import { ShowcaseGallery } from '@/components/blocks/content/showcase-gallery'
import { BentoGrid } from '@/components/blocks/content/bento-grid'
import { SplitImageText } from '@/components/blocks/content/split-image-text'
import { NavbarBlock } from '@/components/blocks/layout/navbar-block'
import { FooterBlock } from '@/components/blocks/layout/footer-block'
import { MenuBlock } from '@/components/blocks/layout/menu-block'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// Dev/QA-only route: renders every block touched by the Phase 3 component-
// library session in isolation, with fixture data. None of these props are
// wired into any live client config yet, so this is what Playwright exercises.
// Not linked from any nav; excluded from robots.ts and the sitemap.
export default function BlockPreviewPage() {
  return (
    <div>
      <div data-testid="preview-navbar">
        <NavbarBlock
          logoText="Preview Store"
          links={[{ label: 'Shop', url: '/products' }, { label: 'About', url: '/faq' }]}
          ctaLabel="Register"
          ctaUrl="/register"
        />
      </div>

      <div data-testid="preview-menu">
        <MenuBlock
          title="Quick Links"
          layout="horizontal"
          items={[{ label: 'Products', url: '/products' }, { label: 'Reviews', url: '/faq' }]}
        />
      </div>

      <div data-testid="preview-scroll-expand-hero">
        <ScrollExpandHero
          mediaType="image"
          mediaSrc="/images/hero.jpg"
          title="Preview Hero"
          subtitle="Default single-stage behaviour"
        />
      </div>

      <div data-testid="preview-bento-grid">
        <BentoGrid
          title="Preview Bento"
          cards={[
            { title: 'Segment One', body: 'Description for segment one.', size: 'large' },
            { title: 'Segment Two', body: 'Description for segment two.', size: 'small' },
            { title: 'Segment Three', body: 'Description for segment three.', size: 'small' },
          ]}
        />
      </div>

      <div data-testid="preview-split-image-text">
        <SplitImageText
          image="/images/hero.jpg"
          imageAlt="Preview image"
          title="Preview Split"
          body="Body copy for the split-image-text preview section."
        />
      </div>

      <div data-testid="preview-showcase-gallery">
        <ShowcaseGallery
          title="Preview Gallery"
          items={[
            { image: '/images/hero.jpg', imageAlt: 'Item one', title: 'Item One', tag: 'Tag One' },
            { image: '/images/hero.jpg', imageAlt: 'Item two', title: 'Item Two', tag: 'Tag Two' },
          ]}
        />
      </div>

      <div data-testid="preview-footer">
        <FooterBlock
          logoText="Preview Store"
          tagline="Dev preview"
          columns={[{ heading: 'Shop', links: [{ label: 'All Products', url: '/products' }] }]}
          copyrightText="© 2026 Preview"
        />
      </div>
    </div>
  )
}

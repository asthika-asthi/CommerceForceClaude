/**
 * Landing-page pipeline tests.
 *
 * Prerequisites: backend on :8000, storefront on :3000, seeded Tri Star data.
 *
 * Spec A (characterization): freezes the homepage's section content and ORDER
 * as it exists with the hardcoded components. It must pass before AND after
 * the config-pipeline rewire — any failure after the rewire means the page
 * is not identical.
 *
 * Spec B (pipeline proof): asserts the page is rendered by the config
 * pipeline (data-landing-source attribute added in the rewire). Expected to
 * FAIL until app/page.tsx is rewired.
 */
import { test, expect } from '@playwright/test'

// One stable text anchor per landing section, in on-page order.
const SECTION_ANCHORS = [
  'same-day despatch',                    // PromoBanner
  'Quality protective',                   // Hero h1
  'Free UK Delivery',                     // TrustStrip
  'Shop by',                              // CategoryGrid h2
  'Featured',                             // ProductGridSection 1 h2
  'More from',                            // ProductGridSection 2 h2
  'Open a trade account',                 // SplitCards
  'Years supplying UK trade & retail',    // StatsBand
  'How to',                               // HowToOrder h2
  'Product range',                        // RangeTable h2 ("Product range quick reference")
  'What our',                             // Testimonials h2 ("What our customers say")
  'Stay ahead — trade offers',            // Newsletter h2
]

test.describe('Homepage sections (characterization)', () => {
  test('all sections present, in order', async ({ page }) => {
    await page.goto('/')
    // Wait for hero (server-rendered) to be visible before reading text
    await expect(page.locator('h1').first()).toContainText('Quality protective', { timeout: 15_000 })
    const body = await page.locator('body').innerText()
    let cursor = -1
    for (const anchor of SECTION_ANCHORS) {
      const idx = body.indexOf(anchor)
      expect(idx, `section anchor not found: "${anchor}"`).toBeGreaterThan(-1)
      expect(idx, `section out of order: "${anchor}"`).toBeGreaterThan(cursor)
      cursor = idx
    }
  })

  test('product grids show real products with links to product pages', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('a[href^="/products/"]', { timeout: 15_000 })
    const productLinks = page.locator('a[href^="/products/"]')
    expect(await productLinks.count()).toBeGreaterThan(0)
  })
})

test.describe('Config pipeline', () => {
  // Intentionally RED until Task 6 rewires app/page.tsx — do not weaken this assertion
  test('homepage renders via the config pipeline', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-landing-source="config-pipeline"]')).toHaveCount(1)
  })
})

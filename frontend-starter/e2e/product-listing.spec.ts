/**
 * Storefront product listing E2E tests.
 *
 * Prerequisites:
 *   - Backend running on :8000
 *   - Storefront running on :3000 (npm run dev)
 *   - At least one active product with an image in the database
 *
 * These tests specifically guard against the recurring bug where products have
 * images in the database but the listing page shows placeholder icons instead
 * (caused by API schema mismatch: list endpoint returns primary_image:string
 * while the frontend only reads the images[] array).
 *
 * Note: The products page has a loading.tsx skeleton that shows .aspect-square
 * divs without images. Tests must wait for actual products to load (not skeleton)
 * before asserting on images or links. We use waitForSelector with :not(.animate-pulse)
 * to detect when the real product grid has replaced the skeleton.
 */

import { test, expect } from '@playwright/test'

async function waitForProductsLoaded(page: import('@playwright/test').Page) {
  // Wait for a real product card link (not the loading skeleton which has no <a> tags)
  // The Link in ProductCard renders as <a href="/products/slug">
  await page.waitForSelector('a[href^="/products/"]', { timeout: 15_000 })
}

test.describe('Product listing', () => {
  test('listing page loads and shows a product grid', async ({ page }) => {
    await page.goto('/products')
    await waitForProductsLoaded(page)
    // At least one product card link should be present
    const productLinks = page.locator('a[href^="/products/"]')
    await expect(productLinks.first()).toBeVisible({ timeout: 10_000 })
  })

  test('products have images — not just placeholder icons', async ({ page }) => {
    await page.goto('/products')
    await waitForProductsLoaded(page)
    // At least one .aspect-square container must contain an <img> tag.
    // Failure here means ProductCard is showing the ShoppingCart placeholder instead
    // of the actual product image — the recurring primary_image/images mismatch bug.
    const productImages = page.locator('.aspect-square img')
    await expect(productImages.first()).toBeVisible({ timeout: 10_000 })
    const count = await productImages.count()
    expect(count).toBeGreaterThan(0)
  })

  test('search form filters the product list', async ({ page }) => {
    await page.goto('/products')
    await waitForProductsLoaded(page)
    const searchInput = page.locator('input[name="q"]')
    await searchInput.fill('tarp')
    await page.keyboard.press('Enter')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/q=tarp/)
    // Page should render something (not an error / blank screen)
    await expect(page.locator('body')).toBeVisible()
  })

  test('category sidebar link filters products', async ({ page }) => {
    await page.goto('/products')
    await waitForProductsLoaded(page)
    // Click the first non-"All Products" category link in the sidebar
    const categoryLinks = page.locator('aside li:not(:first-child) a')
    const count = await categoryLinks.count()
    if (count === 0) {
      test.skip(true, 'No categories in database — seed data required')
      return
    }
    await categoryLinks.first().click()
    // Wait for the URL to update (Next.js <a href> triggers full navigation)
    await expect(page).toHaveURL(/category=/, { timeout: 10_000 })
  })

  test('clicking a product opens the detail page with an image', async ({ page }) => {
    await page.goto('/products')
    await waitForProductsLoaded(page)
    // Product cards use <Link href="/products/slug"> which renders as <a>
    // The <a> wraps the .aspect-square div (not nested inside it)
    const firstProductLink = page.locator('a[href^="/products/"]').first()
    const href = await firstProductLink.getAttribute('href')
    if (!href) {
      test.skip(true, 'No products in database — seed data required')
      return
    }
    await page.goto(href)
    await page.waitForLoadState('networkidle')
    // Detail page must have an <h1> (product name) and at least one <img>
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('img').first()).toBeVisible({ timeout: 10_000 })
  })
})

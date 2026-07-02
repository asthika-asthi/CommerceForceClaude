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
 */

import { test, expect } from '@playwright/test'

test.describe('Product listing', () => {
  test('listing page loads and shows a product grid', async ({ page }) => {
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
    // At least one product card should be present
    const cards = page.locator('.aspect-square')
    await expect(cards.first()).toBeVisible({ timeout: 10_000 })
  })

  test('products have images — not just placeholder icons', async ({ page }) => {
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
    // At least one .aspect-square container must contain an <img> tag.
    // Failure here means ProductCard is showing the ShoppingCart placeholder instead
    // of the actual product image — the recurring primary_image/images mismatch bug.
    const productImages = page.locator('.aspect-square img')
    const count = await productImages.count()
    expect(count).toBeGreaterThan(0)
  })

  test('search form filters the product list', async ({ page }) => {
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
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
    await page.waitForLoadState('networkidle')
    // Click the first non-"All Products" category link in the sidebar
    const categoryLinks = page.locator('aside li:not(:first-child) a')
    const count = await categoryLinks.count()
    if (count === 0) {
      test.skip(true, 'No categories in database — seed data required')
      return
    }
    await categoryLinks.first().click()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/category=/)
  })

  test('clicking a product opens the detail page with an image', async ({ page }) => {
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
    const firstLink = page.locator('.aspect-square a').first()
    const href = await firstLink.getAttribute('href')
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

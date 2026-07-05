/**
 * Currency E2E — verifies prices render via formatMoney with the store currency symbol.
 *
 * Prerequisites: backend on :8000, storefront on :3000, at least one product.
 * The default currency is GBP (£); a different NEXT_PUBLIC_CURRENCY_CODE would change the
 * symbol at build time.
 */
import { test, expect } from '@playwright/test'

test.describe('Currency', () => {
  test('product listing renders prices with the store currency symbol', async ({ page }) => {
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
    // A formatted price like "£12.00" (symbol + amount to 2dp).
    await expect(page.getByText(/£\d[\d,]*\.\d{2}/).first()).toBeVisible({ timeout: 10_000 })
  })

  test('cart shows a subtotal with the currency symbol', async ({ page }) => {
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('html[data-hydrated]', { timeout: 10_000 })
    const addBtn = page.locator('button[title="Add to cart"]').first()
    await addBtn.click()
    await expect(page.locator('button[title="Added!"]').first()).toBeVisible({ timeout: 5_000 })

    await page.goto('/cart')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/£\d[\d,]*\.\d{2}/).first()).toBeVisible({ timeout: 5_000 })
  })
})

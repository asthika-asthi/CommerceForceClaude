/**
 * Cart E2E tests.
 *
 * Prerequisites:
 *   - Backend running on :8000
 *   - Storefront running on :3000 (npm run dev)
 *   - At least one in-stock product in the database
 */

import { test, expect } from '@playwright/test'

test.describe('Cart', () => {
  test('cart page loads without crashing', async ({ page }) => {
    await page.goto('/cart')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toBeVisible()
    // Should not redirect to an error page
    await expect(page).not.toHaveURL('/error')
  })

  test('in-stock products show an Add to Cart button', async ({ page }) => {
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
    const addBtn = page.locator('button[title="Add to cart"]').first()
    await expect(addBtn).toBeVisible({ timeout: 10_000 })
  })

  test('clicking Add to Cart shows the Added confirmation state', async ({ page }) => {
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
    // Wait for React hydration — AppInit sets data-hydrated once useEffect fires,
    // ensuring event handlers are attached before we click
    await page.waitForSelector('html[data-hydrated]', { timeout: 10_000 })
    const addBtn = page.locator('button[title="Add to cart"]').first()
    await expect(addBtn).toBeVisible({ timeout: 5_000 })
    await addBtn.click()
    // Button title changes to "Added!" briefly after a successful add
    await expect(page.locator('button[title="Added!"]')).toBeVisible({ timeout: 5_000 })
  })

  test('checkout page is reachable', async ({ page }) => {
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL('/error')
  })
})

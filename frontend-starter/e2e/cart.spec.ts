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

  test('adding a product from the listing actually lands it in the cart (F8 guard)', async ({ page }) => {
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('html[data-hydrated]', { timeout: 10_000 })

    const addBtn = page.locator('button[title="Add to cart"]').first()
    await expect(addBtn).toBeVisible({ timeout: 10_000 })
    await addBtn.click()

    // "Added!" only appears when the add succeeds (ok === true). The F8 bug flashed
    // this even though nothing was added, because the listing passed a product id
    // where a variant id was expected.
    await expect(page.locator('button[title="Added!"]').first()).toBeVisible({ timeout: 5_000 })

    // The real guard: the item must actually be in the cart, not just a label flip.
    await page.goto('/cart')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Your cart is empty')).toHaveCount(0)
    // Cart line items show a "£X.XX each" unit price — proof a line item rendered.
    await expect(page.getByText(/each/).first()).toBeVisible({ timeout: 5_000 })
  })

  test('checkout page is reachable', async ({ page }) => {
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL('/error')
  })
})

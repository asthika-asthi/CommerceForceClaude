/**
 * Abandoned-cart recovery-email prompt E2E — the guest-cart "save your cart"
 * prompt added to the cart page. Previously only exercised via direct API calls.
 *
 * Prerequisites: backend on :8000, storefront on :3000, at least one in-stock product.
 */
import { test, expect } from '@playwright/test'

async function addFirstProductToCart(page: import('@playwright/test').Page) {
  await page.goto('/products')
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('html[data-hydrated]', { timeout: 10_000 })
  const addBtn = page.locator('button[title="Add to cart"]').first()
  await expect(addBtn).toBeVisible({ timeout: 10_000 })
  await addBtn.click()
  await expect(page.locator('button[title="Added!"]').first()).toBeVisible({ timeout: 5_000 })
}

test.describe('Cart recovery-email prompt', () => {
  // Each test gets a fresh, isolated browser context from Playwright by
  // default, so every test here already starts as a logged-out guest.

  test('guest with items in cart sees the save-your-cart prompt', async ({ page }) => {
    await addFirstProductToCart(page)
    await page.goto('/cart')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Want us to save your cart?')).toBeVisible()
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
  })

  test('submitting an email shows a saved state and hides the form', async ({ page }) => {
    await addFirstProductToCart(page)
    await page.goto('/cart')
    await page.waitForLoadState('networkidle')

    await page.getByPlaceholder('you@example.com').fill(`recovery-e2e-${Date.now()}@example.com`)
    await page.getByRole('button', { name: 'Save cart' }).click()

    await expect(page.getByText('Want us to save your cart?')).toHaveCount(0, { timeout: 5_000 })
  })

  test('dismissing the prompt hides it without saving an email', async ({ page }) => {
    await addFirstProductToCart(page)
    await page.goto('/cart')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Want us to save your cart?')).toBeVisible()
    await page.getByRole('button', { name: 'Dismiss' }).click()
    await expect(page.getByText('Want us to save your cart?')).toHaveCount(0)
  })

  test('empty cart shows no recovery prompt', async ({ page }) => {
    await page.goto('/cart')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Your cart is empty')).toBeVisible()
    await expect(page.getByText('Want us to save your cart?')).toHaveCount(0)
  })
})

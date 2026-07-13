/**
 * Regression coverage for the "phantom variant checkout" bug: a product with real
 * variants must never be added to cart from the listing page's quick-add button
 * without an explicit variant choice. Quick-add should route multi-variant products
 * to the PDP instead, while simple (no-variant) products keep one-click add.
 *
 * Prerequisites:
 *   - Backend running on :8000 (admin@commerceforce.dev / Admin1234!)
 *   - Storefront running on :3000 (npm run dev)
 *   - Creates and tears down its own two fixture products via the admin API.
 */

import { test, expect, request } from '@playwright/test'

const ADMIN_EMAIL = 'admin@commerceforce.dev'
const ADMIN_PASSWORD = 'Admin1234!'
const RUN_ID = Date.now()
const MULTI_NAME = `E2E Multi Variant ${RUN_ID}`
const SIMPLE_NAME = `E2E Simple Product ${RUN_ID}`

async function getAdminToken(): Promise<string> {
  const ctx = await request.newContext()
  const res = await ctx.post('http://localhost:8000/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  const { access_token } = await res.json()
  await ctx.dispose()
  return access_token
}

async function createMultiVariantProduct(token: string): Promise<string> {
  const ctx = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } })
  const productRes = await ctx.post('http://localhost:8000/api/products', {
    data: { name: MULTI_NAME, price: '25.00', stock_quantity: 10 },
  })
  const product = await productRes.json()

  const optRes = await ctx.post(`http://localhost:8000/api/products/${product.id}/options`, {
    data: { name: 'Size', sort_order: 0 },
  })
  const opt = await optRes.json()
  for (const label of ['S', 'M', 'L']) {
    await ctx.post(`http://localhost:8000/api/products/${product.id}/options/${opt.id}/values`, {
      data: { label },
    })
  }
  await ctx.post(`http://localhost:8000/api/products/${product.id}/variants/generate`)
  await ctx.dispose()
  return product.id
}

async function createSimpleProduct(token: string): Promise<string> {
  const ctx = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } })
  const productRes = await ctx.post('http://localhost:8000/api/products', {
    data: { name: SIMPLE_NAME, price: '12.00', stock_quantity: 10 },
  })
  const product = await productRes.json()
  await ctx.dispose()
  return product.id
}

async function deleteProduct(token: string, id: string) {
  const ctx = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } })
  await ctx.delete(`http://localhost:8000/api/products/${id}`)
  await ctx.dispose()
}

test.describe('Product-card quick-add is variant-aware', () => {
  let token: string
  let multiId: string
  let simpleId: string

  test.beforeAll(async () => {
    token = await getAdminToken()
    multiId = await createMultiVariantProduct(token)
    simpleId = await createSimpleProduct(token)
  })

  test.afterAll(async () => {
    await deleteProduct(token, multiId)
    await deleteProduct(token, simpleId)
  })

  test('multi-variant product: quick-add navigates to PDP instead of adding to cart', async ({ page }) => {
    await page.goto(`/products?q=${encodeURIComponent(MULTI_NAME)}`)
    await page.getByRole('button', { name: 'Essential only' }).click({ timeout: 3000 }).catch(() => {})
    const card = page.getByRole('heading', { name: MULTI_NAME, exact: true })
      .locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]')
    const quickAdd = card.getByTitle('Select options')
    await expect(quickAdd).toBeVisible()

    await quickAdd.click()
    await page.waitForURL(/\/products\/[^/?]+$/)
    // Never shows an "Added!" confirmation — no cart mutation happened from the listing.
    await expect(page.getByTitle('Added!')).toHaveCount(0)
  })

  test('simple product: quick-add still adds directly to cart on the listing page', async ({ page }) => {
    await page.goto(`/products?q=${encodeURIComponent(SIMPLE_NAME)}`)
    await page.getByRole('button', { name: 'Essential only' }).click({ timeout: 3000 }).catch(() => {})
    const card = page.getByRole('heading', { name: SIMPLE_NAME, exact: true })
      .locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]')
    const quickAdd = card.getByTitle('Add to cart')
    await expect(quickAdd).toBeVisible()

    await quickAdd.click()
    await expect(card.getByTitle('Added!')).toBeVisible()
    // Stayed on the listing page — no navigation for a simple, unambiguous add.
    expect(page.url()).toContain('/products?q=')
  })
})

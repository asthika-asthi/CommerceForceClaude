/**
 * Product cards on the listing page show "£min – £max" when a product's variants differ
 * in price (same as the product page), and a single price otherwise.
 *
 * Prerequisites:
 *   - Backend running on :8000 (admin@commerceforce.dev / Admin1234!)
 *   - Storefront running on :3000 (npm run dev)
 *   - Creates and tears down its own fixture products via the admin API.
 */

import { test, expect, request } from '@playwright/test'

const API = 'http://localhost:8000'
const ADMIN_EMAIL = 'admin@commerceforce.dev'
const ADMIN_PASSWORD = 'Admin1234!'
const RUN_ID = Date.now()
const RANGE_NAME = `E2E Range Product ${RUN_ID}`
const SIMPLE_NAME = `E2E Single Price ${RUN_ID}`

async function getAdminToken(): Promise<string> {
  const ctx = await request.newContext()
  const res = await ctx.post(`${API}/api/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  const { access_token } = await res.json()
  await ctx.dispose()
  return access_token
}

async function createRangeProduct(token: string): Promise<string> {
  const ctx = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } })
  const product = await (await ctx.post(`${API}/api/products`, {
    data: { name: RANGE_NAME, price: '20.00', stock_quantity: 10 },
  })).json()
  const opt = await (await ctx.post(`${API}/api/products/${product.id}/options`, {
    data: { name: 'Size', sort_order: 0 },
  })).json()
  for (const label of ['S', 'XL']) {
    await ctx.post(`${API}/api/products/${product.id}/options/${opt.id}/values`, { data: { label } })
  }
  await ctx.post(`${API}/api/products/${product.id}/variants/generate`)
  const variants = await (await ctx.get(`${API}/api/products/${product.id}/variants`)).json()
  const xl = variants.find((v: { label: string }) => v.label.includes('XL'))
  await ctx.patch(`${API}/api/products/${product.id}/variants/${xl.id}`, {
    data: { price_adjustment: '5.00' },
  })
  await ctx.dispose()
  return product.id
}

async function createSimpleProduct(token: string): Promise<string> {
  const ctx = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } })
  const product = await (await ctx.post(`${API}/api/products`, {
    data: { name: SIMPLE_NAME, price: '12.00', stock_quantity: 10 },
  })).json()
  await ctx.dispose()
  return product.id
}

async function deleteProduct(token: string, id: string) {
  const ctx = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } })
  await ctx.delete(`${API}/api/products/${id}`)
  await ctx.dispose()
}

test.describe('Product card price range', () => {
  let token: string
  let rangeId: string
  let simpleId: string

  test.beforeAll(async () => {
    token = await getAdminToken()
    rangeId = await createRangeProduct(token)
    simpleId = await createSimpleProduct(token)
  })

  test.afterAll(async () => {
    await deleteProduct(token, rangeId)
    await deleteProduct(token, simpleId)
  })

  function cardFor(page: import('@playwright/test').Page, name: string) {
    return page.getByRole('heading', { name, exact: true })
      .locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]')
  }

  test('variant product with differing prices shows a min – max range', async ({ page }) => {
    await page.goto(`/products?q=${encodeURIComponent(RANGE_NAME)}`)
    await page.getByRole('button', { name: 'Essential only' }).click({ timeout: 3000 }).catch(() => {})
    const card = cardFor(page, RANGE_NAME)
    await expect(card).toBeVisible()
    await expect(card).toContainText(/20\.00\s*–\s*.*25\.00/)
  })

  test('simple product shows a single price', async ({ page }) => {
    await page.goto(`/products?q=${encodeURIComponent(SIMPLE_NAME)}`)
    await page.getByRole('button', { name: 'Essential only' }).click({ timeout: 3000 }).catch(() => {})
    const card = cardFor(page, SIMPLE_NAME)
    await expect(card).toContainText('12.00')
    await expect(card).not.toContainText('–')
  })
})

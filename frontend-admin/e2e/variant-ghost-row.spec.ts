/**
 * Regression coverage for the "phantom variant checkout" bug's admin-side trigger:
 * the auto-created default/no-option variant must never render as an editable row
 * in the per-product variant table once real option-linked variants exist — that
 * blank, unlabeled row is exactly what let an admin type a price adjustment meant
 * for a real variant onto a system row instead.
 *
 * Prerequisites: backend on :8000 (admin@commerceforce.dev / Admin1234!),
 * admin panel on :3001.
 */
import { test, expect, request, type Page } from '@playwright/test'

const API = 'http://localhost:8000'
const ADMIN_EMAIL = 'admin@commerceforce.dev'
const ADMIN_PASSWORD = 'Admin1234!'
const PRODUCT_NAME = `E2E Ghost Row ${Date.now()}`

async function getAdminToken(request_: import('@playwright/test').APIRequestContext): Promise<string> {
  const res = await request_.post(`${API}/api/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
  expect(res.ok()).toBeTruthy()
  const { access_token } = await res.json()
  return access_token
}

async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 })
}

test.describe('Admin — variant table hides the ghost default variant', () => {
  let productId: string
  let apiToken: string

  test.beforeAll(async ({ request: request_ }) => {
    apiToken = await getAdminToken(request_)
    const authed = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${apiToken}` } })

    // Creating a product auto-creates its no-option default variant. Adding real
    // options and generating combinations deactivates that default row but never
    // deletes it — reproducing the exact "ghost row" scenario from the bug report.
    const productRes = await authed.post(`${API}/api/products`, {
      data: { name: PRODUCT_NAME, price: '25.00', stock_quantity: 10 },
    })
    expect(productRes.ok(), await productRes.text()).toBeTruthy()
    const product = await productRes.json()
    productId = product.id

    const optRes = await authed.post(`${API}/api/products/${productId}/options`, {
      data: { name: 'Size', sort_order: 0 },
    })
    expect(optRes.ok(), await optRes.text()).toBeTruthy()
    const opt = await optRes.json()
    for (const label of ['S', 'M']) {
      const valRes = await authed.post(`${API}/api/products/${productId}/options/${opt.id}/values`, { data: { label } })
      expect(valRes.ok(), await valRes.text()).toBeTruthy()
    }
    const genRes = await authed.post(`${API}/api/products/${productId}/variants/generate`)
    expect(genRes.ok(), await genRes.text()).toBeTruthy()
    await authed.dispose()
  })

  test.afterAll(async () => {
    const authed = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${apiToken}` } })
    await authed.delete(`${API}/api/products/${productId}`)
    await authed.dispose()
  })

  test('variant table shows only the real S/M rows, no blank ghost row', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto(`/products/${productId}`)
    await page.getByRole('button', { name: 'Variants' }).click()
    await expect(page.locator('table')).toBeVisible()

    const rows = page.locator('tbody tr')
    await expect(rows).toHaveCount(2)

    const labels = await page.locator('tbody tr td:first-child').allInnerTexts()
    expect(labels.sort()).toEqual(['Size: M', 'Size: S'])
    expect(labels.some((l) => l.trim() === '')).toBe(false)
  })
})

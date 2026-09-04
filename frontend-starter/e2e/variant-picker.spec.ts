/**
 * Variant picker E2E tests.
 *
 * The picker renders one <select> per option type. A value that has no active,
 * in-stock variant given the other current selection is shown with a
 * " — unavailable" suffix (but still selectable, matching the old pill UI which
 * kept unavailable values clickable).
 *
 * Prerequisites:
 *   - Backend running on :8000 (admin@commerceforce.dev / Admin1234!)
 *   - Storefront running on :3000 (npm run dev)
 *   - A product named "Test Shirt 1782487297" (slug: test-shirt-1782487297)
 *     with option types Size (S/M/L) and Colour (Red/Blue) must exist.
 *     The test temporarily deactivates one variant and restores it on teardown.
 */

import { test, expect, request } from '@playwright/test'

const PRODUCT_ID = '28ffa180-5cb9-49f3-8a7b-ae352d4669b7'
const VARIANT_L_BLUE_ID = '61a29899-69c5-4607-9dda-577221810a73'
const PRODUCT_URL = '/products/test-shirt-1782487297'
const ADMIN_EMAIL = 'admin@commerceforce.dev'
const ADMIN_PASSWORD = 'Admin1234!'

async function getAdminToken(): Promise<string> {
  const ctx = await request.newContext()
  const res = await ctx.post('http://localhost:8000/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  const { access_token } = await res.json()
  await ctx.dispose()
  return access_token
}

async function setVariantActive(token: string, active: boolean) {
  const ctx = await request.newContext()
  await ctx.patch(
    `http://localhost:8000/api/products/${PRODUCT_ID}/variants/${VARIANT_L_BLUE_ID}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { is_active: active },
    }
  )
  await ctx.dispose()
}

/** Visible option labels for the <select> whose associated <label> matches `name`. */
const optionLabels = (page: import('@playwright/test').Page, name: RegExp) =>
  page.getByLabel(name).locator('option').allTextContents()

test.describe('Variant picker — per-combination availability (dropdown UI)', () => {
  let token: string

  test.beforeAll(async () => {
    token = await getAdminToken()
    // Deactivate L+Blue so there is an inactive combination to narrow against
    await setVariantActive(token, false)
  })

  test.afterAll(async () => {
    // Always restore — don't leave test data dirty
    await setVariantActive(token, true)
  })

  test('initial state: a select per option type, nothing marked unavailable', async ({ page }) => {
    await page.goto(PRODUCT_URL)
    const size = page.getByLabel(/^Size$/)
    const colour = page.getByLabel(/^Colour$/)
    await expect(size).toBeVisible()
    await expect(colour).toBeVisible()

    const colourOpts = await optionLabels(page, /^Colour$/)
    expect(colourOpts.some(t => /unavailable/i.test(t))).toBe(false)
  })

  test('selecting L marks Blue unavailable (L+Blue inactive), keeps Red available', async ({ page }) => {
    await page.goto(PRODUCT_URL)
    await page.getByLabel(/^Size$/).selectOption('L')
    await page.waitForTimeout(200)

    const colourOpts = await optionLabels(page, /^Colour$/)
    const blue = colourOpts.find(t => t.startsWith('Blue'))
    const red = colourOpts.find(t => t.startsWith('Red'))
    expect(blue).toMatch(/unavailable/i)
    expect(red).not.toMatch(/unavailable/i)
  })

  test('switching from L to M makes Blue available again', async ({ page }) => {
    await page.goto(PRODUCT_URL)
    await page.getByLabel(/^Size$/).selectOption('L')
    await page.waitForTimeout(150)
    await page.getByLabel(/^Size$/).selectOption('M')
    await page.waitForTimeout(200)

    const colourOpts = await optionLabels(page, /^Colour$/)
    expect(colourOpts.find(t => t.startsWith('Blue'))).not.toMatch(/unavailable/i)
    expect(colourOpts.find(t => t.startsWith('Red'))).not.toMatch(/unavailable/i)
  })

  test('Clear resets the selections', async ({ page }) => {
    await page.goto(PRODUCT_URL)
    await page.getByLabel(/^Size$/).selectOption('L')
    await page.getByLabel(/^Colour$/).selectOption('Red')
    await page.getByRole('button', { name: 'Clear' }).click()

    await expect(page.getByLabel(/^Size$/)).toHaveValue('')
    await expect(page.getByLabel(/^Colour$/)).toHaveValue('')
  })
})

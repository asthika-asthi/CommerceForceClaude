/**
 * Variant picker E2E tests.
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

/** Return the pill state for all [aria-pressed] buttons on the page. */
const pillState = (page: import('@playwright/test').Page) =>
  page.$$eval('[aria-pressed]', btns =>
    btns.map(b => ({
      text: b.textContent?.trim() ?? '',
      pressed: b.getAttribute('aria-pressed') === 'true',
      oos: b.className.includes('line-through'),
    }))
  )

test.describe('Variant picker — per-combination OOS narrowing', () => {
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

  test('initial state: all pills available with no selection', async ({ page }) => {
    await page.goto(PRODUCT_URL)
    await page.waitForSelector('[aria-pressed]')
    const pills = await pillState(page)
    expect(pills.length).toBe(5)
    expect(pills.every(p => !p.oos)).toBe(true)
  })

  test('selecting L greys out Blue (L+Blue inactive), keeps Red available', async ({ page }) => {
    await page.goto(PRODUCT_URL)
    await page.waitForSelector('[aria-pressed]')

    await page.locator('[aria-pressed]', { hasText: /^L$/ }).click()
    await page.waitForTimeout(200)

    const pills = await pillState(page)
    const blue = pills.find(p => p.text === 'Blue')
    const red = pills.find(p => p.text === 'Red')
    const l = pills.find(p => p.text === 'L')

    expect(l?.pressed).toBe(true)
    expect(blue?.oos).toBe(true)   // L+Blue is inactive
    expect(red?.oos).toBe(false)   // L+Red is active
  })

  test('switching from L to M makes Blue available again', async ({ page }) => {
    await page.goto(PRODUCT_URL)
    await page.waitForSelector('[aria-pressed]')

    await page.locator('[aria-pressed]', { hasText: /^L$/ }).click()
    await page.waitForTimeout(200)
    await page.locator('[aria-pressed]', { hasText: /^M$/ }).click()
    await page.waitForTimeout(200)

    const pills = await pillState(page)
    const blue = pills.find(p => p.text === 'Blue')
    const red = pills.find(p => p.text === 'Red')

    expect(blue?.oos).toBe(false)  // M+Blue is active
    expect(red?.oos).toBe(false)   // M+Red is active
  })

  test('selecting S keeps all colours available', async ({ page }) => {
    await page.goto(PRODUCT_URL)
    await page.waitForSelector('[aria-pressed]')

    await page.locator('[aria-pressed]', { hasText: /^S$/ }).click()
    await page.waitForTimeout(200)

    const pills = await pillState(page)
    const colours = pills.filter(p => ['Red', 'Blue'].includes(p.text))
    expect(colours.every(p => !p.oos)).toBe(true)
  })
})

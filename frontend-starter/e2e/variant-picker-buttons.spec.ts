/**
 * Variant picker E2E tests — "Buttons" display mode.
 *
 * Branding → Product page → "Variant options" = Buttons renders one <button> per
 * option value instead of a <select> per option type. Selection, availability
 * marking and the Clear link behave exactly as in the drop-down.
 *
 * Prerequisites: same as variant-picker.spec.ts, plus the superadmin account
 * (superadmin@commerceforce.dev / SuperAdmin1234!). The test switches the store to
 * Buttons and always restores the drop-down on teardown.
 *
 * The storefront caches branding for up to 60s (ISR), so the first assertion
 * retries with reloads until the buttons appear.
 */

import { test, expect, request, type Page } from '@playwright/test'

const PRODUCT_ID = '28ffa180-5cb9-49f3-8a7b-ae352d4669b7'
const VARIANT_L_BLUE_ID = '61a29899-69c5-4607-9dda-577221810a73'
const PRODUCT_URL = '/products/test-shirt-1782487297'
const API = 'http://localhost:8000'

async function login(email: string, password: string): Promise<string> {
  const ctx = await request.newContext()
  const res = await ctx.post(`${API}/api/auth/login`, { data: { email, password } })
  const { access_token } = await res.json()
  await ctx.dispose()
  return access_token
}

async function put(token: string, path: string, method: 'put' | 'patch', data: unknown) {
  const ctx = await request.newContext()
  await ctx[method](`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, data })
  await ctx.dispose()
}

const size = (page: Page, label: string) =>
  page.getByRole('group', { name: 'Size' }).getByRole('button', { name: label })
const colour = (page: Page, label: string) =>
  page.getByRole('group', { name: 'Colour' }).getByRole('button', { name: label })

test.describe('Variant picker — buttons mode', () => {
  let superToken: string
  let adminToken: string

  test.beforeAll(async () => {
    superToken = await login('superadmin@commerceforce.dev', 'SuperAdmin1234!')
    adminToken = await login('admin@commerceforce.dev', 'Admin1234!')
    await put(superToken, '/api/branding', 'put', { variant_display: 'buttons' })
    await put(adminToken, `/api/products/${PRODUCT_ID}/variants/${VARIANT_L_BLUE_ID}`, 'patch', { is_active: false })
  })

  test.afterAll(async () => {
    await put(superToken, '/api/branding', 'put', { variant_display: 'dropdown' })
    await put(adminToken, `/api/products/${PRODUCT_ID}/variants/${VARIANT_L_BLUE_ID}`, 'patch', { is_active: true })
  })

  test('shows a button per value and no select', async ({ page }) => {
    await expect(async () => {
      await page.goto(PRODUCT_URL)
      await expect(size(page, 'L')).toBeVisible({ timeout: 1000 })
    }).toPass({ timeout: 75_000 })
    await expect(page.getByRole('group', { name: 'Size' }).getByRole('button')).toHaveCount(3)
    await expect(page.getByRole('group', { name: 'Colour' }).getByRole('button')).toHaveCount(2)
    await expect(page.locator('select')).toHaveCount(0)
  })

  test('clicking selects (aria-pressed), clicking again deselects', async ({ page }) => {
    await page.goto(PRODUCT_URL)
    await size(page, 'M').click()
    await expect(size(page, 'M')).toHaveAttribute('aria-pressed', 'true')
    await size(page, 'M').click()
    await expect(size(page, 'M')).toHaveAttribute('aria-pressed', 'false')
  })

  test('selecting L marks Blue unavailable but still clickable; Red stays available', async ({ page }) => {
    await page.goto(PRODUCT_URL)
    await size(page, 'L').click()
    await expect(colour(page, 'Blue')).toContainText(/unavailable/i)
    await expect(colour(page, 'Blue')).toBeEnabled()
    await expect(colour(page, 'Red')).not.toContainText(/unavailable/i)
  })

  test('Clear resets every selection', async ({ page }) => {
    await page.goto(PRODUCT_URL)
    await size(page, 'S').click()
    await colour(page, 'Red').click()
    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(size(page, 'S')).toHaveAttribute('aria-pressed', 'false')
    await expect(colour(page, 'Red')).toHaveAttribute('aria-pressed', 'false')
  })
})

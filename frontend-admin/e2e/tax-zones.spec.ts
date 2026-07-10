/**
 * Admin Tax Zones page E2E (Settings → Tax) — previously only exercised via
 * direct API calls; this drives the actual CRUD table in the browser.
 *
 * Prerequisites: backend on :8000 (admin@commerceforce.dev / Admin1234!),
 * admin panel on :3001, `tax` plugin enabled in ENABLED_PLUGINS.
 */
import { test, expect, request, type Page } from '@playwright/test'

const API = 'http://localhost:8000'
const ADMIN_EMAIL = 'admin@commerceforce.dev'
const ADMIN_PASSWORD = 'Admin1234!'

const STAMP = Date.now()
const ZONE_NAME = `E2E Zone ${STAMP}`
const ZONE_NAME_EDITED = `E2E Zone ${STAMP} Edited`

// POST /api/auth/login is rate-limited (5/minute per IP) and this file makes
// two login calls (one here, one via the UI in loginAsAdmin) — retry on 429 so
// running this alongside other specs that also log in doesn't flake. Done
// inline in the test (not a beforeAll/afterAll hook) because hook timeouts are
// a fixed 30s that test.setTimeout() can't extend, and this backoff can exceed that.
async function getAdminToken(request_: import('@playwright/test').APIRequestContext): Promise<string> {
  let res = await request_.post(`${API}/api/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
  for (const waitMs of [20_000, 40_000]) {
    if (res.status() !== 429) break
    await new Promise((r) => setTimeout(r, waitMs))
    res = await request_.post(`${API}/api/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
  }
  expect(res.ok()).toBeTruthy()
  const { access_token } = await res.json()
  return access_token
}

async function loginAsAdmin(page: Page) {
  for (const waitMs of [0, 20_000, 40_000]) {
    if (waitMs) await new Promise((r) => setTimeout(r, waitMs))
    await page.goto('/login')
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    try {
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 })
      return
    } catch {
      /* likely 429 — retry with backoff */
    }
  }
  throw new Error('Admin UI login did not navigate away from /login after retries')
}

test.describe('Admin — Tax Zones', () => {
  test('admin can create, edit, and delete a tax zone', async ({ page, request: request_ }) => {
    test.setTimeout(180_000) // may retry both rate-limited login calls

    const token = await getAdminToken(request_)
    const authedRequest = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } })

    try {
      await loginAsAdmin(page)
      await page.goto('/settings/tax')
      await page.waitForLoadState('networkidle')
      await expect(page.getByRole('heading', { name: 'Tax Zones' })).toBeVisible()

      // The row currently in add/edit mode is identified structurally (it's the
      // only row containing these inputs) — text-based row locators can't be used
      // here because once a row is editing, its name no longer renders as plain
      // text (it's an input value), so a hasText locator would stop matching it.
      const editingRow = page.locator('tr').filter({ has: page.getByPlaceholder('UK VAT') })

      // Create
      await page.getByRole('button', { name: 'Add zone' }).click()
      await page.getByPlaceholder('UK VAT').fill(ZONE_NAME)
      await page.getByPlaceholder('GB,IE or *').fill('GB')
      await page.locator('input[type="number"]').fill('20')
      await editingRow.locator('button').first().click() // Check/save icon

      await expect(page.getByText(ZONE_NAME, { exact: true })).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText('20.00%')).toBeVisible()

      // Edit — open the created row's pencil button (row still identifiable by
      // its rendered name text at this point, before it switches to edit mode)
      const createdRow = page.locator('tr', { hasText: ZONE_NAME })
      await createdRow.locator('button').first().click() // pencil

      await page.getByPlaceholder('UK VAT').fill(ZONE_NAME_EDITED)
      await page.locator('input[type="number"]').fill('17.5')
      await editingRow.locator('button').first().click() // Check/save icon

      await expect(page.getByText(ZONE_NAME_EDITED)).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText('17.50%')).toBeVisible()

      // Delete
      const editedRow = page.locator('tr', { hasText: ZONE_NAME_EDITED })
      await editedRow.locator('button').nth(1).click() // trash icon
      await expect(page.getByText(ZONE_NAME_EDITED)).toHaveCount(0, { timeout: 10_000 })
    } finally {
      // Best-effort cleanup of anything left over by a failed run partway through.
      const zones = await (await authedRequest.get(`${API}/api/tax/zones`)).json()
      for (const z of zones) {
        if (typeof z.name === 'string' && z.name.startsWith('E2E Zone')) {
          await authedRequest.delete(`${API}/api/tax/zones/${z.id}`).catch(() => {})
        }
      }
      await authedRequest.dispose()
    }
  })
})

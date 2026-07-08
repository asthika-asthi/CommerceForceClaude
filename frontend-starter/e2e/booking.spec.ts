/**
 * Scheduling booking-flow E2E smoke test.
 *
 * Prerequisites:
 *   - Backend running on :8000 (admin login — defaults to admin@commerceforce.dev / Admin1234!,
 *     override with E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD)
 *   - Storefront running on :3000 (npm run dev)
 *   - The `scheduling` plugin enabled and its tables present in the DB.
 *
 * The test seeds its own data via the API (a provider, an active appointment type linked
 * to that provider, and all-week availability), then drives the public /book flow as a
 * GUEST end-to-end and asserts the confirmation screen. It cleans up (soft-deactivates the
 * provider + type) on teardown. Data is uniquely named per run, so repeated runs never
 * collide.
 */

import { test, expect, request, type APIRequestContext } from '@playwright/test'

const API = 'http://localhost:8000'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@commerceforce.dev'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Admin1234!'

const STAMP = Date.now()
const SERVICE_NAME = `E2E Checkup ${STAMP}`
const PROVIDER_NAME = `E2E Dr ${STAMP}`
const GUEST_EMAIL = `e2e.guest.${STAMP}@example.com`

/** A safe, deterministic future date (today + 14 days) as YYYY-MM-DD. Availability is set
 *  for every weekday, so any future date has open slots; +14 days avoids any past-time edge. */
function futureDateISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const BOOK_DATE = futureDateISO()

let providerId = ''
let typeId = ''

async function adminToken(ctx: APIRequestContext): Promise<string> {
  const res = await ctx.post(`${API}/api/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  if (!res.ok()) {
    throw new Error(
      `Admin login failed (${res.status()}). Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD to valid admin creds.`,
    )
  }
  const body = await res.json()
  if (!body.access_token) throw new Error('Admin login returned no access_token')
  return body.access_token
}

test.describe('Scheduling — public booking flow', () => {
  test.beforeAll(async () => {
    const ctx = await request.newContext()
    const token = await adminToken(ctx)
    const auth = { headers: { Authorization: `Bearer ${token}` } }

    // 1. Provider
    const pRes = await ctx.post(`${API}/api/scheduling/providers`, {
      ...auth,
      data: { display_name: PROVIDER_NAME, title: 'GP', is_active: true },
    })
    expect(pRes.ok(), `create provider: ${pRes.status()}`).toBeTruthy()
    providerId = (await pRes.json()).id

    // 2. Active appointment type offered by that provider
    const tRes = await ctx.post(`${API}/api/scheduling/appointment-types`, {
      ...auth,
      data: { name: SERVICE_NAME, duration_minutes: 30, is_active: true, provider_ids: [providerId] },
    })
    expect(tRes.ok(), `create type: ${tRes.status()}`).toBeTruthy()
    typeId = (await tRes.json()).id

    // 3. Availability for every weekday 09:00–17:00 (so any future date has slots)
    for (let weekday = 0; weekday <= 6; weekday++) {
      const aRes = await ctx.post(`${API}/api/scheduling/providers/${providerId}/availability`, {
        ...auth,
        data: { weekday, start_time: '09:00:00', end_time: '17:00:00' },
      })
      expect(aRes.ok(), `create availability wd=${weekday}: ${aRes.status()}`).toBeTruthy()
    }

    await ctx.dispose()
  })

  test.afterAll(async () => {
    // Soft-deactivate the seeded provider + type so they leave the active lists.
    const ctx = await request.newContext()
    try {
      const token = await adminToken(ctx)
      const auth = { headers: { Authorization: `Bearer ${token}` } }
      if (typeId) await ctx.delete(`${API}/api/scheduling/appointment-types/${typeId}`, auth)
      if (providerId) await ctx.delete(`${API}/api/scheduling/providers/${providerId}`, auth)
    } catch {
      // best-effort cleanup — never fail the run on teardown
    } finally {
      await ctx.dispose()
    }
  })

  test('/book page loads and shows the service step', async ({ page }) => {
    await page.goto('/book')
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/\/error/)
    // Our seeded service card must appear in step 1
    await expect(page.locator('button', { hasText: SERVICE_NAME })).toBeVisible({ timeout: 10_000 })
  })

  test('a guest can complete a booking end-to-end', async ({ page }) => {
    await page.goto('/book')
    await page.waitForLoadState('networkidle')

    // Step 1 — pick the seeded service
    const serviceBtn = page.locator('button', { hasText: SERVICE_NAME })
    await expect(serviceBtn).toBeVisible({ timeout: 10_000 })
    await serviceBtn.click()

    // Step 2 — pick the seeded provider
    const providerBtn = page.locator('button', { hasText: PROVIDER_NAME })
    await expect(providerBtn).toBeVisible({ timeout: 10_000 })
    await providerBtn.click()

    // Step 3 — choose a future date, then pick the first open slot
    const dateInput = page.locator('input[type="date"]')
    await expect(dateInput).toBeVisible({ timeout: 10_000 })
    await dateInput.fill(BOOK_DATE)
    // Slots reload for the new date; a slot button shows a time like "9:00 AM"
    const slotBtn = page.getByRole('button', { name: /\d{1,2}:\d{2}/ }).first()
    await expect(slotBtn).toBeVisible({ timeout: 10_000 })
    await slotBtn.click()

    // Step 4 — guest details (first two text inputs = first/last name; email is type=email)
    await expect(page.getByText('Your details')).toBeVisible({ timeout: 10_000 })
    await page.locator('input:not([type="email"]):not([type="date"])').nth(0).fill('E2E')
    await page.locator('input:not([type="email"]):not([type="date"])').nth(1).fill('Guest')
    await page.locator('input[type="email"]').fill(GUEST_EMAIL)

    // Confirm — the Book button is enabled once required fields are filled
    const bookBtn = page.getByRole('button', { name: /^Book / })
    await expect(bookBtn).toBeEnabled({ timeout: 5_000 })
    await bookBtn.click()

    // Success screen
    await expect(page.getByText(/is confirmed!/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(PROVIDER_NAME)).toBeVisible()
  })
})

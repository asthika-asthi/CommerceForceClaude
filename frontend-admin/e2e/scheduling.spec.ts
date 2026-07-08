/**
 * Admin scheduling E2E smoke test — book an appointment + write a clinical note.
 *
 * Prerequisites:
 *   - Backend running on :8000 (superadmin login — defaults to
 *     superadmin@commerceforce.dev / SuperAdmin1234!, override with
 *     E2E_SUPERADMIN_EMAIL / E2E_SUPERADMIN_PASSWORD)
 *   - Admin panel running on :3001 (npm run dev -- -p 3001)
 *   - The `scheduling` plugin enabled and its tables present.
 *
 * Logs in as SUPERADMIN (so the provider-scoped journal is writable), seeds a
 * provider + active linked type + a client via the API, then drives the admin UI:
 * (1) books an appointment on the Appointments page, (2) writes a SOAP note on the
 * client hub. Seeded provider/type/client are soft-deleted on teardown. Data is
 * uniquely named per run so reruns never collide.
 */

import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test'

const API = 'http://localhost:8000'
const SA_EMAIL = process.env.E2E_SUPERADMIN_EMAIL ?? 'superadmin@commerceforce.dev'
const SA_PASSWORD = process.env.E2E_SUPERADMIN_PASSWORD ?? 'SuperAdmin1234!'

const STAMP = Date.now()
const PROVIDER_NAME = `E2E Dr ${STAMP}`
const SERVICE_NAME = `E2E Service ${STAMP}`
const CLIENT_FIRST = `Zoe${STAMP}`
const CLIENT_LAST = 'Testpatient'
const CLIENT_FULL = `${CLIENT_FIRST} ${CLIENT_LAST}`
const CLIENT_EMAIL = `e2e.client.${STAMP}@example.com`

// A future datetime for the booking (today + 14 days at 10:00) — admins may book any time.
function futureDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const BOOK_DATETIME = `${futureDate()}T10:00`

let providerId = ''
let typeId = ''
let clientId = ''

async function saToken(ctx: APIRequestContext): Promise<string> {
  const res = await ctx.post(`${API}/api/auth/login`, { data: { email: SA_EMAIL, password: SA_PASSWORD } })
  if (!res.ok()) {
    throw new Error(`Superadmin login failed (${res.status()}). Set E2E_SUPERADMIN_EMAIL / E2E_SUPERADMIN_PASSWORD.`)
  }
  const body = await res.json()
  if (!body.access_token) throw new Error('Superadmin login returned no access_token')
  return body.access_token
}

async function loginUI(page: Page) {
  await page.goto('/login')
  await page.fill('input[type="email"]', SA_EMAIL)
  await page.fill('input[type="password"]', SA_PASSWORD)
  await page.click('button[type="submit"]')
  // Post-login lands on an authenticated page (products/dashboard) — just wait until we
  // leave /login rather than assume a specific landing route.
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 })
}

test.describe('Admin scheduling — book + journal', () => {
  test.beforeAll(async () => {
    const ctx = await request.newContext()
    const auth = { headers: { Authorization: `Bearer ${await saToken(ctx)}` } }

    const pRes = await ctx.post(`${API}/api/scheduling/providers`, {
      ...auth, data: { display_name: PROVIDER_NAME, title: 'GP', is_active: true },
    })
    expect(pRes.ok(), `provider: ${pRes.status()}`).toBeTruthy()
    providerId = (await pRes.json()).id

    const tRes = await ctx.post(`${API}/api/scheduling/appointment-types`, {
      ...auth, data: { name: SERVICE_NAME, duration_minutes: 30, is_active: true, provider_ids: [providerId] },
    })
    expect(tRes.ok(), `type: ${tRes.status()}`).toBeTruthy()
    typeId = (await tRes.json()).id

    const cRes = await ctx.post(`${API}/api/scheduling/clients`, {
      ...auth, data: { first_name: CLIENT_FIRST, last_name: CLIENT_LAST, email: CLIENT_EMAIL },
    })
    expect(cRes.ok(), `client: ${cRes.status()}`).toBeTruthy()
    clientId = (await cRes.json()).id

    await ctx.dispose()
  })

  test.afterAll(async () => {
    const ctx = await request.newContext()
    try {
      const auth = { headers: { Authorization: `Bearer ${await saToken(ctx)}` } }
      if (typeId) await ctx.delete(`${API}/api/scheduling/appointment-types/${typeId}`, auth)
      if (clientId) await ctx.delete(`${API}/api/scheduling/clients/${clientId}`, auth)
      if (providerId) await ctx.delete(`${API}/api/scheduling/providers/${providerId}`, auth)
    } catch {
      /* best-effort */
    } finally {
      await ctx.dispose()
    }
  })

  test('admin books an appointment from the Appointments page', async ({ page }) => {
    await loginUI(page)
    await page.goto('/scheduling/appointments')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ New appointment' }).click()

    // Provider + type (type select enables + loads once a provider is chosen)
    await page.locator('label:has-text("Provider *") + select').selectOption(providerId)
    const typeSelect = page.locator('label:has-text("Appointment type *") + select')
    await page.locator(`label:has-text("Appointment type *") + select option[value="${typeId}"]`).waitFor({ state: 'attached', timeout: 10_000 })
    await typeSelect.selectOption(typeId)

    // Client combobox: type to search, then click the matching result (email is unique)
    await page.locator('input[placeholder*="Search clients"]').fill(CLIENT_FIRST)
    await page.locator('button', { hasText: CLIENT_EMAIL }).click({ timeout: 10_000 })

    await page.locator('input[type="datetime-local"]').fill(BOOK_DATETIME)

    const bookBtn = page.getByRole('button', { name: 'Book Appointment' })
    await expect(bookBtn).toBeEnabled({ timeout: 5_000 })
    await bookBtn.click()

    // The new appointment shows in the list (client name cell)
    await expect(page.getByText(CLIENT_FULL).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(SERVICE_NAME).first()).toBeVisible()
  })

  test('admin writes a SOAP clinical note on the client hub', async ({ page }) => {
    await loginUI(page)
    await page.goto(`/scheduling/clients/${clientId}`)
    await page.waitForLoadState('networkidle')

    // Journal section — open the new-note form (present because superadmin has access)
    await page.getByRole('button', { name: '+ New note' }).click()

    // SOAP fields are textareas labelled Subjective/Objective/Assessment/Plan
    await page.locator('label:has-text("Subjective") + textarea').fill('E2E subjective note')
    await page.locator('label:has-text("Objective") + textarea').fill('E2E objective note')
    await page.locator('label:has-text("Assessment") + textarea').fill('E2E assessment note')
    await page.locator('label:has-text("Plan") + textarea').fill('E2E plan note')

    await page.getByRole('button', { name: 'Save note' }).click()

    // On success the form closes (Save note button gone) and the empty state disappears
    await expect(page.getByRole('button', { name: 'Save note' })).toHaveCount(0, { timeout: 10_000 })
    await expect(page.getByText('No notes recorded yet.')).toHaveCount(0)
  })
})

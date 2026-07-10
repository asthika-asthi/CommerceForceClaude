/**
 * Admin Data Deletion Requests page E2E — previously only exercised via
 * direct API calls (backend/tests/test_gdpr.py); this drives the actual
 * approve/reject flow in the browser.
 *
 * Seeds a disposable customer + a pending deletion request via the API
 * (registering + requesting deletion isn't practical to drive through two
 * separate frontends in one spec), then logs in as admin in the UI to
 * review and action it.
 *
 * Prerequisites: backend on :8000 (admin@commerceforce.dev / Admin1234!),
 * admin panel on :3001.
 */
import { test, expect, request, type Page } from '@playwright/test'

const API = 'http://localhost:8000'
const ADMIN_EMAIL = 'admin@commerceforce.dev'
const ADMIN_PASSWORD = 'Admin1234!'

// POST /api/auth/login is rate-limited (5/minute per IP) too — retry with
// backoff so this doesn't flake when run alongside other specs that also log in.
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

// POST /api/auth/register is rate-limited to 3/minute per IP — retry once on
// a 429 so this doesn't flake when run alongside other specs that also register.
async function seedPendingDeletionRequest(request_: import('@playwright/test').APIRequestContext) {
  const email = `deletion-e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
  const body = { email, password: 'TestPass123!', first_name: 'Del', last_name: 'Tester' }

  let reg = await request_.post(`${API}/api/auth/register`, { data: body })
  for (const waitMs of [20_000, 40_000]) {
    if (reg.status() !== 429) break
    await new Promise((r) => setTimeout(r, waitMs))
    reg = await request_.post(`${API}/api/auth/register`, { data: body })
  }
  expect(reg.ok()).toBeTruthy()
  const { access_token } = await reg.json()

  const req = await request_.post(`${API}/api/auth/me/deletion-request`, {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  expect(req.ok()).toBeTruthy()
  return email
}

test.describe('Admin — Data Deletion Requests', () => {
  test('admin sees a pending request and can reject it with notes', async ({ page, request: request_ }) => {
    test.setTimeout(180_000) // may retry both rate-limited register and login calls
    const email = await seedPendingDeletionRequest(request_)

    await loginAsAdmin(page)
    await page.goto('/deletion-requests')
    await page.waitForLoadState('networkidle')

    const row = page.locator('tr', { hasText: email })
    await expect(row).toBeVisible({ timeout: 10_000 })

    await row.getByRole('button', { name: 'Reject' }).click()
    await row.getByPlaceholder('Reason (required)').fill('E2E rejection reason')
    await row.getByRole('button', { name: 'Confirm' }).click()

    await expect(row.getByText(/Reviewed/)).toBeVisible({ timeout: 10_000 })
    await expect(row.getByRole('button', { name: 'Approve & Anonymize' })).toHaveCount(0)
  })

  test('admin can approve a request, anonymizing the account', async ({ page, request: request_ }) => {
    test.setTimeout(180_000) // may retry both rate-limited register and login calls
    const email = await seedPendingDeletionRequest(request_)

    await loginAsAdmin(page)
    await page.goto('/deletion-requests')
    await page.waitForLoadState('networkidle')

    const row = page.locator('tr', { hasText: email })
    await expect(row).toBeVisible({ timeout: 10_000 })

    await row.getByRole('button', { name: 'Approve & Anonymize' }).click()

    // Row's email cell no longer matches — status flips to approved and actions disappear.
    await expect(page.locator('tr', { hasText: email }).getByRole('button', { name: 'Approve & Anonymize' }))
      .toHaveCount(0, { timeout: 10_000 })
  })
})

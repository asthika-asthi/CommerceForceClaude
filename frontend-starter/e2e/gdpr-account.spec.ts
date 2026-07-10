/**
 * GDPR self-service E2E — account Settings page "Privacy" section (data export
 * + account-deletion request). Previously only exercised via direct API calls
 * (backend/tests/test_gdpr.py); this drives the actual storefront UI.
 *
 * `POST /api/auth/register` is rate-limited to 3/minute per IP — this file
 * shares one registered account across the two tests that don't mutate
 * deletion status (download, cancel-dialog) and only registers a second,
 * dedicated account for the test that actually submits a deletion request.
 * `registerCustomer` also retries once on a 429 as a safety net for whatever
 * else may be hitting the same endpoint concurrently.
 *
 * Injects the resulting access token into localStorage before navigating,
 * matching how store/auth.ts hydrates a session client-side.
 *
 * Prerequisites: backend on :8000, storefront on :3000.
 */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

const API = 'http://localhost:8000'

async function registerCustomer(request: APIRequestContext) {
  const email = `gdpr-e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
  const body = { email, password: 'TestPass123!', first_name: 'GDPR', last_name: 'Tester' }

  let res = await request.post(`${API}/api/auth/register`, { data: body })
  if (res.status() === 429) {
    await new Promise((r) => setTimeout(r, 20_000))
    res = await request.post(`${API}/api/auth/register`, { data: body })
  }
  expect(res.ok()).toBeTruthy()
  const { access_token } = await res.json()
  return { email, access_token }
}

async function loginViaToken(page: Page, token: string) {
  await page.addInitScript((t) => localStorage.setItem('cf_token', t), token)
  await page.goto('/account/settings')
  await page.waitForLoadState('networkidle')
}

test.describe('GDPR — account settings Privacy section', () => {
  let sharedToken: string

  test.beforeAll(async ({ request }) => {
    ;({ access_token: sharedToken } = await registerCustomer(request))
  })

  test('download my data triggers a file download', async ({ page }) => {
    await loginViaToken(page, sharedToken)

    await expect(page.getByRole('button', { name: 'Download my data' })).toBeVisible()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download my data' }).click(),
    ])
    expect(download.suggestedFilename()).toBe('my-data.json')
  })

  test('cancelling the confirm dialog does not submit a request', async ({ page }) => {
    await loginViaToken(page, sharedToken)

    await page.getByRole('button', { name: 'Delete my account' }).click()
    await expect(page.getByText('Delete your account?')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByText('Delete your account?')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Delete my account' })).toBeVisible()
  })

  test('requesting deletion shows a confirm dialog, then a pending status', async ({ page, request }) => {
    test.setTimeout(60_000) // may retry the rate-limited register call
    const { access_token } = await registerCustomer(request)
    await loginViaToken(page, access_token)

    await page.getByRole('button', { name: 'Delete my account' }).click()
    await expect(page.getByText('Delete your account?')).toBeVisible()

    await page.getByRole('button', { name: 'Submit request' }).click()

    await expect(page.getByText(/deletion request is pending review/i)).toBeVisible({ timeout: 10_000 })
    // The action button is replaced by status copy once a request exists.
    await expect(page.getByRole('button', { name: 'Delete my account' })).toHaveCount(0)
  })
})

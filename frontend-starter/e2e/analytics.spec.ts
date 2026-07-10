/**
 * Analytics (GA4 / Meta Pixel) E2E — verifies the script tags actually load or
 * don't load in a real browser, tied to the cookie-consent banner state.
 * Previously only backend ID-validation and consent-copy text were covered.
 *
 * Prerequisites: backend on :8000, storefront on :3000, seeded admin user.
 * Restores the previous branding analytics IDs afterwards.
 */
import { test, expect } from '@playwright/test'

const API = 'http://localhost:8000'
const ADMIN = { email: 'admin@commerceforce.dev', password: 'Admin1234!' }
const GA4_ID = 'G-E2ETEST123'
const PIXEL_ID = '999999999999999'

test.describe('Analytics script injection', () => {
  let before: { ga4_measurement_id: string | null; meta_pixel_id: string | null }

  test.beforeAll(async ({ request }) => {
    const login = await request.post(`${API}/api/auth/login`, { data: ADMIN })
    test.skip(!login.ok(), 'seeded admin login unavailable')
    const { access_token } = await login.json()
    const headers = { Authorization: `Bearer ${access_token}` }

    const current = await (await request.get(`${API}/api/branding`)).json()
    before = { ga4_measurement_id: current.ga4_measurement_id ?? null, meta_pixel_id: current.meta_pixel_id ?? null }

    const put = await request.put(`${API}/api/branding`, {
      headers,
      data: { ga4_measurement_id: GA4_ID, meta_pixel_id: PIXEL_ID },
    })
    expect(put.ok()).toBeTruthy()
  })

  test.afterAll(async ({ request }) => {
    const login = await request.post(`${API}/api/auth/login`, { data: ADMIN })
    if (!login.ok()) return
    const { access_token } = await login.json()
    await request.put(`${API}/api/branding`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: before,
    })
  })

  // Each test gets a fresh, isolated browser context from Playwright by
  // default, so localStorage (and the consent decision) always starts empty —
  // no explicit reset needed, and one must NOT use addInitScript for this:
  // it re-runs on every navigation including page.reload(), which would wipe
  // consent right as a reloaded page loads and reintroduce the banner.

  test('declining cookies keeps GA4/Pixel scripts out of the page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Essential only' }).click()

    await expect(page.locator('script[src*="googletagmanager.com/gtag/js"]')).toHaveCount(0)
    await expect(page.locator('#meta-pixel-init')).toHaveCount(0)
  })

  test('no prior consent decision keeps GA4/Pixel scripts out of the page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Banner is visible but no choice made yet — scripts must not load.
    await expect(page.getByText('This site uses cookies')).toBeVisible()
    await expect(page.locator('script[src*="googletagmanager.com/gtag/js"]')).toHaveCount(0)
    await expect(page.locator('#meta-pixel-init')).toHaveCount(0)
  })

  test('accepting cookies loads the GA4 and Meta Pixel scripts', async ({ page }) => {
    // The global default (playwright.config.ts) is 30s, but the poll below alone
    // allows 90s (branding is cached server-side for 60s) — without this override
    // the framework can kill the test mid-poll regardless of the poll's own timeout.
    test.setTimeout(150_000)

    await expect
      .poll(
        async () => {
          await page.goto('/')
          await page.waitForLoadState('networkidle')
          // Short timeout + swallow: once an earlier iteration accepts, the banner
          // won't reappear, so a plain .click() would time out and fail the poll.
          await page.getByRole('button', { name: 'Accept' }).click({ timeout: 3_000 }).catch(() => {})
          return page.locator('#ga4-init').count()
        },
        { timeout: 90_000, intervals: [5_000] },
      )
      .toBeGreaterThan(0)

    await expect(page.locator(`script[src*="googletagmanager.com/gtag/js?id=${GA4_ID}"]`)).toHaveCount(1)
    await expect(page.locator('#meta-pixel-init')).toHaveCount(1)
    const pixelScript = await page.locator('#meta-pixel-init').textContent()
    expect(pixelScript).toContain(PIXEL_ID)
  })

  test('accepting cookies on a later visit (consent already stored) still loads scripts', async ({ page }) => {
    // Runs right after the previous test, which already forced a fresh branding
    // fetch, but give this one the same headroom in case that cache has gone
    // stale again by the time it runs.
    test.setTimeout(60_000)

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Unlike .count(), .click() auto-waits for the button to mount (the consent
    // banner only appears after a client-side effect fires) — a count() guard
    // here can race hydration and silently skip the click, leaving consent unset.
    await page.getByRole('button', { name: 'Accept' }).click()
    await expect(page.locator('#ga4-init')).toHaveCount(1, { timeout: 30_000 })

    // Reload — banner should not reappear (decision persisted) and scripts still load.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('This site uses cookies')).toHaveCount(0)
    await expect(page.locator('#ga4-init')).toHaveCount(1, { timeout: 10_000 })
  })
})

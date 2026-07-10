/**
 * Theme colours E2E — verifies an admin-chosen brand colour reaches the storefront.
 *
 * The admin panel stores theme_colors on /api/branding; the storefront layout derives
 * the full shade set and applies it as inline CSS variables on <html>, overriding the
 * theme-file defaults. Restores the previous theme_colors afterwards.
 *
 * Prerequisites: backend on :8000, storefront on :3000, seeded admin user.
 */
import { test, expect } from '@playwright/test'

const API = 'http://localhost:8000'
const ADMIN = { email: 'admin@commerceforce.dev', password: 'Admin1234!' }
const TEST_BRAND = '#d4a017'

test.describe('Theme colours', () => {
  test('admin-set brand colour is applied as CSS variables on <html>', async ({ page, request }) => {
    // The global default (playwright.config.ts) is 30s, but the poll below alone
    // allows 90s (branding is cached server-side for 60s) — without this override
    // the framework kills the test mid-poll regardless of the poll's own timeout.
    test.setTimeout(150_000)

    const login = await request.post(`${API}/api/auth/login`, { data: ADMIN })
    test.skip(!login.ok(), 'seeded admin login unavailable')
    const { access_token } = await login.json()
    const headers = { Authorization: `Bearer ${access_token}` }

    const before = await (await request.get(`${API}/api/branding`)).json()
    const put = await request.put(`${API}/api/branding`, {
      headers,
      data: { theme_colors: { core: { brand: TEST_BRAND } } },
    })
    expect(put.ok()).toBeTruthy()

    try {
      // serverFetch caches /api/branding for 60s (next: { revalidate: 60 }),
      // so poll until the new colour propagates to the rendered page.
      let style = ''
      await expect
        .poll(
          async () => {
            await page.goto('/')
            style = (await page.locator('html').getAttribute('style')) ?? ''
            return style.toLowerCase()
          },
          { timeout: 90_000, intervals: [5_000] },
        )
        .toContain(`--brand:${TEST_BRAND}`)
      // Derived shades come along automatically.
      expect(style).toContain('--brand-tint')
      expect(style).toContain('--on-brand')
    } finally {
      await request.put(`${API}/api/branding`, {
        headers,
        data: { theme_colors: before.theme_colors ?? {} },
      })
    }
  })
})

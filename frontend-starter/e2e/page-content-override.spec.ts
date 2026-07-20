/**
 * Page Content override E2E — verifies a shop-admin content edit reaches the
 * live homepage, and that clearing it reverts to the config-authored value.
 *
 * Prerequisites: backend on :8000, storefront on :3000, seeded admin user.
 */
import { test, expect } from '@playwright/test'

const API = 'http://localhost:8000'
const ADMIN = { email: 'admin@commerceforce.dev', password: 'Admin1234!' }

test.describe('Page Content override', () => {
  test('saved content override renders on the homepage, then reverts when cleared', async ({ page, request }) => {
    // serverFetch caches for 60s (same as branding) — this test waits out that
    // window twice in sequence (save→visible, then clear→reverted), so it needs
    // real headroom over 90_000 + 90_000 plus login/navigation overhead.
    test.setTimeout(210_000)

    const login = await request.post(`${API}/api/auth/login`, { data: ADMIN })
    test.skip(!login.ok(), 'seeded admin login unavailable')
    const { access_token } = await login.json()
    const headers = { Authorization: `Bearer ${access_token}` }

    // Confirm the section starts at its config-authored value
    await page.goto('/')
    await expect(page.getByText('More from', { exact: false })).toBeVisible()

    // Save an override
    const saveRes = await request.put(`${API}/api/landing_page/product-grid-more`, {
      headers,
      data: { overrides: { title: 'E2E Override Title' }, is_hidden: false },
    })
    expect(saveRes.ok()).toBeTruthy()

    try {
      // Homepage reflects it — poll to absorb the 60s server-side cache window
      await expect(async () => {
        await page.goto('/')
        await expect(page.getByText('E2E Override Title')).toBeVisible()
      }).toPass({ timeout: 90_000, intervals: [5_000] })
    } finally {
      // Clear the override back to the config's own value — runs even if the
      // poll above throws, so a failed assertion never leaves the live
      // homepage stuck on the test's override.
      const clearRes = await request.put(`${API}/api/landing_page/product-grid-more`, {
        headers,
        data: { overrides: {}, is_hidden: false },
      })
      expect(clearRes.ok()).toBeTruthy()
    }

    await expect(async () => {
      await page.goto('/')
      await expect(page.getByText('More from', { exact: false })).toBeVisible()
      await expect(page.getByText('E2E Override Title')).not.toBeVisible()
    }).toPass({ timeout: 90_000, intervals: [5_000] })
  })
})

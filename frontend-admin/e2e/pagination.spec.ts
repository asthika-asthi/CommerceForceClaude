/**
 * Admin panel — pagination and search E2E tests.
 *
 * Prerequisites:
 *   - Backend running on :8000 (admin@commerceforce.dev / Admin1234!)
 *   - Admin panel running on :3001 (npm run dev -- -p 3001)
 *   - Database seeded with enough records to trigger pagination (> 20 per page type)
 *     Run: python seed.py from backend/ to populate demo data.
 *
 * The tests use the live API to seed the exact data they need via the admin
 * token, so the results are deterministic regardless of what else is in the DB.
 */

import { test, expect, request, type APIRequestContext } from '@playwright/test'

const ADMIN_EMAIL = 'admin@commerceforce.dev'
const ADMIN_PASSWORD = 'Admin1234!'
const API = 'http://localhost:8000'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getAdminToken(): Promise<string> {
  const ctx = await request.newContext()
  const res = await ctx.post(`${API}/api/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  expect(res.ok()).toBeTruthy()
  const { access_token } = await res.json()
  await ctx.dispose()
  return access_token
}

async function apiCtx(token: string): Promise<APIRequestContext> {
  return request.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  })
}

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  // Admin lands on /products after login (app/login/page.tsx). Wait for any authenticated
  // page rather than a specific route, so this doesn't break if the landing changes.
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 })
}

// ── Products: search input ────────────────────────────────────────────────────

test.describe('Products page — search', () => {
  let token: string
  let createdIds: string[] = []

  test.beforeAll(async () => {
    token = await getAdminToken()
    const ctx = await apiCtx(token)
    // Create 3 products with distinct names for search testing
    for (const name of ['Pagination Widget Alpha', 'Pagination Widget Beta', 'Totally Different Gadget']) {
      const res = await ctx.post(`${API}/api/products`, {
        data: { name, price: '9.99', stock_quantity: 10 },
      })
      const body = await res.json()
      createdIds.push(body.id)
    }
    await ctx.dispose()
  })

  test.afterAll(async () => {
    const ctx = await apiCtx(token)
    for (const id of createdIds) {
      await ctx.delete(`${API}/api/products/${id}`)
    }
    await ctx.dispose()
  })

  test('search input is visible on products page', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/products')
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible()
  })

  test('typing in search filters products', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/products')

    const searchInput = page.locator('input[placeholder*="Search"]')
    await searchInput.fill('Pagination Widget')
    // Wait for debounce (300ms) + network
    await page.waitForTimeout(600)

    // Should see both Alpha and Beta but NOT the Gadget
    await expect(page.locator('td', { hasText: 'Pagination Widget Alpha' })).toBeVisible()
    await expect(page.locator('td', { hasText: 'Pagination Widget Beta' })).toBeVisible()
    await expect(page.locator('td', { hasText: 'Totally Different Gadget' })).not.toBeVisible()
  })

  test('clearing search restores full list', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/products')

    const searchInput = page.locator('input[placeholder*="Search"]')
    await searchInput.fill('Pagination Widget')
    await page.waitForTimeout(600)
    await searchInput.clear()
    await page.waitForTimeout(600)

    // All three should now be visible
    await expect(page.locator('td', { hasText: 'Pagination Widget Alpha' })).toBeVisible()
    await expect(page.locator('td', { hasText: 'Totally Different Gadget' })).toBeVisible()
  })

  test('searching with no match shows empty table', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/products')

    const searchInput = page.locator('input[placeholder*="Search"]')
    await searchInput.fill('zzz_no_match_whatsoever')
    await page.waitForTimeout(600)

    // Should see the empty state row
    await expect(page.locator('td', { hasText: /No products yet/ })).toBeVisible()
  })
})

// ── Pagination controls: shared behaviour ─────────────────────────────────────

/**
 * Seed enough records so pagination appears (> 20), then verify Prev/Next work.
 * Cleans up created records in afterAll.
 */
async function testPaginationOnPage(opts: {
  token: string
  pagePath: string
  seedFn: (ctx: APIRequestContext) => Promise<string[]>
  cleanFn: (ctx: APIRequestContext, ids: string[]) => Promise<void>
}) {
  let createdIds: string[] = []

  return {
    beforeAll: async () => {
      const ctx = await apiCtx(opts.token)
      createdIds = await opts.seedFn(ctx)
      await ctx.dispose()
    },
    afterAll: async () => {
      const ctx = await apiCtx(opts.token)
      await opts.cleanFn(ctx, createdIds)
      await ctx.dispose()
    },
    tests: (page: import('@playwright/test').Page) => ({
      paginationVisible: async () => {
        await page.goto(opts.pagePath)
        await page.waitForLoadState('networkidle')
        await expect(page.locator('button', { hasText: 'Next →' })).toBeVisible()
        await expect(page.locator('text=/Page 1 of/')).toBeVisible()
      },
      prevDisabledOnPage1: async () => {
        await page.goto(opts.pagePath)
        await page.waitForLoadState('networkidle')
        const prev = page.locator('button', { hasText: '← Prev' })
        await expect(prev).toBeDisabled()
      },
      nextNavigatesToPage2: async () => {
        await page.goto(opts.pagePath)
        await page.waitForLoadState('networkidle')
        await page.locator('button', { hasText: 'Next →' }).click()
        await page.waitForLoadState('networkidle')
        await expect(page.locator('text=/Page 2 of/')).toBeVisible()
        const prev = page.locator('button', { hasText: '← Prev' })
        await expect(prev).toBeEnabled()
      },
      prevReturnsToPage1: async () => {
        await page.goto(opts.pagePath)
        await page.waitForLoadState('networkidle')
        await page.locator('button', { hasText: 'Next →' }).click()
        await page.waitForLoadState('networkidle')
        await page.locator('button', { hasText: '← Prev' }).click()
        await page.waitForLoadState('networkidle')
        await expect(page.locator('text=/Page 1 of/')).toBeVisible()
      },
    }),
  }
}

// ── Products: pagination ──────────────────────────────────────────────────────

test.describe('Products page — pagination', () => {
  let token: string
  let ids: string[] = []

  test.beforeAll(async () => {
    token = await getAdminToken()
    const ctx = await apiCtx(token)
    // 22 products to exceed the page_size=20 default
    for (let i = 0; i < 22; i++) {
      const res = await ctx.post(`${API}/api/products`, {
        data: { name: `PagTest Product ${i}`, price: '1.00' },
      })
      ids.push((await res.json()).id)
    }
    await ctx.dispose()
  })

  test.afterAll(async () => {
    const ctx = await apiCtx(token)
    for (const id of ids) await ctx.delete(`${API}/api/products/${id}`)
    await ctx.dispose()
  })

  test('pagination row appears when > 20 products', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('button', { hasText: 'Next →' })).toBeVisible()
    await expect(page.locator('text=/Page 1 of/')).toBeVisible()
  })

  test('Prev button disabled on page 1', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('button', { hasText: '← Prev' })).toBeDisabled()
  })

  test('Next navigates to page 2 and Prev becomes enabled', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
    await page.locator('button', { hasText: 'Next →' }).click()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=/Page 2 of/')).toBeVisible()
    await expect(page.locator('button', { hasText: '← Prev' })).toBeEnabled()
  })

  test('Prev returns to page 1', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
    await page.locator('button', { hasText: 'Next →' }).click()
    await page.waitForLoadState('networkidle')
    await page.locator('button', { hasText: '← Prev' }).click()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=/Page 1 of/')).toBeVisible()
  })

  test('search resets to page 1', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
    // Go to page 2
    await page.locator('button', { hasText: 'Next →' }).click()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=/Page 2 of/')).toBeVisible()
    // Typing in search should reset to page 1
    await page.locator('input[placeholder*="Search"]').fill('PagTest')
    await page.waitForTimeout(600)
    await expect(page.locator('text=/Page 1 of/')).toBeVisible()
  })
})

// ── Enquiries: pagination ─────────────────────────────────────────────────────

test.describe('Enquiries page — pagination', () => {
  let token: string

  test.beforeAll(async () => {
    token = await getAdminToken()
    const ctx = await apiCtx(token)
    // 22 enquiries via the public contact endpoint (no auth needed)
    const pubCtx = await request.newContext()
    for (let i = 0; i < 22; i++) {
      await pubCtx.post(`${API}/api/contact`, {
        data: { name: `E2E Person ${i}`, email: `e2eperson${i}@example.com`, message: `Test msg ${i}` },
      })
    }
    await pubCtx.dispose()
    await ctx.dispose()
  })

  test('pagination row appears when > 20 enquiries', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/enquiries')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('button', { hasText: 'Next →' })).toBeVisible()
  })

  test('Prev disabled on page 1, Next navigates to page 2', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/enquiries')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('button', { hasText: '← Prev' })).toBeDisabled()
    await page.locator('button', { hasText: 'Next →' }).click()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=/Page 2 of/')).toBeVisible()
  })
})

// ── Newsletter: pagination ────────────────────────────────────────────────────

test.describe('Newsletter page — pagination', () => {
  test.beforeAll(async () => {
    const ctx = await request.newContext()
    for (let i = 0; i < 22; i++) {
      await ctx.post(`${API}/api/newsletter/subscribe`, {
        data: { email: `e2enl${i}@example.com` },
      })
    }
    await ctx.dispose()
  })

  test('pagination row appears when > 20 subscribers', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/newsletter')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('button', { hasText: 'Next →' })).toBeVisible()
  })

  test('Next navigates to page 2', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/newsletter')
    await page.waitForLoadState('networkidle')
    await page.locator('button', { hasText: 'Next →' }).click()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=/Page 2 of/')).toBeVisible()
  })

  test('toggling active-only filter resets to page 1', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/newsletter')
    await page.waitForLoadState('networkidle')
    await page.locator('button', { hasText: 'Next →' }).click()
    await page.waitForLoadState('networkidle')
    // Uncheck "Active only" — should reset page
    await page.locator('input[type="checkbox"]').click()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=/Page 1 of/')).toBeVisible()
  })
})

// ── Pages with no data: no pagination shown ───────────────────────────────────

test.describe('Pagination hidden when not needed', () => {
  test('no pagination on reviews page with < 20 reviews', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/reviews')
    await page.waitForLoadState('networkidle')
    // With a fresh/small DB the Pagination component should not render
    await expect(page.locator('button', { hasText: 'Next →' })).not.toBeVisible()
    await expect(page.locator('button', { hasText: '← Prev' })).not.toBeVisible()
  })
})

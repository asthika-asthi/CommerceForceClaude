/**
 * Regression coverage for the "Credit account not found" bug: a normal (B2C)
 * customer must never be offered the "Trade Credit Account" payment method —
 * it's a pre-approved business credit line an admin sets up per customer, not
 * a card, and clicking it with no account behind it produced a confusing 404.
 * B2B customers who do have one must still see and be able to use it.
 *
 * Prerequisites: backend on :8000 (admin@commerceforce.dev / Admin1234!),
 * storefront on :3000, a Stripe publishable key configured in branding (so
 * "Pay by Card" is expected to be present in every case here too).
 */
import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

const API = 'http://localhost:8000'
const ADMIN_EMAIL = 'admin@commerceforce.dev'
const ADMIN_PASSWORD = 'Admin1234!'
const STAMP = Date.now()
const PRODUCT_PATH = '/products/tonne-bag-extra-large-woven-polypropylene-slw-1000kg-4-corner-loops-single-use-only-85-x-85-x-85-cm-single-15-packsbox'

async function registerCustomer(request: APIRequestContext, email: string): Promise<{ token: string; userId: string }> {
  const res = await request.post(`${API}/api/auth/register`, {
    data: { email, password: 'Buyer1234!', first_name: 'Test', last_name: 'Buyer' },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const json = await res.json()
  return { token: json.access_token, userId: json.user.id }
}

async function addToCartAndGoToCheckoutAsUser(page: Page, token: string) {
  // Inject the token before any app code runs — matches how the real app reads
  // it from localStorage on mount, without going through the login form (which
  // is gated by email verification for a freshly registered user).
  await page.addInitScript((t: string) => {
    window.localStorage.setItem('cf_token', t)
  }, token)

  await page.goto(PRODUCT_PATH)
  await page.getByRole('button', { name: 'Essential only' }).click({ timeout: 3000 }).catch(() => {})
  await page.getByRole('button', { name: /Add to cart/i }).first().click()
  await page.waitForTimeout(500)

  await page.goto('/checkout')
  await page.waitForTimeout(1500)
}

test('B2C customer without a credit account never sees Trade Credit Account', async ({ page, request }) => {
  const email = `b2c-${STAMP}@example.com`
  const { token } = await registerCustomer(request, email)

  await addToCartAndGoToCheckoutAsUser(page, token)

  await expect(page.getByText('Cash on Delivery')).toBeVisible()
  await expect(page.getByText('Pay by Card')).toBeVisible()
  await expect(page.getByText('Trade Credit Account')).toHaveCount(0)
})

test('B2B customer with a credit account sees and can select Trade Credit Account', async ({ page, request }) => {
  const email = `b2b-${STAMP}@example.com`
  const { token, userId } = await registerCustomer(request, email)

  const loginRes = await request.post(`${API}/api/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  const adminToken = (await loginRes.json()).access_token

  const grantRes = await request.post(`${API}/api/credit/accounts`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { user_id: userId, credit_limit: 500 },
  })
  expect(grantRes.ok(), await grantRes.text()).toBeTruthy()

  try {
    await addToCartAndGoToCheckoutAsUser(page, token)

    await expect(page.getByText('Cash on Delivery')).toBeVisible()
    await expect(page.getByText('Pay by Card')).toBeVisible()
    const creditOption = page.getByText('Trade Credit Account')
    await expect(creditOption).toBeVisible()

    await creditOption.click()
    await expect(page.getByRole('button', { name: /Place order/i })).toBeEnabled()
  } finally {
    // Always clean up the credit account this test granted, pass or fail.
    await request.delete(`${API}/api/credit/accounts/${userId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
  }
})

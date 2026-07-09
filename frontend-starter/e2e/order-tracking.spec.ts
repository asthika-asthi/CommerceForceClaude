/**
 * Guest order tracking E2E — places a guest order via the API (checkout-form
 * automation is covered separately), then verifies the public tracking page
 * finds it with the right order number + email and rejects a wrong email.
 *
 * Prerequisites: backend on :8000, storefront on :3000, at least one product.
 */
import { test, expect } from '@playwright/test'

const API = 'http://localhost:8000'
const GUEST_EMAIL = `tracking-e2e-${Date.now()}@example.com`

test.describe('Guest order tracking', () => {
  test('a guest can look up their order by order number and email', async ({ page, request }) => {
    const products = await (await request.get(`${API}/api/products?page_size=1`)).json()
    const product = products?.items?.[0]
    test.skip(!product, 'no product available to check out')

    const checkout = await request.post(`${API}/api/checkout`, {
      data: {
        use_cart: false,
        items: [{ product_id: product.id, quantity: 1 }],
        payment_method: 'cash',
        guest_email: GUEST_EMAIL,
        shipping_address: '1 Test St, Testville',
      },
    })
    expect(checkout.ok()).toBeTruthy()
    const { order_number } = await checkout.json()

    await page.goto('/track-order')
    await page.getByPlaceholder('CF-20260101-ABC123').fill(order_number)
    await page.getByPlaceholder('you@example.com').fill(GUEST_EMAIL)
    await page.getByRole('button', { name: 'Track order' }).click()

    await expect(page.getByText(`Order ${order_number}`)).toBeVisible({ timeout: 10_000 })

    // A wrong email must show a generic not-found message, not the order.
    await page.getByPlaceholder('you@example.com').fill('someone-else@example.com')
    await page.getByRole('button', { name: 'Track order' }).click()
    await expect(page.getByText('No matching order found')).toBeVisible({ timeout: 10_000 })
  })
})

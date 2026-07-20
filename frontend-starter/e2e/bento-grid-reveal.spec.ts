import { test, expect } from '@playwright/test'

test('bento-grid cards reveal on scroll', async ({ page }) => {
  await page.goto('/dev/block-preview')
  const firstCard = page.getByTestId('bento-card').first()
  await expect(firstCard).toBeAttached()
  // Below the fold behind the 1.5-screen hero above it — not yet revealed
  await expect(firstCard).not.toHaveCSS('opacity', '1')
  await firstCard.scrollIntoViewIfNeeded()
  await expect(firstCard).toHaveCSS('opacity', '1', { timeout: 2000 })
})

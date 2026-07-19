import { test, expect } from '@playwright/test'

test('showcase-gallery items reveal on scroll', async ({ page }) => {
  await page.goto('/dev/block-preview')
  const firstItem = page.getByTestId('showcase-item').first()
  await expect(firstItem).not.toHaveCSS('opacity', '1')
  await firstItem.scrollIntoViewIfNeeded()
  await expect(firstItem).toHaveCSS('opacity', '1', { timeout: 2000 })
})

test('zoomable gallery: tap opens the lightbox, Escape closes it', async ({ page }) => {
  await page.goto('/dev/block-preview')
  const openButton = page.getByRole('button', { name: 'Open Item One full size' })
  await openButton.scrollIntoViewIfNeeded()
  await openButton.click()
  const overlay = page.getByTestId('zoom-overlay')
  await expect(overlay).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(overlay).not.toBeVisible()
})

test('zoomable gallery: close button and outside-click both dismiss it', async ({ page }) => {
  await page.goto('/dev/block-preview')
  const openButton = page.getByRole('button', { name: 'Open Item One full size' })
  await openButton.scrollIntoViewIfNeeded()

  await openButton.click()
  await expect(page.getByTestId('zoom-overlay')).toBeVisible()
  await page.getByTestId('zoom-close').click()
  await expect(page.getByTestId('zoom-overlay')).not.toBeVisible()

  await openButton.click()
  const overlay = page.getByTestId('zoom-overlay')
  await expect(overlay).toBeVisible()
  await overlay.click({ position: { x: 5, y: 5 } })
  await expect(overlay).not.toBeVisible()
})

test('zoomable gallery: clicking the enlarged image itself does not close it', async ({ page }) => {
  await page.goto('/dev/block-preview')
  const openButton = page.getByRole('button', { name: 'Open Item One full size' })
  await openButton.scrollIntoViewIfNeeded()
  await openButton.click()

  const overlay = page.getByTestId('zoom-overlay')
  await expect(overlay).toBeVisible()
  await overlay.locator('img').click()
  await expect(overlay).toBeVisible()
})

test('desktop wheel-zoom scales the zoomed image', async ({ page }) => {
  await page.goto('/dev/block-preview')
  const openButton = page.getByRole('button', { name: 'Open Item One full size' })
  await openButton.scrollIntoViewIfNeeded()
  await openButton.click()

  const container = page.getByTestId('pinch-zoom-container')
  await expect(container).toHaveAttribute('data-scale', '1.00')
  await container.hover()
  await page.mouse.wheel(0, -300)
  await expect(container).not.toHaveAttribute('data-scale', '1.00')
})

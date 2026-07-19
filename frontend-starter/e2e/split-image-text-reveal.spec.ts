import { test, expect } from '@playwright/test'

test('split-image-text panels reveal independently on scroll', async ({ page }) => {
  await page.goto('/dev/block-preview')
  const imagePanel = page.getByTestId('split-image-panel')
  const textPanel = page.getByTestId('split-text-panel')
  await expect(imagePanel).not.toHaveCSS('opacity', '1')
  await expect(textPanel).not.toHaveCSS('opacity', '1')
  await imagePanel.scrollIntoViewIfNeeded()
  await expect(imagePanel).toHaveCSS('opacity', '1', { timeout: 2000 })
  await expect(textPanel).toHaveCSS('opacity', '1', { timeout: 2000 })
})

// On desktop the two panels sit side-by-side and always enter the viewport
// together, so the test above can't tell independent triggers apart from a
// single shared one. Only the stacked mobile layout (grid-cols-1) can expose
// that regression, since there the text panel sits a full panel-height below
// the image panel.
test('split-image-text panels reveal independently on scroll (mobile stacked layout)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dev/block-preview')
  const imagePanel = page.getByTestId('split-image-panel')
  const textPanel = page.getByTestId('split-text-panel')
  await expect(imagePanel).not.toHaveCSS('opacity', '1')
  await expect(textPanel).not.toHaveCSS('opacity', '1')

  await imagePanel.scrollIntoViewIfNeeded()
  await expect(imagePanel).toHaveCSS('opacity', '1', { timeout: 2000 })
  await expect(textPanel).not.toHaveCSS('opacity', '1')

  await textPanel.scrollIntoViewIfNeeded()
  await expect(textPanel).toHaveCSS('opacity', '1', { timeout: 2000 })
})

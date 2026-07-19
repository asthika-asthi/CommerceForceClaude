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

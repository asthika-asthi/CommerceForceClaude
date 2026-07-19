import { test, expect } from '@playwright/test'

test('restyled placeholder blocks render their content', async ({ page }) => {
  await page.goto('/dev/block-preview')

  const navbar = page.getByTestId('preview-navbar')
  await expect(navbar.getByText('Preview Store')).toBeVisible()
  await expect(navbar.getByText('Register')).toBeVisible()

  const menu = page.getByTestId('preview-menu')
  await expect(menu.getByText('Quick Links')).toBeVisible()
  await expect(menu.getByText('Products')).toBeVisible()

  const footer = page.getByTestId('preview-footer')
  await expect(footer.getByText('Preview Store')).toBeVisible()
  await expect(footer.getByText('© 2026 Preview')).toBeVisible()
})

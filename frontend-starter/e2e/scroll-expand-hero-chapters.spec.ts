import { test, expect } from '@playwright/test'

test('scroll-expand-hero without chapters keeps its original single-stage caption', async ({ page }) => {
  await page.goto('/dev/block-preview')
  const heading = page.getByTestId('preview-scroll-expand-hero').locator('h1')
  await expect(heading).toHaveText('Preview Hero')
})

test('chaptered scroll-expand-hero swaps captions as the section scrolls', async ({ page }) => {
  await page.goto('/dev/block-preview')
  const chapterSection = page.getByTestId('preview-scroll-expand-hero-chapters')
  const caption = chapterSection.getByTestId('chapter-caption').locator('h1')
  await expect(caption).toHaveText('Chapter One')

  // Scroll to the midpoint of this section's pinned range to reach a later chapter
  await chapterSection.evaluate((el) => {
    const rect = el.getBoundingClientRect()
    window.scrollTo(0, window.scrollY + rect.top + rect.height * 0.5)
  })
  await expect(caption).not.toHaveText('Chapter One', { timeout: 2000 })
})

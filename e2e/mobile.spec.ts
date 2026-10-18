import { test, expect } from '@playwright/test'

test('mobile : barre d\'onglets en bas, pas de défilement horizontal, compteur tactile', async ({ page }) => {
  await page.goto('./')
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  expect(await overflow()).toBe(false)
  await page.locator('.card', { hasText: 'Souris' }).getByRole('link').click()
  const box = await page.getByRole('tablist').boundingBox()
  expect(box && box.y + box.height).toBeGreaterThan((page.viewportSize()?.height ?? 0) - 2)
  for (const t of ['Patron', 'Compteur', 'Rangs', '3D']) {
    await page.getByRole('tab', { name: t }).click()
    expect(await overflow(), t).toBe(false)
  }
  await page.getByRole('tab', { name: 'Rangs' }).click()
  await expect(page.locator('.selection-bar')).toBeVisible()
  await page.getByRole('tab', { name: 'Compteur' }).click()
  await page.locator('.counter-big').tap()
  await expect(page.locator('.counter-value')).toHaveText('1')
})

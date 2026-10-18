import { test, expect } from '@playwright/test'

test('mobile : pas de défilement horizontal, compteur utilisable', async ({ page }) => {
  await page.goto('./')
  await page.click('.card:has-text("Souris")')
  for (const tab of ['📄 Patron', '🔢 Compteur', '📊 Rangs', '🧶 Aperçu 3D']) {
    await page.click(`text=${tab}`)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflow, tab).toBe(false)
  }
  await page.click('text=🔢 Compteur')
  await page.locator('.counter-big').tap()
  await expect(page.locator('.counter-value')).toHaveText('1')
})

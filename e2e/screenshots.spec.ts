import { test, expect, type Page } from '@playwright/test'

// Comparaison visuelle des rendus (tissu 2D et aperçu 3D) avec des images de référence.
// Après un changement voulu des rendus : npx playwright test screenshots --update-snapshots
test.use({ viewport: { width: 1100, height: 900 }, contextOptions: { reducedMotion: 'reduce' } })

const openMouse = async (page: Page) => {
  await page.goto('./')
  await page.locator('.card', { hasText: 'Souris' }).getByRole('link').click()
}

test('rendu tissu de la souris', async ({ page }) => {
  await openMouse(page)
  await page.getByRole('tab', { name: 'Rangs' }).click()
  const canvas = page.locator('canvas.fabric-canvas').first()
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveScreenshot('fabric-souris.png', { maxDiffPixelRatio: 0.01 })
})

test('aperçu 3D de la souris assemblée', async ({ page }) => {
  await openMouse(page)
  await page.getByRole('tab', { name: '3D' }).click()
  const canvas = page.locator('canvas.viewer3d-canvas')
  await expect(canvas).toBeVisible({ timeout: 15_000 })
  // le rendu WebGL logiciel varie légèrement d'une machine à l'autre : tolérance plus large
  await expect(canvas).toHaveScreenshot('model3d-souris.png', { maxDiffPixelRatio: 0.03, threshold: 0.3, timeout: 20_000 })
})

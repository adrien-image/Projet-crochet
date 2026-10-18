import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.errors = errors
  await page.goto('./')
  await expect(page.locator('.card')).toHaveCount(2)
})

test.afterEach(async ({ page }) => {
  expect(page.errors).toEqual([])
})

test('collection : exemples, tags, tri et recherche', async ({ page }) => {
  await expect(page.locator('.card:has-text("Souris") .progress-label')).toContainText('7/30 rangs')
  await page.click('.tag-chip:has-text("cœur")')
  await expect(page.locator('.card')).toHaveCount(1)
  await page.click('.tag-chip:has-text("cœur")')
  await page.selectOption('.sort-select', 'name')
  await expect(page.locator('.card-title').first()).toContainText('Coussin')
  await page.fill('.search', 'souris')
  await expect(page.locator('.card')).toHaveCount(1)
})

test('compteur de rangs : mailles, rang terminé, annulation', async ({ page }) => {
  await page.click('.card:has-text("Souris")')
  await page.click('text=🔢 Compteur')
  await expect(page.locator('.counter-title strong')).toHaveText('R8')
  await page.click('.counter-big')
  await page.click('.counter-big')
  await expect(page.locator('.counter-value')).toHaveText('2')
  await page.click('.counter-done')
  await expect(page.locator('.counter-title strong')).toHaveText('R9')
  await expect(page.locator('.counter-value')).toHaveText('0')
  await expect(page.locator('.counter-progress')).toContainText('8/30')
  await page.click('text=↶ Annuler le dernier rang')
  await expect(page.locator('.counter-progress')).toContainText('7/30')
  // la progression est conservée après rechargement
  await page.click('.counter-done')
  await page.reload()
  await page.click('text=🔢 Compteur')
  await expect(page.locator('.counter-progress')).toContainText('8/30')
})

test('visualiseur : rangs groupés, « terminé jusqu\'ici », export SVG', async ({ page }) => {
  await page.click('.card:has-text("Souris")')
  await page.click('text=📊 Rangs')
  await expect(page.locator('.round-card')).toHaveCount(30)
  await expect(page.locator('.viz-summary')).toContainText('2 pièces')
  await page.locator('.round-card').nth(9).click()
  await page.click('text=Terminé jusqu')
  await expect(page.locator('.viz-summary')).toContainText('10/30 faits')
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('text=⬇ SVG')])
  expect(download.suggestedFilename()).toMatch(/\.svg$/)
})

test('aperçu 3D : rendu et légende des pièces', async ({ page }) => {
  await page.click('.card:has-text("Souris")')
  await page.click('text=🧶 Aperçu 3D')
  await expect(page.locator('.pieces-legend')).toContainText('MUSEAU + CORPS')
  await expect(page.locator('.pieces-legend')).toContainText('OREILLES ×2')
  // le canvas n'est pas vide
  const filled = await page.locator('canvas.canvas-3d').evaluate((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    let n = 0
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++
    return n
  })
  expect(filled).toBeGreaterThan(1000)
})

test('création : texte, tailles, image, puis suppression annulable', async ({ page }) => {
  await page.click('text=+ Nouveau patron')
  await page.fill('#f-name', 'Écharpe')
  await page.fill('#f-hook', '5 mm')
  await page.fill('#f-text', 'ÉCHARPE\nRow 1: 20 (24, 28) sc, ch 1, turn (20, 24, 28)\nRows 2-6: sc across, ch 1, turn (20, 24, 28)')
  await expect(page.locator('.field .hint')).toContainText('6 rangs')
  await page.selectOption('#f-size', '1')
  await page.click('text=Enregistrer')
  await expect(page.locator('.detail h2')).toHaveText('Écharpe')
  await expect(page).toHaveURL(/#\/patron\//)
  await page.click('text=📊 Rangs')
  await expect(page.locator('.round-card').first()).toContainText('24 m.')
  await page.click('.detail-actions >> text=Supprimer')
  await expect(page.locator('.card')).toHaveCount(2)
  await page.click('.toast-action')
  await expect(page.locator('.card')).toHaveCount(3)
})

test('checklist : ajout, modification, réordonnancement', async ({ page }) => {
  await page.click('.card:has-text("Coussin")')
  await page.fill('.add-row input', 'Broder un prénom')
  await page.click('.add-row button')
  const last = page.locator('.check-item').last()
  await expect(last).toContainText('Broder un prénom')
  await last.locator('button[aria-label="Monter"]').click()
  await expect(page.locator('.check-item').nth(2)).toContainText('Broder un prénom')
  await page.locator('.check-item').nth(2).locator('button[aria-label^="Modifier"]').click()
  await page.fill('.edit-row input', 'Broder « Léa »')
  await page.press('.edit-row input', 'Enter')
  await expect(page.locator('.check-item').nth(2)).toContainText('Broder « Léa »')
})

test('sauvegarde : export puis import', async ({ page }) => {
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('text=⬇ Exporter')])
  const path = await download.path()
  await page.setInputFiles('input[type=file][accept*=json]', path)
  await expect(page.locator('.card')).toHaveCount(4)
})

test('hors connexion après une première visite', async ({ page, context }) => {
  await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 10_000 }).catch(() => {})
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.card')).toHaveCount(2)
  await context.setOffline(false)
})

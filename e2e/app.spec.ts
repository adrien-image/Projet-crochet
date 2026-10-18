import { test, expect, type Page } from '@playwright/test'

const errors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const list: string[] = []
  errors.set(page, list)
  page.on('pageerror', (e) => list.push(e.message))
  await page.goto('./')
  await expect(page.locator('.card')).toHaveCount(3)
})

test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([])
})

const openMouse = (page: Page) => page.locator('.card', { hasText: 'Souris' }).getByRole('link').click()

test('bibliothèque : filtres, tags, tri, recherche', async ({ page }) => {
  await expect(page.locator('.card', { hasText: 'Souris' }).locator('.card-progress')).toContainText('7/30 rangs')
  await page.getByRole('radio', { name: /En cours/ }).click()
  await expect(page.locator('.card')).toHaveCount(1)
  await page.getByRole('radio', { name: /Tous/ }).click()
  await page.locator('.tag-bar').getByRole('button', { name: /cœur/ }).click()
  await expect(page.locator('.card')).toHaveCount(1)
  await page.locator('.tag-bar').getByRole('button', { name: /cœur/ }).click()
  await page.getByLabel('Trier').selectOption('name')
  await expect(page.locator('.card-title').first()).toContainText('Abeille')
  await page.getByLabel('Rechercher').fill('souris')
  await expect(page.locator('.card')).toHaveCount(1)
})

test('patron : cocher un rang dans le texte, onglets dans l\'URL', async ({ page }) => {
  await openMouse(page)
  await expect(page).toHaveURL(/#\/patron\/[^/]+$/)
  const r8 = page.locator('.ins-round', { hasText: 'R8 :' })
  await expect(r8).toHaveClass(/current/)
  await r8.click()
  await expect(r8).toHaveClass(/done/)
  await expect(page.locator('.ins-round', { hasText: 'R9 :' })).toHaveClass(/current/)
  await page.getByRole('tab', { name: 'Rangs' }).click()
  await expect(page).toHaveURL(/\/rangs$/)
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Rangs' })).toHaveAttribute('aria-selected', 'true')
  await page.goBack()
  await expect(page.locator('.card')).toHaveCount(3)
})

test('compteur : mailles, rang terminé, annulation, persistance', async ({ page }) => {
  await openMouse(page)
  await page.getByRole('tab', { name: 'Compteur' }).click()
  await expect(page.locator('.counter-title strong')).toHaveText('R8')
  await page.locator('.counter-big').click()
  await page.locator('.counter-big').click()
  await expect(page.locator('.counter-value')).toHaveText('2')
  await page.getByRole('button', { name: /Rang terminé/ }).click()
  await expect(page.locator('.counter-title strong')).toHaveText('R9')
  await expect(page.locator('.counter-value')).toHaveText('0')
  await expect(page.locator('.counter-progress')).toContainText('8 / 30')
  await page.getByRole('button', { name: /Annuler le dernier rang/ }).click()
  await expect(page.locator('.counter-progress')).toContainText('7 / 30')
  await page.getByRole('button', { name: /Rang terminé/ }).click()
  await page.reload()
  await expect(page.locator('.counter-progress')).toContainText('8 / 30')
})

test('rangs : rendu tissu, diagramme, sélection, export SVG', async ({ page }) => {
  await openMouse(page)
  await page.getByRole('tab', { name: 'Rangs' }).click()
  await expect(page.locator('canvas.fabric-canvas')).toHaveCount(2)
  // le tissu est réellement dessiné
  const painted = await page.locator('canvas.fabric-canvas').first().evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
    let n = 0
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++
    return n
  })
  expect(painted).toBeGreaterThan(5000)
  await page.getByRole('radio', { name: 'Diagramme' }).click()
  await expect(page.locator('.chart-card')).toHaveCount(30)
  await page.locator('.chart-card').nth(9).click()
  await page.getByRole('button', { name: /Terminé jusqu'ici/ }).click()
  await expect(page.locator('.toolbar')).toContainText('10 faits')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'SVG' }).click()])
  expect(download.suggestedFilename()).toMatch(/\.svg$/)
})

test('3D : rendu WebGL, pièces, construction, couleurs', async ({ page }) => {
  await openMouse(page)
  await page.getByRole('tab', { name: '3D' }).click()
  const canvas = page.locator('canvas.viewer3d-canvas')
  await expect(canvas).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.legend3d')).toContainText('MUSEAU + CORPS')
  await expect(page.locator('.legend3d')).toContainText('OREILLES × 2')
  await expect(page.locator('.legend3d')).toContainText('QUEUE')
  await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => {
    const probe = document.createElement('canvas')
    probe.width = c.width
    probe.height = c.height
    const ctx = probe.getContext('2d')!
    ctx.drawImage(c, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let n = 0
    for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++
    return n
  }), { timeout: 10_000 }).toBeGreaterThan(2000)
  await page.getByLabel('Construction').fill('5')
  await expect(page.locator('.stage-badge')).toContainText('Après R5')
  await page.getByRole('button', { name: 'Pièce finie' }).click()
  await expect(page.locator('.stage-badge')).toHaveCount(0)
  await page.locator('.color-chip', { hasText: 'OREILLES' }).locator('input').fill('#e99aae')
  await expect(page.getByRole('button', { name: 'Couleurs du patron' })).toBeVisible()
})

test('création : formulaire, tailles, suppression annulable', async ({ page }) => {
  await page.getByRole('button', { name: /Nouveau patron/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nom').fill('Écharpe')
  await dialog.getByLabel('Crochet').fill('5 mm')
  await dialog.getByLabel('Texte du patron').fill('ÉCHARPE\nRow 1: 20 (24, 28) sc, ch 1, turn (20, 24, 28)\nRows 2-6: sc across, ch 1, turn (20, 24, 28)')
  await expect(dialog.locator('.analysis')).toContainText('6 rangs')
  await dialog.getByLabel('Taille réalisée').selectOption('1')
  await dialog.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.locator('.pattern-hero h1')).toHaveText('Écharpe')
  await page.getByRole('tab', { name: 'Rangs' }).click()
  await page.getByRole('radio', { name: 'Diagramme' }).click()
  await expect(page.locator('.chart-card').first()).toContainText('24 m.')
  await page.getByRole('button', { name: "Plus d'actions" }).click()
  await page.getByRole('menuitem', { name: 'Supprimer le patron' }).click()
  await expect(page.locator('.card')).toHaveCount(3)
  await page.getByRole('button', { name: 'Annuler' }).click()
  await expect(page.locator('.card')).toHaveCount(4)
})

test('étapes : ajout, modification, réordonnancement', async ({ page }) => {
  await page.locator('.card', { hasText: 'Coussin' }).getByRole('link').click()
  await page.getByLabel('Nouvelle étape').fill('Broder un prénom')
  await page.getByRole('button', { name: "Ajouter l'étape" }).click()
  const items = page.locator('.check-item')
  await expect(items.last()).toContainText('Broder un prénom')
  await items.last().hover()
  await items.last().getByRole('button', { name: 'Monter' }).click()
  await expect(items.nth(2)).toContainText('Broder un prénom')
  await items.nth(2).hover()
  await items.nth(2).getByRole('button', { name: /Modifier l'étape/ }).click()
  await page.getByRole('textbox', { name: "Modifier l'étape", exact: true }).fill('Broder « Léa »')
  await page.getByRole('textbox', { name: "Modifier l'étape", exact: true }).press('Enter')
  await expect(items.nth(2)).toContainText('Broder « Léa »')
})

test('sauvegarde : export puis import', async ({ page }) => {
  await page.getByRole('button', { name: 'Sauvegarde et options' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /Exporter/ }).click()])
  const path = await download.path()
  await page.locator('input[type=file][accept*=json]').setInputFiles(path)
  await expect(page.locator('.card')).toHaveCount(6)
})

test('hors connexion après une première visite', async ({ page, context }) => {
  await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 10_000 }).catch(() => {})
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.card')).toHaveCount(3)
  await context.setOffline(false)
})

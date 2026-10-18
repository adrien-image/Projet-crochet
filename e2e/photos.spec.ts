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

// petites images PNG valides (2×2), de couleurs différentes
const png = (page: Page, colors: string[]) => page.evaluate((list) => Promise.all(list.map((c) => new Promise<number[]>((resolve) => {
  const canvas = document.createElement('canvas')
  canvas.width = 40
  canvas.height = 30
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = c
  ctx.fillRect(0, 0, 40, 30)
  canvas.toBlob(async (b) => resolve([...new Uint8Array(await b!.arrayBuffer())]), 'image/png')
}))), colors).then((all) => all.map((bytes, i) => ({ name: `photo-${i + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(bytes) })))

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('crochet.patterns.v1') ?? '[]'))
const mouse = async (page: Page) => (await stored(page)).find((p: { name: string }) => p.name.startsWith('Souris'))

test('photos : plusieurs photos ajoutées, couverture, visionneuse, persistance', async ({ page }) => {
  await page.locator('.card', { hasText: 'Souris' }).getByRole('link').click()
  await page.locator('.photo input[type=file]').setInputFiles(await png(page, ['#d33', '#3a3', '#33d']))
  const thumbs = page.locator('.photo-strip button.photo-thumb')
  await expect(thumbs).toHaveCount(3)
  // on affiche la première des photos ajoutées
  await expect(page.locator('.photo-count')).toHaveText('1 / 3')
  await expect.poll(async () => (await mouse(page)).gallery.length).toBe(2)
  await thumbs.nth(1).click()
  await expect(page.locator('.photo-count')).toHaveText('2 / 3')

  // visionneuse : navigation, couverture, suppression
  await page.getByRole('button', { name: 'Agrandir la photo' }).click()
  const viewer = page.getByRole('dialog', { name: 'Photo 2 sur 3' })
  await expect(viewer.locator('.lightbox img')).toHaveAttribute('src', /^blob:/)
  await viewer.getByRole('button', { name: 'Photo suivante' }).click()
  await expect(page.getByRole('dialog', { name: 'Photo 3 sur 3' })).toBeVisible()
  const cover3 = (await mouse(page)).gallery[1].id
  await page.getByRole('dialog').getByRole('button', { name: 'Mettre en couverture' }).click()
  await expect(page.getByRole('dialog', { name: 'Photo 1 sur 3' })).toBeVisible()
  await expect.poll(async () => (await mouse(page)).imageId).toBe(cover3)
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByRole('dialog', { name: 'Photo 1 sur 2' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(thumbs).toHaveCount(2)

  await page.reload()
  await expect(page.locator('.photo-strip button.photo-thumb')).toHaveCount(2)
  await page.getByRole('button', { name: 'Bibliothèque' }).click()
  await expect(page.locator('.card', { hasText: 'Souris' }).locator('.card-cover img')).toBeVisible()
})

test('photos : sauvegarde exportée puis réimportée avec toutes les photos', async ({ page }) => {
  await page.locator('.card', { hasText: 'Souris' }).getByRole('link').click()
  await page.locator('.photo input[type=file]').setInputFiles(await png(page, ['#d33', '#3a3']))
  await expect(page.locator('.photo-strip button.photo-thumb')).toHaveCount(2)
  await page.getByRole('button', { name: 'Bibliothèque' }).click()
  await page.getByRole('button', { name: 'Sauvegarde et options' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /Exporter/ }).click()])
  await page.locator('input[type=file][accept*=json]').setInputFiles(await download.path())
  await expect(page.locator('.card')).toHaveCount(6)
  // la copie importée a ses photos migrées vers IndexedDB
  await expect.poll(async () => (await stored(page)).filter((p: { name: string, gallery: { id: string, data?: string }[] }) =>
    p.name.startsWith('Souris') && p.gallery.length === 1 && p.gallery[0].id && !p.gallery[0].data).length).toBe(2)
})

test('photos : formulaire, plusieurs photos, couverture, retrait', async ({ page }) => {
  await page.getByRole('button', { name: /Nouveau patron/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nom').fill('Avec photos')
  await dialog.locator('.form-photos input[type=file]').setInputFiles(await png(page, ['#d33', '#3a3', '#33d']))
  const tiles = dialog.locator('.form-photo:not(.add)')
  await expect(tiles).toHaveCount(3)
  await expect(tiles.first()).toContainText('Couverture')
  await dialog.getByRole('button', { name: 'Mettre la photo 3 en couverture' }).click()
  await dialog.getByRole('button', { name: 'Retirer la photo 2' }).click()
  await expect(tiles).toHaveCount(2)
  await dialog.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.locator('.pattern-hero h1')).toHaveText('Avec photos')
  await expect(page.locator('.photo-strip button.photo-thumb')).toHaveCount(2)
  await expect.poll(async () => {
    const saved = (await stored(page)).find((p: { name: string }) => p.name === 'Avec photos')
    return saved ? [!!saved.imageId, saved.gallery.length] : null
  }).toEqual([true, 1])
})

test('duplication : copie à zéro depuis le patron, copie en cours depuis la bibliothèque', async ({ page }) => {
  await page.locator('.card', { hasText: 'Souris' }).getByRole('link').click()
  await page.getByRole('button', { name: "Plus d'actions" }).click()
  await page.getByRole('menuitem', { name: 'Dupliquer le patron…' }).click()
  let dialog = page.getByRole('dialog', { name: 'Dupliquer le patron' })
  await expect(dialog.getByLabel('Nom de la copie')).toHaveValue('Souris amigurumi (patron original) (copie)')
  await expect(dialog.getByRole('radio', { name: /Repartir de zéro/ })).toBeChecked()
  await dialog.getByLabel('Nom de la copie').fill('Souris n° 2')
  await dialog.getByRole('button', { name: 'Dupliquer', exact: true }).click()
  await expect(page.locator('.pattern-hero h1')).toHaveText('Souris n° 2')
  await expect(page.locator('.ins-round.done')).toHaveCount(0)
  await expect(page.locator('.toast')).toContainText('Copie créée')

  await page.getByRole('button', { name: 'Bibliothèque' }).click()
  await expect(page.locator('.card')).toHaveCount(4)
  await page.locator('.card', { hasText: 'Souris amigurumi' }).getByRole('button', { name: /Actions pour/ }).click()
  await page.getByRole('menuitem', { name: 'Dupliquer…' }).click()
  dialog = page.getByRole('dialog', { name: 'Dupliquer le patron' })
  await dialog.getByRole('radio', { name: /Garder la progression/ }).check()
  await expect(dialog).toContainText('7/30 rangs')
  await dialog.getByRole('button', { name: 'Dupliquer', exact: true }).click()
  await expect(page.locator('.ins-round.done')).toHaveCount(7)
  await page.getByRole('button', { name: 'Bibliothèque' }).click()
  await expect(page.locator('.card')).toHaveCount(5)
  await expect(page.locator('.card', { hasText: '(copie)' }).locator('.card-progress')).toContainText('7/30 rangs')
})

test('duplication : un patron non commencé ne propose que la copie à zéro', async ({ page }) => {
  await page.locator('.card', { hasText: 'Coussin' }).getByRole('button', { name: /Actions pour/ }).click()
  await page.getByRole('menuitem', { name: 'Dupliquer…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Dupliquer le patron' })
  await expect(dialog.getByRole('radio', { name: /Garder la progression/ })).toBeDisabled()
  await expect(dialog).toContainText('pas encore commencé')
})

test('exemple multicolore : rayures et trois fils', async ({ page }) => {
  await page.locator('.card', { hasText: 'Abeille' }).getByRole('link').click()
  await expect(page.locator('.panel', { hasText: 'Fil nécessaire' }).locator('.yarn-list li')).toHaveCount(3)
  await expect(page.locator('.ins-round', { hasText: 'R9-R10' }).locator('.dot')).toBeVisible()
  await page.getByRole('tab', { name: '3D' }).click()
  await expect(page.locator('canvas.viewer3d-canvas')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.legend3d')).toContainText('AILES × 2')
})

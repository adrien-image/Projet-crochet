import { test, expect, type Page } from '@playwright/test'

const errors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const list: string[] = []
  errors.set(page, list)
  page.on('pageerror', (e) => list.push(e.message))
})

test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([])
})

const home = async (page: Page) => {
  await page.goto('./')
  await expect(page.locator('.card')).toHaveCount(2)
}
const openMouse = (page: Page) => page.locator('.card', { hasText: 'Souris' }).getByRole('link').click()
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('crochet.patterns.v1') ?? '[]'))

/** Petit PDF texte (une police standard, un flux de contenu) construit à la main. */
function makePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/([()\\])/g, '\\$1')
  const content = `BT /F1 12 Tf 50 800 Td 16 TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]
  let out = '%PDF-1.4\n'
  const offsets = objects.map((o, i) => {
    const at = out.length
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
    return at
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

test('chronomètre : lancé, affiché dans la bibliothèque, temps cumulé', async ({ page }) => {
  await page.clock.install()
  await home(page)
  await openMouse(page)
  const timer = page.locator('.appbar-actions .btn[aria-pressed]')
  await timer.click()
  await expect(timer).toHaveAttribute('aria-pressed', 'true')
  await page.clock.runFor(125_000)
  await expect(timer).toContainText('2 min')
  await page.getByRole('button', { name: 'Bibliothèque' }).click()
  await expect(page.locator('.card', { hasText: 'Souris' }).locator('.badge.timer')).toBeVisible()
  await openMouse(page)
  await timer.click()
  await expect(timer).toHaveAttribute('aria-pressed', 'false')
  // l'enregistrement est différé : on laisse passer le délai
  await page.clock.runFor(2000)
  const [mouse] = (await stored(page)).filter((p: { name: string }) => p.name.includes('Souris'))
  expect(mouse.timeSpent).toBeGreaterThanOrEqual(125)
  expect(mouse.sessions.length).toBe(1)
})

test('notes de rang : saisie, persistance, repère dans le texte', async ({ page }) => {
  await home(page)
  await openMouse(page)
  await page.getByRole('tab', { name: 'Rangs' }).click()
  const note = page.locator('.round-detail').getByRole('textbox', { name: /Note pour R8/ })
  await note.fill('Marqueur posé au début du rang')
  await note.blur()
  await page.reload()
  await expect(page.locator('.round-detail').getByRole('textbox', { name: /Note pour R8/ })).toHaveValue('Marqueur posé au début du rang')
  await page.getByRole('tab', { name: 'Compteur' }).click()
  await expect(page.getByRole('textbox', { name: /Note pour R8/ })).toHaveValue('Marqueur posé au début du rang')
  await page.getByRole('tab', { name: 'Patron' }).click()
  await expect(page.locator('.ins-round', { hasText: 'R8 :' }).locator('.note-mark')).toBeVisible()
})

test('partage : lien copié puis ouvert, copie ajoutée sans la progression', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await home(page)
  await openMouse(page)
  await page.getByRole('button', { name: "Plus d'actions" }).click()
  await page.getByRole('menuitem', { name: 'Copier le lien de partage' }).click()
  await expect(page.locator('.toast')).toContainText('Lien copié')
  const url = await page.evaluate(() => navigator.clipboard.readText())
  expect(url).toMatch(/#\/partage\/[zj][A-Za-z0-9_-]+$/)
  await page.goto('about:blank')
  await page.goto(url)
  const dialog = page.getByRole('dialog', { name: 'Patron partagé' })
  await expect(dialog).toContainText('Souris')
  await expect(dialog).toContainText('30 rangs')
  await dialog.getByRole('button', { name: 'Ajouter à ma bibliothèque' }).click()
  await expect(page.locator('.pattern-hero h1')).toContainText('Souris')
  await expect(page.locator('.ins-round.done')).toHaveCount(0)
  expect(page.url()).not.toContain('partage')
  await page.goto('./')
  await expect(page.locator('.card')).toHaveCount(3)
})

test('partage : lien abîmé', async ({ page }) => {
  await page.goto('./#/partage/zpasunvraicode')
  await expect(page.locator('.toast')).toContainText('invalide')
})

test('langue : interface en anglais, conservée au rechargement', async ({ page }) => {
  await home(page)
  await page.getByRole('button', { name: 'Sauvegarde et options' }).click()
  await page.getByRole('menuitem', { name: 'English' }).click()
  await expect(page.getByRole('heading', { name: 'My patterns' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'My patterns' })).toBeVisible()
  await openMouse(page)
  await expect(page.getByRole('tab', { name: 'Rounds' })).toBeVisible()
  await page.getByRole('tab', { name: 'Counter' }).click()
  await expect(page.getByRole('button', { name: /Round done/ })).toBeVisible()
})

test('langue : un navigateur anglophone reçoit l\'interface en anglais', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-GB' })
  const page = await context.newPage()
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'My patterns' })).toBeVisible()
  await context.close()
})

test('rappel de sauvegarde : affiché après une semaine sans export, reporté', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('crochet.settings.v1')) return
    localStorage.setItem('crochet.settings.v1', JSON.stringify({ firstUseAt: new Date(Date.now() - 30 * 86400e3).toISOString() }))
  })
  await home(page)
  const banner = page.locator('.banner')
  await expect(banner).toContainText('Pensez à sauvegarder')
  await banner.getByRole('button', { name: 'Plus tard' }).click()
  await expect(banner).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.card')).toHaveCount(2)
  await expect(banner).toHaveCount(0)
})

test('stockage : état et espace utilisé', async ({ page }) => {
  await home(page)
  await page.getByRole('button', { name: 'Sauvegarde et options' }).click()
  await page.getByRole('menuitem', { name: 'Stockage et sécurité des données' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('.storage-state')).toBeVisible()
  await expect(dialog).toContainText('Espace utilisé')
  await dialog.locator('.btn.primary', { hasText: 'Fermer' }).click()
  await expect(dialog).toHaveCount(0)
})

test('couleurs par rang et estimation du fil', async ({ page }) => {
  await home(page)
  await page.getByRole('button', { name: /Nouveau patron/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nom').fill('Balle rayée')
  await dialog.getByLabel('Crochet').fill('3 mm')
  await dialog.getByLabel('Fil').fill('coton blanc')
  await dialog.getByLabel('Texte du patron').fill('BALLE\nR1 : 6 ms dans un anneau magique (6)\nR2 : aug dans chaque maille (12)\nR3 : *1 ms, aug* x6 en rose (18)\nR4 : 18 ms (18)\nChanger pour le fil blanc.\nR5 : 18 ms (18)')
  await dialog.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.locator('.pattern-hero h1')).toHaveText('Balle rayée')
  const yarn = page.locator('.panel', { hasText: 'Fil nécessaire' })
  await expect(yarn.locator('.yarn-total')).toContainText('m')
  await expect(yarn.locator('.yarn-list li')).toHaveCount(2)
  await expect(yarn).toContainText('crochet de 3 mm')
  await expect(page.locator('.ins-round', { hasText: 'R3 :' }).locator('.dot')).toBeVisible()
})

test('PDF : le texte d\'un PDF joint remplit le patron', async ({ page }) => {
  await home(page)
  await page.getByRole('button', { name: /Nouveau patron/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nom').fill('Depuis un PDF')
  await dialog.locator('input[type=file][accept*=pdf]').setInputFiles({
    name: 'patron.pdf', mimeType: 'application/pdf',
    buffer: makePdf(['TETE', 'R1 : 6 ms dans un anneau magique (6)', 'R2 : aug dans chaque maille (12)', '3', 'R3 : *1 ms, aug* x6 (18)']),
  })
  await expect(dialog.getByRole('status')).toContainText('3 rangs reconnus', { timeout: 15_000 })
  await expect(dialog.getByLabel('Texte du patron')).toHaveValue(/R2 : aug dans chaque maille \(12\)/)
  await expect(dialog.getByLabel('Texte du patron')).not.toHaveValue(/^3$/m)
  await expect(dialog.getByRole('button', { name: 'Extraire le texte' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.locator('.ins-round')).toHaveCount(3)
})

test('3D : placement manuel d\'une oreille, symétrique, réinitialisation', async ({ page }) => {
  await home(page)
  await openMouse(page)
  await page.getByRole('tab', { name: '3D' }).click()
  const canvas = page.locator('canvas.viewer3d-canvas')
  await expect(canvas).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Placer les pièces' }).click()
  const panel = page.getByRole('region', { name: 'Placement des pièces' })
  await expect(panel.getByRole('button', { name: 'OREILLES 1' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.viewer3d.picking')).toBeVisible()
  const box = (await canvas.boundingBox())!
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45)
  await expect(panel).toContainText('Toutes les pièces sont placées')
  await expect.poll(async () => Object.keys((await stored(page)).find((p: { name: string }) => p.name.includes('Souris')).placements)).toEqual(['OREILLES#0'])
  await panel.getByRole('button', { name: 'Tout réinitialiser' }).click()
  await expect.poll(async () => Object.keys((await stored(page)).find((p: { name: string }) => p.name.includes('Souris')).placements)).toEqual([])
  await panel.getByRole('button', { name: 'Terminé' }).click()
  await expect(panel).toHaveCount(0)
})

test('3D : clavier pour tourner et zoomer', async ({ page }) => {
  await home(page)
  await openMouse(page)
  await page.getByRole('tab', { name: '3D' }).click()
  const canvas = page.locator('canvas.viewer3d-canvas')
  await expect(canvas).toBeVisible({ timeout: 15_000 })
  await canvas.focus()
  await expect(canvas).toBeFocused()
  for (const key of ['ArrowLeft', 'ArrowUp', '+', '-', '0']) await page.keyboard.press(key)
})

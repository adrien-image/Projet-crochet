import { test, expect, type Page } from '@playwright/test'

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('crochet.patterns.v1') ?? '[]') as { name: string, roundsDone: string[], roundNotes: Record<string, { text: string }> }[])

test('deux onglets : une suppression dans l\'un n\'est pas annulée par une modification dans l\'autre', async ({ context }) => {
  const a = await context.newPage()
  await a.goto('./')
  await expect(a.locator('.card')).toHaveCount(3)
  const b = await context.newPage()
  await b.goto('./')
  await expect(b.locator('.card')).toHaveCount(3)

  // A supprime l'abeille
  await a.locator('.card', { hasText: 'Abeille' }).getByRole('button', { name: /Actions pour/ }).click()
  await a.getByRole('menuitem', { name: 'Supprimer' }).click()
  await expect(a.locator('.card')).toHaveCount(2)
  // B (qui l'affichait encore) la voit disparaître, puis coche un rang
  await expect(b.locator('.card')).toHaveCount(2)
  await b.locator('.card', { hasText: 'Souris' }).getByRole('link').click()
  await b.locator('.ins-round', { hasText: 'R8 :' }).click()
  await expect.poll(async () => (await stored(b)).find((p) => p.name.startsWith('Souris'))?.roundsDone.length).toBe(8)
  const names = (await stored(a)).map((p) => p.name)
  expect(names.some((n) => n.startsWith('Abeille'))).toBe(false)
  // et A reçoit le rang coché par B
  await a.locator('.card', { hasText: 'Souris' }).getByRole('link').click()
  await expect(a.locator('.ins-round.done')).toHaveCount(8)
})

test('adresse abîmée : retour à la bibliothèque au lieu d\'une page blanche', async ({ page }) => {
  await page.goto('./#/patron/%E0%A4')
  await expect(page.locator('.card')).toHaveCount(3)
})

test('note de rang : gardée si on quitte aussitôt après l\'avoir tapée', async ({ page }) => {
  await page.goto('./')
  await page.locator('.card', { hasText: 'Souris' }).getByRole('link').click()
  await page.getByRole('tab', { name: 'Rangs' }).click()
  await page.locator('.round-detail').getByRole('textbox', { name: /Note pour R8/ }).pressSequentially('vite', { delay: 10 })
  // retour immédiat (pas de perte de focus avant le démontage)
  // (les onglets ne s'empilent pas dans l'historique : un seul retour mène à la bibliothèque)
  await page.goBack()
  await expect(page.locator('.card')).toHaveCount(3)
  await expect.poll(async () => Object.values((await stored(page)).find((p) => p.name.startsWith('Souris'))?.roundNotes ?? {}).map((n) => n.text)).toEqual(['vite'])
})

test('hors connexion : l\'aperçu 3D fonctionne aussi (fichiers chargés à la demande préchargés)', async ({ page, context }) => {
  await page.goto('./')
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 15_000 }).catch(() => {})
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  // le préchargement de l'installation est terminé
  await expect.poll(() => page.evaluate(async () => {
    const keys = await caches.keys()
    const cache = await caches.open(keys.find((k) => k.startsWith('mon-crochet-'))!)
    return (await cache.keys()).some((r) => /three-.*\.js$/.test(r.url))
  }), { timeout: 15_000 }).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await page.locator('.card', { hasText: 'Souris' }).getByRole('link').click()
  await page.getByRole('tab', { name: '3D' }).click()
  await expect(page.locator('canvas.viewer3d-canvas')).toBeVisible({ timeout: 15_000 })
  await context.setOffline(false)
})

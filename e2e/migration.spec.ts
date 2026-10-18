import { test, expect } from '@playwright/test'

// 1×1 PNG, petit fichier texte et page HTML, au format data: de l'ancienne version
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const TXT = 'data:text/plain;base64,UjEgOiA2IG1z'
const HTML = 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='

test('anciennes données : fichiers vers IndexedDB, rangs séparés des étapes', async ({ page }) => {
  await page.addInitScript(({ PNG, TXT }) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('crochet.patterns.v1', JSON.stringify([{
      id: 'old', name: 'Ancien patron', tags: ['vieux'], text: 'R1 : 6 ms (6)\nR2 : aug dans chaque maille (12)',
      image: PNG, fileName: 'notes.txt', fileData: TXT,
      checklist: [{ id: 'round-1', text: 'Rang R2 (patron)', done: true }, { id: 'e1', text: 'Coudre', done: false }],
    }]))
  }, { PNG, TXT })
  await page.goto('./')
  await expect(page.locator('.card .card-progress')).toContainText('1/2 rangs · 0/1 étapes')
  await expect.poll(() => page.evaluate(() => {
    const [p] = JSON.parse(localStorage.getItem('crochet.patterns.v1') ?? '[]')
    return !!p.imageId && !!p.fileId && !p.image && !p.fileData
  })).toBe(true)
  await page.locator('.card').getByRole('link').click()
  await expect(page.locator('.photo-main img')).toHaveAttribute('src', /^blob:/)
  await expect(page.locator('.panel', { hasText: 'notes.txt' })).toBeVisible()
  await expect(page.locator('.check-item')).toHaveCount(1)
})

test('sécurité : un fichier HTML importé n\'est jamais servi comme page', async ({ page }) => {
  await page.addInitScript(({ HTML }) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('crochet.patterns.v1', JSON.stringify([{ id: 'x', name: 'Piégé', text: '', fileName: 'a.html', fileData: HTML }]))
  }, { HTML })
  await page.goto('./')
  await page.locator('.card').getByRole('link').click()
  const link = page.getByRole('link', { name: 'Ouvrir' })
  await expect(link).toBeVisible()
  const type = await link.evaluate(async (a: HTMLAnchorElement) => (await fetch(a.href)).headers.get('content-type'))
  expect(type).toBe('application/octet-stream')
})

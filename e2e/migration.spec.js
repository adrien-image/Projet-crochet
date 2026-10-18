import { test, expect } from '@playwright/test'

// 1×1 PNG et petit fichier texte, au format data: de l'ancienne version
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const TXT = 'data:text/plain;base64,UjEgOiA2IG1z'

test('anciennes données : fichiers déplacés vers IndexedDB, rangs séparés des étapes', async ({ page }) => {
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
  await expect(page.locator('.card .progress-label')).toHaveText('1/2 rangs · 0/1 étapes · 33%')
  await expect.poll(async () => page.evaluate(() => {
    const [p] = JSON.parse(localStorage.getItem('crochet.patterns.v1'))
    return !!p.imageId && !!p.fileId && !p.image && !p.fileData
  })).toBe(true)
  await page.click('.card')
  await expect(page.locator('.detail-image img')).toHaveAttribute('src', /^blob:/)
  await expect(page.locator('.attached-file')).toContainText('notes.txt')
  await expect(page.locator('.check-item')).toHaveCount(1)
})

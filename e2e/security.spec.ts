import { test, expect, type Page } from '@playwright/test'

// La politique de sécurité (CSP) du build ne doit rien bloquer de l'application elle-même.
const violations = (page: Page) => page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations)

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const list: string[] = []
    ;(window as unknown as { cspViolations: string[] }).cspViolations = list
    document.addEventListener('securitypolicyviolation', (e) => list.push(`${e.violatedDirective} ${e.blockedURI}`))
  })
})

function onePagePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/([()\\])/g, '\\$1')
  const content = `BT /F1 12 Tf 50 800 Td 16 TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET`
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`]
  let out = '%PDF-1.4\n'
  const offsets = objects.map((o, i) => { const at = out.length; out += `${i + 1} 0 obj\n${o}\nendobj\n`; return at })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

test('CSP : présente, et ni la 3D, ni le PDF, ni les photos ne sont bloqués', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', /script-src 'self'/)
  await expect(page.locator('.card')).toHaveCount(3)

  // photos (data: et blob:)
  await page.locator('.card', { hasText: 'Souris' }).getByRole('link').click()
  const png = await page.evaluate(() => new Promise<number[]>((resolve) => {
    const c = document.createElement('canvas')
    c.width = 20
    c.height = 20
    c.getContext('2d')!.fillRect(0, 0, 20, 20)
    c.toBlob(async (b) => resolve([...new Uint8Array(await b!.arrayBuffer())]), 'image/png')
  }))
  await page.locator('.photo input[type=file]').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(png) })
  await expect(page.locator('.photo-main img')).toHaveAttribute('src', /^blob:/)

  // 3D (three.js, textures générées)
  await page.getByRole('tab', { name: '3D' }).click()
  await expect(page.locator('canvas.viewer3d-canvas')).toBeVisible({ timeout: 15_000 })

  // PDF (pdf.js et son worker), aperçu du fichier joint
  await page.getByRole('button', { name: 'Bibliothèque' }).click()
  await page.getByRole('button', { name: /Nouveau patron/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nom').fill('PDF')
  await dialog.locator('input[type=file][accept*=pdf]').setInputFiles({ name: 'p.pdf', mimeType: 'application/pdf', buffer: onePagePdf(['R1 : 6 ms (6)', 'R2 : 6 aug (12)']) })
  await expect(dialog.getByRole('status')).toContainText('2 rangs reconnus', { timeout: 15_000 })
  await dialog.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.locator('iframe.file-preview')).toBeVisible()

  expect(await violations(page)).toEqual([])
  // contrôle du contrôle : une image d'un autre site est bien bloquée et signalée
  await page.evaluate(() => { const img = document.createElement('img'); img.src = 'https://example.com/pixel.png'; document.body.append(img) })
  await expect.poll(() => violations(page)).toEqual([expect.stringMatching(/^img-src https:\/\/example\.com/)])
})

test('partage : un lien forgé n\'ajoute pas de fichier joint', async ({ page }) => {
  const forged = { name: 'Piège', text: 'R1 : 6 ms (6)', fileData: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', fileName: 'a.html' }
  const code = `j${Buffer.from(JSON.stringify(forged)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
  await page.goto(`./#/partage/${code}`)
  const dialog = page.getByRole('dialog', { name: 'Patron partagé' })
  await dialog.getByRole('button', { name: 'Ajouter à ma bibliothèque' }).click()
  await expect(page.locator('.pattern-hero h1')).toHaveText('Piège')
  await expect(page.locator('.panel', { hasText: 'a.html' })).toHaveCount(0)
  expect(await violations(page)).toEqual([])
})

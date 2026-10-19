import { test, expect } from '@playwright/test'

// PDF de patron « magazine » : titre dans les métadonnées, trois colonnes, une photo et un fond uni
function magazinePdf(): Buffer {
  const esc = (s: string) => s.replace(/([()\\])/g, '\\$1')
  const col = (x: number, lines: string[]) => lines.map((l, i) => `BT /F1 10 Tf ${x} ${700 - i * 13} Td (${esc(l)}) Tj ET`).join('\n')
  // photo 240×180 à rayures colorées (variée), fond 100×100 uni
  const W = 240, H = 180
  const photo = Buffer.alloc(W * H * 3)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3
    const band = Math.floor(x / 20) % 2
    photo[i] = band ? 200 : 60; photo[i + 1] = (y * 2) % 255; photo[i + 2] = band ? 80 : 210
  }
  const flat = Buffer.alloc(100 * 100 * 3, 230)
  const content = [
    'q 595 0 0 842 0 0 cm /Bg Do Q',
    'q 240 0 0 180 330 600 cm /Im1 Do Q',
    'BT /F1 18 Tf 40 800 Td (Snow bunny - free pattern) Tj ET',
    col(40, ['Material', 'Plush yarn - Soft Velvet', 'Crochet hook 2.25 mm', 'Safety eyes 8 mm']),
    col(220, ['Head', 'Use color #102 white', 'Make a magic ring.', 'R1: 6 sc inside of magic ring.', 'R2: 6 inc = 12 sc', 'R3: 1 sc, 1 inc = 18 sc', 'R4 - 6 (3 rnds) = 18 sc in each rnd.']),
    col(400, ['Ears (make 2)', 'Use color #102 white', 'Make a magic ring.', 'R1: 4 sc inside of magic ring.', 'R2 & 3: 4 sc in each rnd.']),
  ].join('\n').replace(/q 240 0 0 180 330 600 cm \/Im1 Do Q/, 'q 240 0 0 180 330 300 cm /Im1 Do Q')
  const parts: (string | Buffer)[] = []
  const objects: (string | Buffer)[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> /XObject << /Im1 6 0 R /Bg 7 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${photo.length} >>\nstream\n`, 'latin1'), photo, Buffer.from('\nendstream', 'latin1')]),
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 100 /Height 100 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${flat.length} >>\nstream\n`, 'latin1'), flat, Buffer.from('\nendstream', 'latin1')]),
    '<< /Title (Pattern Snow Bunny) >>',
  ]
  let size = 0
  const push = (p: string | Buffer) => { const b = typeof p === 'string' ? Buffer.from(p, 'latin1') : p; parts.push(b); size += b.length }
  push('%PDF-1.4\n')
  const offsets = objects.map((o, i) => {
    const at = size
    push(`${i + 1} 0 obj\n`)
    push(o)
    push('\nendobj\n')
    return at
  })
  const xref = size
  push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`)
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 8 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return Buffer.concat(parts as Buffer[])
}

test('PDF magazine : colonnes, titre, photo importée, fond uni ignoré', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await page.getByRole('button', { name: /Nouveau patron/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('input[type=file][accept*=pdf]').setInputFiles({ name: 'bunny.pdf', mimeType: 'application/pdf', buffer: magazinePdf() })
  await expect(dialog.getByRole('status')).toContainText('9 rangs reconnus', { timeout: 20_000 })
  await expect(dialog.getByRole('status')).toContainText('1 photo importée')
  await expect(dialog.getByLabel('Nom')).toHaveValue('Snow Bunny')
  await expect(dialog.getByLabel('Crochet')).toHaveValue('2,25 mm')
  await expect(dialog.getByLabel('Fil')).toHaveValue('Plush yarn - Soft Velvet')
  await expect(dialog.locator('.form-photo:not(.add)')).toHaveCount(1)
  await expect(dialog.locator('.analysis').first()).toContainText('2 pièces')
  await expect(dialog.locator('.analysis').first()).toContainText('comptes cohérents')
  // les colonnes ne sont pas entremêlées
  const text = await dialog.getByLabel('Texte du patron').inputValue()
  expect(text.indexOf('R4 - 6')).toBeLessThan(text.indexOf('Ears (make 2)'))
  await dialog.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.locator('.photo-main img')).toBeVisible()
  await expect(page.locator('.yarn-card')).toContainText('Épaisseur 1')
  await expect(page.locator('.yarn-card')).toContainText('chenille')
  expect(errors).toEqual([])
})

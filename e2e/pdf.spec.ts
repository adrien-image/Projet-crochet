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

type Text = { s: string, x: number, y: number }

/** PDF de plusieurs pages, chaque texte à une position donnée (Helvetica 11 pt). */
function makePdf(pages: Text[][]): Buffer {
  const esc = (s: string) => s.replace(/([()\\])/g, '\\$1')
  const objects: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']
  const kids: number[] = []
  for (const texts of pages) {
    const content = texts.map((t) => `BT /F1 11 Tf ${t.x} ${t.y} Td (${esc(t.s)}) Tj ET`).join('\n')
    objects.push(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`)
    const contentId = objects.length
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`)
    kids.push(objects.length)
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`
  let out = '%PDF-1.4\n'
  const offsets = objects.map((o, i) => {
    const at = Buffer.byteLength(out, 'latin1')
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
    return at
  })
  const xref = Buffer.byteLength(out, 'latin1')
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

// une ligne par texte, de haut en bas ; en-tête et pied de page répétés comme dans beaucoup de PDF
const page = (n: number, lines: (string | [string, string])[]): Text[] => [
  { s: 'Little sleepy dragon - by Test Designer', x: 50, y: 810 },
  { s: `Page ${n} of 3`, x: 480, y: 810 },
  ...lines.flatMap((l, i) => (Array.isArray(l)
    // ligne à deux colonnes : un rang à gauche, une légende de photo à droite
    ? [{ s: l[0], x: 50, y: 770 - i * 16 }, { s: l[1], x: 380, y: 770 - i * 16 }]
    : [{ s: l, x: 50, y: 770 - i * 16 }])),
]

const PDF = makePdf([
  page(1, ['Little sleepy dragon', 'Crochet pattern', 'Materials:', 'Cotton yarn in teal and cream, 2,5mm crochet hook, fiberfill.']),
  page(2, [
    'Pattern:', 'Body: start at the tip of the nose',
    '1 - 6 sc into a magic ring (6)', '2 - 6 inc (12)', '3 - 1 sc, 1 inc (18)', ['4 to 6 - 18 sc (3 rows)', 'After row 6 -'],
    ['7 - 2 sc, 1 inc (24)', 'move the marker'], '8 - BLO - 24 sc', '9 and 10 - 24 sc (2 rows) - stuff the head',
    '11 - 2 sc, 1 dec (18)', '12 - 1 sc, 1 dec (12) - Stuff the body', '13 - 6 dec (6) - Fasten off',
  ]),
  page(3, [
    'Legs - make 2', '1 - 6 sc into a magic ring (6)', '2 e 3 - 6 sc (2 rows)', '4 - 2 hdc, 1 sc, 1 ss (4) - Leave tail',
    'Back spikes - make 2', '1 - 4 sc into a magic ring (4)', '2 - (1 sc, 1 inc) x2 (6)', '3 - 6 sc - Do not stuff',
    'Assembly:', '- Sew the legs between rows 9 and 10 of the body.', '- Spikes: rows 5 to 6 - rows 10 to 11.', '- Embroider the eyes between rows 3 and 4.',
  ]),
])

test('PDF anglophone : rangs, pièces, nom, crochet et fil reconnus, aperçu 3D assemblé', async ({ page: p }) => {
  await p.getByRole('button', { name: /Nouveau patron/ }).click()
  const dialog = p.getByRole('dialog')
  await dialog.locator('input[type=file][accept*=pdf]').setInputFiles({ name: 'dragon.pdf', mimeType: 'application/pdf', buffer: PDF })
  await expect(dialog.getByRole('status')).toContainText('20 rangs reconnus', { timeout: 15_000 })
  await expect(dialog.locator('.analysis').first()).toContainText('3 pièces')
  await expect(dialog.locator('.analysis').first()).toContainText('comptes cohérents')
  // nom, crochet et fil pré-remplis
  await expect(dialog.getByLabel('Nom')).toHaveValue('Little sleepy dragon')
  await expect(dialog.getByLabel('Crochet')).toHaveValue('2,5 mm')
  await expect(dialog.getByLabel('Fil')).toHaveValue('Cotton yarn in teal and cream')
  // en-têtes de page et légendes de photo ne se mêlent pas aux rangs
  const text = await dialog.getByLabel('Texte du patron').inputValue()
  expect(text).not.toMatch(/Page \d of 3|by Test Designer/)
  expect(text).toMatch(/^4 to 6 - 18 sc \(3 rows\)$/m)
  await dialog.getByRole('button', { name: 'Enregistrer' }).click()

  await expect(p.locator('.pattern-hero h1')).toHaveText('Little sleepy dragon')
  await p.getByRole('tab', { name: 'Rangs' }).click()
  await expect(p.locator('.panel.piece h3')).toHaveText(['Body', 'Legs× 2', 'Back spikes× 2'])
  await p.getByRole('tab', { name: '3D' }).click()
  await expect(p.locator('canvas.viewer3d-canvas')).toBeVisible({ timeout: 15_000 })
  await expect(p.locator('.legend3d')).toContainText('Back spikes × 2')
  // assemblé : rien n'est posé à côté, les pièces sont toutes cousues
  await expect(p.getByRole('button', { name: 'Placer les pièces' })).toBeVisible()
})

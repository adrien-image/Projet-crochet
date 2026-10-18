import { test, expect } from 'vitest'
import { decodeShare, encodeShare } from '../src/storage/share'
import { normalizePattern } from '../src/storage/patterns'
import { cleanDeleted } from '../src/storage/settings'
import { samplePattern } from '../src/storage/samples'

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
async function deflate(text: string) {
  const out = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(out).arrayBuffer())
}

test('partage : un lien forgé ne glisse ni fichier, ni photo, ni progression', async () => {
  const forged = { name: 'Piège', text: 'R1 : 6 ms (6)', fileData: 'data:application/pdf;base64,JVBERi0=', fileName: 'facture.pdf',
    image: 'data:image/png;base64,iVBORw0KGgo=', gallery: [{ data: 'data:image/png;base64,iVBORw0KGgo=' }], roundsDone: ['x'], timeSpent: 99, id: 'fixe' }
  const p = await decodeShare(`j${b64url(new TextEncoder().encode(JSON.stringify(forged)))}`)
  expect(p.name).toBe('Piège')
  expect([p.fileData, p.fileName, p.image, p.gallery, p.roundsDone, p.timeSpent]).toEqual([undefined, null, undefined, [], [], 0])
  expect(p.id).not.toBe('fixe')
  // un partage normal passe toujours
  expect((await decodeShare(await encodeShare(samplePattern()))).text).toBe(samplePattern().text)
})

test('partage : bombe de décompression refusée', async () => {
  // ~30 Mo de JSON qui se compressent en quelques dizaines de ko
  const bomb = await deflate(JSON.stringify({ name: 'x', text: 'a'.repeat(30_000_000) }))
  const code = `z${b64url(bomb)}`
  expect(code.length).toBeLessThan(200_000)
  await expect(decodeShare(code)).rejects.toThrow(/volumineux/)
  await expect(decodeShare('x123')).rejects.toThrow()
})

test('import : les clés __proto__ ne modifient pas les objets', () => {
  const raw = JSON.parse('{"roundNotes":{"__proto__":{"text":"pollue"},"ok":{"text":"note"}},"placements":{"__proto__":{"point":[1,2,3],"normal":[0,1,0]}},"pieceColors":{"constructor":"#ff0000"}}')
  const p = normalizePattern(raw)
  expect(Object.getPrototypeOf(p.roundNotes)).toBe(Object.prototype)
  expect(Object.getPrototypeOf(p.placements)).toBe(Object.prototype)
  expect(Object.keys(p.roundNotes)).toEqual(['ok'])
  expect(Object.hasOwn(p.pieceColors, 'constructor')).toBe(false)
  expect(({} as Record<string, unknown>).text).toBeUndefined()
  expect(cleanDeleted(JSON.parse('{"a":"2026-01-01T00:00:00Z","b":3,"c":"pas une date","__proto__":"x"}'))).toEqual({ a: '2026-01-01T00:00:00Z' })
})

test('import : une pièce jointe abîmée n\'empêche pas d\'importer le reste', async () => {
  const { importBackup } = await import('../src/storage/patterns')
  const list = await importBackup(new Blob([JSON.stringify({ patterns: [
    { name: 'abîmé', text: 'R1 : 6 ms (6)', fileData: 'data:text/plain,%E0', fileName: 'x.txt', image: 'data:image/png;base64,***', gallery: [{ data: 'data:image/png;base64,***', thumb: null }] },
    { name: 'sain', text: 'R1 : 6 ms (6)' },
  ] })]))
  expect(list.map((p) => p.name)).toEqual(['abîmé', 'sain'])
  const [bad] = list
  expect([bad.fileData, bad.fileName, bad.image, bad.gallery]).toEqual([undefined, null, undefined, []])
})

test('synchronisation : une date de suppression dans le futur est ignorée', () => {
  expect(cleanDeleted({ a: '9999-01-01T00:00:00Z', b: new Date().toISOString() })).toEqual({ b: expect.any(String) })
})

test('texte piège : répétitions imbriquées plafonnées, pas d\'emballement sur les espaces', async () => {
  const { parsePattern, MAX_STITCHES } = await import('../src/domain/parser')
  let t = Date.now()
  const rounds = parsePattern('R1: (((sc) x200) x200) x200\nR2: (500 sc) x200 in each st\nR3: (((((sc) x200) x200) x200) x200) x200')
  expect(rounds.every((r) => r.stitches.length <= MAX_STITCHES)).toBe(true)
  expect(Date.now() - t).toBeLessThan(1000)
  t = Date.now()
  parsePattern(`R1: 6 sc =1${' '.repeat(20000)}x\nR2${' '.repeat(20000)}x\n6 (8, 10${' '.repeat(20000)}`)
  expect(Date.now() - t).toBeLessThan(1000)
})

test('longues plages de rangs et taille du crochet', async () => {
  const { parsePattern } = await import('../src/domain/parser')
  const { hookMm } = await import('../src/domain/yarn')
  expect(parsePattern('Rows 2-60: ch 1, turn, sc across (20)').length).toBe(59)
  expect(parsePattern('R5-R3 : 6 ms').length).toBe(1)
  expect(hookMm('Materials: 10 mm safety eyes, 3.5 mm hook')).toBe(3.5)
  expect(hookMm('Crochet hook C-2/2.75 mm')).toBe(2.75)
  expect(hookMm('Crochet n°5')).toBe(5)
  expect(hookMm('3,5 mm')).toBe(3.5)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePattern, samplePattern } from '../src/storage.js'
import { parsePattern } from '../src/patternParser.js'

test('normalisation des données incomplètes', () => {
  const p = normalizePattern({ name: 'Test' })
  assert.ok(p.id)
  assert.deepEqual(p.tags, [])
  assert.deepEqual(p.checklist, [])
  assert.equal(p.text, '')
})

test('migration : rangs cochés séparés des étapes, anciens identifiants « round-{index} »', () => {
  const sample = samplePattern()
  const rounds = parsePattern(sample.text)
  const p = normalizePattern({
    ...sample,
    roundsDone: [],
    checklist: [
      { id: 'round-2', text: 'Rang R3 (MUSEAU)', done: true },
      { id: rounds[4].key, text: 'R5 — MUSEAU', done: true },
      { id: 'x', text: 'Coudre', done: false },
    ],
  })
  // les rangs quittent la liste d'étapes et passent dans roundsDone
  assert.deepEqual(p.checklist.map((i) => i.id), ['x'])
  assert.deepEqual(p.roundsDone.sort(), [rounds[2].key, rounds[4].key].sort())
})

test('patrons d\'exemple : souris commencée, champs complets', () => {
  const p = samplePattern()
  assert.equal(p.roundsDone.length, 7)
  assert.equal(p.hook, '3 mm')
  assert.equal(p.notation, 'auto')
})

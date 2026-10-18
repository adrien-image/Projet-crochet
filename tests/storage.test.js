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

test('migration des anciens identifiants de rang « round-{index} »', () => {
  const sample = samplePattern()
  const p = normalizePattern({ ...sample, checklist: [{ id: 'round-2', text: 'Rang R3 (MUSEAU)', done: true }] })
  const rounds = parsePattern(sample.text)
  assert.equal(p.checklist[0].id, rounds[2].key)
  assert.equal(p.checklist[0].done, true)
})

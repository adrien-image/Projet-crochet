import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePattern } from '../src/patternParser.js'
import { buildScene, renderScene } from '../src/engine3d.js'
import { samplePattern } from '../src/storage.js'

function stubContext() {
  const calls = { fill: 0 }
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : k === 'fill' ? () => { calls.fill++ } : () => {}),
    set: (t, k, v) => { t[k] = v; return true },
  })
  return { ctx, calls }
}

test('scène de la souris : museau + corps en une pièce, oreilles en double', () => {
  const scene = buildScene(parsePattern(samplePattern().text))
  assert.deepEqual(scene.meshes.map((m) => m.label), ['MUSEAU + CORPS', 'OREILLES', 'OREILLES'])
  assert.equal(scene.meshes[0].doubleSided, false) // fermé (6 mailles au dernier rang)
  assert.equal(scene.meshes[1].doubleSided, true) // oreille ouverte (24 mailles)
  const { ctx, calls } = stubContext()
  const drawn = renderScene(ctx, scene, 600, 400, { yaw: 0.5, pitch: -0.35 })
  assert.ok(drawn > 0)
  assert.equal(calls.fill, drawn)
})

test('élimination des faces arrière : environ la moitié d\'un cylindre est visible', () => {
  const scene = buildScene(parsePattern('R1: 12 ms\nR2: 12 ms\nR3: 12 ms'))
  const sides = scene.meshes[0].faces.filter((f) => f.length === 4)
  const only = { ...scene, meshes: [{ ...scene.meshes[0], faces: sides }] }
  const drawn = renderScene(stubContext().ctx, only, 400, 400, { yaw: 0, pitch: 0 })
  assert.ok(drawn > sides.length * 0.3 && drawn <= sides.length / 2, `faces visibles : ${drawn}/${sides.length}`)
})

test('pas de scène sans rang', () => {
  assert.equal(buildScene(parsePattern('Aucun rang ici')), null)
})

test('travail à plat : panneau double face', () => {
  const scene = buildScene(parsePattern('Row 1: 20 sc, turn (20)\nRow 2: 20 sc, turn (20)\nRow 3: 20 sc (20)'))
  const m = scene.meshes[0]
  assert.equal(m.flatPanel, true)
  assert.ok(m.vertices.every((v) => v[2] === 0))
  // visible de face comme de dos
  const front = renderScene(stubContext().ctx, scene, 400, 400, { yaw: 0, pitch: 0 })
  const back = renderScene(stubContext().ctx, scene, 400, 400, { yaw: Math.PI, pitch: 0 })
  assert.equal(front, m.faces.length)
  assert.equal(back, m.faces.length)
})

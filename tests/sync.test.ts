import { test, expect, vi } from 'vitest'
import * as assets from '../src/storage/assets'
import { writeSyncFile } from '../src/storage/sync'
import { normalizePattern } from '../src/storage/patterns'

const PNG = 'data:image/png;base64,iVBORw0KGgo='

test('synchronisation : un fichier identique n\'est pas réécrit, la couverture n\'est encodée qu\'une fois', async () => {
  const writes: string[] = []
  const handle = {
    name: 'mon-crochet.json',
    createWritable: async () => ({ write: async (b: Blob) => { writes.push(await b.text()) }, close: async () => {} }),
  } as unknown as Parameters<typeof writeSyncFile>[0]
  const cover = await assets.putAsset(PNG)
  const spy = vi.spyOn(assets, 'getAssetDataUrl')
  const p = normalizePattern({ name: 'a', imageId: cover })
  await writeSyncFile(handle, [p], {})
  await writeSyncFile(handle, [p], {})
  expect(writes.length).toBe(1)
  expect(JSON.parse(writes[0]).patterns[0].image).toMatch(/^data:image\/png/)
  // une modification : réécrit, sans réencoder la couverture
  await writeSyncFile(handle, [{ ...p, name: 'b' }], {})
  expect(writes.length).toBe(2)
  expect(spy.mock.calls.filter(([id]) => id === cover).length).toBe(1)
})

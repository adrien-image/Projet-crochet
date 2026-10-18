import { test, expect } from 'vitest'
import { extractKeys } from '../scripts/i18n-keys'
import en from '../src/i18n/en'
import { STITCH_INFO } from '../src/domain/parser'
import { colorName } from '../src/domain/colors'
import { t, tn, setLang } from '../src/i18n'

// chaînes traduites dynamiquement (t(variable))
const DYNAMIC = [
  ...Object.values(STITCH_INFO).map((s) => s.label),
  'Patron', 'Compteur', 'Rangs', '3D',
  'Modifiés récemment', 'Ajoutés récemment', 'Nom (A → Z)', 'Progression',
  // noms de couleurs de la fiche des fils
  ...['#9cc3e6', '#2c3e66', '#a8d5b0', '#2f5d3a', '#f2c4cf', '#c9c8c6', '#55565a', '#9b9a9c', '#e99aae', '#c3323c', '#f4f1ea', '#efe6d2', '#2a2a2d', '#4a72b0', '#3aa7a3', '#5e9a58', '#e8c34a', '#e8854a', '#8a5a3c', '#d9c3a0', '#8c6bb5', '#e9dcc6'].map((c) => colorName(c)!),
]

test('chaque texte de l\'interface a une traduction anglaise', () => {
  const keys = [...extractKeys('src'), ...DYNAMIC]
  const missing = keys.filter((k) => !(k in en))
  expect(missing).toEqual([])
})

test('les traductions gardent les mêmes variables', () => {
  for (const [fr, tr] of Object.entries(en)) {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    expect(vars(tr), fr).toEqual(vars(fr))
  }
})

test('t() et tn() : variables et pluriel', () => {
  setLang('fr')
  expect(tn(1, '{n} rang', '{n} rangs')).toBe('1 rang')
  expect(tn(3, '{n} rang', '{n} rangs')).toBe('3 rangs')
  setLang('en')
  expect(tn(3, '{n} rang', '{n} rangs')).toBe('3 rounds')
  expect(t('Crochet {h}', { h: '3 mm' })).toBe('Hook 3 mm')
  setLang('fr')
})

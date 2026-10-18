// Extrait les chaînes passées à t() et tn() dans le code source (utilisé par le test de traduction).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : []
  })
}

/** Lit un littéral de chaîne JS à la position i (guillemets simples ou doubles). */
function readString(src: string, i: number): { value: string, end: number } | null {
  const q = src[i]
  if (q !== '\'' && q !== '"') return null
  let out = ''
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j]
    if (c === '\\') {
      const n = src[++j]
      out += n === 'n' ? '\n' : n
    } else if (c === q) return { value: out, end: j + 1 }
    else out += c
  }
  return null
}

const skipSpace = (src: string, i: number) => {
  while (/\s/.test(src[i])) i++
  return i
}

export function extractKeys(root: string): Set<string> {
  const keys = new Set<string>()
  for (const file of files(root)) {
    if (file.includes(`${join('src', 'i18n')}`)) continue
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/(?<![\w.])(t|tn)\(/g)) {
      let i = skipSpace(src, (m.index ?? 0) + m[0].length)
      if (m[1] === 'tn') {
        // premier argument (le nombre) : jusqu'à la virgule de premier niveau
        let depth = 0
        for (; i < src.length; i++) {
          if (src[i] === '(') depth++
          else if (src[i] === ')') depth--
          else if (src[i] === ',' && depth === 0) break
        }
        for (let k = 0; k < 2; k++) {
          i = skipSpace(src, i + 1)
          const s = readString(src, i)
          if (!s) break
          keys.add(s.value)
          i = skipSpace(src, s.end)
        }
      } else {
        const s = readString(src, i)
        if (s) keys.add(s.value)
      }
    }
  }
  return keys
}

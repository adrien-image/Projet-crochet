import type { Pattern } from '../../domain/types'
import { roundsOf } from '../../domain/progress'
import { colorName } from '../../domain/colors'
import { estimateYarn, formatMeters, YARN_MARGIN } from '../../domain/yarn'
import { getLang, t } from '../../i18n'
import { textLines } from './textLines'

/** caractères qui changeraient la mise en forme Markdown d'un texte libre */
const escape = (s: string) => s.replace(/([\\`*_[\]#<>|])/g, '\\$1')

/**
 * Le patron en Markdown : lisible tel quel comme texte, et converti sans peine (traitement de texte,
 * site, autre application). Les rangs faits sont cochés.
 */
export function patternMarkdown(pattern: Pattern): string {
  const lang = getLang()
  const rounds = roundsOf(pattern)
  const done = new Set(pattern.roundsDone)
  const out: string[] = [`# ${escape(pattern.name)}`, '']
  if (pattern.description) out.push(escape(pattern.description), '')
  const facts = [
    pattern.hook && `- **${t('Crochet')}** : ${escape(pattern.hook)}`,
    pattern.yarn && `- **${t('Fil')}** : ${escape(pattern.yarn)}`,
    pattern.tags.length > 0 && `- **${t('Tags')}** : ${pattern.tags.map((tg) => `#${escape(tg)}`).join(' ')}`,
  ].filter(Boolean) as string[]
  if (facts.length) out.push(...facts, '')

  const yarn = estimateYarn(pattern)
  if (yarn.meters > 0) {
    out.push(`## ${t('Fils à prévoir')}`, '')
    for (const c of yarn.byColor) {
      const known = colorName(c.color)
      out.push(`- ${escape(c.name ?? (known ? t(known) : t('Fil')))} (${c.color}) — ${escape(c.pieces.join(', '))} — ≈ ${formatMeters(c.meters * (1 + YARN_MARGIN), lang)}`)
    }
    out.push('')
  }
  if (pattern.checklist.length) {
    out.push(`## ${t('Étapes')}`, '')
    for (const c of pattern.checklist) out.push(`- [${c.done ? 'x' : ' '}] ${escape(c.text)}`)
    out.push('')
  }
  out.push(`## ${t('Instructions')}`, '')
  for (const l of textLines(pattern.text, rounds)) {
    if (!l.line.trim()) {
      if (out[out.length - 1] !== '') out.push('')
    } else if (l.title) out.push('', `### ${escape(l.title)}`, '')
    else if (l.rounds) {
      const note = l.rounds.map((r) => pattern.roundNotes[r.key]?.text).filter(Boolean).join(' · ')
      out.push(`- [${l.rounds.every((r) => done.has(r.key)) ? 'x' : ' '}] ${escape(l.line.trim())}${note ? ` — *${escape(note)}*` : ''}`)
    } else out.push(`${escape(l.line.trim())}  `)
  }
  out.push('', '---', '', `*${t('Exporté depuis Mon Crochet')}*`, '')
  return out.join('\n').replace(/\n{3,}/g, '\n\n')
}

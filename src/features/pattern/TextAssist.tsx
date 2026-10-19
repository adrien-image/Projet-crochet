import { CornerDownLeft } from 'lucide-react'
import type { Round } from '../../domain/types'
import { getLang, t, tn } from '../../i18n'
import { roundIssue } from './roundIssue'
import { lineAt, nextRoundPrefix, suggestions, wordBefore } from './typingHelp'

interface Props {
  text: string
  caret: number
  rounds: Round[]
  /** remplace text[from, to) par `insert` et place le curseur après */
  onInsert: (from: number, to: number, insert: string) => void
}

/** Sous le texte du patron : le rang de la ligne en cours (mailles, compte), abréviations, rang suivant. */
export function TextAssist({ text, caret, rounds, onInsert }: Props) {
  const line = lineAt(text, caret)
  const here = rounds.filter((r) => r.line === line)
  const last = here[here.length - 1]
  const issue = here.map(roundIssue).find(Boolean)
  const { start, word } = wordBefore(text, caret)
  const words = suggestions(text, word, getLang() === 'en' ? 'eng' : 'fra')
  const next = nextRoundPrefix(text, line, rounds)
  const lineEnd = text.indexOf('\n', caret) < 0 ? text.length : text.indexOf('\n', caret)

  return (
    <div className="text-assist" aria-live="polite">
      <span className={`ta-line ${issue ? 'warn' : last ? 'ok' : ''}`}>
        {last
          ? <>
              <strong>{here.map((r) => r.label).join(', ')}</strong> · {tn(last.count, '{n} maille', '{n} mailles')}
              {issue ? ` · ${issue.replace(/^⚠\s*/, '')}` : last.expected != null ? ' ✓' : ''}
            </>
          : t('Ligne {n} : pas un rang', { n: line + 1 })}
      </span>
      {words.length > 0 && (
        <span className="ta-words">
          {words.map((w, i) => (
            <button key={w} type="button" className="chip" title={i === 0 ? t('Tab pour compléter') : undefined}
              onMouseDown={(e) => e.preventDefault()} onClick={() => onInsert(start, caret, `${w} `)}>{w}</button>
          ))}
        </span>
      )}
      {next && (
        <button type="button" className="btn ghost sm" onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(lineEnd, lineEnd, `\n${next}`)}>
          <CornerDownLeft size={14} /> {t('Rang suivant ({r})', { r: next.trim().replace(/\s*[:.–-]$/, '') })}
        </button>
      )}
    </div>
  )
}

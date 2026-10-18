import { useMemo, useState } from 'react'
import { FileSearch, ImagePlus, Paperclip, Trash2 } from 'lucide-react'
import type { Notation, Pattern } from '../../domain/types'
import { compressImage, makeThumbnail } from '../../storage/images'
import { getAsset, putAsset } from '../../storage/assets'
import { parsePattern, patternStats, detectSizes, detectNotation } from '../../domain/parser'
import { t, tn } from '../../i18n'
import { Dialog } from '../../ui/Dialog'

const MAX_FILE_MB = 25

export type PatternDraft = Omit<Pattern, 'id' | 'createdAt' | 'updatedAt' | 'checklist' | 'roundsDone' | 'stitchCounter' | 'pieceColors'
  | 'roundNotes' | 'placements' | 'timeSpent' | 'timerStartedAt' | 'sessions'> & Partial<Pattern>

interface Props {
  initial: Pattern | null
  onSave: (data: PatternDraft) => void
  onCancel: () => void
}

export function PatternForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '')
  const [hook, setHook] = useState(initial?.hook ?? '')
  const [yarn, setYarn] = useState(initial?.yarn ?? '')
  const [text, setText] = useState(initial?.text ?? '')
  const [notation, setNotation] = useState<Notation>(initial?.notation ?? 'auto')
  const [size, setSize] = useState(initial?.size ?? 0)
  const [image, setImage] = useState({ imageId: initial?.imageId ?? null, thumb: initial?.thumb ?? initial?.image ?? null, image: initial?.image ?? null })
  const [file, setFile] = useState({ fileId: initial?.fileId ?? null, fileName: initial?.fileName ?? null, fileType: initial?.fileType ?? null, fileData: initial?.fileData ?? null })
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const sizes = useMemo(() => detectSizes(text), [text])
  const effectiveSize = Math.min(size, sizes - 1)
  const stats = useMemo(() => patternStats(parsePattern(text, { notation, size: effectiveSize })), [text, notation, effectiveSize])
  const isPdf = file.fileType === 'application/pdf' || /\.pdf$/i.test(file.fileName ?? '')

  const onImage = async (f: File | undefined) => {
    if (!f) return
    setBusy(t('Chargement…'))
    setError('')
    try {
      const dataUrl = await compressImage(f)
      setImage({ imageId: await putAsset(dataUrl), thumb: await makeThumbnail(dataUrl), image: null })
    } catch {
      setError(t('Impossible de lire cette image.'))
    } finally {
      setBusy(null)
    }
  }

  /** Remplit le champ texte avec le texte du PDF (pdf.js n'est chargé qu'à ce moment-là). */
  const extractFromPdf = async (blob: Blob, replace: boolean) => {
    setBusy(t('Lecture du PDF…'))
    setError('')
    try {
      const { extractPdfText } = await import('../../storage/pdfText')
      const extracted = await extractPdfText(blob)
      if (!extracted.trim()) {
        setInfo(t('Ce PDF ne contient pas de texte (document scanné ?). Recopiez les rangs à la main.'))
        return
      }
      setText((cur) => (replace || !cur.trim() ? extracted : `${cur}\n\n${extracted}`))
      const n = parsePattern(extracted).length
      setInfo(n ? tn(n, 'Texte extrait du PDF : {n} rang reconnu. Vérifiez-le avant d\'enregistrer.', 'Texte extrait du PDF : {n} rangs reconnus. Vérifiez-les avant d\'enregistrer.')
        : t('Texte extrait du PDF, mais aucun rang reconnu : vérifiez la mise en forme (un rang par ligne).'))
    } catch {
      setError(t('Impossible de lire le texte de ce PDF.'))
    } finally {
      setBusy(null)
    }
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(t('Ce fichier fait {s} Mo : choisissez un fichier de moins de {m} Mo.', { s: (f.size / 1024 / 1024).toFixed(1), m: MAX_FILE_MB }))
      return
    }
    setError('')
    setInfo('')
    setBusy(t('Chargement…'))
    try {
      setFile({ fileId: await putAsset(f), fileName: f.name, fileType: f.type || null, fileData: null })
      // le texte d'un fichier texte ou PDF remplit le champ s'il est vide (compteur et rendus)
      if (f.type.startsWith('text/') && !text.trim()) setText(await f.text())
      if ((f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) && !text.trim()) await extractFromPdf(f, true)
    } catch {
      setError(t('Impossible d\'enregistrer ce fichier.'))
    } finally {
      setBusy(null)
    }
  }

  const extractAgain = async () => {
    const blob = file.fileId ? await getAsset(file.fileId) : null
    if (blob) await extractFromPdf(blob, !text.trim())
  }

  const submit = () => {
    if (!name.trim() || busy) return
    onSave({
      ...(initial ?? {}),
      name: name.trim(),
      description: description.trim(),
      tags: [...new Set(tags.split(',').map((tg) => tg.trim().replace(/^#/, '')).filter(Boolean))],
      hook: hook.trim(),
      yarn: yarn.trim(),
      text,
      notation,
      size: effectiveSize,
      imageId: image.imageId,
      thumb: image.thumb,
      image: image.image,
      ...file,
    })
  }

  const detected = detectNotation(text) === 'uk' ? t('UK détectée') : t('FR / US')

  return (
    <Dialog open title={initial ? t('Modifier le patron') : t('Nouveau patron')} onClose={onCancel} size="lg" onSubmit={submit}
      footer={(
        <>
          <button type="button" className="btn ghost" onClick={onCancel}>{t('Annuler')}</button>
          <button type="submit" className="btn primary" disabled={!!busy || !name.trim()}>{busy ?? t('Enregistrer')}</button>
        </>
      )}>
      <div className="form">
        <fieldset>
          <legend>{t('Le patron')}</legend>
          <div className="field">
            <label htmlFor="f-name">{t('Nom')}</label>
            <input id="f-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder={t('Ex. Lapin dormeur')} />
          </div>
          <div className="field">
            <label htmlFor="f-desc">{t('Description')} <span className="opt">{t('facultatif')}</span></label>
            <input id="f-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('Taille finale, difficulté, source…')} />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="f-hook">{t('Crochet')}</label>
              <input id="f-hook" className="input" value={hook} onChange={(e) => setHook(e.target.value)} placeholder="3,5 mm" />
            </div>
            <div className="field grow">
              <label htmlFor="f-yarn">{t('Fil')} <span className="opt">{t('la couleur est utilisée pour les rendus')}</span></label>
              <input id="f-yarn" className="input" value={yarn} onChange={(e) => setYarn(e.target.value)} placeholder={t('Coton beige, un peu de rose')} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="f-tags">{t('Tags')} <span className="opt">{t('séparés par des virgules')}</span></label>
            <input id="f-tags" className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t('amigurumi, cadeau')} />
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('Instructions')}</legend>
          <div className="field">
            <label htmlFor="f-text">{t('Texte du patron')}</label>
            <textarea id="f-text" className="input mono" value={text} onChange={(e) => setText(e.target.value)} rows={10}
              placeholder={t('Un rang par ligne, pièces en MAJUSCULES :\nTÊTE\nR1 : 6 ms dans un anneau magique (6)\nR2 : aug dans chaque maille (12)\nR3 : *1 ms, aug* x6 (18)')} />
            <p className={`analysis ${stats.rounds === 0 ? '' : stats.invalid + stats.misfit > 0 ? 'warn' : 'ok'}`} aria-live="polite">
              {stats.rounds === 0
                ? t('Aucun rang reconnu pour l\'instant — format « R1 : 6 ms (6) », un rang par ligne. Vous pouvez aussi joindre le PDF du patron.')
                : <>
                    <strong>{tn(stats.rounds, '{n} rang', '{n} rangs')}</strong> · {tn(stats.pieces, '{n} pièce', '{n} pièces')}
                    {stats.invalid + stats.misfit > 0 ? ` · ${t('{n} compte(s) à vérifier', { n: stats.invalid + stats.misfit })}` : ` · ${t('comptes cohérents ✓')}`}
                  </>}
            </p>
          </div>
          <div className="field-row">
            <div className="field grow">
              <label htmlFor="f-notation">{t('Notation')}</label>
              <select id="f-notation" className="input" value={notation} onChange={(e) => setNotation(e.target.value as Notation)}>
                <option value="auto">{t('Automatique ({d})', { d: detected })}</option>
                <option value="us">{t('Française / US (dc = bride)')}</option>
                <option value="uk">{t('UK (dc = maille serrée)')}</option>
              </select>
            </div>
            {sizes > 1 && (
              <div className="field grow">
                <label htmlFor="f-size">{t('Taille réalisée')}</label>
                <select id="f-size" className="input" value={effectiveSize} onChange={(e) => setSize(Number(e.target.value))}>
                  {Array.from({ length: sizes }, (_, i) => <option key={i} value={i}>{t('Taille {n}', { n: i + 1 })}</option>)}
                </select>
              </div>
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('Fichiers')}</legend>
          <div className="files">
            <div className="file-slot">
              {image.thumb ? <img src={image.thumb} alt="" /> : <ImagePlus size={28} aria-hidden="true" />}
              <div>
                <strong>{t('Photo de l\'ouvrage')}</strong>
                <div className="row-gap wrap">
                  <label className="btn ghost sm">
                    {image.imageId || image.image ? t('Changer') : t('Choisir une image')}
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => onImage(e.target.files?.[0])} />
                  </label>
                  {(image.imageId || image.image) && (
                    <button type="button" className="btn ghost sm danger" onClick={() => setImage({ imageId: null, thumb: null, image: null })}><Trash2 size={15} /> {t('Retirer')}</button>
                  )}
                </div>
              </div>
            </div>
            <div className="file-slot">
              <Paperclip size={28} aria-hidden="true" />
              <div>
                <strong>{file.fileName ?? t('Fichier du patron')}</strong>
                <span className="muted sm">{t('PDF, image ou texte · {m} Mo max. Le texte d\'un PDF est extrait automatiquement.', { m: MAX_FILE_MB })}</span>
                <div className="row-gap wrap">
                  <label className="btn ghost sm">
                    {file.fileId || file.fileData ? t('Remplacer') : t('Joindre un fichier')}
                    <input type="file" accept=".pdf,image/*,.txt,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
                  </label>
                  {isPdf && file.fileId && (
                    <button type="button" className="btn ghost sm" onClick={extractAgain} disabled={!!busy}><FileSearch size={15} /> {t('Extraire le texte')}</button>
                  )}
                  {(file.fileId || file.fileData) && (
                    <button type="button" className="btn ghost sm danger" onClick={() => setFile({ fileId: null, fileName: null, fileType: null, fileData: null })}><Trash2 size={15} /> {t('Retirer')}</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </fieldset>
        {info && <p className="analysis" role="status">{info}</p>}
        {error && <p className="text-warn" role="alert">{error}</p>}
      </div>
    </Dialog>
  )
}

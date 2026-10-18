import { useMemo, useState } from 'react'
import { ImagePlus, Paperclip, Trash2 } from 'lucide-react'
import type { Notation, Pattern } from '../../domain/types'
import { compressImage, makeThumbnail } from '../../storage/images'
import { putAsset } from '../../storage/assets'
import { parsePattern, patternStats, detectSizes, detectNotation } from '../../domain/parser'
import { Dialog } from '../../ui/Dialog'

const MAX_FILE_MB = 25

export type PatternDraft = Omit<Pattern, 'id' | 'createdAt' | 'updatedAt' | 'checklist' | 'roundsDone' | 'stitchCounter' | 'pieceColors'> & Partial<Pattern>

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
  const [busy, setBusy] = useState(false)

  const sizes = useMemo(() => detectSizes(text), [text])
  const effectiveSize = Math.min(size, sizes - 1)
  const stats = useMemo(() => patternStats(parsePattern(text, { notation, size: effectiveSize })), [text, notation, effectiveSize])

  const onImage = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    setError('')
    try {
      const dataUrl = await compressImage(f)
      setImage({ imageId: await putAsset(dataUrl), thumb: await makeThumbnail(dataUrl), image: null })
    } catch {
      setError('Impossible de lire cette image.')
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Ce fichier fait ${(f.size / 1024 / 1024).toFixed(1)} Mo : choisissez un fichier de moins de ${MAX_FILE_MB} Mo.`)
      return
    }
    setError('')
    setBusy(true)
    try {
      setFile({ fileId: await putAsset(f), fileName: f.name, fileType: f.type || null, fileData: null })
      // un fichier texte est recopié dans le champ texte s'il est vide (active compteur et rendus)
      if (f.type.startsWith('text/') && !text.trim()) setText(await f.text())
    } catch {
      setError('Impossible d\'enregistrer ce fichier.')
    } finally {
      setBusy(false)
    }
  }

  const submit = () => {
    if (!name.trim() || busy) return
    onSave({
      ...(initial ?? {}),
      name: name.trim(),
      description: description.trim(),
      tags: [...new Set(tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean))],
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

  const detected = detectNotation(text) === 'uk' ? 'UK détectée' : 'FR / US'

  return (
    <Dialog open title={initial ? 'Modifier le patron' : 'Nouveau patron'} onClose={onCancel} size="lg" onSubmit={submit}
      footer={(
        <>
          <button type="button" className="btn ghost" onClick={onCancel}>Annuler</button>
          <button type="submit" className="btn primary" disabled={busy || !name.trim()}>{busy ? 'Chargement…' : 'Enregistrer'}</button>
        </>
      )}>
      <div className="form">
        <fieldset>
          <legend>Le patron</legend>
          <div className="field">
            <label htmlFor="f-name">Nom</label>
            <input id="f-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="Ex. Lapin dormeur" />
          </div>
          <div className="field">
            <label htmlFor="f-desc">Description <span className="opt">facultatif</span></label>
            <input id="f-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Taille finale, difficulté, source…" />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="f-hook">Crochet</label>
              <input id="f-hook" className="input" value={hook} onChange={(e) => setHook(e.target.value)} placeholder="3,5 mm" />
            </div>
            <div className="field grow">
              <label htmlFor="f-yarn">Fil <span className="opt">la couleur est utilisée pour les rendus</span></label>
              <input id="f-yarn" className="input" value={yarn} onChange={(e) => setYarn(e.target.value)} placeholder="Coton beige, un peu de rose" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="f-tags">Tags <span className="opt">séparés par des virgules</span></label>
            <input id="f-tags" className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="amigurumi, cadeau" />
          </div>
        </fieldset>

        <fieldset>
          <legend>Instructions</legend>
          <div className="field">
            <label htmlFor="f-text">Texte du patron</label>
            <textarea id="f-text" className="input mono" value={text} onChange={(e) => setText(e.target.value)} rows={10}
              placeholder={'Un rang par ligne, pièces en MAJUSCULES :\nTÊTE\nR1 : 6 ms dans un anneau magique (6)\nR2 : aug dans chaque maille (12)\nR3 : *1 ms, aug* x6 (18)'} />
            <p className={`analysis ${stats.rounds === 0 ? '' : stats.invalid + stats.misfit > 0 ? 'warn' : 'ok'}`} aria-live="polite">
              {stats.rounds === 0
                ? 'Aucun rang reconnu pour l\'instant — format « R1 : 6 ms (6) », un rang par ligne.'
                : <>
                    <strong>{stats.rounds} rangs</strong> · {stats.pieces} pièce{stats.pieces > 1 ? 's' : ''}
                    {stats.invalid + stats.misfit > 0 ? ` · ${stats.invalid + stats.misfit} compte(s) à vérifier` : ' · comptes cohérents ✓'}
                  </>}
            </p>
          </div>
          <div className="field-row">
            <div className="field grow">
              <label htmlFor="f-notation">Notation</label>
              <select id="f-notation" className="input" value={notation} onChange={(e) => setNotation(e.target.value as Notation)}>
                <option value="auto">Automatique ({detected})</option>
                <option value="us">Française / US (dc = bride)</option>
                <option value="uk">UK (dc = maille serrée)</option>
              </select>
            </div>
            {sizes > 1 && (
              <div className="field grow">
                <label htmlFor="f-size">Taille réalisée</label>
                <select id="f-size" className="input" value={effectiveSize} onChange={(e) => setSize(Number(e.target.value))}>
                  {Array.from({ length: sizes }, (_, i) => <option key={i} value={i}>Taille {i + 1}</option>)}
                </select>
              </div>
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend>Fichiers</legend>
          <div className="files">
            <div className="file-slot">
              {image.thumb ? <img src={image.thumb} alt="" /> : <ImagePlus size={28} aria-hidden="true" />}
              <div>
                <strong>Photo de l'ouvrage</strong>
                <div className="row-gap wrap">
                  <label className="btn ghost sm">
                    {image.imageId || image.image ? 'Changer' : 'Choisir une image'}
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => onImage(e.target.files?.[0])} />
                  </label>
                  {(image.imageId || image.image) && (
                    <button type="button" className="btn ghost sm danger" onClick={() => setImage({ imageId: null, thumb: null, image: null })}><Trash2 size={15} /> Retirer</button>
                  )}
                </div>
              </div>
            </div>
            <div className="file-slot">
              <Paperclip size={28} aria-hidden="true" />
              <div>
                <strong>{file.fileName ?? 'Fichier du patron'}</strong>
                <span className="muted sm">PDF, image ou texte · {MAX_FILE_MB} Mo max.</span>
                <div className="row-gap wrap">
                  <label className="btn ghost sm">
                    {file.fileId || file.fileData ? 'Remplacer' : 'Joindre un fichier'}
                    <input type="file" accept=".pdf,image/*,.txt,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
                  </label>
                  {(file.fileId || file.fileData) && (
                    <button type="button" className="btn ghost sm danger" onClick={() => setFile({ fileId: null, fileName: null, fileType: null, fileData: null })}><Trash2 size={15} /> Retirer</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </fieldset>
        {error && <p className="text-warn" role="alert">{error}</p>}
      </div>
    </Dialog>
  )
}

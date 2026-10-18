import { useMemo, useRef, useState } from 'react'
import { compressImage, makeThumbnail } from './storage'
import { putAsset } from './assets'
import { parsePattern, patternStats, detectSizes, detectNotation } from './patternParser'
import { useFocusTrap } from './hooks/useFocusTrap'

const MAX_FILE_MB = 25

export default function PatternForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [tags, setTags] = useState(initial?.tags?.join(', ') ?? '')
  const [hook, setHook] = useState(initial?.hook ?? '')
  const [yarn, setYarn] = useState(initial?.yarn ?? '')
  const [text, setText] = useState(initial?.text ?? '')
  const [notation, setNotation] = useState(initial?.notation ?? 'auto')
  const [size, setSize] = useState(initial?.size ?? 0)
  const [image, setImage] = useState(() => ({
    imageId: initial?.imageId ?? null,
    thumb: initial?.thumb ?? initial?.image ?? null,
    image: initial?.image ?? null,
  }))
  const [file, setFile] = useState(() => ({
    fileId: initial?.fileId ?? null,
    fileName: initial?.fileName ?? null,
    fileType: initial?.fileType ?? null,
    fileData: initial?.fileData ?? null,
  }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)
  useFocusTrap(ref, onCancel)

  const sizes = useMemo(() => detectSizes(text), [text])
  const effectiveSize = Math.min(size, sizes - 1)
  const stats = useMemo(
    () => patternStats(parsePattern(text, { notation, size: effectiveSize })),
    [text, notation, effectiveSize],
  )

  const onImage = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    try {
      const dataUrl = await compressImage(f)
      setImage({ imageId: await putAsset(dataUrl), thumb: await makeThumbnail(dataUrl), image: null })
    } catch {
      setError('Impossible de lire cette image.')
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Ce fichier fait ${(f.size / 1024 / 1024).toFixed(1)} Mo : choisissez un fichier de moins de ${MAX_FILE_MB} Mo.`)
      e.target.value = ''
      return
    }
    setError('')
    setBusy(true)
    try {
      setFile({ fileId: await putAsset(f), fileName: f.name, fileType: f.type || null, fileData: null })
      // un fichier texte est aussi recopié dans le champ texte s'il est vide (active le visualiseur)
      if (f.type.startsWith('text/') && !text.trim()) setText(await f.text())
    } catch {
      setError('Impossible d\'enregistrer ce fichier.')
    } finally {
      setBusy(false)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    if (!name.trim() || busy) return
    onSave({
      ...initial,
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
    <div className="modal-backdrop">
      <form ref={ref} className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="form-title">
        <h2 id="form-title">{initial ? 'Modifier le patron' : 'Nouveau patron'}</h2>
        <div className="field">
          <label htmlFor="f-name">Nom *</label>
          <input id="f-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus
            placeholder="Ex. Bonnet point mousse" />
        </div>
        <div className="field">
          <label htmlFor="f-desc">Description</label>
          <input id="f-desc" value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Courte description (optionnel)" />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="f-hook">Crochet</label>
            <input id="f-hook" value={hook} onChange={(e) => setHook(e.target.value)} placeholder="3,5 mm" />
          </div>
          <div className="field grow">
            <label htmlFor="f-yarn">Fil</label>
            <input id="f-yarn" value={yarn} onChange={(e) => setYarn(e.target.value)} placeholder="Coton, 50 g, rose" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="f-tags">Tags (séparés par des virgules)</label>
          <input id="f-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="amigurumi, cadeau" />
        </div>
        <div className="field">
          <label htmlFor="f-text">Patron (texte)</label>
          <textarea id="f-text" value={text} onChange={(e) => setText(e.target.value)} rows={8}
            placeholder={'Un rang par ligne, par exemple :\nTÊTE\nR1 : 6 ms dans un anneau magique (6)\nR2 : aug dans chaque maille (12)\nR3 : *1 ms, aug* x6 (18)'} />
          <span className="hint" aria-live="polite">
            {stats.rounds === 0
              ? 'Aucun rang détecté pour l\'instant — format « R1 : 6 ms (6) », un rang par ligne, pièces en MAJUSCULES.'
              : <>
                  {stats.rounds} rang{stats.rounds > 1 ? 's' : ''} · {stats.pieces} pièce{stats.pieces > 1 ? 's' : ''}
                  {stats.invalid + stats.misfit > 0
                    ? <span className="warn-msg"> · ⚠ {stats.invalid + stats.misfit} compte(s) à vérifier</span>
                    : <span className="ok-msg"> · ✓ comptes cohérents</span>}
                </>}
          </span>
        </div>
        <div className="field-row">
          <div className="field grow">
            <label htmlFor="f-notation">Notation</label>
            <select id="f-notation" value={notation} onChange={(e) => setNotation(e.target.value)}>
              <option value="auto">Automatique ({detected})</option>
              <option value="us">Française / US (dc = bride)</option>
              <option value="uk">UK (dc = maille serrée)</option>
            </select>
          </div>
          {sizes > 1 && (
            <div className="field grow">
              <label htmlFor="f-size">Taille réalisée</label>
              <select id="f-size" value={effectiveSize} onChange={(e) => setSize(Number(e.target.value))}>
                {Array.from({ length: sizes }, (_, i) => <option key={i} value={i}>Taille {i + 1}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="f-file">Fichier du patron (PDF, image, texte)</label>
          <input id="f-file" type="file" accept=".pdf,image/*,.txt,text/plain" onChange={onFile} />
          {(file.fileId || file.fileData) && (
            <span className="file-info">
              📎 {file.fileName}{' '}
              <button type="button" className="link-btn"
                onClick={() => setFile({ fileId: null, fileName: null, fileType: null, fileData: null })}>retirer</button>
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="f-image">Image de l'objet</label>
          <input id="f-image" type="file" accept="image/*" onChange={onImage} />
          {(image.imageId || image.image) && (
            <span className="file-info image-info">
              {image.thumb && <img src={image.thumb} alt="" />} Image chargée ✓{' '}
              <button type="button" className="link-btn"
                onClick={() => setImage({ imageId: null, thumb: null, image: null })}>retirer</button>
            </span>
          )}
        </div>
        {error && <p className="warn-msg">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onCancel}>Annuler</button>
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Chargement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </div>
  )
}

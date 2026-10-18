import { useEffect, useMemo, useState } from 'react'
import { fileToDataUrl, compressImage } from './storage'
import { parsePattern, patternStats } from './patternParser'

const MAX_FILE_MB = 2

export default function PatternForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [tags, setTags] = useState(initial?.tags?.join(', ') ?? '')
  const [text, setText] = useState(initial?.text ?? '')
  const [image, setImage] = useState(initial?.image ?? null)
  const [fileName, setFileName] = useState(initial?.fileName ?? null)
  const [fileData, setFileData] = useState(initial?.fileData ?? null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const stats = useMemo(() => patternStats(parsePattern(text)), [text])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const onImage = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    try {
      setImage(await compressImage(f))
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Ce fichier fait ${(f.size / 1024 / 1024).toFixed(1)} Mo : le stockage du navigateur est limité (~5 Mo au total). Choisissez un fichier de moins de ${MAX_FILE_MB} Mo.`)
      e.target.value = ''
      return
    }
    setError('')
    setBusy(true)
    try {
      setFileName(f.name)
      setFileData(await fileToDataUrl(f))
      // un fichier texte est aussi recopié dans le champ texte s'il est vide (active le visualiseur)
      if (f.type.startsWith('text/') && !text.trim()) setText(await f.text())
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
      text,
      image,
      fileName,
      fileData,
    })
  }

  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="form-title">
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
        <div className="field">
          <label htmlFor="f-tags">Tags (séparés par des virgules)</label>
          <input id="f-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="amigurumi, cadeau" />
        </div>
        <div className="field">
          <label htmlFor="f-text">Patron (texte)</label>
          <textarea id="f-text" value={text} onChange={(e) => setText(e.target.value)} rows={8}
            placeholder={'Un rang par ligne, par exemple :\nTÊTE\nR1 : 6 ms dans un anneau magique (6)\nR2 : aug dans chaque maille (12)\nR3 : *1 ms, aug* x6 (18)'} />
          <span className="hint">
            {stats.rounds === 0
              ? 'Aucun rang détecté pour l\'instant — format « R1 : 6 ms (6) », un rang par ligne, sections en MAJUSCULES.'
              : <>
                  {stats.rounds} rang{stats.rounds > 1 ? 's' : ''} détecté{stats.rounds > 1 ? 's' : ''} · {stats.sections} pièce{stats.sections > 1 ? 's' : ''}
                  {stats.invalid + stats.misfit > 0
                    ? <span className="warn-msg"> · ⚠ {stats.invalid + stats.misfit} compte(s) à vérifier</span>
                    : <span className="ok-msg"> · ✓ comptes cohérents</span>}
                </>}
          </span>
        </div>
        <div className="field">
          <label htmlFor="f-file">Fichier du patron (PDF, image, texte)</label>
          <input id="f-file" type="file" accept=".pdf,image/*,.txt,text/plain" onChange={onFile} />
          {fileData && (
            <span className="file-info">
              📎 {fileName}{' '}
              <button type="button" className="link-btn" onClick={() => { setFileData(null); setFileName(null) }}>retirer</button>
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="f-image">Image de l'objet</label>
          <input id="f-image" type="file" accept="image/*" onChange={onImage} />
          {image && (
            <span className="file-info image-info">
              <img src={image} alt="" /> Image chargée ✓{' '}
              <button type="button" className="link-btn" onClick={() => setImage(null)}>retirer</button>
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

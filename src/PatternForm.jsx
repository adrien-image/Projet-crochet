import { useState } from 'react'
import { fileToDataUrl } from './storage'

export default function PatternForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [tags, setTags] = useState(initial?.tags?.join(', ') ?? '')
  const [text, setText] = useState(initial?.text ?? '')
  const [image, setImage] = useState(initial?.image ?? null)
  const [fileName, setFileName] = useState(initial?.fileName ?? null)
  const [fileData, setFileData] = useState(initial?.fileData ?? null)

  const onImage = async (e) => {
    const f = e.target.files?.[0]
    if (f) setImage(await fileToDataUrl(f))
  }

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (f) {
      setFileName(f.name)
      setFileData(await fileToDataUrl(f))
    }
  }

  const submit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      ...initial,
      name: name.trim(),
      description: description.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      text,
      image,
      fileName,
      fileData,
    })
  }

  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <h2>{initial ? 'Modifier le patron' : 'Nouveau patron'}</h2>
        <div className="field">
          <label>Nom *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ex. Bonnet point mousse" />
        </div>
        <div className="field">
          <label>Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Courte description (optionnel)" />
        </div>
        <div className="field">
          <label>Tags (séparés par des virgules)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="amigurumi, cadeau" />
        </div>
        <div className="field">
          <label>Patron (texte)</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Collez ici les instructions du patron, rang par rang…" />
        </div>
        <div className="field">
          <label>Fichier du patron (PDF, image…)</label>
          <input type="file" accept=".pdf,image/*,.txt" onChange={onFile} />
          {fileData && <span className="file-info">📎 {fileName}</span>}
        </div>
        <div className="field">
          <label>Image de l'objet</label>
          <input type="file" accept="image/*" onChange={onImage} />
          {image && <span className="file-info">Image chargée ✓</span>}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onCancel}>Annuler</button>
          <button type="submit" className="btn">Enregistrer</button>
        </div>
      </form>
    </div>
  )
}

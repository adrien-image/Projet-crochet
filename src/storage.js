const STORAGE_KEY = 'crochet.patterns.v1'

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function samplePattern() {
  return {
    id: uid(),
    name: 'Amigurumi : petite souris',
    description: 'Un exemple de patron pour découvrir l\'application. Modifie-le ou supprime-le librement !',
    tags: ['amigurumi', 'exemple'],
    createdAt: new Date().toISOString(),
    image: null,
    fileName: null,
    fileData: null,
    text: 'Petite souris amigurumi (crochet 3mm, coton)\n\nCORPS\nR1 : 6 ms dans un anneau magique (6)\nR2 : aug dans chaque maille (12)\nR3 : *1 ms, aug* x6 (18)\nR4 : *2 ms, aug* x6 (24)\nR5-R9 : 24 ms\nR10 : *2 ms, dim* x6 (18)\nR11 : *1 ms, dim* x6 (12)\nBourrer, fermer, rentrer le fil.\n\nOREILLES (x2)\nR1 : 6 ms dans un anneau magique (6)\nR2 : aug dans chaque maille (12)\nFermer, coudre sur la tête.\n\nQUEUE\nChaîner 25 mailles, faire 1 mc dans la 2e maille puis dans chaque maille suivante. Coudre au corps.\n\nASSEMBLAGE\nCoudre les oreilles, broder le nez et les yeux. Terminé ! 🐭',
    checklist: [
      { id: uid() + 'a', text: 'Corps : rangs 1 à 4', done: true },
      { id: uid() + 'b', text: 'Corps : rangs 5 à 9', done: true },
      { id: uid() + 'c', text: 'Corps : rangs 10-11 et bourrage', done: false },
      { id: uid() + 'd', text: 'Oreilles (x2)', done: false },
      { id: uid() + 'e', text: 'Queue', done: false },
      { id: uid() + 'f', text: 'Assemblage et finitions', done: false },
    ],
  }
}

export function loadPatterns() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (Array.isArray(data)) return data
    }
  } catch {
    // corrupted storage, fall through to sample
  }
  const initial = [samplePattern()]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
  return initial
}

export function savePatterns(patterns) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns))
}

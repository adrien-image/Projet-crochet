// Service worker de Mon Crochet : l'application fonctionne hors connexion après une première visite.
// Généré au build (vite.config.ts) : la version et la liste des fichiers sont insérées à la place des
// marqueurs, y compris les fichiers chargés à la demande (aperçu 3D, pdf.js et son worker).
// - page (navigation) : réseau d'abord, copie en cache en secours
// - fichiers du build (noms versionnés par Vite) : cache d'abord
const CACHE = 'mon-crochet-__SW_VERSION__'
const ASSETS = /* __SW_ASSETS__ */ []
const SCOPE = new URL(self.registration.scope)
const INDEX = new URL('./', SCOPE).href

async function precache() {
  const cache = await caches.open(CACHE)
  const res = await fetch(INDEX, { cache: 'no-cache' })
  if (res.ok) await cache.put(INDEX, res)
  await Promise.all(ASSETS.map((u) => cache.add(new URL(u, SCOPE).href).catch(() => {})))
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().catch(() => {}).then(() => self.skipWaiting()))
})

// une nouvelle version remplace l'ancienne : les fichiers des versions précédentes sont libérés
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE && key.startsWith('mon-crochet-')) await caches.delete(key)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== SCOPE.origin || !url.href.startsWith(SCOPE.href)) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(request)
        // seule une vraie page HTML devient la page hors connexion (pas /sw.js ouvert dans un onglet…)
        if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) (await caches.open(CACHE)).put(INDEX, res.clone())
        return res
      } catch {
        return (await caches.match(INDEX)) || Response.error()
      }
    })())
    return
  }

  event.respondWith((async () => {
    const cached = await caches.match(request)
    if (cached) return cached
    const res = await fetch(request)
    if (res.ok && res.type === 'basic') (await caches.open(CACHE)).put(request, res.clone())
    return res
  })())
})

// Service worker de Mon Crochet : l'application fonctionne hors connexion après une première visite.
// - page (navigation) : réseau d'abord, copie en cache en secours
// - fichiers du build (/assets/…, versionnés par Vite) : cache d'abord
const CACHE = 'mon-crochet-v1'
const SCOPE = new URL(self.registration.scope)
const INDEX = new URL('./', SCOPE).href

// Précharge la page et les fichiers qu'elle référence (noms générés par Vite, inconnus à l'avance).
async function precache() {
  const cache = await caches.open(CACHE)
  const res = await fetch(INDEX, { cache: 'no-cache' })
  if (!res.ok) return
  const html = await res.clone().text()
  await cache.put(INDEX, res)
  const urls = new Set(['manifest.webmanifest', 'favicon.svg', 'icon-192.png'].map((u) => new URL(u, SCOPE).href))
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = new URL(m[1], INDEX)
    if (url.origin === SCOPE.origin) urls.add(url.href)
  }
  await Promise.all([...urls].map((u) => cache.add(u).catch(() => {})))
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().catch(() => {}).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
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
        if (res.ok) (await caches.open(CACHE)).put(INDEX, res.clone())
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

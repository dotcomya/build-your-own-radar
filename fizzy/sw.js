/**
 * Service worker : Fizzy doit rester utilisable hors connexion.
 *
 * Stratégie « réseau d'abord, cache en secours » : on sert la version la plus
 * fraîche quand le réseau répond, et la copie en cache sinon. Les données de
 * l'utilisateur ne transitent jamais ici — elles vivent dans localStorage.
 */

const CACHE = 'fizzy-v1'
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/state/store.js',
  './js/state/schema.js',
  './js/engine/engine.js',
  './js/engine/revenue.js',
  './js/engine/payroll.js',
  './js/engine/taxes.js',
  './js/engine/fiscal-fr-2026.js',
  './js/ui/dom.js',
  './js/ui/charts.js',
  './js/ui/glossary.js',
  './js/ui/pages/onboarding.js',
  './js/ui/pages/dashboard.js',
  './js/ui/pages/offer.js',
  './js/ui/pages/marketing.js',
  './js/ui/pages/team.js',
  './js/ui/pages/costs.js',
  './js/ui/pages/financing.js',
  './js/ui/pages/results.js',
  './js/ui/pages/businesscase.js',
  './js/ui/pages/settings.js',
  './js/export/pptx.js',
  './js/export/zip.js',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== location.origin && !url.hostname.endsWith('gstatic.com') && !url.hostname.endsWith('googleapis.com')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
        }
        return response
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))),
  )
})

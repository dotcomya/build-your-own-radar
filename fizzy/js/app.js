/**
 * Point d'entrée : charpente, navigation et rendu.
 *
 * Une seule source de vérité — le scénario du store. Chaque page est une
 * fonction pure qui produit un fragment de DOM à partir de cet état. Naviguer
 * ne perd rien : l'état survit aux changements de page comme aux rechargements.
 */

import { h, clear, setDrawerHost, toast, euro } from './ui/dom.js'
import { GLOSSARY } from './ui/glossary.js'
import store from './state/store.js'
import { LEVEL_META } from './state/schema.js'

import { renderOnboarding } from './ui/pages/onboarding.js'
import { renderDashboard } from './ui/pages/dashboard.js'
import { renderOffer } from './ui/pages/offer.js'
import { renderMarketing } from './ui/pages/marketing.js'
import { renderTeam } from './ui/pages/team.js'
import { renderCosts } from './ui/pages/costs.js'
import { renderFinancing } from './ui/pages/financing.js'
import { renderResults } from './ui/pages/results.js'
import { renderBusinessCase } from './ui/pages/businesscase.js'
import { renderSettings } from './ui/pages/settings.js'

const PAGES = {
  'tableau-de-bord': { label: 'Tableau de bord', icon: '◱', render: renderDashboard, levels: ['easy', 'intermediate', 'advanced'], tab: true },
  offre: { label: 'Offre et clients', icon: '◈', render: renderOffer, levels: ['easy', 'intermediate', 'advanced'], tab: true },
  marketing: { label: 'Marketing', icon: '◎', render: renderMarketing, levels: ['easy', 'intermediate', 'advanced'], tab: true },
  equipe: { label: 'Équipe', icon: '◷', render: renderTeam, levels: ['easy', 'intermediate', 'advanced'], tab: true },
  charges: { label: 'Charges', icon: '▦', render: renderCosts, levels: ['easy', 'intermediate', 'advanced'] },
  financement: { label: 'Financement', icon: '◇', render: renderFinancing, levels: ['easy', 'intermediate', 'advanced'] },
  resultats: { label: 'États financiers', icon: '▤', render: renderResults, levels: ['easy', 'intermediate', 'advanced'], tab: true },
  'business-case': { label: 'Business case', icon: '◆', render: renderBusinessCase, levels: ['easy', 'intermediate', 'advanced'] },
  reglages: { label: 'Réglages', icon: '⚙', render: renderSettings, levels: ['easy', 'intermediate', 'advanced'] },
}

const GROUPS = [
  { title: 'Piloter', keys: ['tableau-de-bord'] },
  { title: 'Construire', keys: ['offre', 'marketing', 'equipe', 'charges', 'financement'] },
  { title: 'Analyser', keys: ['resultats', 'business-case'] },
  { title: '', keys: ['reglages'] },
]

const root = document.getElementById('app')
let currentRoute = null

function route() {
  const hash = location.hash.replace(/^#\/?/, '') || ''
  return hash.split('?')[0]
}

function navigate(to) {
  location.hash = to.startsWith('#') ? to : `#/${to}`
}

function render({ preserveScroll = false } = {}) {
  const key = route()
  const scrollY = preserveScroll ? window.scrollY : 0
  const activeId = preserveScroll ? document.activeElement?.dataset?.fieldKey : null
  currentRoute = key

  // Sans profil ni scénario, on passe par l'accueil.
  if (!store.hasProfile() || !store.scenario || key === '' || key === 'demarrer') {
    clear(root).appendChild(renderOnboarding(navigate))
    document.title = 'Fizzy — Business plan'
    window.scrollTo(0, 0)
    return
  }

  const page = PAGES[key] || PAGES['tableau-de-bord']
  if (!PAGES[key]) { navigate('#/tableau-de-bord'); return }

  const main = h('div', { class: 'main' }, topbar(page), page.render(navigate, render))
  clear(root).appendChild(h('div', { class: 'shell' }, rail(key), main, tabbar(key)))
  document.title = `${page.label} — ${store.scenario.meta.name}`
  if (preserveScroll) {
    window.scrollTo(0, scrollY)
    // Rendre la main au champ que l'utilisateur venait de quitter, s'il existe
    // encore : le recalcul ne doit pas casser la navigation au clavier.
    if (activeId) {
      const next = document.querySelector(`[data-field-key="${CSS.escape(activeId)}"]`)
      if (next) next.focus()
    }
  } else {
    window.scrollTo(0, 0)
  }
}

function rail(active) {
  const el = h('nav', { class: 'rail', id: 'rail' },
    h('div', { class: 'rail-brand' },
      h('div', { class: 'rail-logo' }, 'F'),
      h('div', {}, h('div', { class: 'rail-name' }, 'Fizzy'), h('div', { class: 'rail-tag' }, 'Business plan')),
    ),
    ...GROUPS.flatMap((group) => {
      const keys = group.keys.filter((k) => PAGES[k].levels.includes(store.level))
      if (!keys.length) return []
      return [
        group.title && h('div', { class: 'rail-section' }, group.title),
        ...keys.map((k) => {
          const p = PAGES[k]
          const warn = store.issues.some((i) => i.page === k && i.level !== 'info')
          return h('button', {
            class: `rail-link ${active === k ? 'active' : ''}`,
            onClick: () => { navigate(`#/${k}`); document.getElementById('rail')?.classList.remove('open') },
          }, h('span', { class: 'ico' }, p.icon), h('span', {}, p.label), warn && h('span', { class: 'badge-dot' }))
        }),
      ]
    }),
    h('div', { class: 'rail-foot' },
      h('button', { class: 'rail-link', onClick: () => { navigate('#/demarrer') } },
        h('span', { class: 'ico' }, '＋'), h('span', {}, 'Nouveau projet')),
      h('div', { class: 'tiny', style: { padding: '10px 10px 0', color: 'var(--ink-600)' } },
        store.profile?.name || '', h('br'), h('span', { style: { color: 'var(--ink-700)' } }, saveLabel())),
    ),
  )
  return el
}

function saveLabel() {
  return store.saveState === 'error' ? 'Sauvegarde impossible' : 'Enregistré sur cet appareil'
}

function topbar(page) {
  const canUndo = store.canUndo(), canRedo = store.canRedo()
  return h('header', { class: 'topbar' },
    h('button', {
      class: 'btn btn-sm btn-ghost mobile-only', 'aria-label': 'Menu',
      onClick: () => document.getElementById('rail')?.classList.toggle('open'),
    }, '☰'),
    h('div', {},
      h('div', { class: 'crumb' }, store.scenario.meta.name),
      h('h1', {}, page.label),
    ),
    h('span', { class: 'spacer' }),
    h('div', { class: 'levels', title: LEVEL_META[store.level]?.description },
      // Les deux libellés coexistent dans le DOM, l'affichage bascule en CSS
      // selon la largeur : on nomme le bouton pour que les lecteurs d'écran
      // n'entendent pas le libellé deux fois.
      ...Object.entries(LEVEL_META).map(([k, v]) => h('button', {
        class: `level-btn ${store.level === k ? 'active' : ''}`,
        'aria-label': `Niveau ${v.label}`,
        'aria-pressed': store.level === k ? 'true' : 'false',
        onClick: () => { store.setLevel(k); render(); toast(`Niveau ${v.label} — ${v.tagline}`) },
      },
        h('span', { class: 'lvl-long', 'aria-hidden': 'true' }, v.label),
        h('span', { class: 'lvl-short', 'aria-hidden': 'true' }, v.short || v.label))),
    ),
    h('button', { class: 'btn btn-sm btn-ghost desktop-only', disabled: !canUndo, title: 'Annuler', onClick: () => { store.undo(); render() } }, '↶'),
    h('button', { class: 'btn btn-sm btn-ghost desktop-only', disabled: !canRedo, title: 'Rétablir', onClick: () => { store.redo(); render() } }, '↷'),
  )
}

function tabbar(active) {
  const keys = Object.keys(PAGES).filter((k) => PAGES[k].tab && PAGES[k].levels.includes(store.level))
  keys.push('business-case')
  return h('nav', { class: 'tabbar' },
    ...keys.map((k) => h('button', {
      class: `tab ${active === k ? 'active' : ''}`,
      onClick: () => navigate(`#/${k}`),
    }, h('span', { class: 'ico' }, PAGES[k].icon), h('span', {}, shortLabel(PAGES[k].label)))),
  )
}

const shortLabel = (l) => ({ 'Tableau de bord': 'Pilotage', 'Offre et clients': 'Offre', 'États financiers': 'Résultats', 'Business case': 'Dossier' }[l] || l)

// ───────────────────────────── Tiroir du glossaire ─────────────────────────
setDrawerHost((key) => {
  const entry = GLOSSARY[key]
  if (!entry) return
  const close = () => { scrim.remove(); drawer.remove() }
  const scrim = h('div', { class: 'scrim', onClick: close })
  const drawer = h('aside', { class: 'drawer', role: 'dialog', 'aria-label': entry.title },
    h('div', { class: 'drawer-head' },
      h('div', { class: 'spacer' }, h('h2', {}, entry.title)),
      h('button', { class: 'btn btn-sm btn-ghost', onClick: close, 'aria-label': 'Fermer' }, '✕'),
    ),
    h('div', { class: 'drawer-body' },
      h('h4', {}, "De quoi s'agit-il"),
      h('p', {}, entry.what),
      entry.formula && [h('h4', {}, 'Formule'), h('div', { class: 'formula' }, entry.formula)],
      entry.how && [h('h4', {}, 'Comment Fizzy le calcule'), h('p', {}, entry.how)],
      entry.use && [h('h4', {}, 'À quoi ça sert'), h('p', {}, entry.use)],
      entry.watch && [h('h4', {}, 'Point de vigilance'), h('div', { class: 'note warn' }, entry.watch)],
      currentValue(key),
    ),
  )
  document.body.append(scrim, drawer)
  const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey) } }
  document.addEventListener('keydown', onKey)
})

/** Rattache la définition aux chiffres du scénario ouvert. */
function currentValue(key) {
  const r = store.result
  if (!r) return null
  const y = r.pnl.netResult.findIndex((v) => v > 0)
  const ref = y >= 0 ? y : 2
  const map = {
    pointMort: () => r.kpis.breakEven[ref] ? `${euro(r.kpis.breakEven[ref])} en année ${ref + 1}` : null,
    ebitda: () => `${euro(r.pnl.ebitda[ref])} en année ${ref + 1}`,
    ebit: () => `${euro(r.pnl.ebit[ref])} en année ${ref + 1}`,
    margeBrute: () => `${euro(r.pnl.grossMargin[ref])} en année ${ref + 1}`,
    valeurAjoutee: () => `${euro(r.pnl.valueAdded[ref])} en année ${ref + 1}`,
    bfr: () => `${euro(r.kpis.peakBfr)} au maximum`,
    tresorerie: () => `${euro(r.cash.yearEnd[0])} en fin d'année 1`,
    runway: () => (r.kpis.runwayMonths === null ? null : `${Math.round(r.kpis.runwayMonths)} mois`),
    cac: () => (r.kpis.cac ? euro(r.kpis.cac) : null),
    ltv: () => (r.kpis.ltv ? `${euro(r.kpis.ltv)} par client` : null),
    is: () => `${euro(r.pnl.corporateTax[ref])} en année ${ref + 1}`,
    cir: () => (r.credits[ref]?.cir ? euro(r.credits[ref].cir) : null),
    cii: () => (r.credits[ref]?.cii ? euro(r.credits[ref].cii) : null),
    marginRate: () => `${(r.kpis.marginRate[ref] * 100).toFixed(1).replace('.', ',')} %`,
  }
  const value = map[key]?.()
  if (!value) return null
  return h('div', { class: 'note ok', style: { marginTop: '18px' } },
    h('div', { class: 'note-title' }, 'Dans votre scénario'),
    value)
}

// ────────────────────────────────── Démarrage ──────────────────────────────
window.addEventListener('hashchange', render)
store.subscribe((_, reason) => {
  if (reason === 'scenario' || reason === 'profile') render()
  // Une modification de données relance le calcul : on redessine la page pour
  // que les indicateurs suivent, en conservant la position de lecture.
  else if (reason === 'data') render({ preserveScroll: true })
})

if (!location.hash) location.hash = '#/'
render()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}

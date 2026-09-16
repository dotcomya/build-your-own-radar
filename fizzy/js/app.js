/**
 * Point d'entrée : charpente, navigation et rendu.
 *
 * Une seule source de vérité — le scénario du store. Chaque page est une
 * fonction pure qui produit un fragment de DOM à partir de cet état. Naviguer
 * ne perd rien : l'état survit aux changements de page comme aux rechargements.
 */

import { h, clear, setDrawerHost, toast, euro, narrow } from './ui/dom.js'
import { GLOSSARY } from './ui/glossary.js'
import store from './state/store.js'
import { LEVEL_META } from './state/schema.js'
import { PERSONAS, getPersona } from './ui/personas.js'
import { impactRail, resetLiveNumbers } from './ui/impact.js'

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
import { renderFounder } from './ui/pages/founder.js'
import { renderJourney } from './ui/pages/journey.js'
import { renderModel } from './ui/pages/model.js'
import { renderSetup, resetSetup } from './ui/pages/setup.js'
import { journey, points } from './engine/journey.js'
import { cloud, onCloud, syncLabel } from './state/cloud.js'
import { guideBar } from './ui/guide.js'
import { renderAccount } from './ui/pages/account.js'

const PAGES = {
  parcours: { label: 'Mon parcours', icon: '◍', render: renderJourney, levels: ['easy', 'intermediate', 'advanced'], tab: true },
  'tableau-de-bord': { label: 'Tableau de bord', icon: '◱', render: renderDashboard, levels: ['easy', 'intermediate', 'advanced'], tab: true },
  modele: { label: 'Mon modèle', icon: '◈', render: renderModel, levels: ['easy', 'intermediate', 'advanced'], tab: true },
  offre: { label: 'Offre et clients', icon: '◑', render: renderOffer, levels: ['easy', 'intermediate', 'advanced'], tab: true },
  marketing: { label: 'Marketing', icon: '◎', render: renderMarketing, levels: ['easy', 'intermediate', 'advanced'] },
  equipe: { label: 'Équipe', icon: '◷', render: renderTeam, levels: ['easy', 'intermediate', 'advanced'] },
  charges: { label: 'Charges', icon: '▦', render: renderCosts, levels: ['easy', 'intermediate', 'advanced'] },
  financement: { label: 'Financement', icon: '◇', render: renderFinancing, levels: ['easy', 'intermediate', 'advanced'] },
  resultats: { label: 'États financiers', icon: '▤', render: renderResults, levels: ['easy', 'intermediate', 'advanced'] },
  'mon-revenu': { label: 'Ce que je touche', icon: '◉', render: renderFounder, levels: ['easy', 'intermediate', 'advanced'] },
  'business-case': { label: 'Business case', icon: '◆', render: renderBusinessCase, levels: ['easy', 'intermediate', 'advanced'] },
  compte: { label: 'Mon compte', icon: '◍', render: renderAccount, levels: ['easy', 'intermediate', 'advanced'] },
  reglages: { label: 'Réglages', icon: '⚙', render: renderSettings, levels: ['easy', 'intermediate', 'advanced'] },
}

// L'ordre du rail suit le parcours, pas l'organigramme d'un cabinet : on
// construit d'abord, on analyse ensuite.
const GROUPS = [
  { title: '', keys: ['parcours'] },
  { title: 'Construire', keys: ['modele', 'offre', 'marketing', 'equipe', 'charges', 'financement'] },
  { title: 'Lire', keys: ['tableau-de-bord', 'resultats', 'mon-revenu', 'business-case'] },
  { title: '', keys: ['compte', 'reglages'] },
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

  // On n'impose l'accueil que s'il n'y a rien à montrer : avec un scénario
  // d'exemple chargé, l'outil s'ouvre directement en fonctionnement.
  // Le parcours guidé vit hors de la charpente : pas de rail, pas d'onglets,
  // rien d'autre que la question en cours. C'est ce qui le rend lisible.
  if (key === 'creer') {
    clear(root).appendChild(renderSetup(navigate, render))
    document.title = 'Fizzy — Votre business plan'
    return
  }

  if (!store.scenario || key === 'demarrer' || key === '') {
    clear(root).appendChild(renderOnboarding(navigate))
    document.title = 'Fizzy — Business plan'
    window.scrollTo(0, 0)
    return
  }

  const page = PAGES[key] || PAGES.parcours
  if (!PAGES[key]) { navigate('#/parcours'); return }
  if (!getPersona(store.persona).pages.includes(key)) { navigate('#/parcours'); return }

  const main = h('div', { class: 'main' }, topbar(page), page.render(navigate, render))
  clear(root).appendChild(h('div', { class: 'shell' },
    rail(key), main, guideBar(key, navigate), tabbar(key), impactRail(render)))
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
      const allowed = getPersona(store.persona).pages
      const keys = group.keys.filter((k) => PAGES[k].levels.includes(store.level) && allowed.includes(k))
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
    // Sur mobile, la barre supérieure n'a pas la place du sélecteur de
    // profondeur : il trouve sa place ici, dans le menu.
    getPersona(store.persona).hasDepth && h('div', { class: 'rail-levels' },
      h('div', { class: 'rail-section' }, 'Profondeur'),
      h('div', { class: 'levels', style: { width: '100%' } },
        ...Object.entries(LEVEL_META).map(([k, v]) => h('button', {
          class: `level-btn ${store.level === k ? 'active' : ''}`,
          style: { flex: '1' },
          'aria-label': `Niveau ${v.label}`,
          onClick: () => {
            store.setLevel(k)
            document.getElementById('rail')?.classList.remove('open')
            render()
            toast(`${v.label} \u2014 ${v.tagline}`)
          },
        }, h('span', { class: 'lvl-short', 'aria-hidden': 'true' }, v.short || v.label))),
      ),
    ),

    h('div', { class: 'rail-foot' },
      h('button', { class: 'rail-link', onClick: () => { resetSetup(); navigate('#/creer') } },
        h('span', { class: 'ico' }, '＋'), h('span', {}, 'Nouveau plan')),
      h('button', {
        class: 'rail-account', onClick: () => { navigate('#/compte'); document.getElementById('rail')?.classList.remove('open') },
      },
        h('span', { class: 'rail-account-name' }, cloud.name || store.profile?.name || 'Mon compte'),
        h('span', { class: `rail-account-sync ${cloud.status === 'ready' ? 'live' : ''}` },
          cloud.status === 'ready' ? h('i', { class: 'sync-dot' }) : null,
          saveLabel()),
      ),
    ),
  )
  return el
}

function saveLabel() {
  if (store.saveState === 'error') return 'Sauvegarde impossible'
  return syncLabel()
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
    progressPill(),
    // La profondeur ne concerne que le fondateur : les autres metiers ont un
    // perimetre defini par leur fonction, pas par un curseur de detail.
    getPersona(store.persona).hasDepth && h('div', { class: 'levels desktop-only', title: LEVEL_META[store.level]?.description },
      ...Object.entries(LEVEL_META).map(([k, v]) => h('button', {
        class: `level-btn ${store.level === k ? 'active' : ''}`,
        'aria-label': `Niveau ${v.label}`,
        'aria-pressed': store.level === k ? 'true' : 'false',
        onClick: () => { store.setLevel(k); render(); toast(`${v.label} — ${v.tagline}`) },
      },
        h('span', { class: 'lvl-long', 'aria-hidden': 'true' }, v.label),
        h('span', { class: 'lvl-short', 'aria-hidden': 'true' }, v.short || v.label))),
    ),
    h('button', { class: 'btn btn-sm btn-ghost desktop-only', disabled: !canUndo, title: 'Annuler', onClick: () => { store.undo(); render() } }, '↶'),
    h('button', { class: 'btn btn-sm btn-ghost desktop-only', disabled: !canRedo, title: 'Rétablir', onClick: () => { store.redo(); render() } }, '↷'),
  )
}

/**
 * La pastille d'avancement.
 *
 * Elle remplace le sélecteur de métier en tête de page : ce qu'un fondateur
 * veut savoir en permanence, ce n'est pas quelle casquette il porte, c'est
 * combien il lui reste à faire. Un clic ramène au parcours.
 */
function progressPill() {
  const j = journey(store.scenario, store.result)
  const pts = points(j)
  return h('button', {
    class: `progress-pill ${j.completion >= 1 ? 'complete' : ''}`,
    title: `${j.done} étapes terminées sur ${j.total}`,
    onClick: () => navigate('#/parcours'),
  },
    h('span', { class: 'progress-pill-bar', 'aria-hidden': 'true' },
      h('i', { style: { width: `${pts}%` } })),
    h('span', { class: 'progress-pill-value num' }, `${pts} %`),
    h('span', { class: 'progress-pill-label desktop-only' },
      j.completion >= 1 ? 'complet' : `${j.done}/${j.total} étapes`),
  )
}


function tabbar(active) {
  const allowed = getPersona(store.persona).pages
  const keys = Object.keys(PAGES).filter((k) => PAGES[k].tab && PAGES[k].levels.includes(store.level) && allowed.includes(k))
  if (allowed.includes('business-case')) keys.push('business-case')
  return h('nav', { class: 'tabbar' },
    ...keys.map((k) => h('button', {
      class: `tab ${active === k ? 'active' : ''}`,
      onClick: () => navigate(`#/${k}`),
    }, h('span', { class: 'ico' }, PAGES[k].icon), h('span', {}, shortLabel(PAGES[k].label)))),
  )
}

const shortLabel = (l) => ({ 'Mon parcours': 'Parcours', 'Tableau de bord': 'Bilan', 'Mon modèle': 'Modèle',
  'Offre et clients': 'Clients', 'États financiers': 'Comptes', 'Ce que je touche': 'Ma paie',
  'Business case': 'Dossier' }[l] || l)

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

// Certains dessins sont composés différemment sur un écran étroit : ils sont
// donc redessinés quand la fenêtre franchit la limite, et à ce moment-là seul.
// Redessiner à chaque pixel de redimensionnement coûterait cher pour rien.
let wasNarrow = narrow()
window.addEventListener('resize', () => {
  if (narrow() === wasNarrow) return
  wasNarrow = narrow()
  render({ preserveScroll: true })
})

// ────────────────────────────────── Démarrage ──────────────────────────────
window.addEventListener('hashchange', render)
/**
 * La célébration d'une étape franchie.
 *
 * Un parcours qui ne dit rien quand on avance n'est pas un parcours. On compare
 * l'avancement avant et après chaque modification, et on ne félicite que sur un
 * franchissement réel — jamais sur une frappe au clavier.
 */
let lastDone = new Set()

/**
 * Relève l'état du parcours sans rien annoncer — au chargement d'un plan.
 *
 * Et complète les dates manquantes : un plan importé, ou rempli avant que
 * Fizzy ne date les franchissements, a des étapes faites sans date. On les
 * rattache à la dernière modification du plan plutôt que de les laisser vides,
 * sinon l'historique ment par omission.
 */
function markJourney() {
  if (!store.scenario || !store.result) { lastDone = new Set(); return }
  const j = journey(store.scenario, store.result)
  const done = j.steps.filter((s) => s.status === 'done').map((s) => s.key)
  lastDone = new Set(done)
  store.backfillSteps(done)
}

function celebrate() {
  if (!store.scenario || !store.result) return
  const j = journey(store.scenario, store.result)
  const done = new Set(j.steps.filter((s) => s.status === 'done').map((s) => s.key))
  const fresh = [...done].filter((k) => !lastDone.has(k))
  lastDone = done
  if (!fresh.length) return
  // La date du franchissement part avec le plan : elle survit au rechargement
  // et à un changement d'appareil.
  store.markSteps(fresh)
  const step = j.steps.find((s) => s.key === fresh[0])
  const left = j.total - j.done
  toast(left === 0
    ? `${step.label} \u2713 Ton business plan est complet.`
    : `${step.label} \u2713 ${points(j)} % \u2014 il reste ${left} étape${left > 1 ? 's' : ''}.`, 'ok')
}

store.subscribe((_, reason) => {
  if (reason === 'scenario' || reason === 'profile') { markJourney(); resetLiveNumbers(); render() }
  // Une modification de données relance le calcul : on redessine la page pour
  // que les indicateurs suivent, en conservant la position de lecture.
  else if (reason === 'data') { celebrate(); render({ preserveScroll: true }) }
})

markJourney()
if (!location.hash) location.hash = store.scenario ? '#/parcours' : '#/'
render()

// Le compte s'ouvre après le premier rendu : la page ne doit jamais attendre
// le réseau pour s'afficher. Le rail se met à jour quand la réponse arrive.
onCloud(() => {
  const foot = document.querySelector('.rail-account-sync')
  if (foot) {
    foot.className = `rail-account-sync ${cloud.status === 'ready' ? 'live' : ''}`
    foot.replaceChildren(...[
      cloud.status === 'ready' ? h('i', { class: 'sync-dot' }) : null,
      saveLabel(),
    ].filter(Boolean))
  }
  const name = document.querySelector('.rail-account-name')
  if (name && cloud.name) name.textContent = cloud.name
})
store.syncAccount()

// Le service worker n'accompagne que la version auto-hébergée : la page
// publiée n'en sert pas et tenterait un enregistrement voué à l'échec.
if (window.__FIZZY_HAS_SW__ && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}

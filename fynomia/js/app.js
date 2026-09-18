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
import { PERSONAS, getPersona } from './ui/personas.js'
import { impactRail, resetLiveNumbers } from './ui/impact.js'

import { renderOnboarding } from './ui/pages/onboarding.js'
import { settle } from './ui/spotlight.js'
import { installMotion } from './ui/motion.js'
import { renderDashboard } from './ui/pages/dashboard.js'
import { renderOffer } from './ui/pages/offer.js'
import { renderTeam } from './ui/pages/team.js'
import { renderCosts } from './ui/pages/costs.js'
import { renderFinancing } from './ui/pages/financing.js'
import { renderResults } from './ui/pages/results.js'
import { renderBusinessCase } from './ui/pages/businesscase.js'
import { renderSettings } from './ui/pages/settings.js'
import { renderFounder } from './ui/pages/founder.js'
import { renderProject } from './ui/pages/project.js'
import { renderSetup, resetSetup } from './ui/pages/setup.js'
import { journey, points } from './engine/journey.js'
import { buildState } from './engine/build.js'
import { liveRail } from './ui/live.js'
import { cloud, onCloud, syncLabel } from './state/cloud.js'
import { renderAccount } from './ui/pages/account.js'

/**
 * Les neuf modules.
 *
 * L'ordre suit la construction d'un prévisionnel, pas l'organigramme d'un
 * cabinet comptable : on pose le cadre, on décrit ce qu'on vend, ce que ça
 * coûte, qui le fait, avec quel argent — puis on lit ce que ça donne.
 *
 * Il n'y a plus de niveaux. Chaque module pose ses questions au premier degré
 * et range la profondeur derrière « affiner », là où elle sert. Personne n'a
 * à se déclarer débutant ou expert pour construire le même modèle.
 */
const PAGES = {
  projet: { no: '01', label: 'Projet', render: renderProject, build: true },
  offre: { no: '02', label: 'Offre & revenus', render: renderOffer, build: true },
  achats: { no: '03', label: 'Achats & coûts', render: renderCosts, build: true },
  equipe: { no: '04', label: 'Équipe', render: renderTeam, build: true },
  financement: { no: '05', label: 'Financement', render: renderFinancing, build: true },
  'tableau-de-bord': { no: '06', label: 'Tableau de bord', render: renderDashboard },
  resultats: { no: '07', label: 'États financiers', render: renderResults },
  'business-case': { no: '08', label: 'Business case', render: renderBusinessCase },
  reglages: { no: '09', label: 'Réglages', render: renderSettings },
}

// Les anciennes adresses restent valides : un lien enregistré ou un signet ne
// doit pas tomber à côté parce que le produit s'est réorganisé.
const ALIASES = {
  modele: 'projet',
  charges: 'achats',
  marketing: 'offre',
  clients: 'offre',
  compte: 'reglages',
  'mon-revenu': 'resultats',
  parcours: 'tableau-de-bord',
}

const GROUPS = [
  { title: 'Construire', keys: ['projet', 'offre', 'achats', 'equipe', 'financement'] },
  { title: 'Lire', keys: ['tableau-de-bord', 'resultats', 'business-case'] },
  { title: '', keys: ['reglages'] },
]

const root = document.getElementById('app')
let currentRoute = null

function route() {
  const hash = location.hash.replace(/^#\/?/, '') || ''
  return hash.split('?')[0]
}

function navigate(to) {
  const next = to.startsWith('#') ? to : `#/${to}`
  // Cliquer sur le module où l'on se trouve déjà ne change pas l'adresse, donc
  // ne déclenche aucun événement : l'écran restait figé et le clic semblait
  // perdu. On redessine explicitement dans ce cas.
  if (location.hash === next) { render(); window.scrollTo(0, 0); return }
  location.hash = next
}

// La route courante, retenue pour que la barre du haut puisse annoncer ce que
// chaque profondeur ajoute à cette page-ci.
let currentKey = ''

function render({ preserveScroll = false } = {}) {
  const key = route()
  currentKey = key
  const scrollY = preserveScroll ? window.scrollY : 0
  const activeId = preserveScroll ? document.activeElement?.dataset?.fieldKey : null
  currentRoute = key

  // On n'impose l'accueil que s'il n'y a rien à montrer : avec un scénario
  // d'exemple chargé, l'outil s'ouvre directement en fonctionnement.
  // Le parcours guidé vit hors de la charpente : pas de rail, pas d'onglets,
  // rien d'autre que la question en cours. C'est ce qui le rend lisible.
  if (key === 'creer') {
    clear(root).appendChild(renderSetup(navigate, render))
    document.title = 'Fynomia — Ton business plan'
    return
  }

  if (!store.scenario || key === 'demarrer' || key === '') {
    // Sans plan, l'accueil est la première question : une page de garde qui ne
    // fait qu'annoncer l'étape suivante n'apporte rien.
    if (!store.scenario) { resetSetup(); navigate('#/creer'); return }
    clear(root).appendChild(renderOnboarding(navigate))
    document.title = 'Fynomia — Business plan'
    window.scrollTo(0, 0)
    return
  }

  if (ALIASES[key]) { navigate(`#/${ALIASES[key]}`); return }
  const page = PAGES[key] || PAGES['tableau-de-bord']
  if (!PAGES[key]) { navigate('#/tableau-de-bord'); return }

  // Une page se redessine des dizaines de fois pendant la saisie — un clic sur
  // un pavé, une case cochée, une ligne ajoutée. Si ce redessin remonte en haut
  // de page, on perd l'endroit où l'on travaillait. Seule une vraie navigation
  // remet l'écran à zéro.
  const refresh = (opts) => render({ preserveScroll: true, ...(opts || {}) })
  const main = h('div', { class: 'main' }, topbar(page, key), page.render(navigate, refresh))
  clear(root).appendChild(h('div', { class: 'shell' },
    rail(key), main, liveRail(navigate), tabbar(key), impactRail(refresh)))
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
  // Une intention posée par le panneau « à affiner » attend ici : la page vient
  // d'être construite, le repère existe, on peut l'entourer.
  settle()
}



function rail(active) {
  const b = buildState(store.scenario)
  const doneByPage = Object.fromEntries(b.bricks.map((x) => [x.page, x.done]))

  const el = h('nav', { class: 'rail', id: 'rail' },
    h('div', { class: 'rail-brand' },
      h('span', { class: 'rail-mark' }, 'FYNOMIA'),
      h('span', { class: 'rail-year' }, 'FR / 2026'),
    ),
    h('div', { class: 'rail-claim' },
      h('b', {}, 'Le business plan, sans la couche de vernis.'),
      'On construit le mod\u00e8le. Les \u00e9tats financiers suivent.'),

    ...GROUPS.flatMap((group) => [
      group.title ? h('div', { class: 'rail-section' }, group.title) : null,
      ...group.keys.map((k) => {
        const p = PAGES[k]
        const warn = store.issues.some((i) => i.page === k && i.level !== 'info')
        const done = p.build ? !!doneByPage[k] : false
        return h('button', {
          class: `rail-link ${active === k ? 'active' : ''} ${done ? 'done' : ''}`,
          onClick: () => { navigate(`#/${k}`); document.getElementById('rail')?.classList.remove('open') },
        },
          h('span', { class: 'rail-no' }, p.no),
          h('span', {}, p.label),
          warn ? h('span', { class: 'badge-dot' }) : p.build ? h('span', { class: 'rail-tick' }, done ? '\u25cf' : '\u25cb') : null,
        )
      }),
    ]),

    h('div', { class: 'rail-foot' },
      h('button', { class: 'rail-link', onClick: () => { resetSetup(); navigate('#/creer') } },
        h('span', { class: 'rail-no' }, '\uff0b'), h('span', {}, 'Nouveau plan')),
      h('button', {
        class: 'rail-account', onClick: () => { navigate('#/reglages'); document.getElementById('rail')?.classList.remove('open') },
      },
        h('span', { class: 'rail-account-name' }, cloud.user?.name || 'Mon compte'),
        h('span', { class: 'rail-account-sync' }, syncLabel()),
      ),
    ),
  )
  return el
}

function topbar(page, key) {
  const canUndo = store.canUndo(), canRedo = store.canRedo()
  return h('header', { class: 'topbar' },
    h('button', {
      class: 'btn btn-sm btn-ghost mobile-only', 'aria-label': 'Menu',
      onClick: () => document.getElementById('rail')?.classList.toggle('open'),
    }, '\u2630'),
    h('div', { class: 'crumb' },
      `${store.scenario.meta.company || store.scenario.meta.name} / ${page.label}`),
    h('span', { class: 'spacer' }),
    progressPill(),
    h('button', { class: 'btn btn-sm btn-ghost desktop-only', disabled: !canUndo, title: 'Annuler', onClick: () => { store.undo(); render() } }, '\u21b6'),
    h('button', { class: 'btn btn-sm btn-ghost desktop-only', disabled: !canRedo, title: 'R\u00e9tablir', onClick: () => { store.redo(); render() } }, '\u21b7'),
    key !== 'tableau-de-bord' ? h('button', {
      class: 'btn btn-sm btn-go btn-pill desktop-only', onClick: () => navigate('#/tableau-de-bord'),
    }, 'Voir la synth\u00e8se') : null,
  )
}

/**
 * L'avancement, dit par ce qu'il débloque.
 *
 * « Étape 4 sur 12 » mesure le remplissage d'un formulaire. Ce qui donne envie
 * de continuer, c'est de savoir ce qu'on vient de rendre possible : d'abord le
 * chiffre d'affaires, puis la marge, puis la rentabilité, puis le besoin de
 * financement. La barre suit les briques posées ; le mot dit la capacité
 * atteinte.
 */
function progressPill() {
  const b = buildState(store.scenario)
  const label = b.latest ? b.latest.label.replace(/^Ton |^Ta /, '').replace(/ est calculable\.$/, '') : 'Mod\u00e8le \u00e0 poser'
  const done = !!b.latest && b.latest.key === 'dossier'
  return h('button', {
    class: `progress-pill ${done ? 'complete' : ''}`,
    title: b.upcoming ? `Ensuite : ${b.upcoming.label}` : 'Ton business plan est prêt.',
    onClick: () => navigate(b.next ? `#/${b.next.page}` : '#/tableau-de-bord'),
  },
    h('span', { class: 'progress-pill-bar' }, h('i', { style: { width: `${Math.round(b.ratio * 100)}%` } })),
    h('span', { class: 'progress-pill-value' }, done ? 'Dossier pr\u00eat' : label),
    h('span', { class: 'progress-pill-label' }, `${b.done}/${b.total}`),
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

const shortLabel = (l) => ({ 'Tableau de bord': 'Bilan', 'Mon modèle': 'Modèle',
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
      entry.how && [h('h4', {}, 'Comment Fynomia le calcule'), h('p', {}, entry.how)],
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
    h('div', { class: 'note-title' }, 'Dans ton scénario'),
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
 * Fynomia ne date les franchissements, a des étapes faites sans date. On les
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
installMotion()
if (!location.hash) location.hash = store.scenario ? '#/tableau-de-bord' : '#/creer'
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
if (window.__FYNOMIA_HAS_SW__ && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}

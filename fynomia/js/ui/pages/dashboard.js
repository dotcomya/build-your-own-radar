/**
 * Tableau de bord.
 *
 * Un tableau de bord dirige l'attention ; il ne déverse pas. L'ordre de
 * lecture est donc imposé : d'abord un verdict, ensuite l'histoire des cinq
 * ans, puis ce qu'il faut faire — chiffré. Le détail vient après, replié,
 * pour qui veut vérifier.
 */

import { h, euro, pct, num, moduleShell } from '../dom.js'
import { referenceYear } from '../../format.js'
import { renderPitch } from './pitch.js'
import { teteDossier } from './studio.js'
import { gauge } from '../story.js'
import { renderSimulation } from './simulation.js'
import { refinePanel } from '../refine-panel.js'
import { breakEvenBoard } from './model.js'
import { vocabulaireDuPlan } from '../../state/sectors.js'
import { suggestActions, applyAction } from '../../engine/simulate.js'
import { nudges, nudgePanel } from '../nudges.js'
import { getSector } from '../../state/sectors.js'
import { mentionCourte } from '../../state/reperes.js'
import { verdict } from '../../engine/verdict.js'
import { svg } from '../dom.js'
import { avancement } from '../figures.js'
import store from '../../state/store.js'
import { memoire } from '../memoire.js'

/**
 * Ouvrir le tableau de bord sur la synthèse.
 *
 * L'onglet retenu survit d'une visite à l'autre, ce qui est juste : on revient
 * où l'on était. Sauf au sortir du parcours — là, ce qu'on veut voir est ce
 * que les douze questions ont produit, pas l'onglet qu'on regardait la fois
 * d'avant.
 */
export function openSynthesis() { memoire.tableau.view = 'synthese' }

export function openPilotage() { memoire.tableau.view = 'pilotage' }

export function renderDashboard(navigate, refresh) {
  const r = store.result
  const s = store.scenario
  if (!r) return h('div', { class: 'content' }, h('p', {}, 'Aucun résultat.'))

  const sector = getSector(s.meta.sectorKey)
  const y = memoire.tableau.year ?? referenceYear(r)
  memoire.tableau.year = y

  // La synthèse, c'est le pitch : récit, diapos, détail. L'ancienne synthèse
  // — verdict, cartes de chiffres, analyse dépliable — doublonnait le récit
  // et les états financiers ; elle est retirée, et le pitch prend son nom et
  // la première place.
  const views = [
    { key: 'pitch', read: true, label: 'Synthèse' },
    { key: 'pilotage', read: true, label: 'Pilotage' },
    { key: 'simulation', label: 'Simulation' },
  ]
  const view = views.some((v) => v.key === memoire.tableau.view) ? memoire.tableau.view : 'pitch'
  memoire.tableau.view = view
  const goView = (k) => { memoire.tableau.view = k; refresh() }

  return h('div', { class: 'content content-wide' },
    s.meta.isDemo && demoBanner(navigate, refresh),

    moduleShell({
      no: '06', title: 'Tableau de bord',
      views, view, onPick: goView,
    }),

    view === 'pitch' ? h('div', { class: 'view' }, renderPitch(navigate, refresh, goView)) : null,

    // Pilotage : « qu'est-ce que je fais maintenant ». Ce qu'il reste à poser, le seuil à
    // franchir, les leviers classés par ce qu'ils rapportent, la position dans
    // le métier, et les points qui clochent.
    view === 'pilotage' ? h('div', { class: 'view board-stack' },
      // Où en est le dossier : l'avancement en grand, la prochaine étape, le
      // verdict du moment, puis ce qui est fait et ce qui reste, page par page.
      h('div', { class: 'sy pilote-dossier' }, ...teteDossier(navigate, () => {
        document.querySelector('.refinery')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 'pilote-')),
      refinePanel(navigate, { refresh }),
      breakEvenBoard(r, s, vocabulaireDuPlan(s)),
      actionsPanel(r, s, navigate, refresh),
      gaugePanel(r, s, sector, y),
      nudgesSection(s, r, navigate),
    ) : null,

    view === 'simulation' ? h('div', { class: 'view' }, renderSimulation(refresh, navigate)) : null,

  )
}

/* ───────────────────────── Le poste de pilotage ─────────────────── */

/**
 * Où en est le dossier, et ce qu'il reste à faire.
 *
 * Un tableau de bord qui ne dit que l'état des comptes laisse le fondateur
 * seul avec la question suivante. Celui-ci dit aussi où il en est de son
 * dossier : un anneau qui se remplit, les jalons déjà décrochés, ceux qui
 * restent, et la prochaine action à un clic.
 */
function cockpit(j, r, navigate) {
  const pctDone = Math.round(j.completion * 100)
  const R = 26
  const circ = 2 * Math.PI * R
  const next = j.trophies.find((t) => !t.won)

  return h('section', { class: 'cockpit' },
    h('div', { class: 'cockpit-score' },
      h('div', { class: 'cockpit-ring' },
        svg('svg', { viewBox: '0 0 64 64', width: 64, height: 64, 'aria-hidden': 'true' },
          svg('circle', { cx: 32, cy: 32, r: R, fill: 'none', stroke: 'var(--rule)', 'stroke-width': 6 }),
          svg('circle', {
            cx: 32, cy: 32, r: R, fill: 'none', stroke: 'var(--level, var(--signal))', 'stroke-width': 6,
            'stroke-linecap': 'round', 'stroke-dasharray': String(circ),
            'stroke-dashoffset': String(circ * (1 - j.completion)),
            transform: 'rotate(-90 32 32)',
          }),
        ),
        h('span', { class: 'cockpit-pct num' }, String(pctDone)),
      ),
      h('div', { style: { minWidth: '0' } },
        h('div', { class: 'cockpit-rank' }, j.rank.label),
        h('div', { class: 'cockpit-sub' },
          j.done === j.total
            ? "Tout est renseigné — ton dossier est complet."
            : `${j.done} étape${j.done > 1 ? 's' : ''} sur ${j.total} · environ ${j.remainingMinutes} min de saisie restante`),
      ),
    ),

    h('div', { class: 'cockpit-badges' },
      ...j.trophies.map((t) => h('span', {
        class: `badge ${t.won ? 'is-won' : ''}`,
        title: t.won ? `${t.label} — ${t.hint}` : `À décrocher : ${t.hint}`,
      },
        h('span', { class: 'badge-glyph' }, t.glyph),
        h('span', { class: 'badge-label' }, t.label),
        t.won && t.value ? h('span', { class: 'badge-value num' }, t.value) : null,
      )),
    ),

    h('div', { class: 'cockpit-next' },
      next
        ? h('div', { style: { minWidth: '0' } },
            h('div', { class: 'cockpit-next-tag' }, 'Prochain jalon'),
            h('div', { class: 'cockpit-next-label' }, next.label),
            h('div', { class: 'cockpit-next-hint' }, next.hint),
          )
        : h('div', { style: { minWidth: '0' } },
            h('div', { class: 'cockpit-next-tag' }, 'Tous les jalons'),
            h('div', { class: 'cockpit-next-label' }, 'Décrochés'),
            h('div', { class: 'cockpit-next-hint' }, "Ton modèle tient sur tous les points vérifiables."),
          ),
      j.current && j.current.status !== 'done'
        ? h('button', { class: 'btn btn-primary btn-sm', onClick: () => navigate(`#/${j.current.page}`) }, j.current.short || 'Continuer')
        : null,
    ),
  )
}

/** Deux graphiques côte à côte, un seul s'il n'y en a qu'un. */
function pair(a, b) {
  const cards = [a, b].filter(Boolean)
  if (cards.length === 0) return null
  return h('div', { class: 'board-pair' }, ...cards)
}

/* ──────────────────────── Actions déjà chiffrées ──────────────────────── */

/**
 * Ce qu'il faut faire, et ce que ça rapporte.
 * Chaque proposition est obtenue en rejouant le modèle complet, pas estimée.
 */
function actionsPanel(r, s, navigate, refresh) {
  let suggestion
  try { suggestion = suggestActions(s, r) } catch { return null }
  if (!suggestion.best.length) return null

  const apply = (key, label) => {
    store.update((sc) => applyAction(sc, key), { label })
    refresh()
  }

  return h('section', { class: 'panel actions-panel' },
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, 'Leviers classés par impact'),
        h('div', { class: 'tiny muted' },
          suggestion.shortOfCash
            ? 'Classé par ce que cela libère en trésorerie'
            : "Classé par ce que cela ajoute à l'EBE"),
      ),
    ),
    h('div', { class: 'actions' },
      ...suggestion.best.map((a, i) => h('article', { class: 'action' },
        h('span', { class: 'action-rank num' }, String(i + 1)),
        h('div', { class: 'action-main' },
          h('h3', { class: 'action-label' }, a.label),
          a.detail && h('div', { class: 'action-detail num' }, a.detail),
          h('p', { class: 'action-why' }, a.rationale),
        ),
        h('div', { class: 'action-gains' },
          gainRow('EBE', a.delta.ebe, true),
          a.delta.fundingNeed !== 0 && gainRow('Financement', a.delta.fundingNeed, false),
          a.delta.breakEven !== null && a.delta.breakEven !== 0 && gainRow('Point mort', a.delta.breakEven, false),
          a.delta.founderMonthly !== 0 && gainRow('Pour toi', a.delta.founderMonthly, true, '/mois'),
        ),
        h('button', { class: 'btn btn-sm', onClick: () => apply(a.key, a.label) }, 'Appliquer'),
      )),
    ),
    h('div', { class: 'panel-body', style: { paddingTop: '0' } },
      h('p', { class: 'tiny muted', style: { margin: 0 } },
        "Chaque estimation rejoue le modèle entier avec la modification. Appliquer reste réversible : la barre du bas mesure l'écart et l'annulation est disponible."),
    ),
  )
}

/** Une ligne de gain : le sens du bien dépend de l'indicateur. */
function gainRow(label, delta, higherIsBetter, suffix = '') {
  if (!Number.isFinite(delta) || Math.round(delta) === 0) return null
  const good = higherIsBetter ? delta > 0 : delta < 0
  return h('div', { class: `gain ${good ? 'gain-good' : 'gain-bad'}` },
    h('span', { class: 'gain-label' }, label),
    h('span', { class: 'gain-value num' }, `${delta > 0 ? '+' : ''}${euro(delta, { compact: Math.abs(delta) >= 100000 })}${suffix}`),
  )
}

/* ─────────────────────── Position dans le métier ──────────────────────── */

function gaugePanel(r, s, sector, y) {
  const b = sector.benchmarks || {}
  const k = r.kpis, p = r.pnl
  const gauges = []

  if (b.grossMargin && p.revenue[y] > 0) {
    gauges.push(gauge({ label: 'Marge brute', value: k.marginRate[y], range: b.grossMargin }))
  }
  if (b.payrollRatio && p.revenue[y] > 0) {
    const denom = sector.resourcesIncludeGrants ? p.revenue[y] + p.grants[y] : p.revenue[y]
    if (denom > 0) gauges.push(gauge({ label: 'Masse salariale', value: p.payroll[y] / denom, range: b.payrollRatio, invert: true }))
  }
  if (b.overheadRatio && p.revenue[y] > 0) {
    const ownDraw = sector.ownerIsProfit
      ? (s.team || []).filter((m) => m.contractType === 'tns').reduce((a, m) => a + (Number(m.monthlyGross) || 0) * 12, 0)
      : 0
    const overhead = Math.max(0, p.payroll[y] - ownDraw) + p.external[y] + p.duties[y] + p.amortisation[y]
    gauges.push(gauge({ label: 'Charges de structure', value: overhead / p.revenue[y], range: b.overheadRatio, invert: true }))
  }
  if (b.churn) {
    const a = (s.activities || []).find((x) => (Number(x.recurringPrice) || 0) > 0)
    if (a) gauges.push(gauge({ label: 'Attrition mensuelle', value: Number(a.churnMonthly) || 0, range: b.churn, invert: true, format: (v) => pct(v, 1) }))
  }
  if (b.ltvCac && k.ltvCacRatio !== null) {
    gauges.push(gauge({ label: 'LTV / CAC', value: k.ltvCacRatio, range: b.ltvCac, format: (v) => `${num(v, 1)}×` }))
  }
  if (b.rentRatio && p.revenue[y] > 0) {
    const rent = (s.opex || []).filter((o) => /loyer|local|bureau|cabinet|salle/i.test(o.label))
      .reduce((a, o) => a + (Number(o.monthlyAmount) || 0) * 12, 0)
    if (rent > 0) gauges.push(gauge({ label: 'Loyer', value: rent / p.revenue[y], range: b.rentRatio, invert: true }))
  }

  if (!gauges.length) return null
  return h('section', { class: 'panel' },
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, 'Position dans le métier'),
        h('div', { class: 'tiny muted' }, `Comparé aux ordres de grandeur observés — ${sector.label.toLowerCase()}. `,
          h('a', { class: 'repere-src', href: '#/methode' }, `Repères ${mentionCourte(s.meta?.sectorKey)} · méthode`)),
      ),
    ),
    h('div', { class: 'gauges' }, ...gauges),
  )
}

function nudgesSection(s, r, navigate) {
  const advice = nudges(s, r)
  const issues = store.issues.filter((i) => i.level === 'error')
  if (!advice.length && !issues.length) return null
  return h('div', { class: 'stack' },
    issues.length > 0 && h('div', { class: 'note danger' },
      h('div', { class: 'note-title' }, `${issues.length} point${issues.length > 1 ? 's' : ''} à corriger`),
      h('div', { class: 'stack', style: { gap: '6px', marginTop: '6px' } },
        ...issues.slice(0, 3).map((i) => h('div', { class: 'row', style: { alignItems: 'flex-start' } },
          h('div', { class: 'spacer' },
            h('div', { style: { fontWeight: '500' } }, i.message),
            i.hint && h('div', { class: 'tiny muted' }, i.hint)),
          i.page && h('button', { class: 'btn btn-sm btn-quiet', onClick: () => navigate(`#/${i.page}`) }, 'Corriger'),
        )),
      ),
    ),
    advice.length > 0 && nudgePanel(advice, navigate),
  )
}

function panel(title, subtitle, ...body) {
  return h('section', { class: 'panel' },
    h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, title), subtitle && h('div', { class: 'tiny muted' }, subtitle))),
    h('div', { class: 'panel-body' }, ...body),
  )
}

function demoBanner(navigate, refresh) {
  return h('div', { class: 'note', style: { marginBottom: '18px' } },
    h('div', { class: 'row-wrap', style: { gap: '12px' } },
      h('div', { class: 'spacer', style: { minWidth: '240px' } },
        h('div', { class: 'note-title' }, 'Tu regardes un exemple'),
        h('div', {}, "Les chiffres de ce scénario sont fictifs : ils servent à montrer comment tout s'articule. Modifie-les librement, ou repars d'une page blanche."),
      ),
      h('button', { class: 'btn btn-primary', onClick: () => { store.adoptDemo(); refresh() } }, 'Partir de cet exemple'),
      h('button', { class: 'btn', onClick: () => navigate('#/demarrer') }, 'Créer le mien'),
    ),
  )
}

const yearly = (arr) => Array.from({ length: 5 }, (_, y) => arr.slice(y * 12, y * 12 + 12).reduce((a, b) => a + b, 0))

export const pickYear = (pnl) => {
  const i = pnl.netResult.findIndex((v) => v > 0)
  return i >= 0 ? i : 2
}

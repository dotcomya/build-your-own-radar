/**
 * Rétroaction immédiate.
 *
 * Trois mécanismes, une seule intention : rendre visible, à l'instant où on
 * bouge un chiffre, ce que ce chiffre déplace.
 *
 *  1. Un repère — un instantané du modèle — auquel tout est comparé.
 *  2. Des écarts calculés en continu par rapport à ce repère.
 *  3. Un rail permanent qui affiche ces écarts, et des valeurs qui se
 *     déplacent progressivement au lieu de sauter d'un état à l'autre.
 */

import { h, euro, pct, num, clear } from './dom.js'
import { METRICS } from './personas.js'
import store from '../state/store.js'

/** Indicateurs suivis par le rail, dans cet ordre. */
const TRACKED = [
  { key: 'revenue', label: "CA", higher: true },
  { key: 'ebitda', label: 'EBITDA', higher: true },
  { key: 'breakEven', label: 'Point mort', higher: false },
  { key: 'fundingNeed', label: 'Financement', higher: false },
]

/** Année de lecture : la première rentable, sinon la troisième. */
export function referenceYear(result) {
  if (!result) return 2
  const i = result.pnl.netResult.findIndex((v) => v > 0)
  return i >= 0 ? i : 2
}

/** Extrait les valeurs suivies d'un résultat. */
export function snapshotOf(result) {
  if (!result) return null
  const y = referenceYear(result)
  const out = { year: y }
  for (const t of TRACKED) {
    const m = METRICS[t.key]
    const v = m.read(result, y)
    out[t.key] = Number.isFinite(v) ? v : null
  }
  return out
}

/** Écarts entre le résultat courant et le repère. */
export function deltasAgainst(baseline, result) {
  if (!baseline || !result) return []
  const now = snapshotOf(result)
  return TRACKED.map((t) => {
    const before = baseline[t.key]
    const after = now[t.key]
    if (before === null || after === null) return { ...t, absent: true }
    const delta = after - before
    const relative = before !== 0 ? delta / Math.abs(before) : null
    return { ...t, before, after, delta, relative, good: t.higher ? delta > 0 : delta < 0 }
  })
}

const significant = (d) => !d.absent && Math.abs(d.delta) >= 1

/**
 * Rail d'impact : barre permanente qui compare l'état courant au repère.
 * Il ne s'affiche qu'à partir du moment où quelque chose a bougé.
 */
export function impactRail(refresh) {
  const baseline = store.baseline
  const deltas = deltasAgainst(baseline, store.result)
  const moved = deltas.filter(significant)
  if (!moved.length) return null

  return h('div', { class: 'rail-impact', role: 'status', 'aria-live': 'polite' },
    h('div', { class: 'rail-impact-inner' },
      h('div', { class: 'rail-impact-tag' },
        h('span', { class: 'pulse' }),
        h('span', {}, 'Depuis le repère'),
        store.baselineLabel && h('span', { class: 'rail-impact-when' }, store.baselineLabel),
      ),
      h('div', { class: 'rail-impact-items' },
        ...deltas.filter((d) => !d.absent).map((d) => h('div', { class: `impact-item ${significant(d) ? (d.good ? 'good' : 'bad') : 'flat'}` },
          h('span', { class: 'impact-label' }, d.label),
          h('span', { class: 'impact-delta num' }, significant(d) ? signed(d.delta) : '—'),
          significant(d) && d.relative !== null && Math.abs(d.relative) < 20
            ? h('span', { class: 'impact-rel num' }, `${d.relative > 0 ? '+' : ''}${(d.relative * 100).toFixed(0)} %`)
            : null,
        )),
      ),
      h('div', { class: 'rail-impact-actions' },
        h('button', {
          class: 'btn btn-sm btn-quiet', title: 'Repartir de la situation actuelle',
          onClick: () => { store.setBaseline('maintenant'); refresh() },
        }, 'Nouveau repère'),
        h('button', {
          class: 'btn btn-sm btn-quiet', disabled: !store.canUndo(),
          onClick: () => { store.undo(); refresh() },
        }, 'Annuler'),
      ),
    ),
  )
}

const signed = (v) => `${v > 0 ? '+' : ''}${euro(v, { compact: Math.abs(v) >= 10000 })}`

/**
 * Valeur numérique qui se déplace au lieu de sauter.
 *
 * On garde la dernière valeur affichée par identifiant, pour animer même si
 * l'élément a été recréé entre-temps — ce qui arrive à chaque rendu.
 */
const lastSeen = new Map()
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function liveNumber(id, value, format, { duration = 420 } = {}) {
  const el = h('span', { class: 'num live-number' }, format(value))
  const previous = lastSeen.get(id)
  lastSeen.set(id, value)

  if (previous === undefined || previous === value || !Number.isFinite(previous) || !Number.isFinite(value) || REDUCED) {
    if (previous !== undefined && previous !== value) el.classList.add('changed')
    return el
  }

  el.classList.add('changed')
  const start = performance.now()
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration)
    // Sortie douce : rapide au début, posé à l'arrivée.
    const eased = 1 - Math.pow(1 - t, 3)
    el.textContent = format(previous + (value - previous) * eased)
    if (t < 1 && el.isConnected) requestAnimationFrame(step)
    else el.textContent = format(value)
  }
  requestAnimationFrame(step)
  return el
}

/** Efface la mémoire des valeurs animées — au changement de scénario. */
export function resetLiveNumbers() { lastSeen.clear() }

/**
 * Chaîne de causalité : ce que ce champ déplace, dans l'ordre.
 * Sert à répondre « pourquoi ce chiffre bouge-t-il ? » sans quitter la page.
 */
export const CAUSAL_CHAINS = {
  unitPrice: ["Prix", "Chiffre d'affaires", 'Marge brute', 'EBITDA', 'Impôt', 'Trésorerie'],
  recurringPrice: ['Abonnement', 'CA récurrent', 'Marge brute', 'EBITDA', 'Trésorerie'],
  unitCost: ['Coût de revient', 'Marge brute', 'EBITDA', 'Point mort'],
  churnMonthly: ['Attrition', 'Base installée', 'CA récurrent', 'EBITDA'],
  monthlyGrowth: ['Croissance', 'Volumes', "Chiffre d'affaires", 'EBITDA'],
  startUnits: ['Volumes', "Chiffre d'affaires", 'Marge brute', 'EBITDA'],
  monthlyBudget: ['Budget', 'Clients acquis', "Chiffre d'affaires", 'EBITDA'],
  leadToClient: ['Conversion', 'Clients acquis', 'CAC', "Chiffre d'affaires"],
  monthlyGross: ['Brut', 'Coût employeur', 'Point mort', 'EBITDA', 'Trésorerie'],
  count: ['Effectif', 'Masse salariale', 'Point mort', 'Trésorerie'],
  startMonth: ['Date d\'embauche', 'Masse salariale', 'Trésorerie', 'Besoin de financement'],
  paymentLag: ['Délai de paiement', 'Créances clients', 'BFR', 'Trésorerie'],
  deposit: ['Acompte', 'Encaissements', 'BFR', 'Besoin de financement'],
  monthlyAmount: ['Charge fixe', 'Point mort', 'EBITDA'],
  openingCash: ['Trésorerie de départ', 'Point bas', 'Besoin de financement'],
}

export function causalChain(field) {
  const chain = CAUSAL_CHAINS[field]
  if (!chain) return null
  return h('div', { class: 'chain' },
    ...chain.flatMap((step, i) => [
      i > 0 ? h('span', { class: 'chain-arrow', 'aria-hidden': 'true' }, '→') : null,
      h('span', { class: `chain-step ${i === 0 ? 'chain-origin' : ''} ${i === chain.length - 1 ? 'chain-end' : ''}` }, step),
    ].filter(Boolean)),
  )
}

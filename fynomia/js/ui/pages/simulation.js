/**
 * La simulation : un bac à sable, pas une télécommande.
 *
 * Les curseurs écrivaient directement dans le plan. Tirer un curseur pour voir
 * « ce que ça ferait » modifiait donc le business plan pour de bon — on
 * explorait et on repartait avec des chiffres qu'on n'avait pas choisis.
 *
 * Ici, on travaille sur une copie, et l'on voit l'effet plutôt qu'on ne le
 * lit : la courbe de trésorerie et les barres annuelles se redessinent pendant
 * le geste, le plan d'origine restant en pointillé dessous. L'écart entre les
 * deux traits est la réponse. Pour que l'exploration devienne une décision, il
 * faut la demander — et valider chaque changement, un par un, module par
 * module.
 */

import { h, euro, num, pct, toast, fold } from '../dom.js'
import { allLevers, resolveLever, LEVER_GROUPS } from '../personas.js'
import { areaChart, barChart, PALETTE, YEAR_CATEGORIES, STATUS } from '../charts.js'
import { compute } from '../../engine/engine.js'
import store from '../../state/store.js'

/** La copie de travail, et l'écran en cours : le bac à sable ou la validation. */
const sandbox = { draft: null, stage: 'jeu', forId: null }

/** Repartir du plan réel. */
export function resetSandbox() { sandbox.draft = null; sandbox.stage = 'jeu'; sandbox.forId = null }

const clone = (x) => JSON.parse(JSON.stringify(x))

/** Les valeurs qui diffèrent entre la copie et le plan, levier par levier. */
function changes(levers) {
  if (!sandbox.draft) return []
  const out = []
  for (const lever of levers) {
    const a = resolveLever(store.scenario, lever)
    const b = resolveLever(sandbox.draft, lever)
    if (!a || !b) continue
    const before = Number(a.current) || 0
    const after = Number(b.current) || 0
    if (Math.abs(after - before) > 1e-9) out.push({ lever, before, after })
  }
  return out
}

/* ─────────────────────────────── L'écran ────────────────────────────────── */

export function renderSimulation(persona, refresh, navigate) {
  const s = store.scenario
  if (sandbox.forId !== s.meta.id) resetSandbox()
  if (!sandbox.draft) { sandbox.draft = clone(s); sandbox.forId = s.meta.id }

  const levers = allLevers(sandbox.draft)
  if (!levers.length) {
    return h('div', { class: 'card' }, h('div', { class: 'empty' },
      h('div', { class: 'empty-icon' }, '◇'),
      h('p', {}, "Renseigne une offre et un prix : la simulation a besoin d'un modèle à bousculer."),
    ))
  }
  if (sandbox.stage === 'validation') return applyScreen(levers, refresh, navigate)

  const base = store.result
  const view = h('div', { class: 'sim-view' })
  const pending = h('div', { class: 'sim-pending' })

  const paint = () => {
    let sim = null
    try { sim = compute(sandbox.draft) } catch { sim = base }
    view.replaceChildren(...liveAnalysis(base, sim))
    const list = changes(levers)
    pending.replaceChildren(
      h('button', {
        class: 'btn btn-primary btn-lg', disabled: list.length === 0,
        onClick: () => { sandbox.stage = 'validation'; refresh() },
      }, list.length ? `Appliquer ${list.length} changement${list.length > 1 ? 's' : ''}` : 'Appliquer à mon business plan'),
      list.length ? h('button', {
        class: 'btn btn-quiet',
        onClick: () => { sandbox.draft = clone(store.scenario); refresh() },
      }, 'Tout remettre comme avant') : null,
      h('span', { class: 'sim-pending-note' },
        list.length
          ? list.map((c) => `${c.lever.label} ${c.lever.format(c.before)} → ${c.lever.format(c.after)}`).join(' · ')
          : 'Rien n’est enregistré tant que tu n’as pas validé.'),
    )
  }
  paint()

  return h('div', { class: 'sim' },
    h('div', { class: 'sim-flag' },
      h('span', { class: 'sim-flag-dot' }),
      h('div', {},
        h('strong', {}, 'Bac à sable'),
        h('span', {}, ' — tu travailles sur une copie. Le trait plein, c’est la simulation ; le pointillé, ton plan actuel.'),
      ),
    ),
    h('div', { class: 'sim-body' },
      h('div', { class: 'sim-knobs' }, ...leverGroups(levers, paint)),
      view,
    ),
    pending,
  )
}

/* ──────────────────────────── Les curseurs ──────────────────────────────── */

/** Les leviers, par famille : la première ouverte, les autres à portée. */
function leverGroups(levers, onLive) {
  return LEVER_GROUPS.map((g, i) => {
    const mine = levers.filter((l) => (l.group || 'vendre') === g.key)
    if (!mine.length) return null
    const body = h('div', { class: 'sim-levers' }, ...mine.map((l) => knob(l, onLive)))
    return fold(g.label, `${mine.length} levier${mine.length > 1 ? 's' : ''}`, body,
      { id: `sim-${g.key}`, open: i === 0 })
  }).filter(Boolean)
}

/** Un curseur qui n'écrit que dans la copie. */
function knob(lever, onLive) {
  const resolved = resolveLever(sandbox.draft, lever)
  if (!resolved) return null
  const reference = resolveLever(store.scenario, lever)
  const base = Number(reference?.current) || 0
  const initial = Number(resolved.current) || 0

  const value = h('output', { class: 'knob-value num' }, lever.format(initial))
  const shift = h('span', { class: 'knob-shift num' }, '')
  const min = Math.min(lever.min, base)
  const max = Math.max(lever.max, base * 1.6 || lever.max)
  const input = h('input', {
    type: 'range', min, max, step: lever.step, value: initial,
    'aria-label': lever.label, class: 'lever-range',
  })

  const paint = (raw) => {
    value.textContent = lever.format(raw)
    const delta = raw - base
    shift.textContent = delta === 0 ? '' : `${delta > 0 ? '+' : '−'}${lever.format(Math.abs(delta)).replace('−', '')}`
    shift.className = `knob-shift num ${delta === 0 ? '' : delta > 0 ? 'up' : 'down'}`
  }
  paint(initial)

  input.addEventListener('input', () => {
    const raw = Number(input.value)
    const target = resolveLever(sandbox.draft, lever)
    if (target) target.object[target.key] = raw
    paint(raw)
    onLive()
  })

  return h('div', { class: 'knob' },
    h('div', { class: 'knob-top' },
      h('label', { class: 'knob-label' }, lever.label),
      h('div', { class: 'knob-readout' }, value, shift),
    ),
    input,
    h('div', { class: 'knob-why' }, lever.why || ''),
  )
}

/* ──────────────────────── Ce que ça donne, en direct ─────────────────────── */

/**
 * L'analyse, rejouée sur la copie.
 *
 * Quatre chiffres avec leur écart, la trésorerie mois par mois, et les cinq
 * exercices. Les mêmes dessins que l'onglet Analyse — c'est volontaire : on ne
 * demande pas d'apprendre une seconde lecture pour comprendre une variante.
 */
function liveAnalysis(base, sim) {
  const FIG = [
    { label: "Chiffre d'affaires année 1", read: (r) => r.pnl.revenue[0], good: 1 },
    { label: 'EBITDA année 1', read: (r) => r.pnl.ebitda[0], good: 1 },
    { label: 'Trésorerie au plus bas', read: (r) => r.kpis.cashLow.value, good: 1 },
    { label: 'Financement à trouver', read: (r) => r.kpis.fundingNeed, good: -1 },
  ]

  const figures = h('div', { class: 'sim-figs' }, ...FIG.map((f) => {
    const a = f.read(base) || 0
    const b = f.read(sim) || 0
    const gap = b - a
    const tone = gap === 0 ? '' : (gap > 0 ? f.good : -f.good) > 0 ? 'up' : 'down'
    return h('div', { class: `sim-fig ${tone}` },
      h('div', { class: 'sim-fig-label' }, f.label),
      h('div', { class: 'sim-fig-value num' }, euro(b, { compact: true })),
      h('div', { class: 'sim-fig-gap num' },
        gap === 0 ? 'inchangé' : `${gap > 0 ? '+' : '−'}${euro(Math.abs(gap), { compact: true })}`),
    )
  }))

  const cash = h('section', { class: 'panel' },
    h('div', { class: 'card-head' }, h('div', {},
      h('h2', {}, 'Trésorerie mois par mois'),
      h('div', { class: 'tiny muted' }, 'Trait plein : la simulation. Pointillé : ton plan actuel.'))),
    h('div', { class: 'panel-body' },
      areaChart({
        values: sim.cash.balance, startDate: sim.startDate, height: 200,
        color: sim.kpis.fundingNeed > 0 ? STATUS.warn : STATUS.gain,
        compare: { values: base.cash.balance },
      }),
    ),
  )

  const years = h('section', { class: 'panel' },
    h('div', { class: 'card-head' }, h('div', {},
      h('h2', {}, 'Les cinq exercices'),
      h('div', { class: 'tiny muted' }, "Chiffre d'affaires et résultat net, avant et après"))),
    h('div', { class: 'panel-body' },
      barChart({
        categories: YEAR_CATEGORIES,
        series: [
          { label: "CA — plan actuel", values: base.pnl.revenue, color: '#C9C6B8' },
          { label: "CA — simulation", values: sim.pnl.revenue, color: PALETTE[0] },
          { label: 'Résultat net — simulation', values: sim.pnl.netResult, color: PALETTE[5] },
        ],
      }),
    ),
  )

  return [figures, cash, years]
}

/* ─────────────────────────── L'écran de validation ───────────────────────── */

const MODULES = {
  offre: { label: 'Offre et revenus', route: 'offre' },
  achats: { label: 'Achats et coûts', route: 'achats' },
  equipe: { label: 'Équipe', route: 'equipe' },
  financement: { label: 'Financement', route: 'financement' },
}

/**
 * Valider, module par module.
 *
 * Un changement de prix se pose dans « Offre et revenus », un salaire dans
 * « Équipe ». Les regrouper par destination dit où l'on écrit, et le lien
 * ouvre le module pour vérifier sur place. Chaque ligne reste décochable :
 * on peut garder deux idées sur trois.
 */
function applyScreen(levers, refresh, navigate) {
  const list = changes(levers)
  if (!list.length) { sandbox.stage = 'jeu'; return renderSimulation(null, refresh, navigate) }

  const kept = new Set(list.map((c) => c.lever.key))
  const effects = h('div', { class: 'apply-effects' })

  const projected = () => {
    const next = clone(store.scenario)
    for (const c of list) {
      if (!kept.has(c.lever.key)) continue
      const t = resolveLever(next, c.lever)
      if (t) t.object[t.key] = c.after
    }
    return next
  }

  const ROWS = [
    { label: "Chiffre d'affaires année 1", read: (r) => r.pnl.revenue[0] },
    { label: 'Résultat net année 1', read: (r) => r.pnl.netResult[0] },
    { label: 'Trésorerie au plus bas', read: (r) => r.kpis.cashLow.value },
    { label: 'Financement à trouver', read: (r) => r.kpis.fundingNeed },
  ]

  const paintEffects = () => {
    const before = store.result
    let after = before
    try { after = compute(projected()) } catch { /* état transitoire */ }
    effects.replaceChildren(...ROWS.map((row) => {
      const a = row.read(before) || 0
      const b = row.read(after) || 0
      const gap = b - a
      return h('div', { class: 'apply-effect' },
        h('span', { class: 'apply-effect-label' }, row.label),
        h('span', { class: 'apply-effect-before num' }, euro(a, { compact: true })),
        h('span', { class: 'apply-effect-arrow' }, '→'),
        h('span', { class: `apply-effect-after num ${gap === 0 ? '' : gap > 0 ? 'pos' : 'neg'}` }, euro(b, { compact: true })),
      )
    }))
  }
  paintEffects()

  const confirm = (thenGo) => {
    const keptList = list.filter((c) => kept.has(c.lever.key))
    if (!keptList.length) { toast('Aucun changement retenu.', 'err'); return }
    store.update((sc) => {
      for (const c of keptList) {
        const t = resolveLever(sc, c.lever)
        if (t) t.object[t.key] = c.after
      }
    }, { label: `Simulation appliquée (${keptList.length})` })
    resetSandbox()
    toast(`${keptList.length} changement${keptList.length > 1 ? 's' : ''} enregistré${keptList.length > 1 ? 's' : ''}.`, 'ok')
    if (thenGo && navigate) navigate(`#/${thenGo}`)
    else refresh()
  }

  // Les changements, rangés par module de destination.
  const byModule = new Map()
  for (const c of list) {
    const key = c.lever.page || 'offre'
    if (!byModule.has(key)) byModule.set(key, [])
    byModule.get(key).push(c)
  }

  return h('div', { class: 'apply' },
    h('header', { class: 'apply-head' },
      h('h2', {}, 'Ce que tu t’apprêtes à changer'),
      h('p', {}, 'Rien n’est encore enregistré. Décoche ce que tu ne veux pas garder, puis enregistre — module par module si tu préfères vérifier sur place.'),
    ),

    ...[...byModule.entries()].map(([key, items]) => {
      const mod = MODULES[key] || MODULES.offre
      return h('section', { class: 'apply-mod' },
        h('div', { class: 'apply-mod-head' },
          h('span', { class: 'apply-mod-name' }, mod.label),
          h('button', {
            class: 'btn btn-sm btn-quiet',
            onClick: () => confirm(mod.route),
          }, 'Enregistrer et ouvrir ce module →'),
        ),
        ...items.map((c) => {
          const box = h('input', { type: 'checkbox', checked: true })
          box.addEventListener('change', () => {
            box.checked ? kept.add(c.lever.key) : kept.delete(c.lever.key)
            paintEffects()
          })
          return h('label', { class: 'apply-row' },
            box,
            h('span', { class: 'apply-row-label' }, c.lever.label),
            h('span', { class: 'apply-row-before num' }, c.lever.format(c.before)),
            h('span', { class: 'apply-row-arrow' }, '→'),
            h('span', { class: 'apply-row-after num' }, c.lever.format(c.after)),
          )
        }),
      )
    }),

    h('div', { class: 'apply-effects-tag' }, 'Ce que ça change dans les comptes'),
    effects,
    h('div', { class: 'apply-actions' },
      h('button', { class: 'btn btn-primary btn-lg', onClick: () => confirm(null) }, 'Tout enregistrer'),
      h('button', { class: 'btn btn-lg btn-ghost', onClick: () => { sandbox.stage = 'jeu'; refresh() } }, 'Retour à la simulation'),
    ),
  )
}

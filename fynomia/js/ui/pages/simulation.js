/**
 * La simulation : un bac à sable, pas une télécommande.
 *
 * Les curseurs écrivaient directement dans le plan. Tirer un curseur pour voir
 * « ce que ça ferait » modifiait donc le business plan pour de bon — on
 * explorait et on repartait avec des chiffres qu'on n'avait pas choisis.
 *
 * Ici, on travaille sur une copie. Le modèle se recalcule à chaque geste, les
 * indicateurs bougent, mais le plan ne bouge pas. Pour que l'exploration
 * devienne une décision, il faut la demander — et valider chaque changement,
 * un par un, en voyant l'avant et l'après.
 */

import { h, euro, num, pct, toast } from '../dom.js'
import { activeLevers, resolveLever } from '../personas.js'
import { metricBoard } from '../levers.js'
import { compute } from '../../engine/engine.js'
import { causalChain } from '../impact.js'
import store from '../../state/store.js'

/** La copie de travail, et l'écran en cours : le bac à sable ou la validation. */
const sandbox = { draft: null, stage: 'jeu', forId: null }

/** Repartir du plan réel. Appelé au changement de scénario et après validation. */
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

export function renderSimulation(persona, refresh) {
  const s = store.scenario
  const levers = activeLevers(persona, s)
  if (!levers.length) {
    return h('div', { class: 'card' }, h('div', { class: 'empty' },
      h('div', { class: 'empty-icon' }, '◇'),
      h('p', {}, "Renseigne une offre et un prix : la simulation a besoin d'un modèle à bousculer."),
    ))
  }

  // Changer de scénario vide le bac à sable : une copie de travail n'a de sens
  // qu'attachée au plan dont elle est issue.
  if (sandbox.forId !== s.meta.id) resetSandbox()
  if (!sandbox.draft) { sandbox.draft = clone(s); sandbox.forId = s.meta.id }
  if (sandbox.stage === 'validation') return applyScreen(levers, refresh)

  let draftResult = null
  try { draftResult = compute(sandbox.draft) } catch { draftResult = store.result }
  const board = metricBoard(persona, draftResult, { glossary: false })
  const diff = h('div', { class: 'sandbox-diff' })
  const foot = h('div', { class: 'sandbox-foot' })

  const paint = () => {
    const list = changes(levers)
    diff.replaceChildren(...(list.length ? list.map((c) => h('div', { class: 'sandbox-change' },
      h('span', { class: 'sandbox-change-label' }, c.lever.label),
      h('span', { class: 'sandbox-change-vals num' },
        h('s', {}, c.lever.format(c.before)), ' → ', h('strong', {}, c.lever.format(c.after))),
    )) : [h('span', { class: 'sandbox-empty' }, 'Aucun changement pour l’instant.')]))
    foot.replaceChildren(
      h('button', {
        class: 'btn btn-primary btn-lg', disabled: list.length === 0,
        onClick: () => { sandbox.stage = 'validation'; refresh() },
      }, 'Appliquer à mon business plan'),
      list.length ? h('button', {
        class: 'btn btn-quiet',
        onClick: () => { sandbox.draft = clone(store.scenario); refresh() },
      }, 'Repartir du plan réel') : null,
      h('span', { class: 'sandbox-foot-note' },
        list.length
          ? `${list.length} changement${list.length > 1 ? 's' : ''} en attente. Rien n’est enregistré tant que tu n’as pas validé.`
          : 'Tire un curseur : le modèle se recalcule, ton plan ne bouge pas.'),
    )
  }

  const onLive = () => {
    try { board.updateWith(compute(sandbox.draft)) } catch { /* état transitoire */ }
    paint()
  }

  paint()

  return h('div', { class: 'sandbox' },
    h('div', { class: 'sandbox-flag' },
      h('span', { class: 'sandbox-flag-dot' }),
      h('div', {},
        h('strong', {}, 'Bac à sable'),
        h('span', {}, ' — tu travailles sur une copie. Ton business plan reste intact jusqu’à validation.'),
      ),
    ),
    h('div', { class: 'sandbox-body' },
      h('div', { class: 'sandbox-levers' },
        ...levers.map((lever) => sandboxLever(lever, onLive)),
      ),
      h('div', { class: 'sandbox-metrics' },
        h('div', { class: 'sandbox-metrics-tag' }, 'Ce que ça donnerait'),
        board,
        h('div', { class: 'sandbox-diff-tag' }, 'Changements en attente'),
        diff,
      ),
    ),
    foot,
  )
}

/** Un curseur qui n'écrit que dans la copie. */
function sandboxLever(lever, onLive) {
  const resolved = resolveLever(sandbox.draft, lever)
  if (!resolved) return null
  const reference = resolveLever(store.scenario, lever)
  const base = Number(reference?.current) || 0
  const initial = Number(resolved.current) || 0

  const value = h('output', { class: 'lever-value num' }, lever.format(initial))
  const shift = h('span', { class: 'lever-shift num' }, '')
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
    shift.className = `lever-shift num ${delta === 0 ? '' : delta > 0 ? 'up' : 'down'}`
  }
  paint(initial)

  input.addEventListener('input', () => {
    const raw = Number(input.value)
    const target = resolveLever(sandbox.draft, lever)
    if (target) target.object[target.key] = raw
    paint(raw)
    onLive()
  })

  return h('div', { class: 'lever' },
    h('div', { class: 'lever-top' },
      h('label', { class: 'lever-label' }, lever.label),
      h('div', { class: 'lever-readout' }, value, shift),
    ),
    input,
    h('div', { class: 'lever-foot' },
      h('span', { class: 'lever-why' }, lever.why || ''),
      lever.field && causalChain(lever.field),
    ),
  )
}

/**
 * L'écran de validation.
 *
 * Chaque changement est une case à cocher : on peut en garder deux et en
 * refuser un troisième. Sous la liste, l'effet sur les quatre chiffres qui
 * décident — avant, après, écart — calculé sur la seule sélection retenue.
 */
function applyScreen(levers, refresh) {
  const list = changes(levers)
  if (!list.length) { sandbox.stage = 'jeu'; return renderSimulation({ levers: [] }, refresh) }

  const kept = new Set(list.map((c) => c.lever.key))
  const effects = h('div', { class: 'apply-effects' })

  /** Le plan tel qu'il serait si l'on ne retenait que les cases cochées. */
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
    { label: "Chiffre d'affaires année 1", read: (r) => r.pnl.revenue[0], fmt: (v) => euro(v, { compact: true }) },
    { label: 'Résultat net année 1', read: (r) => r.pnl.netResult[0], fmt: (v) => euro(v, { compact: true }) },
    { label: 'Trésorerie au plus bas', read: (r) => r.kpis.cashLow.value, fmt: (v) => euro(v, { compact: true }) },
    { label: 'Financement à trouver', read: (r) => r.kpis.fundingNeed, fmt: (v) => (v > 0 ? euro(v, { compact: true }) : 'Aucun') },
  ]

  const paintEffects = () => {
    let before = store.result, after = null
    try { after = compute(projected()) } catch { after = before }
    effects.replaceChildren(...ROWS.map((row) => {
      const a = row.read(before) || 0
      const b = row.read(after) || 0
      const gap = b - a
      return h('div', { class: 'apply-effect' },
        h('span', { class: 'apply-effect-label' }, row.label),
        h('span', { class: 'apply-effect-before num' }, row.fmt(a)),
        h('span', { class: 'apply-effect-arrow' }, '→'),
        h('span', { class: `apply-effect-after num ${gap === 0 ? '' : gap > 0 ? 'pos' : 'neg'}` }, row.fmt(b)),
      )
    }))
  }
  paintEffects()

  const confirm = () => {
    const keptList = list.filter((c) => kept.has(c.lever.key))
    if (!keptList.length) { toast('Aucun changement retenu.', 'err'); return }
    store.update((sc) => {
      for (const c of keptList) {
        const t = resolveLever(sc, c.lever)
        if (t) t.object[t.key] = c.after
      }
    }, { label: `Simulation appliquée (${keptList.length})` })
    resetSandbox()
    toast(`${keptList.length} changement${keptList.length > 1 ? 's' : ''} appliqué${keptList.length > 1 ? 's' : ''} à ton business plan.`, 'ok')
    refresh()
  }

  return h('div', { class: 'apply' },
    h('header', { class: 'apply-head' },
      h('h2', {}, 'Confirmer les changements'),
      h('p', {}, 'Rien n’est encore enregistré. Décoche ce que tu ne veux pas garder.'),
    ),
    h('div', { class: 'apply-list' },
      ...list.map((c) => {
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
    ),
    h('div', { class: 'apply-effects-tag' }, 'Ce que ça change dans les comptes'),
    effects,
    h('div', { class: 'apply-actions' },
      h('button', { class: 'btn btn-primary btn-lg', onClick: confirm }, 'Enregistrer dans mon business plan'),
      h('button', { class: 'btn btn-lg btn-ghost', onClick: () => { sandbox.stage = 'jeu'; refresh() } }, 'Retour à la simulation'),
    ),
  )
}

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

import { h, euro, num, toast, fold } from '../dom.js'
import { goToGap } from '../spotlight.js'
import { simLevers, SIM_GROUPS } from '../sim-levers.js'
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
    const before = Number(lever.read(store.scenario)) || 0
    const after = Number(lever.read(sandbox.draft)) || 0
    if (Math.abs(after - before) > 1e-9) out.push({ lever, before, after })
  }
  return out
}

/* ─────────────────────────────── L'écran ────────────────────────────────── */

export function renderSimulation(persona, refresh, navigate) {
  const s = store.scenario
  if (sandbox.forId !== s.meta.id) resetSandbox()
  if (!sandbox.draft) { sandbox.draft = clone(s); sandbox.forId = s.meta.id }

  const levers = simLevers(store.scenario)
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
          ? list.map((c) => `${c.lever.line} · ${c.lever.label} ${c.lever.fmt(c.before)} → ${c.lever.fmt(c.after)}`).join(' · ')
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

/**
 * Les curseurs, groupés par module puis par ligne du plan.
 *
 * Un fondateur qui a trois offres et onze charges ne cherche pas « le prix » :
 * il cherche le prix du menu du midi. Chaque ligne de son plan a donc son
 * propre bloc, avec son nom à lui.
 */
function leverGroups(levers, onLive) {
  return SIM_GROUPS.map((g, i) => {
    const mine = levers.filter((l) => l.group === g.key)
    if (!mine.length) return null
    // Les leviers d'une même ligne se suivent : on regroupe sans trier, pour
    // garder l'ordre du plan.
    const byLine = []
    for (const l of mine) {
      const last = byLine[byLine.length - 1]
      if (last && last.line === l.line) last.items.push(l)
      else byLine.push({ line: l.line, items: [l] })
    }
    const body = h('div', { class: 'sim-lines' },
      ...byLine.map((b) => h('div', { class: 'sim-line' },
        h('div', { class: 'sim-line-name' }, b.line),
        h('div', { class: 'sim-levers' }, ...b.items.map((l) => knob(l, onLive))),
      )),
    )
    // Tout est replié au départ : quatre groupes ouverts, c'étaient trente
    // curseurs déroulés avant qu'on ait décidé de quoi on voulait parler.
    return fold(g.label, `${mine.length} curseur${mine.length > 1 ? 's' : ''} · ${g.note}`, body, { id: `sim-${g.key}` })
  }).filter(Boolean)
}

/**
 * Un curseur qui n'écrit que dans la copie.
 *
 * La valeur du plan reste écrite en gris à côté de la valeur simulée : on voit
 * d'où l'on part et de combien on s'écarte, sans avoir à s'en souvenir. Un
 * clic sur cette valeur grise remet le curseur à sa place.
 */
function knob(lever, onLive) {
  const base = Number(lever.read(store.scenario)) || 0
  const initial = Number(lever.read(sandbox.draft)) || 0

  const value = h('output', { class: 'knob-value num' }, lever.fmt(initial))
  const shift = h('span', { class: 'knob-shift num' }, '')
  const min = Math.min(lever.min, base)
  const max = Math.max(lever.max, base * 1.6 || lever.max)
  const input = h('input', {
    type: 'range', min, max, step: lever.step, value: initial,
    'aria-label': `${lever.line} \u2014 ${lever.label}`, class: 'lever-range',
  })

  const paint = (raw) => {
    value.textContent = lever.fmt(raw)
    const delta = raw - base
    const same = Math.abs(delta) < (lever.step || 1) / 2
    shift.textContent = same ? '' : `${delta > 0 ? '+' : '\u2212'}${lever.fmt(Math.abs(delta))}`
    shift.className = `knob-shift num ${same ? '' : delta > 0 ? 'up' : 'down'}`
    value.classList.toggle('is-moved', !same)
  }
  paint(initial)

  input.addEventListener('input', () => {
    const raw = Number(input.value)
    lever.write(sandbox.draft, raw)
    paint(raw)
    onLive()
  })

  // La valeur du plan, pos\u00e9e sur la piste.
  //
  // Elle vivait sous le curseur, en gris, parmi trois autres mentions : pour
  // savoir de combien on s'\u00e9tait \u00e9cart\u00e9, il fallait lire un nombre et le
  // comparer de t\u00eate \u00e0 un autre. Un trait pointill\u00e9 \u00e0 sa place exacte, le
  // chiffre dessous, dit la m\u00eame chose sans calcul \u2014 comme le seuil sur la
  // courbe des volumes. Un clic dessus y ram\u00e8ne le curseur.
  const at = max > min ? ((base - min) / (max - min)) * 100 : 0
  const mark = h('button', {
    class: 'knob-mark', style: { left: `${Math.min(100, Math.max(0, at))}%` },
    title: `Ton plan : ${lever.fmt(base)} \u2014 cliquer pour y revenir`,
    onClick: () => { input.value = base; lever.write(sandbox.draft, base); paint(base); onLive() },
  },
    h('i', { 'aria-hidden': 'true' }),
    h('b', { class: 'num' }, lever.fmt(base)),
  )

  return h('div', { class: 'knob' },
    h('div', { class: 'knob-top' },
      h('label', { class: 'knob-label' }, lever.label),
      h('div', { class: 'knob-readout' }, value, shift),
    ),
    h('div', { class: 'knob-track' }, input, mark),
    lever.hint ? h('span', { class: 'knob-why' }, lever.hint) : null,
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
    { label: 'EBE année 1', read: (r) => r.pnl.ebitda[0], good: 1 },
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

  const kept = new Set(list.map((c) => c.lever.id))
  const effects = h('div', { class: 'apply-effects' })

  const projected = () => {
    const next = clone(store.scenario)
    for (const c of list) {
      if (!kept.has(c.lever.id)) continue
      c.lever.write(next, c.after)
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

  /**
   * Enregistrer, puis aller voir.
   *
   * Un changement validé dans un écran de confirmation reste abstrait tant
   * qu'on n'a pas vu où il s'est posé. On enregistre donc, on ouvre le module
   * concerné, et on entoure le champ : le fondateur finit le geste à l'endroit
   * où la valeur vit désormais, et peut la retoucher tout de suite.
   *
   * @param gap  la destination à ouvrir et entourer, ou null pour rester ici
   */
  const confirm = (gap) => {
    const keptList = list.filter((c) => kept.has(c.lever.id))
    if (!keptList.length) { toast('Aucun changement retenu.', 'err'); return }
    store.update((sc) => {
      for (const c of keptList) c.lever.write(sc, c.after)
    }, { label: `Simulation appliquée (${keptList.length})` })
    resetSandbox()
    toast(`${keptList.length} changement${keptList.length > 1 ? 's' : ''} enregistré${keptList.length > 1 ? 's' : ''}.`, 'ok')
    if (gap && navigate) goToGap(gap, navigate)
    else refresh()
  }

  // Les changements, rangés par module de destination.
  const byModule = new Map()
  for (const c of list) {
    // Le groupe du levier est déjà celui du module qui l'accueillera.
    const key = { offre: 'offre', charge: 'achats', equipe: 'equipe', financement: 'financement' }[c.lever.group] || 'offre'
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
      // Le repère du premier changement du groupe : c'est là qu'on emmène.
      const gap = { route: mod.route }
      return h('section', { class: 'apply-mod' },
        h('div', { class: 'apply-mod-head' },
          h('span', { class: 'apply-mod-name' }, mod.label),
          h('button', {
            class: 'btn btn-primary',
            onClick: () => confirm(gap),
          }, `Enregistrer et voir dans ${mod.label} \u2192`),
        ),
        ...items.map((c) => {
          const box = h('input', { type: 'checkbox', checked: true })
          box.addEventListener('change', () => {
            box.checked ? kept.add(c.lever.id) : kept.delete(c.lever.id)
            paintEffects()
          })
          return h('label', { class: 'apply-row' },
            box,
            h('span', { class: 'apply-row-label' }, `${c.lever.line} · ${c.lever.label}`),
            h('span', { class: 'apply-row-before num' }, c.lever.fmt(c.before)),
            h('span', { class: 'apply-row-arrow' }, '→'),
            h('span', { class: 'apply-row-after num' }, c.lever.fmt(c.after)),
          )
        }),
      )
    }),

    h('div', { class: 'apply-effects-tag' }, 'Ce que ça change dans les comptes'),
    effects,
    h('div', { class: 'apply-actions' },
      // L'action par défaut est d'aller voir : enregistrer sans regarder où ça
      // se pose, c'est ce que faisait l'ancienne version, et on ne savait plus
      // ensuite d'où venait le chiffre.
      h('button', {
        class: 'btn btn-lg btn-quiet',
        onClick: () => confirm(null),
      }, 'Enregistrer sans quitter le tableau de bord'),
      h('button', { class: 'btn btn-lg btn-ghost', onClick: () => { sandbox.stage = 'jeu'; refresh() } }, 'Retour à la simulation'),
    ),
  )
}

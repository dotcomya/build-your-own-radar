/**
 * « Combien de clients pour vivre » — la seule question à laquelle aucune
 * autre page ne répond.
 *
 * Le reste du logiciel décrit : voici ton chiffre d'affaires, voici tes
 * charges, voici ton résultat. Cette page-ci décide. Elle prend ce qu'il
 * faut couvrir chaque mois, ce que rapporte un client, et en tire le nombre
 * qui gouverne tout le projet — combien de clients il faut, et à quelle date
 * tu les auras au rythme prévu.
 *
 * Trois curseurs suffisent à en faire un instrument : le prix, le coût de
 * revient, ta rémunération. Tout se recalcule pendant le geste.
 */

import { h, euro, pct, num, monthLabel, tabs, pageBar } from '../dom.js'
import { vocabulaireDuPlan, getSector } from '../../state/sectors.js'
import { referenceYear } from '../../format.js'
import { journey } from '../../engine/journey.js'
import { compute } from '../../engine/engine.js'
import { stepBanner } from '../tutorial.js'
import { areaChart, PALETTE } from '../charts.js'
import store from '../../state/store.js'
import { memoire } from '../memoire.js'

/**
 * Qui est le fondateur dans l'équipe.
 * Construit à partir d'une chaîne, jamais écrit en littéral : esbuild n'échappe
 * pas les accents d'une expression régulière, et le fichier unique s'en trouve
 * corrompu dès qu'il est servi sans jeu de caractères explicite.
 */
const ME = new RegExp('fondateur|dirigeant|g\u00E9rant|moi', 'i')

export function renderModel(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  const voc = vocabulaireDuPlan(s)
  const sector = getSector(s.meta.sectorKey)

  if (!r || !s.activities.length) {
    return h('div', { class: 'content' },
      stepBanner('modele', journey(s, r), navigate, 'modele'),
      h('div', { class: 'card' }, h('div', { class: 'empty' },
        h('h3', {}, 'Rien à calculer pour l’instant'),
        h('p', { class: 'muted' }, "Renseigne une offre et un prix : ce tableau te dira combien de clients il te faut."),
        h('button', { class: 'btn btn-primary mt', onClick: () => navigate('#/offre') }, 'Définir mon offre'),
      )),
    )
  }

  const views = [
    { key: 'seuil', label: 'Combien de clients' },
    { key: 'sensibilite', label: 'Ce qui change tout' },
  ]
  const view = views.some((v) => v.key === memoire.modele.view) ? memoire.modele.view : 'seuil'
  memoire.modele.view = view

  const host = h('div', { class: 'view' })
  // Le premier rendu a lieu avant que le nœud ne rejoigne le document ; on ne
  // s'abstient que pour les repeints suivants, quand un rendu complet est
  // passé entre-temps et a détaché ce qu'on s'apprêtait à mettre à jour.
  let painted = false
  const paint = (res) => {
    if (painted && !host.isConnected) return
    painted = true
    host.replaceChildren(view === 'seuil' ? breakEvenBoard(res, s, voc) : sensitivityBoard(res, s, voc))
  }
  paint(r)

  return h('div', { class: 'content' },
    stepBanner('modele', journey(s, r), navigate, 'modele'),

    pageBar('Ton modèle', headline(r, s, voc)),

    tabs(views, view, (k) => { memoire.modele.view = k; refresh() }),

    knobs(s, voc, paint, refresh),

    host,

    sector ? h('p', { class: 'model-sector' },
      `Repère du métier — ${sector.label.toLowerCase()} : ${sector.tagline}`) : null,

  )
}

/** La phrase du bandeau : l'état du modèle en une ligne. */
function headline(r, s, voc) {
  const m = metrics(r, s)
  if (m.marginPerClient <= 0) return `Chaque ${voc.one} vendu te coûte plus qu'il ne rapporte : le seuil n'existe pas.`
  if (!Number.isFinite(m.needed)) return 'Renseigne tes charges pour connaître ton seuil.'
  return `Il te faut ${num(Math.ceil(m.needed))} ${voc.many} par mois pour couvrir tes charges.`
}

/* ─────────────────── Ce qu'il faut couvrir, et avec quoi ────────────────── */

/**
 * Les nombres qui gouvernent le seuil.
 *
 * On raisonne sur l'exercice de référence, au mois : c'est l'échelle à
 * laquelle un fondateur pense — « combien par mois ».
 */
function metrics(r, s) {
  const y = referenceYear(r)
  const p = r.pnl
  const months = 12

  const fixed = (p.external[y] + p.payroll[y] + p.duties[y] + p.amortisation[y]) / months
  const units = r.revenue.units.slice(y * 12, y * 12 + 12).reduce((a, b) => a + b, 0)
  const contribution = (p.revenue[y] - p.variableCost[y]) / months
  const marginPerClient = units > 0 ? (p.revenue[y] - p.variableCost[y]) / units : 0
  const perMonthNow = units / months

  const founder = (s.team || [])
    .filter((m) => m.enabled !== false && ME.test(m.role || ''))
    .reduce((a, m) => a + (Number(m.monthlyGross) || 0) * (Number(m.count) || 1), 0)

  return {
    y, fixed, contribution, marginPerClient, perMonthNow,
    needed: marginPerClient > 0 ? fixed / marginPerClient : Infinity,
    founder,
    covered: contribution - fixed,
    monthReached: firstMonthAbove(r, marginPerClient > 0 ? fixed / marginPerClient : Infinity),
  }
}

/** Le premier mois où le volume mensuel dépasse le seuil. */
function firstMonthAbove(r, needed) {
  if (!Number.isFinite(needed)) return null
  const i = r.revenue.units.findIndex((v) => v >= needed)
  return i === -1 ? null : i
}

/**
 * Le tableau du seuil.
 *
 * Un nombre énorme, et ce qui le compose de part et d'autre : ce qu'il faut
 * couvrir, ce que rapporte un client. Rien d'autre à l'écran.
 */
/**
 * Le seuil de rentabilité, dit comme une division.
 *
 * Trois colonnes, une jauge et deux notes disaient la même chose sans jamais
 * énoncer l'opération. « Il te faut 3 abonnements » sans montrer d'où sort le
 * 3, c'est un oracle : on ne peut ni le vérifier ni le déplacer.
 *
 * On écrit donc le calcul en toutes lettres — ce qu'il faut couvrir, divisé par
 * ce que rapporte une vente, égale le nombre à atteindre. Chaque terme est un
 * chiffre qu'on reconnaît, et changer un prix déplace le résultat sous les
 * yeux. Le décimal est conservé : arrondi à l'unité, une amélioration de
 * 2,4 à 2,1 ne se voyait pas, et l'outil semblait figé.
 */
export function breakEvenBoard(r, s, voc) {
  const m = metrics(r, s)
  const reachable = Number.isFinite(m.needed) && m.needed > 0
  const ratio = reachable ? Math.min(1, m.perMonthNow / m.needed) : 0
  const ok = reachable && m.perMonthNow >= m.needed
  const round = (v) => (v >= 10 ? num(Math.round(v)) : num(v, 1))

  // Le seuil et la courbe ne font qu'un bloc.
  //
  // Séparés, on lisait « il t'en faut 294 par mois », puis, après une
  // respiration, un graphique intitulé « Glaces par mois » qu'on prenait pour
  // un autre sujet. C'est la même phrase : voici le nombre, et voici où tu en
  // es. Ils tiennent donc dans le même cadre, sans coupure entre les deux.
  return h('section', { class: `seuil ${ok ? 'is-ok' : ''}` },
    h('div', { class: 'seuil-eq' },
      term('Frais fixes du mois', euro(m.fixed), 'Charges, salaires, imp\u00f4ts et amortissements : ils tombent sans vente'),
      h('span', { class: 'seuil-op' }, '\u00f7'),
      term(`Marge par ${voc.one}`, euro(m.marginPerClient), 'Prix encaiss\u00e9 moins le co\u00fbt direct de la vente'),
      h('span', { class: 'seuil-op' }, '='),
      h('div', { class: 'seuil-term is-result' },
        h('div', { class: 'seuil-term-tag' }, `${voc.many} par mois`),
        h('div', { class: 'seuil-term-value num' }, reachable ? round(m.needed) : '\u2014'),
        h('div', { class: 'seuil-term-note' }, reachable ? 'Le seuil \u00e0 franchir' : 'Marge nulle ou n\u00e9gative'),
      ),
    ),
    reachable ? h('div', { class: 'seuil-where' },
      h('div', { class: 'seuil-meter' }, h('i', { style: { width: `${Math.round(ratio * 100)}%` } })),
      h('p', { class: 'seuil-line' },
        ok
          ? `Tu en es \u00e0 ${round(m.perMonthNow)} par mois : le seuil est franchi, chaque vente de plus tombe en r\u00e9sultat.`
          : `Tu en es \u00e0 ${round(m.perMonthNow)} par mois, soit ${pct(ratio, 0)} du chemin. Il en manque ${round(Math.max(0, m.needed - m.perMonthNow))}.`),
    ) : null,

    h('div', { class: 'seuil-chart' },
      h('div', { class: 'seuil-chart-head' },
        h('h2', {}, `${voc.many[0].toUpperCase()}${voc.many.slice(1)} par mois`),
        h('div', { class: 'tiny muted' }, reachable ? 'Le trait rouge est le seuil' : 'Le seuil ne peut pas \u00eatre trac\u00e9'),
      ),
      areaChart({
        values: r.revenue.units, startDate: r.startDate, height: 190,
        color: PALETTE[2], markZero: false, formatter: (v) => num(v, 0),
        threshold: reachable ? { value: m.needed, label: `seuil ${round(m.needed)}` } : null,
      }),
      h('p', { class: 'chart-note' },
        m.monthReached !== null
          ? `Tes volumes passent au-dessus du seuil en ${monthLabel(m.monthReached, r.startDate)}. Avant cette date, chaque mois creuse la tr\u00e9sorerie d'environ ${euro(Math.max(0, m.fixed - m.contribution))}.`
          : reachable
            ? `Le seuil n'est jamais franchi sur cinq ans : tes volumes plafonnent \u00e0 ${round(Math.max(...r.revenue.units))} par mois. Monter le prix, baisser le co\u00fbt de revient ou all\u00e9ger les charges fixes le rapproche.`
            : `Tant qu'un ${voc.one} rapporte moins qu'il ne co\u00fbte, aucun volume ne rend le mod\u00e8le viable.`),
    ),
  )
}

/** Un terme de la division : son nom, son chiffre, ce qu'il contient. */
const term = (tag, value, note) => h('div', { class: 'seuil-term' },
  h('div', { class: 'seuil-term-tag' }, tag),
  h('div', { class: 'seuil-term-value num' }, value),
  h('div', { class: 'seuil-term-note' }, note),
)

/* ────────────────────────── Ce qui change tout ──────────────────────────── */

/**
 * La sensibilité du seuil.
 *
 * Trois questions valent toutes les explications : si j'augmente mon prix de
 * 10 %, combien de clients en moins me faut-il ? Et si je baisse mon coût de
 * revient ? Et si je me paie plus ? Chaque réponse est obtenue en rejouant le
 * modèle entier, pas estimée.
 */
function sensitivityBoard(r, s, voc) {
  const base = metrics(r, s)

  const trials = [
    { label: 'Prix de vente +10 %', apply: (sc) => sc.activities.forEach((a) => { a.unitPrice = (Number(a.unitPrice) || 0) * 1.1; a.recurringPrice = (Number(a.recurringPrice) || 0) * 1.1 }) },
    { label: 'Prix de vente −10 %', apply: (sc) => sc.activities.forEach((a) => { a.unitPrice = (Number(a.unitPrice) || 0) * 0.9; a.recurringPrice = (Number(a.recurringPrice) || 0) * 0.9 }) },
    { label: 'Coût de revient −20 %', apply: (sc) => sc.activities.forEach((a) => { a.unitCost = (Number(a.unitCost) || 0) * 0.8; a.recurringCost = (Number(a.recurringCost) || 0) * 0.8 }) },
    { label: 'Charges externes −20 %', apply: (sc) => sc.opex.forEach((o) => { o.monthlyAmount = (Number(o.monthlyAmount) || 0) * 0.8 }) },
    { label: 'Une embauche de plus', apply: (sc) => { const t = sc.team?.[0]; if (t) sc.team.push({ ...t, id: `sim_${Math.random().toString(36).slice(2, 7)}`, role: 'Embauche simulée' }) } },
  ]

  const rows = trials.map((t) => {
    let needed = null
    try {
      const copy = JSON.parse(JSON.stringify(s))
      t.apply(copy)
      needed = metrics(compute(copy), copy).needed
    } catch { needed = null }
    const delta = needed !== null && Number.isFinite(needed) && Number.isFinite(base.needed)
      ? Math.ceil(needed) - Math.ceil(base.needed)
      : null
    return { label: t.label, needed, delta }
  })

  return h('div', {},
    h('p', { class: 'view-intro' },
      `Chaque ligne rejoue le modèle entier avec une seule modification et lit le nouveau seuil. Aujourd’hui il te faut ${Number.isFinite(base.needed) ? num(Math.ceil(base.needed)) : '—'} ${voc.many} par mois.`),

    h('div', { class: 'sens' },
      ...rows.map((row) => h('div', { class: `sens-row ${row.delta === null ? '' : row.delta < 0 ? 'is-good' : row.delta > 0 ? 'is-bad' : ''}` },
        h('span', { class: 'sens-label' }, row.label),
        h('span', { class: 'sens-value num' }, Number.isFinite(row.needed) ? `${num(Math.ceil(row.needed))} ${voc.many}` : '—'),
        h('span', { class: 'sens-delta num' },
          row.delta === null ? '' : row.delta === 0 ? 'inchangé' : `${row.delta > 0 ? '+' : ''}${num(row.delta)}`),
      )),
    ),

    h('p', { class: 'chart-note mt' },
      'Un seuil qui baisse est un modèle qui devient plus sûr : moins de clients à trouver pour la même viabilité.'),
  )
}

/* ──────────────────────────── Les trois curseurs ────────────────────────── */

/**
 * Les manettes du modèle.
 *
 * Elles écrivent dans le scénario pendant le geste et recalculent tout sans
 * redessiner la page : c'est ce qui permet de sentir la pente au lieu de la
 * lire.
 */
function knobs(s, voc, paint, refresh) {
  const act = s.activities[0]
  if (!act) return null
  const founder = (s.team || []).find((m) => ME.test(m.role || ''))

  const rows = [
    {
      key: 'prix', label: `Prix par ${voc.one}`,
      get: () => Number(act.recurringPrice) > 0 ? Number(act.recurringPrice) : Number(act.unitPrice) || 0,
      set: (sc, v) => { const a = sc.activities[0]; if (Number(a.recurringPrice) > 0) a.recurringPrice = v; else a.unitPrice = v },
      format: (v) => euro(v),
    },
    {
      key: 'cout', label: `Coût de revient par ${voc.one}`,
      get: () => Number(act.recurringPrice) > 0 ? Number(act.recurringCost) || 0 : Number(act.unitCost) || 0,
      set: (sc, v) => { const a = sc.activities[0]; if (Number(a.recurringPrice) > 0) a.recurringCost = v; else a.unitCost = v },
      format: (v) => euro(v),
    },
    founder ? {
      key: 'salaire', label: 'Ta rémunération',
      get: () => (Number(founder.monthlyGross) || 0) * 12,
      set: (sc, v) => { const f = sc.team.find((m) => m.id === founder.id); if (f) f.monthlyGross = v / 12 },
      format: (v) => `${euro(v)} / an`,
    } : null,
  ].filter(Boolean)

  return h('div', { class: 'knobs' },
    ...rows.map((row) => {
      const start = row.get()
      const max = Math.max(start * 2.5, start + 100, 10)
      const out = h('output', { class: 'knob-value num' }, row.format(start))
      const input = h('input', {
        type: 'range', class: 'knob-range', min: 0, max, step: Math.max(1, Math.round(max / 200)), value: start,
        'aria-label': row.label,
      })
      input.addEventListener('input', () => {
        const v = Number(input.value)
        out.textContent = row.format(v)
        row.set(store.scenario, v)
        paint(compute(store.scenario))
      })
      input.addEventListener('change', () => {
        store.update((sc) => row.set(sc, Number(input.value)), { label: row.label })
        refresh()
      })
      return h('div', { class: 'knob' },
        h('div', { class: 'knob-top' }, h('span', { class: 'knob-label' }, row.label), out),
        input,
      )
    }),
  )
}

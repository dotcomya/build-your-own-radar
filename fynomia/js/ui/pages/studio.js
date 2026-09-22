/**
 * La synthèse, deuxième écriture.
 *
 * Le tableau de bord actuel dit tout, et il le dit dans des cartes blanches de
 * même largeur, empilées. C'est lisible et c'est neutre — trop neutre : rien
 * n'y pèse plus que le reste, et le regard doit tout parcourir pour trouver la
 * seule chose qui compte ce matin-là.
 *
 * Cet écran essaie l'inverse, sans rien perdre de la profondeur : une métrique
 * occupe les deux tiers de la largeur dans un bloc noir et une typographie
 * énorme, le reste se range autour d'elle. Les graphiques secondaires n'ont
 * plus de cadre — ils respirent sur le fond crème. Les chiffres, les ratios et
 * les dates passent tous en chasse fixe, parce que c'est ainsi qu'on lit un
 * outil d'ingénierie. Et les proportions se disent en barres empilées fines,
 * pas en camemberts : on compare des longueurs, pas des angles.
 *
 * Deuxième passe : l'écran portait la forme, il lui manquait le fond. Il porte
 * maintenant tout ce que le fondateur vient chercher — les chiffres clés, les
 * cinq exercices, le détail complet de l'EBITDA jusqu'au résultat net, la
 * répartition du chiffre d'affaires par offre et les ratios que lit un
 * financeur. Rien n'est figé : chaque barre se laisse survoler, l'année se
 * choisit d'un clic et l'écran se monte en séquence plutôt que d'apparaître
 * d'un bloc.
 *
 * Aucun calcul nouveau : les mêmes séries que la synthèse, présentées
 * autrement. C'est un essai de forme, et il doit pouvoir être jugé comme tel.
 */

import { h, euro, num, pct, monthLabel } from '../dom.js'
import { hot } from '../charts.js'
import { checklist } from '../checklist.js'
import { goToGap } from '../spotlight.js'
import { suggestActions } from '../../engine/simulate.js'
import store from '../../state/store.js'

const n = (v) => Number(v) || 0
const somme = (a) => (a || []).reduce((x, y) => x + n(y), 0)

/**
 * L'année lue en ce moment.
 *
 * Elle survit aux rendus — sinon le moindre réglage ramènerait le lecteur à
 * l'année 1 alors qu'il examinait l'année 4.
 */
let anneeVue = null

/**
 * Le moment du dernier rendu.
 *
 * Les animations d'entrée doivent se jouer quand on arrive sur l'écran, pas à
 * chaque frappe au clavier : le tableau de bord se redessine à chaque
 * changement de chiffre, et des barres qui repoussent trente fois par minute
 * rendent la page illisible. Un écart d'une seconde et demie sépare les deux
 * cas sans avoir à instrumenter le montage du composant.
 */
let dernierRendu = 0

export function renderStudio(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  if (!r) return h('div', { class: 'content' }, h('p', {}, 'Aucun résultat.'))

  const maintenant = Date.now()
  const entree = maintenant - dernierRendu > 1500
  dernierRendu = maintenant

  const an = anneeChoisie(r)
  const choisir = (y) => { anneeVue = y; refresh() }

  return h('div', { class: `st ${entree ? 'is-enter' : ''}` },
    heroRow(s, r, navigate),
    keyRow(r),
    h('div', { class: 'st-cols' }, refineCol(s, navigate), leverCol(s, r)),
    perfChart(r, an, choisir),
    h('div', { class: 'st-cols st-cols-even' }, ladder(r, an), splitBar(r, an)),
    mixBar(r, an),
    cashCurve(r),
    ratioRow(r, an),
  )
}

/** L'année lue : celle qu'on a choisie, sinon la première qui gagne de l'argent. */
function anneeChoisie(r) {
  if (anneeVue !== null && anneeVue >= 0 && anneeVue < 5) return anneeVue
  const y = r.kpis?.firstProfitableYear
  return y !== null && y !== undefined && y >= 0 ? y : 0
}

/* ─────────────────────── 1. Deux tiers, un tiers ─────────────────────────── */

/**
 * Le point mort en très grand, la trésorerie à côté.
 *
 * Deux blocs de largeur inégale : celui qui décide prend les deux tiers et le
 * noir, celui qui accompagne prend le tiers restant et reste clair. C'est la
 * hiérarchie dite par la surface, avant même qu'on ait lu un mot.
 */
function heroRow(s, r, navigate) {
  const k = r.kpis
  const mois = (k.breakEvenMonth || []).findIndex((v) => v !== null && v !== undefined)
  const moisVal = mois >= 0 ? n(k.breakEvenMonth[mois]) : null
  const annee = k.firstProfitableYear
  const grand = moisVal !== null ? `M${Math.round(moisVal) + 1}`
    : annee !== null && annee !== undefined ? `A${annee + 1}`
      : '—'

  const bas = k.cashLow || {}
  const quand = bas.month != null ? monthLabel(bas.month, r.startDate) : null
  const manque = n(k.fundingNeed)

  const dit = annee !== null && annee !== undefined
    ? `Tu atteindrais l’équilibre en année ${annee + 1}. ` + (manque > 0
        ? `D’ici là, ${euro(manque)} doivent être trouvés — c’est la trésorerie qui commande, pas le résultat.`
        : 'La trésorerie ne passe jamais sous zéro sur l’horizon.')
    : 'Aucun exercice ne dégage de bénéfice sur cinq ans. Le prix, les volumes et le poste le plus lourd sont les trois seuls leviers.'

  return h('section', { class: 'st-hero' },
    h('div', { class: 'st-big' },
      h('div', { class: 'st-big-top' },
        h('span', { class: 'st-kicker' },
          h('i', { class: 'st-dot', 'aria-hidden': 'true' }), 'Point mort estimé'),
        h('span', { class: 'st-badge' }, 'Live'),
      ),
      h('div', { class: 'st-big-fig' },
        h('span', { class: 'st-big-num' }, grand),
        annee !== null && annee !== undefined
          ? h('span', { class: 'st-big-delta' }, `↘ année ${annee + 1} d’exploitation`)
          : h('span', { class: 'st-big-delta is-off' }, '↗ hors horizon'),
      ),
      h('p', { class: 'st-big-say' }, dit),
    ),

    h('aside', { class: 'st-side' },
      h('div', { class: 'st-kicker is-dark' }, 'Trésorerie point bas'),
      h('div', { class: 'st-side-fig' },
        h('span', { class: 'st-side-num' }, euro(n(bas.value), { compact: true })),
      ),
      h('div', { class: 'st-side-when' }, quand ? `Point bas en ${quand}` : 'Jamais négative'),
      h('span', { class: 'spacer' }),
      h('button', {
        class: 'st-cta',
        onClick: (e) => goToGap({ route: 'financement' }, navigate, e.currentTarget),
      }, 'Voir le plan de financement'),
    ),
  )
}

/* ─────────────────────── 2. La ligne des chiffres clés ───────────────────── */

/**
 * Six chiffres, une ligne, aucune carte.
 *
 * Ce sont les valeurs qu'on cite de mémoire quand on parle de son entreprise :
 * le chiffre d'affaires de l'année 1 et celui de l'année 5, ce que l'activité
 * dégage, ce qu'elle laisse, ce qu'elle emploie et ce qu'il faut apporter.
 * Chacun porte sa mesure secondaire en dessous — la croissance, le taux de
 * marge, le mois — parce qu'un montant seul ne se juge pas.
 */
function keyRow(r) {
  const p = r.pnl
  const k = r.kpis
  const eff = r.payroll?.headcount || []
  const effFin = n(eff[11])
  const effCinq = n(eff[59])
  const croissance = n(p.revenue[0]) > 0 ? n(p.revenue[4]) / n(p.revenue[0]) : null
  const runway = k.runwayMonths
  const unites = somme((r.revenue?.units || []).slice(0, 12))

  const cases = [
    {
      cle: 'CA année 1', val: euro(n(p.revenue[0]), { compact: true }),
      sous: unites > 0 ? `${num(unites)} unités vendues` : 'Aucune vente saisie',
    },
    {
      cle: 'CA année 5', val: euro(n(p.revenue[4]), { compact: true }),
      sous: croissance ? `× ${num(croissance, 1)} en cinq ans` : 'Croissance non calculable',
      fort: true,
    },
    {
      cle: 'EBITDA année 1', val: euro(n(p.ebitda[0]), { compact: true }),
      sous: `${pct(n(k.ebitdaMargin[0]))} du chiffre d’affaires`,
      signe: n(p.ebitda[0]),
    },
    {
      cle: 'Résultat net année 1', val: euro(n(p.netResult[0]), { compact: true }),
      sous: `${pct(n(k.netMargin[0]))} du chiffre d’affaires`,
      signe: n(p.netResult[0]),
    },
    {
      cle: 'Effectif fin d’année 1', val: num(effFin, effFin % 1 ? 1 : 0),
      sous: effCinq ? `${num(effCinq, effCinq % 1 ? 1 : 0)} en fin d’année 5` : 'Aucune embauche prévue',
    },
    {
      cle: 'Besoin de financement', val: euro(n(k.fundingNeed), { compact: true }),
      sous: runway !== null && runway !== undefined && Number.isFinite(runway)
        ? `${num(runway, 1)} mois d’autonomie`
        : 'Trésorerie toujours positive',
      signe: -n(k.fundingNeed),
    },
  ]

  return h('section', { class: 'st-keys' },
    ...cases.map((c, i) => h('div', {
      class: `st-key ${c.fort ? 'is-strong' : ''}`,
      style: { '--i': String(i) },
    },
      h('div', { class: 'st-key-cle' }, c.cle),
      h('div', {
        class: `st-key-val ${c.signe !== undefined ? (c.signe < 0 ? 'is-neg' : 'is-pos') : ''}`,
      }, c.val),
      h('div', { class: 'st-key-sous' }, c.sous),
    )),
  )
}

/* ─────────────────────── 3. Deux colonnes de travail ─────────────────────── */

/** Ce qu'il reste à poser : une barre segmentée, puis les lignes. */
function refineCol(s, navigate) {
  let c
  try { c = checklist(s) } catch { return null }
  const items = (c.items || [])
  const faits = items.filter((i) => i.done).length
  const part = items.length ? faits / items.length : 0
  const cinq = items.filter((i) => !i.done).slice(0, 4)
  const derniers = items.filter((i) => i.done).slice(-2)
  const liste = [...derniers, ...cinq]

  return h('div', { class: 'st-col' },
    h('h3', { class: 'st-col-title' }, 'Affiner mon dossier'),
    h('div', { class: 'st-seg', 'aria-hidden': 'true' },
      ...Array.from({ length: 3 }, (_, i) => {
        const debut = i / 3, fin = (i + 1) / 3
        const rempli = Math.max(0, Math.min(1, (part - debut) / (fin - debut)))
        return h('span', { class: 'st-seg-cell' }, h('i', { style: { width: `${rempli * 100}%` } }))
      }),
      h('span', { class: 'st-seg-num' }, `${Math.round(part * 100)} %`),
    ),
    h('ul', { class: 'st-checks' },
      ...liste.map((i) => h('li', { class: `st-check ${i.done ? 'is-done' : ''} ${i === cinq[0] ? 'is-next' : ''}` },
        h('button', {
          class: 'st-check-go',
          onClick: (e) => (i.go ? goToGap(i.go, navigate, e.currentTarget) : null),
        },
          h('span', { class: 'st-check-mark', 'aria-hidden': 'true' }, i.done ? '✓' : ''),
          h('span', { class: 'st-check-label' }, i.label),
        ),
      )),
    ),
  )
}

/** Les leviers, classés par ce qu'ils rapportent. */
function leverCol(s, r) {
  let best = []
  try { best = suggestActions(s, r, { limit: 3 }).best } catch { best = [] }
  if (!best.length) {
    return h('div', { class: 'st-col' },
      h('h3', { class: 'st-col-title' }, 'Leviers classés par impact'),
      h('p', { class: 'st-empty' },
        'Aucun levier ne déplace le modèle en l’état. Pose un prix et des volumes : le classement se remplit tout seul.'),
    )
  }
  return h('div', { class: 'st-col' },
    h('h3', { class: 'st-col-title' }, 'Leviers classés par impact'),
    ...best.map((a, i) => {
      const gain = -n(a.delta.fundingNeed) > 0 ? -n(a.delta.fundingNeed) : n(a.delta.ebitda)
      const quoi = -n(a.delta.fundingNeed) > 0 ? 'Trésorerie' : 'EBITDA'
      return h('div', { class: 'st-lever' },
        h('span', { class: 'st-lever-no' }, String(i + 1)),
        h('span', { class: 'spacer' },
          h('div', { class: 'st-lever-label' }, a.label),
          a.detail ? h('div', { class: 'st-lever-detail' }, a.detail) : null,
        ),
        h('span', { class: 'st-lever-gain' },
          h('span', { class: 'st-lever-amount' }, `${gain >= 0 ? '+' : ''} ${euro(gain)}`),
          h('span', { class: 'st-lever-what' }, quoi),
        ),
      )
    }),
  )
}

/* ─────────────────────── 4. Cinq exercices, trois séries ─────────────────── */

/**
 * Le chiffre d'affaires, l'EBITDA et le résultat net, sur cinq ans.
 *
 * Trois barres par exercice, posées de part et d'autre d'une ligne de zéro :
 * une perte descend, elle ne se contente pas de disparaître. Survoler une
 * colonne donne le compte de résultat entier de l'année, du chiffre d'affaires
 * au résultat net en passant par chaque poste — c'est là que se lit le détail
 * de l'EBITDA. Cliquer choisit l'année que lisent les blocs suivants.
 */
function perfChart(r, an, choisir) {
  const p = r.pnl
  const series = [
    { cle: 'ca', nom: 'Chiffre d’affaires', vals: p.revenue },
    { cle: 'ebitda', nom: 'EBITDA', vals: p.ebitda },
    { cle: 'net', nom: 'Résultat net', vals: p.netResult },
  ]
  const toutes = series.flatMap((s) => s.vals.map(n))
  const haut = Math.max(0, ...toutes)
  const bas = Math.min(0, ...toutes)
  if (haut === 0 && bas === 0) return null
  const span = haut - bas || 1
  // La ligne de zéro est passée en fraction plutôt qu'en pourcentage : la zone
  // des barres est plus courte que le cadre de la hauteur des étiquettes, et
  // seule une multiplication dans le calc() retombe exactement au bon endroit.
  const partHaut = haut / span

  return h('section', { class: 'st-perf' },
    h('div', { class: 'st-split-head' },
      h('h3', { class: 'st-col-title' }, 'Cinq exercices, trois lignes'),
      h('div', { class: 'st-perf-keys' },
        ...series.map((s) => h('span', { class: `st-leg is-${s.cle}` },
          h('i', { 'aria-hidden': 'true' }), h('span', { class: 'st-leg-name' }, s.nom))),
      ),
    ),

    h('div', { class: 'st-perf-plot', style: { '--zero': String(partHaut) } },
      h('i', { class: 'st-perf-zero', 'aria-hidden': 'true' }),
      ...Array.from({ length: 5 }, (_, y) => {
        const col = h('div', {
          class: `st-perf-col ${y === an ? 'is-picked' : ''}`,
          onClick: () => choisir(y),
          role: 'button',
          tabindex: '0',
          'aria-label': `Année ${y + 1}`,
          onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choisir(y) } },
        },
          h('div', { class: 'st-perf-bars' },
            ...series.map((s, si) => {
              const v = n(s.vals[y])
              const taille = (Math.abs(v) / span) * 100
              const pose = v >= 0
                ? { bottom: `${((0 - bas) / span) * 100}%`, height: `${taille}%` }
                : { top: `${partHaut * 100}%`, height: `${taille}%` }
              return h('span', { class: 'st-perf-slot' },
                h('i', {
                  class: `st-perf-bar is-${s.cle} ${v < 0 ? 'is-down' : ''}`,
                  style: { ...pose, '--i': String(y * 3 + si) },
                }),
              )
            }),
          ),
          h('div', { class: 'st-perf-year' }, `A${y + 1}`),
        )
        return hot(col, `Année ${y + 1}`, () => lignesAnnee(r, y))
      }),
    ),
  )
}

/**
 * Le compte de résultat d'une année, tel qu'il s'affiche au survol.
 *
 * L'ordre est celui du plan comptable, parce que c'est celui qu'attend la
 * personne à qui ce document sera montré. Les soldes intermédiaires — marge
 * brute, EBITDA, résultat d'exploitation, résultat net — sont mis en avant :
 * ce sont eux qu'on cherche, le reste explique comment on y arrive.
 */
function lignesAnnee(r, y) {
  const p = r.pnl
  // Le libellé porte le signe de l'operation ; repeter un moins sur le montant
  // donnerait « - Achats -71 647 € », qui se lit comme une double negation. Le
  // test se fait sur le premier caractere, jamais par expression reguliere :
  // esbuild n'echappe pas les litteraux /.../, et un signe moins typographique
  // y corromprait le paquet.
  const signe = (label) => label[0] === '\u2212' || label[0] === '+'
  const l = (label, v, strong = false) => ({
    label, strong, value: euro(signe(label) ? Math.abs(n(v)) : n(v)),
  })
  return [
    l('Chiffre d’affaires', p.revenue[y], true),
    l('− Achats', -Math.abs(n(p.variableCost[y]))),
    l('= Marge brute', p.grossMargin[y], true),
    l('− Charges externes', -Math.abs(n(p.external[y]))),
    n(p.duties[y]) ? l('− Impôts et taxes', -Math.abs(n(p.duties[y]))) : null,
    n(p.grants[y]) ? l('+ Subventions', p.grants[y]) : null,
    l('− Salaires et cotisations', -Math.abs(n(p.payroll[y]))),
    l('= EBITDA', p.ebitda[y], true),
    n(p.amortisation[y]) ? l('− Amortissements', -Math.abs(n(p.amortisation[y]))) : null,
    l('= Résultat d’exploitation', p.ebit[y], true),
    n(p.interest[y]) ? l('− Intérêts', -Math.abs(n(p.interest[y]))) : null,
    n(p.corporateTax[y]) ? l('− Impôt sur les sociétés', -Math.abs(n(p.corporateTax[y]))) : null,
    n(p.credits[y]) ? l('+ Crédits d’impôt', p.credits[y]) : null,
    n(p.jeiSaving[y]) ? l('+ Économie JEI', p.jeiSaving[y]) : null,
    l('= Résultat net', p.netResult[y], true),
  ].filter(Boolean)
}

/* ─────────────────────── 5. L'échelle des soldes ─────────────────────────── */

/**
 * Du chiffre d'affaires au résultat net, marche par marche.
 *
 * Le survol donne le détail ; l'échelle le donne en permanence, avec la
 * longueur de chaque marche proportionnelle au chiffre d'affaires. On y voit
 * d'un coup d'œil ce qui mange la valeur : la marche la plus longue est le
 * poste à traiter en premier.
 */
function ladder(r, an) {
  const p = r.pnl
  const ca = n(p.revenue[an])
  if (ca <= 0) {
    return h('div', { class: 'st-col' },
      h('h3', { class: 'st-col-title' }, `Du chiffre d’affaires au résultat — A${an + 1}`),
      h('p', { class: 'st-empty' }, 'Aucun chiffre d’affaires cette année-là : l’échelle n’a rien à répartir.'),
    )
  }

  const marches = [
    { nom: 'Chiffre d’affaires', v: ca, solde: true },
    { nom: 'Achats', v: -Math.abs(n(p.variableCost[an])) },
    { nom: 'Marge brute', v: n(p.grossMargin[an]), solde: true },
    { nom: 'Charges externes', v: -Math.abs(n(p.external[an])) },
    { nom: 'Impôts et taxes', v: -Math.abs(n(p.duties[an])) },
    { nom: 'Salaires et cotisations', v: -Math.abs(n(p.payroll[an])) },
    { nom: 'EBITDA', v: n(p.ebitda[an]), solde: true },
    { nom: 'Amortissements', v: -Math.abs(n(p.amortisation[an])) },
    { nom: 'Intérêts', v: -Math.abs(n(p.interest[an])) },
    { nom: 'Impôt sur les sociétés', v: -Math.abs(n(p.corporateTax[an])) },
    { nom: 'Crédits d’impôt et JEI', v: n(p.credits[an]) + n(p.jeiSaving[an]) },
    { nom: 'Résultat net', v: n(p.netResult[an]), solde: true },
  ].filter((m) => m.solde || Math.abs(m.v) > 0.5)

  return h('div', { class: 'st-col' },
    h('h3', { class: 'st-col-title' }, `Du chiffre d’affaires au résultat — A${an + 1}`),
    h('div', { class: 'st-ladder' },
      ...marches.map((m, i) => {
        const part = Math.min(1, Math.abs(m.v) / ca)
        return h('div', {
          class: `st-step ${m.solde ? 'is-solde' : ''} ${m.v < 0 ? 'is-out' : ''}`,
          style: { '--i': String(i) },
        },
          h('span', { class: 'st-step-nom' }, m.nom),
          h('span', { class: 'st-step-bar' },
            h('i', { style: { width: `${part * 100}%`, '--i': String(i) } })),
          h('span', { class: 'st-step-val' },
            euro(m.solde ? m.v : Math.abs(m.v), { compact: true })),
          h('span', { class: 'st-step-pct' },
            `${Math.round(((m.solde ? m.v : Math.abs(m.v)) / ca) * 100)} %`),
        )
      }),
    ),
  )
}

/* ─────────────────────── 6. Où part l'argent encaissé ────────────────────── */

/**
 * Une barre empilée, pas un camembert.
 *
 * On compare mal des angles ; on compare très bien des longueurs posées sur la
 * même ligne. La légende passe en chasse fixe et porte le pourcentage, pour
 * qu'on puisse la lire sans revenir à la barre.
 */
function splitBar(r, an) {
  const p = r.pnl
  const rev = n(p.revenue[an])
  if (rev <= 0) return null

  const parts = [
    { nom: 'Achats', v: Math.abs(n(p.variableCost[an])) },
    { nom: 'Salaires', v: Math.abs(n(p.payroll[an])) },
    { nom: 'Charges fixes', v: Math.abs(n(p.external[an])) + Math.abs(n(p.duties[an])) },
    { nom: 'Amortissements', v: Math.abs(n(p.amortisation[an])) },
    { nom: 'Impôts', v: Math.abs(n(p.corporateTax[an])) },
  ].filter((x) => x.v > 0)
  const reste = rev - parts.reduce((a, x) => a + x.v, 0)
  const tout = [...parts, { nom: 'Ce qu’il reste', v: Math.max(0, reste), fin: true }]

  return h('section', { class: 'st-split st-col' },
    h('div', { class: 'st-split-head' },
      h('h3', { class: 'st-col-title' }, 'Où part chaque euro encaissé'),
      h('span', { class: 'st-split-year' }, `Année ${an + 1}`),
    ),
    hot(h('div', { class: 'st-bar', role: 'img', 'aria-label': 'Répartition du chiffre d’affaires' },
      ...tout.map((x, i) => h('i', {
        class: x.fin ? 'is-rest' : '',
        style: { width: `${(x.v / rev) * 100}%`, '--i': String(i) },
        title: `${x.nom} — ${euro(x.v)}`,
      })),
    ), `Chaque euro encaissé — A${an + 1}`, () => tout.map((x) => ({
      label: x.nom, value: `${euro(x.v)} · ${Math.round((x.v / rev) * 100)} %`, strong: !!x.fin,
    }))),
    h('div', { class: 'st-legend' },
      ...tout.map((x) => h('span', { class: `st-leg ${x.fin ? 'is-rest' : ''}` },
        h('i', { 'aria-hidden': 'true' }),
        h('span', { class: 'st-leg-name' }, x.nom),
        h('span', { class: 'st-leg-pct' }, `${Math.round((x.v / rev) * 100)} %`),
      )),
    ),
  )
}

/* ─────────────────────── 7. Ce qui fait le chiffre d'affaires ────────────── */

/**
 * La part de chaque offre dans le chiffre d'affaires de l'année.
 *
 * Un modèle qui repose à 92 % sur une seule offre ne se pilote pas comme un
 * modèle équilibré : c'est une information de structure, et elle ne se lit
 * nulle part ailleurs dans l'écran.
 */
function mixBar(r, an) {
  const offres = (r.revenue?.perActivity || [])
    .map((a) => ({ nom: a.name || 'Offre', v: somme((a.total || []).slice(an * 12, an * 12 + 12)) }))
    .filter((a) => a.v > 0)
    .sort((a, b) => b.v - a.v)
  if (!offres.length) return null
  const tot = offres.reduce((a, x) => a + x.v, 0)
  if (tot <= 0) return null

  return h('section', { class: 'st-mix' },
    h('div', { class: 'st-split-head' },
      h('h3', { class: 'st-col-title' }, 'Ce qui fait le chiffre d’affaires'),
      h('span', { class: 'st-split-year' },
        offres.length === 1 ? `Une seule offre · A${an + 1}` : `${offres.length} offres · A${an + 1}`),
    ),
    h('div', { class: 'st-mix-rows' },
      ...offres.slice(0, 8).map((o, i) => hot(h('div', { class: 'st-mix-row', style: { '--i': String(i) } },
        h('span', { class: 'st-mix-nom' }, o.nom),
        h('span', { class: 'st-mix-bar' }, h('i', { style: { width: `${(o.v / tot) * 100}%`, '--i': String(i) } })),
        h('span', { class: 'st-mix-val' }, euro(o.v, { compact: true })),
        h('span', { class: 'st-mix-pct' }, `${Math.round((o.v / tot) * 100)} %`),
      ), o.nom, () => [
        { label: `Chiffre d’affaires A${an + 1}`, value: euro(o.v), strong: true },
        { label: 'Part du total', value: pct(o.v / tot) },
      ])),
    ),
  )
}

/* ─────────────────────── 8. La courbe, sans cadre ────────────────────────── */

/**
 * Le compte en banque, vingt-quatre mois, posé à même le fond.
 *
 * La courbe se trace à l'arrivée plutôt que d'apparaître faite, et un repère
 * suit le curseur : le mois, le solde, et le fait d'être ou non sous zéro. Une
 * courbe qu'on ne peut pas interroger ne sert qu'à décorer.
 */
function cashCurve(r) {
  const vals = (r.cash?.balance || []).slice(0, 24).map(n)
  if (vals.length < 2) return null
  const max = Math.max(...vals, 0)
  const min = Math.min(...vals, 0)
  const span = max - min || 1
  const W = 1000, H = 190
  const x = (i) => (i / (vals.length - 1)) * W
  const y = (v) => H - ((v - min) / span) * H

  // Une courbe lissée : chaque segment reçoit deux points de contrôle posés à
  // mi-distance, ce qui suffit à retirer les angles sans inventer de relief.
  let d = `M ${x(0)} ${y(vals[0])}`
  for (let i = 1; i < vals.length; i++) {
    const x0 = x(i - 1), x1 = x(i), xm = (x0 + x1) / 2
    d += ` C ${xm} ${y(vals[i - 1])}, ${xm} ${y(vals[i])}, ${x1} ${y(vals[i])}`
  }
  const zero = y(0)

  const boite = h('div', {
    class: 'st-curve-box',
    html: `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
  <defs><linearGradient id="stfill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="rgba(14,15,12,.16)"/>
    <stop offset="100%" stop-color="rgba(14,15,12,0)"/>
  </linearGradient></defs>
  <line x1="0" y1="${zero}" x2="${W}" y2="${zero}" stroke="rgba(14,15,12,.22)" stroke-width="1" stroke-dasharray="3 5"/>
  <path class="st-curve-fill" d="${d} L ${W} ${H} L 0 ${H} Z" fill="url(#stfill)"/>
  <path class="st-curve-line" pathLength="1" d="${d}" fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  })

  // Le repère : une règle verticale et un point, déplacés en pixels plutôt
  // qu'en pourcentage, pour qu'ils tombent exactement sur le mois survolé.
  const regle = h('i', { class: 'st-curve-rule', 'aria-hidden': 'true' })
  const point = h('i', { class: 'st-curve-dot', 'aria-hidden': 'true' })
  let mois = 0
  const zone = h('div', { class: 'st-curve-hit' }, regle, point)
  zone.addEventListener('mousemove', (e) => {
    const b = zone.getBoundingClientRect()
    if (!b.width) return
    const part = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width))
    mois = Math.round(part * (vals.length - 1))
    const px = (mois / (vals.length - 1)) * b.width
    const py = (1 - (vals[mois] - min) / span) * b.height
    regle.style.transform = `translateX(${px}px)`
    point.style.transform = `translate(${px}px, ${py}px)`
    zone.classList.add('is-on')
  })
  zone.addEventListener('mouseleave', () => zone.classList.remove('is-on'))
  hot(zone, 'Trésorerie', () => [
    { label: monthLabel(mois, r.startDate), value: euro(vals[mois]), strong: true },
    { label: vals[mois] < 0 ? 'Découvert' : 'Solde positif', value: vals[mois] < 0 ? 'à financer' : 'sans apport' },
  ])

  return h('section', { class: 'st-curve' },
    h('div', { class: 'st-split-head' },
      h('h3', { class: 'st-col-title' }, 'Ton compte en banque, mois par mois'),
      h('span', { class: 'st-split-year' }, '24 mois'),
    ),
    h('div', { class: 'st-curve-wrap' }, boite, zone),
    h('div', { class: 'st-months' },
      ...[0, 5, 11, 17, 23].filter((m) => m < vals.length).map((m) =>
        h('span', {}, monthLabel(m, r.startDate))),
    ),
  )
}

/* ─────────────────────── 9. Les ratios qu'on te demandera ────────────────── */

/**
 * Huit ratios, en chasse fixe, sans commentaire superflu.
 *
 * Ce sont ceux qu'un banquier ou un investisseur calcule lui-même en trente
 * secondes s'ils ne sont pas donnés. Les donner, c'est montrer qu'on sait ce
 * qui sera regardé. Chacun porte sa lecture en une ligne — précise, pas
 * pédagogique : le lecteur de cet écran sait lire un taux de marge.
 */
function ratioRow(r, an) {
  const k = r.kpis
  const p = r.pnl
  const ca = n(p.revenue[an])
  const rien = '—'

  const lignes = [
    { nom: 'Marge brute', v: ca > 0 ? pct(n(k.marginRate[an])) : rien, dit: 'Ce qui reste après les achats' },
    { nom: 'Marge EBITDA', v: ca > 0 ? pct(n(k.ebitdaMargin[an])) : rien, dit: 'Ce que dégage l’exploitation' },
    { nom: 'Marge nette', v: ca > 0 ? pct(n(k.netMargin[an])) : rien, dit: 'Ce qui reste, tout payé' },
    { nom: 'Masse salariale', v: ca > 0 ? pct(n(k.payrollRatio[an])) : rien, dit: 'Part du CA versée en salaires' },
    { nom: 'Point mort', v: k.breakEven[an] ? euro(n(k.breakEven[an]), { compact: true }) : rien, dit: 'CA à atteindre cette année-là' },
    { nom: 'BFR au pic', v: euro(n(k.peakBfr), { compact: true }), dit: 'Le trou à financer en permanence' },
    {
      nom: 'Coût d’acquisition',
      v: k.cac ? euro(n(k.cac)) : rien,
      dit: k.cac ? 'Dépense marketing par client gagné' : 'Aucune campagne chiffrée',
    },
    {
      nom: 'LTV / CAC',
      v: k.ltvCacRatio ? `× ${num(n(k.ltvCacRatio), 1)}` : rien,
      dit: k.ltvCacRatio
        ? (n(k.ltvCacRatio) >= 3 ? 'Au-dessus du seuil de 3 attendu' : 'Sous le seuil de 3 attendu')
        : 'Demande une campagne et un panier',
    },
  ]

  return h('section', { class: 'st-ratios' },
    h('div', { class: 'st-split-head' },
      h('h3', { class: 'st-col-title' }, 'Les ratios qu’on te demandera'),
      h('span', { class: 'st-split-year' }, `Année ${an + 1}`),
    ),
    h('div', { class: 'st-ratio-grid' },
      ...lignes.map((l, i) => h('div', { class: 'st-ratio', style: { '--i': String(i) } },
        h('div', { class: 'st-ratio-nom' }, l.nom),
        h('div', { class: 'st-ratio-val' }, l.v),
        h('div', { class: 'st-ratio-dit' }, l.dit),
      )),
    ),
  )
}

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
 * Aucun calcul nouveau : les mêmes séries que la synthèse, présentées
 * autrement. C'est un essai de forme, et il doit pouvoir être jugé comme tel.
 */

import { h, euro, num, monthLabel } from '../dom.js'
import { checklist } from '../checklist.js'
import { goToGap } from '../spotlight.js'
import { suggestActions } from '../../engine/simulate.js'
import store from '../../state/store.js'

const n = (v) => Number(v) || 0

export function renderStudio(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  if (!r) return h('div', { class: 'content' }, h('p', {}, 'Aucun résultat.'))

  return h('div', { class: 'st' },
    heroRow(s, r, navigate),
    h('div', { class: 'st-cols' }, refineCol(s, navigate), leverCol(s, r)),
    splitBar(r),
    cashCurve(r),
  )
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

/* ─────────────────────── 2. Deux colonnes de travail ─────────────────────── */

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

/* ─────────────────────── 3. Où part l'argent encaissé ────────────────────── */

/**
 * Une barre empilée, pas un camembert.
 *
 * On compare mal des angles ; on compare très bien des longueurs posées sur la
 * même ligne. La légende passe en chasse fixe et porte le pourcentage, pour
 * qu'on puisse la lire sans revenir à la barre.
 */
function splitBar(r) {
  const i = Math.max(0, (r.pnl.netResult || []).findIndex((v) => v > 0))
  const p = r.pnl
  const rev = n(p.revenue[i])
  if (rev <= 0) return null

  const parts = [
    { nom: 'Achats', v: Math.abs(n(p.variableCost[i])) },
    { nom: 'Salaires', v: Math.abs(n(p.payroll[i])) },
    { nom: 'Charges fixes', v: Math.abs(n(p.external[i])) + Math.abs(n(p.duties[i])) },
    { nom: 'Amortissements', v: Math.abs(n(p.amortisation[i])) },
    { nom: 'Impôts', v: Math.abs(n(p.corporateTax[i])) },
  ].filter((x) => x.v > 0)
  const reste = rev - parts.reduce((a, x) => a + x.v, 0)
  const tout = [...parts, { nom: 'Ce qu’il reste', v: Math.max(0, reste), fin: true }]

  return h('section', { class: 'st-split' },
    h('div', { class: 'st-split-head' },
      h('h3', { class: 'st-col-title' }, 'Où part chaque euro encaissé'),
      h('span', { class: 'st-split-year' }, `Année ${i + 1}`),
    ),
    h('div', { class: 'st-bar', role: 'img', 'aria-label': 'Répartition du chiffre d’affaires' },
      ...tout.map((x) => h('i', {
        class: x.fin ? 'is-rest' : '',
        style: { width: `${(x.v / rev) * 100}%` },
        title: `${x.nom} — ${euro(x.v)}`,
      })),
    ),
    h('div', { class: 'st-legend' },
      ...tout.map((x) => h('span', { class: `st-leg ${x.fin ? 'is-rest' : ''}` },
        h('i', { 'aria-hidden': 'true' }),
        h('span', { class: 'st-leg-name' }, x.nom),
        h('span', { class: 'st-leg-pct' }, `${Math.round((x.v / rev) * 100)} %`),
      )),
    ),
  )
}

/* ─────────────────────── 4. La courbe, sans cadre ────────────────────────── */

/** Le compte en banque, vingt-quatre mois, posé à même le fond. */
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

  return h('section', { class: 'st-curve' },
    h('div', { class: 'st-split-head' },
      h('h3', { class: 'st-col-title' }, 'Ton compte en banque, mois par mois'),
      h('span', { class: 'st-split-year' }, '24 mois'),
    ),
    h('div', {
      class: 'st-curve-box',
      html: `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
  <defs><linearGradient id="stfill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="rgba(14,15,12,.16)"/>
    <stop offset="100%" stop-color="rgba(14,15,12,0)"/>
  </linearGradient></defs>
  <line x1="0" y1="${zero}" x2="${W}" y2="${zero}" stroke="rgba(14,15,12,.22)" stroke-width="1" stroke-dasharray="3 5"/>
  <path d="${d} L ${W} ${H} L 0 ${H} Z" fill="url(#stfill)"/>
  <path d="${d}" fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
    }),
    h('div', { class: 'st-months' },
      ...[0, 5, 11, 17, 23].filter((m) => m < vals.length).map((m) =>
        h('span', {}, monthLabel(m, r.startDate))),
    ),
  )
}

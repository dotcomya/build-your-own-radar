/**
 * Le récit du pitch, en analyse stratégique.
 *
 * Un fondateur ne va pas voir un banquier, un business angel, un fonds, ses
 * associés ou son équipe avec une liste de chiffres. Il y va avec une lecture :
 * ce qui marche, ce qui bloque, pourquoi, et ce qu'il fait. Cette page la lui
 * donne, en cinq chapitres qui ont chacun un objectif :
 *
 *   01  le modèle      — prouver que chaque vente gagne de l'argent ;
 *   02  les coûts      — savoir ce qui pèse, et quand la trésorerie remonte ;
 *   03  le financement — arriver au rendez-vous avec le bon montant ;
 *   04  l'équipe et toi — montrer que l'équipe tient et que tu en vis ;
 *   05  les risques    — nommer ce qui peut mal tourner avant qu'on le fasse.
 *
 * Chaque chapitre porte deux cartes : un diagnostic — sa gravité, son ratio,
 * une phrase qui le dit, la décomposition qui le montre, le geste qui le
 * corrige — et une courbe qui le situe dans le temps, avec le chiffre qu'un
 * lecteur extérieur retiendra. Puis la phrase à dire à chacun : au banquier,
 * à l'investisseur, à l'équipe.
 *
 * Tout vient du moteur. Rien n'est écrit à la main : si un chiffre change,
 * le diagnostic change avec lui.
 */

import { h, svg, euro, pct, num, monthLabel } from '../dom.js'
import { barChart, hot } from '../charts.js'
import { goToGap } from '../spotlight.js'
import { compute } from '../../engine/engine.js'
import { founderIncome } from '../../engine/founder.js'
import { lignesBanquier } from '../banquier.js'
import { SECTORS } from '../../state/schema.js'
import { referenceYear, periodeAnnee, periodeMois } from '../../format.js'

const n = (v) => Number(v) || 0
const somme = (xs) => (xs || []).reduce((a, x) => a + n(x?.amount ?? x), 0)
const parAn = (m, y) => (m || []).slice(y * 12, y * 12 + 12).reduce((a, v) => a + n(v), 0)
const eur = (v) => euro(v, { compact: Math.abs(v) >= 100000 })
const kEur = (v) => `${num(v / 1000, Math.abs(v) < 10000 ? 1 : 0)}\u00a0k€`
const M = (m) => `M${m + 1}`
const RE_LOYER = new RegExp('loyer|local|bail|bureau|boutique|cabinet|salle|murs', 'i')

const GRAVITE = {
  bad: { mot: 'Critique', cls: 'is-bad' },
  watch: { mot: 'Tendu', cls: 'is-watch' },
  good: { mot: 'Sain', cls: 'is-good' },
  none: { mot: 'À chiffrer', cls: 'is-none' },
}

/* ─────────────────────────────── Le moteur ─────────────────────────────── */

/**
 * Le cumul des flux d'exploitation, mois par mois : la courbe en J.
 *
 * On retire de la trésorerie tout ce qui vient du financement — apports,
 * prêts, levées — pour ne garder que ce que l'activité consomme puis rend.
 * Son point bas est ce que le projet coûte vraiment avant de se payer.
 */
export function courbeEnJ(r) {
  const R = r.cash.rows
  const out = []
  let cum = 0
  for (let m = 0; m < r.cash.balance.length; m++) {
    const entre = n(R.sales[m]) + n(R.vatCollected[m]) + n(R.vatRefunded[m]) + n(R.credits[m]) + n(R.grants[m])
    const sort = n(R.purchases[m]) + n(R.opex[m]) + n(R.payroll[m]) + n(R.vatDeductible[m]) + n(R.vatPaid[m]) + n(R.duties[m]) +
      n(R.capex[m]) + n(R.lease[m]) + n(R.corporateTax[m]) + n(R.stockChange[m]) + n(R.draws?.[m])
    cum += entre - sort
    out.push(cum)
  }
  let bas = 0
  out.forEach((v, m) => { if (v < out[bas]) bas = m })
  const remonte = out[bas] < 0 ? out.findIndex((v, m) => m > bas && v >= 0) : -1
  return { serie: out, bas, valeurBas: out[bas], remonte: remonte >= 0 ? remonte : null }
}

/** Les coûts fixes du premier trimestre de ventes. */
function structureDemarrage(s, r) {
  const ca = r.revenue.monthly
  const debut = Math.max(0, ca.findIndex((v) => n(v) > 0))
  const mois = [debut, debut + 1, debut + 2].filter((m) => m < ca.length)
  const idsLoyer = new Set((s.opex || []).filter((o) => o.enabled !== false && RE_LOYER.test(o.label || '')).map((o) => o.id))
  let caQ = 0, salaires = 0, loyer = 0, autres = 0
  for (const m of mois) {
    caQ += n(ca[m])
    salaires += n(r.payroll.cost[m]) + n(r.payroll.draws?.[m])
    for (const it of r.opex.perItem || []) {
      const v = n(it.series?.[m])
      if (idsLoyer.has(it.id)) loyer += v
      else autres += v
    }
    autres += n(r.capex.leaseMonthly?.[m])
  }
  const fixes = salaires + loyer + autres
  const k = mois.length || 1
  return {
    periode: `${M(mois[0] ?? 0)}-${M(mois[mois.length - 1] ?? 2)}`,
    mois: `${monthLabel(mois[0] ?? 0, r.startDate)} – ${monthLabel(mois[mois.length - 1] ?? 2, r.startDate)}`,
    ca: caQ, fixes, ratio: caQ > 0 ? fixes / caQ : null,
    postes: [
      { nom: 'Loyer', v: loyer / k },
      { nom: n(r.payroll.draws?.[0]) > 0 ? 'Salaires, prélèvements et cotisations' : 'Masse salariale', v: salaires / k },
      { nom: 'Frais généraux', v: autres / k },
    ],
  }
}

/**
 * Le plan face à quatre imprévus, rejoué entièrement par le moteur.
 *
 * Des ventes plus faibles, des prix plus bas, des charges plus lourdes, un
 * lancement qui glisse : on recalcule tout — paie, TVA, impôt, trésorerie —
 * et on lit ce que chacun coûte au point bas et au résultat.
 */
// Retenu pour le résultat qui l'a produit : chaque recalcul en fabrique un
// neuf, donc le stress test ne peut pas survivre au plan qu'il décrit. La
// date de modification, qui servait de clé, ne changeait pas entre deux
// saisies de la même milliseconde.
const memoire = { r: null, val: null }
function stressTest(s, r) {
  if (memoire.r === r) return memoire.val
  const base = r.kpis.cashLow?.value ?? 0
  const y = referenceYear(r)
  const rejouer = (nom, mut) => {
    const c = JSON.parse(JSON.stringify(s))
    mut(c)
    let x
    try { x = compute(c) } catch { return null }
    return { nom, bas: n(x.kpis.cashLow?.value), mois: x.kpis.cashLow?.month ?? 0, dBas: n(x.kpis.cashLow?.value) - n(base), dNet: n(x.pnl.netResult[y]) - n(r.pnl.netResult[y]) }
  }
  const volumes = (a, f) => {
    if (!a.volumes) return
    a.volumes.startUnits = n(a.volumes.startUnits) * f
    if (Array.isArray(a.volumes.manual)) a.volumes.manual = a.volumes.manual.map((v) => n(v) * f)
    if (a.volumes.cap !== '' && a.volumes.cap !== null && a.volumes.cap !== undefined) a.volumes.cap = n(a.volumes.cap) * f
  }
  const val = [
    rejouer('Ventes −20 %', (c) => (c.activities || []).forEach((a) => volumes(a, 0.8))),
    rejouer('Prix −10 %', (c) => (c.activities || []).forEach((a) => { a.unitPrice = n(a.unitPrice) * 0.9; a.recurringPrice = n(a.recurringPrice) * 0.9 })),
    rejouer('Charges fixes +20 %', (c) => (c.opex || []).forEach((o) => { if (o.mode === 'fixed' || !o.mode) o.monthlyAmount = n(o.monthlyAmount) * 1.2 })),
    rejouer('Lancement décalé de 3 mois', (c) => (c.activities || []).forEach((a) => {
      if (!a.volumes) return
      if (a.volumes.mode === 'manual' && Array.isArray(a.volumes.manual)) a.volumes.manual = [0, 0, 0, ...a.volumes.manual].slice(0, 60)
      else a.volumes.launchMonth = n(a.volumes.launchMonth) + 3
    })),
  ].filter(Boolean)
  memoire.r = r
  memoire.val = val
  return val
}

/* ─────────────────────────────── Les dessins ─────────────────────────────── */

/**
 * Des barres horizontales, chacune avec sa part : le poste qui pèse, en rouge.
 *
 * Chaque barre se consulte au survol : la période qu'elle couvre, son
 * intitulé, son montant exact — et ce qu'il précise, quand il y a lieu.
 * `periode` vaut pour toutes les barres ; un poste peut porter la sienne.
 */
function barres(postes, { total = null, alerte = null, format = (v) => euro(v), part = true, periode = '', exact = (v) => euro(v), detail = null } = {}) {
  const t = total ?? postes.reduce((a, x) => a + Math.max(0, n(x.v)), 0)
  const max = Math.max(1, ...postes.map((x) => Math.abs(n(x.v))))
  return h('div', { class: 'as-barres' },
    ...postes.filter((x) => x && Number.isFinite(n(x.v))).map((x, i) => {
      const w = Math.min(100, (Math.abs(n(x.v)) / (part && t > 0 ? t : max)) * 100)
      return hot(h('div', { class: `as-barre ${alerte === i || x.alerte ? 'is-alerte' : ''} ${n(x.v) < 0 ? 'is-neg' : ''}`, style: { '--i': String(i) } },
        h('div', { class: 'as-barre-tete' },
          h('span', { class: 'as-barre-nom' }, x.nom),
          h('span', { class: 'as-barre-val' }, format(x.v), part && t > 0 ? ` (${pct(Math.max(0, n(x.v)) / t, 0)})` : ''),
        ),
        h('div', { class: 'as-barre-piste' }, h('i', { style: { width: `${Math.max(1.5, w)}%` } })),
      ), x.periode || periode, () => [
        { label: x.nom, value: exact(n(x.v)), strong: true },
        part && t > 0 && n(x.v) > 0 ? { label: 'Part du total', value: pct(n(x.v) / t, 1) } : null,
        ...(detail ? detail(x) : []),
      ])
    }))
}

/** La courbe en J, avec son aire, son point bas et son retour à zéro ; chaque mois se consulte au survol. */
function dessinJ(J, fenetre, debut) {
  const v = J.serie.slice(0, fenetre)
  const W = 560, H = 200, pad = { l: 44, r: 14, t: 16, b: 26 }
  const hi = Math.max(0, ...v), lo = Math.min(0, ...v)
  const span = hi - lo || 1
  const x = (i) => pad.l + (i / Math.max(1, v.length - 1)) * (W - pad.l - pad.r)
  const y = (val) => pad.t + (1 - (val - lo) / span) * (H - pad.t - pad.b)
  const pts = v.map((val, i) => `${x(i).toFixed(1)},${y(val).toFixed(1)}`)
  const trait = `M${pts.join(' L')}`
  const aire = `M${x(0).toFixed(1)},${y(0).toFixed(1)} L${pts.join(' L')} L${x(v.length - 1).toFixed(1)},${y(0).toFixed(1)} Z`
  const pas = fenetre <= 12 ? 3 : fenetre <= 24 ? 6 : 12
  const ticks = [0, ...Array.from({ length: Math.floor((fenetre - 1) / pas) }, (_, i) => (i + 1) * pas - 1)].filter((m) => m < v.length)
  const bas = J.bas < v.length ? J.bas : null
  const remonte = J.remonte !== null && J.remonte < v.length ? J.remonte : null
  const repere = svg('circle', { cx: x(0), cy: y(v[0] || 0), r: 4.5, class: 'as-j-repere' })
  const bande = (W - pad.l - pad.r) / Math.max(1, v.length - 1)
  const zones = v.map((val, i) => hot(
    svg('rect', { x: x(i) - bande / 2, y: 0, width: bande, height: H, fill: 'transparent', class: 'chart-hot' }),
    periodeMois(i, debut),
    () => [
      { label: 'Cumul des flux d’exploitation', value: euro(val), strong: true },
      i > 0 ? { label: 'Flux du mois', value: euro(val - v[i - 1], { sign: true }) } : null,
      i === bas && val < 0 ? { label: 'Le point bas : ce que coûte le démarrage', value: '' } : null,
      i === remonte ? { label: 'Le cumul redevient positif', value: '' } : null,
    ],
    () => { repere.setAttribute('cx', x(i).toFixed(1)); repere.setAttribute('cy', y(val).toFixed(1)); repere.classList.add('is-on') },
    () => repere.classList.remove('is-on'),
  ))
  return svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'as-j', role: 'img', 'aria-label': 'Cumul des flux d’exploitation, mois par mois' },
    svg('line', { x1: pad.l, x2: W - pad.r, y1: y(0), y2: y(0), class: 'as-j-zero' }),
    svg('text', { x: pad.l - 6, y: y(hi) + 4, class: 'as-j-y', 'text-anchor': 'end' }, kEur(hi)),
    svg('text', { x: pad.l - 6, y: y(0) + 4, class: 'as-j-y', 'text-anchor': 'end' }, '0'),
    lo < 0 ? svg('text', { x: pad.l - 6, y: y(lo) + 4, class: 'as-j-y', 'text-anchor': 'end' }, kEur(lo)) : null,
    svg('path', { d: aire, class: 'as-j-aire' }),
    svg('path', { d: trait, class: 'as-j-trait' }),
    ...ticks.map((m) => svg('text', { x: x(m), y: H - 6, class: 'as-j-x', 'text-anchor': 'middle' }, M(m))),
    bas !== null && v[bas] < 0 ? svg('g', { class: 'as-j-bas' },
      svg('circle', { cx: x(bas), cy: y(v[bas]), r: 5 }),
      svg('text', { x: x(bas) + (bas > v.length * 0.7 ? -10 : 10), y: y(v[bas]) - 10, 'text-anchor': bas > v.length * 0.7 ? 'end' : 'start' }, `Point bas ${M(bas)} · ${kEur(v[bas])}`)) : null,
    remonte !== null ? svg('g', { class: 'as-j-haut' },
      svg('circle', { cx: x(remonte), cy: y(v[remonte]), r: 5 }),
      svg('text', { x: x(remonte) + (remonte > v.length * 0.7 ? -10 : 10), y: y(v[remonte]) - 10, 'text-anchor': remonte > v.length * 0.7 ? 'end' : 'start' }, `Positif ${M(remonte)}`)) : null,
    repere,
    ...zones,
  )
}

/* ─────────────────────────────── Les pièces ─────────────────────────────── */

function carteDiagnostic({ domaine, gravite, ratio, titre, texte, postes, conseil, lien, navigate, extra = null }) {
  const g = GRAVITE[gravite] || GRAVITE.none
  return h('article', { class: `as-carte as-diag ${g.cls}` },
    h('div', { class: 'as-tag-ligne' },
      h('span', { class: `as-tag ${g.cls}` }, `${domaine} // ${g.mot}`),
      ratio ? h('span', { class: 'as-ratio' }, ratio) : null,
    ),
    h('h4', { class: 'as-carte-titre' }, titre),
    h('p', { class: 'as-texte' }, ...texte),
    postes || null,
    extra,
    h('footer', { class: 'as-pied' },
      conseil ? h('span', { class: 'as-conseil' }, h('b', {}, 'Conseil : '), conseil) : null,
      lien ? h('button', { class: 'as-lien', type: 'button', onClick: (e) => goToGap(lien.go, navigate, e.currentTarget) }, `${lien.label} →`) : null,
    ),
  )
}

function carteCourbe({ domaine, periode, titre, texte, dessin, pied }) {
  return h('article', { class: 'as-carte as-courbe' },
    h('div', { class: 'as-tag-ligne' },
      h('span', { class: 'as-tag' }, domaine),
      periode ? h('span', { class: 'as-ratio' }, periode) : null,
    ),
    h('h4', { class: 'as-carte-titre' }, titre),
    texte ? h('p', { class: 'as-texte' }, ...texte) : null,
    h('div', { class: 'as-dessin' }, dessin),
    h('footer', { class: 'as-pied is-chiffres' },
      ...pied.map((x) => h('span', { class: 'as-kpi' },
        h('span', {}, x.l, ' : '),
        h('b', { class: x.ton ? `is-${x.ton}` : '' }, x.v))),
    ),
  )
}

/** Ce qu'il faut dire, à qui. */
function direA(dits, question) {
  return h('div', { class: 'as-dire' },
    h('div', { class: 'as-dire-tete' },
      h('span', { class: 'as-dire-titre' }, 'Le dire à'),
      question ? h('span', { class: 'as-question' }, 'On te demandera : ', h('em', {}, `« ${question} »`)) : null,
    ),
    h('div', { class: 'as-dire-cases' },
      ...dits.filter((d) => d && d.t).map((d) => h('div', { class: 'as-dire-case' },
        h('span', { class: 'as-dire-qui' }, d.qui),
        h('p', {}, d.t),
      ))),
  )
}

function chapitre({ no, titre, objectif, bloquants, diag, courbe, dits, question }) {
  return h('section', { class: 'as-chap', 'data-chapitre': String(no) },
    h('header', { class: 'as-chap-tete' },
      h('span', { class: 'as-no' }, String(no).padStart(2, '0')),
      h('h3', { class: 'as-titre' }, titre),
      h('span', { class: `as-meta ${bloquants ? 'is-bad' : 'is-good'}` },
        h('i', { 'aria-hidden': 'true' }),
        bloquants === 0 ? 'Aucun facteur bloquant' : `${bloquants} facteur${bloquants > 1 ? 's' : ''} bloquant${bloquants > 1 ? 's' : ''} détecté${bloquants > 1 ? 's' : ''} par le moteur`),
      h('p', { class: 'as-objectif' }, h('b', {}, 'Objectif · '), objectif),
    ),
    h('div', { class: 'as-cartes' }, diag, courbe),
    direA(dits, question),
  )
}

/* ─────────────────────────────── Les chapitres ─────────────────────────────── */

export function analyseStrategique(s, r, navigate, { avis = {}, source = null } = {}) {
  const p = r.pnl, k = r.kpis
  const bm = SECTORS[s.meta?.sectorKey]?.benchmarks || {}
  const y = referenceYear(r)
  const y3 = 2
  const ca3 = n(p.revenue[y3])
  const bank = lignesBanquier(r)
  const J = courbeEnJ(r)
  const manque = n(k.fundingNeed)
  const bas = k.cashLow || {}
  const premier = k.firstProfitableYear
  const aPremier = premier !== null && premier !== undefined
  const f = s.financing || {}
  const va = (label, go) => ({ label, go })

  /* 01 — Le modèle économique ─────────────────────────────────────────── */
  const marge = n(k.marginRate?.[y3])
  const margeOk = ca3 > 0 && Math.abs(marge) <= 10
  const sur100 = ca3 > 0 ? {
    achats: Math.abs(n(p.variableCost[y3])) / ca3,
    salaires: Math.abs(n(p.payroll[y3])) / ca3,
    frais: (Math.abs(n(p.external[y3])) + Math.abs(n(p.duties[y3]))) / ca3,
    reste: n(p.netResult[y3]) / ca3,
  } : null
  const sousRepere = margeOk && bm.grossMargin && marge < bm.grossMargin[0]
  const g1 = !margeOk ? 'none' : marge <= 0 ? 'bad' : sousRepere ? 'watch' : 'good'
  const a1 = n(p.revenue[0]), a5 = n(p.revenue[4])
  const cagr = a1 > 0 && a5 > 0 && a5 / a1 <= 1000 ? Math.pow(a5 / a1, 1 / 4) - 1 : null
  const moisPM = (k.breakEvenMonth || []).findIndex((m) => m)
  const b1 = [marge <= 0 && margeOk, sousRepere, moisPM < 0, k.ltvCacRatio !== null && k.ltvCacRatio < 3].filter(Boolean).length
  const phare = (s.activities || []).find((a) => n(a.unitPrice) > 0 || n(a.recurringPrice) > 0)

  const modele = chapitre({
    no: 1, titre: 'Le modèle économique', objectif: 'prouver que chaque vente gagne de l’argent, et dire à partir de quand tout est payé.',
    bloquants: b1,
    diag: carteDiagnostic({
      domaine: 'Marge brute', gravite: g1, navigate,
      ratio: margeOk ? `Marge brute : ${pct(marge, 0)} (A3)` : null,
      titre: !margeOk ? 'Ton modèle n’est pas encore chiffré'
        : marge <= 0 ? 'Chaque vente coûte plus qu’elle ne rapporte'
          : sousRepere ? `Ta marge est sous celle de ton métier`
            : `Chaque vente laisse ${Math.round(marge * 100)} € sur 100 €`,
      texte: sur100
        ? [`Sur 100 € vendus en année 3, `, h('b', {}, `${Math.round(sur100.achats * 100)} € partent en achats`),
          `, ${Math.round(sur100.salaires * 100)} € en salaires, ${Math.round(sur100.frais * 100)} € en frais de structure. `,
          sur100.reste >= 0 ? `Il en reste ${Math.round(sur100.reste * 100)} € de bénéfice.` : `Il en manque ${Math.round(-sur100.reste * 100)} € : tu vends à perte.`,
          bm.grossMargin ? ` Ton métier garde ${pct(bm.grossMargin[0], 0)} à ${pct(bm.grossMargin[1], 0)} de marge brute. ` : ' ',
          bm.grossMargin && source ? source() : null]
        : ['Fixe un prix et un volume de ventes : le modèle se lira ici.'],
      postes: sur100 ? barres([
        { nom: 'Achats liés aux ventes', v: sur100.achats * 100, alerte: sousRepere },
        { nom: 'Salaires et cotisations', v: sur100.salaires * 100 },
        { nom: 'Frais de structure', v: sur100.frais * 100 },
        { nom: sur100.reste >= 0 ? 'Bénéfice' : 'Perte', v: sur100.reste * 100 },
      ], { total: 100, format: (v) => `${num(v, 0)}\u00a0€`, part: false, periode: `Sur 100 € vendus · ${periodeAnnee(2, r.startDate)}`,
        exact: (v) => `${num(v, 2)}\u00a0€`, detail: (x) => [{ label: 'En euros sur l’année', value: euro((x.v / 100) * ca3) }] }) : null,
      conseil: sousRepere ? `chaque point de marge vaut ${eur(0.01 * ca3)} par an : revois ton prix ou tes achats.`
        : marge > 0 ? 'protège ta marge avant de chercher du volume : c’est elle qui paie tout le reste.' : 'commence par le prix de ton produit phare.',
      lien: va(sousRepere || marge <= 0 ? 'Ajuster ton prix' : 'Voir tes offres', { route: 'offre', view: 'offres', sec: 'offre', openAll: true, anchor: 'prix' }),
    }),
    courbe: carteCourbe({
      domaine: 'Trajectoire du chiffre d’affaires', periode: 'Années 1 à 5',
      titre: cagr !== null ? `De ${eur(a1)} à ${eur(a5)} en cinq ans` : 'Cinq ans de chiffre d’affaires',
      texte: [aPremier ? `Premier bénéfice en année ${premier + 1}` : 'Pas de bénéfice sur cinq ans',
        moisPM >= 0 ? ` ; les ventes couvrent tous les frais dès l’année ${moisPM + 1}.` : ' : les ventes ne couvrent jamais tous les frais.'],
      dessin: barChart({
        series: [{ label: 'Chiffre d’affaires', values: p.revenue.map(n), color: '#0E0F0C' }],
        line: { label: 'Résultat net', values: p.netResult.map(n), color: '#1B7F4B' },
        categories: ['A1', 'A2', 'A3', 'A4', 'A5'], height: 200, largeur: 560,
        periodes: [0, 1, 2, 3, 4].map((i) => periodeAnnee(i, r.startDate)),
      }),
      pied: [
        { l: 'Point mort', v: moisPM >= 0 ? `Année ${moisPM + 1}` : 'Non atteint', ton: moisPM >= 0 && moisPM <= 1 ? 'good' : 'bad' },
        { l: 'Croissance', v: cagr !== null ? `${cagr >= 0 ? '+' : '−'}${pct(Math.abs(cagr), 0)} / an` : '—' },
      ],
    }),
    question: avis.modele?.question,
    dits: [
      { qui: 'Banquier', t: margeOk && marge > 0 ? `Sur 100 € vendus, il m’en reste ${Math.round(marge * 100)} une fois les achats payés ; mes ventes couvrent tous mes frais ${moisPM >= 0 ? `dès l’année ${moisPM + 1}` : 'plus tard que le plan'}.` : 'Je revois mon prix : aujourd’hui mes ventes ne couvrent pas ce qu’elles coûtent.' },
      { qui: 'Investisseur', t: cagr !== null ? `${eur(a1)} la première année, ${eur(a5)} la cinquième : ${cagr >= 0 ? '+' : '−'}${pct(Math.abs(cagr), 0)} par an, avec ${margeOk ? pct(marge, 0) : 'une'} de marge brute.` : null },
      { qui: 'Équipe', t: phare ? `Notre produit phare, « ${phare.name} », finance tout le reste : c’est lui qu’on soigne en premier.` : null },
    ],
  })

  /* 02 — Les coûts ─────────────────────────────────────────────────────── */
  const st = structureDemarrage(s, r)
  const dom = st.postes.reduce((m, x, i) => (x.v > st.postes[m].v ? i : m), 0)
  const g2 = st.ratio === null ? 'none' : st.ratio >= 1 ? 'bad' : st.ratio >= 0.7 ? 'watch' : 'good'
  const fenetre = Math.min(60, Math.max(12, Math.ceil(((J.remonte ?? J.bas) + 1) / 12) * 12))
  const solv = Math.min(...r.cash.balance.slice(0, 12)) >= 0
  const couv = bank.find((l) => l.cle === 'couverture')
  const couvV = couv && couv.etat !== 'na' ? (couv.croisiere ?? couv.ratio) : null
  const b2 = [st.ratio !== null && st.ratio >= 1, manque > 0, J.valeurBas < 0 && J.remonte === null].filter(Boolean).length
  const posteNom = st.postes[dom].nom.toLowerCase()
  const salarie = (s.team || []).filter((m) => m.enabled !== false && !['tns', 'dirigeant', 'micro'].includes(m.contractType))
    .sort((a, b) => n(b.monthlyGross) - n(a.monthlyGross))[0]

  const couts = chapitre({
    no: 2, titre: 'Analyse stratégique et structurelle des coûts', objectif: 'savoir ce qui pèse au démarrage, et quand ta trésorerie remonte.',
    bloquants: b2,
    diag: carteDiagnostic({
      domaine: 'Charges fixes', gravite: g2, navigate,
      ratio: st.ratio !== null ? `Ratio charges fixes / CA : ${pct(st.ratio, 0)} (${st.periode})` : null,
      titre: st.ratio === null ? 'Pas encore de ventes pour porter tes charges'
        : st.ratio >= 1 ? (dom === 1 ? 'Poids excessif de la masse salariale fixe avant la montée en charge du chiffre d’affaires'
          : dom === 0 ? 'Le loyer pèse plus que ce que l’activité encaisse au démarrage'
            : 'Les frais généraux s’accumulent avant les ventes')
          : st.ratio >= 0.7 ? `Tes charges fixes absorbent l’essentiel des premières ventes`
            : 'Tes premières ventes couvrent tes charges fixes',
      texte: st.ratio !== null
        ? ['Pour chaque 100 € encaissés durant le premier trimestre de ventes, ', h('b', {}, `${Math.round(st.ratio * 100)} € de frais de structure fixes`),
          ` sortent. Le premier poste est ${posteNom} : ${euro(st.postes[dom].v)} par mois.`]
        : [`Tes charges fixes coûtent ${euro(st.fixes / 3)} par mois avant la première vente.`],
      postes: barres(st.postes.map((x, i) => ({ ...x, alerte: i === dom && g2 !== 'good' })), { format: (v) => `${euro(v)}/mois`,
        periode: `Moyenne mensuelle · ${st.periode} (${st.mois})`, exact: (v) => `${euro(v)} par mois`,
        detail: (x) => [{ label: 'Sur les trois mois', value: euro(x.v * 3) }] }),
      conseil: dom === 0 ? 'négocie trois mois de franchise de loyer avec le bailleur.'
        : dom === 1 && salarie ? `décaler l’arrivée de « ${salarie.role} » de trois mois soulage le démarrage.`
          : 'passe tes abonnements et honoraires en revue : 100 € par mois font 1 200 € par an.',
      lien: dom === 1 ? va('Ajuster l’équipe', { route: 'equipe', view: 'postes', anchor: 'equipe' }) : va('Ajuster tes charges', { route: 'achats', view: 'charges', anchor: 'charges' }),
    }),
    courbe: carteCourbe({
      domaine: 'Trésorerie en courbe J', periode: `Période M1-M${fenetre} (k€)`,
      titre: J.valeurBas >= 0 ? 'Ton activité se finance dès le départ'
        : J.remonte !== null ? 'Trajectoire de cash : résorption progressive du déficit' : 'Le creux n’est pas refermé sur cinq ans',
      texte: J.valeurBas >= 0
        ? ['Sans aucun apport, le cumul de ce que l’activité encaisse et dépense ne passe jamais sous zéro.']
        : [`Hors financement, l’activité consomme jusqu’à `, h('b', {}, euro(-J.valeurBas)), ` : point bas en ${M(J.bas)} (${monthLabel(J.bas, r.startDate)}). `,
          J.remonte !== null ? `Le cumul redevient positif en ${M(J.remonte)} : l’activité a remboursé ce qu’elle a coûté.` : 'Il ne redevient pas positif sur cinq ans.'],
      dessin: dessinJ(J, fenetre, r.startDate),
      pied: [
        { l: 'Couverture banquier', v: couvV !== null ? `${num(couvV, 2)}×` : 'Sans emprunt', ton: couvV === null ? '' : couvV >= 1.3 ? 'good' : couvV >= 1 ? 'watch' : 'bad' },
        { l: 'Solvabilité A1', v: solv ? 'Valide' : 'À revoir', ton: solv ? 'good' : 'bad' },
      ],
    }),
    question: avis.tresorerie?.question,
    dits: [
      { qui: 'Banquier', t: J.valeurBas < 0 ? `Le démarrage consomme ${eur(-J.valeurBas)} jusqu’en ${M(J.bas)}${J.remonte !== null ? ` ; l’activité l’a remboursé en ${M(J.remonte)}` : ''}. ${manque > 0 ? `Il me manque ${eur(manque)} pour passer ce creux.` : 'Mon financement couvre ce creux.'}` : 'Mon activité se finance dès les premiers mois : je ne demande pas d’argent pour le démarrage.' },
      { qui: 'Investisseur', t: J.valeurBas < 0 ? `Chaque euro levé finance le creux de ${eur(-J.valeurBas)} : au-delà, il accélère.` : 'La croissance peut s’accélérer sans brûler de cash : l’argent levé ira à la conquête.' },
      { qui: 'Équipe', t: st.ratio !== null && st.ratio >= 0.7 ? `Les premiers mois sont serrés : chaque dépense compte jusqu’en ${M(J.remonte ?? J.bas)}.` : 'Nos charges sont tenues : on peut investir dans ce qui fait vendre.' },
    ],
  })

  /* 03 — Le financement ───────────────────────────────────────────────── */
  const sources = [
    { nom: 'Apport des fondateurs', v: n(f.openingCash) + somme(f.equityFounders) },
    { nom: 'Prêts d’honneur', v: somme(f.honourLoans) },
    { nom: 'Emprunts bancaires', v: somme(f.loans) },
    { nom: 'Levée de fonds', v: somme(f.equityInvestors) },
    { nom: 'Subventions et avances', v: somme(f.grants) + somme(f.advances) },
    { nom: 'Comptes courants', v: somme(f.shareholderLoans) },
  ].filter((x) => x.v > 0)
  const reuni = sources.reduce((a, x) => a + x.v, 0)
  const apport = bank.find((l) => l.cle === 'apport')
  const comptees = bank.filter((l) => l.etat !== 'na')
  const valides = comptees.filter((l) => l.etat === 'ok').length
  const aRevoir = comptees.filter((l) => l.etat === 'revoir')
  const g3 = manque > 0 ? 'bad' : aRevoir.length ? 'watch' : reuni > 0 ? 'good' : 'none'
  const faire = (aRevoir[0] || comptees.find((l) => l.etat === 'juste'))?.faire

  const financement = chapitre({
    no: 3, titre: 'Le financement', objectif: 'arriver au rendez-vous avec le bon montant, et les ratios qu’on te demandera.',
    bloquants: aRevoir.length + (manque > 0 && !aRevoir.some((l) => l.cle === 'tresorerie') ? 1 : 0),
    diag: carteDiagnostic({
      domaine: 'Financement', gravite: g3, navigate,
      ratio: apport && apport.etat !== 'na' ? `Apport : ${pct(apport.part, 0)} du projet` : reuni > 0 ? `${eur(reuni)} réunis` : null,
      titre: manque > 0 ? `Il manque ${eur(manque)} au point bas` : reuni > 0 ? 'Ton plan est financé jusqu’au bout' : 'Rien n’est encore réuni',
      texte: reuni > 0
        ? ['Ton projet mobilise ', h('b', {}, eur(reuni)), sources.length ? ` : ${sources.map((x) => `${x.nom.toLowerCase()} ${eur(x.v)}`).join(', ')}. ` : '. ',
          manque > 0 ? `Au plus bas, en ${monthLabel(bas.month, r.startDate)}, il manque encore ${eur(manque)}.` : `Au plus bas, ton compte garde ${eur(n(bas.value))}.`]
        : [manque > 0 ? `Sans financement, ton compte descend à ${euro(-manque)} en ${monthLabel(bas.month, r.startDate)}.` : 'Ton activité se finance seule.'],
      postes: sources.length ? barres(sources, { format: (v) => eur(v), periode: `Réuni sur le plan · ${monthLabel(0, r.startDate)} – ${monthLabel(59, r.startDate)}` }) : null,
      conseil: faire || (manque > 0 ? `demande ${eur(Math.ceil((manque * 1.2) / 1000) * 1000)} plutôt que ${eur(manque)} : une marge pour l’imprévu.` : 'garde trois mois de charges en réserve.'),
      lien: va('Ajuster ton financement', { route: 'financement', view: 'sources', anchor: 'sources' }),
    }),
    courbe: carteCourbe({
      domaine: 'Ce que ton banquier va vérifier', periode: 'Échéancier réel',
      titre: aRevoir.length ? `${aRevoir.length} point${aRevoir.length > 1 ? 's' : ''} à revoir avant le rendez-vous` : 'Ton dossier passe la grille du banquier',
      texte: null,
      dessin: h('ul', { class: 'as-bk' }, ...bank.map((l) => h('li', { class: `as-bk-ligne is-${l.etat}` },
        h('span', { class: 'as-bk-etat' }, l.etat === 'ok' ? 'Validé' : l.etat === 'juste' ? 'Juste' : l.etat === 'revoir' ? 'À revoir' : '—'),
        h('span', { class: 'as-bk-titre' }, l.titre),
        h('b', { class: 'as-bk-val' }, l.valeur),
      ))),
      pied: [
        { l: 'Dossier bancaire', v: `${valides}/${comptees.length} validés`, ton: aRevoir.length ? 'bad' : 'good' },
        { l: 'Couverture', v: couvV !== null ? `${num(couvV, 2)}×` : 'Sans emprunt' },
      ],
    }),
    question: avis.besoin?.question,
    dits: [
      { qui: 'Banquier', t: apport && apport.etat !== 'na' ? `J’apporte ${pct(apport.part, 0)} du projet ; ma capacité d’autofinancement couvre ${couvV !== null ? `${num(couvV, 1)} fois` : 'mes'} échéances.` : manque > 0 ? `Je cherche ${eur(manque)} pour passer le point bas de ${monthLabel(bas.month, r.startDate)}.` : null },
      { qui: 'Investisseur', t: manque > 0 ? `Je lève ${eur(manque)} : de quoi tenir jusqu’au point mort${moisPM >= 0 ? `, en année ${moisPM + 1}` : ''}.` : 'Je n’ai pas besoin de lever pour tenir : un investisseur accélérerait, il ne sauverait pas.' },
      { qui: 'Associés', t: `Nous avons réuni ${eur(reuni)}${manque > 0 ? ` et il manque ${eur(manque)}` : ', suffisants pour tout le plan'}.` },
    ],
  })

  /* 04 — L'équipe et toi ──────────────────────────────────────────────── */
  const team = (s.team || []).filter((m) => m.enabled !== false)
  const ratioMasse = ca3 > 0 ? Math.abs(n(p.payroll[y3])) / ca3 : null
  const lourd = ratioMasse !== null && bm.payrollRatio && ratioMasse > bm.payrollRatio[1] * 1.3
  const moi = team.find((m) => new RegExp('fondateur|dirigeant|gérant|moi|président', 'i').test(m.role || ''))
  const nonPaye = !moi || n(moi.monthlyGross) <= 0
  let inc = null
  try { inc = founderIncome(s, r) } catch { inc = null }
  const g4 = nonPaye ? 'watch' : lourd ? 'watch' : team.length ? 'good' : 'none'
  const b4 = [nonPaye, lourd].filter(Boolean).length
  const postesEquipe = (r.payroll.byMember || []).map((b) => {
    const m = team.find((x) => x.id === b.id)
    return m ? { nom: `${m.role || 'Poste'}${n(m.count) > 1 ? ` ×${m.count}` : ''}`, v: parAn(b.series, 1) + (m === moi ? parAn(r.payroll.draws, 1) : 0) } : null
  }).filter((x) => x && x.v > 0).sort((a, b) => b.v - a.v).slice(0, 5)
  const dispo = inc ? inc.rows.map((x) => n(x.disposable)) : [0, 0, 0, 0, 0]

  const equipe = chapitre({
    no: 4, titre: 'L’équipe et toi', objectif: 'montrer que l’équipe tient, et que tu vis de ton entreprise.',
    bloquants: b4,
    diag: carteDiagnostic({
      domaine: 'Équipe', gravite: g4, navigate,
      ratio: ratioMasse !== null && ratioMasse <= 10 ? `Masse salariale / CA : ${pct(ratioMasse, 0)} (A3)` : null,
      titre: nonPaye ? 'Tu ne te verses rien : c’est la première chose qu’on verra'
        : team.length <= 1 ? 'Tu portes le projet seul' : lourd ? 'La masse salariale pèse plus que dans ton métier' : `${team.length} postes pour porter le plan`,
      texte: [ratioMasse !== null && ratioMasse <= 10
        ? h('span', {}, 'Les salaires représentent ', h('b', {}, `${pct(ratioMasse, 0)} du chiffre d’affaires en année 3`), bm.payrollRatio ? `, pour ${pct(bm.payrollRatio[0], 0)} à ${pct(bm.payrollRatio[1], 0)} dans ton métier. ` : '. ')
        : 'Pas encore de ventes pour situer ta masse salariale. ',
      bm.payrollRatio && source ? source() : null],
      postes: postesEquipe.length ? barres(postesEquipe.map((x, i) => ({ ...x, alerte: lourd && i === 0 })), { format: (v) => `${eur(v)}/an`,
        periode: `Coût chargé · ${periodeAnnee(1, r.startDate)}`, exact: (v) => `${euro(v)} par an`,
        detail: (x) => [{ label: 'Par mois', value: euro(x.v / 12) }] }) : null,
      conseil: nonPaye ? 'un plan où le fondateur ne vit pas n’est pas prudent, il est incomplet.'
        : lourd ? 'échelonne les embauches sur les paliers de chiffre d’affaires.'
          : team.length <= 1 ? 'dis qui te remplace deux semaines : c’est la question qu’on te posera.' : 'montre qui vend et qui livre.',
      lien: va(nonPaye ? 'Fixer ta rémunération' : 'Voir l’équipe', { route: 'equipe', view: 'postes', anchor: 'equipe' }),
    }),
    courbe: carteCourbe({
      domaine: 'Ce que tu gagnes, toi', periode: 'Net de tout, par an',
      titre: dispo[1] > 0 ? `${euro(dispo[1] / 12)} par mois pour toi en année 2` : 'Rien ne remonte encore jusqu’à toi',
      texte: [inc?.micro ? 'Net de cotisations et d’impôt sur le revenu' : 'Net de cotisations, d’impôt sur les sociétés et d’impôt sur le revenu', dispo.some((v, i) => inc?.rows[i]?.honourRepayment > 0) ? ', prêt d’honneur remboursé.' : '.'],
      dessin: barres(dispo.map((v, i) => ({ nom: 'Ce qui te reste, net de tout', v, periode: periodeAnnee(i, r.startDate), an: i })), { format: (v) => `${eur(v)}`, part: false,
        detail: (x) => [{ label: 'Par mois', value: euro(x.v / 12) }] }),
      pied: [
        { l: 'Revenu net A2', v: `${euro(dispo[1] / 12)}/mois`, ton: dispo[1] > 0 ? 'good' : 'bad' },
        inc?.rows?.[1]?.costPerEuro ? { l: 'Coût d’un euro net', v: `${num(inc.rows[1].costPerEuro, 2)} €` } : { l: 'Postes', v: String(team.length) },
      ],
    }),
    question: avis.equipe?.question,
    dits: [
      { qui: 'Banquier', t: nonPaye ? 'Je me verserai un salaire dès que les ventes le permettront — et le plan le montre.' : `Je me verse ${euro(n(moi?.monthlyGross))} brut par mois : le plan le finance.` },
      { qui: 'Investisseur', t: team.length > 1 ? `${team.length} postes, ${eur(Math.abs(n(p.payroll[0])))} la première année : chaque embauche suit un palier de ventes.` : 'Je porte le projet seul au départ ; les premières embauches suivent les premières ventes.' },
      { qui: 'Équipe', t: team.length > 1 ? `Nous serons ${team.reduce((a, m) => a + (n(m.count) || 1), 0)} ; chaque arrivée est financée dans le plan.` : null },
    ],
  })

  /* 05 — Les risques ──────────────────────────────────────────────────── */
  const pm = n(k.breakEven?.[y]), caY = n(p.revenue[y])
  const securite = caY > 0 && pm > 0 ? (caY - pm) / caY : null
  const stress = stressTest(s, r)
  const pire = stress.reduce((m, x) => (m === null || x.bas < m.bas ? x : m), null)
  const parts = (r.revenue?.perActivity || []).map((x, i) => ({ nom: s.activities?.[i]?.name || `Offre ${i + 1}`, v: parAn(x.total, y) }))
    .filter((x) => x.v > 0).sort((a, b) => b.v - a.v)
  const totalParts = parts.reduce((a, x) => a + x.v, 0)
  const concentre = parts.length && totalParts > 0 && parts[0].v / totalParts > 0.7
  const pieges = (SECTORS[s.meta?.sectorKey]?.traps || []).slice(0, 2)
  const g5 = securite === null ? 'none' : securite < 0 ? 'bad' : securite < 0.2 ? 'watch' : 'good'
  const b5 = [securite !== null && securite < 0.1, concentre, pire && pire.bas < 0 && n(bas.value) >= 0].filter(Boolean).length

  const risques = chapitre({
    no: 5, titre: 'Les risques', objectif: 'nommer ce qui peut mal tourner avant qu’on te le demande, et dire ce que tu ferais.',
    bloquants: b5,
    diag: carteDiagnostic({
      domaine: 'Risques', gravite: g5, navigate,
      ratio: securite !== null ? `Marge de sécurité : ${pct(securite, 0)} (A${y + 1})` : null,
      titre: securite === null ? 'Pas encore de point mort à défendre'
        : securite < 0 ? 'Ton plan ne couvre pas encore ses frais'
          : securite < 0.2 ? 'Ton plan tient, mais sans beaucoup de marge' : 'Ton plan encaisse un coup dur',
      texte: securite !== null
        ? [securite >= 0 ? 'Tes ventes peuvent baisser de ' : 'Il te manque ', h('b', {}, pct(Math.abs(securite), 0)), securite >= 0 ? ` avant que tu ne perdes de l’argent en année ${y + 1}. ` : ` de ventes pour couvrir tes frais en année ${y + 1}. `,
          concentre ? `« ${parts[0].nom} » fait ${pct(parts[0].v / totalParts, 0)} de tes ventes : c’est ton premier risque.` : '']
        : ['Fixe tes prix et tes volumes : le moteur mesurera ta marge de sécurité.'],
      postes: parts.length > 1 ? barres(parts.slice(0, 4).map((x, i) => ({ ...x, alerte: concentre && i === 0 })), { format: (v) => eur(v), periode: `Chiffre d’affaires · ${periodeAnnee(y, r.startDate)}` }) : null,
      extra: pieges.length ? h('ul', { class: 'as-pieges' }, ...pieges.map((t) => h('li', {}, h('b', {}, t.title), ' — ', t.body.split('. ')[0], '.'))) : null,
      conseil: concentre ? 'une deuxième offre, même petite, rassure plus qu’une croissance plus forte.' : 'prépare ta réponse au pire cas ci-contre : c’est elle qu’on attend.',
      lien: va('Voir tes offres', { route: 'offre', view: 'offres' }),
    }),
    courbe: carteCourbe({
      domaine: 'Stress test', periode: 'Rejoué par le moteur',
      titre: pire ? `Le pire cas : ${pire.nom.toLowerCase()}` : 'Ce que coûte un imprévu',
      texte: pire ? ['Point bas de trésorerie : ', h('b', {}, euro(pire.bas)), ` au lieu de ${euro(n(bas.value))}.`] : null,
      dessin: barres(stress.map((x) => ({ nom: x.nom, v: x.dBas, alerte: x === pire, periode: `Point bas · ${periodeMois(x.mois, r.startDate)}`, bas: x.bas })), {
        format: (v) => `${v >= 0 ? '+' : ''}${eur(v)} au point bas`, part: false, exact: (v) => `${euro(v, { sign: true })} au point bas`,
        detail: (x) => [{ label: 'Point bas de trésorerie', value: euro(x.bas) }, { label: 'Dans ton plan', value: euro(n(bas.value)) }] }),
      pied: [
        { l: 'Pire point bas', v: pire ? eur(pire.bas) : '—', ton: pire && pire.bas < 0 ? 'bad' : 'good' },
        { l: 'Tient sans nouvel apport', v: pire && pire.bas >= 0 ? 'Oui' : 'Non', ton: pire && pire.bas >= 0 ? 'good' : 'bad' },
      ],
    }),
    question: avis.risques?.question,
    dits: [
      { qui: 'Banquier', t: pire ? `Même avec ${pire.nom.toLowerCase()}, ${pire.bas >= 0 ? 'ma trésorerie reste positive' : `il manquerait ${eur(-pire.bas)} : je prévois cette marge dans ma demande`}.` : null },
      { qui: 'Investisseur', t: securite !== null && securite >= 0 ? `Mes ventes peuvent baisser de ${pct(securite, 0)} avant que je perde de l’argent.` : 'Je sais ce qui manque pour couvrir mes frais, et comment l’atteindre.' },
      { qui: 'Équipe', t: pieges[0] ? `Le piège de notre métier : ${pieges[0].title.toLowerCase()}. On le surveille ensemble.` : null },
    ],
  })

  return h('div', { class: 'as' }, modele, couts, financement, equipe, risques)
}

/**
 * Le récit du pitch : le projet expliqué, dans l'ordre où on le demande.
 *
 * On commence par ce que tout le monde veut savoir, puis on explique
 * progressivement pourquoi. Neuf chapitres, chacun répond à une question
 * nouvelle, sans répéter le précédent :
 *
 *   01  Chiffre d'affaires       — combien l'activité facture, et comment ça évolue ;
 *   02  Résultat et rentabilité  — ce qu'il reste une fois tout payé ;
 *   03  Répartition des ventes   — d'où vient le chiffre d'affaires : prix × volume ;
 *   04  Économie d'une vente     — ce que laisse une vente, et combien il en faut ;
 *   05  Masse salariale          — ce que coûte l'équipe, fondateur à part ;
 *   06  Structure des coûts      — les autres dépenses, les plus lourdes d'abord ;
 *   07  Trésorerie               — être rentable n'est pas avoir de l'argent en caisse ;
 *   08  Besoin de financement    — ce que le business consomme, ce qu'il faut réunir ;
 *   09  Principales hypothèses   — ce qui fait le plus bouger le scénario.
 *
 * Chaque chapitre : une conclusion, deux à quatre chiffres, un dessin quand
 * il aide, une phrase qui l'interprète, puis « Voir le détail », replié. La
 * première lecture tient en deux ou trois minutes.
 *
 * Les phrases sont courtes, une idée chacune, sans personnage : le même texte
 * doit servir à un fondateur, un directeur d'incubateur, un expert-comptable
 * et un investisseur. Les termes financiers restent — marge brute, EBE,
 * point mort, BFR — et chacun est expliqué la première fois qu'il paraît.
 *
 * Tout vient du moteur : si un chiffre change, la phrase change avec lui.
 */

import { h, svg, euro, pct, num, monthLabel } from '../dom.js'
import { barChart, hot } from '../charts.js'
import { goToGap } from '../spotlight.js'
import { compute, coutDUneVente } from '../../engine/engine.js'
import { CONTRACT_TYPES } from '../../engine/payroll.js'
import { lignesBanquier } from '../banquier.js'
import { SECTORS } from '../../state/schema.js'
import { uniteOffre, vocabulaireDuPlan } from '../../state/sectors.js'
import { periodeAnnee, periodeMois } from '../../format.js'

const n = (v) => Number(v) || 0
const ANS = [0, 1, 2, 3, 4]
const somme = (xs) => (xs || []).reduce((a, x) => a + n(x?.amount ?? x), 0)
const parAn = (m, y) => (m || []).slice(y * 12, y * 12 + 12).reduce((a, v) => a + n(v), 0)
const eur = (v) => euro(v, { compact: Math.abs(v) >= 100000 })
const kEur = (v) => (Math.abs(v) >= 1e6 ? `${num(v / 1e6, 1)} M€` : `${num(v / 1000, Math.abs(v) < 10000 ? 1 : 0)} k€`)
/** Un prix unitaire : au centime sous 100 €, quand il en a. */
export const prixTxt = (v) => (Math.abs(v) < 100 && Math.round(v * 100) % 100 !== 0 ? `${num(v, 2)} €` : euro(v))
const signe = (v) => `${v >= 0 ? '+' : '−'}${pct(Math.abs(v), 0)}`
/** Un taux lisible : ni un chiffre d'affaires nul, ni un rapport absurde. */
const taux = (a, b) => (n(b) > 0 && Math.abs(n(a) / n(b)) <= 10 ? n(a) / n(b) : null)
const RE_FONDATEUR = new RegExp('fondat|dirigeant|gérant|président|associé', 'i')

/* ─────────────────────────────── Les pièces ─────────────────────────────── */

/** Un chiffre de premier niveau : l'intitulé, la valeur, une note courte — souvent la définition. */
function chiffre(c) {
  if (!c) return null
  return h('div', { class: 'as-chiffre' },
    h('span', { class: 'as-chiffre-l' }, c.l),
    h('b', { class: `as-chiffre-v ${c.ton ? `is-${c.ton}` : ''}` }, c.v),
    c.note ? h('small', { class: 'as-chiffre-n' }, c.note) : null,
  )
}

/** Des morceaux de phrase — texte et liens de source — séparés d'une espace. */
function phrases(xs) {
  const out = []
  for (const x of (xs || []).filter(Boolean)) {
    if (out.length) out.push(' ')
    out.push(x)
  }
  return out
}

/** « Voir le détail » : replié, il garde la première lecture courte. */
function detail(contenu, lien, navigate) {
  const corps = (contenu || []).filter(Boolean)
  if (!corps.length && !lien) return null
  return h('details', { class: 'as-detail' },
    h('summary', {}, 'Voir le détail'),
    h('div', { class: 'as-detail-corps' },
      ...corps,
      lien ? h('button', { class: 'as-lien', type: 'button', onClick: (e) => goToGap(lien.go, navigate, e.currentTarget) }, `${lien.label} →`) : null,
    ),
  )
}

/** Un tableau de détail : une ligne d'en-têtes, puis les lignes. */
export function tableau(tetes, lignes) {
  return h('div', { class: 'as-table-wrap' },
    h('table', { class: 'data as-table' },
      h('thead', {}, h('tr', {}, ...tetes.map((t) => h('th', {}, t)))),
      h('tbody', {}, ...lignes.filter(Boolean).map((l) => h('tr', { class: l.cls || '' }, ...(l.cells || l).map((c) => h('td', {}, c)))))))
}
const tetesAns = (premier) => [premier, 'Année 1', 'Année 2', 'Année 3', 'Année 4', 'Année 5']

function chapitre({ no, titre, sousTitre, rupture = null, conclusion, repere = null, chiffres = [], dessin = null, clair = [], plus = null }) {
  return h('section', { class: 'as-chap', 'data-chapitre': String(no), id: `as-chap-${no}` },
    rupture ? h('p', { class: 'as-rupture' }, rupture) : null,
    h('header', { class: 'as-chap-tete' },
      h('span', { class: 'as-no' }, String(no).padStart(2, '0')),
      h('h3', { class: 'as-titre' }, titre),
      h('p', { class: 'as-sous-titre' }, sousTitre),
    ),
    h('p', { class: 'as-conclusion' }, conclusion),
    chiffres.filter(Boolean).length ? h('div', { class: 'as-chiffres-bloc' },
      repere ? h('span', { class: 'as-repere' }, repere) : null,
      h('div', { class: 'as-chiffres' }, ...chiffres.filter(Boolean).slice(0, 4).map(chiffre)),
    ) : null,
    dessin ? h('div', { class: 'as-dessin' }, dessin) : null,
    clair.filter(Boolean).length ? h('p', { class: 'as-clair' }, ...phrases(clair)) : null,
    plus,
  )
}

/* ─────────────────────────────── Les dessins ─────────────────────────────── */

/**
 * Des barres horizontales, chacune avec sa part ; une barre peut porter une
 * ligne de calcul (« 830 ventes × 549 € »). Chaque barre se consulte au
 * survol : la période, l'intitulé, le montant exact, et ce qu'il précise.
 */
export function barres(postes, { total = null, format = (v) => euro(v), part = true, periode = '', exact = (v) => euro(v), detail: plus = null } = {}) {
  const t = total ?? postes.reduce((a, x) => a + Math.max(0, n(x.v)), 0)
  const max = Math.max(1, ...postes.map((x) => Math.abs(n(x.v))))
  return h('div', { class: 'as-barres' },
    ...postes.filter((x) => x && Number.isFinite(n(x.v))).map((x, i) => {
      const w = Math.min(100, (Math.abs(n(x.v)) / (part && t > 0 ? t : max)) * 100)
      return hot(h('div', { class: `as-barre ${x.alerte ? 'is-alerte' : ''} ${n(x.v) < 0 ? 'is-neg' : ''}`, style: { '--i': String(i) } },
        h('div', { class: 'as-barre-tete' },
          h('span', { class: 'as-barre-nom' }, x.nom),
          h('span', { class: 'as-barre-val' }, format(x.v), part && t > 0 ? ` (${pct(Math.max(0, n(x.v)) / t, 0)})` : ''),
        ),
        x.sous ? h('span', { class: 'as-barre-sous' }, x.sous) : null,
        h('div', { class: 'as-barre-piste' }, h('i', { style: { width: `${Math.max(1.5, w)}%` } })),
      ), x.periode || periode, () => [
        { label: x.nom, value: exact(n(x.v)), strong: true },
        part && t > 0 && n(x.v) > 0 ? { label: 'Part du total', value: pct(n(x.v) / t, 1) } : null,
        ...(plus ? plus(x) : []),
      ])
    }))
}

/**
 * Une cascade : d'un montant de départ, chaque étape retire ou ajoute, et la
 * dernière ligne est ce qu'il reste. « Je facture X, l'entreprise dépense Y,
 * il reste Z », poste par poste. Chaque ligne se consulte au survol.
 */
export function cascade(etapes, periode) {
  let cum = 0
  const lignes = []
  for (const e of etapes.filter(Boolean)) {
    if (e.type === 'depart') { cum = n(e.v); lignes.push({ ...e, v: cum, de: 0, a: cum }) } else if (e.type === 'total' || e.type === 'sous') lignes.push({ ...e, v: cum, de: 0, a: cum })
    else { const de = cum; cum += n(e.v); lignes.push({ ...e, de, a: cum }) }
  }
  const bornes = lignes.flatMap((x) => [x.de, x.a])
  const lo = Math.min(0, ...bornes), hi = Math.max(0, ...bornes)
  const span = hi - lo || 1
  const pos = (v) => ((v - lo) / span) * 100
  return h('div', { class: 'as-cascade', role: 'list' },
    ...lignes.map((x, i) => {
      const nature = x.ton ? `is-${x.ton}` : x.type === 'depart' || x.type === 'total' ? 'is-total' : x.type === 'sous' ? 'is-sous' : x.v < 0 ? 'is-moins' : 'is-plus'
      const valeur = x.type ? euro(x.v, { compact: Math.abs(x.v) >= 100000 }) : `${x.v < 0 ? '−' : '+'} ${eur(Math.abs(x.v))}`
      return hot(h('div', { class: `as-cascade-l ${nature}`, role: 'listitem', style: { '--i': String(i) } },
        h('span', { class: 'as-cascade-nom' }, x.l),
        h('span', { class: 'as-cascade-piste' },
          lo < 0 ? h('b', { class: 'as-cascade-zero', style: { left: `${pos(0)}%` } }) : null,
          h('i', { style: { left: `${pos(Math.min(x.de, x.a))}%`, width: `${Math.max(0.8, Math.abs(pos(x.a) - pos(x.de)))}%` } })),
        h('span', { class: 'as-cascade-val' }, valeur),
      ), periode, () => [
        { label: x.l, value: euro(x.v, { sign: !x.type }), strong: true },
        !x.type ? { label: 'Il reste ensuite', value: euro(x.a) } : null,
        x.def ? { label: x.def, value: '' } : null,
      ])
    }))
}

/**
 * La trésorerie mois par mois : le trait, la ligne du zéro, ce qui passe
 * dessous en rouge, le point bas nommé. Chaque mois se consulte au survol.
 * Elle répond à une seule question : est-ce que je passe sous zéro, quand,
 * et de combien ?
 */
let courbes = 0
export function courbeTreso(v, debut, { bas, sousZero, remonte }) {
  const id = `as-clip-${++courbes}`
  const W = 640, H = 220, pad = { l: 50, r: 14, t: 22, b: 28 }
  const hi = Math.max(0, ...v), lo = Math.min(0, ...v)
  const span = hi - lo || 1
  const x = (i) => pad.l + (i / Math.max(1, v.length - 1)) * (W - pad.l - pad.r)
  const y = (val) => pad.t + (1 - (val - lo) / span) * (H - pad.t - pad.b)
  const pts = v.map((val, i) => `${x(i).toFixed(1)},${y(val).toFixed(1)}`)
  const aire = `M${x(0).toFixed(1)},${y(0).toFixed(1)} L${pts.join(' L')} L${x(v.length - 1).toFixed(1)},${y(0).toFixed(1)} Z`
  const repere = svg('circle', { cx: x(0), cy: y(v[0] || 0), r: 4.5, class: 'as-j-repere' })
  const bande = (W - pad.l - pad.r) / Math.max(1, v.length - 1)
  const cote = (i) => (i > v.length * 0.62 ? 'end' : 'start')
  const decale = (i) => (i > v.length * 0.62 ? -10 : 10)
  const pas = v.length <= 24 ? 4 : v.length <= 36 ? 6 : 12
  const ticks = Array.from({ length: Math.ceil(v.length / pas) }, (_, i) => i * pas)
  // Le zéro n'a pas d'étiquette s'il touche celle du haut ou du bas.
  const zeroLisible = Math.abs(y(0) - y(hi)) > 14 && Math.abs(y(0) - y(lo)) > 14
  const dans = (i) => i !== null && i !== undefined && i >= 0 && i < v.length
  return svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'as-j', role: 'img', 'aria-label': `Trésorerie en fin de mois, sur ${v.length} mois` },
    svg('defs', {},
      svg('clipPath', { id: `${id}-haut` }, svg('rect', { x: 0, y: 0, width: W, height: y(0) })),
      svg('clipPath', { id: `${id}-bas` }, svg('rect', { x: 0, y: y(0), width: W, height: H - y(0) }))),
    svg('line', { x1: pad.l, x2: W - pad.r, y1: y(0), y2: y(0), class: 'as-j-zero' }),
    hi > 0 ? svg('text', { x: pad.l - 6, y: y(hi) + 4, class: 'as-j-y', 'text-anchor': 'end' }, kEur(hi)) : null,
    zeroLisible || hi === 0 || lo === 0 ? svg('text', { x: pad.l - 6, y: y(0) + 4, class: 'as-j-y', 'text-anchor': 'end' }, '0') : null,
    lo < 0 ? svg('text', { x: pad.l - 6, y: y(lo) + 4, class: 'as-j-y', 'text-anchor': 'end' }, kEur(lo)) : null,
    svg('path', { d: aire, class: 'as-j-aire', 'clip-path': `url(#${id}-haut)` }),
    svg('path', { d: aire, class: 'as-j-neg', 'clip-path': `url(#${id}-bas)` }),
    svg('path', { d: `M${pts.join(' L')}`, class: 'as-j-trait' }),
    ...ticks.map((m) => svg('text', { x: x(m), y: H - 6, class: 'as-j-x', 'text-anchor': m === 0 ? 'start' : 'middle' }, monthLabel(m, debut))),
    dans(sousZero) && sousZero !== bas ? svg('g', { class: 'as-j-bas' },
      svg('circle', { cx: x(sousZero), cy: y(v[sousZero]), r: 4 }),
      svg('text', { x: x(sousZero) + decale(sousZero), y: y(v[sousZero]) - 10, 'text-anchor': cote(sousZero) }, `Sous zéro · ${monthLabel(sousZero, debut)}`)) : null,
    dans(bas) ? svg('g', { class: v[bas] < 0 ? 'as-j-bas' : 'as-j-haut' },
      svg('circle', { cx: x(bas), cy: y(v[bas]), r: 5 }),
      svg('text', { x: x(bas) + decale(bas), y: y(v[bas]) + (v[bas] < 0 ? 4 : -10), 'text-anchor': cote(bas) }, `Point bas · ${monthLabel(bas, debut)} · ${kEur(v[bas])}`)) : null,
    dans(remonte) ? svg('g', { class: 'as-j-haut' },
      svg('circle', { cx: x(remonte), cy: y(v[remonte]), r: 4 }),
      svg('text', { x: x(remonte) + decale(remonte), y: y(v[remonte]) - 10, 'text-anchor': cote(remonte) }, `De nouveau positive · ${monthLabel(remonte, debut)}`)) : null,
    repere,
    ...v.map((val, i) => hot(
      svg('rect', { x: x(i) - bande / 2, y: 0, width: bande, height: H, fill: 'transparent', class: 'chart-hot' }),
      periodeMois(i, debut),
      () => [
        { label: 'Trésorerie en fin de mois', value: euro(val), strong: true },
        i > 0 ? { label: 'Variation du mois', value: euro(val - v[i - 1], { sign: true }) } : null,
        i === bas ? { label: 'Le point bas du plan', value: '' } : null,
        i === sousZero ? { label: 'Premier mois sous zéro', value: '' } : null,
      ],
      () => { repere.setAttribute('cx', x(i).toFixed(1)); repere.setAttribute('cy', y(val).toFixed(1)); repere.classList.add('is-on') },
      () => repere.classList.remove('is-on'),
    )),
  )
}

/** Prix − coût direct = marge : les trois blocs, et la barre qui les partage. */
export function equation({ prix, cout, marge, par, lignes, periode }) {
  const partCout = prix > 0 ? Math.max(0, Math.min(1, cout / prix)) : 0
  const bloc = (cls, l, v, rows) => hot(h('div', { class: `as-eq-bloc ${cls}` }, h('span', {}, l), h('b', {}, prixTxt(v)), h('small', {}, par)), periode, rows)
  return h('div', { class: 'as-equation' },
    bloc('is-prix', 'Prix de vente', prix, () => [{ label: 'Prix de vente, hors taxes', value: prixTxt(prix), strong: true }]),
    h('span', { class: 'as-eq-op', 'aria-hidden': 'true' }, '−'),
    bloc('is-cout', 'Coût direct', cout, () => [{ label: 'Coût direct', value: prixTxt(cout), strong: true }, ...lignes.map((x) => ({ label: x.l, value: prixTxt(x.v) }))]),
    h('span', { class: 'as-eq-op', 'aria-hidden': 'true' }, '='),
    bloc('is-marge', 'Marge par vente', marge, () => [{ label: 'Marge par vente', value: prixTxt(marge), strong: true }, prix > 0 ? { label: 'Part du prix', value: pct(marge / prix, 1) } : null]),
    h('div', { class: 'as-eq-barre', 'aria-hidden': 'true' },
      h('i', { class: 'is-cout', style: { width: `${partCout * 100}%` } }),
      h('i', { class: 'is-marge', style: { width: `${(1 - partCout) * 100}%` } })),
  )
}

/* ─────────────────────────────── Les calculs ─────────────────────────────── */

/**
 * Les offres, avec leur prix et leur volume : ce qui fait le chiffre
 * d'affaires. Un abonnement se compte en mensualités facturées — c'est ce
 * que multiplie son prix ; une vente ponctuelle, en unités vendues.
 */
export function lesOffres(s, r) {
  const acts = s.activities || []
  return (r.revenue?.perActivity || []).map((x, i) => {
    const a = acts.find((z) => z.id === x.id) || acts[i] || {}
    const rec = ANS.map((y) => parAn(x.recurring, y))
    const ponct = ANS.map((y) => parAn(x.oneOff, y))
    const ca = ANS.map((y) => parAn(x.total, y))
    const modeRec = rec.reduce((t, v) => t + v, 0) >= ponct.reduce((t, v) => t + v, 0) && rec.some((v) => v > 0)
    const volume = ANS.map((y) => (modeRec ? parAn(x.contracts, y) : parAn(x.volumes, y)))
    const prixMoyen = ANS.map((y) => (volume[y] > 0 ? (modeRec ? rec[y] : ponct[y]) / volume[y] : 0))
    return {
      a, nom: a.name || `Offre ${i + 1}`, u: uniteOffre(s, a), modeRec, ca, volume, prixMoyen,
      abonnesFin: ANS.map((y) => n(x.contracts?.[y * 12 + 11])), ventes: ANS.map((y) => parAn(x.volumes, y)),
    }
  }).filter((o) => o.ca.some((v) => v > 0))
}

/** « 1 215 mensualités × 49 € » ou « 830 ventes × 549 € ». */
export function formule(o, y) {
  const vol = num(o.volume[y], 0)
  return o.modeRec ? `${vol} mensualités × ${prixTxt(o.prixMoyen[y])} = ${eur(o.ca[y])}` : `${vol} ${o.u.many} × ${prixTxt(o.prixMoyen[y])} = ${eur(o.ca[y])}`
}

/**
 * Ce que l'activité consomme, mois par mois, et ce que chaque ressource a
 * apporté : la trésorerie = ressources − consommation, au mois près.
 *
 * Au mois du point bas, le reste à financer est exactement le besoin que
 * calcule le moteur : besoin total − trésorerie de départ − apports −
 * dettes − subventions − levée.
 */
export function consommation(s, r) {
  const R = r.cash.rows, F = r.financing || {}
  const bal = r.cash.balance.map(n)
  const cum = { activite: 0, depart: n(F.openingCash ?? s.financing?.openingCash), fondateurs: 0, dette: 0, subventions: 0, levee: 0 }
  const serie = []
  for (let m = 0; m < bal.length; m++) {
    cum.activite += n(R.sales[m]) + n(R.vatCollected[m]) + n(R.vatRefunded[m]) + n(R.credits[m])
      - n(R.purchases[m]) - n(R.opex[m]) - n(R.payroll[m]) - n(R.vatDeductible[m]) - n(R.vatPaid[m]) - n(R.duties[m])
      - n(R.capex[m]) - n(R.lease[m]) - n(R.corporateTax[m]) - n(R.stockChange[m]) - n(R.draws?.[m])
    cum.fondateurs += n(F.equity?.[m]) + n(F.honour?.[m])
    cum.levee += n(F.investors?.[m])
    cum.dette += n(F.loanDrawdown?.[m]) + n(F.shareholderLoans?.[m]) - n(F.repayment?.[m]) - n(F.interest?.[m])
    cum.subventions += n(F.grants?.[m]) + n(F.advances?.[m]) - n(F.advanceRepayment?.[m])
    serie.push({ ...cum })
  }
  let m = 0
  bal.forEach((v, i) => { if (v < bal[m]) m = i })
  const x = serie[m] || cum
  const besoin = -x.activite
  const ressources = x.depart + x.fondateurs + x.dette + x.subventions + x.levee
  return { mois: m, besoin, ressources, reste: besoin - ressources, parts: x, activiteAn: ANS.map((y) => (serie[y * 12 + 11]?.activite ?? 0) - (y ? serie[y * 12 - 1]?.activite ?? 0 : 0)) }
}

/**
 * Les hypothèses qui font bouger le scénario, rejouées par le moteur.
 *
 * Chacune est modifiée seule, tout le reste égal : on recalcule paie, TVA,
 * impôt et trésorerie, et on lit ce qu'elle change au besoin de financement
 * et au résultat net de l'année 3.
 */
// Retenu pour le résultat qui l'a produit : chaque recalcul en fabrique un
// neuf, donc le test ne survit pas au plan qu'il décrit.
const memoire = { r: null, val: null }
export function sensibilites(s, r, top) {
  if (memoire.r === r) return memoire.val
  const besoin0 = n(r.kpis.fundingNeed), net0 = n(r.pnl.netResult[2])
  const acts = s.activities || []
  const f = s.financing || {}
  const volumes = (a, k) => {
    if (!a.volumes) return
    a.volumes.startUnits = n(a.volumes.startUnits) * k
    if (Array.isArray(a.volumes.manual)) a.volumes.manual = a.volumes.manual.map((v) => n(v) * k)
    if (a.volumes.cap !== '' && a.volumes.cap !== null && a.volumes.cap !== undefined) a.volumes.cap = n(a.volumes.cap) * k
  }
  const enCroissance = acts.filter((a) => a.volumes?.mode !== 'manual' && n(a.volumes?.monthlyGrowth) > 0)
  const campagnes = (s.marketing || []).filter((c) => c.enabled !== false && n(c.monthlyBudget) > 0)
  const delai = Math.round(n(top?.a?.paymentLag) * 30)
  const cout = top ? coutDUneVente(s, top.a) : null
  const masse = n(r.pnl.payroll[0])
  const liste = [
    top && { cle: 'volumes', nom: 'Volumes de vente', dit: '20 % de volume en moins', test: '−20 %',
      plan: top.modeRec ? `${num(top.abonnesFin[0], 0)} abonnés fin d’année 1` : `${num(top.volume[0], 0)} ${top.u.many} en année 1`,
      mut: (c) => (c.activities || []).forEach((a) => volumes(a, 0.8)) },
    enCroissance.length && { cle: 'croissance', nom: 'Croissance mensuelle', dit: 'une croissance 20 % plus lente', test: '−20 %',
      plan: `${pct(n(enCroissance[0].volumes.monthlyGrowth), 1)} par mois`,
      mut: (c) => (c.activities || []).forEach((a) => { if (a.volumes && a.volumes.mode !== 'manual') a.volumes.monthlyGrowth = n(a.volumes.monthlyGrowth) * 0.8 }) },
    top && { cle: 'prix', nom: 'Prix de vente', dit: 'des prix 10 % plus bas', test: '−10 %',
      plan: top.modeRec ? `${prixTxt(top.prixMoyen[0])} par mois` : `${prixTxt(top.prixMoyen[0])} par ${top.u.one}`,
      mut: (c) => (c.activities || []).forEach((a) => {
        a.unitPrice = n(a.unitPrice) * 0.9; a.recurringPrice = n(a.recurringPrice) * 0.9
        if (Array.isArray(a.priceByYear)) a.priceByYear = a.priceByYear.map((v) => (v === '' || v === null ? v : n(v) * 0.9))
        if (Array.isArray(a.recurringPriceByYear)) a.recurringPriceByYear = a.recurringPriceByYear.map((v) => (v === '' || v === null ? v : n(v) * 0.9))
      }) },
    cout && cout.total > 0 && { cle: 'marge', nom: 'Coût direct par vente', dit: 'un coût direct 20 % plus élevé', test: '+20 %',
      plan: `${prixTxt(cout.total)} par vente`,
      mut: (c) => {
        (c.activities || []).forEach((a) => { a.unitCost = n(a.unitCost) * 1.2; a.recurringCost = n(a.recurringCost) * 1.2 })
        ;(c.opex || []).forEach((o) => { if (o.mode === 'perUnit') o.perUnit = n(o.perUnit) * 1.2; if (o.mode === 'pctRevenue') o.pctRevenue = n(o.pctRevenue) * 1.2 })
      } },
    campagnes.length && r.kpis.cac && { cle: 'cac', nom: 'Coût d’acquisition d’un client', dit: 'un coût d’acquisition 20 % plus élevé', test: '+20 %',
      plan: `${euro(r.kpis.cac)} par client`,
      mut: (c) => (c.marketing || []).forEach((m) => {
        for (const k of ['cpc', 'cpm', 'cpl', 'cac']) if (n(m[k]) > 0) m[k] = n(m[k]) * 1.2
        if (n(m.clientsPerMonth) > 0) m.clientsPerMonth = n(m.clientsPerMonth) / 1.2
      }) },
    masse > 0 && { cle: 'salaires', nom: 'Salaires', dit: 'des salaires 10 % plus élevés', test: '+10 %',
      plan: `${eur(masse)} de masse salariale en année 1`,
      mut: (c) => (c.team || []).forEach((m) => { m.monthlyGross = n(m.monthlyGross) * 1.1 }) },
    top && { cle: 'delais', nom: 'Délais de paiement des clients', dit: 'des clients qui paient 30 jours plus tard', test: '+30 jours',
      plan: delai > 0 ? `${delai} jours` : 'au comptant',
      mut: (c) => (c.activities || []).forEach((a) => { a.paymentLag = n(a.paymentLag) + 1 }) },
    top && { cle: 'lancement', nom: 'Date de lancement', dit: 'un lancement décalé de trois mois', test: '+3 mois',
      plan: monthLabel(Math.max(0, n(top.a.volumes?.launchMonth)), r.startDate),
      mut: (c) => (c.activities || []).forEach((a) => {
        if (!a.volumes) return
        if (a.volumes.mode === 'manual' && Array.isArray(a.volumes.manual)) a.volumes.manual = [0, 0, 0, ...a.volumes.manual].slice(0, 60)
        else a.volumes.launchMonth = n(a.volumes.launchMonth) + 3
      }) },
    somme(f.loans) > 0 && { cle: 'pret', nom: 'Prêt bancaire', dit: 'sans le prêt bancaire', test: 'refusé',
      plan: `${eur(somme(f.loans))} empruntés`, mut: (c) => { c.financing.loans = [] } },
    somme(f.equityInvestors) > 0 && { cle: 'levee', nom: 'Levée de fonds', dit: 'une levée qui arrive six mois plus tard', test: '+6 mois',
      plan: `${eur(somme(f.equityInvestors))} levés`, mut: (c) => { c.financing.equityInvestors = (c.financing.equityInvestors || []).map((x) => ({ ...x, month: Math.min(59, n(x.month) + 6) })) } },
  ].filter(Boolean)
  const val = liste.map((hyp) => {
    const c = JSON.parse(JSON.stringify(s))
    hyp.mut(c)
    let x
    try { x = compute(c) } catch { return null }
    const besoin = n(x.kpis.fundingNeed), net = n(x.pnl.netResult[2])
    return { ...hyp, besoin, net, dBesoin: besoin - besoin0, dNet: net - net0, bas: n(x.kpis.cashLow?.value), mois: x.kpis.cashLow?.month ?? 0 }
  }).filter(Boolean)
  memoire.r = r
  memoire.val = val
  return val
}

/** Classer une charge dans un grand poste, d'après son libellé. */
const POSTES = [
  { cle: 'locaux', nom: 'Locaux', dit: 'les locaux', re: new RegExp('loyer|local|locaux|bail|bureau|boutique|cabinet|salle|murs|coworking|électricit|electricit|énergie|energie|chauffage|eau\\b', 'i') },
  { cle: 'logiciels', nom: 'Logiciels et hébergement', dit: 'les logiciels', re: new RegExp('logiciel|hébergement|hebergement|saas|licence|serveur|cloud|informatique|site|domaine|outil|abonnement', 'i') },
  { cle: 'marketing', nom: 'Marketing', dit: 'le marketing', re: new RegExp('marketing|publicit|campagne|communication|acquisition|salon|annonce', 'i') },
  { cle: 'honoraires', nom: 'Honoraires', dit: 'les honoraires', re: new RegExp('comptab|juridique|avocat|honoraire|expert|conseil|notaire|audit', 'i') },
  { cle: 'commissions', nom: 'Commissions et frais bancaires', dit: 'les commissions', re: new RegExp('commission|paiement|banque|bancaire|carte|plateforme|transaction', 'i') },
]
const posteDe = (label) => POSTES.find((p) => p.re.test(label || '')) || { cle: 'autres', nom: 'Autres charges', dit: 'les autres charges' }

/**
 * Les coûts hors équipe d'un exercice, ligne par ligne, rangés par poste :
 * le coût de revient des offres, chaque charge — campagnes marketing
 * comprises —, le crédit-bail, les impôts et taxes. Chaque ligne dit si elle
 * suit les ventes ou tombe chaque mois.
 */
export function lignesDeCouts(s, r, an) {
  const acts = s.activities || []
  return [
    ...(r.revenue?.perActivity || []).map((x) => ({ nom: `Coût de revient — ${acts.find((a) => a.id === x.id)?.name || 'offre'}`, poste: { cle: 'achats', nom: 'Achats', dit: 'les achats' }, v: parAn(x.variableCost, an), nature: 'variable' })),
    ...(r.opex?.perItem || []).map((it) => ({ nom: it.label, poste: it.campagne ? POSTES.find((q) => q.cle === 'marketing') : posteDe(it.label), v: n(it.yearly?.[an]), nature: it.mode === 'perUnit' || it.mode === 'pctRevenue' ? 'variable' : 'fixe' })),
    { nom: 'Crédit-bail', poste: posteDe(''), v: parAn(r.capex?.leaseMonthly, an), nature: 'fixe' },
    { nom: 'Impôts et taxes', poste: posteDe(''), v: n(r.pnl.duties[an]), nature: 'fixe' },
  ].filter((l) => l.v > 0.5)
}

/* ─────────────────────────────── Le récit ─────────────────────────────── */

export function analyseStrategique(s, r, navigate, { source = null } = {}) {
  const p = r.pnl, k = r.kpis
  const debut = r.startDate
  const bm = SECTORS[s.meta?.sectorKey]?.benchmarks || {}
  const ca = p.revenue.map(n)
  const a1 = ca[0], a3 = ca[2], a5 = ca[4]
  const aucuneVente = ca.every((v) => v <= 0)
  const yv = Math.max(0, ca.findIndex((v) => v > 0))
  const va = (label, go) => ({ label, go })
  const premier = k.firstProfitableYear
  const aPremier = premier !== null && premier !== undefined
  const offres = lesOffres(s, r).sort((x, z) => z.ca[yv] - x.ca[yv])
  const top = offres[0] || null
  const chapitres = []

  /* 01 — Chiffre d'affaires ─────────────────────────────────────────────── */
  {
    const cagr = a1 > 0 && a5 > 0 && a5 / a1 <= 1000 ? Math.pow(a5 / a1, 1 / 4) - 1 : null
    const variation = ANS.map((y) => (y > 0 && ca[y - 1] > 0 ? ca[y] / ca[y - 1] - 1 : null))
    const recM = Array.from({ length: 60 }, (_, m) => (r.revenue?.perActivity || []).reduce((t, a) => t + n(a.recurring?.[m]), 0))
    const partRec = ca[yv] > 0 ? parAn(recM, yv) / ca[yv] : 0
    const recurrent = partRec >= 0.3
    const mrr1 = recM[yv * 12 + 11]
    // D'où vient la croissance : des volumes, des prix, ou d'offres nouvelles.
    const q = (y) => offres.reduce((t, o) => t + o.volume[y], 0)
    const g = ca[yv] > 0 && a5 > 0 ? a5 / ca[yv] : null
    const qg = q(yv) > 0 && q(4) > 0 ? q(4) / q(yv) : null
    const nouvelles = offres.filter((o) => o.ca[yv] <= 0 && o.ca[4] > 0).reduce((t, o) => t + o.ca[4], 0)
    const origine = g === null ? null
      : g < 0.95 ? 'Le chiffre d’affaires recule sur la période.'
        : g <= 1.05 ? 'Le chiffre d’affaires reste stable sur la période.'
          : a5 > 0 && nouvelles / a5 > 0.3 ? 'La croissance provient principalement des nouvelles offres lancées en cours de plan.'
            : qg !== null && Math.log(Math.max(qg, 1e-9)) >= 0.6 * Math.log(g) ? 'La croissance provient principalement de l’augmentation des volumes.'
              : qg !== null && Math.log(Math.max(qg, 1e-9)) <= 0.4 * Math.log(g) ? 'La croissance provient principalement de la hausse des prix.'
                : 'La croissance vient à parts comparables des volumes et des prix.'
    const ralentit = variation[4] !== null && variation[1] !== null && variation[1] > 0 && variation[4] < variation[1] / 2
    chapitres.push(chapitre({
      no: 1, titre: 'Chiffre d’affaires', sousTitre: 'Le niveau de revenus généré par l’activité et son évolution sur cinq ans.',
      conclusion: aucuneVente ? 'Le plan ne prévoit pas encore de ventes.'
        : a1 > 0 ? `L’entreprise réalise ${eur(a1)} de chiffre d’affaires la première année et atteint ${eur(a3)} en année 3.`
          : `Les premières ventes arrivent en année ${yv + 1}. Le chiffre d’affaires atteint ${eur(a3)} en année 3.`,
      chiffres: aucuneVente ? [] : [
        { l: 'Année 1', v: eur(a1), note: 'Chiffre d’affaires hors taxes.' },
        { l: 'Année 5', v: eur(a5), note: a1 > 0 && a5 / a1 <= 1000 ? `${num(a5 / a1, 1)} fois l’année 1.` : null },
        { l: 'Croissance annuelle moyenne', v: cagr !== null ? signe(cagr) : '—', note: 'De l’année 1 à l’année 5.' },
        recurrent ? { l: 'Revenu récurrent mensuel', v: euro(mrr1), note: `MRR en fin d’année ${yv + 1}, soit ${eur(mrr1 * 12)} par an (ARR).` } : null,
      ],
      dessin: aucuneVente ? null : barChart({
        series: [{ label: 'Chiffre d’affaires', values: ca, color: '#0E0F0C' }],
        categories: ['A1', 'A2', 'A3', 'A4', 'A5'], height: 190, largeur: 560,
        periodes: ANS.map((i) => periodeAnnee(i, debut)),
      }),
      clair: aucuneVente ? ['Fixe un prix et un volume dans Offre et revenus : ce chapitre se remplira.'] : [
        origine,
        variation[1] !== null ? `Le chiffre d’affaires ${variation[1] >= 0 ? 'progresse' : 'recule'} de ${pct(Math.abs(variation[1]), 0)} entre l’année 1 et l’année 2.` : null,
        ralentit ? `La croissance ralentit ensuite : ${signe(variation[4])} entre l’année 4 et l’année 5.` : null,
        recurrent ? `${pct(partRec, 0)} du chiffre d’affaires est récurrent : il revient chaque mois sans nouvelle vente.` : null,
      ],
      plus: aucuneVente ? null : detail([
        tableau(tetesAns(''), [
          ['Chiffre d’affaires', ...ca.map((v) => euro(v))],
          ['Variation', ...variation.map((v) => (v === null ? '—' : signe(v)))],
          recM.some((v) => v > 0) ? ['Revenu récurrent, fin d’année (MRR)', ...ANS.map((y) => euro(recM[y * 12 + 11]))] : null,
          recM.some((v) => v > 0) ? ['En rythme annuel (ARR)', ...ANS.map((y) => euro(recM[y * 12 + 11] * 12))] : null,
          recM.some((v) => v > 0) ? ['Part récurrente', ...ANS.map((y) => (ca[y] > 0 ? pct(parAn(recM, y) / ca[y], 0) : '—'))] : null,
        ]),
      ], va('Modifier les offres', { route: 'offre', view: 'offres' }), navigate),
    }))
  }

  /* 02 — Résultat et rentabilité ────────────────────────────────────────── */
  {
    const y = yv
    const net = n(p.netResult[y]), depense = ca[y] - net
    const marge = n(p.grossMargin[y]), tauxMarge = taux(marge, ca[y])
    const rentab = taux(net, ca[y])
    const ebe = n(p.ebe[y])
    const an = `En année ${y + 1}`
    chapitres.push(chapitre({
      no: 2, titre: 'Résultat et rentabilité', sousTitre: 'Ce qu’il reste après les coûts nécessaires au fonctionnement de l’entreprise.',
      conclusion: [
        aucuneVente ? `${an}, l’entreprise dépense ${eur(depense)} sans chiffre d’affaires.`
          : net >= 0 ? `${an}, l’entreprise facture ${eur(ca[y])}, dépense ${eur(depense)} et dégage un résultat net de ${eur(net)}.`
            : `${an}, l’entreprise facture ${eur(ca[y])} et dépense ${eur(depense)} : elle perd ${eur(-net)}.`,
        aPremier ? (premier === y && net > 0 ? `Elle est bénéficiaire dès l’année ${y + 1}.` : `Le premier bénéfice arrive en année ${premier + 1}.`) : 'Le plan ne dégage pas de bénéfice sur cinq ans.',
      ].join(' '),
      repere: `Année ${y + 1}`,
      chiffres: [
        { l: 'Marge brute', v: eur(marge), note: `${tauxMarge !== null ? `${pct(tauxMarge, 0)} du chiffre d’affaires. ` : ''}Ce qui reste des ventes après leurs coûts directs.` },
        { l: 'EBE (EBITDA)', v: eur(ebe), ton: ebe < 0 ? 'bad' : null, note: 'Résultat généré par l’activité avant amortissements, intérêts et impôts.' },
        { l: 'Résultat net', v: eur(net), ton: net < 0 ? 'bad' : 'good', note: 'Ce qui reste une fois toutes les charges payées, impôt compris.' },
        { l: 'Rentabilité nette', v: rentab !== null ? pct(rentab, 1) : '—', note: 'Le résultat net rapporté au chiffre d’affaires.' },
      ],
      dessin: cascade([
        { type: 'depart', l: 'Chiffre d’affaires', v: ca[y] },
        n(p.variableCost[y]) ? { l: 'Coûts directs des ventes', v: -n(p.variableCost[y]), def: 'Achats, coût de revient et charges par vente' } : null,
        n(p.external[y]) ? { l: 'Charges externes', v: -n(p.external[y]), def: 'Locaux, logiciels, honoraires, marketing…' } : null,
        n(p.payroll[y]) ? { l: 'Masse salariale', v: -n(p.payroll[y]), def: 'Salaires bruts et cotisations patronales' } : null,
        n(p.duties[y]) ? { l: 'Impôts et taxes', v: -n(p.duties[y]) } : null,
        n(p.grants[y]) ? { l: 'Subventions d’exploitation', v: n(p.grants[y]) } : null,
        { type: 'sous', l: 'EBE', def: 'Avant amortissements, intérêts et impôts' },
        n(p.amortisation[y]) ? { l: 'Amortissements', v: -n(p.amortisation[y]), def: 'L’usure du matériel, étalée sur sa durée' } : null,
        n(p.badDebts?.[y]) ? { l: 'Impayés', v: -n(p.badDebts[y]), def: 'Pertes sur créances : des factures qui ne seront jamais réglées' } : null,
        n(p.interest[y]) ? { l: 'Intérêts d’emprunt', v: -n(p.interest[y]) } : null,
        n(p.corporateTax[y]) ? { l: 'Impôt sur les sociétés', v: -n(p.corporateTax[y]) } : null,
        n(p.credits[y]) ? { l: 'Crédits d’impôt', v: n(p.credits[y]), def: 'Crédit d’impôt recherche ou innovation' } : null,
        { type: 'total', l: 'Résultat net' },
      ], periodeAnnee(y, debut)),
      clair: [
        tauxMarge !== null && bm.grossMargin ? `La marge brute atteint ${pct(tauxMarge, 0)}. Dans ce métier, elle se situe habituellement entre ${pct(bm.grossMargin[0], 0)} et ${pct(bm.grossMargin[1], 0)}.` : null,
        tauxMarge !== null && bm.grossMargin && source ? source() : null,
        taux(p.netResult[2], ca[2]) !== null ? `En année 3, la rentabilité nette est de ${pct(taux(p.netResult[2], ca[2]), 1)}.` : null,
        n(p.credits[y]) > 0 && net > ebe ? `Le résultat net dépasse l’EBE grâce aux crédits d’impôt (${eur(n(p.credits[y]))}).` : null,
      ],
      plus: detail([
        tableau(tetesAns(''), [
          ['Chiffre d’affaires', ...ca.map((v) => euro(v))],
          ['Marge brute', ...p.grossMargin.map((v) => euro(v))],
          ['Taux de marge brute', ...ANS.map((i) => (taux(p.grossMargin[i], ca[i]) !== null ? pct(taux(p.grossMargin[i], ca[i]), 1) : '—'))],
          ['EBE', ...p.ebe.map((v) => euro(v))],
          ['EBITDA', ...p.ebitda.map((v) => euro(v))],
          ['Résultat net', ...p.netResult.map((v) => euro(v))],
          ['Rentabilité nette', ...ANS.map((i) => (taux(p.netResult[i], ca[i]) !== null ? pct(taux(p.netResult[i], ca[i]), 1) : '—'))],
        ]),
        h('p', { class: 'as-note' }, (p.badDebts || []).some((v) => v)
          ? 'L’EBE se calcule depuis la valeur ajoutée ; l’EBITDA, depuis le résultat d’exploitation. L’écart entre les deux, ce sont les impayés prévus : l’EBITDA les retranche, l’EBE non.'
          : 'L’EBE se calcule depuis la valeur ajoutée ; l’EBITDA, depuis le résultat d’exploitation. Ils ne diffèrent que par les provisions et les pertes sur créances, absentes de ce plan.'),
      ], va('Voir les états financiers', { route: 'resultats' }), navigate),
    }))
  }

  /* 03 — Répartition des ventes ─────────────────────────────────────────── */
  {
    const y = yv
    const total = offres.reduce((t, o) => t + o.ca[y], 0)
    const part = top && total > 0 ? top.ca[y] / total : 0
    const part5 = top && offres.reduce((t, o) => t + o.ca[4], 0) > 0 ? top.ca[4] / offres.reduce((t, o) => t + o.ca[4], 0) : 0
    const genere = (o) => (o.modeRec
      ? `Elle génère ${eur(o.ca[y])} grâce à ${num(o.volume[y], 0)} mensualités à ${prixTxt(o.prixMoyen[y])}.`
      : `Elle génère ${eur(o.ca[y])} grâce à ${num(o.volume[y], 0)} ${o.u.many} à ${prixTxt(o.prixMoyen[y])}.`)
    chapitres.push(chapitre({
      no: 3, titre: 'Répartition des ventes', sousTitre: 'La contribution de chaque offre au chiffre d’affaires.',
      conclusion: !top ? 'Aucune offre ne génère encore de chiffre d’affaires.'
        : offres.length === 1 ? `Une seule offre porte tout le chiffre d’affaires : « ${top.nom} ». ${genere(top)}`
          : `En année ${y + 1}, ${pct(part, 0)} du chiffre d’affaires vient de l’offre « ${top.nom} ». ${genere(top)}`,
      repere: top ? `Année ${y + 1}` : null,
      chiffres: !top ? [] : [
        { l: 'Offre principale', v: pct(part, 0), note: `du chiffre d’affaires, avec « ${top.nom} ».` },
        { l: 'Volume', v: num(top.volume[y], 0), note: top.modeRec ? 'mensualités facturées dans l’année.' : `${top.u.many} ${top.u.verb || 'vendus'} dans l’année.` },
        { l: 'Prix moyen', v: prixTxt(top.prixMoyen[y]), note: top.modeRec ? 'par abonné et par mois, hors taxes.' : `par ${top.u.one}, hors taxes.` },
        offres.length > 1 ? { l: 'Offres', v: String(offres.length), note: part > 0.7 ? 'Le chiffre d’affaires reste concentré sur une offre.' : 'Le chiffre d’affaires est réparti.' } : null,
      ],
      dessin: top ? barres(offres.slice(0, 5).map((o) => ({ nom: o.nom, v: o.ca[y], sous: formule(o, y) })), {
        format: (v) => eur(v), periode: `Chiffre d’affaires · ${periodeAnnee(y, debut)}`,
        detail: (x) => { const o = offres.find((z) => z.nom === x.nom); return o ? [{ label: o.modeRec ? 'Mensualités facturées' : 'Volume', value: num(o.volume[y], 0) }, { label: 'Prix moyen', value: prixTxt(o.prixMoyen[y]) }] : [] },
      }) : null,
      clair: !top ? [] : [
        top.modeRec
          ? `Les abonnés actifs passent de ${num(top.abonnesFin[y], 0)} en fin d’année ${y + 1} à ${num(top.abonnesFin[4], 0)} en fin d’année 5.`
          : `Les volumes de « ${top.nom} » passent de ${num(top.volume[y], 0)} en année ${y + 1} à ${num(top.volume[4], 0)} en année 5.`,
        top.prixMoyen[4] > 0 && Math.abs(top.prixMoyen[4] / top.prixMoyen[y] - 1) >= 0.05 ? `Son prix moyen évolue de ${prixTxt(top.prixMoyen[y])} à ${prixTxt(top.prixMoyen[4])}.` : 'Son prix reste stable sur la période.',
        offres.length === 1 ? 'Tout le plan repose sur cette offre.'
          : part > 0.7 ? `La dépendance à cette offre est forte : elle pèse encore ${pct(part5, 0)} en année 5.` : null,
      ],
      plus: !top ? null : detail([
        tableau(tetesAns('Chiffre d’affaires'), offres.map((o) => [o.nom, ...o.ca.map((v) => euro(v))])),
        tableau(tetesAns('Volumes'), offres.map((o) => [`${o.nom} (${o.modeRec ? 'mensualités' : o.u.many})`, ...o.volume.map((v) => num(v, 0))])),
        tableau(tetesAns('Prix moyen'), offres.map((o) => [o.nom, ...o.prixMoyen.map((v) => (v > 0 ? prixTxt(v) : '—'))])),
        tableau(tetesAns('Contribution'), offres.map((o) => [o.nom, ...ANS.map((i) => { const t = offres.reduce((a, z) => a + z.ca[i], 0); return t > 0 ? pct(o.ca[i] / t, 0) : '—' })])),
      ], va('Modifier les offres', { route: 'offre', view: 'offres' }), navigate),
    }))
  }

  /* 04 — Économie d'une vente ───────────────────────────────────────────── */
  {
    const y = yv
    const cv = top ? coutDUneVente(s, top.a) : null
    const prix = cv && cv.prix > 0 ? cv.prix : top ? top.prixMoyen[y] : 0
    const cout = cv ? cv.total : 0
    const marge = prix - cout
    const par = top?.modeRec ? 'par mois' : top ? `par ${top.u.one}` : ''
    const pm = n(k.breakEven?.[y])
    const fixes = n(k.fixedCosts?.[y])
    // Combien de ventes pour couvrir les charges fixes : avec une offre, sa
    // marge ; avec plusieurs, la marge moyenne d'une vente du plan.
    const qTot = offres.reduce((t, o) => t + o.volume[y], 0)
    const margeMoy = offres.length > 1 && qTot > 0 ? n(p.grossMargin[y]) / qTot : marge
    const unite = offres.length > 1 ? vocabulaireDuPlan(s) : top?.u
    const mot = top?.modeRec && offres.length === 1 ? 'abonnés payants' : `${unite?.many || 'ventes'}`
    const parMois = margeMoy > 0 ? Math.ceil(fixes / 12 / margeMoy) : null
    const anPM = (k.breakEvenMonth || []).findIndex((m) => m)
    const moisPM = anPM >= 0 ? anPM * 12 + n(k.breakEvenMonth[anPM]) - 1 : null
    const lignes = cv ? [cv.propre > 0 ? { l: 'Coût de revient', v: cv.propre } : null, ...cv.lignes.map((x) => ({ l: x.label, v: x.v }))].filter(Boolean) : []
    chapitres.push(chapitre({
      no: 4, titre: 'Économie d’une vente', sousTitre: 'La marge générée par chaque vente avant absorption des charges fixes.',
      conclusion: !top ? 'Sans prix de vente, l’économie d’une vente ne se calcule pas encore.'
        : `« ${top.nom} » : ${prixTxt(prix)} ${par} − ${prixTxt(cout)} de coût direct = ${prixTxt(marge)} de marge.`,
      chiffres: !top ? [] : [
        { l: 'Coût direct', v: prixTxt(cout), note: 'Coût de revient et charges par vente : ce que coûte chaque vente, et rien d’autre.' },
        { l: 'Marge par vente', v: prixTxt(marge), ton: marge <= 0 ? 'bad' : null, note: prix > 0 ? `${pct(marge / prix, 0)} du prix. C’est elle qui paie les charges fixes.` : null },
        { l: 'Point mort', v: pm > 0 ? eur(pm) : 'Non atteint', note: `Le chiffre d’affaires annuel qui couvre toutes les charges fixes, année ${y + 1}.` },
        parMois !== null ? { l: 'Ventes nécessaires', v: `${num(parMois, 0)} par mois`, note: `${mot} pour atteindre le point mort.` } : null,
      ],
      dessin: top ? equation({ prix, cout, marge, par, lignes, periode: `Une vente de « ${top.nom} »` }) : null,
      clair: !top ? [] : [
        marge <= 0 ? 'Chaque vente coûte plus qu’elle ne rapporte : vendre davantage creuse la perte.'
          : `Les charges fixes de l’année ${y + 1}, amortissements et intérêts d’emprunt compris, s’élèvent à ${eur(fixes)}.`,
        marge > 0 && parMois !== null ? `Il faut ${num(parMois, 0)} ${mot} par mois pour les couvrir ; au-delà, chaque vente augmente le résultat.` : null,
        moisPM !== null ? `Le plan atteint son point mort en ${monthLabel(moisPM, debut)}.` : 'Le plan n’atteint pas son point mort sur cinq ans.',
      ],
      plus: !top ? null : detail([
        tableau(['Offre', 'Prix', 'Coût de revient', 'Charges par vente', 'Marge', 'Taux'], offres.map((o) => {
          const c = coutDUneVente(s, o.a)
          const px = c.prix > 0 ? c.prix : o.prixMoyen[y]
          return [o.nom, prixTxt(px), prixTxt(c.propre), c.charges > 0 ? `${prixTxt(c.charges)} (${c.lignes.map((x) => x.label.toLowerCase()).join(', ')})` : '—', prixTxt(px - c.total), px > 0 ? pct((px - c.total) / px, 0) : '—']
        })),
        tableau(tetesAns(''), [
          ['Charges fixes, amortissements et intérêts compris', ...ANS.map((i) => euro(n(k.fixedCosts?.[i])))],
          ['Taux de marge', ...ANS.map((i) => (taux(p.grossMargin[i], ca[i]) !== null ? pct(taux(p.grossMargin[i], ca[i]), 1) : '—'))],
          ['Point mort', ...ANS.map((i) => (n(k.breakEven?.[i]) > 0 ? euro(k.breakEven[i]) : '—'))],
          ['Chiffre d’affaires', ...ca.map((v) => euro(v))],
        ]),
        h('p', { class: 'as-note' }, 'Point mort = charges fixes ÷ taux de marge brute. Les charges fixes comprennent la masse salariale, les charges externes, les impôts et taxes, les amortissements et les intérêts.'),
      ], va('Régler les coûts', { route: 'achats', view: 'charges', anchor: 'charges' }), navigate),
    }))
  }

  /* 05 — Masse salariale ────────────────────────────────────────────────── */
  {
    const team = (s.team || []).filter((m) => m.enabled !== false)
    const estFondateur = (m) => ['tns', 'dirigeant', 'micro'].includes(m.contractType) || RE_FONDATEUR.test(m.role || '')
    const fondateurs = team.filter(estFondateur)
    const serieDe = (m) => (r.payroll?.byMember || []).find((b) => b.id === m.id)?.series
    const coutF = ANS.map((y) => fondateurs.reduce((t, m) => t + parAn(serieDe(m), y), 0))
    const masse = p.payroll.map(n)
    const salaries = ANS.map((y) => Math.max(0, masse[y] - coutF[y]))
    const hc = (m) => n(r.payroll?.headcount?.[m])
    const ratio = ANS.map((y) => taux(masse[y], ca[y]))
    const brutF = fondateurs.reduce((t, m) => t + n(m.monthlyGross) * Math.max(1, n(m.count) || 1), 0)
    const bmr = bm.payrollRatio
    const r3 = ratio[2]
    chapitres.push(chapitre({
      no: 5, titre: 'Masse salariale', sousTitre: 'Le coût total de l’équipe et son poids dans le modèle économique.',
      conclusion: masse[0] <= 0 ? 'Le plan ne prévoit aucune rémunération en année 1.'
        : ratio[0] !== null ? `L’équipe coûte ${eur(masse[0])} en année 1, soit ${pct(ratio[0], 0)} du chiffre d’affaires.`
          : `L’équipe coûte ${eur(masse[0])} en année 1, avant l’essentiel des ventes.`,
      chiffres: [
        { l: 'Effectif', v: `${num(hc(11), 0)} personne${hc(11) > 1 ? 's' : ''}`, note: `En fin d’année 1 ; ${num(hc(59), 0)} en fin d’année 5.` },
        { l: 'Masse salariale, année 1', v: eur(masse[0]), note: 'Salaires bruts et cotisations patronales : le coût employeur.' },
        { l: 'Part du chiffre d’affaires', v: ratio[0] !== null ? pct(ratio[0], 0) : '—', note: ratio[4] !== null ? `${pct(ratio[4], 0)} en année 5.` : null },
        { l: 'Rémunération des fondateurs', v: brutF > 0 ? `${euro(brutF)} brut/mois` : 'Aucune', ton: brutF > 0 ? null : 'bad', note: brutF > 0 ? `Coût employeur : ${eur(coutF[0])} en année 1.` : 'Aucune rémunération prévue pour les fondateurs.' },
      ],
      dessin: masse.some((v) => v > 0) ? barChart({
        series: [
          { label: 'Équipe salariée', values: salaries, color: '#0E0F0C' },
          ...(coutF.some((v) => v > 0) ? [{ label: 'Fondateurs', values: coutF, color: '#9BA59A' }] : []),
        ],
        categories: ['A1', 'A2', 'A3', 'A4', 'A5'], height: 180, largeur: 560,
        periodes: ANS.map((i) => periodeAnnee(i, debut)),
      }) : null,
      clair: [
        hc(59) === hc(11) && hc(11) > 0 && a1 > 0 && a5 / a1 >= 2
          ? `L’effectif reste de ${num(hc(11), 0)} personne${hc(11) > 1 ? 's' : ''} sur cinq ans, alors que le chiffre d’affaires est multiplié par ${num(a5 / a1, 1)}.`
          : hc(59) !== hc(11) ? `L’effectif passe de ${num(hc(11), 0)} à ${num(hc(59), 0)} personnes.` : null,
        bmr && r3 !== null ? `Dans ce métier, la masse salariale représente habituellement ${pct(bmr[0], 0)} à ${pct(bmr[1], 0)} du chiffre d’affaires ; le plan est à ${pct(r3, 0)} en année 3.` : null,
        bmr && r3 !== null && source ? source() : null,
        bmr && r3 !== null ? (r3 < bmr[0] ? 'C’est en dessous de la fourchette : l’équipe prévue paraît réduite pour le volume d’activité visé.'
          : r3 > bmr[1] ? 'C’est au-dessus de la fourchette : chaque embauche doit être couverte par des ventes.' : 'C’est dans la fourchette du métier.') : null,
      ],
      plus: detail([
        team.length ? tableau(['Poste', 'Contrat', 'Brut mensuel', 'Arrivée', 'Coût employeur A1', 'Coût employeur A5'], team.map((m) => [
          `${m.role || 'Poste'}${n(m.count) > 1 ? ` ×${m.count}` : ''}${estFondateur(m) ? ' — fondateur' : ''}`,
          CONTRACT_TYPES[m.contractType]?.label || m.contractType || '—',
          euro(n(m.monthlyGross)), monthLabel(n(m.startMonth), debut), euro(parAn(serieDe(m), 0)), euro(parAn(serieDe(m), 4)),
        ])) : null,
        tableau(tetesAns(''), [
          ['Masse salariale', ...masse.map((v) => euro(v))],
          ['dont fondateurs', ...coutF.map((v) => euro(v))],
          ['Part du chiffre d’affaires', ...ratio.map((v) => (v === null ? '—' : pct(v, 0)))],
          ['Effectif en fin d’année', ...ANS.map((y) => num(hc(y * 12 + 11), 0))],
        ]),
      ], va('Modifier l’équipe', { route: 'equipe', view: 'postes', anchor: 'equipe' }), navigate),
    }))
  }

  /* 06 — Structure des coûts ────────────────────────────────────────────── */
  {
    const y = yv
    const lignesDe = (an) => lignesDeCouts(s, r, an)
    const lignes = lignesDe(y)
    const total = lignes.reduce((t, l) => t + l.v, 0)
    const fixe = lignes.filter((l) => l.nature === 'fixe').reduce((t, l) => t + l.v, 0)
    const variable = total - fixe
    const postes = Object.values(lignes.reduce((acc, l) => {
      const c = acc[l.poste.cle] || (acc[l.poste.cle] = { ...l.poste, v: 0, lignes: [] })
      c.v += l.v; c.lignes.push(l)
      return acc
    }, {})).sort((a, b) => b.v - a.v)
    const tete = postes.slice(0, 3)
    const liste = tete.map((x) => `${x.dit} (${eur(x.v)})`)
    const dire = liste.length === 1 ? liste[0] : `${liste.slice(0, -1).join(', ')} et ${liste[liste.length - 1]}`
    const hors = n(p.payroll[y]) > 0 ? 'Après l’équipe' : 'Hors équipe'
    const total5 = lignesDe(4).reduce((t, l) => t + l.v, 0)
    chapitres.push(chapitre({
      no: 6, titre: 'Structure des coûts', sousTitre: 'Les dépenses de l’entreprise hors équipe, et les postes qui pèsent le plus.',
      conclusion: !postes.length ? 'Aucune charge n’est encore saisie en dehors de l’équipe.'
        : tete.length === 1 ? `${hors}, le principal coût est ${dire}.`
          : `${hors}, les ${tete.length === 2 ? 'deux' : 'trois'} principaux coûts sont ${dire}.`,
      repere: postes.length ? `Année ${y + 1}` : null,
      chiffres: !postes.length ? [] : [
        { l: 'Coûts hors équipe', v: eur(total), note: taux(total, ca[y]) !== null ? `${pct(taux(total, ca[y]), 0)} du chiffre d’affaires.` : null },
        { l: 'Charges fixes', v: `${euro(fixe / 12)}/mois`, note: 'Elles tombent chaque mois, avec ou sans ventes.' },
        { l: 'Coûts variables', v: eur(variable), note: `${taux(variable, ca[y]) !== null ? `${pct(taux(variable, ca[y]), 0)} du chiffre d’affaires. ` : ''}Ils suivent les ventes.` },
      ],
      dessin: postes.length ? barres(postes.slice(0, 5).map((x) => ({ nom: x.nom, v: x.v, sous: x.lignes.length > 1 ? `${x.lignes.length} lignes` : x.lignes[0].nom })), {
        format: (v) => eur(v), periode: `Coûts hors équipe · ${periodeAnnee(y, debut)}`,
        detail: (x) => (postes.find((z) => z.nom === x.nom)?.lignes || []).sort((a, b) => b.v - a.v).slice(0, 4).map((l) => ({ label: l.nom, value: euro(l.v) })),
      }) : null,
      clair: !postes.length ? [] : [
        `Les charges fixes hors équipe représentent ${euro(fixe / 12)} par mois en année ${y + 1}.`,
        total5 > 0 && taux(total5, ca[4]) !== null ? `En année 5, les coûts hors équipe atteignent ${eur(total5)}, soit ${pct(taux(total5, ca[4]), 0)} du chiffre d’affaires.` : null,
      ],
      plus: !postes.length ? null : detail([
        tableau(['Ligne', 'Poste', 'Nature', 'Année 1', 'Année 3', 'Année 5'], [...lignes].sort((a, b) => b.v - a.v).map((l) => {
          const v3 = lignesDe(2).find((z) => z.nom === l.nom)?.v || 0
          const v5 = lignesDe(4).find((z) => z.nom === l.nom)?.v || 0
          return [l.nom, l.poste.nom, l.nature === 'fixe' ? 'Fixe' : 'Variable', euro(l.v), euro(v3), euro(v5)]
        })),
      ], va('Modifier les charges', { route: 'achats', view: 'charges', anchor: 'charges' }), navigate),
    }))
  }

  /* 07 — Trésorerie ─────────────────────────────────────────────────────── */
  const conso = consommation(s, r)
  {
    const bal = r.cash.balance.map(n)
    const bas = k.cashLow?.month ?? 0
    const vBas = bal[bas]
    const sousZero = k.firstNegativeMonth ?? null
    const remonte = vBas < 0 ? bal.findIndex((v, m) => m > bas && v >= 0) : -1
    const negatifs = bal.map((v, m) => (v < 0 ? m : null)).filter((m) => m !== null)
    const net0 = n(p.netResult[0])
    const act0 = conso.activiteAn[0]
    const bfr = n(k.peakBfr)
    const capex0 = parAn(r.capex?.spendMonthly, 0)
    const runway = k.runwayMonths
    const fenetre = vBas < 0 ? Math.min(60, Math.max(24, Math.ceil(((remonte >= 0 ? remonte : 59) + 7) / 12) * 12)) : 60
    const credits0 = n(p.credits[0])
    chapitres.push(chapitre({
      no: 7, titre: 'Trésorerie', sousTitre: 'L’évolution du solde disponible et le point bas atteint par le plan.',
      rupture: 'Être rentable et avoir de la trésorerie sont deux choses différentes.',
      conclusion: vBas >= 0
        ? `Le point bas de trésorerie est atteint en ${monthLabel(bas, debut)}, à ${eur(vBas)}. La trésorerie reste positive sur les cinq ans.`
        : [`La trésorerie passe sous zéro en ${monthLabel(sousZero ?? bas, debut)}.`,
          `Elle atteint son point bas en ${monthLabel(bas, debut)}, à ${eur(vBas)}.`,
          remonte >= 0 ? `Elle redevient positive en ${monthLabel(remonte, debut)}.` : 'Elle ne redevient pas positive sur cinq ans.'].join(' '),
      chiffres: [
        { l: 'Point bas', v: eur(vBas), ton: vBas < 0 ? 'bad' : 'good', note: monthLabel(bas, debut) },
        { l: 'Fin d’année 1', v: eur(n(r.cash.yearEnd[0])), note: `${eur(n(r.cash.yearEnd[4]))} en fin d’année 5.` },
        { l: 'Mois sous zéro', v: String(negatifs.length), ton: negatifs.length ? 'bad' : 'good', note: negatifs.length ? `De ${monthLabel(negatifs[0], debut)} à ${monthLabel(negatifs[negatifs.length - 1], debut)}.` : 'Aucun sur cinq ans.' },
        { l: 'Autonomie', v: runway === null || runway === undefined ? 'Non limitée' : `${num(n(runway), 0)} mois`, note: runway === null || runway === undefined ? 'L’activité ne consomme pas de trésorerie au départ.' : 'Ce que couvre la trésorerie de départ, au rythme des dépenses des premiers mois.' },
      ],
      // La courbe répond à une question : est-ce que je passe sous zéro,
      // quand, et de combien ? Sur cinq ans, la montée finale écrasait le
      // creux ; on montre donc les mois qui y répondent, jusqu'au retour
      // au-dessus de zéro.
      dessin: h('figure', { class: 'as-figure' },
        courbeTreso(bal.slice(0, fenetre), debut, { bas, sousZero, remonte: remonte >= 0 ? remonte : null }),
        fenetre < 60 ? h('figcaption', {}, `Les ${fenetre} premiers mois, jusqu’au retour au-dessus de zéro. Les cinq ans sont dans le détail.`) : null),
      clair: [
        `En année 1, le résultat net est de ${eur(net0)}. Hors apports et emprunts, l’activité ${act0 >= 0 ? 'dégage' : 'consomme'} ${eur(Math.abs(act0))} de trésorerie.`,
        bfr > 1000 ? `L’écart vient d’abord du BFR, le besoin en fonds de roulement : l’argent avancé entre le moment où l’on paie et celui où l’on encaisse. Il atteint ${eur(bfr)} au plus haut.` : null,
        capex0 > 0 ? `Les investissements pèsent ${eur(capex0)} la première année ; ils ne passent en charge que petit à petit.` : null,
        credits0 > 1000 ? `Les crédits d’impôt (${eur(credits0)}) comptent dans le résultat de l’année 1, mais ne sont encaissés que l’année suivante.` : null,
      ],
      plus: detail([
        fenetre < 60 ? h('figure', { class: 'as-figure' }, courbeTreso(bal, debut, { bas, sousZero, remonte: remonte >= 0 ? remonte : null }), h('figcaption', {}, 'Les cinq ans, mois par mois.')) : null,
        tableau(tetesAns(''), [
          ['Trésorerie en début d’année', ...ANS.map((y) => euro(y === 0 ? n(conso.parts.depart) : n(r.cash.yearEnd[y - 1])))],
          ['Flux de l’activité et des investissements', ...conso.activiteAn.map((v) => euro(v, { sign: true }))],
          ['Financement (apports, prêts, subventions, remboursements)', ...ANS.map((y) => euro(n(r.cash.yearEnd[y]) - (y === 0 ? n(conso.parts.depart) : n(r.cash.yearEnd[y - 1])) - conso.activiteAn[y], { sign: true }))],
          ['Trésorerie en fin d’année', ...ANS.map((y) => euro(n(r.cash.yearEnd[y])))],
          ['Résultat net', ...p.netResult.map((v) => euro(v))],
        ]),
      ], va('Voir le tableau de trésorerie', { route: 'resultats' }), navigate),
    }))
  }

  /* 08 — Besoin de financement ──────────────────────────────────────────── */
  {
    const f = s.financing || {}
    const x = conso.parts
    const besoin = n(k.fundingNeed)
    const quand = monthLabel(conso.mois, debut)
    const bank = lignesBanquier(r)
    const comptees = bank.filter((l) => l.etat !== 'na')
    const valides = comptees.filter((l) => l.etat === 'ok').length
    const apport = bank.find((l) => l.cle === 'apport')
    const avecMarge = Math.ceil((besoin * 1.2) / 1000) * 1000
    chapitres.push(chapitre({
      no: 8, titre: 'Besoin de financement', sousTitre: 'Les ressources nécessaires pour couvrir le besoin de trésorerie du scénario.',
      conclusion: conso.besoin <= 0
        ? `Le business ne consomme pas de trésorerie : les ventes financent l’activité dès le départ. Aucun financement supplémentaire n’est nécessaire dans ce scénario.`
        : [`Le business consomme ${eur(conso.besoin)} jusqu’à son point bas, en ${quand}.`,
          conso.ressources > 0 ? `Les ressources prévues en couvrent ${eur(Math.min(conso.ressources, conso.besoin))}.` : 'Aucune ressource n’est encore prévue.',
          besoin > 0 ? `Il faut donc financer ${euro(besoin)}.` : 'Aucun financement supplémentaire n’est nécessaire dans ce scénario.'].join(' '),
      repere: `Au point bas · ${quand}`,
      chiffres: [
        { l: 'Besoin total', v: eur(Math.max(0, conso.besoin)), note: 'Ce que l’activité consomme avant de se financer elle-même.' },
        { l: 'Ressources prévues', v: eur(conso.ressources), note: 'Trésorerie de départ, apports, prêts, subventions et levée déjà versés à cette date.' },
        { l: 'Reste à financer', v: euro(besoin), ton: besoin > 0 ? 'bad' : 'good', note: besoin > 0 ? `${eur(avecMarge)} avec une marge de sécurité de 20 %.` : 'Le plan est financé.' },
      ],
      dessin: conso.besoin > 0 ? cascade([
        { type: 'depart', l: 'Besoin total', v: conso.besoin },
        x.depart ? { l: 'Trésorerie déjà disponible', v: -x.depart, ton: 'couvre' } : null,
        x.fondateurs ? { l: 'Apport des fondateurs', v: -x.fondateurs, ton: 'couvre', def: somme(f.honourLoans) > 0 ? 'Prêts d’honneur compris' : null } : null,
        x.dette ? { l: 'Dette', v: -x.dette, ton: x.dette > 0 ? 'couvre' : null, def: 'Prêts et comptes courants, remboursements déduits' } : null,
        x.subventions ? { l: 'Subventions et avances', v: -x.subventions, ton: 'couvre' } : null,
        x.levee ? { l: 'Levée de fonds', v: -x.levee, ton: 'couvre' } : null,
        { type: 'total', l: besoin > 0 ? 'Reste à financer' : 'Marge au point bas', ton: besoin > 0 ? 'manque' : 'total' },
      ], `Au point bas · ${periodeMois(conso.mois, debut)}`) : null,
      clair: [
        apport && apport.etat !== 'na' ? `L’apport des fondateurs représente ${pct(apport.part, 0)} du projet.` : null,
        comptees.length && somme(f.loans) > 0 ? `${valides} contrôle${valides > 1 ? 's' : ''} bancaire${valides > 1 ? 's' : ''} sur ${comptees.length} ${valides > 1 ? 'sont validés' : 'est validé'}.` : null,
        besoin > 0 ? 'Le montant à demander se lit au point bas : c’est le mois où il manque le plus.' : conso.besoin > 0 ? `Au point bas, il reste ${eur(-conso.reste)} en caisse.` : null,
      ],
      plus: detail([
        tableau(['Ressource', 'Montant sur le plan', 'Versée'], [
          n(f.openingCash) > 0 ? ['Trésorerie de départ', euro(n(f.openingCash)), monthLabel(0, debut)] : null,
          ...(f.equityFounders || []).map((e) => ['Apport des fondateurs', euro(n(e.amount)), monthLabel(n(e.month), debut)]),
          ...(f.honourLoans || []).map((e) => ['Prêt d’honneur', euro(n(e.amount)), monthLabel(n(e.month), debut)]),
          ...(f.loans || []).map((e) => [`Prêt bancaire${e.rate ? ` à ${pct(n(e.rate), 2)}` : ''}${e.years || e.months ? `, ${e.years ? `${e.years} ans` : `${e.months} mois`}` : ''}`, euro(n(e.amount)), monthLabel(n(e.month), debut)]),
          ...(f.equityInvestors || []).map((e) => ['Levée de fonds', euro(n(e.amount)), monthLabel(n(e.month), debut)]),
          ...(f.grants || []).map((e) => ['Subvention', euro(n(e.amount)), monthLabel(n(e.month), debut)]),
          ...(f.advances || []).map((e) => ['Avance remboursable', euro(n(e.amount)), monthLabel(n(e.month), debut)]),
          ...(f.shareholderLoans || []).map((e) => ['Compte courant d’associé', euro(n(e.amount)), monthLabel(n(e.month), debut)]),
        ]),
        comptees.length ? h('ul', { class: 'as-bk' }, ...bank.map((l) => h('li', { class: `as-bk-ligne is-${l.etat}` },
          h('span', { class: 'as-bk-etat' }, l.etat === 'ok' ? 'Validé' : l.etat === 'juste' ? 'Juste' : l.etat === 'revoir' ? 'À revoir' : '—'),
          h('span', { class: 'as-bk-titre' }, l.titre),
          h('b', { class: 'as-bk-val' }, l.valeur),
        ))) : null,
      ], va('Modifier le financement', { route: 'financement', view: 'sources', anchor: 'sources' }), navigate),
    }))
  }

  /* 09 — Principales hypothèses ─────────────────────────────────────────── */
  {
    const sens = sensibilites(s, r, top)
    const besoin0 = n(k.fundingNeed), net0 = n(p.netResult[2])
    const parBesoin = [...sens].sort((a, b) => b.dBesoin - a.dBesoin || a.dNet - b.dNet)
    const parNet = [...sens].sort((a, b) => a.dNet - b.dNet)
    const surBesoin = parBesoin[0] && parBesoin[0].dBesoin >= 1000
    const lead = surBesoin ? parBesoin[0] : parNet[0]
    const ordre = (surBesoin ? parBesoin : parNet).filter((x) => (surBesoin ? x.dBesoin >= 1000 : x.dNet <= -1000))
    const peu = sens.filter((x) => Math.abs(x.dBesoin) < 1000 && Math.abs(x.dNet) < Math.max(1000, Math.abs(net0) * 0.02))
    const neutre = (x) => Math.abs(x.dNet) < Math.max(1000, Math.abs(net0) * 0.02)
    const tresoSeule = surBesoin ? ordre.filter(neutre) : []
    const resultat = surBesoin ? ordre.filter((x) => !neutre(x) && x.dNet < 0) : []
    const compte = (q) => (q === 1 ? 'Une hypothèse' : q === 2 ? 'Deux hypothèses' : q === 3 ? 'Trois hypothèses' : `${q} hypothèses`)
    chapitres.push(chapitre({
      no: 9, titre: 'Principales hypothèses', sousTitre: 'Les paramètres qui font le plus varier le besoin de financement et le résultat.',
      conclusion: !lead ? 'Les hypothèses se liront ici dès que le plan aura des ventes.'
        : surBesoin ? `Avec ${lead.dit}, le besoin de financement augmente de ${eur(lead.dBesoin)}. C’est l’hypothèse la plus sensible du plan.`
          : `Aucune des hypothèses testées ne crée de besoin de financement. La plus sensible, ${lead.dit}, réduit le résultat net de l’année 3 de ${eur(-lead.dNet)}.`,
      chiffres: !lead ? [] : [
        { l: 'Hypothèse la plus sensible', v: lead.nom, note: `Dans le plan : ${lead.plan}. Testée à ${lead.test}.` },
        { l: 'Besoin de financement', v: euro(lead.besoin), ton: lead.besoin > besoin0 ? 'bad' : null, note: `Contre ${euro(besoin0)} dans le plan.` },
        { l: 'Résultat net, année 3', v: eur(lead.net), ton: lead.net < 0 ? 'bad' : null, note: `Contre ${eur(net0)} dans le plan.` },
      ],
      dessin: sens.length ? barres(ordre.slice(0, 6).map((x) => ({ nom: x.nom, v: surBesoin ? x.dBesoin : -x.dNet, sous: `Plan : ${x.plan} · test : ${x.test}`, hyp: x })), {
        part: false, format: (v) => (surBesoin ? `+${eur(v)} de besoin` : `−${eur(v)} de résultat`),
        exact: (v) => (surBesoin ? `${euro(v, { sign: true })} de besoin de financement` : `${euro(-v)} de résultat net, année 3`),
        periode: surBesoin ? `Écart de besoin de financement · ${monthLabel(0, debut)} – ${monthLabel(59, debut)}` : `Écart de résultat net · ${periodeAnnee(2, debut)}`,
        detail: (b) => [
          { label: 'Besoin de financement', value: euro(b.hyp.besoin) },
          { label: 'Résultat net, année 3', value: euro(b.hyp.net) },
          { label: 'Point bas de trésorerie', value: `${euro(b.hyp.bas)} · ${monthLabel(b.hyp.mois, debut)}` },
        ],
      }) : null,
      clair: !lead ? [] : [
        // Les barres classent déjà les hypothèses ; la phrase dit ce qu'elles
        // ne montrent pas : lesquelles ne touchent que la trésorerie, et
        // lesquelles pèsent aussi sur le résultat.
        surBesoin && tresoSeule.length ? `${compte(tresoSeule.length)} ${tresoSeule.length > 1 ? 'déplacent' : 'déplace'} la trésorerie sans toucher au résultat : ${tresoSeule.map((x) => x.nom.toLowerCase()).join(', ')}. ${tresoSeule.length > 1 ? 'Elles se règlent' : 'Elle se règle'} par le financement ou les conditions de paiement.` : null,
        surBesoin && resultat.length ? `${resultat.length > 1 ? 'Celles qui changent' : 'Celle qui change'} aussi le résultat de l’année 3 ${resultat.length > 1 ? 'sont à étayer' : 'est à étayer'} en priorité : ${resultat.slice(0, 3).map((x) => x.nom.toLowerCase()).join(', ')}.` : null,
        peu.length ? `${peu.length > 1 ? 'Ces hypothèses changent' : 'Cette hypothèse change'} peu le plan : ${peu.map((x) => x.nom.toLowerCase()).join(', ')}.` : null,
      ],
      plus: !sens.length ? null : detail([
        tableau(['Hypothèse', 'Dans le plan', 'Test', 'Besoin de financement', 'Écart', 'Résultat net A3', 'Écart'], parBesoin.map((x) => [
          x.nom, x.plan, x.test, euro(x.besoin), euro(x.dBesoin, { sign: true }), euro(x.net), euro(x.dNet, { sign: true }),
        ])),
        h('p', { class: 'as-note' }, 'Chaque hypothèse est modifiée seule, tout le reste égal. Le moteur recalcule la paie, la TVA, l’impôt et la trésorerie de chaque variante.'),
      ], null, navigate),
    }))
  }

  const sommaire = h('nav', { class: 'as-sommaire', 'aria-label': 'Chapitres du récit' },
    ...chapitres.map((c, i) => h('button', {
      type: 'button',
      onClick: () => c.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }),
    }, h('b', {}, String(i + 1).padStart(2, '0')), c.querySelector('.as-titre')?.textContent || '')))

  return h('div', { class: 'as' }, sommaire, ...chapitres)
}

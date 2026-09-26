/**
 * Le pitch investisseur : l'essentiel du plan, en une page.
 *
 * Un business angel ou un fonds ne lit pas un prévisionnel de cinq ans ligne
 * à ligne. Il cherche sept réponses, dans cet ordre : ce que tu vends et à
 * qui, jusqu'où ça peut aller, comment chaque vente gagne de l'argent,
 * combien tu cherches et pour quoi faire, qui fait le travail, ce qui peut
 * mal tourner, et les quelques chiffres qu'il compare d'un dossier à l'autre.
 *
 * Cette page ne calcule rien : tout vient du moteur, comme le reste. Elle
 * range, et elle dit pour chaque chiffre pourquoi un investisseur le regarde
 * — un fondateur qui n'a jamais levé ne le sait pas, et c'est précisément
 * ce qu'on lui demandera d'expliquer.
 */

import { aOublier } from '../memoire.js'
import { telechargerPptx } from '../../export/fichiers.js'
import { resetDeck } from './deck.js'
import { mentionCourte } from '../../state/reperes.js'
import { h, svg, euro, pct, num, monthLabel, narrow } from '../dom.js'
import { barChart, entree } from '../charts.js'
import { storyline } from '../story.js'
import { trajectorySentence } from '../explain.js'
import store from '../../state/store.js'
import { SECTORS } from '../../state/schema.js'
import { goToGap } from '../spotlight.js'
import { exercices, grandsChiffres, anneeLue, lireAnnee } from '../sections.js'
import { barres, courbe, compter } from '../vitrine.js'
import { gardesDuPlan, gardeBloc } from '../garde.js'
import { renderStudio } from './studio.js'
import { analyseStrategique } from './analyse.js'
import { periodeAnnee, referenceYear } from '../../format.js'

const n = (v) => Number(v) || 0
const somme = (xs) => (xs || []).reduce((a, x) => a + n(x?.amount ?? x), 0)
const parAn = (m, y) => (m || []).slice(y * 12, y * 12 + 12).reduce((a, v) => a + n(v), 0)
/**
 * Un taux rapporté au chiffre d'affaires n'a de sens que si ce chiffre
 * d'affaires existe : « −188 046 % de marge » sur quelques euros de ventes
 * n'apprend rien et fait douter du reste. Au-delà de ±1 000 %, on dit
 * pourquoi on ne l'affiche pas.
 */
const taux = (v, ca) => (n(ca) <= 0 || Math.abs(n(v)) > 10 ? '—' : pct(n(v), 0))
const tauxDit = (v, ca, dit) => (n(ca) <= 0 || Math.abs(n(v)) > 10
  ? 'Trop peu de ventes cette année-là pour qu’un pourcentage veuille dire quelque chose.'
  : dit)

/** Pour les boutons d'action des avis. */
let navigateur = null
const ME = new RegExp('fondateur|dirigeant|g\\u00E9rant|moi', 'i')

const CLIENTS = { b2b: 'Des entreprises', b2c: 'Des particuliers', b2b2c: 'Des entreprises qui revendent à des particuliers' }

/**
 * Quatre façons de lire le même pitch.
 *
 * Les mêmes faits et les mêmes chiffres, sortis du même calcul ; ce qui
 * change d'une forme à l'autre, c'est l'écriture et le niveau de détail.
 * Chaque forme a été écrite en pensant à un lecteur — une équipe ou un
 * business angel pour le récit, un consultant en finance pour le tableau,
 * une salle qui a trois minutes pour les diapos, un fonds ou une banque pour
 * le détail —, mais aucun n'est nommé à l'écran, et personne n'y parle :
 *
 *   « Récit »     — une explication accessible et convaincante : cinq
 *                   chapitres, un diagnostic et une courbe chacun, puis
 *                   l'essentiel en mots simples ;
 *   « Diapos »    — une synthèse immédiate : une phrase et un chiffre par
 *                   diapositive, de quoi tenir un elevator pitch ;
 *   « En détail » — l'analyse approfondie : chaque chiffre expliqué, les
 *                   hypothèses du plan et ce qui les justifie.
 *
 * Le choix est retenu sur cet appareil.
 */
// « Tableau » a été retiré : sa lecture financière vit dans les états
// financiers et dans « En détail ». Les diapos ferment la rangée, avec leur
// téléchargement en PowerPoint juste à côté.
const MISES = [
  { key: 'recit', label: 'Récit', dit: 'le projet expliqué' },
  { key: 'detail', label: 'En détail', dit: 'hypothèses et justifications' },
  { key: 'diapos', label: 'Diapos', dit: 'l’essentiel à présenter' },
]
const CLE_MISE = 'fynomia:pitch-mise'
let mise = (() => { try { return localStorage.getItem(CLE_MISE) || 'recit' } catch { return 'recit' } })()
const choisirMise = (k) => { mise = k; try { localStorage.setItem(CLE_MISE, k) } catch { /* rien à retenir */ } }
// Revenir au tableau de bord, c'est revenir au récit : la première lecture.
aOublier((route) => { if (route === 'tableau-de-bord') choisirMise('recit') })

/** Le bouton se tait le temps de fabriquer le fichier : un second clic ne relance rien. */
async function telecharger(bouton) {
  if (bouton.disabled) return
  bouton.disabled = true
  bouton.classList.add('is-busy')
  try { await telechargerPptx() } finally { bouton.disabled = false; bouton.classList.remove('is-busy') }
}

export function renderPitch(navigate, refresh, goView) {
  navigateur = navigate
  const s = store.scenario
  const r = store.result
  if (!r) return h('p', {}, 'Aucun résultat.')
  if (!MISES.some((m) => m.key === mise)) mise = 'recit'
  const an = anneeLue(r)
  const choisir = (x) => { lireAnnee(x); refresh() }
  const garde = gardesDuPlan(s, r)
  const pilotage = () => (goView ? goView('pilotage') : navigate('#/tableau-de-bord'))

  // Changer de forme se voit : l'ancienne s'efface, la nouvelle se pose.
  const basculer = (k) => {
    if (k === mise) return
    choisirMise(k)
    if (document.startViewTransition && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.classList.add('is-bascule')
      const tr = document.startViewTransition(() => refresh())
      tr.finished.catch(() => {}).finally(() => document.documentElement.classList.remove('is-bascule'))
      tr.ready.catch(() => {})
      tr.updateCallbackDone.catch(() => {})
    } else refresh()
  }
  const selecteur = h('div', { class: 'pitch-mises', role: 'radiogroup', 'aria-label': 'Façon de lire le pitch' },
    h('span', { class: 'pitch-mises-l' }, 'Lire le pitch'),
    h('div', { class: 'pitch-mises-seg' },
      ...MISES.map((m) => h('button', {
        class: `pitch-mise ${m.key === mise ? 'is-on' : ''} is-${m.key}`, role: 'radio', 'aria-checked': String(m.key === mise),
        onClick: () => basculer(m.key),
      }, h('b', {}, m.label), h('span', {}, m.dit))),
    ),
    h('button', { class: 'pitch-pptx', type: 'button', title: 'Les diapositives, en fichier PowerPoint', 'aria-label': 'Télécharger le PowerPoint', onClick: (e) => telecharger(e.currentTarget) },
      h('span', { class: 'pitch-pptx-ico', 'aria-hidden': 'true' }, '↓'),
      h('span', {}, h('b', {}, 'PowerPoint'), h('span', {}, 'télécharger le .pptx'))),
  )

  // En détail : la synthèse complète, acte par acte — elle porte sa propre
  // tête de dossier.
  if (mise === 'detail') {
    return h('div', { class: 'pitch is-detail' }, selecteur, renderStudio(navigate, refresh, goView))
  }

  const parties = partiesDuPitch(s, r, navigate, an, choisir)
  return h('div', { class: `pitch is-${mise}` },
    selecteur,
    // L'avancement du dossier vit dans le Pilotage : le pitch montre
    // l'entreprise, pas la liste de ce qu'il reste à saisir.
    couverture(s, r, navigate),
    garde.length ? gardeBloc(garde, navigate, { classe: 'is-page' }) : null,
    mise === 'diapos' ? diapos(parties)
      // Un garde-fou qui doute du plan éteint le vert : rien ne se lit en succès.
      : analyseStrategique(s, r, navigate, { source: () => sourceRepere(), doute: garde.length > 0 }),
    h('div', { class: 'pitch-foot' },
      h('p', {}, 'Tous ces chiffres viennent du même calcul que les états financiers : un chiffre qui te surprend se corrige dans la page où il se saisit, et tout le pitch suit.'),
      h('div', { class: 'pitch-foot-go' },
        h('button', { class: 'sy-btn is-accent is-sm', onClick: () => { resetDeck(); navigate('#/presentation') } }, 'Présenter en plein écran'),
        h('button', { class: 'sy-btn is-line is-sm', onClick: () => goToGap({ route: 'resultats' }, navigate) }, 'Voir les états financiers'),
      ),
    ),
  )
}

/* ─────────── Petits dessins, pour le tableau et les diapositives ─────────── */

/** Cinq barres, sans axe : la pente d'un chiffre sur cinq ans. */
function miniBarres(vals) {
  const v = (vals || []).map(n)
  const hi = Math.max(1, ...v.map(Math.abs))
  return h('div', { class: 'pz-barres', 'aria-hidden': 'true' },
    ...v.map((x, i) => h('i', { class: x < 0 ? 'is-neg' : '', style: { height: `${Math.max(4, (Math.abs(x) / hi) * 100)}%`, '--i': String(i) } })))
}

/** Une courbe, sans axe : la trésorerie mois par mois. */
function miniCourbe(vals) {
  const v = (vals || []).map(n)
  if (!v.length) return null
  const W = 200, H = 56
  const hi = Math.max(0, ...v), lo = Math.min(0, ...v), span = hi - lo || 1
  const x = (i) => (i / Math.max(1, v.length - 1)) * W
  const y = (val) => 4 + (1 - (val - lo) / span) * (H - 8)
  const d = v.map((val, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(val).toFixed(1)}`).join(' ')
  return svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'pz-mini is-courbe', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    svg('line', { x1: 0, x2: W, y1: y(0), y2: y(0), class: 'pz-zero' }),
    svg('path', { d, class: 'pz-trait', pathLength: 1 }))
}

/** Une jauge : une part, et la fourchette du métier si on la connaît. */
function miniJauge(part, repere = null) {
  const p = Math.max(0, Math.min(1, n(part)))
  return h('div', { class: 'pz-jauge', 'aria-hidden': 'true' },
    repere ? h('span', { class: 'pz-jauge-rep', style: { left: `${repere[0] * 100}%`, width: `${(repere[1] - repere[0]) * 100}%` } }) : null,
    h('i', { style: { width: `${p * 100}%` } }))
}

/** Des parts côte à côte : les offres, ou l'usage de l'argent. */
function miniParts(parts) {
  const total = parts.reduce((t, x) => t + n(x.v), 0) || 1
  return h('div', { class: 'pz-parts', 'aria-hidden': 'true' },
    ...parts.filter((x) => n(x.v) > 0).map((x, i) => h('i', { class: `is-${i}`, style: { flexGrow: String(n(x.v) / total) }, title: x.nom })))
}

/**
 * Le contenu du pitch, partie par partie — le même pour les trois formes.
 *
 * Chaque partie porte : son nom, la phrase qui dit pourquoi on la lit
 * (`dit`), la phrase qui la raconte (`recit`), son chiffre (`chiffre`), un
 * petit dessin (`mini`), son contenu complet (`corps`) et l'avis de Fynomia.
 * Le récit lit la phrase, le tableau lit le chiffre et le dessin, les
 * diapositives lisent les deux en grand : même fond, trois formes.
 */
function partiesDuPitch(s, r, navigate, an, choisir) {
  const p = r.pnl
  const k = r.kpis
  const a = avis(s, r)
  const f = s.financing || {}
  const bas = k.cashLow || {}
  const manque = n(k.fundingNeed)
  const premier = k.firstProfitableYear
  const aPremier = premier !== null && premier !== undefined
  const a1 = n(p.revenue[0]), a5 = n(p.revenue[4])
  const cagr = a1 > 0 && a5 > 0 && a5 / a1 <= 1000 ? Math.pow(a5 / a1, 1 / 4) - 1 : null
  const marge = n(k.marginRate?.[2])
  const margeOk = n(p.revenue[2]) > 0 && Math.abs(marge) <= 10
  const mois = (k.breakEvenMonth || []).findIndex((m) => m)
  const offres = (s.activities || []).filter((x) => n(x.unitPrice) > 0 || n(x.recurringPrice) > 0)
  const total3 = (r.revenue?.perActivity || []).reduce((t, x) => t + parAn(x.total, 2), 0)
  const parts = (r.revenue?.perActivity || []).map((x, i) => ({ nom: s.activities?.[i]?.name || `Offre ${i + 1}`, v: parAn(x.total, 2) }))
  const phare = [...parts].sort((x, y) => y.v - x.v)[0]
  const phareOffre = (s.activities || []).find((x) => x.name === phare?.nom) || offres[0]
  const prixPhare = phareOffre ? (n(phareOffre.recurringPrice) > 0 ? `${euro(n(phareOffre.recurringPrice))} / mois` : `${num(n(phareOffre.unitPrice), n(phareOffre.unitPrice) < 100 ? 2 : 0)} €`) : '—'
  const finance = n(f.openingCash) + somme(f.equityFounders) + somme(f.equityInvestors) + somme(f.loans) + somme(f.shareholderLoans) + somme(f.advances) + somme(f.grants)
  const team = s.team || []
  const masse1 = Math.abs(n(p.payroll[0]))
  const bm = SECTORS[s.meta?.sectorKey]?.benchmarks || {}
  const usage = [
    { nom: 'Équipe', v: Math.abs(n(p.payroll[0])) },
    { nom: 'Frais de fonctionnement', v: Math.abs(n(p.external[0])) + Math.abs(n(p.duties[0])) },
    { nom: 'Achats liés aux ventes', v: Math.abs(n(p.variableCost[0])) },
    { nom: 'Investissements', v: parAn(r.capex?.spendMonthly, 0) },
  ]
  const risquesNoms = [
    manque > 0 ? 'la trésorerie qui passe sous zéro' : null,
    offres.length <= 1 ? 'une seule offre' : null,
    !aPremier ? 'pas de bénéfice sur cinq ans' : null,
    ...(SECTORS[s.meta?.sectorKey]?.traps || []).map((t) => t.title.toLowerCase()),
  ].filter(Boolean)

  const parties = [
    { cle: 'trajectoire', nom: 'La trajectoire sur cinq ans',
      dit: 'Ta trésorerie mois par mois, et les moments qui comptent : l’histoire qu’on lit en premier.',
      recit: trajectorySentence(r),
      chiffre: manque > 0 ? { v: euro(-manque), l: `au plus bas, en ${monthLabel(bas.month, r.startDate)}`, ton: 'bad' } : { v: eur(n(r.cash.yearEnd?.[4])), l: 'sur le compte en année 5', ton: 'good' },
      mini: () => miniCourbe(r.cash.balance),
      // La phrase de la trajectoire est son récit : chaque forme la montre
      // une fois, pas deux.
      corps: () => h('div', { class: 'pitch-traj' },
        h('div', { class: 'pitch-chart' }, storyline(r, s, { compact: narrow() })),
      ),
      avis: a.tresorerie, tuile: [8, 2] },
    { cle: 'offre', nom: 'Ce que tu vends, et à qui',
      dit: 'Si ça ne tient pas en deux phrases, le reste ne sera pas lu.',
      recit: String(s.meta?.pitch || '').trim() || (offres.length
        ? `Tu vends ${offres.length > 1 ? `${offres.length} produits, dont « ${phare?.nom} », ton produit phare` : `« ${offres[0].name || 'ton offre'} »`}, à ${prixPhare} hors taxes.`
        : 'Tu n’as pas encore chiffré ce que tu vends : commence par ton produit phare.'),
      chiffre: { v: prixPhare, l: phare ? `« ${phare.nom} », ton produit phare` : 'ton produit phare' },
      mini: () => miniParts(parts),
      corps: () => offresBloc(s, r, navigate), avis: a.offre, tuile: [4, 2] },
    { cle: 'croissance', nom: 'Jusqu’où ça peut aller',
      dit: 'La pente du chiffre d’affaires, et le moment où tu gagnes de l’argent.',
      recit: `De ${eur(a1)} de chiffre d’affaires la première année à ${eur(a5)} la cinquième${cagr !== null ? `, soit ${cagr >= 0 ? '+' : '−'}${pct(Math.abs(cagr), 0)} par an` : ''}. ${aPremier ? `Premier bénéfice en année ${premier + 1}.` : 'Pas de bénéfice sur cinq ans.'}`,
      chiffre: { v: eur(a5), l: 'de chiffre d’affaires en année 5' },
      mini: () => miniBarres(p.revenue),
      droite: exercices(an, choisir),
      corps: () => h('div', { class: 'pitch-croiss' },
        h('div', { class: 'pitch-chart' }, barChart({
          series: [{ label: 'Chiffre d’affaires', values: p.revenue.map(n), color: '#0E0F0C' }],
          line: { label: 'Résultat net', values: p.netResult.map(n), color: '#1B7F4B' },
          categories: ['A1', 'A2', 'A3', 'A4', 'A5'], height: 220,
          periodes: [0, 1, 2, 3, 4].map((i) => periodeAnnee(i, r.startDate)),
        })),
        grandsChiffres([
          { cle: 'ca', label: 'Chiffre d’affaires', valeurs: p.revenue, mensuel: r.revenue?.monthly, ton: () => 'none', note: () => croissance(p.revenue) },
          { cle: 'ebe', label: 'EBE', valeurs: p.ebe, ton: (v) => (v > 0 ? 'good' : v < 0 ? 'bad' : 'none'),
            note: (y) => (taux(n(p.ebe[y]) / (n(p.revenue[y]) || 1), p.revenue[y]) !== '—' ? `${pct(n(p.ebe[y]) / n(p.revenue[y]), 0)} du chiffre d’affaires.` : 'Avant amortissements, intérêts et impôts.') },
          { cle: 'net', label: 'Résultat net', valeurs: p.netResult, ton: (v) => (v > 0 ? 'good' : v < 0 ? 'bad' : 'none'),
            note: () => (aPremier ? `Premier bénéfice en année ${premier + 1}.` : 'Pas de bénéfice sur cinq ans.') },
          { cle: 'treso', label: 'Trésorerie à la clôture', valeurs: r.cash.yearEnd, mensuel: r.cash.balance, ton: (v) => (v < 0 ? 'bad' : 'good'), note: () => 'Au 31 décembre.' },
        ], an, choisir, { cle: 'pitch', compact: true, debut: r.startDate }),
      ),
      avis: a.trajectoire, tuile: [8, 2] },
    { cle: 'modele', nom: 'Comment chaque vente gagne de l’argent',
      dit: 'Ce qui reste sur chaque vente, et ce qu’un client rapporte face à ce qu’il coûte.',
      recit: margeOk && marge > 0
        ? `Sur 100 € vendus, il te reste ${Math.round(marge * 100)} € une fois payé ce que coûte la vente. ${mois >= 0 ? `Tes ventes couvrent tous tes frais à partir de l’année ${mois + 1}.` : 'Sur cinq ans, elles ne couvrent jamais tous tes frais.'}`
        : 'Tes ventes ne couvrent pas encore ce qu’elles coûtent : c’est le premier chiffre à corriger.',
      chiffre: { v: margeOk ? pct(marge, 0) : '—', l: 'de marge brute en année 3', ton: margeOk && bm.grossMargin && marge < bm.grossMargin[0] ? 'bad' : '' },
      mini: () => miniJauge(margeOk ? marge : 0, bm.grossMargin),
      corps: () => modele(s, r), avis: a.modele, tuile: [4, 2] },
    { cle: 'besoin', nom: 'Ce que tu cherches à financer',
      dit: 'Combien, jusqu’à quand, pour quoi faire : la somme doit mener à une étape.',
      recit: manque > 0
        ? `Il te faut ${eur(manque)} sur le compte avant ${monthLabel(bas.month, r.startDate)} ; tu as déjà réuni ${eur(finance)}.`
        : `Ton plan se finance avec ce que tu as réuni : ${eur(finance)}.`,
      chiffre: manque > 0 ? { v: eur(manque), l: 'à trouver au point bas', ton: 'bad' } : { v: 'Aucun', l: 'besoin de financement', ton: 'good' },
      mini: () => miniParts(usage),
      corps: () => besoin(s, r, navigate), avis: a.besoin, tuile: [6, 1] },
    { cle: 'equipe', nom: 'Qui fait le travail',
      dit: 'Qui est là au départ, qui arrive ensuite, et ce que ça coûte.',
      recit: team.length
        ? `${team.length} poste${team.length > 1 ? 's' : ''}, ${eur(masse1)} de salaires et de cotisations la première année.`
        : 'Aucun poste saisi : on voudra savoir qui fait le travail.',
      chiffre: { v: String(team.length), l: `poste${team.length > 1 ? 's' : ''} · ${eur(masse1)} en année 1` },
      mini: () => miniBarres(p.payroll.map((x) => Math.abs(n(x)))),
      corps: () => equipe(s, r), avis: a.equipe, tuile: [6, 1] },
    { cle: 'risques', nom: 'Ce qui pourrait mal tourner',
      dit: 'Un dossier qui nomme ses risques rassure plus qu’un dossier qui les tait.',
      recit: risquesNoms.length ? `Les risques à nommer toi-même : ${risquesNoms.slice(0, 3).join(', ')}.` : 'Aucun risque particulier dans les chiffres.',
      chiffre: { v: String(Math.min(5, risquesNoms.length)), l: 'risques à nommer' },
      mini: () => h('div', { class: 'pz-points', 'aria-hidden': 'true' }, ...risquesNoms.slice(0, 5).map(() => h('i'))),
      corps: () => risques(s, r), avis: a.risques, tuile: [6, 1] },
    { cle: 'ratios', nom: 'Les chiffres à connaître par cœur',
      dit: 'Ceux qu’on compare d’un dossier à l’autre.',
      recit: 'Huit chiffres à savoir par cœur : chiffre d’affaires, croissance, marges, EBITDA, premier bénéfice, besoin et autonomie.',
      chiffre: { v: mois >= 0 ? `Année ${mois + 1}` : 'Pas atteint', l: 'le point mort' },
      mini: () => null,
      corps: () => ratios(s, r), avis: a.ratios, tuile: [6, 1] },
  ]

  // Les mêmes faits, écrits pour chaque forme. Le tableau les donne en
  // métriques exactes — la période, la base de calcul — ; les diapositives
  // en une phrase qu'on peut dire d'une traite.
  const yr = referenceYear(r)
  const pm = n(k.breakEven?.[yr]), caY = n(p.revenue[yr])
  const securite = caY > 0 && pm > 0 ? (caY - pm) / caY : null
  const partPhare = total3 > 0 && phare ? phare.v / total3 : null
  const autonomie = k.runwayMonths === null || k.runwayMonths === undefined ? null : n(k.runwayMonths)
  const ca3 = n(p.revenue[2])
  const masse3 = Math.abs(n(p.payroll[2]))
  const signe = (v) => (v >= 0 ? '+' : '\u2212')
  const pct1 = (v) => pct(v, 1)
  const moisBas = monthLabel(n(bas.month), r.startDate)
  const pluriel = (q, mot) => `${q} ${mot}${q > 1 ? 's' : ''}`
  const rentable = aPremier ? `rentable dès l’année ${premier + 1}` : 'sans bénéfice sur cinq ans'
  const formes = {
    trajectoire: {
      constat: manque > 0 ? `Besoin de trésorerie de ${euro(manque)} au point bas (${moisBas}, mois ${n(bas.month) + 1}).`
        : `Trésorerie positive sur les soixante mois ; ${euro(n(r.cash.yearEnd?.[4]))} à la clôture de l’année 5.`,
      fiche: [
        { l: 'Point bas de trésorerie', v: euro(n(bas.value)), b: `${moisBas} · mois ${n(bas.month) + 1}` },
        { l: 'Trésorerie à la clôture A5', v: euro(n(r.cash.yearEnd?.[4])), b: `fin ${monthLabel(59, r.startDate)}` },
        { l: 'Premier exercice bénéficiaire', v: aPremier ? `Année ${premier + 1}` : 'Aucun sur 5 ans', b: aPremier ? `résultat net ${euro(n(p.netResult[premier]))}` : '' },
      ],
      pitch: `${eur(a5)} de chiffre d’affaires en année 5, ${rentable}${manque > 0 ? ` : il faut ${eur(manque)} avant ${moisBas}.` : ', sans besoin de financement.'}`,
    },
    offre: {
      constat: phare ? `« ${phare.nom} » : ${partPhare !== null ? `${pct1(partPhare)} du chiffre d’affaires de l’année 3, ` : ''}à ${prixPhare} HT.` : 'Aucune offre tarifée.',
      fiche: [
        { l: 'Offre principale', v: phare ? `« ${phare.nom} »` : '—', b: phare ? `${prixPhare} HT` : '' },
        { l: 'Part du chiffre d’affaires A3', v: partPhare !== null ? pct1(partPhare) : '—', b: partPhare !== null ? `${euro(phare.v)} sur ${euro(total3)}` : '' },
        { l: 'Offres tarifées', v: String(offres.length) },
      ],
      pitch: String(s.meta?.pitch || '').trim()
        || (phare ? `« ${phare.nom} », à ${prixPhare} HT${partPhare !== null ? ` : ${pct(partPhare, 0)} des ventes` : ''}.` : 'Ce que tu vends reste à chiffrer.'),
    },
    croissance: {
      constat: `Chiffre d’affaires de ${euro(a1)} en année 1 et de ${euro(a5)} en année 5${cagr !== null ? `, soit une croissance annuelle moyenne de ${signe(cagr)}${pct1(Math.abs(cagr))}` : ''}.`,
      fiche: [
        { l: 'Chiffre d’affaires A1 → A5', v: `${euro(a1)} → ${euro(a5)}` },
        { l: 'Croissance annuelle moyenne', v: cagr !== null ? `${signe(cagr)}${pct1(Math.abs(cagr))}` : '—', b: '(CA A5 ÷ CA A1) puissance ¼, moins 1' },
        { l: 'Résultat net A5', v: euro(n(p.netResult[4])), b: n(p.revenue[4]) > 0 ? `marge nette ${taux(k.netMargin?.[4], p.revenue[4]) === '—' ? '—' : pct1(n(k.netMargin?.[4]))}` : '' },
      ],
      pitch: `De ${eur(a1)} à ${eur(a5)} de chiffre d’affaires en cinq ans${cagr !== null ? ` : ${signe(cagr)}${pct(Math.abs(cagr), 0)} par an` : ''}.`,
    },
    modele: {
      constat: margeOk ? `Taux de marge brute de ${pct1(marge)} en année 3${bm.grossMargin ? `, pour un repère métier de ${pct(bm.grossMargin[0], 0)} à ${pct(bm.grossMargin[1], 0)}` : ''}.`
        : 'Taux de marge brute non significatif : chiffre d’affaires insuffisant en année 3.',
      fiche: [
        { l: 'Marge brute A3', v: euro(n(p.grossMargin[2])), b: margeOk ? `${pct1(marge)} de ${euro(ca3)}` : '' },
        { l: 'Point mort', v: mois >= 0 ? `Année ${mois + 1}, mois ${k.breakEvenMonth[mois]}` : 'Non atteint', b: mois >= 0 ? `seuil de ${euro(n(k.breakEven[mois]))} de chiffre d’affaires` : '' },
        bm.grossMargin ? { l: 'Repère du métier', v: `${pct(bm.grossMargin[0], 0)} – ${pct(bm.grossMargin[1], 0)}`, b: 'taux de marge brute' } : null,
      ],
      pitch: margeOk && marge > 0 ? `${Math.round(marge * 100)} € gardés sur 100 € vendus ; ${mois >= 0 ? `tous les frais couverts dès l’année ${mois + 1}` : 'les frais ne sont pas encore couverts'}.`
        : 'Les ventes ne couvrent pas encore ce qu’elles coûtent.',
    },
    besoin: {
      constat: manque > 0 ? `Besoin de financement de ${euro(manque)} au point bas (${moisBas}) ; ressources réunies : ${euro(finance)}.`
        : `Aucun besoin de financement ; ressources réunies : ${euro(finance)}.`,
      fiche: [
        { l: 'Besoin de financement', v: manque > 0 ? euro(manque) : 'Aucun', b: manque > 0 ? `point bas, ${moisBas}` : '' },
        { l: 'Ressources réunies', v: euro(finance), b: 'apports, emprunts, levées, aides' },
        { l: 'Autonomie', v: autonomie === null ? 'Illimitée' : `${num(autonomie, 1)} mois`, b: 'au rythme de dépense actuel' },
      ],
      pitch: manque > 0 ? `${eur(manque)} à trouver avant ${moisBas} ; ${eur(finance)} déjà réunis.` : `Aucun financement à trouver : les ${eur(finance)} réunis suffisent.`,
    },
    equipe: {
      constat: team.length ? `${pluriel(team.length, 'poste')} ; charges de personnel de ${euro(masse1)} en année 1${ca3 > 0 && masse3 / ca3 <= 10 ? `, soit ${pct1(masse3 / ca3)} du chiffre d’affaires en année 3` : ''}.` : 'Aucun poste saisi.',
      fiche: [
        { l: 'Postes', v: String(team.length) },
        { l: 'Charges de personnel A1', v: euro(masse1), b: 'salaires et cotisations' },
        { l: 'Masse salariale / CA A3', v: ca3 > 0 && masse3 / ca3 <= 10 ? pct1(masse3 / ca3) : '—', b: bm.payrollRatio ? `repère du métier ${pct(bm.payrollRatio[0], 0)} – ${pct(bm.payrollRatio[1], 0)}` : '' },
      ],
      pitch: team.length ? `${pluriel(team.length, 'poste')}, ${eur(masse1)} de salaires la première année.` : 'L’équipe reste à constituer.',
    },
    risques: {
      constat: `${pluriel(Math.min(5, risquesNoms.length), 'risque')} relevé${risquesNoms.length > 1 ? 's' : ''} par le modèle${partPhare !== null ? ` ; ${pct1(partPhare)} du chiffre d’affaires de l’année 3 repose sur « ${phare.nom} »` : ''}.`,
      fiche: [
        { l: 'Risques relevés', v: String(Math.min(5, risquesNoms.length)), b: risquesNoms.slice(0, 2).join(' ; ') },
        { l: 'Marge de sécurité', v: securite !== null && Math.abs(securite) <= 10 ? pct1(securite) : '—', b: `année ${yr + 1} · (CA − point mort) ÷ CA` },
        partPhare !== null ? { l: 'Concentration du CA A3', v: pct1(partPhare), b: `sur « ${phare.nom} »` } : null,
      ],
      pitch: risquesNoms.length ? `Premier risque, nommé d’emblée : ${risquesNoms[0]}.` : 'Aucun risque particulier dans les chiffres.',
    },
    ratios: {
      constat: `EBE de ${euro(n(p.ebe[2]))} en année 3${taux(k.ebeMargin?.[2], p.revenue[2]) !== '—' ? ` (${pct1(n(k.ebeMargin?.[2]))} du chiffre d’affaires)` : ''} ; point mort ${mois >= 0 ? `en année ${mois + 1}` : 'non atteint'}.`,
      fiche: [
        { l: 'EBE A3', v: euro(n(p.ebe[2])), b: 'valeur ajoutée + subventions − impôts et taxes − personnel' },
        { l: 'EBITDA A3', v: euro(n(p.ebitda[2])), b: 'résultat d’exploitation + amortissements' },
        { l: 'Premier exercice bénéficiaire', v: aPremier ? `Année ${premier + 1}` : 'Aucun sur 5 ans' },
      ],
      pitch: `Point mort ${mois >= 0 ? `en année ${mois + 1}` : 'non atteint'}${taux(k.ebeMargin?.[2], p.revenue[2]) !== '—' ? `, marge d’EBE de ${taux(k.ebeMargin?.[2], p.revenue[2])} en année 3` : ''}.`,
    },
  }
  return parties.map((x) => ({ ...x, ...(formes[x.cle] || {}) }))
}

/** Les métriques d'une partie : l'intitulé, la valeur exacte, la période ou la base de calcul. */
function fiche(lignes) {
  const l = (lignes || []).filter(Boolean)
  if (!l.length) return null
  return h('dl', { class: 'pz-fiche' },
    ...l.map((x) => h('div', { class: 'pz-fiche-l' },
      h('dt', {}, x.l),
      h('dd', {}, h('b', { class: 'num' }, insecable(x.v)), x.b ? h('small', {}, x.b) : null),
    )))
}

/**
 * Diapos : le deck qu'on présentera.
 *
 * Une idée par diapositive, au format d'un écran : le titre et la phrase en
 * grand, le chiffre qui la porte, l'image ; l'avis de Fynomia en bas, comme
 * une note d'orateur. Les flèches du clavier font défiler.
 */
const diapo = { i: 0 }

/**
 * Les chapitres du deck : quatre intercalaires, sombres, qui annoncent qu'on
 * change de partie. Tout le reste est blanc.
 */
const CHAPITRES_DECK = [
  { titre: 'Le projet', dit: 'Ce que tu vends, à qui, et l’histoire des cinq prochaines années.', parties: ['trajectoire', 'offre'] },
  { titre: 'L’économie', dit: 'Jusqu’où ça peut aller, et ce que chaque vente rapporte.', parties: ['croissance', 'modele'] },
  { titre: 'Le financement', dit: 'Ce qu’il faut réunir, et qui fait le travail.', parties: ['besoin', 'equipe'] },
  { titre: 'Les risques et les chiffres', dit: 'Ce qui peut mal tourner, et les chiffres à connaître par cœur.', parties: ['risques', 'ratios'] },
]

function diapos(parties) {
  const deja = new Set()
  const suite = []
  CHAPITRES_DECK.forEach((c, k) => {
    const dedans = c.parties.map((cle) => parties.find((x) => x.cle === cle)).filter(Boolean)
    if (!dedans.length) return
    suite.push({ inter: true, no: k + 1, ...c, noms: dedans.map((x) => x.nom) })
    dedans.forEach((x) => { deja.add(x.cle); suite.push({ x }) })
  })
  parties.filter((x) => !deja.has(x.cle)).forEach((x) => suite.push({ x }))
  const total = suite.length
  if (diapo.i >= total) diapo.i = 0
  let rang = 0
  const piste = h('div', { class: 'pitch-piste', tabindex: '0', 'aria-label': 'Diapositives du pitch' },
    ...suite.map((d, i) => {
      if (d.inter) {
        return h('section', { class: 'pitch-diapo is-intercalaire', 'data-chapitre': String(d.no), 'aria-label': `${i + 1} sur ${total} : ${d.titre}` },
          h('div', { class: 'pz-inter' },
            h('span', { class: 'pz-inter-no' }, String(d.no).padStart(2, '0')),
            h('h3', { class: 'pz-inter-titre' }, d.titre),
            h('p', { class: 'pz-inter-dit' }, d.dit),
            h('div', { class: 'pz-inter-liste' }, ...d.noms.map((nm) => h('span', {}, nm))),
          ),
        )
      }
      const x = d.x
      rang += 1
      return h('section', { class: 'pitch-diapo is-clair', 'data-partie': x.cle, 'aria-label': `${i + 1} sur ${total} : ${x.nom}` },
        h('div', { class: 'pz-diapo-haut' },
          h('span', { class: 'pitch-diapo-no' }, `${String(rang).padStart(2, '0')} / ${String(parties.length).padStart(2, '0')}`),
          x.droite ? h('div', { class: 'pitch-tuile-droite' }, x.droite) : null,
        ),
        h('div', { class: 'pz-diapo-grille' },
          h('div', { class: 'pz-diapo-texte' },
            h('h3', {}, x.nom),
            h('p', { class: 'pz-diapo-recit' }, insecable(x.pitch || x.recit)),
            h('div', { class: 'pz-diapo-chiffre' },
              h('b', { class: x.chiffre?.ton ? `is-${x.chiffre.ton}` : '' }, insecable(x.chiffre?.v ?? '—')),
              h('span', {}, x.chiffre?.l || ''),
            ),
          ),
          h('div', { class: 'pz-diapo-visuel' }, x.corps()),
        ),
        h('footer', { class: 'pz-note' },
          h('span', { class: 'avis-mono', 'aria-hidden': 'true' }, 'F'),
          h('div', {},
            h('b', {}, 'Note d’orateur · ', TONS[x.avis?.ton || 'good']),
            h('p', {}, insecable(x.avis?.titre || '')),
            x.avis?.question ? h('p', { class: 'pz-note-q' }, 'Question à préparer : ', insecable(x.avis.question)) : null,
          ),
        ),
      )
    }))
  const barre = h('div', { class: 'pz-progres', 'aria-hidden': 'true' }, h('i', { style: { width: `${((diapo.i + 1) / total) * 100}%` } }))
  const points = h('div', { class: 'pitch-points' },
    ...suite.map((d, i) => {
      const nm = d.inter ? d.titre : d.x.nom
      return h('button', { class: `pitch-point ${d.inter ? 'is-inter' : ''} ${i === diapo.i ? 'is-on' : ''}`, 'aria-label': nm, title: nm, onClick: () => aller(i) })
    }))
  const compteur = h('span', { class: 'pitch-compteur' }, `${diapo.i + 1} / ${total}`)
  const aller = (i) => {
    diapo.i = Math.max(0, Math.min(total - 1, i))
    piste.scrollTo({ left: diapo.i * piste.clientWidth, behavior: 'smooth' })
  }
  const suivre = () => {
    const i = Math.round(piste.scrollLeft / Math.max(1, piste.clientWidth))
    if (i === diapo.i && compteur.textContent === `${i + 1} / ${total}`) return
    diapo.i = i
    compteur.textContent = `${i + 1} / ${total}`
    barre.firstChild.style.width = `${((i + 1) / total) * 100}%`
    points.querySelectorAll('.pitch-point').forEach((b, k) => b.classList.toggle('is-on', k === i))
  }
  piste.addEventListener('scroll', () => requestAnimationFrame(suivre), { passive: true })
  piste.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); aller(diapo.i + 1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); aller(diapo.i - 1) }
  })
  // Un redessin (changer d'exercice) garde la diapositive ouverte.
  requestAnimationFrame(() => { if (diapo.i) piste.scrollLeft = diapo.i * piste.clientWidth })
  const deck = h('div', { class: 'pitch-deck' },
    barre,
    piste,
    h('div', { class: 'pitch-nav' },
      h('button', { class: 'pitch-fleche', 'aria-label': 'Diapositive précédente', onClick: () => aller(diapo.i - 1) }, '←'),
      points,
      compteur,
      h('button', { class: 'pitch-fleche', 'aria-label': 'Diapositive suivante', onClick: () => aller(diapo.i + 1) }, '→'),
      h('button', { class: 'pz-plein', type: 'button', onClick: () => deck.requestFullscreen?.().catch(() => {}) }, 'Plein écran'),
    ),
  )
  return deck
}

/**
 * La couverture, dans le style de « ton business prend forme ».
 *
 * La page vue au sortir du parcours avait ce que le pitch n'avait pas : le
 * nom en grand, cinq ans de chiffre d'affaires qui montent, la trésorerie
 * tracée d'un trait, des montants qui comptent jusqu'à leur valeur. Le
 * pitch s'ouvre maintenant ainsi — et se joue quand on arrive dessus.
 */
/** Ce que la couverture annonce : la forme qu'on lit, pas un lecteur. */
const ACCROCHES = { recit: 'le projet expliqué', detail: 'le dossier complet', diapos: 'l’essentiel à présenter' }
function couverture(s, r, navigate) {
  const nom = s.meta?.company || s.meta?.name || 'Ton projet'
  const phrase = String(s.meta?.pitch || '').trim()
  const metier = s.meta?.activityLabel || SECTORS[s.meta?.sectorKey]?.label || ''
  const leve = somme(s.financing?.equityInvestors)
  const p = r.pnl, k = r.kpis
  const besoin = n(k.fundingNeed)
  const premier = k.firstProfitableYear
  const figs = [
    { l: 'Chiffre d’affaires en année 5', v: n(p.revenue[4]) },
    { l: 'Premier bénéfice', t: premier !== null && premier !== undefined ? `Année ${premier + 1}` : 'Au-delà de 5 ans' },
    { l: 'Marge brute, année 3', t: taux(k.marginRate?.[2], p.revenue[2]) },
    { l: 'Autonomie', t: k.runwayMonths === null || k.runwayMonths === undefined ? 'Illimitée' : `${num(n(k.runwayMonths), 0)} mois` },
  ]
  const el = h('section', { class: 'pitch-cover pitch-hero' },
    h('div', { class: 'rvl-glow', 'aria-hidden': 'true' }),
    h('div', { class: 'pitch-hero-top' },
      h('span', { class: 'rvl-kicker', style: { '--d': '0s' } }, `Pitch · ${ACCROCHES[mise] || ACCROCHES.recit}`),
      h('span', { class: 'sy-live' }, h('i', { 'aria-hidden': 'true' }), 'Live'),
    ),
    h('h2', { class: 'rvl-name pitch-hero-name' },
      ...nom.split(' ').filter(Boolean).map((mot, i) => h('span', { style: { '--d': `${0.1 + i * 0.08}s` } }, mot))),
    phrase
      ? h('p', { class: 'rvl-phrase pitch-phrase', style: { '--d': '.35s' } }, phrase)
      : h('button', { class: 'pitch-manque rvl-phrase', style: { '--d': '.35s' }, onClick: () => goToGap({ route: 'projet', anchor: 'pitch' }, navigate) },
          'Écris en une phrase ce que tu vends et à qui : c’est la première chose qu’on lira. Y aller →'),
    h('div', { class: 'pitch-meta' },
      metier ? h('span', {}, metier) : null,
      s.meta?.legalForm ? h('span', {}, s.meta.legalForm) : null,
      h('span', {}, `Démarrage ${monthLabel(0, r.startDate)}`),
    ),
    h('div', { class: 'pitch-hero-grid' },
      h('figure', { class: 'rvl-chart', style: { '--d': '.5s' } },
        h('figcaption', {}, h('b', {}, 'Chiffre d’affaires'), ' année par année'),
        barres(p.revenue, { debut: r.startDate }),
      ),
      h('figure', { class: 'rvl-chart', style: { '--d': '.7s' } },
        h('figcaption', {}, h('b', {}, 'Trésorerie'), ' mois par mois'),
        courbe(r.cash.balance, k.cashLow, r.startDate),
      ),
      h('div', { class: 'pitch-ask rvl-fig', style: { '--d': '.9s' } },
        h('span', {}, leve > 0 ? 'Levée prévue' : besoin > 0 ? 'Il manque au point bas' : 'Besoin de financement'),
        h('b', {}, leve > 0 ? euro(leve) : besoin > 0 ? euro(besoin) : 'Aucun'),
        h('small', {}, leve > 0
          ? (besoin > 0 ? `et il manque encore ${euro(besoin)} au point bas` : 'le plan tient avec cette levée')
          : besoin > 0 ? `avant ${monthLabel(k.cashLow.month, r.startDate)}` : 'la trésorerie reste positive sur cinq ans'),
      ),
    ),
    h('div', { class: 'rvl-figs' },
      ...figs.map((c, i) => h('div', { class: 'rvl-fig', style: { '--d': `${1.1 + i * 0.12}s` } },
        h('span', { class: 'rvl-fig-l' }, c.l),
        h('b', { class: 'rvl-fig-v', 'data-compte': c.v > 0 ? String(c.v) : null }, c.t || euro(c.v || 0, { compact: (c.v || 0) >= 100000 })),
      )),
    ),
  )
  // Joué une fois, quand on arrive dessus ; les montants comptent alors.
  const vu = entree(el, 'pitch-hero', { classe: 'rv', min: 0.2 })
  const garde = new MutationObserver(() => {
    if (el.classList.contains('is-play')) { garde.disconnect(); compter(el) }
  })
  garde.observe(el, { attributes: true, attributeFilter: ['class'] })
  return vu
}

/** « ×4,2 en cinq ans, soit +43 % par an en moyenne ». */
function croissance(ca) {
  const a = n(ca[0]), b = n(ca[4])
  if (a <= 0 || b <= 0) return 'Hors taxes.'
  const x = b / a
  const annuel = Math.pow(x, 1 / 4) - 1
  if (x > 1000) return 'Le chiffre d’affaires de l’année 1 est trop faible pour qu’un multiple veuille dire quelque chose.'
  return `×${num(x, 1)} en cinq ans, soit ${annuel >= 0 ? '+' : '−'}${pct(Math.abs(annuel), 0)} par an en moyenne.`
}

function offresBloc(s, r, navigate) {
  const acts = s.activities || []
  const y = 2
  const total = (r.revenue?.perActivity || []).reduce((t, a) => t + parAn(a.total, y), 0)
  return h('div', { class: 'pitch-offres' },
    h('div', { class: 'pitch-client' },
      h('span', {}, 'Tes clients'),
      h('b', {}, CLIENTS[s.meta?.clientType] || 'À préciser dans Mon projet'),
    ),
    ...acts.map((a, i) => {
      const part = total > 0 ? parAn(r.revenue?.perActivity?.[i]?.total, y) / total : 0
      const abo = n(a.recurringPrice) > 0
      const prix = abo ? `${euro(n(a.recurringPrice))} par mois` : `${num(n(a.unitPrice), n(a.unitPrice) < 100 ? 2 : 0)} € l’unité`
      return h('article', { class: 'pitch-offre' },
        h('div', { class: 'pitch-offre-nom' }, a.name || `Offre ${i + 1}`),
        h('div', { class: 'pitch-offre-prix' }, prix, h('span', {}, ' HT')),
        h('div', { class: 'pitch-offre-part' },
          h('i', { style: { width: `${Math.round(part * 100)}%` } })),
        h('div', { class: 'pitch-offre-note' }, total > 0 ? `${pct(part, 0)} du chiffre d’affaires en année 3` : 'Aucune vente prévue en année 3'),
      )
    }),
    acts.length ? null : h('button', { class: 'pitch-manque', onClick: () => goToGap({ route: 'offre' }, navigate) }, 'Aucune offre : commence par là →'),
  )
}

/** Un fait chiffré : le libellé, la valeur, et ce qu'un investisseur en déduit. */
const fait = (label, valeur, dit, ton = '') => h('div', { class: `pitch-fait ${ton}` },
  h('span', { class: 'pitch-fait-label' }, label),
  h('b', { class: 'pitch-fait-val' }, valeur),
  h('p', { class: 'pitch-fait-dit' }, dit),
)

function modele(s, r) {
  const p = r.pnl, k = r.kpis
  const y = 2
  const recurrent = (r.revenue?.perActivity || []).reduce((t, a) => t + parAn(a.recurring, y), 0)
  const partRec = n(p.revenue[y]) > 0 ? recurrent / n(p.revenue[y]) : 0
  const mois = (k.breakEvenMonth || []).findIndex((m) => m)
  const ltv = n(k.ltv), cac = n(k.cac)
  return h('div', { class: 'pitch-faits' },
    fait('Marge brute, année 3', taux(k.marginRate?.[y], p.revenue[y]),
      tauxDit(k.marginRate?.[y], p.revenue[y], 'Ce qui reste sur chaque euro vendu, après ce que coûte la vente. Au-dessus de 70 %, chaque client supplémentaire rapporte beaucoup ; sous 30 %, il faut du volume.')),
    fait('Point mort', mois >= 0 ? `Année ${mois + 1}, mois ${k.breakEvenMonth[mois]}` : 'Pas atteint',
      mois >= 0 ? `Le moment où les ventes de l’année couvrent tous les frais : ${euro(n(k.breakEven[mois]))} de chiffre d’affaires cette année-là.` : 'Sur cinq ans, les ventes ne couvrent jamais tous les frais : c’est la première chose qu’on te demandera d’expliquer.',
      mois >= 0 ? 'is-good' : 'is-bad'),
    partRec > 0 ? fait('Revenu récurrent, année 3', pct(partRec, 0),
      'La part du chiffre d’affaires qui revient chaque mois sans nouvelle vente. Plus elle est haute, plus le plan est prévisible — et mieux il se valorise.') : null,
    ltv > 0 && cac > 0 ? fait('Valeur d’un client / coût pour le trouver', `${num(ltv / cac, 1)} ×`,
      `Un client rapporte ${euro(ltv)} sur toute sa durée de vie et coûte ${euro(cac)} à acquérir. En dessous de 3, la croissance coûte plus qu’elle ne rapporte.`,
      ltv / cac >= 3 ? 'is-good' : 'is-bad') : null,
    fait('Marge d’EBE, année 3', taux(k.ebeMargin?.[y], p.revenue[y]),
      tauxDit(k.ebeMargin?.[y], p.revenue[y], 'La part du chiffre d’affaires que l’activité garde une fois l’équipe et les frais payés. C’est elle qui dit si le modèle devient rentable en grandissant.'),
      taux(k.ebeMargin?.[y], p.revenue[y]) === '—' ? '' : n(k.ebeMargin?.[y]) > 0 ? 'is-good' : 'is-bad'),
  )
}

function besoin(s, r, navigate) {
  const p = r.pnl, k = r.kpis
  const f = s.financing || {}
  const apports = n(f.openingCash) + somme(f.equityFounders)
  const leve = somme(f.equityInvestors)
  const dettes = somme(f.loans) + somme(f.shareholderLoans) + somme(f.advances)
  const aides = somme(f.grants)
  const manque = n(k.fundingNeed)
  // À quoi sert l'argent : les dépenses de la première année, poste par poste.
  const postes = [
    { nom: 'Équipe', v: Math.abs(n(p.payroll[0])) },
    { nom: 'Frais de fonctionnement', v: Math.abs(n(p.external[0])) + Math.abs(n(p.duties[0])) },
    { nom: 'Achats liés aux ventes', v: Math.abs(n(p.variableCost[0])) },
    { nom: 'Investissements', v: parAn(r.capex?.spendMonthly, 0) },
  ].filter((x) => x.v > 0)
  const total = postes.reduce((t, x) => t + x.v, 0) || 1
  return h('div', { class: 'pitch-besoin' },
    h('div', { class: 'pitch-faits' },
      fait('Déjà réuni', euro(apports + leve + dettes + aides),
        [apports ? `${euro(apports)} d’apport` : null, leve ? `${euro(leve)} de levée` : null, dettes ? `${euro(dettes)} d’emprunts` : null, aides ? `${euro(aides)} de subventions` : null].filter(Boolean).join(', ') || 'Aucune source de financement saisie.'),
      fait('Il manque au point bas', manque > 0 ? euro(manque) : 'Rien',
        manque > 0 ? `C’est le plus bas que touche le compte, en ${monthLabel(k.cashLow.month, r.startDate)}. Prévois plus : un plan se décale toujours de quelques mois.` : 'Avec ce qui est prévu, le compte reste positif sur cinq ans.',
        manque > 0 ? 'is-bad' : 'is-good'),
      fait('Autonomie', k.runwayMonths === null || k.runwayMonths === undefined ? 'Illimitée' : `${num(n(k.runwayMonths), 0)} mois`,
        'Le temps que tient la trésorerie au rythme de dépense actuel, sans nouvelle rentrée. Une levée doit couvrir au moins 18 mois.'),
    ),
    h('div', { class: 'pitch-usage' },
      h('div', { class: 'pitch-usage-head' }, 'À quoi sert l’argent la première année'),
      h('div', { class: 'pitch-usage-bar' }, ...postes.map((x, i) => h('i', { class: `is-${i}`, style: { flexGrow: String(x.v / total) }, title: `${x.nom} : ${euro(x.v)}` }))),
      h('div', { class: 'pitch-usage-keys' }, ...postes.map((x, i) => h('span', { class: `is-${i}` }, h('i', {}), `${x.nom} · ${pct(x.v / total, 0)}`))),
      leve === 0 && manque > 0
        ? h('button', { class: 'pitch-manque', onClick: () => goToGap({ route: 'financement', view: 'sources', anchor: 'sources' }, navigate) }, 'Aucune levée n’est saisie : ajoute-la dans Financement pour voir le plan avec →')
        : null,
    ),
  )
}

function equipe(s, r) {
  const team = s.team || []
  if (!team.length) return h('p', { class: 'pitch-vide' }, 'Aucun poste saisi : qui fait le travail est la première question sur l’équipe.')
  return h('div', { class: 'pitch-equipe' },
    ...team.map((m) => h('div', { class: 'pitch-poste' },
      h('b', {}, m.role || 'Poste'),
      h('span', {}, `${n(m.count) > 1 ? `${n(m.count)} personnes · ` : ''}dès ${monthLabel(n(m.startMonth), r.startDate)}`),
      h('span', { class: 'pitch-poste-cout' }, `${euro(n(m.monthlyGross) * 12)} brut par an`),
    )),
    h('p', { class: 'pitch-equipe-total' }, `Coût total de l’équipe en année 1 : ${euro(Math.abs(n(r.pnl.payroll[0])))}, cotisations comprises.`),
  )
}

function risques(s, r) {
  const traps = SECTORS[s.meta?.sectorKey]?.traps || []
  const k = r.kpis
  const nosRisques = []
  if (n(k.fundingNeed) > 0) nosRisques.push({ titre: 'La trésorerie passe sous zéro', dit: `Sans nouveau financement, le compte est à découvert en ${monthLabel(k.cashLow.month, r.startDate)}. C’est la question qu’on te posera en premier.` })
  if ((s.activities || []).filter((a) => n(a.unitPrice) > 0 || n(a.recurringPrice) > 0).length <= 1) nosRisques.push({ titre: 'Une seule offre', dit: 'Tout le chiffre d’affaires dépend d’un seul produit : un concurrent ou un changement de prix suffit à tout remettre en cause.' })
  if (k.firstProfitableYear === null || k.firstProfitableYear === undefined) nosRisques.push({ titre: 'Pas de bénéfice sur cinq ans', dit: 'Le plan ne devient jamais rentable : il faudra montrer ce qui changera au-delà.' })
  const liste = [...nosRisques, ...traps.map((t) => ({ titre: t.title, dit: t.body }))].slice(0, 5)
  if (!liste.length) return h('p', { class: 'pitch-vide' }, 'Aucun risque particulier relevé par le modèle.')
  return h('ol', { class: 'pitch-risques' },
    ...liste.map((x) => h('li', {}, h('b', {}, x.titre), h('span', {}, x.dit))))
}

function ratios(s, r) {
  const p = r.pnl, k = r.kpis
  const lignes = [
    ['Chiffre d’affaires en année 3', euro(n(p.revenue[2])), 'La taille de l’affaire à moyen terme.'],
    ['Croissance moyenne par an', (() => { const a = n(p.revenue[0]), b = n(p.revenue[4]); return a > 0 && b > 0 && b / a <= 1000 ? pct(Math.pow(b / a, 1 / 4) - 1, 0) : '—' })(), 'Le rythme auquel l’entreprise grandit, de l’année 1 à l’année 5.'],
    ['Marge brute', taux(k.marginRate?.[2], p.revenue[2]), 'Ce que rapporte chaque vente avant les frais fixes.'],
    ['Marge d’EBE en année 3', taux(k.ebeMargin?.[2], p.revenue[2]), 'Ce que l’activité garde une fois tout le fonctionnement payé.'],
    ['EBITDA en année 3', euro(n(p.ebitda[2])), 'Résultat d’exploitation plus amortissements : la mesure sur laquelle se calculent les multiples de valorisation.'],
    ['Premier bénéfice', k.firstProfitableYear !== null && k.firstProfitableYear !== undefined ? `Année ${k.firstProfitableYear + 1}` : 'Pas sur cinq ans', 'Quand l’entreprise arrête de consommer l’argent investi.'],
    ['Besoin de financement', n(k.fundingNeed) > 0 ? euro(n(k.fundingNeed)) : 'Aucun', 'Le plus bas que touche le compte : le minimum à lever.'],
    ['Autonomie', k.runwayMonths === null || k.runwayMonths === undefined ? 'Illimitée' : `${num(n(k.runwayMonths), 0)} mois`, 'Combien de temps la trésorerie tient sans nouvelle rentrée.'],
  ]
  return h('div', { class: 'pitch-ratios' },
    ...lignes.map(([l, v, d]) => h('div', { class: 'pitch-ratio' },
      h('span', { class: 'pitch-ratio-l' }, l),
      h('b', { class: 'pitch-ratio-v' }, v),
      h('span', { class: 'pitch-ratio-d' }, d),
    )))
}

/** Qui lira ce pitch : un investisseur, un banquier ou un financeur. */
function lecteurDe(s) {
  const f = s.financing || {}
  const sect = SECTORS[s.meta?.sectorKey]
  if (somme(f.equityInvestors) > 0 || sect?.family === 'tech') return { qui: 'un investisseur', retient: 'ce qu’un investisseur retiendra', court: 'investisseur', inv: true }
  if (s.meta?.sectorKey === 'association' || s.meta?.nonProfit) return { qui: 'un financeur', retient: 'ce qu’un financeur retiendra', court: 'financeur', inv: false }
  return { qui: 'ton banquier', retient: 'ce que ton banquier retiendra', court: 'banquier', inv: false }
}

const eur = (v) => euro(v, { compact: Math.abs(v) >= 100000 })

/**
 * L'avis de Fynomia, partie par partie.
 *
 * Ce qu'un associé expérimenté dirait en relisant la page : un verdict en une
 * ligne, deux ou trois chiffres qui le fondent — comparés au métier quand on
 * a un repère —, la question que le lecteur posera, et le geste qui y répond.
 * Le lecteur n'est pas toujours un fonds : pour une boulangerie ou un
 * commerce, c'est un banquier, et on ne lui parle pas de levée mais de
 * point mort, d'apport et de remboursements.
 *
 * Chaque avis : `{ ton, titre, points: [{ v, t }], question, action }`.
 */
function avis(s, r) {
  const p = r.pnl, k = r.kpis
  const L = lecteurDe(s)
  const sect = SECTORS[s.meta?.sectorKey]
  const bm = sect?.benchmarks || {}
  const offres = (s.activities || []).filter((a) => n(a.unitPrice) > 0 || n(a.recurringPrice) > 0)
  const phrase = String(s.meta?.pitch || '').trim()
  const a1 = n(p.revenue[0]), a5 = n(p.revenue[4])
  const cagr = a1 > 0 && a5 > 0 && a5 / a1 <= 1000 ? Math.pow(a5 / a1, 1 / 4) - 1 : null
  const marge = n(k.marginRate?.[2])
  const margeOk = n(p.revenue[2]) > 0 && Math.abs(marge) <= 10
  const ltv = n(k.ltv), cac = n(k.cac)
  const manque = n(k.fundingNeed)
  const burn = Math.abs(n(k.burnRate))
  const f = s.financing || {}
  const leve = somme(f.equityInvestors)
  const apports = n(f.openingCash) + somme(f.equityFounders)
  const dettes = somme(f.loans) + somme(f.shareholderLoans) + somme(f.advances)
  const team = s.team || []
  const moi = team.find((m) => ME.test(m.role || ''))
  const premier = k.firstProfitableYear
  const aPremier = premier !== null && premier !== undefined
  const bas = k.cashLow || {}
  const autonomie = k.runwayMonths === null || k.runwayMonths === undefined ? null : n(k.runwayMonths)
  const out = {}

  // 1. La trajectoire de trésorerie.
  out.tresorerie = manque > 0
    ? {
        ton: aPremier ? 'watch' : 'bad',
        titre: `Il te faut ${eur(manque)} avant ${monthLabel(bas.month, r.startDate)}`,
        points: [
          { v: eur(-manque), t: `au plus bas, en ${monthLabel(bas.month, r.startDate)} : la date limite pour avoir l’argent sur le compte.` },
          aPremier ? { v: `Année ${premier + 1}`, t: 'le premier exercice bénéficiaire : c’est ce moment que le financement doit atteindre.' }
            : { v: 'Aucun', t: 'bénéfice sur cinq ans : il faudra dire ce qui retourne la courbe.' },
          autonomie !== null ? { v: `${num(autonomie, 0)} mois`, t: 'd’autonomie au rythme de dépense actuel, sans nouvelle rentrée.' } : null,
        ].filter(Boolean),
        question: L.inv ? 'Combien de mois cette levée te donne-t-elle, et pour atteindre quelle étape ?' : 'Que se passe-t-il si tes ventes démarrent trois mois plus tard que prévu ?',
        action: { label: 'Ajouter un financement', go: { route: 'financement', view: 'sources', anchor: 'sources' } },
      }
    : {
        ton: 'good',
        titre: 'Ta trésorerie ne passe jamais sous zéro',
        points: [
          { v: eur(n(bas.value)), t: `au plus bas, en ${monthLabel(bas.month || 0, r.startDate)} : le plan se finance avec ce qui est prévu.` },
          { v: eur(n(r.cash.yearEnd?.[4])), t: 'sur le compte à la fin de l’année 5.' },
        ],
        question: L.inv ? 'Si le plan se finance seul, qu’est-ce que notre argent te ferait faire plus vite ?' : 'Si ton plan se finance seul, pourquoi as-tu besoin d’un prêt, et pour quoi faire ?',
        action: null,
      }

  // 2. L'offre.
  const total3 = (r.revenue?.perActivity || []).reduce((t, x) => t + parAn(x.total, 2), 0)
  const parts = (r.revenue?.perActivity || []).map((x, i) => ({ nom: s.activities?.[i]?.name || `Offre ${i + 1}`, part: total3 > 0 ? parAn(x.total, 2) / total3 : 0 })).sort((x, y) => y.part - x.part)
  const phare = parts[0]
  out.offre = !phrase
    ? {
        ton: 'bad', titre: 'Il manque la phrase qui dit ce que tu vends',
        points: [
          offres.length
            ? { v: String(offres.length), t: `offre${offres.length > 1 ? 's' : ''} chiffrée${offres.length > 1 ? 's' : ''}, mais rien qui ${offres.length > 1 ? 'les' : 'la'} présente en une phrase.` }
            : { v: '0', t: 'offre chiffrée pour l’instant : commence par ton produit phare.' },
          { v: '10 s', t: 'le temps qu’on accorde à la première ligne d’un dossier avant de décider de lire la suite.' },
        ],
        question: 'Tu vends quoi, à qui, et pourquoi chez toi plutôt qu’ailleurs ?',
        action: { label: 'Écrire la phrase', go: { route: 'projet', anchor: 'pitch' } },
      }
    : offres.length <= 1
      ? {
          ton: 'watch', titre: 'Un seul produit porte tout le chiffre d’affaires',
          points: [
            { v: '100 %', t: `du chiffre d’affaires sur « ${offres[0]?.name || 'ton offre'} » : lisible, mais fragile.` },
            s.meta?.clientType ? null : { v: '?', t: 'tes clients ne sont pas précisés : entreprises ou particuliers ne paient pas pareil.' },
          ].filter(Boolean),
          question: 'Que se passe-t-il si un concurrent baisse son prix de 20 % sur ton produit phare ?',
          action: { label: 'Ajouter un deuxième produit', go: { route: 'offre', view: 'offres', anchor: 'ajout-offre' } },
        }
      : {
          ton: phare && phare.part > 0.8 ? 'watch' : 'good',
          titre: phare && phare.part > 0 ? `« ${phare.nom} » fait ${pct(phare.part, 0)} de tes ventes` : `${offres.length} produits au catalogue`,
          points: [
            { v: String(offres.length), t: 'produits chiffrés : le plan ne dépend pas d’un seul.' },
            phare && parts[1] ? { v: pct(parts[1].part, 0), t: `pour « ${parts[1].nom} », le deuxième.` } : null,
          ].filter(Boolean),
          question: 'Pourquoi ces produits se renforcent-ils, au lieu de disperser tes efforts ?',
          action: s.meta?.clientType ? null : { label: 'Préciser qui sont tes clients', go: { route: 'projet', anchor: 'client' } },
        }

  // 3. La croissance.
  const em5 = n(k.ebeMargin?.[4])
  out.trajectoire = cagr === null
    ? {
        ton: 'watch', titre: 'Aucune vente la première année',
        points: [{ v: eur(n(p.revenue[1])), t: 'de chiffre d’affaires en année 2 : tout repose sur la date des premières ventes.' }],
        question: 'Qu’est-ce qui déclenche ta première vente, et à quelle date exactement ?',
        action: { label: 'Estimer tes ventes du premier mois', go: { route: 'offre', view: 'offres', sec: 'volumes', openAll: true, anchor: 'volumes' } },
      }
    : {
        ton: cagr > 1 ? 'watch' : cagr < 0.25 && L.inv ? 'watch' : 'good',
        titre: cagr > 1 ? `+${pct(cagr, 0)} par an : une pente qu’on va challenger`
          : cagr > 0.25 ? `+${pct(cagr, 0)} par an : ambitieux et défendable`
            : L.inv ? `+${pct(Math.max(0, cagr), 0)} par an : lent pour une levée de fonds` : `+${pct(Math.max(0, cagr), 0)} par an : une croissance prudente, qui rassure`,
        points: [
          { v: `${eur(a1)} → ${eur(a5)}`, t: 'de chiffre d’affaires, de l’année 1 à l’année 5.' },
          n(p.revenue[4]) > 0 && Math.abs(em5) <= 10 ? { v: pct(em5, 0), t: 'de marge d’EBE en année 5 : ce que l’activité garde une fois tout payé.' } : null,
        ].filter(Boolean),
        question: cagr > 1 ? 'D’où viennent ces clients, mois par mois, et combien coûte chacun ?' : L.inv ? 'Qu’est-ce qui ferait passer ta croissance à la vitesse supérieure ?' : 'Tes volumes tiennent-ils avec l’équipe et le local prévus ?',
        action: cagr > 1 && !(s.marketing || []).length ? { label: 'Chiffrer ce que coûte un nouveau client', go: { route: 'offre', view: 'acquisition', anchor: 'campagnes' } } : null,
      }

  // 4. Le modèle.
  const mois = (k.breakEvenMonth || []).findIndex((m) => m)
  const ratio = ltv > 0 && cac > 0 ? ltv / cac : null
  const sousRepere = margeOk && bm.grossMargin && marge < bm.grossMargin[0]
  out.modele = {
    ton: !margeOk || marge <= 0 || (ratio !== null && ratio < 1) ? 'bad' : sousRepere || (ratio !== null && ratio < 3) || mois < 0 ? 'watch' : 'good',
    titre: margeOk && marge > 0 ? `Chaque euro vendu t’en laisse ${Math.round(marge * 100)} centimes` : 'Tes ventes ne couvrent pas ce qu’elles coûtent',
    points: [
      margeOk ? { v: pct(marge, 0), t: bm.grossMargin ? `de marge brute en année 3, pour ${pct(bm.grossMargin[0], 0)} à ${pct(bm.grossMargin[1], 0)} dans ton métier.` : 'de marge brute en année 3.', src: !!bm.grossMargin } : null,
      { v: mois >= 0 ? `Année ${mois + 1}` : 'Pas atteint', t: mois >= 0 ? 'le point mort : les ventes de l’année couvrent tous les frais.' : 'le point mort : sur cinq ans, les ventes ne couvrent jamais tous les frais.' },
      ratio !== null ? { v: `${num(ratio, 1)} ×`, t: 'ce qu’un client rapporte face à ce qu’il coûte à trouver (3 × au moins).' } : null,
    ].filter(Boolean),
    question: L.inv ? 'Comment ta marge évolue-t-elle quand tu doubles de taille ?' : 'Si ton fournisseur augmente ses prix de 10 %, que te reste-t-il ?',
    action: sousRepere || !margeOk || marge <= 0 ? { label: 'Valider ton coût de revient', go: { route: 'achats', view: 'charges', anchor: 'charges' } } : null,
  }

  // 5. Le besoin.
  const coussin = manque > 0 ? Math.ceil((manque + 6 * burn) / 1000) * 1000 : 0
  const finance = apports + dettes + leve
  const partApport = finance > 0 ? apports / finance : 0
  out.besoin = manque > 0 && leve === 0
    ? {
        ton: 'watch', titre: burn > 0 ? `Demande plutôt ${eur(coussin)} que ${eur(manque)}` : `Il te faut au moins ${eur(manque)}`,
        points: [
          { v: eur(manque), t: 'le strict minimum, au point bas.' },
          burn > 0 ? { v: eur(6 * burn), t: 'six mois de dépenses en sécurité : un plan se décale toujours, et redemander coûte cher.' } : null,
          !L.inv && finance > 0 ? { v: pct(partApport, 0), t: 'de ton apport dans le financement (une banque attend souvent 20 à 30 %).' } : null,
        ].filter(Boolean),
        question: L.inv ? 'Quelle étape cet argent te fait-il franchir, et en combien de mois ?' : 'Combien mets-tu toi-même, et quelles garanties peux-tu apporter ?',
        action: { label: 'Ajouter un financement', go: { route: 'financement', view: 'sources', anchor: 'sources' } },
      }
    : manque > 0
      ? {
          ton: 'bad', titre: 'La levée prévue ne suffit pas',
          points: [
            { v: eur(leve), t: 'de levée prévue.' },
            { v: eur(manque), t: 'manquent encore au point bas : ajuste le montant ou décale une dépense.' },
          ],
          question: 'Pourquoi ce montant-là, et que fais-tu si la levée prend six mois de plus ?',
          action: { label: 'Ajuster le financement', go: { route: 'financement', view: 'sources', anchor: 'sources' } },
        }
      : {
          ton: 'good', titre: leve > 0 ? 'La levée couvre le plan, avec de la marge' : 'Ton plan se finance sans aide extérieure',
          points: [
            { v: eur(finance), t: 'réunis au total, apport, prêts et levée compris.' },
            !L.inv && finance > 0 ? { v: pct(partApport, 0), t: 'de ton apport dans le financement (une banque attend souvent 20 à 30 %).' } : null,
          ].filter(Boolean),
          question: leve > 0 ? 'Quelle étape précise cette levée permet-elle d’atteindre ?' : 'Si tu n’as besoin de personne, qu’est-ce qu’un financement accélérerait ?',
          action: null,
        }

  // 6. L'équipe.
  const masse1 = Math.abs(n(p.payroll[0]))
  const ratioMasse = n(p.revenue[2]) > 0 ? Math.abs(n(p.payroll[2])) / n(p.revenue[2]) : null
  const seul = team.length <= 1
  const nonPaye = !moi || n(moi.monthlyGross) <= 0
  out.equipe = {
    ton: nonPaye || seul ? 'watch' : ratioMasse !== null && bm.payrollRatio && ratioMasse > bm.payrollRatio[1] * 1.3 ? 'watch' : 'good',
    titre: nonPaye ? 'Tu ne te verses rien : c’est la première chose qu’on verra'
      : seul ? 'Tu portes le projet seul'
        : `${team.length} postes, ${eur(masse1)} de salaires la première année`,
    points: [
      ratioMasse !== null && ratioMasse <= 10 ? { v: pct(ratioMasse, 0), t: bm.payrollRatio ? `du chiffre d’affaires part en salaires en année 3, pour ${pct(bm.payrollRatio[0], 0)} à ${pct(bm.payrollRatio[1], 0)} dans ton métier.` : 'du chiffre d’affaires part en salaires en année 3.', src: !!bm.payrollRatio } : null,
      moi && n(moi.monthlyGross) > 0 ? { v: `${eur(n(moi.monthlyGross) * 12)}`, t: 'brut par an pour toi : un plan où le fondateur ne vit pas n’est pas crédible.' } : null,
    ].filter(Boolean),
    question: L.inv ? 'Qui, dans l’équipe, sait vendre, et qui sait livrer ?' : 'Qui fait tourner l’affaire si tu t’arrêtes deux semaines ?',
    action: nonPaye ? { label: 'Fixer ta rémunération', go: { route: 'equipe', view: 'postes', anchor: 'equipe' } } : null,
  }

  // 7. Les risques.
  const nb = [manque > 0, offres.length <= 1, !aPremier].filter(Boolean).length
  out.risques = {
    ton: nb >= 2 ? 'watch' : 'good',
    titre: nb ? `${nb} risque${nb > 1 ? 's' : ''} à nommer toi-même, avant qu’on te les oppose` : 'Pas de risque majeur dans les chiffres',
    points: [
      { v: String((sect?.traps || []).length), t: 'pièges connus de ton métier, listés ici : dis ce que tu fais pour chacun.' },
      manque > 0 ? { v: eur(manque), t: 'de trésorerie à trouver : c’est le risque qu’on regarde en premier.' } : null,
    ].filter(Boolean),
    question: 'Qu’est-ce qui te ferait arrêter, et à partir de quel chiffre ?',
    action: null,
  }

  // 8. Les ratios.
  out.ratios = {
    ton: 'good',
    titre: 'Les chiffres à connaître par cœur',
    points: [
      { v: eur(n(p.revenue[2])), t: 'de chiffre d’affaires en année 3.' },
      margeOk ? { v: pct(marge, 0), t: 'de marge brute.' } : null,
      { v: manque > 0 ? eur(manque) : 'Aucun', t: 'besoin de financement au point bas.' },
    ].filter(Boolean),
    question: 'Peux-tu me redonner ton point mort et ton besoin de financement sans regarder tes notes ?',
    action: null,
  }
  return out
}

const TONS = { good: 'Solide', watch: 'À surveiller', bad: 'À retravailler' }
/** Un montant ne se coupe pas de son unité : « 23 039 » en fin de ligne et « € » à la suivante. */
const UNITE = new RegExp(' (\\u20AC|%|mois|\\u00D7)', 'g')
const insecable = (t) => String(t ?? '').replace(UNITE, '\u00a0$1')

/**
 * La source d'un repère, à côté du repère : l'éditeur et l'année des
 * données, et la page qui explique la méthode.
 */
export function sourceRepere(sectorKey = store.scenario?.meta?.sectorKey) {
  return h('a', { class: 'repere-src', href: '#/methode', title: 'D’où vient cette fourchette' },
    `Repère ${mentionCourte(sectorKey)} · méthode`)
}

/**
 * L'avis, mis en page comme une note d'associé : qui parle, le verdict, les
 * chiffres qui le fondent, la question qu'on te posera, et le geste suivant.
 */
function conseil(a, { cote = false, court = false } = {}) {
  if (!a) return null
  const ton = a.ton || 'good'
  const points = court ? (a.points || []).slice(0, 2) : (a.points || [])
  return h('aside', { class: `pitch-avis is-${ton} ${cote ? 'is-cote' : ''} ${court ? 'is-court' : ''}` },
    h('header', { class: 'avis-tete' },
      h('span', { class: 'avis-mono', 'aria-hidden': 'true' }, 'F'),
      h('span', { class: 'avis-qui' }, 'L’avis de Fynomia'),
      h('span', { class: 'avis-ton' }, TONS[ton]),
    ),
    h('h4', { class: 'avis-titre' }, insecable(a.titre)),
    points.length ? h('ul', { class: 'avis-points' },
      ...points.map((x) => h('li', {}, h('b', {}, insecable(x.v)), ' ', h('span', {}, insecable(x.t)),
        x.src ? [' ', sourceRepere()] : null))) : null,
    a.question ? h('div', { class: 'avis-question' },
      h('span', {}, 'Question à préparer'),
      h('p', {}, a.question),
    ) : null,
    a.action && navigateur ? h('button', { class: 'avis-action', onClick: (e) => goToGap(a.action.go, navigateur, e.currentTarget) }, `${a.action.label} →`) : null,
  )
}

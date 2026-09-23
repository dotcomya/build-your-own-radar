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

import { h, euro, pct, num, monthLabel, narrow } from '../dom.js'
import { barChart, entree } from '../charts.js'
import { storyline } from '../story.js'
import { trajectorySentence } from '../explain.js'
import store from '../../state/store.js'
import { SECTORS } from '../../state/schema.js'
import { goToGap } from '../spotlight.js'
import { section, exercices, grandsChiffres, anneeLue, lireAnnee } from '../sections.js'
import { barres, courbe, compter } from '../vitrine.js'
import { gardesDuPlan, gardeBloc } from '../garde.js'
import { teteDossier } from './studio.js'

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
 * Trois mises en page à l'essai, pour le même contenu.
 *
 *   « Récit »   — une partie par ligne : le titre et sa phrase sur une ligne,
 *                 le contenu à gauche, l'avis de Fynomia en bloc final à
 *                 droite ;
 *   « Tableau » — tout le pitch en tuiles, sur un ou deux écrans ;
 *   « Diapos »  — une idée par diapositive, comme le deck qu'on présentera.
 *
 * Le fondateur choisit ; on gardera celle qu'il préfère. Le choix est retenu
 * sur cet appareil.
 */
const MISES = [
  { key: 'recit', label: 'Récit', dit: 'une partie par ligne, l’avis à droite' },
  { key: 'tableau', label: 'Tableau', dit: 'tout en tuiles, presque sans défiler' },
  { key: 'diapos', label: 'Diapos', dit: 'une idée par diapositive' },
]
const CLE_MISE = 'fynomia:pitch-mise'
let mise = (() => { try { return localStorage.getItem(CLE_MISE) || 'recit' } catch { return 'recit' } })()
const choisirMise = (k) => { mise = k; try { localStorage.setItem(CLE_MISE, k) } catch { /* rien à retenir */ } }

export function renderPitch(navigate, refresh, goView) {
  navigateur = navigate
  const s = store.scenario
  const r = store.result
  if (!r) return h('p', {}, 'Aucun résultat.')
  const an = anneeLue(r)
  const choisir = (x) => { lireAnnee(x); refresh() }
  const garde = gardesDuPlan(s, r)
  const pilotage = () => (goView ? goView('pilotage') : navigate('#/tableau-de-bord'))
  const parties = partiesDuPitch(s, r, navigate, an, choisir)
  if (!MISES.some((m) => m.key === mise)) mise = 'recit'

  return h('div', { class: `pitch is-${mise}` },
    // La même tête que la synthèse essai : où en est le dossier, ce qui est
    // fait, ce qui reste. Les deux onglets se comparent d'un coup d'œil.
    h('div', { class: 'sy pitch-dossier' }, ...teteDossier(navigate, pilotage, 'pitch-')),
    h('div', { class: 'pitch-mises', role: 'radiogroup', 'aria-label': 'Mise en page du pitch' },
      h('span', { class: 'pitch-mises-l' }, 'Mise en page à l’essai'),
      h('div', { class: 'pitch-mises-seg' },
        ...MISES.map((m) => h('button', {
          class: `pitch-mise ${m.key === mise ? 'is-on' : ''}`, role: 'radio', 'aria-checked': String(m.key === mise),
          onClick: () => { choisirMise(m.key); refresh() },
        }, h('b', {}, m.label), h('span', {}, m.dit))),
      ),
    ),
    couverture(s, r, navigate),
    garde.length ? gardeBloc(garde, navigate, { classe: 'is-page' }) : null,
    mise === 'tableau' ? tableau(parties) : mise === 'diapos' ? diapos(parties) : recit(parties),
    h('div', { class: 'pitch-foot' },
      h('p', {}, 'Tous ces chiffres viennent du même calcul que les états financiers : un chiffre qui te surprend se corrige dans la page où il se saisit, et tout le pitch suit.'),
      h('div', { class: 'pitch-foot-go' },
        h('button', { class: 'sy-btn is-accent is-sm', onClick: () => navigate('#/presentation') }, 'Présenter en plein écran'),
        h('button', { class: 'sy-btn is-line is-sm', onClick: () => goToGap({ route: 'resultats' }, navigate) }, 'Voir les états financiers'),
      ),
    ),
  )
}

/**
 * Le contenu du pitch, partie par partie — le même pour les trois mises en
 * page. Chaque partie : son nom, la phrase qui dit pourquoi un investisseur
 * la lit, son contenu, et l'avis de Fynomia. `tuile` règle sa place dans le
 * tableau (colonnes sur douze, lignes).
 */
function partiesDuPitch(s, r, navigate, an, choisir) {
  const p = r.pnl
  const k = r.kpis
  const a = avis(s, r)
  return [
    { cle: 'trajectoire', nom: 'La trajectoire sur cinq ans',
      dit: 'Ta trésorerie mois par mois, et les moments qui comptent : l’histoire qu’on lit en premier.',
      corps: () => h('div', { class: 'pitch-traj' },
        h('div', { class: 'pitch-chart' }, storyline(r, s, { compact: narrow() })),
        h('p', { class: 'pitch-traj-dit' }, trajectorySentence(r)),
      ),
      avis: a.tresorerie, tuile: [8, 2] },
    { cle: 'offre', nom: 'Ce que tu vends, et à qui',
      dit: 'Si ça ne tient pas en deux phrases, le reste ne sera pas lu.',
      corps: () => offres(s, r, navigate), avis: a.offre, tuile: [4, 2] },
    { cle: 'croissance', nom: 'Jusqu’où ça peut aller',
      dit: 'La pente du chiffre d’affaires, et le moment où tu gagnes de l’argent.',
      droite: exercices(an, choisir),
      corps: () => h('div', { class: 'pitch-croiss' },
        h('div', { class: 'pitch-chart' }, barChart({
          series: [{ label: 'Chiffre d’affaires', values: p.revenue.map(n), color: '#0E0F0C' }],
          line: { label: 'Résultat net', values: p.netResult.map(n), color: '#1B7F4B' },
          categories: ['A1', 'A2', 'A3', 'A4', 'A5'], height: 220,
        })),
        grandsChiffres([
          { cle: 'ca', label: 'Chiffre d’affaires', valeurs: p.revenue, mensuel: r.revenue?.monthly, ton: () => 'none', note: () => croissance(p.revenue) },
          { cle: 'ebitda', label: 'EBITDA', valeurs: p.ebitda, ton: (v) => (v > 0 ? 'good' : v < 0 ? 'bad' : 'none'),
            note: (y) => (taux(n(p.ebitda[y]) / (n(p.revenue[y]) || 1), p.revenue[y]) !== '—' ? `${pct(n(p.ebitda[y]) / n(p.revenue[y]), 0)} du chiffre d’affaires.` : 'Avant amortissements, intérêts et impôts.') },
          { cle: 'net', label: 'Résultat net', valeurs: p.netResult, ton: (v) => (v > 0 ? 'good' : v < 0 ? 'bad' : 'none'),
            note: () => (k.firstProfitableYear !== null && k.firstProfitableYear !== undefined ? `Premier bénéfice en année ${k.firstProfitableYear + 1}.` : 'Pas de bénéfice sur cinq ans.') },
          { cle: 'treso', label: 'Trésorerie à la clôture', valeurs: r.cash.yearEnd, mensuel: r.cash.balance, ton: (v) => (v < 0 ? 'bad' : 'good'), note: () => 'Au 31 décembre.' },
        ], an, choisir, { cle: 'pitch', compact: true, debut: r.startDate }),
      ),
      avis: a.trajectoire, tuile: [8, 2] },
    { cle: 'modele', nom: 'Comment chaque vente gagne de l’argent',
      dit: 'Ce qui reste sur chaque vente, et ce qu’un client rapporte face à ce qu’il coûte.',
      corps: () => modele(s, r), avis: a.modele, tuile: [4, 2] },
    { cle: 'besoin', nom: 'Ce que tu cherches à financer',
      dit: 'Combien, jusqu’à quand, pour quoi faire : la somme doit mener à une étape.',
      corps: () => besoin(s, r, navigate), avis: a.besoin, tuile: [6, 1] },
    { cle: 'equipe', nom: 'Qui fait le travail',
      dit: 'Qui est là au départ, qui arrive ensuite, et ce que ça coûte.',
      corps: () => equipe(s, r), avis: a.equipe, tuile: [6, 1] },
    { cle: 'risques', nom: 'Ce qui pourrait mal tourner',
      dit: 'Un dossier qui nomme ses risques rassure plus qu’un dossier qui les tait.',
      corps: () => risques(s, r), avis: a.risques, tuile: [6, 1] },
    { cle: 'ratios', nom: 'Les chiffres qu’on te demandera',
      dit: 'Ceux qu’un investisseur compare d’un dossier à l’autre.',
      corps: () => ratios(s, r), avis: a.ratios, tuile: [6, 1] },
  ]
}

/** Récit : une partie par ligne, l'avis en bloc final à droite. */
function recit(parties) {
  return h('div', { class: 'pitch-recit' },
    ...parties.map((x, i) => section({ no: i + 1, nom: x.nom, dit: x.dit, droite: x.droite || null, cle: `pitch-${x.cle}`, classe: 'pitch-ligne' },
      h('div', { class: 'pitch-ligne-corps' },
        h('div', { class: 'pitch-ligne-main' }, x.corps()),
        conseil(x.avis, { cote: true }),
      ),
    )))
}

/** Tableau : tout en tuiles, sur une grille de douze colonnes. */
function tableau(parties) {
  return h('div', { class: 'pitch-bento' },
    ...parties.map((x, i) => h('article', {
      class: 'pitch-tuile', 'data-partie': x.cle,
      style: { '--cols': String(x.tuile?.[0] || 6), '--rows': String(x.tuile?.[1] || 1), '--i': String(i) },
    },
      h('header', { class: 'pitch-tuile-head' },
        h('b', {}, String(i + 1).padStart(2, '0')),
        h('h3', {}, x.nom),
        x.droite ? h('div', { class: 'pitch-tuile-droite' }, x.droite) : null,
      ),
      h('p', { class: 'pitch-tuile-dit' }, x.dit),
      h('div', { class: 'pitch-tuile-corps' }, x.corps()),
      conseil(x.avis, { court: true }),
    )))
}

/** Diapos : une partie par diapositive, qu'on fait défiler de côté. */
const diapo = { i: 0 }
function diapos(parties) {
  const n = parties.length
  const piste = h('div', { class: 'pitch-piste', tabindex: '0', 'aria-label': 'Diapositives du pitch' },
    ...parties.map((x, i) => h('section', { class: 'pitch-diapo', 'data-partie': x.cle, 'aria-label': `${i + 1} sur ${n} : ${x.nom}` },
      h('div', { class: 'pitch-diapo-main' },
        h('div', { class: 'pitch-diapo-head' },
          h('span', { class: 'pitch-diapo-no' }, `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`),
          h('h3', {}, x.nom),
          x.droite ? h('div', { class: 'pitch-tuile-droite' }, x.droite) : null,
        ),
        h('p', { class: 'pitch-diapo-dit' }, x.dit),
        h('div', { class: 'pitch-diapo-corps' }, x.corps()),
      ),
      conseil(x.avis, { cote: true }),
    )))
  const points = h('div', { class: 'pitch-points' },
    ...parties.map((x, i) => h('button', { class: `pitch-point ${i === diapo.i ? 'is-on' : ''}`, 'aria-label': x.nom, title: x.nom, onClick: () => aller(i) })))
  const compteur = h('span', { class: 'pitch-compteur' }, `${diapo.i + 1} / ${n}`)
  const aller = (i) => {
    diapo.i = Math.max(0, Math.min(n - 1, i))
    piste.scrollTo({ left: diapo.i * piste.clientWidth, behavior: 'smooth' })
  }
  const suivre = () => {
    const i = Math.round(piste.scrollLeft / Math.max(1, piste.clientWidth))
    if (i === diapo.i && compteur.textContent === `${i + 1} / ${n}`) return
    diapo.i = i
    compteur.textContent = `${i + 1} / ${n}`
    points.querySelectorAll('.pitch-point').forEach((b, k) => b.classList.toggle('is-on', k === i))
  }
  piste.addEventListener('scroll', () => requestAnimationFrame(suivre), { passive: true })
  piste.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); aller(diapo.i + 1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); aller(diapo.i - 1) }
  })
  // Un redessin (changer d'exercice) garde la diapositive ouverte.
  requestAnimationFrame(() => { if (diapo.i) piste.scrollLeft = diapo.i * piste.clientWidth })
  return h('div', { class: 'pitch-deck' },
    piste,
    h('div', { class: 'pitch-nav' },
      h('button', { class: 'pitch-fleche', 'aria-label': 'Diapositive précédente', onClick: () => aller(diapo.i - 1) }, '←'),
      points,
      compteur,
      h('button', { class: 'pitch-fleche', 'aria-label': 'Diapositive suivante', onClick: () => aller(diapo.i + 1) }, '→'),
    ),
  )
}

/**
 * La couverture, dans le style de « ton business prend forme ».
 *
 * La page vue au sortir du parcours avait ce que le pitch n'avait pas : le
 * nom en grand, cinq ans de chiffre d'affaires qui montent, la trésorerie
 * tracée d'un trait, des montants qui comptent jusqu'à leur valeur. Le
 * pitch s'ouvre maintenant ainsi — et se joue quand on arrive dessus.
 */
function couverture(s, r, navigate) {
  const nom = s.meta?.company || s.meta?.name || 'Ton projet'
  const phrase = String(s.meta?.pitch || '').trim()
  const metier = s.meta?.activityLabel || SECTORS[s.meta?.sectorKey]?.label || ''
  const leve = somme(s.financing?.equityInvestors)
  const p = r.pnl, k = r.kpis
  const besoin = n(k.fundingNeed)
  const lecteur = lecteurDe(s)
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
      h('span', { class: 'rvl-kicker', style: { '--d': '0s' } }, `Pitch · ${lecteur.retient}`),
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
        barres(p.revenue),
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

function offres(s, r, navigate) {
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
    fait('Marge d’EBITDA, année 3', taux(k.ebitdaMargin?.[y], p.revenue[y]),
      tauxDit(k.ebitdaMargin?.[y], p.revenue[y], 'La part du chiffre d’affaires que l’activité garde une fois l’équipe et les frais payés. C’est elle qui dit si le modèle devient rentable en grandissant.'),
      taux(k.ebitdaMargin?.[y], p.revenue[y]) === '—' ? '' : n(k.ebitdaMargin?.[y]) > 0 ? 'is-good' : 'is-bad'),
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
  if (!team.length) return h('p', { class: 'pitch-vide' }, 'Aucun poste saisi : un investisseur voudra savoir qui fait le travail.')
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
    ['Marge d’EBITDA en année 3', taux(k.ebitdaMargin?.[2], p.revenue[2]), 'Ce que l’activité garde une fois tout le fonctionnement payé.'],
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
  const em5 = n(k.ebitdaMargin?.[4])
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
            : L.inv ? `+${pct(Math.max(0, cagr), 0)} par an : lent pour un investisseur` : `+${pct(Math.max(0, cagr), 0)} par an : une croissance prudente, qui rassure`,
        points: [
          { v: `${eur(a1)} → ${eur(a5)}`, t: 'de chiffre d’affaires, de l’année 1 à l’année 5.' },
          n(p.revenue[4]) > 0 && Math.abs(em5) <= 10 ? { v: pct(em5, 0), t: 'de marge d’EBITDA en année 5 : ce que l’activité garde une fois tout payé.' } : null,
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
      margeOk ? { v: pct(marge, 0), t: bm.grossMargin ? `de marge brute en année 3, pour ${pct(bm.grossMargin[0], 0)} à ${pct(bm.grossMargin[1], 0)} dans ton métier.` : 'de marge brute en année 3.' } : null,
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
      ratioMasse !== null && ratioMasse <= 10 ? { v: pct(ratioMasse, 0), t: bm.payrollRatio ? `du chiffre d’affaires part en salaires en année 3, pour ${pct(bm.payrollRatio[0], 0)} à ${pct(bm.payrollRatio[1], 0)} dans ton métier.` : 'du chiffre d’affaires part en salaires en année 3.' } : null,
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
      ...points.map((x) => h('li', {}, h('b', {}, insecable(x.v)), ' ', h('span', {}, x.t)))) : null,
    a.question ? h('div', { class: 'avis-question' },
      h('span', {}, 'On te demandera'),
      h('p', {}, `« ${a.question} »`),
    ) : null,
    a.action && navigateur ? h('button', { class: 'avis-action', onClick: (e) => goToGap(a.action.go, navigateur, e.currentTarget) }, `${a.action.label} →`) : null,
  )
}

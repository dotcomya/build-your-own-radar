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

import { h, euro, pct, num, monthLabel } from '../dom.js'
import store from '../../state/store.js'
import { SECTORS } from '../../state/schema.js'
import { goToGap } from '../spotlight.js'
import { section, exercices, grandsChiffres, anneeLue, lireAnnee } from '../sections.js'
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

const CLIENTS = { b2b: 'Des entreprises', b2c: 'Des particuliers', b2b2c: 'Des entreprises qui revendent à des particuliers' }

export function renderPitch(navigate, refresh, goView) {
  const s = store.scenario
  const r = store.result
  if (!r) return h('p', {}, 'Aucun résultat.')
  const p = r.pnl
  const k = r.kpis
  const an = anneeLue(r)
  const choisir = (x) => { lireAnnee(x); refresh() }
  const garde = gardesDuPlan(s, r)

  const pilotage = () => (goView ? goView('pilotage') : navigate('#/tableau-de-bord'))
  const a = avis(s, r)

  return h('div', { class: 'pitch' },
    // La même tête que la synthèse essai : où en est le dossier, ce qui est
    // fait, ce qui reste. Les deux onglets se comparent d'un coup d'œil.
    h('div', { class: 'sy pitch-dossier' }, ...teteDossier(navigate, pilotage, 'pitch-')),
    couverture(s, r, navigate),
    garde.length ? gardeBloc(garde, navigate, { classe: 'is-page' }) : null,

    section({ no: 1, nom: 'Ce que tu vends, et à qui', cle: 'pitch-offre',
      dit: 'Ce que tu vends, à qui et à quel prix : si ça ne tient pas en deux phrases, le reste ne sera pas lu.' },
      offres(s, r, navigate), conseil(a.offre)),

    section({ no: 2, nom: 'Jusqu’où ça peut aller', cle: 'pitch-trajectoire', droite: exercices(an, choisir),
      dit: 'Un investisseur achète une trajectoire : la pente du chiffre d’affaires, et le moment où tu gagnes de l’argent.' },
      grandsChiffres([
        { cle: 'ca', label: 'Chiffre d’affaires', valeurs: p.revenue, mensuel: r.revenue?.monthly, ton: () => 'none',
          note: () => croissance(p.revenue),
          pourquoi: 'La taille que peut atteindre l’affaire. Un fonds cherche une entreprise qui peut devenir grande ; un business angel, une qui peut devenir rentable.' },
        { cle: 'ebitda', label: 'EBITDA', valeurs: p.ebitda, ton: (v) => (v > 0 ? 'good' : v < 0 ? 'bad' : 'none'),
          note: (y) => (taux(n(p.ebitda[y]) / (n(p.revenue[y]) || 1), p.revenue[y]) !== '—' ? `${pct(n(p.ebitda[y]) / n(p.revenue[y]), 0)} du chiffre d’affaires.` : 'Avant amortissements, intérêts et impôts.'),
          pourquoi: 'Ce que l’activité gagne vraiment, avant les choix de financement : c’est le chiffre qu’on compare d’un dossier à l’autre.' },
        { cle: 'net', label: 'Résultat net', valeurs: p.netResult, ton: (v) => (v > 0 ? 'good' : v < 0 ? 'bad' : 'none'),
          note: () => (k.firstProfitableYear !== null && k.firstProfitableYear !== undefined ? `Premier bénéfice en année ${k.firstProfitableYear + 1}.` : 'Pas de bénéfice sur cinq ans.'),
          pourquoi: 'Le bénéfice final. Tant qu’il est négatif, l’entreprise consomme l’argent levé.' },
        { cle: 'treso', label: 'Trésorerie à la clôture', valeurs: r.cash.yearEnd, mensuel: r.cash.balance, ton: (v) => (v < 0 ? 'bad' : 'good'),
          note: () => 'Sur le compte de la société au 31 décembre.',
          pourquoi: 'Ce qui reste de l’argent levé et gagné. S’il passe sous zéro, il faudra relever plus tôt que prévu.' },
      ], an, choisir, { cle: 'pitch', debut: r.startDate }), conseil(a.trajectoire)),

    section({ no: 3, nom: 'Comment chaque vente gagne de l’argent', cle: 'pitch-modele',
      dit: 'Ce qui reste sur chaque vente, quand l’entreprise couvre ses frais, et ce que rapporte un client face à ce qu’il coûte.' },
      modele(s, r), conseil(a.modele)),

    section({ no: 4, nom: 'Ce que tu cherches à financer', cle: 'pitch-besoin',
      dit: 'Combien il te faut, jusqu’à quand, et pour quoi faire : la somme doit mener à une étape, pas combler un trou.' },
      besoin(s, r, navigate), conseil(a.besoin)),

    section({ no: 5, nom: 'Qui fait le travail', cle: 'pitch-equipe',
      dit: 'On investit d’abord dans une équipe : qui est là au départ, qui arrive ensuite, et ce que ça coûte.' },
      equipe(s, r), conseil(a.equipe)),

    section({ no: 6, nom: 'Ce qui pourrait mal tourner', cle: 'pitch-risques',
      dit: 'Un dossier qui nomme ses risques rassure plus qu’un dossier qui les tait : voici ceux de ton métier.' },
      risques(s, r), conseil(a.risques)),

    section({ no: 7, nom: 'Les chiffres qu’on te demandera', cle: 'pitch-ratios',
      dit: 'Ceux qu’un investisseur compare d’un dossier à l’autre : sache-les sans regarder tes notes.' },
      ratios(s, r), conseil(a.ratios)),

    h('div', { class: 'pitch-foot' },
      h('p', {}, 'Tous ces chiffres viennent du même calcul que les états financiers : un chiffre qui te surprend se corrige dans la page où il se saisit, et tout le pitch suit.'),
      h('div', { class: 'pitch-foot-go' },
        h('button', { class: 'sy-btn is-accent is-sm', onClick: () => navigate('#/presentation') }, 'Présenter en plein écran'),
        h('button', { class: 'sy-btn is-line is-sm', onClick: () => goToGap({ route: 'resultats' }, navigate) }, 'Voir les états financiers'),
      ),
    ),
  )
}

/** La couverture : le nom, la phrase, le métier — et ce que tu cherches. */
function couverture(s, r, navigate) {
  const nom = s.meta?.name || s.meta?.company || 'Ton projet'
  const phrase = String(s.meta?.pitch || '').trim()
  const metier = s.meta?.activityLabel || SECTORS[s.meta?.sectorKey]?.label || ''
  const leve = somme(s.financing?.equityInvestors)
  const besoin = n(r.kpis.fundingNeed)
  return h('section', { class: 'sy-ink pitch-cover' },
    h('div', { class: 'sy-ink-top' },
      h('span', { class: 'sy-kicker is-accent' }, 'Pitch investisseur · l’essentiel de ton plan'),
    ),
    h('h2', { class: 'sy-ink-title' }, nom),
    phrase
      ? h('p', { class: 'pitch-phrase' }, phrase)
      : h('button', { class: 'pitch-manque', onClick: () => goToGap({ route: 'projet', anchor: 'pitch' }, navigate) },
          'Écris en une phrase ce que tu vends et à qui : c’est la première chose qu’un investisseur lira. Y aller →'),
    h('div', { class: 'pitch-meta' },
      metier ? h('span', {}, metier) : null,
      s.meta?.legalForm ? h('span', {}, s.meta.legalForm) : null,
      h('span', {}, `Démarrage ${monthLabel(0, r.startDate)}`),
    ),
    h('div', { class: 'pitch-ask' },
      h('span', {}, leve > 0 ? 'Levée prévue' : besoin > 0 ? 'Il manque au point bas' : 'Besoin de financement'),
      h('b', {}, leve > 0 ? euro(leve) : besoin > 0 ? euro(besoin) : 'Aucun'),
      h('small', {}, leve > 0
        ? (besoin > 0 ? `et il manque encore ${euro(besoin)} au point bas` : 'le plan tient avec cette levée')
        : besoin > 0 ? `avant ${monthLabel(r.kpis.cashLow.month, r.startDate)}` : 'la trésorerie reste positive sur cinq ans'),
    ),
  )
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

/**
 * L'avis de Fynomia, partie par partie.
 *
 * Ce qu'un consultant dirait en relisant la page par-dessus ton épaule : une
 * ou deux phrases, tirées de tes chiffres, sur ce qu'un investisseur va
 * retenir et ce qu'il va te demander. Pas de cours : la question qu'on te
 * posera, et comment t'y préparer.
 */
function avis(s, r) {
  const p = r.pnl, k = r.kpis
  const offres = (s.activities || []).filter((a) => n(a.unitPrice) > 0 || n(a.recurringPrice) > 0)
  const phrase = String(s.meta?.pitch || '').trim()
  const a1 = n(p.revenue[0]), a5 = n(p.revenue[4])
  const cagr = a1 > 0 && a5 > 0 && a5 / a1 <= 1000 ? Math.pow(a5 / a1, 1 / 4) - 1 : null
  const marge = n(k.marginRate?.[2])
  const ltv = n(k.ltv), cac = n(k.cac)
  const manque = n(k.fundingNeed)
  const burn = Math.abs(n(k.burnRate))
  const leve = somme(s.financing?.equityInvestors)
  const equipe = (s.team || []).length
  const out = {}

  out.offre = !phrase
    ? 'Commence par la phrase qui dit ce que tu vends et à qui : c’est la première ligne qu’un investisseur lira, et souvent la seule s’il n’accroche pas.'
    : offres.length <= 1
      ? 'Une seule offre, c’est lisible : on comprend tout de suite ce que tu vends. Prépare-toi à expliquer pourquoi c’est la bonne, et ce qui viendrait ensuite.'
      : `${offres.length} offres : montre laquelle porte l’essentiel du chiffre d’affaires, et pourquoi les autres la renforcent au lieu de disperser l’effort.`

  out.trajectoire = cagr === null
    ? 'Tant qu’il n’y a pas de chiffre d’affaires en année 1, un investisseur jugera surtout la date des premières ventes : sois précis sur ce qui les déclenche.'
    : cagr > 1
      ? `+${pct(cagr, 0)} par an en moyenne, ça attire l’œil — et c’est justement ce qu’on va challenger. Aie une réponse précise à « d’où viennent ces clients, mois par mois ? ».`
      : cagr > 0.25
        ? `+${pct(cagr, 0)} par an : une trajectoire ambitieuse mais crédible. C’est la zone où un investisseur écoute la suite.`
        : `+${pct(Math.max(0, cagr), 0)} par an : une croissance raisonnable, qui convient à un business angel ou à une banque. Un fonds cherchera plus de pente.`

  out.modele = ltv > 0 && cac > 0 && ltv / cac < 3
    ? `Un client te rapporte ${num(ltv / cac, 1)} fois ce qu’il coûte à trouver : en dessous de 3, chaque euro de marketing en rapporte trop peu. C’est le point à travailler avant de lever — prix, rétention ou canal moins cher.`
    : marge >= 0.7
      ? 'Des marges de logiciel ou de service : chaque client en plus rapporte beaucoup. C’est ton meilleur argument, mets-le en avant.'
      : marge > 0 && marge < 0.3
        ? 'Des marges serrées : le modèle ne tient qu’avec du volume. Montre que tu peux l’atteindre, et ce qui protège tes prix.'
        : 'Ton modèle couvre ses coûts directs. La question suivante sera : à partir de combien de clients couvre-t-il aussi l’équipe et les frais ?'

  const coussin = manque > 0 ? manque + 6 * burn : 0
  out.besoin = manque > 0 && leve === 0
    ? `Il te manque ${euro(manque)} au point bas. Demande plutôt autour de ${euro(Math.ceil(coussin / 1000) * 1000)} : six mois de dépenses en plus, parce qu’un plan se décale toujours et que relever en urgence coûte cher.`
    : manque > 0
      ? `Même avec la levée prévue, il manque ${euro(manque)} au point bas : ajuste le montant, ou décale une dépense, avant de présenter.`
      : leve > 0
        ? 'La levée prévue couvre le plan avec de la marge. Dis précisément l’étape qu’elle permet d’atteindre : c’est ce qu’on achète.'
        : 'Ton plan se finance sans levée : c’est une force. Si tu cherches quand même un investisseur, dis ce que son argent accélère.'

  out.equipe = equipe <= 1
    ? 'Un fondateur seul, c’est la première question qu’on te posera : qui te complète, et sur quoi ? Même un associé à temps partiel ou un conseil compte.'
    : `${equipe} postes au démarrage. Un investisseur regardera surtout qui fait quoi parmi les fondateurs, et quand arrivent les premières embauches clés.`

  out.risques = 'Nomme ces risques toi-même, avec ce que tu fais pour les réduire. Un investisseur qui les découvre seul se méfie de tout le reste.'
  out.ratios = 'Ces sept chiffres reviendront dans toutes les conversations. Sache-les par cœur, et sache dire en une phrase d’où vient chacun.'
  return out
}

/** Une note de l'assistant, sous une partie. */
function conseil(texte) {
  if (!texte) return null
  return h('aside', { class: 'pitch-avis' },
    h('span', { class: 'pitch-avis-sign', 'aria-hidden': 'true' }, 'F'),
    h('div', {},
      h('b', {}, 'L’avis de Fynomia'),
      h('p', {}, texte),
    ),
  )
}

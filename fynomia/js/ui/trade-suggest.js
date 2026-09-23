/**
 * Les suggestions du métier, là où on saisit.
 *
 * Une liste de charges génériques — « comptable », « assurances », « loyer » —
 * n'apprend rien à personne et ne rassure personne. Un glacier qui ouvre
 * Fynomia et lit « cornets, pots et cuillères : 0,18 € par glace vendue »
 * comprend en une ligne que l'outil connaît son métier. Un spa qui voit
 * « électricité — sauna, hammam, pompes » sait qu'on ne va pas lui proposer un
 * modèle de consultant avec un autre nom.
 *
 * Ce module ne fait donc qu'une chose : nommer, dans les mots du métier, ce
 * qu'on oublie — et l'ajouter au modèle d'un clic. Les montants qui arrivent
 * sont des ordres de grandeur, corrigeables comme n'importe quelle ligne.
 *
 * Il ne montre que ce qui manque. Une suggestion déjà posée disparaît : on ne
 * propose pas deux fois la même chose, et le bloc se vide au fur et à mesure
 * que le dossier se remplit — jusqu'à disparaître tout seul.
 *
 * Changer de métier change tout le bloc : il ne lit que `meta.sectorKey`.
 */

import { h, euro, toast, PLUS } from './dom.js'
import { newOpex, newCapex, newActivity } from '../state/schema.js'
import { tradeFor, chargeShape } from '../state/trade.js'
import { getSector, vocabulary, tradeName } from '../state/sectors.js'
import { goToGap, pop } from './spotlight.js'
import { focusOffer } from './pages/offer.js'
import store from '../state/store.js'

/** Deux libellés désignent la même ligne si on les lit pareil. */
const same = (a, b) => norm(a) === norm(b)
/* Les diacritiques passent par une RegExp construite depuis une chaîne : un
   littéral /[\u0300-\u036f]/ contient de vrais caractères combinants, et le
   paquet minifié n'échappe pas les littéraux d'expression régulière. */
const MARKS = new RegExp('[\\u0300-\\u036f]', 'g')
const norm = (v) => String(v || '').toLowerCase().normalize('NFD').replace(MARKS, '').replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Le bloc de suggestions pour une nature donnée.
 *
 *   'opex'   les charges — fixes, par vente, ou en part du chiffre d'affaires ;
 *   'capex'  le matériel durable ;
 *   'offers' ce qu'on vend en plus de l'évidence.
 */
export function tradeSuggest(kind, navigate, refresh) {
  const s = store.scenario
  if (!s) return null
  const trade = tradeFor(s)
  const sector = getSector(s.meta?.sectorKey)
  if (!trade || !sector) return null

  const vocab = vocabulary(s)
  const items = (trade[kind] || []).filter((it) => !alreadyThere(kind, it, s))
  // Tout est posé : le bloc n'a plus rien à dire, il s'efface.
  if (!items.length) return null

  // Une rangée de pastilles, en tête de page.
  //
  // C'était une carte : un en-tête, un glyphe, un sous-titre de métier, puis
  // des lignes à trois étages. Elle pesait autant qu'une offre alors qu'elle ne
  // fait que proposer. Ce qui reste est le geste — le nom, ce qu'il rapporte,
  // un « + » — sur une ligne qui se survole et se clique sans réfléchir.
  return h('section', { class: `tradetip is-${kind}`, 'data-gap': `metier-${kind}` },
    h('div', { class: 'tradetip-kicker' },
      h('span', { class: 'tradetip-spark', 'aria-hidden': 'true' }, sector.glyph),
      `Suggestions rapides à intégrer — ${tradeName(s)}`,
    ),

    h('div', { class: 'tradetip-items' },
      ...items.map((it) => h('button', {
        class: 'tradetip-item',
        title: it.why || it.note || 'Ajouter au modèle',
        onClick: (e) => { pop(e.currentTarget); added(kind, it, vocab, navigate, refresh) },
      },
        h('span', { class: 'tradetip-plus', 'aria-hidden': 'true', html: PLUS }),
        h('span', { class: 'tradetip-label' }, it.label),
        h('span', { class: 'tradetip-amount num' }, amountOf(kind, it, vocab)),
      )),
    ),

    // Une phrase de métier suivait les pastilles (« matière plus personnel
    // sous 65 % », « compte tes jours facturables »…). Elle a été retirée :
    // des généralités qu'on lit une fois, qui n'aident à rien saisir, sous un
    // bloc dont le seul rôle est d'ajouter une ligne en un clic.
  )
}

/* Le nom du métier passe devant, et la phrase suit sans article : « une »
   pizzeria mais « un » food truck, et personne n'a envie d'un dictionnaire de
   genres pour afficher un sous-titre. */
const HEAD = {
  opex: { tag: 'Dans ton métier, on oublie souvent', sub: 'ce qui tombe tous les mois.' },
  capex: { tag: 'Le matériel du métier', sub: 'ce qu’on achète pour ouvrir.' },
  offers: { tag: 'Ce que tu pourrais vendre aussi', sub: 'les revenus qu’on oublie de compter.' },
}

/* ───────────────────────── Ce qui est déjà posé ─────────────────────────── */

function alreadyThere(kind, item, s) {
  if (kind === 'opex') return (s.opex || []).some((o) => same(o.label, item.label))
  if (kind === 'capex') return (s.capex || []).some((c) => same(c.label, item.label))
  return (s.activities || []).some((a) => same(a.name, item.label))
}

/* ───────────────────────── Ce qu'on dit du montant ──────────────────────── */

function amountOf(kind, item, vocab) {
  if (kind === 'opex') return chargeShape(item, vocab).say
  if (kind === 'capex') {
    return item.years > 0
      ? `${euro(item.amount)} · amorti sur ${item.years} ans`
      : `${euro(item.amount)} · non amortissable`
  }
  return item.recurring ? `${euro(item.price)} par mois` : `${euro(item.price)}`
}

/* ─────────────────────── Ce qui se passe après le clic ─────────────────── */

/**
 * Une charge ajoutée déplace un chiffre tout de suite ; une offre, non.
 *
 * On connaît le prix d'un cornet, pas le nombre de cornets que ce fondateur-là
 * vendra — et l'inventer serait exactement ce que Fynomia refuse de faire.
 * Une offre suggérée arrive donc à volume nul, et le clic emmène au champ où
 * il faut le dire. Une charge, elle, arrive avec son montant : on annonce
 * simplement ce qui vient d'entrer dans le modèle.
 */
function added(kind, item, vocab, navigate, refresh) {
  add(kind, item, vocab)
  if (kind === 'offers') {
    // On atterrissait sur « Volumes » : on venait d'accepter une idée, et la
    // première question posée était combien on en vend — avant même d'avoir vu
    // ce qu'elle coûte au client. Le prix d'abord ; les volumes sont l'onglet
    // d'à côté.
    goToGap({ route: 'offre', view: 'offres', sec: 'offre', openAll: true, anchor: 'prix' }, navigate)
    toast(`${item.label} ajouté. Vérifie son prix.`)
    return
  }
  toast(`${item.label} — ${amountOf(kind, item, vocab)}`, 'ok')
  refresh()
}

/* ───────────────────────── Ce qu'on ajoute au modèle ────────────────────── */

function add(kind, item, vocab) {
  if (kind === 'opex') {
    const shape = chargeShape(item, vocab)
    store.update((sc) => sc.opex.push(newOpex({
      label: item.label,
      mode: shape.mode,
      monthlyAmount: shape.mode === 'fixed' ? shape.value : 0,
      perUnit: shape.mode === 'perUnit' ? shape.value : 0,
      pctRevenue: shape.mode === 'pctRevenue' ? shape.value : 0,
    })), { label: `Ajout — ${item.label}` })
    return
  }

  if (kind === 'capex') {
    store.update((sc) => sc.capex.push(newCapex({
      label: item.label,
      amount: item.amount,
      // Un droit au bail ou un stock ne s'amortit pas : la durée reste à zéro,
      // et le moteur le laisse au bilan au lieu de l'étaler en charges.
      amortYears: item.years || 0,
    })), { label: `Ajout — ${item.label}` })
    return
  }

  // Une offre proposée s'ouvre là où on la décrit, pas sur ses volumes : on
  // vient d'accepter une idée, la première chose à vérifier est son prix.
  const made = newActivity(item.recurring
    ? {
        name: item.label, unitPrice: 0, recurringPrice: item.price, recurringCost: item.cost || 0,
        contractMonths: 12, churnMonthly: 0.03, deposit: 1, paymentLag: 0,
        volumes: { mode: 'growth', launchMonth: 1, startUnits: 0, monthlyGrowth: 0.08, growthDecay: 0.96, cap: '', manual: [] },
      }
    : {
        name: item.label, unitPrice: item.price, unitCost: item.cost || 0,
        recurringPrice: 0, contractMonths: 0, deposit: 1, paymentLag: 0,
        volumes: { mode: 'growth', launchMonth: 1, startUnits: 0, monthlyGrowth: 0.06, growthDecay: 0.95, cap: '', manual: [] },
      })
  store.update((sc) => sc.activities.push(made), { label: `Ajout — ${item.label}` })
  focusOffer(made.id)
}

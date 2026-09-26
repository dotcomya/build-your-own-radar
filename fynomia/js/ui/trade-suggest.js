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
import { goToGap } from './spotlight.js'
import { aOublier } from './memoire.js'
import { celebrate } from './burst.js'
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

  // Un titre, un compteur, trois pastilles — puis « +3 ».
  //
  // Les pastilles disaient leur montant à côté du nom, sur toute la largeur :
  // six ou huit propositions faisaient deux lignes serrées qu'on lisait comme
  // une liste de prix. On nomme le métier, on compte ce qui est proposé, on en
  // montre trois ; le montant est dans l'infobulle, et le reste se déplie.
  const tout = deplies.has(kind)
  const caches = Math.max(0, items.length - VISIBLES)
  const bloc = h('section', { class: `tradetip is-${kind}${tout ? ' is-all' : ''}`, 'data-gap': `metier-${kind}` },
    h('div', { class: 'tradetip-head' },
      h('h3', { class: 'tradetip-title' }, pourLeMetier(s, sector)),
      h('span', { class: 'tradetip-count num' }, `${items.length} disponible${items.length > 1 ? 's' : ''}`),
      caches ? h('button', { class: 'tradetip-all', type: 'button', 'aria-expanded': String(tout), onClick: () => deplier() },
        tout ? 'Voir moins' : 'Voir toutes les suggestions') : null,
    ),

    h('div', { class: 'tradetip-items' },
      ...items.map((it, i) => {
        const montant = amountOf(kind, it, vocab)
        return h('button', {
          class: `tradetip-item${i >= VISIBLES ? ' is-extra' : ''}`,
          type: 'button',
          title: [montant, it.why || it.note].filter(Boolean).join(' — '),
          'aria-label': `Ajouter ${it.label} : ${montant}`,
          onClick: (e) => added(kind, it, vocab, navigate, refresh, e.currentTarget.getBoundingClientRect()),
        },
          h('span', { class: 'tradetip-plus', 'aria-hidden': 'true', html: PLUS }),
          h('span', { class: 'tradetip-label' }, it.label),
        )
      }),
      caches ? h('button', { class: 'tradetip-more num', type: 'button', title: `Voir les ${caches} autres suggestions`, onClick: () => deplier(true) }, `+${caches}`) : null,
    ),
  )
  // Déplier se fait sur place : la page ne se redessine pas, et le choix tient
  // jusqu'au changement de page — une suggestion ajoutée ne referme pas la liste.
  const deplier = (ouvrir = !bloc.classList.contains('is-all')) => {
    if (ouvrir) deplies.add(kind); else deplies.delete(kind)
    bloc.classList.toggle('is-all', ouvrir)
    const lien = bloc.querySelector('.tradetip-all')
    if (lien) { lien.textContent = ouvrir ? 'Voir moins' : 'Voir toutes les suggestions'; lien.setAttribute('aria-expanded', String(ouvrir)) }
  }
  return bloc
}

/* ───────────────────────── Le titre du bloc ─────────────────────────────── */

/** Trois pastilles d'abord ; les autres derrière « +N ». */
const VISIBLES = 3
/** Les natures dépliées, oubliées au changement de page. */
const deplies = new Set()
aOublier(() => deplies.clear())

/*
 * « Suggestions pour un glacier », « pour une pizzeria ».
 *
 * Le métier vient du catalogue ou du modèle économique : on connaît son
 * premier mot, donc son genre. Les métiers au féminin sont listés ici ; les
 * autres sont au masculin. Un métier tapé à la main, un pluriel (« Cours
 * particuliers ») ou une activité plutôt qu'un établissement (« Nettoyage
 * professionnel ») ne prennent pas d'article : le titre les cite tels quels.
 */
const FEMININS = new Set(['agence', 'animalerie', 'application', 'association', 'auberge', 'auto-ecole', 'bijouterie', 'boucherie',
  'boulangerie', 'boutique', 'box', 'brasserie', 'cantine', 'chambre', 'chocolaterie', 'conciergerie', 'creperie', 'dark',
  'ecole', 'epicerie', 'extension', 'fromagerie', 'librairie', 'location', 'marketplace', 'onglerie', 'papeterie', 'pizzeria',
  'poissonnerie', 'patisserie', 'sage-femme', 'salle', 'superette'])
const SANS_ARTICLE = new Set(['a', 'affiliation', 'aide', 'assistance', 'batiment', 'beaute', 'chaussures', 'coaching', 'cours',
  'cybersecurite', 'data', 'decoration', 'digital', 'dropshipping', 'formation', 'garde', 'infogerance', 'infoproduit', 'isolation',
  'jardinage', 'massage', 'menage', 'nettoyage', 'renovation', 'restauration', 'revente', 'sante', 'seconde', 'securite', 'services',
  'sport', 'terrassement', 'toilettage', 'travaux'])

// Construites depuis des chaînes : l'apostrophe typographique et les capitales
// accentuées ne doivent pas entrer telles quelles dans un littéral.
const ESPACE = new RegExp("[\\s\\u2019']")
const SIGLE = new RegExp('^[A-Z\\u00C0-\\u00DD]{2}')

function pourLeMetier(s, sector) {
  const nom = String(tradeName(s) || sector.label || '').split(' / ')[0].trim()
  const premier = norm(nom.split(ESPACE)[0]).replace(/ /g, '-')
  if (!nom || s.meta?.customActivity || SANS_ARTICLE.has(premier)) return nom ? `Suggestions — ${nom}` : 'Suggestions'
  // La minuscule, sauf pour un sigle ou un nom propre écrit en capitales.
  const dit = SIGLE.test(nom) ? nom : nom.charAt(0).toLowerCase() + nom.slice(1)
  return `Suggestions pour ${FEMININS.has(premier) ? 'une' : 'un'} ${dit}`
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
function added(kind, item, vocab, navigate, refresh, depuis) {
  const id = add(kind, item, vocab)
  if (kind === 'offers') {
    // On atterrissait sur « Volumes » : on venait d'accepter une idée, et la
    // première question posée était combien on en vend — avant même d'avoir vu
    // ce qu'elle coûte au client. Le prix d'abord ; les volumes sont l'onglet
    // d'à côté. Le départ attend que l'éclat ait joué : sinon le voyage
    // l'emporte avant qu'on l'ait vu.
    if (depuis) celebrate(depuis, { kind, label: item.label })
    // Vers la carte de la nouvelle offre, et elle seule : le reflet visait la
    // première zone « prix » de la page, celle de la première offre.
    setTimeout(() => goToGap({ route: 'offre', view: 'offres', sec: 'offre', ouvrir: id, anchor: 'prix', dans: `[data-row="${id}"]` }, navigate), 420)
    toast(`${item.label} ajouté. Vérifie son prix.`)
    return
  }
  toast(`${item.label} — ${amountOf(kind, item, vocab)}`, 'ok')
  refresh()
  if (depuis) celebrate(depuis, { kind, label: item.label, cible: id ? `[data-row="${id}"]` : null })
}

/* ───────────────────────── Ce qu'on ajoute au modèle ────────────────────── */

function add(kind, item, vocab) {
  if (kind === 'opex') {
    const shape = chargeShape(item, vocab)
    const made = newOpex({
      label: item.label,
      mode: shape.mode,
      monthlyAmount: shape.mode === 'fixed' ? shape.value : 0,
      perUnit: shape.mode === 'perUnit' ? shape.value : 0,
      pctRevenue: shape.mode === 'pctRevenue' ? shape.value : 0,
    })
    store.update((sc) => sc.opex.push(made), { label: `Ajout — ${item.label}` })
    return made.id
  }

  if (kind === 'capex') {
    const made = newCapex({
      label: item.label,
      amount: item.amount,
      // Un droit au bail ou un stock ne s'amortit pas : la durée reste à zéro,
      // et le moteur le laisse au bilan au lieu de l'étaler en charges.
      amortYears: item.years || 0,
    })
    store.update((sc) => sc.capex.push(made), { label: `Ajout — ${item.label}` })
    return made.id
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
  return made.id
}

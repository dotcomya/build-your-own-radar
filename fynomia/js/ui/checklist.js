/**
 * Tout ce qui reste à poser, du décisif au détail.
 *
 * Le parcours pose onze questions et s'arrête. Le fondateur arrive alors sur un
 * tableau de bord complet et croit avoir fini — alors qu'il lui manque le coût
 * de revient, les délais de paiement, sa propre rémunération, et la moitié de
 * ce qu'un financeur regarde en premier. Rien ne le lui dit.
 *
 * Cette liste le dit. Elle est ordonnée par ce que chaque ligne apporte au
 * dossier, pas par l'ordre des menus :
 *
 *  — FONDATIONS   sans elles, il n'y a pas de modèle, seulement des cases ;
 *  — CRÉDIBILITÉ  ce qu'un banquier ou un investisseur vérifie en premier ;
 *  — FINITION     ce qui distingue un dossier tenu d'un dossier bâclé.
 *
 * La barre d'avancement est pondérée : cocher « mutuelle » ne vaut pas cocher
 * « prix de vente ». Un fondateur qui remplit dans l'ordre proposé gagne le
 * maximum de crédibilité au minimum d'effort — c'est tout l'objet du classement.
 */

import store from '../state/store.js'

const n = (v) => Number(v) || 0
const any = (arr, fn) => (arr || []).some(fn)
const has = (arr) => (arr || []).length > 0

/** Les trois paliers, et ce que chaque ligne y pèse. */
export const TIERS = [
  { key: 'fondation', label: 'Fondations', weight: 3, note: 'Sans ça, le modèle ne calcule rien.' },
  { key: 'credibilite', label: 'Crédibilité', weight: 2, note: 'Ce qu’un financeur vérifie en premier.' },
  { key: 'finition', label: 'Finition', weight: 1, note: 'Ce qui distingue un dossier tenu.' },
]

/**
 * Une ligne : ce qu'elle apporte, comment on sait qu'elle est faite, et où
 * aller la faire. `go` reprend le vocabulaire du projecteur : route, onglet,
 * section de carte, repère à entourer.
 */
const ITEMS = [
  // ── Fondations ───────────────────────────────────────────────────────────
  { key: 'metier', tier: 'fondation', label: 'Ton métier', why: 'Commande la TVA, le statut et les repères de marge.',
    done: (s) => !!s.meta?.sectorKey,
    go: { route: 'projet', anchor: 'secteur' } },
  { key: 'forme', tier: 'fondation', label: 'La forme juridique', why: 'Décide du coût de ta rémunération.',
    done: (s) => !!s.meta?.legalFormChosen || !!s.meta?.legalForm,
    go: { route: 'projet', anchor: 'juridique' } },
  { key: 'offre', tier: 'fondation', label: 'Ce que tu vends', why: 'Le point de départ de tout le chiffre d’affaires.',
    done: (s) => any(s.activities, (a) => (a.name || '').trim() && a.name !== 'À définir'),
    go: { route: 'offre', view: 'offres', sec: 'offre', openAll: true, anchor: 'abonnement' } },
  { key: 'prix', tier: 'fondation', label: 'Le prix de vente', why: 'Sans prix, aucun revenu n’est calculable.',
    done: (s) => any(s.activities, (a) => n(a.unitPrice) > 0 || n(a.recurringPrice) > 0),
    go: { route: 'offre', view: 'offres', sec: 'prix', openAll: true, anchor: 'prix' } },
  { key: 'volumes', tier: 'fondation', label: 'Les volumes de vente', why: 'Le chiffre le plus discuté d’un business plan.',
    done: (s) => any(s.activities, (a) => n(a.volumes?.startUnits) > 0 || (a.volumes?.manual || []).some((v) => n(v) > 0)),
    go: { route: 'offre', view: 'offres', sec: 'volumes', openAll: true, anchor: 'volumes' } },
  { key: 'charges', tier: 'fondation', label: 'Tes charges fixes', why: 'Elles fixent le nombre de clients qu’il te faut.',
    done: (s) => has(s.opex),
    go: { route: 'achats', view: 'charges', anchor: 'charges' } },

  // ── Crédibilité ──────────────────────────────────────────────────────────
  { key: 'cout', tier: 'credibilite', label: 'Le coût de revient', why: 'Sans lui, la marge affichée est le prix entier.',
    done: (s) => any(s.activities, (a) => (n(a.unitPrice) > 0 ? n(a.unitCost) > 0 : n(a.recurringCost) > 0)),
    go: { route: 'offre', view: 'offres', sec: 'prix', openAll: true, anchor: 'prix' } },
  { key: 'salaire', tier: 'credibilite', label: 'Ta rémunération', why: 'Un plan où le fondateur ne se paie pas est faux.',
    done: (s) => any(s.team, (m) => /fondateur|dirigeant|moi|g/i.test(m.role || '') && n(m.monthlyGross) > 0),
    go: { route: 'equipe', view: 'postes', anchor: 'equipe' } },
  { key: 'apport', tier: 'credibilite', label: 'Ton apport', why: 'C’est ce qu’une banque regarde en premier.',
    done: (s) => has(s.financing?.equityFounders) || n(s.financing?.openingCash) > 0,
    go: { route: 'financement', view: 'sources', anchor: 'sources' } },
  { key: 'delai', tier: 'credibilite', label: 'Les délais de paiement', why: 'Ils créent le besoin en fonds de roulement.',
    done: (s) => any(s.activities, (a) => n(a.paymentLag) > 0 || n(a.deposit) > 0),
    go: { route: 'offre', view: 'offres', sec: 'paiement', openAll: true, anchor: 'paiement' } },
  { key: 'equipe', tier: 'credibilite', label: 'Les postes à recruter', why: 'Une croissance sans embauche se remarque.',
    done: (s) => (s.team || []).length > 1,
    go: { route: 'equipe', view: 'postes', anchor: 'equipe' } },
  { key: 'acquisition', tier: 'credibilite', label: 'Comment tu trouves tes clients', why: 'Relie une dépense marketing à des clients gagnés.',
    done: (s) => has(s.marketing),
    go: { route: 'offre', view: 'acquisition', anchor: 'campagnes' } },

  // ── Finition ─────────────────────────────────────────────────────────────
  { key: 'pitch', tier: 'finition', label: 'La description de l’activité', why: 'Alimente la partie narrative du dossier.',
    done: (s) => !!(s.meta?.pitch || '').trim(),
    go: { route: 'projet', anchor: 'pitch' } },
  { key: 'client', tier: 'finition', label: 'Le type de clientèle', why: 'Entreprises ou particuliers : pas les mêmes délais.',
    done: (s) => !!s.meta?.clientType,
    go: { route: 'projet', anchor: 'client' } },
  { key: 'capex', tier: 'finition', label: 'Tes investissements', why: 'Le matériel durable s’amortit au lieu de passer en charge.',
    done: (s) => has(s.capex),
    go: { route: 'achats', view: 'invest', anchor: 'capex' } },
  { key: 'churn', tier: 'finition', label: 'L’attrition des abonnements', why: 'Un abonnement sans attrition surestime le revenu.',
    done: (s) => !any(s.activities, (a) => n(a.recurringPrice) > 0 && n(a.churnMonthly) === 0),
    go: { route: 'offre', view: 'offres', sec: 'offre', openAll: true, anchor: 'abonnement' } },
  { key: 'avantages', tier: 'finition', label: 'Les avantages salariés', why: 'Mutuelle et transport sont obligatoires dès le premier salarié.',
    done: (s) => !any(s.team, (m) => ['cdi', 'cdd'].includes(m.contractType)) || n(s.hr?.benefits?.transport) > 0,
    go: { route: 'equipe', view: 'avantages', anchor: 'avantages' } },
  { key: 'prixAnnee', tier: 'finition', label: 'L’évolution des prix', why: 'Un prix figé cinq ans se remarque aussi.',
    done: (s) => any(s.activities, (a) => (a.priceByYear || []).some((v) => v !== '' && v !== null && v !== undefined)
      || (a.recurringPriceByYear || []).some((v) => v !== '' && v !== null && v !== undefined)),
    go: { route: 'offre', view: 'offres', sec: 'evolution', openAll: true, anchor: 'evolution' } },
  { key: 'emprunt', tier: 'finition', label: 'Un emprunt ou une subvention', why: 'Rarement absent d’un plan de création.',
    done: (s) => has(s.financing?.loans) || has(s.financing?.grants),
    go: { route: 'financement', view: 'sources', anchor: 'sources' } },
]

/* ─────────────────────── Ce qu'on a remis à plus tard ─────────────────────
   Le fondateur a le droit de ne pas vouloir poser sa rémunération un mardi
   matin. Ce qu'il n'a pas le droit de faire, c'est de la perdre : « plus
   tard » range la ligne en fin de file, il ne la supprime pas.

   La file est ordonnée — la plus anciennement reportée en tête. Quand tout
   ce qui reste a été reporté, on repropose celle qui attend depuis le plus
   longtemps, en le disant. Reporter de nouveau la renvoie en queue : le tour
   tourne, rien ne disparaît. */
const later = []

/** Remettre une ligne à plus tard — ou la renvoyer en queue si elle y était. */
export function defer(key) {
  const at = later.indexOf(key)
  if (at >= 0) later.splice(at, 1)
  later.push(key)
  return later.length
}

/** Tout reprendre maintenant : la file est vidée. */
export function resumeAll() { later.length = 0 }

/** Combien de lignes attendent leur tour. */
export function deferredCount() { return later.length }

/**
 * L'état de la liste : chaque ligne, son palier, et l'avancement pondéré.
 */
export function checklist(scenario) {
  const s = scenario || store.scenario || {}
  const weightOf = (tier) => TIERS.find((t) => t.key === tier)?.weight || 1

  const items = ITEMS.map((it) => {
    let ok = false
    try { ok = !!it.done(s) } catch { ok = false }
    return { ...it, done: ok, weight: weightOf(it.tier) }
  })

  const groups = TIERS.map((t) => {
    const mine = items.filter((i) => i.tier === t.key)
    return { ...t, items: mine, done: mine.filter((i) => i.done).length, total: mine.length }
  })

  const max = items.reduce((a, i) => a + i.weight, 0)
  const got = items.filter((i) => i.done).reduce((a, i) => a + i.weight, 0)

  // Une ligne posée n'a plus à attendre son tour : on la sort de la file.
  const open = items.filter((i) => !i.done)
  for (let k = later.length - 1; k >= 0; k--) {
    if (!open.some((o) => o.key === later[k])) later.splice(k, 1)
  }
  for (const it of items) it.later = later.includes(it.key)

  // La prochaine chose à faire est la plus lourde encore ouverte, dans l'ordre
  // des paliers : on ne propose pas la mutuelle à qui n'a pas encore de prix.
  // Sauf celles qu'on a reportées — jusqu'à ce qu'il ne reste qu'elles.
  let next = open.find((i) => !i.later) || null
  let again = false
  if (!next && later.length) {
    next = open.find((i) => i.key === later[0]) || null
    again = !!next
  }

  return {
    items, groups, next, again,
    done: items.filter((i) => i.done).length,
    total: items.length,
    open: open.length,
    later: later.length,
    ratio: max > 0 ? got / max : 0,
  }
}

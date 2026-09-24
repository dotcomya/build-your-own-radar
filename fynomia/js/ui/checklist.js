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
import { stageOf, liftRank } from './stages.js'

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
  // L'ordre de cette liste est l'ordre de ce qu'on propose : du chiffre qui
  // porte tout le plan au détail qui l'affine. Les délais de paiement et la
  // hausse des prix venaient trop tôt — ils comptent, mais bien après le prix,
  // les volumes, le coût de revient et ta propre rémunération.

  // ── Fondations ───────────────────────────────────────────────────────────
  { key: 'metier', tier: 'fondation', label: 'Ton métier', why: 'Il règle la TVA, les cotisations et les repères de prix de ton activité.',
    done: (s) => !!s.meta?.sectorKey,
    go: { route: 'projet', anchor: 'secteur' } },
  { key: 'offre', tier: 'fondation', label: 'Ce que tu vends', why: 'Sans offre, il n’y a pas de chiffre d’affaires à calculer.',
    done: (s) => any(s.activities, (a) => (a.name || '').trim() && a.name !== 'À définir'),
    go: { route: 'offre', view: 'offres', sec: 'offre', openAll: true, anchor: 'abonnement' } },
  { key: 'prix', tier: 'fondation', label: 'Le prix de vente', why: 'Sans prix, aucun revenu ne peut être calculé.',
    revoir: 'Tu l’as posé en une question : relis-le, c’est le chiffre qui porte tout le plan.',
    done: (s) => any(s.activities, (a) => n(a.unitPrice) > 0 || n(a.recurringPrice) > 0),
    go: { route: 'offre', view: 'offres', sec: 'offre', openAll: true, anchor: 'prix' } },
  { key: 'volumes', tier: 'fondation', label: 'Les volumes de vente', why: 'C’est le chiffre qu’un banquier challenge en premier.',
    revoir: 'Un banquier le challengera en premier : vérifie que ce rythme est tenable avec tes moyens.',
    done: (s) => any(s.activities, (a) => n(a.volumes?.startUnits) > 0 || (a.volumes?.manual || []).some((v) => n(v) > 0)),
    go: { route: 'offre', view: 'offres', sec: 'volumes', openAll: true, anchor: 'volumes' } },
  // Le coût de revient ne se saisit plus dans le prix : il vit en charge par
  // vente, où on le voit à côté des autres coûts et où il ne peut plus être
  // compté deux fois. La ligne est donc considérée posée des deux côtés, et
  // elle emmène désormais là où on la modifie.
  { key: 'cout', tier: 'fondation', label: 'Le coût de revient', why: 'Sans lui, le plan croit que tout le prix te reste.',
    revoir: 'Ce qu’une vente te coûte décide de ta marge : vérifie qu’il ne manque rien.',
    done: (s) => any(s.activities, (a) => (n(a.unitPrice) > 0 ? n(a.unitCost) > 0 : n(a.recurringCost) > 0))
      || any(s.opex, (o) => o.enabled !== false && (n(o.perUnit) > 0 || n(o.pctRevenue) > 0)),
    go: { route: 'achats', view: 'charges', anchor: 'charges' } },
  { key: 'charges', tier: 'fondation', label: 'Tes charges fixes', why: 'Loyer, logiciels, assurances : elles tombent même les mois sans vente.',
    revoir: 'Tu les as cochées en un clic : ajuste les montants à ta situation.',
    done: (s) => has(s.opex),
    go: { route: 'achats', view: 'charges', anchor: 'charges' } },

  // ── Crédibilité ──────────────────────────────────────────────────────────
  { key: 'salaire', tier: 'credibilite', label: 'Ta rémunération', why: 'Un plan où le fondateur ne se paie pas n’est pas crédible.',
    revoir: 'Vérifie que ce salaire te fait vivre : c’est aussi ce qu’il coûte à l’entreprise.',
    done: (s) => any(s.team, (m) => /fondateur|dirigeant|moi|g/i.test(m.role || '') && n(m.monthlyGross) > 0),
    go: { route: 'equipe', view: 'postes', anchor: 'equipe' } },
  { key: 'apport', tier: 'credibilite', label: 'Ton apport', why: 'C’est ce qu’une banque regarde en premier.',
    revoir: 'Ce que tu mets sur la table au départ : c’est ce qu’une banque regarde en premier.',
    done: (s) => has(s.financing?.equityFounders) || n(s.financing?.openingCash) > 0,
    go: { route: 'financement', view: 'sources', anchor: 'sources' } },
  { key: 'equipe', tier: 'credibilite', label: 'Les postes à recruter', why: 'Vendre deux fois plus sans embaucher personne ne paraît pas crédible.',
    done: (s) => (s.team || []).length > 1,
    go: { route: 'equipe', view: 'postes', anchor: 'equipe' } },
  { key: 'forme', tier: 'credibilite', defaut: true, label: 'La forme juridique', why: 'Ton statut décide de tes cotisations, donc de ce que te coûte ton propre salaire.',
    done: (s) => !!s.meta?.legalFormChosen || !!s.meta?.confirmes?.forme,
    go: { route: 'projet', anchor: 'juridique' } },
  { key: 'demarrage', tier: 'credibilite', defaut: true, label: 'Ta date de démarrage', why: 'Tout le calendrier en part : premières ventes, salaires, échéances.',
    done: (s) => !!s.meta?.startDateChosen || !!s.meta?.confirmes?.demarrage || (!!s.meta?.startDate && s.meta.startDate !== '2026-01-01'),
    go: { route: 'projet', anchor: 'demarrage' } },
  { key: 'emprunt', tier: 'credibilite', label: 'Un emprunt ou une subvention', why: 'La plupart des créations en ont un : c’est ce qui complète ton apport.',
    done: (s) => has(s.financing?.loans) || has(s.financing?.grants),
    go: { route: 'financement', view: 'sources', anchor: 'sources' } },
  { key: 'acquisition', tier: 'credibilite', label: 'Comment tu trouves tes clients', why: 'Combien coûte un nouveau client, et d’où il vient.',
    done: (s) => has(s.marketing),
    go: { route: 'offre', view: 'acquisition', anchor: 'campagnes' } },
  { key: 'churn', tier: 'credibilite', label: 'Les clients qui résilient', why: 'Sans départs prévus, le revenu des abonnements est surestimé.',
    done: (s) => !any(s.activities, (a) => n(a.recurringPrice) > 0 && n(a.churnMonthly) === 0),
    na: (s) => !any(s.activities, (a) => n(a.recurringPrice) > 0),
    go: { route: 'offre', view: 'offres', sec: 'affiner', openAll: true, anchor: 'tune-contrat' } },
  { key: 'capacite', tier: 'credibilite', label: 'Ton plafond de capacité', why: 'Personne ne sert mille couverts dans vingt places.',
    done: (s) => any(s.activities, (a) => n(a.volumes?.cap) > 0 || a.volumes?.mode === 'manual'),
    go: { route: 'offre', view: 'offres', sec: 'volumes', openAll: true, anchor: 'volumes' } },
  { key: 'croissance', tier: 'credibilite', defaut: true, label: 'Le rythme de croissance',
    why: '8 % de plus par mois, c’est plus du double chaque année : il faut pouvoir le justifier.',
    done: (s) => !!s.meta?.croissanceChoisie || !!s.meta?.confirmes?.croissance || any(s.activities, (a) => n(a.volumes?.monthlyGrowth) !== 0.08 || a.volumes?.mode === 'manual'),
    go: { route: 'offre', view: 'offres', sec: 'volumes', openAll: true, anchor: 'volumes' } },

  // ── Finition ─────────────────────────────────────────────────────────────
  { key: 'pitch', tier: 'finition', label: 'La description de l’activité', why: 'C’est le texte que liront ton banquier et tes investisseurs.',
    done: (s) => !!(s.meta?.pitch || '').trim(),
    go: { route: 'projet', anchor: 'pitch' } },
  { key: 'client', tier: 'finition', label: 'Le type de clientèle', why: 'Entreprises ou particuliers ne paient pas dans les mêmes délais.',
    done: (s) => !!s.meta?.clientType,
    go: { route: 'projet', anchor: 'client' } },
  { key: 'capex', tier: 'finition', label: 'Tes investissements', why: 'Le matériel acheté au départ : payé d’un coup, compté sur plusieurs années.',
    done: (s) => has(s.capex),
    go: { route: 'achats', view: 'invest', anchor: 'capex' } },
  { key: 'avantages', tier: 'finition', label: 'Les avantages salariés', why: 'Mutuelle et transport sont obligatoires dès le premier salarié.',
    done: (s) => !any(s.team, (m) => ['cdi', 'cdd'].includes(m.contractType)) || n(s.hr?.benefits?.transport) > 0,
    na: (s) => !any(s.team, (m) => ['cdi', 'cdd'].includes(m.contractType)),
    go: { route: 'equipe', view: 'avantages', anchor: 'avantages' } },
  { key: 'stock', tier: 'finition', label: 'Ton stock', why: 'Le stock, c’est de l’argent bloqué sur tes étagères avant d’être vendu.',
    done: (s) => n(s.assumptions?.stockDays) > 0 || !needsStock(s),
    na: (s) => !needsStock(s) && !(n(s.assumptions?.stockDays) > 0),
    go: { route: 'reglages', anchor: 'stock' } },
  { key: 'delai', tier: 'finition', label: 'Les délais de paiement', why: 'Si tes clients paient à 30 ou 60 jours, c’est de l’argent que tu avances en attendant.',
    done: (s) => any(s.activities, (a) => n(a.paymentLag) > 0 || n(a.deposit) > 0),
    go: { route: 'offre', view: 'offres', sec: 'affiner', openAll: true, anchor: 'tune-paiement' } },

  // ── Pour aller plus loin ─────────────────────────────────────────────────
  // Facultatif : ces lignes ne sont jamais proposées comme « prochaine
  // étape » et ne comptent pas contre l'avancement. Un prix qui ne bouge pas
  // en cinq ans est un choix parfaitement défendable ; on ne le reproche pas.
  { key: 'saison', tier: 'finition', optionnel: true, label: 'Ta saisonnalité',
    why: 'Si ton activité a des mois creux, dis-le : ils ne se voient pas dans une moyenne, mais ils vident le compte.',
    done: (s) => any(s.activities, (a) => a.volumes?.mode === 'manual' || !!a.volumes?.seasonality),
    go: { route: 'offre', view: 'offres', sec: 'volumes', openAll: true, anchor: 'saison' } },
  { key: 'secondeoffre', tier: 'finition', optionnel: true, label: 'Une deuxième source de revenu',
    why: 'Si tu as une autre offre en tête, ajoute-la : elle protège le plan d’un seul client ou d’un seul produit.',
    done: (s) => (s.activities || []).filter((a) => n(a.unitPrice) > 0 || n(a.recurringPrice) > 0).length > 1,
    go: { route: 'offre', view: 'offres', anchor: 'ajout-offre' } },
  { key: 'prixAnnee', tier: 'finition', optionnel: true, label: 'La hausse de tes prix', why: 'Si tu comptes augmenter tes prix d’une année à l’autre, dis-le ici. Sinon, rien à faire.',
    done: (s) => any(s.activities, (a) => (a.priceByYear || []).some((v) => v !== '' && v !== null && v !== undefined)
      || (a.recurringPriceByYear || []).some((v) => v !== '' && v !== null && v !== undefined)),
    go: { route: 'offre', view: 'offres', sec: 'affiner', openAll: true, anchor: 'tune-evolution' } },
  { key: 'coutannee', tier: 'finition', optionnel: true, label: 'La hausse de tes coûts',
    why: 'Si tes achats vont augmenter avec le temps, dis-le ici. Sinon, rien à faire.',
    done: (s) => any(s.activities, (a) => (a.unitCostByYear || []).some((v) => v !== '' && v !== null && v !== undefined)),
    go: { route: 'offre', view: 'offres', sec: 'affiner', openAll: true, anchor: 'tune-evolution' } },
  { key: 'paiefournisseur', tier: 'finition', optionnel: true, label: 'Tes délais fournisseurs',
    why: 'Si tu paies tes fournisseurs à 30 jours, l’argent reste un mois de plus sur ton compte.',
    done: (s) => any(s.activities, (a) => n(a.costPaymentLag) > 0),
    go: { route: 'offre', view: 'offres', sec: 'affiner', openAll: true, anchor: 'tune-paiement' } },
  { key: 'dividendes', tier: 'finition', optionnel: true, label: 'Tes dividendes',
    why: 'Si tu comptes te verser une part du bénéfice, en plus ou à la place d’un salaire.',
    done: (s) => n(s.founder?.dividendPayout) > 0,
    go: { route: 'resultats', view: 'revenu', anchor: 'dividendes' } },
]

/**
 * Ce qu'une ligne dit, selon où elle en est.
 *
 * Le guide disait « Ta date de démarrage » : un nom, pas un geste. Le
 * fondateur ne savait pas s'il fallait la changer, la vérifier ou la
 * découvrir. Chaque ligne a donc trois écritures :
 *
 *   a — ce qu'il y a à faire, à l'infinitif, sans détour ;
 *   v — ce qu'il y a à relire, pour une réponse donnée dans le parcours ;
 *   n — ce qui est fait, en un nom, dans la liste des lignes posées.
 */
const TEXTES = {
  metier: { a: 'Choisir ton métier', n: 'Ton métier' },
  offre: { a: 'Nommer ton produit phare', n: 'Ton produit phare' },
  prix: { a: 'Fixer ton prix de vente', v: 'Valider ton prix de vente', n: 'Ton prix de vente' },
  volumes: { a: 'Estimer tes ventes du premier mois', v: 'Valider tes volumes de vente', n: 'Tes volumes de vente' },
  cout: { a: 'Chiffrer ce que te coûte une vente', v: 'Valider ton coût de revient', n: 'Ton coût de revient' },
  charges: { a: 'Lister tes charges fixes', v: 'Valider tes charges fixes', n: 'Tes charges fixes' },
  salaire: { a: 'Fixer ta rémunération', v: 'Valider ta rémunération', n: 'Ta rémunération' },
  apport: { a: 'Indiquer ton apport', v: 'Valider ton apport', n: 'Ton apport' },
  equipe: { a: 'Prévoir tes recrutements', n: 'Tes recrutements' },
  forme: { a: 'Valider ton statut juridique', n: 'Ton statut juridique' },
  demarrage: { a: 'Valider la date de début d’activité', n: 'Ta date de début d’activité' },
  emprunt: { a: 'Ajouter un emprunt ou une subvention', n: 'Un emprunt ou une subvention' },
  acquisition: { a: 'Chiffrer ce que coûte un nouveau client', n: 'Le coût d’un nouveau client' },
  churn: { a: 'Estimer les clients qui résilient', n: 'Les résiliations' },
  capacite: { a: 'Fixer ta capacité maximale', n: 'Ta capacité maximale' },
  croissance: { a: 'Valider ton rythme de croissance', n: 'Ton rythme de croissance' },
  pitch: { a: 'Décrire ton activité en une phrase', n: 'La description de ton activité' },
  client: { a: 'Préciser qui sont tes clients', n: 'Tes clients' },
  capex: { a: 'Lister tes investissements de départ', n: 'Tes investissements' },
  avantages: { a: 'Valider les avantages salariés', n: 'Les avantages salariés' },
  stock: { a: 'Estimer ton stock', n: 'Ton stock' },
  delai: { a: 'Indiquer quand tes clients te paient', n: 'Les délais de paiement clients' },
  saison: { a: 'Ajouter tes mois creux et tes mois forts', n: 'Ta saisonnalité' },
  secondeoffre: { a: 'Ajouter un deuxième produit', n: 'Un deuxième produit' },
  prixAnnee: { a: 'Prévoir une hausse de tes prix', n: 'La hausse de tes prix' },
  coutannee: { a: 'Prévoir une hausse de tes coûts', n: 'La hausse de tes coûts' },
  paiefournisseur: { a: 'Indiquer quand tu paies tes fournisseurs', n: 'Tes délais fournisseurs' },
  dividendes: { a: 'Prévoir tes dividendes', n: 'Tes dividendes' },
}

/**
 * Ce que le parcours a posé, à relire.
 *
 * Le parcours pose onze questions en quelques minutes : les réponses sont
 * justes dans l'ordre de grandeur, rarement au centime. Juste après, le plus
 * utile n'est pas d'ouvrir des réglages avancés — c'est de relire ces
 * réponses-là, là où elles se corrigent. Elles passent donc en tête de ce
 * qu'on propose, avant les lignes jamais remplies qui comptent moins.
 * Relire une ligne (y aller, ou dire « c'est bon ») suffit à la valider.
 */
export const A_CONFIRMER = ['prix', 'volumes', 'cout', 'charges', 'salaire', 'apport']

/** Les réponses du parcours qui méritent d'être relues, selon ce qui y a été répondu. */
export function aConfirmerDepuis(etapes) {
  const pont = { prix: 'prix', clients: 'volumes', cout: 'cout', frais: 'charges', salaire: 'salaire', depart: 'apport' }
  return A_CONFIRMER.filter((k) => Object.entries(pont).some(([etape, cle]) => cle === k && etapes.has(etape)))
}

/** Valider une ligne relue. */
export function confirmer(key, { silent = true } = {}) {
  store.update((sc) => { sc.meta.confirmes = { ...(sc.meta.confirmes || {}), [key]: true } }, { label: 'Relu', silent })
}

/** Un métier sans marchandise n'a pas de stock à déclarer. */
function needsStock(s) {
  return any(s.activities, (a) => n(a.unitCost) > 0)
}

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

/**
 * L'état de la liste : chaque ligne, son palier, et l'avancement pondéré.
 */
export function checklist(scenario) {
  const s = scenario || store.scenario || {}
  const weightOf = (tier) => TIERS.find((t) => t.key === tier)?.weight || 1

  // Le stade du projet remonte quelques lignes devant les autres : celui qui
  // monte un dossier bancaire n'a pas le même « ensuite » que celui qui teste
  // une idée. À rang égal, l'ordre des paliers reprend la main.
  const stage = stageOf(s)
  const aRelire = new Set((s.meta?.aConfirmer || []).filter((k) => !s.meta?.confirmes?.[k]))
  const items = ITEMS.map((it, rank) => {
    let ok = false
    try { ok = !!it.done(s) } catch { ok = false }
    // Une ligne qui ne concerne pas l'activité — pas de stock, pas
    // d'abonnement, pas de salarié — compte comme posée, mais se dit telle.
    let na = false
    try { na = ok && !!it.na?.(s) } catch { na = false }
    const relire = ok && aRelire.has(it.key)
    const t = TEXTES[it.key] || {}
    // Une valeur posée par défaut (le statut, la date, la TVA) se valide en
    // y allant : l'avoir sous les yeux, là où elle se change, suffit.
    const confirme = relire || (!ok && it.defaut)
    return {
      ...it, done: ok, na, relire, aValider: !ok && !!it.defaut,
      label: ok && !relire ? (t.n || it.label) : relire ? (t.v || t.a || it.label) : (t.a || it.label),
      why: relire && it.revoir ? it.revoir : it.why,
      go: confirme ? { ...it.go, confirme: it.key } : it.go,
      weight: weightOf(it.tier), rank, lift: liftRank(stage, it.key),
    }
  }).sort((a, b) => (a.lift - b.lift) || (a.rank - b.rank))

  const groups = TIERS.map((t) => {
    const mine = items.filter((i) => i.tier === t.key)
    return { ...t, items: mine, done: mine.filter((i) => i.done).length, total: mine.length }
  })

  // Une ligne facultative ne compte que si elle est faite : elle ajoute au
  // dossier, elle ne lui retire rien.
  const comptees = items.filter((i) => !i.optionnel || i.done)
  const max = comptees.reduce((a, i) => a + i.weight, 0)
  const got = comptees.filter((i) => i.done).reduce((a, i) => a + i.weight, 0)

  // Une ligne posée n'a plus à attendre son tour : on la sort de la file.
  const open = items.filter((i) => !i.done)
  const aFaire = [...open.filter((i) => !i.optionnel), ...items.filter((i) => i.relire)]
  for (let k = later.length - 1; k >= 0; k--) {
    if (!aFaire.some((o) => o.key === later[k])) later.splice(k, 1)
  }
  for (const it of items) it.later = later.includes(it.key)

  // La prochaine chose à proposer, dans cet ordre : les fondations qui
  // manquent (sans prix, rien ne se calcule), puis les réponses du parcours à
  // relire, puis le reste dans l'ordre d'importance. Jamais une ligne
  // facultative. Sauf celles qu'on a reportées — jusqu'à ce qu'il ne reste
  // qu'elles.
  const file = [
    ...open.filter((i) => !i.optionnel && i.tier === 'fondation'),
    ...items.filter((i) => i.relire),
    ...open.filter((i) => !i.optionnel && i.tier !== 'fondation'),
  ]
  let next = file.find((i) => !i.later) || null
  let again = false
  if (!next && later.length) {
    next = file.find((i) => i.key === later[0]) || null
    again = !!next
  }

  return {
    items, groups, next, again, file,
    done: comptees.filter((i) => i.done).length,
    total: comptees.length,
    open: file.length,
    later: later.length,
    ratio: max > 0 ? got / max : 0,
  }
}

/* ───────────────────────── Par axe, et où ça mène ─────────────────────────
   Les paliers disent ce qu'une ligne pèse ; le fondateur, lui, pense en
   pages : « mon offre », « mon équipe », « mes charges ». Les mêmes lignes se
   rangent donc aussi par axe, et chacune dit où elle emmène, en toutes
   lettres — pas « Crédibilité », mais « Offre et revenus › Volumes ». */

/** Les axes du dossier, dans l'ordre des pages. */
export const AXES = [
  { key: 'projet', label: 'Mon projet', court: 'Projet', dit: 'Le métier, la forme, le calendrier' },
  { key: 'offre', label: 'Offre et revenus', court: 'Offre', dit: 'Ce que tu vends, à quel prix, à combien' },
  { key: 'achats', label: 'Achats et coûts', court: 'Achats', dit: 'Ce que tu dépenses, et ce qui dure' },
  { key: 'equipe', label: 'Équipe et rémunération', court: 'Équipe', dit: 'Qui travaille, combien ça coûte' },
  { key: 'financement', label: 'Financement', court: 'Financement', dit: 'D’où vient l’argent du départ' },
]

const PAGE = { reglages: 'Réglages', projet: 'Mon projet', offre: 'Offre et revenus', achats: 'Achats et coûts', equipe: 'Équipe', financement: 'Financement', resultats: 'États financiers' }
const VUE = {
  offres: null, acquisition: 'Acquisition', charges: 'Charges', invest: 'Investissements',
  postes: 'Postes', avantages: 'Avantages', sources: 'Sources', revenu: 'Ce que tu touches',
}
const SOUS = { offre: 'Paramètres de base', volumes: 'Volumes', affiner: 'Hypothèses avancées' }
const REPERE = {
  secteur: 'Type d’activité', juridique: 'Statut juridique', stock: 'Stock moyen', 'ajout-offre': 'Ajouter une offre', pitch: 'Décris ce que tu vends', client: 'Le client',
  demarrage: 'Début d’activité', prix: 'Prix', abonnement: 'Prix', 'tune-paiement': 'Délais de paiement et acomptes', tva: 'Régime de TVA',
  'tune-evolution': 'Hausse des prix', 'tune-contrat': 'Durée d’engagement et résiliations', dividendes: 'Dividendes',
}

/** L'axe d'une ligne : la page où elle se remplit (la rémunération rejoint l'équipe). */
export function axeDe(item) {
  const r = item?.go?.route
  // La rémunération rejoint l'équipe ; le stock, réglé dans les réglages,
  // rejoint les achats.
  return r === 'resultats' ? 'equipe' : r === 'reglages' ? 'achats' : (AXES.some((a) => a.key === r) ? r : 'projet')
}

/** Où une ligne emmène, en clair : « Offre et revenus › Hypothèses avancées › Délais de paiement et acomptes ». */
export function destination(item) {
  const g = item?.go || {}
  const morceaux = [PAGE[g.route] || g.route]
  if (g.view && VUE[g.view]) morceaux.push(VUE[g.view])
  if (g.sec && SOUS[g.sec]) morceaux.push(SOUS[g.sec])
  if (g.anchor && REPERE[g.anchor] && !morceaux.includes(REPERE[g.anchor])) morceaux.push(REPERE[g.anchor])
  return morceaux.filter(Boolean).join(' › ')
}

/** Les lignes rangées par axe, avec l'avancement de chacun. */
export function parAxe(c) {
  // Ce qui reste se lit dans l'ordre où on le propose — le même que le
  // guide et le pilotage — les réponses à relire comprises ; le facultatif
  // ferme la marche.
  const ordre = new Map((c.file || []).map((i, k) => [i.key, k]))
  const rang = (i) => (ordre.has(i.key) ? ordre.get(i.key) : 1000 + (i.rank || 0))
  return AXES.map((a) => {
    const lignes = c.items.filter((i) => axeDe(i) === a.key)
    // Une réponse à relire est posée — elle compte dans l'avancement — mais
    // elle se range dans ce qui reste, là où on la relit.
    const posees = lignes.filter((i) => i.done).length
    const faites = lignes.filter((i) => i.done && !i.relire)
    const reste = lignes.filter((i) => !i.done || i.relire).sort((x, y) => rang(x) - rang(y))
    return { ...a, lignes, faites, reste, posees, part: lignes.length ? posees / lignes.length : 1 }
  }).filter((a) => a.lignes.length)
}

/**
 * Schéma du scénario : valeurs par défaut, garde-fous de saisie et modèles
 * de démarrage.
 *
 * Chaque champ déclare ses bornes et son unité. L'interface s'appuie sur ces
 * déclarations pour brider la saisie — l'utilisateur ne peut pas entrer une
 * marge de 4 000 % ou un délai de paiement de 90 mois — et pour afficher les
 * aides contextuelles.
 */

export const SCHEMA_VERSION = 1
export const LEVELS = ['easy', 'intermediate', 'advanced']

export const LEVEL_META = {
  easy: {
    label: 'Facile', short: 'Facile',
    tagline: 'Une offre, quelques clients, un résultat.',
    description: "Le strict nécessaire pour chiffrer une idée : ce que tu vends, à quel prix, à combien de clients, et ce que ça coûte. Les délais de paiement, la TVA et les cotisations sont calculés avec des valeurs de marché que tu n'as pas à connaître.",
  },
  intermediate: {
    label: 'Intermédiaire', short: 'Inter.',
    tagline: 'Plusieurs offres, des campagnes, du financement.',
    description: "Tu pilotes plusieurs sources de revenus, tu branches tes campagnes marketing sur ton acquisition client, tu gères tes investissements et tes emprunts. Les conditions de paiement deviennent modifiables.",
  },
  advanced: {
    label: 'Expert', short: 'Expert',
    tagline: 'Bilan, BFR, CIR, JEI, analyse par activité.',
    description: "Le modèle complet : besoin en fonds de roulement mois par mois, bilan prévisionnel, plan de financement, crédits d'impôt recherche et innovation, statut jeune entreprise innovante, et rentabilité comparée de chaque activité.",
  },
}

/** Bornes de saisie. La validation les applique systématiquement. */
export const BOUNDS = {
  unitPrice: { min: 0, max: 10000000, step: 1, unit: '€ HT' },
  recurringPrice: { min: 0, max: 1000000, step: 1, unit: '€ HT/mois' },
  contractMonths: { min: 0, max: 120, step: 1, unit: 'mois' },
  deliveryLag: { min: 0, max: 24, step: 1, unit: 'mois' },
  paymentLag: { min: 0, max: 12, step: 1, unit: 'mois' },
  deposit: { min: 0, max: 1, step: 0.05, unit: '%' },
  milestone: { min: 0, max: 1, step: 0.05, unit: '%' },
  churnMonthly: { min: 0, max: 0.5, step: 0.005, unit: '%/mois' },
  startUnits: { min: 0, max: 1000000, step: 1, unit: 'unités' },
  monthlyGrowth: { min: -0.5, max: 1, step: 0.01, unit: '%/mois' },
  growthDecay: { min: 0.8, max: 1, step: 0.005, unit: 'coefficient' },
  monthlyGross: { min: 0, max: 100000, step: 50, unit: '€/mois' },
  count: { min: 0, max: 500, step: 1, unit: 'personnes' },
  rdShare: { min: 0, max: 1, step: 0.05, unit: '%' },
  month: { min: 0, max: 59, step: 1, unit: 'mois' },
  amount: { min: 0, max: 100000000, step: 100, unit: '€' },
  amortYears: { min: 0, max: 20, step: 1, unit: 'ans' },
  rate: { min: 0, max: 0.25, step: 0.001, unit: '%' },
  months: { min: 1, max: 360, step: 1, unit: 'mois' },
  monthlyBudget: { min: 0, max: 1000000, step: 50, unit: '€/mois' },
  cpc: { min: 0.01, max: 100, step: 0.05, unit: '€' },
  cpm: { min: 0.1, max: 500, step: 0.5, unit: '€' },
  cpl: { min: 0.1, max: 5000, step: 1, unit: '€' },
  cac: { min: 1, max: 100000, step: 10, unit: '€' },
  ctr: { min: 0, max: 0.5, step: 0.001, unit: '%' },
  visitToLead: { min: 0, max: 1, step: 0.005, unit: '%' },
  leadToClient: { min: 0, max: 1, step: 0.01, unit: '%' },
  pctRevenue: { min: 0, max: 0.5, step: 0.005, unit: '% du CA' },
  perEmployee: { min: 0, max: 10000, step: 10, unit: '€/salarié/mois' },
  monthlyAmount: { min: 0, max: 1000000, step: 50, unit: '€/mois' },
  stockDays: { min: 0, max: 365, step: 1, unit: 'jours' },
  vatRate: { min: 0, max: 0.25, step: 0.001, unit: '%' },
}

export function clampField(field, value) {
  const b = BOUNDS[field]
  if (!b) return value
  if (value === '' || value === null || value === undefined) return value
  const n = Number(value)
  if (!Number.isFinite(n)) return b.min
  return Math.min(b.max, Math.max(b.min, n))
}

export const uid = (prefix = 'id') => `${prefix}_${Math.random().toString(36).slice(2, 9)}`

export function newActivity(overrides = {}) {
  return {
    id: uid('act'), name: 'Nouvelle offre',
    // Comment cette offre rapporte : une vente ferme, un abonnement, ou une
    // commission sur une affaire apportée. Les trois s'excluent — une offre
    // qui serait deux choses à la fois en fait deux, et le modèle se lit
    // mieux ainsi. La commission n'est pas un troisième calcul : c'est un
    // prix de vente obtenu en multipliant le montant de l'affaire par le
    // pourcentage retenu, donc le moteur n'a rien de spécial à savoir.
    priceMode: 'unit', dealValue: 0, commissionRate: 0,
    unitPrice: 500, recurringPrice: 0, contractMonths: 12,
    // Le rythme de l'abonnement ne concerne que la saisie : le montant reste
    // mensuel pour le moteur, qui compte en mois de bout en bout.
    recurringPeriod: 'mois',
    // Payé en une fois à la commande, et rien d'autre : c'est le cas le plus
    // fréquent et le seul qu'on puisse poser sans rien savoir du métier. Qui
    // facture à trente jours le dira lui-même — on ne lui invente pas un
    // décalage de trésorerie dont il n'a jamais parlé.
    // Les hypothèses avancées naissent éteintes, à zéro.
    //
    // Un acompte de cent pour cent, une attrition de deux pour cent et un mois
    // de délai fournisseur étaient posés d'office : trois hypothèses que
    // personne n'avait formulées mais qui pesaient sur la trésorerie dès la
    // première offre. Le cas neutre est le comptant sans attrition ; ce qui
    // s'en écarte se déclare, dans l'onglet prévu pour ça.
    deliveryLag: 0, paymentLag: 0, deposit: 0, milestone: 0, churnMonthly: 0,
    unitCost: 100, recurringCost: 0, costPaymentLag: 0, costDeposit: 0,
    refine: { signature: false, contrat: false, paiement: false, evolution: false },
    vatRateSales: 0.2, vatRatePurchase: 0.2,
    priceByYear: [], recurringPriceByYear: [], unitCostByYear: [], recurringCostByYear: [],
    // Décélération à zéro : la croissance saisie est celle qui s'applique.
    // Amortir la courbe à la place du fondateur, c'est corriger un chiffre
    // qu'il n'a pas encore discuté.
    volumes: { mode: 'growth', launchMonth: 0, startUnits: 3, monthlyGrowth: 0.08, growthDecay: 1, cap: '', seasonality: null, manual: [] },
    ...overrides,
  }
}


/**
 * Les formes juridiques que le modèle sait distinguer.
 *
 * On ne propose que celles dont Fynomia tire un calcul différent : statut
 * social du dirigeant, imposition du bénéfice, traitement des dividendes.
 * Une SCI ou une SCM n'abritent pas une activité d'exploitation et ne
 * changeraient rien au prévisionnel — les proposer serait du décor.
 */
export const LEGAL_FORMS = {
  SASU: {
    label: 'SASU', short: 'Toi seul · assimilé salarié', contract: 'dirigeant',
    note: `Président assimilé salarié : environ 41 % de cotisations patronales sur ton brut, une vraie protection sociale, pas de chômage. Dividendes à la flat tax de ${pfuTotal()}.`,
  },
  SAS: {
    label: 'SAS', short: 'Plusieurs associés · assimilé salarié', contract: 'dirigeant',
    note: "Même régime que la SASU pour le président. C'est la forme des projets qui lèvent des fonds.",
  },
  EURL: {
    label: 'EURL', short: 'Toi seul · travailleur non salarié', contract: 'tns',
    note: "Gérant TNS : environ 45 % de cotisations, sensiblement moins cher qu'un assimilé salarié à revenu égal, mais une couverture plus légère.",
  },
  SARL: {
    label: 'SARL', short: 'Plusieurs associés · gérant TNS', contract: 'tns',
    note: "Attention aux dividendes : au-delà de 10 % du capital, ils supportent les cotisations d'indépendant, pas la flat tax.",
  },
  EI: {
    label: 'Entreprise individuelle', short: 'Pas de société', contract: 'tns',
    note: "Le bénéfice est ton revenu : il est imposé à l'impôt sur le revenu, sans impôt sur les sociétés ni dividendes.",
  },
  BNC: {
    label: 'Exercice libéral', short: 'Bénéfices non commerciaux', contract: 'tns',
    note: "Le résultat est ton revenu imposable, sans l'abattement de 10 % des salaires.",
  },
  SELARL: {
    label: 'SELARL', short: 'Profession réglementée · TNS', contract: 'tns',
    note: "Réservée aux professions réglementées. Même traitement des dividendes qu'une SARL.",
  },
  SELAS: {
    label: 'SELAS', short: 'Profession réglementée · assimilé salarié', contract: 'dirigeant',
    note: "Réservée aux professions réglementées. Président assimilé salarié, dividendes à la flat tax.",
  },
  Association: {
    label: 'Association', short: 'Loi 1901 · gestion désintéressée', contract: 'dirigeant',
    note: "Aucun bénéfice ne peut être distribué. Un dirigeant rémunéré relève du régime général.",
  },
}

export function newTeamMember(overrides = {}) {
  return {
    id: uid('emp'), role: 'Nouveau poste', contractType: 'cdi', status: 'non-cadre',
    monthlyGross: 2500, count: 1, startMonth: 0, endMonth: '',
    rdShare: 0, innovShare: 0, youngDoctor: false, allocation: {},
    ...overrides,
  }
}

export function newCampaign(overrides = {}) {
  return {
    id: uid('camp'), name: 'Nouvelle campagne', channel: 'ads', enabled: true,
    // Une campagne arrive entièrement à zéro.
    //
    // Le budget, le coût par clic, les taux de conversion : ce sont des
    // chiffres que seul le fondateur connaît. En pré-remplir un jeu complet
    // produisait un plan d'acquisition qu'il n'a jamais discuté mais qui
    // pesait déjà sur son chiffre d'affaires — et, pire, qu'il croyait
    // vérifié parce qu'il était écrit. Les ordres de grandeur de chaque canal
    // existent toujours, mais il faut les demander.
    activityId: null, startMonth: 0, durationMonths: 12, monthlyBudget: 0,
    model: 'cpc', cpc: 0, cpm: 0, cpl: 0, cac: 0,
    ctr: 0, visitToLead: 0, leadToClient: 0, clientsPerMonth: 0,
    ...overrides,
  }
}

export function newOpex(overrides = {}) {
  return { id: uid('opx'), label: 'Nouvelle charge', mode: 'fixed', monthlyAmount: 200, perEmployee: 0, pctRevenue: 0, perUnit: 0, activityId: null, activityIds: [], startMonth: 0, endMonth: '', enabled: true, rdApproved: false, ...overrides }
}

export function newCapex(overrides = {}) {
  // Éteint d'office : une liste de matériel déjà cochée engage la trésorerie
  // de quelqu'un qui n'a encore rien décidé. Le bouton « Ajouter un
  // investissement » est un acte délibéré, lui : il passe `enabled: true`.
  return { id: uid('cpx'), label: 'Nouvel investissement', amount: 5000, month: 0, amortYears: 3, leasing: false, leaseMonthly: 0, leaseMonths: 36, rdShare: 0, contribution: false, enabled: false, ...overrides }
}

export const CHANNELS = {
  ads: { label: 'Publicité en ligne', defaults: { model: 'cpc', cpc: 1.2, visitToLead: 0.03, leadToClient: 0.2 } },
  social: { label: 'Réseaux sociaux', defaults: { model: 'cpm', cpm: 8, ctr: 0.015, visitToLead: 0.02, leadToClient: 0.15 } },
  seo: { label: 'Référencement et contenu', defaults: { model: 'cpl', cpl: 18, leadToClient: 0.25 } },
  outbound: { label: 'Prospection commerciale', defaults: { model: 'cpl', cpl: 60, leadToClient: 0.12 } },
  events: { label: 'Salons et événements', defaults: { model: 'cpl', cpl: 120, leadToClient: 0.3 } },
  influence: { label: "Influence et partenariats", defaults: { model: 'cac', cac: 150 } },
  referral: { label: 'Parrainage', defaults: { model: 'cac', cac: 40 } },
}

/** Scénario vierge. */
export function emptyScenario(name = 'Mon business plan') {
  const year = new Date().getFullYear() + (new Date().getMonth() > 8 ? 1 : 0)
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: uid('scn'), name, company: '', sector: '', legalForm: 'SAS',
      startDate: `${Math.max(2026, year)}-01-01`, level: 'easy',
      jeiClaimed: false, reducedCorporateTax: true, companyAgeYears: 0,
      sectorKey: null, vatExempt: false, nonProfit: false, persona: 'founder',
      // Ce que le fondateur a répondu — « pizzeria » — et le mot de son métier.
      // `sectorKey` reste le modèle économique qui tourne derrière.
      activityKey: '', activityLabel: '', unit: null,
      // Où en est le projet : idée, structuration, démarches, lancé.
      // Vide tant que le fondateur ne l'a pas dit — on ne présume pas.
      stage: '',
      createdAt: Date.now(), updatedAt: Date.now(),
    },
    fiscal: {},
    // Une page blanche est vraiment blanche : l'offre existe pour accueillir la
    // saisie, mais sans prix inventé. Un parcours qui s'ouvre à 70 % parce que
    // l'outil a rempli les cases à la place du fondateur ne guide personne.
    activities: [newActivity({
      name: 'À définir', unitPrice: 0, unitCost: 0, recurringPrice: 0, contractMonths: 0,
      volumes: { mode: 'growth', launchMonth: 0, startUnits: 0, monthlyGrowth: 0.08, growthDecay: 0.96, cap: '', seasonality: null, manual: [] },
    })],
    marketing: [],
    team: [],
    opex: [],
    capex: [],
    financing: { openingCash: 0, equityFounders: [], equityInvestors: [], loans: [], grants: [], advances: [], shareholderLoans: [] },
    assumptions: { stockDays: 0 },
    // La politique sociale se décide une fois, pour toute l'entreprise. La
    // complémentaire santé n'est pas une option : elle est obligatoire dès le
    // premier salarié, et un plan qui l'oublie sous-estime chaque embauche.
    hr: { benefits: { mutuelle: 45 } },
    // Ce que le dirigeant retire réellement : part du capital, situation
    // fiscale du foyer et politique de distribution.
    founder: { memberId: null, equityShare: 1, taxParts: 1, dividendPayout: 0, dividendRegime: 'pfu', majorityManager: false, otherIncome: 0 },
  }
}


/**
 * Un plan vierge, mais qui sait dans quel métier il est.
 *
 * L'offre unique porte le vocabulaire et le taux de TVA du métier, et rien
 * d'autre : ni prix, ni volumes, ni équipe, ni charges. Chaque chiffre qui
 * apparaîtra ensuite aura été saisi par le fondateur.
 */
function blankFromSector(s, sector) {
  // L'offre reste sans nom : un champ déjà rempli oblige à tout effacer avant
  // d'écrire le sien. Le mot du métier sert de texte fantôme, pas de valeur.
  s.activities = [newActivity({
    name: 'À définir',
    unitPrice: 0, unitCost: 0, recurringPrice: 0, recurringCost: 0, contractMonths: 0,
    vatRateSales: sector.vat?.sales ?? 0.2,
    volumes: { mode: 'growth', launchMonth: 0, startUnits: 0, monthlyGrowth: 0.08, growthDecay: 0.96, cap: '', seasonality: null, manual: [] },
  })]
  s.marketing = []
  s.team = []
  s.opex = []
  s.capex = []
  s.financing = { openingCash: 0, equityFounders: [], equityInvestors: [], loans: [], grants: [], advances: [], shareholderLoans: [] }
}

/** Charges de fonctionnement types, pour qu'un modèle ne démarre jamais à zéro. */
function baseOpex(profile) {
  const sets = {
    software: [
      ['Comptable et juridique', 320], ['Logiciels et hébergement', 260],
      ['Assurances', 90], ['Banque et paiement', 70],
    ],
    office: [
      ['Loyer et charges', 900], ['Comptable et juridique', 300],
      ['Logiciels et informatique', 180], ['Assurances', 110],
      ['Téléphonie et connexion', 90], ['Déplacements', 200],
    ],
    shop: [
      ['Loyer et charges', 2200], ['Comptable et juridique', 260],
      ['Énergie et fluides', 450], ['Assurances', 180],
      ['Encaissement et logiciels', 140], ['Entretien', 150],
    ],
    lab: [
      ['Loyer et laboratoire', 1600], ['Comptable et juridique', 380],
      ['Consommables de recherche', 700], ['Propriété intellectuelle', 450],
      ['Logiciels et calcul', 300], ['Assurances', 160],
    ],
  }
  return (sets[profile] || sets.software).map(([label, monthlyAmount]) =>
    newOpex({ label, mode: 'fixed', monthlyAmount }))
}

/**
 * Un plan fondé sur un métier.
 *
 * `sample: false` n'applique que ce qui *caractérise* le métier — vocabulaire,
 * régime de TVA, forme juridique, repères de marge — sans rien inventer à la
 * place du fondateur. C'est le mode du parcours guidé : choisir « restaurant »
 * ne doit pas faire apparaître un restaurant qui tourne déjà, avec son chiffre
 * d'affaires et son équipe. On ne comprendrait pas d'où ça sort, et on ne
 * saurait plus ce qui est à soi.
 *
 * `sample: true` garde l'ancien comportement : un exemple complet, utile pour
 * montrer l'outil en fonctionnement.
 */
export function scenarioFromTemplate(key, name, { sample = true } = {}) {
  const s = emptyScenario(name || 'Mon business plan')
  const sector = SECTORS[key]
  if (!sector) return s

  s.meta.sectorKey = key
  s.meta.name = name || sector.label
  s.meta.legalForm = sector.legal.forms[0]
  if (sample) sector.build(s)
  else blankFromSector(s, sector)

  // Le régime de TVA du secteur prime sur les valeurs par défaut de l'offre.
  if (sector.vat.exempt) s.meta.vatExempt = true
  for (const a of s.activities) {
    if (a.vatRateSales === undefined || a.vatRateSales === null) a.vatRateSales = sector.vat.sales
  }
  // Un gérant majoritaire de SARL ou d'EURL subit les cotisations TNS sur ses
  // dividendes : la case est cochée d'office pour ces formes.
  s.founder.majorityManager = ['SARL', 'EURL'].includes(s.meta.legalForm)
  for (const a of s.activities) rangerHypotheses(a)
  return s
}

/**
 * Les hypothèses avancées d'un plan neuf : éteintes, à zéro, mais pas perdues.
 *
 * Le modèle d'un métier pose des délais qui lui sont propres — un conseil
 * encaissé à soixante jours, un restaurant payé comptant, un abonnement qui
 * perd deux clients sur cent chaque mois. Elles sont justes, mais personne ne
 * les a formulées : elles pesaient sur la trésorerie d'un plan dont le
 * fondateur n'avait encore rien dit.
 *
 * On les met donc de côté au lieu de les appliquer. L'onglet « hypothèses
 * avancées » s'ouvre vide et à zéro ; allumer un bloc rappelle la valeur du
 * métier, déjà remplie. Rien n'est inventé, rien n'est imposé.
 */
const NEUTRE = {
  signature: { unitPrice: 0 },
  contrat: { contractMonths: 12, churnMonthly: 0 },
  paiement: { deliveryLag: 0, paymentLag: 0, deposit: 0, milestone: 0, costPaymentLag: 0, costDeposit: 0 },
  evolution: { priceByYear: [], recurringPriceByYear: [] },
}

export function rangerHypotheses(a) {
  a.refine = {}
  a.refineSaved = a.refineSaved || {}
  for (const [cle, neutre] of Object.entries(NEUTRE)) {
    // Un abonnement sans durée de contrat ne produit rien : ce bloc-là garde
    // sa valeur, c'est la définition de l'offre et non une hypothèse.
    const garde = {}
    let bouge = false
    for (const k of Object.keys(neutre)) {
      garde[k] = a[k]
      const v = Array.isArray(neutre[k]) ? (Array.isArray(a[k]) && a[k].length ? 1 : 0) : (Number(a[k]) || 0)
      const d = Array.isArray(neutre[k]) ? 0 : (Number(neutre[k]) || 0)
      if (v !== d) bouge = true
    }
    // Deux exceptions, et ce sont des définitions, pas des hypothèses : la
    // durée d'un contrat fait exister l'abonnement — à zéro, il ne produit
    // rien — et le prix unitaire d'une vente ferme est le prix, pas un frais
    // de mise en route. Seule l'attrition est mise de côté dans le premier
    // cas ; le second bloc ne s'applique tout simplement pas.
    if (cle === 'signature' && (Number(a.recurringPrice) || 0) <= 0) { a.refine.signature = false; continue }
    if (cle === 'contrat') {
      if ((Number(a.churnMonthly) || 0) > 0) a.refineSaved.contrat = { contractMonths: a.contractMonths, churnMonthly: a.churnMonthly }
      a.churnMonthly = 0
      a.refine.contrat = false
      continue
    }
    if (bouge) a.refineSaved[cle] = garde
    for (const k of Object.keys(neutre)) a[k] = Array.isArray(neutre[k]) ? [] : neutre[k]
    a.refine[cle] = false
  }
}

/**
 * Contrôles de cohérence. Renvoie des anomalies bloquantes et des alertes.
 * L'objectif est d'empêcher les scénarios absurdes sans brider l'exploration.
 */
export function validate(scenario, result) {
  const issues = []
  const add = (level, page, message, hint) => issues.push({ level, page, message, hint })

  if (!scenario.activities?.length) add('error', 'offre', "Aucune offre définie.", "Ajoute au moins une offre pour générer un chiffre d'affaires.")

  for (const a of scenario.activities || []) {
    const split = (Number(a.deposit) || 0) + (Number(a.milestone) || 0)
    if (split > 1.0001) add('error', 'offre', `« ${a.name} » : acompte et solde intermédiaire dépassent 100 %.`, 'La somme acompte + solde intermédiaire ne peut excéder le prix total.')
    if ((Number(a.unitPrice) || 0) === 0 && (Number(a.recurringPrice) || 0) === 0) add('warning', 'offre', `« ${a.name} » n'a ni prix unitaire ni abonnement.`, "Cette offre ne produira aucun revenu.")
    const price = Number(a.unitPrice) || 0, cost = Number(a.unitCost) || 0
    if (price > 0 && cost > price) add('warning', 'offre', `« ${a.name} » se vend à perte (coût ${fmt(cost)} € pour un prix de ${fmt(price)} €).`, "Vérifie le coût de revient unitaire.")
    if ((Number(a.contractMonths) || 0) === 0 && (Number(a.recurringPrice) || 0) > 0) add('warning', 'offre', `« ${a.name} » a un abonnement mais aucune durée de contrat.`, "Renseigne une durée de contrat pour que l'abonnement génère du revenu.")
    if ((Number(a.volumes?.monthlyGrowth) || 0) > 0.3) add('warning', 'offre', `« ${a.name} » croît de plus de 30 % par mois.`, "Une croissance de 30 % par mois multiplie les volumes par 23 en un an. Un investisseur la considérera comme non étayée.")
  }

  for (const m of scenario.team || []) {
    const gross = Number(m.monthlyGross) || 0
    if (m.contractType === 'cdi' && gross > 0 && gross < 1700) add('warning', 'equipe', `« ${m.role} » est rémunéré ${fmt(gross)} € brut, sous le SMIC temps plein.`, "Vérifie qu'il s'agit bien d'un temps partiel.")
    const alloc = Object.values(m.allocation || {}).reduce((a, b) => a + (Number(b) || 0), 0)
    if (alloc > 1.0001) add('error', 'equipe', `« ${m.role} » : la répartition par activité dépasse 100 %.`, 'Le total des affectations doit être inférieur ou égal à 100 %.')
    if ((Number(m.rdShare) || 0) + (Number(m.innovShare) || 0) > 1.0001) add('error', 'equipe', `« ${m.role} » : recherche et innovation cumulées dépassent 100 % du temps.`, "Un salarié ne peut consacrer plus de 100 % de son temps à ces activités.")
  }

  for (const c of scenario.marketing || []) {
    if (c.enabled && !scenario.activities?.some((a) => a.id === c.activityId)) add('warning', 'marketing', `La campagne « ${c.name} » n'est rattachée à aucune offre.`, "Rattache-la à une offre pour que les clients acquis produisent du revenu.")
    if ((Number(c.leadToClient) || 0) > 0.6) add('warning', 'marketing', `« ${c.name} » convertit plus de 60 % des contacts en clients.`, "Au-delà de 20 %, un taux de conversion doit s'appuyer sur des données réelles.")
  }

  if (result) {
    const need = result.kpis.fundingNeed
    if (need > 0) add('warning', 'financement', `Ta trésorerie devient négative : il manque ${fmt(need)} € au point bas.`, "Augmente le capital, décale des dépenses ou accélère les encaissements.")
    result.balance.forEach((b, y) => {
      if (Math.abs(b.gap) > Math.max(50, b.totalAssets * 0.01)) add('info', 'resultats', `Bilan année ${y + 1} : écart actif/passif de ${fmt(b.gap)} €.`, "Écart d'arrondi ou poste non modélisé ; sans incidence sur la trésorerie.")
    })
    if (result.kpis.marginRate.every((r) => r <= 0) && result.pnl.revenue.some((r) => r > 0)) add('error', 'offre', 'Ta marge brute est nulle ou négative sur tout l\'horizon.', "Aucun point mort ne peut être calculé : le prix de vente ne couvre pas le coût variable.")
  }
  return issues
}

const fmt = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n))

// Importé en fin de module : sectors.js consomme les fabriques ci-dessus.
import { SECTORS } from './sectors.js'
import { pfuTotal } from '../engine/fiscal-fr-2026.js'
export { SECTORS }

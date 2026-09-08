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
    description: "Le strict nécessaire pour chiffrer une idée : ce que vous vendez, à quel prix, à combien de clients, et ce que ça coûte. Les délais de paiement, la TVA et les cotisations sont calculés avec des valeurs de marché que vous n'avez pas à connaître.",
  },
  intermediate: {
    label: 'Intermédiaire', short: 'Inter.',
    tagline: 'Plusieurs offres, des campagnes, du financement.',
    description: "Vous pilotez plusieurs sources de revenus, vous branchez vos campagnes marketing sur votre acquisition client, vous gérez vos investissements et vos emprunts. Les conditions de paiement deviennent modifiables.",
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
    unitPrice: 500, recurringPrice: 0, contractMonths: 12,
    deliveryLag: 0, paymentLag: 1, deposit: 0.3, milestone: 0, churnMonthly: 0.02,
    unitCost: 100, recurringCost: 0, costPaymentLag: 1, costDeposit: 0,
    vatRateSales: 0.2, vatRatePurchase: 0.2,
    priceByYear: [], recurringPriceByYear: [], unitCostByYear: [], recurringCostByYear: [],
    volumes: { mode: 'growth', launchMonth: 0, startUnits: 3, monthlyGrowth: 0.08, growthDecay: 0.96, cap: '', seasonality: null, manual: [] },
    ...overrides,
  }
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
    activityId: null, startMonth: 0, durationMonths: 12, monthlyBudget: 1000,
    model: 'cpc', cpc: 1.2, cpm: 8, cpl: 25, cac: 200,
    ctr: 0.02, visitToLead: 0.03, leadToClient: 0.2, clientsPerMonth: 5,
    ...overrides,
  }
}

export function newOpex(overrides = {}) {
  return { id: uid('opx'), label: 'Nouvelle charge', mode: 'fixed', monthlyAmount: 200, perEmployee: 0, pctRevenue: 0, startMonth: 0, endMonth: '', enabled: true, rdApproved: false, ...overrides }
}

export function newCapex(overrides = {}) {
  return { id: uid('cpx'), label: 'Nouvel investissement', amount: 5000, month: 0, amortYears: 3, leasing: false, leaseMonthly: 0, leaseMonths: 36, rdShare: 0, contribution: false, ...overrides }
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
      createdAt: Date.now(), updatedAt: Date.now(),
    },
    fiscal: {},
    activities: [newActivity({ name: 'Offre principale' })],
    marketing: [],
    team: [],
    opex: [],
    capex: [],
    financing: { openingCash: 0, equityFounders: [], equityInvestors: [], loans: [], grants: [], advances: [], shareholderLoans: [] },
    assumptions: { stockDays: 0 },
  }
}

/**
 * Modèles sectoriels : un point de départ crédible plutôt qu'une page blanche.
 */
export const TEMPLATES = {
  saas: {
    label: 'SaaS / Abonnement', icon: '◈',
    description: "Revenu récurrent mensuel, acquisition payante, marge brute élevée.",
    apply(s) {
      s.activities = [newActivity({ name: 'Abonnement Pro', unitPrice: 0, recurringPrice: 49, contractMonths: 24, churnMonthly: 0.03, unitCost: 0, recurringCost: 6, paymentLag: 0, deposit: 1, volumes: { mode: 'growth', launchMonth: 1, startUnits: 8, monthlyGrowth: 0.12, cap: '', manual: [] } })]
      s.marketing = [newCampaign({ name: 'Acquisition payante', channel: 'ads', activityId: s.activities[0].id, monthlyBudget: 2000, model: 'cpc', cpc: 1.8, visitToLead: 0.04, leadToClient: 0.15, startMonth: 1, durationMonths: 59 })]
      s.team = [
        newTeamMember({ role: 'Fondateur — produit', contractType: 'cdi', status: 'cadre', monthlyGross: 3200, rdShare: 0.6, innovShare: 0.2 }),
        newTeamMember({ role: 'Développeur', contractType: 'cdi', status: 'cadre', monthlyGross: 3800, startMonth: 3, rdShare: 0.8 }),
      ]
      s.capex = [newCapex({ label: 'Postes de travail', amount: 6000, amortYears: 3, rdShare: 0.7 })]
      s.opex = baseOpex('software')
      s.financing.equityFounders = [{ month: 0, amount: 20000 }]
      s.meta.jeiClaimed = true
    },
  },
  services: {
    label: 'Conseil / Agence', icon: '◇',
    description: "Vente au projet, facturation avec acompte, masse salariale dominante.",
    apply(s) {
      s.activities = [newActivity({ name: 'Mission de conseil', unitPrice: 9000, recurringPrice: 0, contractMonths: 0, deliveryLag: 2, paymentLag: 1, deposit: 0.3, milestone: 0.3, unitCost: 800, volumes: { mode: 'growth', launchMonth: 0, startUnits: 1, monthlyGrowth: 0.06, cap: 8, manual: [] } })]
      s.team = [
        newTeamMember({ role: 'Fondateur — associé', contractType: 'cdi', status: 'cadre', monthlyGross: 3500 }),
        newTeamMember({ role: 'Consultant', contractType: 'cdi', status: 'cadre', monthlyGross: 3000, startMonth: 6 }),
      ]
      s.marketing = [newCampaign({ name: 'Prospection', channel: 'outbound', activityId: s.activities[0].id, monthlyBudget: 800, model: 'cpl', cpl: 60, leadToClient: 0.12, durationMonths: 59 })]
      s.opex = baseOpex('office')
      s.financing.equityFounders = [{ month: 0, amount: 10000 }]
    },
  },
  ecommerce: {
    label: 'E-commerce', icon: '◆',
    description: "Panier moyen, marge sur achat, stock et publicité.",
    apply(s) {
      s.activities = [newActivity({ name: 'Vente en ligne', unitPrice: 65, recurringPrice: 0, contractMonths: 0, deliveryLag: 0, paymentLag: 0, deposit: 1, unitCost: 28, costPaymentLag: 1, volumes: { mode: 'growth', launchMonth: 0, startUnits: 120, monthlyGrowth: 0.1, cap: '', manual: [] } })]
      s.marketing = [newCampaign({ name: 'Publicité produits', channel: 'ads', activityId: s.activities[0].id, monthlyBudget: 3000, model: 'cac', cac: 22, durationMonths: 59 })]
      s.team = [newTeamMember({ role: 'Fondateur', contractType: 'tns', monthlyGross: 2200 })]
      s.assumptions.stockDays = 45
      s.opex = baseOpex('software')
      s.capex = [newCapex({ label: 'Site et logistique', amount: 12000, amortYears: 3 })]
      s.financing.equityFounders = [{ month: 0, amount: 25000 }]
      s.financing.loans = [{ id: uid('loan'), label: 'Prêt bancaire', amount: 30000, month: 1, rate: 0.04, months: 60, graceMonths: 3 }]
    },
  },
  deeptech: {
    label: 'Deeptech / R&D', icon: '◉',
    description: "Recherche longue, subventions, crédit d'impôt recherche, statut JEI.",
    apply(s) {
      s.activities = [newActivity({ name: 'Licence technologique', unitPrice: 40000, recurringPrice: 1500, contractMonths: 36, deliveryLag: 3, paymentLag: 2, deposit: 0.2, milestone: 0.3, unitCost: 3000, volumes: { mode: 'growth', launchMonth: 14, startUnits: 1, monthlyGrowth: 0.07, cap: 4, manual: [] } })]
      s.team = [
        newTeamMember({ role: 'Directeur scientifique', contractType: 'cdi', status: 'cadre', monthlyGross: 4200, rdShare: 0.9, youngDoctor: true }),
        newTeamMember({ role: 'Ingénieur R&D', contractType: 'cdi', status: 'cadre', monthlyGross: 3600, startMonth: 2, rdShare: 0.95, count: 2 }),
      ]
      s.opex = baseOpex('lab')
      s.capex = [newCapex({ label: 'Équipement de laboratoire', amount: 80000, amortYears: 5, rdShare: 1 })]
      s.financing.equityFounders = [{ month: 0, amount: 50000 }]
      s.financing.grants = [{ id: uid('grt'), label: "Subvention d'innovation", amount: 90000, month: 2, months: 12 }]
      s.financing.advances = [{ id: uid('adv'), label: 'Avance remboursable', amount: 120000, month: 6, repayStartMonth: 36, repayMonths: 24 }]
      s.meta.jeiClaimed = true
    },
  },
  retail: {
    label: 'Commerce / Restauration', icon: '▣',
    description: "Ticket moyen, encaissement immédiat, loyer et équipe fixes.",
    apply(s) {
      s.activities = [newActivity({ name: 'Ventes au comptoir', unitPrice: 18, recurringPrice: 0, contractMonths: 0, deliveryLag: 0, paymentLag: 0, deposit: 1, unitCost: 6, vatRateSales: 0.1, volumes: { mode: 'growth', launchMonth: 1, startUnits: 900, monthlyGrowth: 0.04, cap: 3000, manual: [] } })]
      s.team = [
        newTeamMember({ role: 'Gérant', contractType: 'tns', monthlyGross: 2000 }),
        newTeamMember({ role: 'Employé polyvalent', contractType: 'cdi', monthlyGross: 1900, count: 2, startMonth: 1 }),
      ]
      s.opex = baseOpex('shop')
      s.capex = [newCapex({ label: 'Aménagement et matériel', amount: 60000, amortYears: 7, month: 0 })]
      s.financing.equityFounders = [{ month: 0, amount: 30000 }]
      s.financing.loans = [{ id: uid('loan'), label: 'Prêt bancaire', amount: 70000, month: 0, rate: 0.042, months: 84, graceMonths: 3 }]
      s.assumptions.stockDays = 15
    },
  },
  marketplace: {
    label: 'Marketplace / Commission', icon: '⬡',
    description: "Volume d'affaires intermédié, revenu en pourcentage, effet de réseau.",
    apply(s) {
      s.activities = [newActivity({ name: 'Commission sur transactions', unitPrice: 12, recurringPrice: 0, contractMonths: 0, deliveryLag: 0, paymentLag: 0, deposit: 1, unitCost: 2, volumes: { mode: 'growth', launchMonth: 2, startUnits: 300, monthlyGrowth: 0.14, cap: '', manual: [] } })]
      s.marketing = [
        newCampaign({ name: 'Acquisition acheteurs', channel: 'ads', activityId: s.activities[0].id, monthlyBudget: 2500, model: 'cac', cac: 9, startMonth: 2, durationMonths: 58 }),
        newCampaign({ name: 'Parrainage', channel: 'referral', activityId: s.activities[0].id, monthlyBudget: 600, model: 'cac', cac: 15, startMonth: 6, durationMonths: 54 }),
      ]
      s.team = [newTeamMember({ role: 'Fondateur', contractType: 'cdi', status: 'cadre', monthlyGross: 3000, rdShare: 0.4 })]
      s.opex = baseOpex('software')
      s.financing.equityFounders = [{ month: 0, amount: 15000 }]
      s.financing.equityInvestors = [{ month: 8, amount: 300000 }]
    },
  },
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

export function scenarioFromTemplate(key, name) {
  const s = emptyScenario(name || TEMPLATES[key]?.label || 'Mon business plan')
  const tpl = TEMPLATES[key]
  if (tpl) { tpl.apply(s); s.meta.template = key }
  return s
}

/**
 * Contrôles de cohérence. Renvoie des anomalies bloquantes et des alertes.
 * L'objectif est d'empêcher les scénarios absurdes sans brider l'exploration.
 */
export function validate(scenario, result) {
  const issues = []
  const add = (level, page, message, hint) => issues.push({ level, page, message, hint })

  if (!scenario.activities?.length) add('error', 'offre', "Aucune offre définie.", "Ajoutez au moins une offre pour générer un chiffre d'affaires.")

  for (const a of scenario.activities || []) {
    const split = (Number(a.deposit) || 0) + (Number(a.milestone) || 0)
    if (split > 1.0001) add('error', 'offre', `« ${a.name} » : acompte et solde intermédiaire dépassent 100 %.`, 'La somme acompte + solde intermédiaire ne peut excéder le prix total.')
    if ((Number(a.unitPrice) || 0) === 0 && (Number(a.recurringPrice) || 0) === 0) add('warning', 'offre', `« ${a.name} » n'a ni prix unitaire ni abonnement.`, "Cette offre ne produira aucun revenu.")
    const price = Number(a.unitPrice) || 0, cost = Number(a.unitCost) || 0
    if (price > 0 && cost > price) add('warning', 'offre', `« ${a.name} » se vend à perte (coût ${fmt(cost)} € pour un prix de ${fmt(price)} €).`, "Vérifiez le coût de revient unitaire.")
    if ((Number(a.contractMonths) || 0) === 0 && (Number(a.recurringPrice) || 0) > 0) add('warning', 'offre', `« ${a.name} » a un abonnement mais aucune durée de contrat.`, "Renseignez une durée de contrat pour que l'abonnement génère du revenu.")
    if ((Number(a.volumes?.monthlyGrowth) || 0) > 0.3) add('warning', 'offre', `« ${a.name} » croît de plus de 30 % par mois.`, "Une croissance de 30 % par mois multiplie les volumes par 23 en un an. Un investisseur la considérera comme non étayée.")
  }

  for (const m of scenario.team || []) {
    const gross = Number(m.monthlyGross) || 0
    if (m.contractType === 'cdi' && gross > 0 && gross < 1700) add('warning', 'equipe', `« ${m.role} » est rémunéré ${fmt(gross)} € brut, sous le SMIC temps plein.`, "Vérifiez qu'il s'agit bien d'un temps partiel.")
    const alloc = Object.values(m.allocation || {}).reduce((a, b) => a + (Number(b) || 0), 0)
    if (alloc > 1.0001) add('error', 'equipe', `« ${m.role} » : la répartition par activité dépasse 100 %.`, 'Le total des affectations doit être inférieur ou égal à 100 %.')
    if ((Number(m.rdShare) || 0) + (Number(m.innovShare) || 0) > 1.0001) add('error', 'equipe', `« ${m.role} » : recherche et innovation cumulées dépassent 100 % du temps.`, "Un salarié ne peut consacrer plus de 100 % de son temps à ces activités.")
  }

  for (const c of scenario.marketing || []) {
    if (c.enabled && !scenario.activities?.some((a) => a.id === c.activityId)) add('warning', 'marketing', `La campagne « ${c.name} » n'est rattachée à aucune offre.`, "Rattachez-la à une offre pour que les clients acquis produisent du revenu.")
    if ((Number(c.leadToClient) || 0) > 0.6) add('warning', 'marketing', `« ${c.name} » convertit plus de 60 % des contacts en clients.`, "Au-delà de 20 %, un taux de conversion doit s'appuyer sur des données réelles.")
  }

  if (result) {
    const need = result.kpis.fundingNeed
    if (need > 0) add('warning', 'financement', `Votre trésorerie devient négative : il manque ${fmt(need)} € au point bas.`, "Augmentez le capital, décalez des dépenses ou accélérez les encaissements.")
    result.balance.forEach((b, y) => {
      if (Math.abs(b.gap) > Math.max(50, b.totalAssets * 0.01)) add('info', 'resultats', `Bilan année ${y + 1} : écart actif/passif de ${fmt(b.gap)} €.`, "Écart d'arrondi ou poste non modélisé ; sans incidence sur la trésorerie.")
    })
    if (result.kpis.marginRate.every((r) => r <= 0) && result.pnl.revenue.some((r) => r > 0)) add('error', 'offre', 'Votre marge brute est nulle ou négative sur tout l\'horizon.', "Aucun point mort ne peut être calculé : le prix de vente ne couvre pas le coût variable.")
  }
  return issues
}

const fmt = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n))

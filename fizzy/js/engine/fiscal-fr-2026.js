/**
 * Paramètres fiscaux et sociaux — France, exercice 2026.
 *
 * Chaque paramètre porte son barème, une note explicative et un niveau de
 * confiance. Les valeurs marquées `confidence: 'to-verify'` sont des valeurs
 * reconduites ou estimées : elles doivent être confirmées avant tout usage
 * officiel (dépôt bancaire, levée de fonds, liasse fiscale).
 *
 * L'utilisateur peut surcharger n'importe quelle valeur depuis Réglages →
 * Paramètres fiscaux ; les surcharges sont stockées dans le scénario.
 */

export const FISCAL_YEAR = 2026

/** Confiance : 'stable' = règle pérenne, 'to-verify' = à confirmer pour 2026. */
export const PARAMS = {
  // ─────────────────────────────── Bases sociales ──────────────────────────
  smicHourly: {
    value: 11.88,
    unit: '€/h',
    label: 'SMIC horaire brut',
    confidence: 'to-verify',
    note: "Valeur en vigueur au 1er novembre 2024, reconduite ici. La revalorisation applicable au 1er janvier 2026 doit être vérifiée : elle décale mécaniquement la réduction générale de cotisations et les plafonds JEI.",
  },
  monthlyHours: {
    value: 151.67,
    unit: 'h/mois',
    label: 'Durée mensuelle légale',
    confidence: 'stable',
    note: '35 h par semaine, soit 151,67 h par mois. Base de conversion du SMIC horaire en SMIC mensuel.',
  },
  pass: {
    value: 47100,
    unit: '€/an',
    label: 'Plafond annuel de la Sécurité sociale (PASS)',
    confidence: 'to-verify',
    note: "Valeur 2025 reconduite. Le PASS sert de plafond au dispositif JEI (5 PASS par établissement) et à plusieurs tranches de cotisations.",
  },

  // ──────────────────────── Cotisations employeur / salarié ────────────────
  employerRateNonCadre: {
    value: 0.42,
    unit: '% du brut',
    label: 'Cotisations patronales — non-cadre',
    confidence: 'to-verify',
    note: "Taux moyen tous risques (maladie, vieillesse, famille, chômage, AT/MP, retraite complémentaire, CSA, FNAL, transport). Avant application de la réduction générale. À ajuster selon la convention collective et le taux AT/MP notifié.",
  },
  employerRateCadre: {
    value: 0.45,
    unit: '% du brut',
    label: 'Cotisations patronales — cadre',
    confidence: 'to-verify',
    note: "Taux moyen incluant la prévoyance cadre obligatoire (1,50 % sur la tranche A) et la contribution APEC.",
  },
  employeeRate: {
    value: 0.22,
    unit: '% du brut',
    label: 'Cotisations salariales',
    confidence: 'to-verify',
    note: "Taux moyen (vieillesse, retraite complémentaire, CSG/CRDS). Sert à afficher le net avant impôt ; sans incidence sur le coût employeur.",
  },
  reductionGenerale: {
    value: { maxCoefUnder50: 0.4038, maxCoefFrom50: 0.4078, ceilingSmicMultiple: 3.0 },
    unit: 'coefficient',
    label: 'Réduction générale de cotisations patronales',
    confidence: 'to-verify',
    note: "Réduction dégressive appliquée jusqu'à 3 SMIC, issue de la fusion des bandeaux maladie et famille prévue par la LFSS. Coefficient = (T / (K−1)) × (K × SMIC annuel / brut annuel − 1), borné entre 0 et T. Les valeurs de T et le plafond K doivent être confirmés par le décret applicable en 2026.",
  },
  tnsRate: {
    value: 0.45,
    unit: '% de la rémunération',
    label: 'Cotisations TNS (gérant majoritaire)',
    confidence: 'to-verify',
    note: "Taux global moyen pour un travailleur non salarié affilié au régime des indépendants. Fortement dégressif sur les hauts revenus et majoré sur les faibles revenus (cotisations minimales).",
  },
  internGratification: {
    value: 4.35,
    unit: '€/h',
    label: 'Gratification minimale de stage',
    confidence: 'to-verify',
    note: "15 % du plafond horaire de la Sécurité sociale. Obligatoire au-delà de 2 mois de stage. Tant que la gratification n'excède pas ce minimum, elle est exonérée de cotisations sociales.",
  },
  apprenticeEmployerRate: {
    value: 0.11,
    unit: '% du brut',
    label: "Cotisations patronales — apprenti / alternant",
    confidence: 'to-verify',
    note: "Taux réduit après application des exonérations propres aux contrats en alternance.",
  },

  // ────────────────────────────────── TVA ───────────────────────────────────
  vatRates: {
    value: { normal: 0.2, intermediate: 0.1, reduced: 0.055, superReduced: 0.021, exempt: 0 },
    unit: '%',
    label: 'Taux de TVA',
    confidence: 'stable',
    note: "20 % taux normal, 10 % restauration/transport/travaux, 5,5 % produits de première nécessité, 2,1 % presse et médicaments remboursables, 0 % opérations exonérées (santé, enseignement, franchise en base).",
  },
  vatPaymentLagMonths: {
    value: 1,
    unit: 'mois',
    label: 'Décalage de règlement de la TVA',
    confidence: 'stable',
    note: "La TVA d'un mois est déclarée et réglée le mois suivant (régime réel normal, déclaration CA3 mensuelle).",
  },

  // ─────────────────────────── Impôt sur les sociétés ──────────────────────
  corporateTax: {
    value: { reducedRate: 0.15, reducedBracket: 42500, normalRate: 0.25, revenueCapForReduced: 10000000 },
    unit: '%',
    label: 'Impôt sur les sociétés (IS)',
    confidence: 'stable',
    note: "Taux réduit de 15 % sur les 42 500 premiers euros de bénéfice pour les PME réalisant moins de 10 M€ de chiffre d'affaires, dont le capital est entièrement libéré et détenu à 75 % au moins par des personnes physiques. 25 % au-delà.",
  },
  lossCarryForward: {
    value: { flatCap: 1000000, rateAboveCap: 0.5 },
    unit: '€',
    label: 'Report déficitaire',
    confidence: 'stable',
    note: "Les déficits antérieurs s'imputent sans limite jusqu'à 1 M€, puis à hauteur de 50 % de la fraction du bénéfice excédant ce seuil. Le solde reste reportable sans limite de durée.",
  },

  // ───────────────────────────── Impôts et taxes ────────────────────────────
  apprenticeshipTax: {
    value: 0.0068,
    unit: '% de la masse salariale',
    label: "Taxe d'apprentissage",
    confidence: 'stable',
    note: "0,59 % de part principale + 0,09 % de solde. Taux réduit à 0,44 % en Alsace-Moselle. Les apprentis sont exclus de l'assiette.",
  },
  vocationalTraining: {
    value: { under11: 0.0055, from11: 0.01 },
    unit: '% de la masse salariale',
    label: 'Contribution à la formation professionnelle',
    confidence: 'stable',
    note: "0,55 % jusqu'à 10 salariés, 1 % à partir de 11 salariés. Une contribution CPF-CDD de 1 % s'ajoute sur les seuls contrats à durée déterminée.",
  },
  constructionEffort: {
    value: { threshold: 50, rate: 0.0045 },
    unit: '% de la masse salariale',
    label: "Participation à l'effort de construction (PEEC)",
    confidence: 'stable',
    note: "Due à partir de 50 salariés, avec un délai de 5 ans après le franchissement du seuil.",
  },
  c3s: {
    value: { threshold: 19000000, rate: 0.0016 },
    unit: '% du CA',
    label: 'Contribution sociale de solidarité des sociétés (C3S)',
    confidence: 'stable',
    note: "0,16 % appliqué à la seule fraction du chiffre d'affaires dépassant 19 M€. Sans objet pour la très grande majorité des jeunes entreprises.",
  },
  cfe: {
    value: {
      exemptFirstYear: true,
      reliefSecondYear: 0.5,
      brackets: [
        { upTo: 10000, amount: 243 },
        { upTo: 32600, amount: 580 },
        { upTo: 100000, amount: 1220 },
        { upTo: 250000, amount: 2030 },
        { upTo: 500000, amount: 2900 },
        { upTo: Infinity, amount: 3770 },
      ],
    },
    unit: '€/an',
    label: 'Cotisation foncière des entreprises (CFE)',
    confidence: 'to-verify',
    note: "Barème de la base minimum, fixé par chaque commune à l'intérieur d'une fourchette légale : les montants retenus ici sont des médianes. Exonération totale l'année de création, puis abattement de 50 % la première année d'imposition.",
  },
  cvae: {
    value: { exemptionThreshold: 500000, maxRate: 0.0019, minimumContribution: 63, additionalTaxRate: 0.1384 },
    unit: '% de la valeur ajoutée',
    label: 'Cotisation sur la valeur ajoutée des entreprises (CVAE)',
    confidence: 'to-verify',
    note: "Exonération en dessous de 500 000 € de chiffre d'affaires. Taux maximal de 0,19 %, atteint à 50 M€ de CA et progressif en dessous. Une taxe additionnelle de 13,84 % s'ajoute au montant dû. Le calendrier de suppression progressive doit être vérifié pour 2026.",
  },

  // ───────────────────── Crédits d'impôt et statuts innovants ──────────────
  cir: {
    value: { rate: 0.3, rateAboveCap: 0.05, cap: 100000000, operatingAllowance: 0.43, equipmentAllowance: 0.75, youngDoctorMultiplier: 2, youngDoctorAllowance: 2, subcontractingMultiple: 3 },
    unit: '%',
    label: "Crédit d'impôt recherche (CIR)",
    confidence: 'to-verify',
    note: "30 % des dépenses éligibles jusqu'à 100 M€, 5 % au-delà. Les frais de fonctionnement sont forfaitisés à 43 % des dépenses de personnel et 75 % des amortissements affectés à la recherche. Les jeunes docteurs comptent double pendant 24 mois. La sous-traitance agréée est plafonnée à 3 fois les autres dépenses éligibles. Le taux et le forfait de fonctionnement font l'objet de discussions récurrentes en loi de finances : à confirmer pour 2026.",
  },
  cii: {
    value: { rate: 0.2, expenseCap: 400000 },
    unit: '%',
    label: "Crédit d'impôt innovation (CII)",
    confidence: 'to-verify',
    note: "20 % des dépenses d'innovation, plafonnées à 400 000 € par an, soit 80 000 € de crédit maximum. Réservé aux PME au sens communautaire.",
  },
  jei: {
    value: { maxAgeYears: 8, rdRatioThreshold: 0.15, employeeCapSmicMultiple: 4.5, establishmentCapPassMultiple: 5, corporateTaxExemption: false, exemptibleRate: 0.28 },
    unit: '—',
    label: 'Jeune entreprise innovante (JEI)',
    confidence: 'to-verify',
    note: "Entreprise de moins de 8 ans consacrant au moins 15 % de ses charges à la R&D. L'avantage porte uniquement sur l'exonération de cotisations patronales (assurances sociales et allocations familiales), plafonnée à 4,5 SMIC par salarié et 5 PASS par établissement et par an. L'exonération d'impôt sur les sociétés a été supprimée pour les entreprises créées à compter du 1er janvier 2024. Le seuil de dépenses de R&D a été relevé pour les créations récentes : à confirmer selon la date de création.",
  },
  // ───────────────────── Fiscalité personnelle du dirigeant ────────────────
  incomeTaxBrackets: {
    value: [
      { upTo: 11497, rate: 0 },
      { upTo: 29315, rate: 0.11 },
      { upTo: 83823, rate: 0.30 },
      { upTo: 180294, rate: 0.41 },
      { upTo: Infinity, rate: 0.45 },
    ],
    unit: '€',
    label: "Barème de l'impôt sur le revenu",
    confidence: 'to-verify',
    note: "Barème par part de quotient familial. Les limites de tranches sont revalorisées chaque année sur l'inflation : celles retenues ici sont les dernières connues et doivent être confirmées pour l'imposition des revenus 2026.",
  },
  salaryAllowance: {
    value: { rate: 0.1, min: 504, max: 14426 },
    unit: '%',
    label: 'Abattement de 10 % sur les salaires',
    confidence: 'to-verify',
    note: "Déduction forfaitaire pour frais professionnels, plancher et plafond revalorisés annuellement. Le dirigeant peut opter pour les frais réels si ceux-ci sont supérieurs.",
  },
  familyQuotientCap: {
    value: 1791,
    unit: '€ par demi-part',
    label: 'Plafonnement du quotient familial',
    confidence: 'to-verify',
    note: "Avantage maximal procuré par chaque demi-part supplémentaire au-delà d'une part (deux pour un couple). Au-delà, l'économie d'impôt est écrêtée.",
  },
  flatTax: {
    value: { total: 0.30, incomeTax: 0.128, socialCharges: 0.172 },
    unit: '%',
    label: 'Prélèvement forfaitaire unique (flat tax)',
    confidence: 'stable',
    note: "30 % sur les dividendes et revenus de capitaux mobiliers : 12,8 % d'impôt sur le revenu et 17,2 % de prélèvements sociaux. Le contribuable peut opter pour le barème progressif, avec un abattement de 40 % sur les dividendes, si cela lui est plus favorable.",
  },
  dividendAllowance: {
    value: 0.4,
    unit: '%',
    label: 'Abattement sur dividendes au barème',
    confidence: 'stable',
    note: "Abattement de 40 % applicable aux dividendes lorsque le contribuable renonce au prélèvement forfaitaire unique et opte pour le barème progressif.",
  },
  tnsDividendThreshold: {
    value: 0.1,
    unit: '% du capital',
    label: 'Seuil de cotisations TNS sur dividendes',
    confidence: 'stable',
    note: "Pour un gérant majoritaire de SARL ou d'EURL, la fraction des dividendes excédant 10 % du capital social, des primes d'émission et des sommes en compte courant est soumise aux cotisations sociales des indépendants au lieu des prélèvements sociaux de 17,2 %. Les présidents de SAS ne sont pas concernés.",
  },

  deMinimis: {
    value: { ceiling: 300000, windowYears: 3 },
    unit: '€',
    label: 'Plafond des aides de minimis',
    confidence: 'stable',
    note: "300 000 € d'aides publiques cumulées sur trois exercices fiscaux glissants, en application du règlement européen 2023/2831.",
  },
}

/** Renvoie la valeur d'un paramètre, surcharge utilisateur prioritaire. */
export function param(key, overrides) {
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, key)) return overrides[key]
  const entry = PARAMS[key]
  if (!entry) throw new Error(`Paramètre fiscal inconnu : ${key}`)
  return entry.value
}

/** Construit un accesseur lié à un jeu de surcharges. */
export function fiscalContext(overrides = {}) {
  const get = (key) => param(key, overrides)
  const smicMonthly = get('smicHourly') * get('monthlyHours')
  return {
    get,
    overrides,
    smicHourly: get('smicHourly'),
    smicMonthly,
    smicAnnual: smicMonthly * 12,
    pass: get('pass'),
  }
}

/** Paramètres dont la valeur doit être confirmée pour l'exercice courant. */
export function paramsToVerify() {
  return Object.entries(PARAMS)
    .filter(([, entry]) => entry.confidence === 'to-verify')
    .map(([key, entry]) => ({ key, label: entry.label, note: entry.note }))
}

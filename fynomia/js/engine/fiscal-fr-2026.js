/**
 * Paramètres fiscaux et sociaux — France.
 *
 * Deux natures de paramètres cohabitent ici, et les confondre serait la
 * principale façon de se tromper.
 *
 * Les RÈGLES sont pérennes : l'impôt sur les sociétés à 15 % jusqu'à 42 500 €
 * puis 25 %, la dégressivité de la réduction générale jusqu'à 3 SMIC, les taux
 * de TVA, le report déficitaire plafonné. Elles ne changent qu'avec une loi de
 * finances, et sont marquées `confidence: 'stable'`.
 *
 * Les VALEURS ANNUELLES — SMIC, plafond de la Sécurité sociale, taux moyens de
 * cotisations — sont revalorisées chaque année. Celles qui proviennent d'un
 * texte publié portent `confidence: 'enacted'` et citent ce texte dans
 * `source` ; les taux moyens qui restent des ordres de grandeur portent
 * `confidence: 'to-verify'` : ce ne sont pas des approximations acceptables
 * mais des valeurs à confirmer contre le texte publié avant tout usage engageant
 * (dossier bancaire, levée de fonds, liasse fiscale). Réglages → Paramètres
 * fiscaux les liste toutes et permet de les corriger sans toucher au code.
 *
 * Sur 2027 : au moment où ce module est écrit, aucune loi de finances 2027
 * n'est promulguée. Projeter un exercice 2027 revient donc à reconduire les
 * règles connues — ce que Fynomia fait explicitement plutôt que d'inventer des
 * barèmes. La date de départ d'un plan pouvant tomber en 2027, l'application
 * l'affiche et le dit.
 */

/**
 * Le prélèvement forfaitaire unique, dit en toutes lettres.
 *
 * Six écrans écrivaient « 30 % » et « 17,2 % » à la main. Le jour où la loi de
 * financement de la Sécurité sociale a relevé la CSG sur le capital de 1,4
 * point, le moteur a suivi et les six phrases ont menti. Elles lisent
 * désormais le paramètre, comme le calcul.
 */
const pct = (v) => `${String(Math.round(v * 1000) / 10).replace('.', ',')} %`
export const pfuTotal = () => pct(PARAMS.flatTax.value.total)
export const pfuSocial = () => pct(PARAMS.flatTax.value.socialCharges)
export const pfuIncome = () => pct(PARAMS.flatTax.value.incomeTax)
export const pfuDetail = () => `${pfuTotal()} (${pfuIncome()} + ${pfuSocial()})`

export const FISCAL_YEAR = 2026

/** Dernier exercice dont les règles sont issues d'un texte promulgué. */
export const LAST_ENACTED_YEAR = 2026

/**
 * Confiance :
 *   'stable'    — règle pérenne, ne bouge qu'avec une loi de finances ;
 *   'enacted'   — valeur 2026 relevée dans un texte publié, citée par `source` ;
 *   'to-verify' — valeur reconduite ou moyenne d'usage, à confirmer.
 */
export const PARAMS = {
  // ─────────────────────────────── Bases sociales ──────────────────────────
  smicHourly: {
    value: 12.31,
    unit: '€/h',
    label: 'SMIC horaire brut',
    confidence: 'enacted',
    source: "Revalorisation anticipée du 1er juin 2026",
    note: "Le SMIC a connu deux valeurs en 2026 : 12,02 € au 1er janvier, puis 12,31 € au 1er juin après une revalorisation anticipée de 2,41 % (1 867,02 € brut mensuel pour 35 h). C'est la valeur en vigueur qui est retenue. Elle déplace mécaniquement le point de sortie de la réduction générale — trois SMIC — et les plafonds du dispositif JEI.",
  },
  monthlyHours: {
    value: 151.67,
    unit: 'h/mois',
    label: 'Durée mensuelle légale',
    confidence: 'stable',
    note: '35 h par semaine, soit 151,67 h par mois. Base de conversion du SMIC horaire en SMIC mensuel.',
  },
  pass: {
    value: 48060,
    unit: '€/an',
    label: 'Plafond annuel de la Sécurité sociale (PASS)',
    confidence: 'enacted',
    source: "Plafond 2026 — 4 005 € par mois",
    note: "48 060 € pour 2026, soit 4 005 € par mois : une hausse de 2 % sur 2025. Le PASS borne les tranches de retraite complémentaire, le plafond du dispositif JEI (cinq PASS par établissement) et, par son plafond horaire de 30 €, la gratification de stage.",
  },

  // ──────────────────────── Cotisations employeur / salarié ────────────────
  employerRateNonCadre: {
    value: 0.42,
    unit: '% du brut',
    label: 'Cotisations patronales — non-cadre',
    confidence: 'to-verify',
    note: "Taux moyen tous risques (maladie, vieillesse, famille, chômage, AT/MP, retraite complémentaire, CSA, FNAL, versement mobilité), avant réduction générale. Depuis le 1er janvier 2026, les bandeaux qui abaissaient la cotisation maladie et la cotisation d'allocations familiales sur les bas salaires sont supprimés : tout le monde paie le taux plein — 13 % pour la maladie, 5,25 % pour les allocations familiales — et la réduction générale dégressive unique est désormais le seul allègement. À ajuster selon la convention collective et le taux AT/MP notifié.",
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
    value: { maxCoefUnder50: 0.3981, maxCoefFrom50: 0.4021, ceilingSmicMultiple: 3.0 },
    unit: 'coefficient',
    label: 'Réduction générale dégressive unique (RGDU)',
    confidence: 'enacted',
    source: "Décret du 31 décembre 2025 — paramètres 2026",
    note: "Depuis le 1er janvier 2026, la réduction générale a absorbé les deux bandeaux maladie et famille et s'étale jusqu'à trois SMIC. Le coefficient maximal vaut Tmin + Tdelta, soit 0,3981 pour un employeur au FNAL de 0,10 % (moins de cinquante salariés) et 0,4021 au FNAL de 0,50 %. Tmin de 0,0200 garantit deux points d'allègement jusqu'à trois SMIC. Coefficient = (T / (K−1)) × (K × SMIC annuel / brut annuel − 1), borné entre 0 et T.",
  },
  tnsRate: {
    value: 0.45,
    unit: '% de la rémunération',
    label: 'Cotisations TNS (gérant majoritaire)',
    confidence: 'to-verify',
    note: "Taux global moyen pour un travailleur non salarié affilié au régime des indépendants. Fortement dégressif sur les hauts revenus et majoré sur les faibles revenus (cotisations minimales).",
  },
  internGratification: {
    value: 4.50,
    unit: '€/h',
    label: 'Gratification minimale de stage',
    confidence: 'enacted',
    source: "15 % du plafond horaire 2026 (30 €)",
    note: "4,50 € par heure de stage en 2026, soit 15 % du plafond horaire de la Sécurité sociale porté à 30 €. Obligatoire au-delà de deux mois de stage. Tant que la gratification n'excède pas ce minimum, elle échappe aux cotisations sociales, part salariale comme part patronale.",
  },
  apprenticeEmployerRate: {
    value: 0.11,
    unit: '% du brut',
    label: "Cotisations patronales — apprenti / alternant",
    confidence: 'to-verify',
    note: "Taux réduit après application des exonérations propres aux contrats en alternance.",
  },

  // ──────────────────── Avantages accordés aux salariés ─────────────────────
  //
  // Deux d'entre eux ne sont pas facultatifs : la complémentaire santé
  // collective et la prise en charge de l'abonnement de transport. Un plan qui
  // les oublie sous-estime le coût de chaque embauche de 60 à 100 € par mois.
  transportShare: {
    value: 0.5,
    unit: "% de l'abonnement",
    label: 'Prise en charge obligatoire des transports publics',
    confidence: 'stable',
    note: "L'employeur rembourse au moins 50 % de l'abonnement aux transports publics du domicile au lieu de travail. Cette part est exonérée de cotisations et d'impôt sur le revenu.",
  },
  mealVoucherExemptCap: {
    value: 7.32,
    unit: '€ par titre',
    label: 'Exonération maximale de la part patronale d’un titre-restaurant',
    confidence: 'enacted',
    source: "Plafond d'exonération au 1er janvier 2026",
    note: "7,32 € par titre depuis le 1er janvier 2026. La part patronale doit représenter entre 50 et 60 % de la valeur du titre ; au-delà du plafond, l'excédent est réintégré dans l'assiette des cotisations.",
  },
  sustainableMobilityCap: {
    value: 700,
    unit: '€ par an et par salarié',
    label: 'Plafond du forfait mobilités durables',
    confidence: 'to-verify',
    note: "Vélo, covoiturage, trottinette, transports partagés : le forfait est exonéré de cotisations et d'impôt dans cette limite.",
  },
  forfaitSocialRate: {
    value: 0.08,
    unit: '% de la part patronale',
    label: 'Forfait social sur la prévoyance et la mutuelle',
    confidence: 'stable',
    note: "Dû à partir de 11 salariés sur la contribution patronale de prévoyance et de complémentaire santé. En dessous de ce seuil, l'entreprise en est dispensée.",
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
    value: { exemptionThreshold: 500000, maxRate: 0.0028, minimumContribution: 63, additionalTaxRate: 0.1384 },
    unit: '% de la valeur ajoutée',
    label: 'Cotisation sur la valeur ajoutée des entreprises (CVAE)',
    confidence: 'to-verify',
    note: "Exonération en dessous de 500 000 € de chiffre d'affaires. Taux maximal de 0,28 %, atteint à 50 M€ de CA et progressif en dessous. Une taxe additionnelle s'ajoute au montant dû. Le calendrier de suppression a été décalé deux fois : la loi de finances pour 2024 prévoyait 0,19 % en 2025 puis 0,09 % en 2026, celle pour 2025 a reporté la trajectoire de trois ans et maintient 0,28 % jusqu'en 2027. Le taux de la taxe additionnelle et l'issue du prochain budget restent à confirmer.",
    source: "Loi n° 2025-127 du 14 février 2025 de finances pour 2025, art. 62 — report de trois ans de la suppression progressive de la CVAE.",
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
      { upTo: 11600, rate: 0 },
      { upTo: 29579, rate: 0.11 },
      { upTo: 84577, rate: 0.30 },
      { upTo: 181917, rate: 0.41 },
      { upTo: Infinity, rate: 0.45 },
    ],
    unit: '€',
    label: "Barème de l'impôt sur le revenu",
    confidence: 'enacted',
    source: "Loi de finances pour 2026, article 4",
    note: "Barème par part de quotient familial, revalorisé de 0,9 % par l'article 4 de la loi de finances pour 2026. Il s'applique à l'imposition des revenus de 2025 ; Fynomia le reconduit pour projeter les années suivantes, faute de texte au-delà.",
  },
  salaryAllowance: {
    value: { rate: 0.1, min: 509, max: 14555 },
    unit: '%',
    label: 'Abattement de 10 % sur les salaires',
    confidence: 'enacted',
    source: 'Loi de finances pour 2026',
    note: "Déduction forfaitaire pour frais professionnels, plancher et plafond revalorisés annuellement. Le dirigeant peut opter pour les frais réels si ceux-ci sont supérieurs.",
  },
  familyQuotientCap: {
    value: 1807,
    unit: '€ par demi-part',
    label: 'Plafonnement du quotient familial',
    confidence: 'enacted',
    source: 'Loi de finances pour 2026',
    note: "Avantage maximal procuré par chaque demi-part supplémentaire au-delà d'une part (deux pour un couple). Au-delà, l'économie d'impôt est écrêtée.",
  },
  flatTax: {
    value: { total: 0.314, incomeTax: 0.128, socialCharges: 0.186 },
    unit: '%',
    label: 'Prélèvement forfaitaire unique (flat tax)',
    confidence: 'enacted',
    source: "LFSS 2026 — loi n° 2025-1403 du 30 décembre 2025",
    note: "31,4 % depuis le 1er janvier 2026 : 12,8 % d'impôt sur le revenu, inchangé, et 18,6 % de prélèvements sociaux. La loi de financement de la Sécurité sociale pour 2026 a relevé de 1,4 point la CSG sur les revenus du capital, portant les prélèvements sociaux de 17,2 % à 18,6 %. Un dividende de 10 000 € laisse donc 6 860 € au lieu de 7 000 €. Certains produits gardent 17,2 % — assurance-vie, PEL, CEL, PEP, revenus fonciers et plus-values immobilières — mais pas les dividendes. Le contribuable peut toujours opter pour le barème progressif, avec un abattement de 40 % sur les dividendes, si cela lui est plus favorable.",
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
    note: "Pour un gérant majoritaire de SARL ou d'EURL, la fraction des dividendes excédant 10 % du capital social, des primes d'émission et des sommes en compte courant est soumise aux cotisations sociales des indépendants — de l'ordre de 45 % — au lieu des prélèvements sociaux de 18,6 %. Les présidents de SAS ne sont pas concernés.",
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

/**
 * Profils par type d'activité.
 *
 * Un prévisionnel générique fait dire n'importe quoi à n'importe qui. Un
 * kinésithérapeute ne vend pas des « unités » : il facture des séances, il est
 * exonéré de TVA, il cotise à la CARPIMKO et son plafond de chiffre d'affaires
 * est le nombre de patients qu'il peut voir dans une journée. Chaque profil
 * apporte donc son vocabulaire, son régime fiscal et social, ses repères de
 * marché et les pièges propres au métier.
 *
 * Les repères (`benchmarks`) sont des ordres de grandeur observés, destinés à
 * situer une saisie — pas des normes. Ils alimentent les alertes contextuelles.
 */

import { newActivity, newTeamMember, newCampaign, newOpex, newCapex, uid } from './schema.js'

/** Familles, pour regrouper le choix initial. */
export const FAMILIES = {
  tech: { label: 'Tech et logiciel' },
  services: { label: 'Services aux entreprises' },
  health: { label: 'Santé et professions réglementées' },
  retail: { label: 'Commerce et restauration' },
  personal: { label: 'Services aux particuliers' },
  impact: { label: 'Formation et intérêt général' },
}

const opexSet = (items) => items.map(([label, monthlyAmount]) => newOpex({ label, mode: 'fixed', monthlyAmount }))

export const SECTORS = {
  // ───────────────────────────── Tech ────────────────────────────────────
  logiciel: {
    family: 'tech', label: 'Logiciel en abonnement', glyph: '⌘',
    tagline: "Le revenu se construit une fois et se perd tous les mois.",
    unit: { one: 'abonnement', many: 'abonnements', verb: 'souscrits', client: 'client' },
    vat: { sales: 0.2, label: 'TVA 20 %', note: "Prestation de service au taux normal. Pour un client hors Union européenne, la prestation est hors champ ; pour un professionnel dans l'Union, l'autoliquidation s'applique." },
    legal: { forms: ['SAS', 'SASU'], regime: 'Assimilé salarié', note: "La SAS permet d'accueillir des investisseurs et d'ouvrir le capital aux salariés. Le président relève du régime général : protection meilleure, coût plus élevé qu'un gérant TNS." },
    benchmarks: { grossMargin: [0.75, 0.9], payrollRatio: [0.4, 0.65], churn: [0.01, 0.03], ltvCac: [3, 5] },
    metrics: ['recurringShare', 'ltvCac', 'grossMargin', 'runway'],
    traps: [
      { title: "L'attrition mange la croissance", body: "À 3 % d'attrition mensuelle, vous perdez 30 % de votre base chaque année. Il faut donc courir pour rester immobile : avant d'augmenter le budget d'acquisition, mesurez ce que vous retenez." },
      { title: 'Le CIR se mérite', body: "Développer un produit n'est pas faire de la recherche au sens fiscal. Le CIR suppose une incertitude scientifique ou technique levée par des travaux méthodiques. Un rescrit vaut mieux qu'un redressement." },
    ],
    build(s) {
      s.activities = [newActivity({ name: 'Abonnement', unitPrice: 0, recurringPrice: 49, contractMonths: 24, churnMonthly: 0.025, unitCost: 0, recurringCost: 6, paymentLag: 0, deposit: 1, volumes: { mode: 'growth', launchMonth: 1, startUnits: 8, monthlyGrowth: 0.12, growthDecay: 0.96, cap: '', manual: [] } })]
      s.marketing = [newCampaign({ name: 'Acquisition payante', channel: 'ads', activityId: s.activities[0].id, monthlyBudget: 2000, model: 'cpc', cpc: 1.8, visitToLead: 0.04, leadToClient: 0.15, startMonth: 1, durationMonths: 59 })]
      s.team = [
        newTeamMember({ role: 'Fondateur — produit', contractType: 'cdi', status: 'cadre', monthlyGross: 3200, rdShare: 0.6, innovShare: 0.2 }),
        newTeamMember({ role: 'Développeur', contractType: 'cdi', status: 'cadre', monthlyGross: 3800, startMonth: 3, rdShare: 0.8 }),
      ]
      s.opex = opexSet([['Hébergement et logiciels', 320], ['Comptable et juridique', 300], ['Assurances', 90], ['Banque et paiement', 80]])
      s.capex = [newCapex({ label: 'Postes de travail', amount: 6000, amortYears: 3, rdShare: 0.7 })]
      s.financing.equityFounders = [{ month: 0, amount: 20000 }]
      s.meta.jeiClaimed = true
    },
  },

  developpeur: {
    family: 'tech', label: 'Développeur indépendant', glyph: '⟨⟩',
    tagline: "Votre chiffre d'affaires a un plafond : le nombre de jours dans l'année.",
    unit: { one: 'jour facturé', many: 'jours facturés', verb: 'vendus', client: 'client' },
    vat: { sales: 0.2, label: 'TVA 20 %', note: "Sous 39 100 € de recettes, la franchise en base dispense de facturer la TVA — mais interdit de la récupérer. Au-delà, le régime réel s'impose." },
    legal: { forms: ['EI', 'EURL', 'SASU'], regime: 'TNS ou assimilé salarié', note: "En EURL le gérant est TNS : environ 45 % de cotisations sur la rémunération. En SASU il est assimilé salarié : environ 80 % de charges sur le net, mais une meilleure couverture et la possibilité de se verser des dividendes sans cotisations." },
    benchmarks: { grossMargin: [0.9, 1], billableDays: [180, 220], dailyRate: [400, 750] },
    metrics: ['revenue', 'arpu', 'payrollCost', 'runway'],
    traps: [
      { title: 'Les jours non facturables', body: "Sur 365 jours, retirez week-ends, congés, jours fériés, prospection, administratif et formation : il reste rarement plus de 200 jours facturables. Un TJM de 500 € ne fait pas 182 500 € de chiffre d'affaires, mais plutôt 100 000 €." },
      { title: 'La dépendance à un client', body: "Au-delà de 70 % du chiffre d'affaires sur un seul client, l'URSSAF peut requalifier la relation en salariat déguisé, et la fin du contrat vous laisse sans revenu du jour au lendemain." },
    ],
    build(s) {
      s.activities = [newActivity({ name: 'Développement au forfait jour', unitPrice: 550, recurringPrice: 0, contractMonths: 0, deliveryLag: 0, paymentLag: 1, deposit: 0.3, unitCost: 0, vatRateSales: 0.2, volumes: { mode: 'growth', launchMonth: 0, startUnits: 12, monthlyGrowth: 0.03, growthDecay: 0.94, cap: 18, manual: [] } })]
      s.team = [newTeamMember({ role: 'Gérant', contractType: 'tns', monthlyGross: 3000 })]
      s.opex = opexSet([['Comptable', 150], ['Logiciels et matériel', 120], ['Assurance RC professionnelle', 60], ['Télécom et coworking', 250]])
      s.capex = [newCapex({ label: 'Matériel informatique', amount: 4000, amortYears: 3 })]
      s.financing.equityFounders = [{ month: 0, amount: 5000 }]
    },
  },

  // ───────────────────────── Services aux entreprises ────────────────────
  conseil: {
    family: 'services', label: 'Cabinet de conseil', glyph: '◈',
    tagline: "Vous vendez du temps d'expert : le taux d'occupation fait le résultat.",
    unit: { one: 'mission', many: 'missions', verb: 'signées', client: 'client' },
    vat: { sales: 0.2, label: 'TVA 20 %', note: 'Prestation de conseil au taux normal.' },
    legal: { forms: ['SAS', 'SASU', 'SARL'], regime: 'Assimilé salarié ou TNS', note: "La structure importe moins que le pilotage du taux d'occupation et du délai de règlement des grands comptes." },
    benchmarks: { grossMargin: [0.8, 0.95], payrollRatio: [0.45, 0.6], occupancy: [0.6, 0.75], dso: [45, 75] },
    metrics: ['revenue', 'grossMargin', 'payrollRatio', 'cashLow'],
    traps: [
      { title: 'Le taux d\'occupation, pas le TJM', body: "Un consultant facturé 1 200 € par jour à 50 % d'occupation rapporte moins qu'un consultant à 800 € occupé à 80 %. Le prix rassure, l'occupation paie." },
      { title: 'Les grands comptes paient tard', body: "Soixante à quatre-vingt-dix jours de délai sont la norme. Sur une masse salariale versée le 30 de chaque mois, ce décalage crée un besoin de trésorerie permanent qu'il faut financer avant la première mission." },
    ],
    build(s) {
      s.activities = [newActivity({ name: 'Mission de conseil', unitPrice: 9000, recurringPrice: 0, contractMonths: 0, deliveryLag: 2, paymentLag: 2, deposit: 0.3, milestone: 0.3, unitCost: 800, volumes: { mode: 'growth', launchMonth: 0, startUnits: 1, monthlyGrowth: 0.06, growthDecay: 0.95, cap: 8, manual: [] } })]
      s.team = [
        newTeamMember({ role: 'Fondateur — associé', contractType: 'cdi', status: 'cadre', monthlyGross: 3500 }),
        newTeamMember({ role: 'Consultant', contractType: 'cdi', status: 'cadre', monthlyGross: 3000, startMonth: 6 }),
      ]
      s.marketing = [newCampaign({ name: 'Prospection', channel: 'outbound', activityId: s.activities[0].id, monthlyBudget: 800, model: 'cpl', cpl: 60, leadToClient: 0.12, durationMonths: 59 })]
      s.opex = opexSet([['Bureaux', 900], ['Comptable et juridique', 300], ['Logiciels', 180], ['Assurance RC professionnelle', 110], ['Déplacements', 400]])
      s.financing.equityFounders = [{ month: 0, amount: 10000 }]
    },
  },

  avocat: {
    family: 'services', label: 'Cabinet d\'avocat', glyph: '§',
    tagline: "Un dossier gagné ne vaut rien tant qu'il n'est pas encaissé.",
    unit: { one: 'dossier', many: 'dossiers', verb: 'ouverts', client: 'client' },
    vat: { sales: 0.2, label: 'TVA 20 %', note: "Les honoraires sont soumis à la TVA au taux normal. L'aide juridictionnelle relève d'un régime distinct." },
    legal: { forms: ['BNC', 'SELARL', 'SELAS'], regime: 'TNS (CNBF)', note: "L'avocat cotise à la CNBF, régime propre à la profession, avec des cotisations forfaitaires les premières années puis proportionnelles." },
    benchmarks: { grossMargin: [0.85, 0.95], overheadRatio: [0.25, 0.4], dso: [45, 90] }, ownerIsProfit: true,
    metrics: ['revenue', 'grossMargin', 'cashLow', 'payrollCost'],
    traps: [
      { title: 'Les cotisations décalées', body: "Les cotisations CNBF et URSSAF de la première année sont calculées sur une base forfaitaire, puis régularisées en année deux sur le revenu réel. Une bonne première année produit un appel de cotisations brutal l'année suivante : provisionnez." },
      { title: 'Le recouvrement', body: "L'honoraire facturé n'est pas l'honoraire perçu. Une convention d'honoraires écrite, des provisions demandées à l'ouverture du dossier et une facturation régulière valent mieux qu'une relance." },
    ],
    build(s) {
      s.activities = [newActivity({ name: 'Dossiers et consultations', unitPrice: 2800, recurringPrice: 0, contractMonths: 0, deliveryLag: 2, paymentLag: 2, deposit: 0.4, unitCost: 120, volumes: { mode: 'growth', launchMonth: 0, startUnits: 3, monthlyGrowth: 0.05, growthDecay: 0.95, cap: 14, manual: [] } })]
      s.team = [newTeamMember({ role: 'Avocat associé', contractType: 'tns', monthlyGross: 3500 })]
      s.opex = opexSet([['Cabinet et charges', 850], ['Ordre, CNBF et RCP', 420], ['Documentation juridique', 180], ['Secrétariat', 600], ['Comptable', 200]])
      s.financing.equityFounders = [{ month: 0, amount: 12000 }]
    },
  },

  // ─────────────────────────────── Santé ─────────────────────────────────
  medecin: {
    family: 'health', label: 'Cabinet médical', glyph: '✚',
    tagline: "Votre plafond n'est pas commercial : c'est le nombre d'heures de consultation.",
    unit: { one: 'consultation', many: 'consultations', verb: 'réalisées', client: 'patient' },
    vat: { sales: 0, exempt: true, label: 'Exonéré de TVA', note: "Les soins dispensés aux personnes par les membres des professions médicales et paramédicales réglementées sont exonérés de TVA. En contrepartie, la TVA payée sur vos achats, votre matériel et votre loyer n'est pas récupérable : raisonnez toujours en montants toutes taxes comprises." },
    legal: { forms: ['BNC', 'SELARL', 'SCM'], regime: 'TNS (CARMF)', note: "Le médecin libéral cotise à la CARMF. En secteur 1, l'assurance maladie prend en charge une part des cotisations en contrepartie du respect des tarifs opposables." },
    benchmarks: { grossMargin: [0.95, 1], actsPerDay: [20, 30], overheadRatio: [0.3, 0.45] }, ownerIsProfit: true,
    metrics: ['revenue', 'payrollCost', 'breakEven', 'runway'],
    traps: [
      { title: 'La TVA non récupérable', body: "Exonéré ne veut pas dire avantagé. Un fauteuil à 12 000 € HT vous coûte 14 400 € : la TVA reste à votre charge. Saisissez vos investissements et vos charges toutes taxes comprises." },
      { title: 'Le taux de charges', body: "Les charges d'un cabinet représentent couramment 35 à 45 % des honoraires : local, secrétariat, cotisations, RCP, matériel. Ce sont les honoraires nets, pas bruts, qui déterminent votre revenu." },
    ],
    build(s) {
      s.activities = [newActivity({ name: 'Consultations', unitPrice: 30, recurringPrice: 0, contractMonths: 0, deliveryLag: 0, paymentLag: 0, deposit: 1, unitCost: 1.5, vatRateSales: 0, vatRatePurchase: 0, volumes: { mode: 'growth', launchMonth: 0, startUnits: 260, monthlyGrowth: 0.035, growthDecay: 0.93, cap: 480, manual: [] } })]
      s.team = [
        newTeamMember({ role: 'Médecin', contractType: 'tns', monthlyGross: 4500 }),
        newTeamMember({ role: 'Secrétariat', contractType: 'cdi', monthlyGross: 1900, startMonth: 6 }),
      ]
      s.opex = opexSet([['Local et charges', 950], ['Assurance RCP et cotisations ordinales', 320], ['Matériel médical et consommables', 280], ['Logiciel métier et télétransmission', 130], ['Comptable', 190]])
      s.capex = [newCapex({ label: 'Équipement du cabinet', amount: 25000, amortYears: 7 })]
      s.financing.equityFounders = [{ month: 0, amount: 15000 }]
      s.financing.loans = [{ id: uid('loan'), label: "Prêt d'installation", amount: 40000, month: 0, rate: 0.038, months: 84, graceMonths: 3 }]
      s.meta.vatExempt = true
    },
  },

  kine: {
    family: 'health', label: 'Cabinet de kinésithérapie', glyph: '⟿',
    tagline: "Trente minutes par patient : votre agenda est votre compte de résultat.",
    unit: { one: 'séance', many: 'séances', verb: 'réalisées', client: 'patient' },
    vat: { sales: 0, exempt: true, label: 'Exonéré de TVA', note: "Actes de soins exonérés. La TVA sur vos achats et votre matériel n'est pas récupérable : saisissez tout en montants toutes taxes comprises." },
    legal: { forms: ['BNC', 'SELARL', 'SCM'], regime: 'TNS (CARPIMKO)', note: "Le kinésithérapeute cotise à la CARPIMKO. L'exercice en cabinet de groupe via une SCM permet de partager les charges sans partager les honoraires." },
    benchmarks: { grossMargin: [0.95, 1], sessionsPerDay: [18, 26], overheadRatio: [0.3, 0.4] }, ownerIsProfit: true,
    metrics: ['revenue', 'breakEven', 'payrollCost', 'runway'],
    traps: [
      { title: 'Le nombre de séances est borné', body: "À vingt minutes par séance et sept heures de soins par jour, on plafonne autour de vingt séances quotidiennes. Toute projection au-delà suppose un second praticien ou des séances collectives, pas un effort supplémentaire." },
      { title: 'La rétrocession en collaboration', body: "Un collaborateur libéral reverse en général 20 à 30 % de ses honoraires au titulaire. Ce n'est ni un salaire ni un chiffre d'affaires plein : modélisez-le comme une charge variable." },
    ],
    build(s) {
      s.activities = [newActivity({ name: 'Séances', unitPrice: 22, recurringPrice: 0, contractMonths: 0, deliveryLag: 0, paymentLag: 0, deposit: 1, unitCost: 0.8, vatRateSales: 0, vatRatePurchase: 0, volumes: { mode: 'growth', launchMonth: 0, startUnits: 300, monthlyGrowth: 0.04, growthDecay: 0.93, cap: 420, manual: [] } })]
      s.team = [newTeamMember({ role: 'Kinésithérapeute', contractType: 'tns', monthlyGross: 3200 })]
      s.opex = opexSet([['Local et charges', 800], ['Assurance RCP et cotisations ordinales', 190], ['Consommables et linge', 150], ['Logiciel métier', 90], ['Comptable', 170]])
      s.capex = [newCapex({ label: 'Tables, appareils et aménagement', amount: 22000, amortYears: 7 })]
      s.financing.equityFounders = [{ month: 0, amount: 10000 }]
      s.financing.loans = [{ id: uid('loan'), label: "Prêt d'installation", amount: 30000, month: 0, rate: 0.038, months: 72, graceMonths: 3 }]
      s.meta.vatExempt = true
    },
  },

  dentiste: {
    family: 'health', label: 'Cabinet dentaire', glyph: '⌇',
    tagline: "Fort investissement, forte charge variable : la prothèse décide de la marge.",
    unit: { one: 'acte', many: 'actes', verb: 'réalisés', client: 'patient' },
    vat: { sales: 0, exempt: true, label: 'Exonéré de TVA', note: "Soins dentaires et prothèses exonérés. La TVA sur le fauteuil, l'imagerie et les consommables reste à votre charge : comptez tout toutes taxes comprises." },
    legal: { forms: ['BNC', 'SELARL', 'SCM'], regime: 'TNS (CARCDSF)', note: "Le chirurgien-dentiste cotise à la CARCDSF. L'exercice en SELARL permet d'arbitrer entre rémunération et dividendes, avec la contrainte des cotisations sur les dividendes du gérant majoritaire." },
    benchmarks: { grossMargin: [0.6, 0.75], prostheticCost: [0.2, 0.28], overheadRatio: [0.3, 0.45] }, ownerIsProfit: true,
    metrics: ['revenue', 'grossMargin', 'breakEven', 'cashLow'],
    traps: [
      { title: 'Le laboratoire de prothèse', body: "La sous-traitance prothétique représente 20 à 28 % du chiffre d'affaires correspondant. C'est une charge variable pure : elle doit figurer en coût de revient, sinon votre marge brute est fausse de vingt points." },
      { title: "L'investissement initial", body: "Un fauteuil équipé, l'imagerie et l'aménagement dépassent fréquemment 150 000 €. Amorti sur sept ans, cela pèse près de 1 800 € par mois sur le résultat, et la totalité sort de la trésorerie la première année." },
    ],
    build(s) {
      s.activities = [newActivity({ name: 'Soins et prothèses', unitPrice: 145, recurringPrice: 0, contractMonths: 0, deliveryLag: 0, paymentLag: 0, deposit: 1, unitCost: 38, vatRateSales: 0, vatRatePurchase: 0, volumes: { mode: 'growth', launchMonth: 0, startUnits: 130, monthlyGrowth: 0.035, growthDecay: 0.93, cap: 240, manual: [] } })]
      s.team = [
        newTeamMember({ role: 'Chirurgien-dentiste', contractType: 'tns', monthlyGross: 5500 }),
        newTeamMember({ role: 'Assistante dentaire', contractType: 'cdi', monthlyGross: 2100 }),
      ]
      s.opex = opexSet([['Local et charges', 1400], ['Assurance RCP et cotisations ordinales', 380], ['Consommables et stérilisation', 900], ['Logiciel et imagerie', 220], ['Comptable', 250]])
      s.capex = [newCapex({ label: 'Fauteuil, imagerie et aménagement', amount: 150000, amortYears: 7 })]
      s.financing.equityFounders = [{ month: 0, amount: 30000 }]
      s.financing.loans = [{ id: uid('loan'), label: "Prêt d'installation", amount: 160000, month: 0, rate: 0.04, months: 96, graceMonths: 6 }]
      s.meta.vatExempt = true
    },
  },

  // ──────────────────────── Commerce et restauration ─────────────────────
  restaurant: {
    family: 'retail', label: 'Restaurant', glyph: '☗',
    tagline: "Matière plus personnel sous 65 % du chiffre d'affaires, sinon rien ne reste.",
    unit: { one: 'couvert', many: 'couverts', verb: 'servis', client: 'client' },
    vat: { sales: 0.1, label: 'TVA 10 %', note: "La restauration sur place et la vente à emporter de produits à consommation immédiate relèvent du taux de 10 %. Les boissons alcoolisées restent à 20 %, les produits vendus pour une consommation différée à 5,5 %. Si vous servez du vin, votre taux moyen sera supérieur à 10 %." },
    legal: { forms: ['SARL', 'SAS', 'EURL'], regime: 'TNS ou assimilé salarié', note: "Licence, formation hygiène, affichage des allergènes et registre HACCP conditionnent l'ouverture autant que le financement." },
    benchmarks: { grossMargin: [0.68, 0.75], payrollRatio: [0.32, 0.4], rentRatio: [0.06, 0.1], ticket: [18, 35] },
    metrics: ['revenue', 'grossMargin', 'payrollRatio', 'breakEven'],
    traps: [
      { title: 'Le coût matière se surveille à la semaine', body: "Trente pour cent du chiffre d'affaires est la cible. À trente-cinq, le résultat disparaît. Cela se joue sur les portions, les pertes et les achats, pas sur le prix de la carte." },
      { title: "L'addition des deux gros postes", body: "Le « prime cost » — matière plus personnel chargé — doit rester sous 65 %. Au-delà, aucun volume ne rattrape la structure : il reste le loyer, l'énergie et les assurances à payer." },
      { title: 'La saisonnalité', body: "Un restaurant ne réalise pas le même chiffre en août qu'en novembre. Une projection linéaire surestime les mois creux, précisément ceux où la trésorerie casse." },
    ],
    build(s) {
      s.activities = [newActivity({ name: 'Couverts', unitPrice: 24, recurringPrice: 0, contractMonths: 0, deliveryLag: 0, paymentLag: 0, deposit: 1, unitCost: 7.5, vatRateSales: 0.1, costPaymentLag: 1, volumes: { mode: 'growth', launchMonth: 1, startUnits: 900, monthlyGrowth: 0.04, growthDecay: 0.93, cap: 2200, manual: [] } })]
      s.team = [
        newTeamMember({ role: 'Gérant', contractType: 'tns', monthlyGross: 2200 }),
        newTeamMember({ role: 'Cuisine', contractType: 'cdi', monthlyGross: 2200, count: 2, startMonth: 1 }),
        newTeamMember({ role: 'Salle', contractType: 'cdi', monthlyGross: 1900, count: 2, startMonth: 1 }),
      ]
      s.opex = opexSet([['Loyer et charges', 2400], ['Énergie et fluides', 750], ['Comptable', 260], ['Assurances', 190], ['Encaissement et logiciels', 160], ['Entretien et blanchisserie', 320]])
      s.capex = [newCapex({ label: 'Aménagement et matériel de cuisine', amount: 90000, amortYears: 7 })]
      s.assumptions.stockDays = 12
      s.financing.equityFounders = [{ month: 0, amount: 35000 }]
      s.financing.loans = [{ id: uid('loan'), label: 'Prêt bancaire', amount: 90000, month: 0, rate: 0.042, months: 84, graceMonths: 3 }]
    },
  },

  ecommerce: {
    family: 'retail', label: 'E-commerce', glyph: '⬒',
    tagline: "Vous n'achetez pas des ventes, vous achetez des clients.",
    unit: { one: 'commande', many: 'commandes', verb: 'passées', client: 'client' },
    vat: { sales: 0.2, label: 'TVA 20 %', note: "Taux normal pour la plupart des produits manufacturés. Les ventes à distance vers un autre pays de l'Union basculent au taux du pays de destination au-delà de 10 000 € annuels, via le guichet unique." },
    legal: { forms: ['SASU', 'SAS', 'EURL'], regime: 'Assimilé salarié ou TNS', note: "Mentions légales, conditions générales de vente, droit de rétractation de quatorze jours et registre des traitements sont des obligations, pas des options." },
    benchmarks: { grossMargin: [0.4, 0.6], returnRate: [0.05, 0.25], ltvCac: [2.5, 4], stockDays: [30, 60] },
    metrics: ['revenue', 'grossMargin', 'ltvCac', 'peakBfr'],
    traps: [
      { title: 'Le stock immobilise la trésorerie', body: "Quarante-cinq jours de stock sur 300 000 € d'achats annuels, c'est 37 000 € qui dorment en entrepôt. Ce montant se finance avant la première vente, et il grossit avec la croissance." },
      { title: 'Les retours', body: "Selon le produit, 5 à 25 % des commandes reviennent. Le chiffre d'affaires facturé n'est pas le chiffre d'affaires acquis, et le coût logistique est payé deux fois." },
    ],
    build(s) {
      s.activities = [newActivity({ name: 'Ventes en ligne', unitPrice: 65, recurringPrice: 0, contractMonths: 0, deliveryLag: 0, paymentLag: 0, deposit: 1, unitCost: 28, costPaymentLag: 1, volumes: { mode: 'growth', launchMonth: 0, startUnits: 120, monthlyGrowth: 0.1, growthDecay: 0.95, cap: '', manual: [] } })]
      s.marketing = [newCampaign({ name: 'Publicité produits', channel: 'ads', activityId: s.activities[0].id, monthlyBudget: 3000, model: 'cac', cac: 22, durationMonths: 59 })]
      s.team = [newTeamMember({ role: 'Fondateur', contractType: 'tns', monthlyGross: 2200 })]
      s.opex = opexSet([['Plateforme et applications', 260], ['Comptable', 220], ['Assurances', 90], ['Frais bancaires et paiement', 180]])
      s.assumptions.stockDays = 45
      s.capex = [newCapex({ label: 'Site et logistique', amount: 12000, amortYears: 3 })]
      s.financing.equityFounders = [{ month: 0, amount: 25000 }]
      s.financing.loans = [{ id: uid('loan'), label: 'Prêt bancaire', amount: 30000, month: 1, rate: 0.04, months: 60, graceMonths: 3 }]
    },
  },

  fleuriste: {
    family: 'retail', label: 'Fleuriste', glyph: '❁',
    tagline: "Votre stock se fane : la démarque est votre vraie charge.",
    unit: { one: 'vente', many: 'ventes', verb: 'réalisées', client: 'client' },
    vat: { sales: 0.1, label: 'TVA 10 %', note: "Les fleurs coupées et plantes d'ornement relèvent du taux de 10 %. Les contenants, accessoires et articles de décoration restent à 20 % : votre taux moyen dépend de votre mix." },
    legal: { forms: ['EI', 'EURL', 'SARL'], regime: 'TNS', note: "Commerce de détail : emplacement et flux passants comptent davantage que la surface." },
    benchmarks: { grossMargin: [0.5, 0.6], shrinkage: [0.08, 0.12], rentRatio: [0.08, 0.12], ticket: [22, 40] },
    metrics: ['revenue', 'grossMargin', 'breakEven', 'cashLow'],
    traps: [
      { title: 'La démarque invisible', body: "Huit à douze pour cent des achats finissent à la poubelle. Si vous ne l'intégrez pas au coût de revient, votre marge affichée est fausse d'autant, et vous croirez gagner de l'argent que vous jetez." },
      { title: 'Les pics de saison', body: "Fête des mères, Saint-Valentin et Toussaint peuvent représenter le quart de l'année. Ces pics exigent une avance de trésorerie sur les achats, quelques jours avant l'encaissement." },
    ],
    build(s) {
      s.activities = [newActivity({ name: 'Ventes en boutique', unitPrice: 28, recurringPrice: 0, contractMonths: 0, deliveryLag: 0, paymentLag: 0, deposit: 1, unitCost: 13, vatRateSales: 0.1, costPaymentLag: 1, volumes: { mode: 'growth', launchMonth: 0, startUnits: 620, monthlyGrowth: 0.03, growthDecay: 0.93, cap: 1100, manual: [] } })]
      s.team = [
        newTeamMember({ role: 'Gérant fleuriste', contractType: 'tns', monthlyGross: 2000 }),
        newTeamMember({ role: 'Vendeur', contractType: 'cdi', monthlyGross: 1850, startMonth: 6 }),
      ]
      s.opex = opexSet([['Loyer et charges', 1500], ['Énergie', 330], ['Comptable', 200], ['Assurances', 110], ['Emballages et consommables', 260]])
      s.capex = [newCapex({ label: 'Agencement et chambre froide', amount: 38000, amortYears: 7 })]
      s.assumptions.stockDays = 6
      s.financing.equityFounders = [{ month: 0, amount: 18000 }]
      s.financing.loans = [{ id: uid('loan'), label: 'Prêt bancaire', amount: 40000, month: 0, rate: 0.042, months: 72, graceMonths: 3 }]
    },
  },

  commerce: {
    family: 'retail', label: 'Commerce de détail', glyph: '▤',
    tagline: "La marge se fait à l'achat, pas à la vente.",
    unit: { one: 'vente', many: 'ventes', verb: 'réalisées', client: 'client' },
    vat: { sales: 0.2, label: 'TVA 20 %', note: "Taux normal sur la plupart des produits. L'alimentaire non transformé relève de 5,5 %." },
    legal: { forms: ['EI', 'EURL', 'SARL', 'SAS'], regime: 'TNS ou assimilé salarié', note: "Le bail commercial engage sur neuf ans avec sortie possible tous les trois ans : c'est souvent l'engagement le plus lourd du projet." },
    benchmarks: { grossMargin: [0.3, 0.45], rentRatio: [0.07, 0.12], stockDays: [45, 90] },
    metrics: ['revenue', 'grossMargin', 'peakBfr', 'breakEven'],
    traps: [
      { title: 'La rotation du stock', body: "Un stock qui tourne deux fois par an immobilise six mois d'achats. C'est autant de trésorerie qui ne travaille pas, et le risque d'invendus grandit avec la durée." },
      { title: 'Le loyer est un coût fixe absolu', body: "Il se paie les mois creux comme les mois pleins. Au-delà de 12 % du chiffre d'affaires, l'équilibre devient très difficile à tenir." },
    ],
    build(s) {
      s.activities = [newActivity({ name: 'Ventes', unitPrice: 42, recurringPrice: 0, contractMonths: 0, deliveryLag: 0, paymentLag: 0, deposit: 1, unitCost: 25, costPaymentLag: 1, volumes: { mode: 'growth', launchMonth: 0, startUnits: 420, monthlyGrowth: 0.035, growthDecay: 0.93, cap: 800, manual: [] } })]
      s.team = [
        newTeamMember({ role: 'Gérant', contractType: 'tns', monthlyGross: 2200 }),
        newTeamMember({ role: 'Vendeur', contractType: 'cdi', monthlyGross: 1900, startMonth: 4 }),
      ]
      s.opex = opexSet([['Loyer et charges', 1800], ['Énergie', 280], ['Comptable', 210], ['Assurances', 120], ['Encaissement et logiciels', 130]])
      s.capex = [newCapex({ label: 'Agencement du magasin', amount: 45000, amortYears: 7 })]
      s.assumptions.stockDays = 60
      s.financing.equityFounders = [{ month: 0, amount: 25000 }]
      s.financing.loans = [{ id: uid('loan'), label: 'Prêt bancaire', amount: 60000, month: 0, rate: 0.042, months: 84, graceMonths: 3 }]
    },
  },

  // ───────────────────── Services aux particuliers ───────────────────────
  coiffeur: {
    family: 'personal', label: 'Salon de coiffure', glyph: '✂',
    tagline: "La masse salariale mange la moitié du chiffre : chaque fauteuil doit tourner.",
    unit: { one: 'prestation', many: 'prestations', verb: 'réalisées', client: 'client' },
    vat: { sales: 0.2, label: 'TVA 20 %', note: "Prestations de service au taux normal, comme la revente de produits capillaires." },
    legal: { forms: ['EI', 'EURL', 'SARL'], regime: 'TNS', note: "Diplôme exigé pour l'exercice. La convention collective de la coiffure encadre les minima et les classifications." },
    benchmarks: { grossMargin: [0.85, 0.92], payrollRatio: [0.42, 0.52], rentRatio: [0.08, 0.13], ticket: [30, 48] },
    metrics: ['revenue', 'payrollRatio', 'breakEven', 'cashLow'],
    traps: [
      { title: 'Le seuil du fauteuil', body: "Un poste de travail supplémentaire ajoute un salaire chargé fixe. Il ne devient rentable qu'au-delà d'un remplissage minimal : simulez l'embauche avant de la faire, pas après." },
      { title: 'La revente de produits', body: "Huit à douze pour cent du chiffre d'affaires, à marge élevée et sans temps de travail supplémentaire. C'est souvent la différence entre un salon à l'équilibre et un salon rentable." },
    ],
    build(s) {
      s.activities = [newActivity({ name: 'Prestations', unitPrice: 38, recurringPrice: 0, contractMonths: 0, deliveryLag: 0, paymentLag: 0, deposit: 1, unitCost: 4, volumes: { mode: 'growth', launchMonth: 0, startUnits: 420, monthlyGrowth: 0.035, growthDecay: 0.93, cap: 780, manual: [] } })]
      s.team = [
        newTeamMember({ role: 'Gérant coiffeur', contractType: 'tns', monthlyGross: 2100 }),
        newTeamMember({ role: 'Coiffeur', contractType: 'cdi', monthlyGross: 1950, count: 2, startMonth: 1 }),
      ]
      s.opex = opexSet([['Loyer et charges', 1400], ['Énergie et eau', 320], ['Comptable', 200], ['Assurances', 100], ['Logiciel de réservation', 90]])
      s.capex = [newCapex({ label: 'Agencement et matériel', amount: 42000, amortYears: 7 })]
      s.financing.equityFounders = [{ month: 0, amount: 20000 }]
      s.financing.loans = [{ id: uid('loan'), label: 'Prêt bancaire', amount: 45000, month: 0, rate: 0.042, months: 72, graceMonths: 3 }]
    },
  },

  coach: {
    family: 'personal', label: 'Coach et salle de sport', glyph: '◎',
    tagline: "Vendre un abonnement est facile ; le faire renouveler l'est moins.",
    unit: { one: 'adhérent', many: 'adhérents', verb: 'inscrits', client: 'adhérent' },
    vat: { sales: 0.2, label: 'TVA 20 %', note: "Prestations sportives au taux normal. Une association sportive à gestion désintéressée peut en revanche être exonérée." },
    legal: { forms: ['EI', 'EURL', 'SASU'], regime: 'TNS ou assimilé salarié', note: "La carte professionnelle d'éducateur sportif est obligatoire pour l'encadrement contre rémunération, et se déclare en préfecture." },
    benchmarks: { grossMargin: [0.8, 0.92], churn: [0.03, 0.06], payrollRatio: [0.3, 0.45], rentRatio: [0.12, 0.2] },
    metrics: ['recurringShare', 'revenue', 'breakEven', 'runway'],
    traps: [
      { title: "L'abonnement de janvier", body: "Les inscriptions se concentrent en janvier et en septembre, les résiliations arrivent trois mois plus tard. Une projection lissée surestime la base installée de printemps, précisément quand le loyer continue de tomber." },
      { title: 'Le loyer contre la capacité', body: "Une grande surface attire mais coûte cher : au-delà de 20 % du chiffre d'affaires, le local impose un remplissage que peu de salles atteignent la première année." },
    ],
    build(s) {
      s.activities = [newActivity({ name: 'Abonnements', unitPrice: 0, recurringPrice: 42, contractMonths: 12, churnMonthly: 0.045, unitCost: 0, recurringCost: 3, paymentLag: 0, deposit: 1, volumes: { mode: 'growth', launchMonth: 0, startUnits: 22, monthlyGrowth: 0.06, growthDecay: 0.93, cap: 420, manual: [] } })]
      s.marketing = [newCampaign({ name: 'Acquisition locale', channel: 'ads', activityId: s.activities[0].id, monthlyBudget: 600, model: 'cac', cac: 35, durationMonths: 59 })]
      s.team = [
        newTeamMember({ role: 'Gérant coach', contractType: 'tns', monthlyGross: 2200 }),
        newTeamMember({ role: 'Coach', contractType: 'cdi', monthlyGross: 2000, startMonth: 8 }),
      ]
      s.opex = opexSet([['Loyer et charges', 2200], ['Énergie', 420], ['Comptable', 200], ['Assurances', 140], ['Logiciel de gestion', 90]])
      s.capex = [newCapex({ label: 'Équipement et aménagement', amount: 70000, amortYears: 7 })]
      s.financing.equityFounders = [{ month: 0, amount: 25000 }]
      s.financing.loans = [{ id: uid('loan'), label: 'Prêt bancaire', amount: 75000, month: 0, rate: 0.042, months: 84, graceMonths: 6 }]
    },
  },

  // ───────────────────── Formation et intérêt général ────────────────────
  formation: {
    family: 'impact', label: 'Organisme de formation', glyph: '◫',
    tagline: "Sans certification, vos clients ne peuvent pas vous financer.",
    unit: { one: 'stagiaire-jour', many: 'stagiaires-jours', verb: 'formés', client: 'stagiaire' },
    vat: { sales: 0, exempt: true, label: 'Exonéré de TVA', note: "La formation professionnelle continue est exonérée de TVA pour les organismes titulaires de l'attestation délivrée par la préfecture. À défaut, le taux normal s'applique. L'exonération prive du droit à déduction sur les achats." },
    legal: { forms: ['SAS', 'SASU', 'SARL', 'Association'], regime: 'Assimilé salarié ou TNS', note: "Un numéro de déclaration d'activité est obligatoire dès la première convention. La certification Qualiopi conditionne l'accès aux financements publics et mutualisés : sans elle, la plupart des entreprises ne peuvent pas faire prendre en charge vos formations." },
    benchmarks: { grossMargin: [0.55, 0.75], payrollRatio: [0.35, 0.5], fillRate: [0.6, 0.8] },
    metrics: ['revenue', 'grossMargin', 'breakEven', 'runway'],
    traps: [
      { title: 'Le taux de remplissage', body: "Une session à huit places qui en vend quatre coûte le même formateur et la même salle. C'est le remplissage, pas le prix, qui fait la marge d'un organisme de formation." },
      { title: 'Les délais de paiement des financeurs', body: "Un opérateur de compétences règle après service fait et sur dossier complet : comptez soixante à quatre-vingt-dix jours. Le formateur, lui, est payé à la fin du mois." },
    ],
    build(s) {
      s.activities = [newActivity({ name: 'Sessions de formation', unitPrice: 780, recurringPrice: 0, contractMonths: 0, deliveryLag: 1, paymentLag: 2, deposit: 0.3, unitCost: 210, vatRateSales: 0, vatRatePurchase: 0, volumes: { mode: 'growth', launchMonth: 1, startUnits: 22, monthlyGrowth: 0.05, growthDecay: 0.94, cap: 90, manual: [] } })]
      s.team = [
        newTeamMember({ role: 'Fondateur — formateur', contractType: 'cdi', status: 'cadre', monthlyGross: 3000 }),
        newTeamMember({ role: 'Coordination pédagogique', contractType: 'cdi', monthlyGross: 2300, startMonth: 8 }),
      ]
      s.marketing = [newCampaign({ name: 'Acquisition entreprises', channel: 'outbound', activityId: s.activities[0].id, monthlyBudget: 900, model: 'cpl', cpl: 70, leadToClient: 0.15, durationMonths: 59 })]
      s.opex = opexSet([['Salles et logistique', 700], ['Certification et audits', 250], ['Comptable', 210], ['Plateforme pédagogique', 180], ['Assurances', 90]])
      s.financing.equityFounders = [{ month: 0, amount: 15000 }]
      s.meta.vatExempt = true
    },
  },

  association: {
    family: 'impact', label: 'Association', glyph: '◇',
    tagline: "Pas d'actionnaire à rémunérer, mais une trésorerie à tenir quand même.",
    unit: { one: 'adhésion', many: 'adhésions', verb: 'enregistrées', client: 'adhérent' },
    vat: { sales: 0, exempt: true, label: 'Non assujettie', note: "Une association à gestion désintéressée, dont l'activité ne concurrence pas le secteur commercial, échappe à la TVA, à l'impôt sur les sociétés et à la contribution économique territoriale. Les activités lucratives accessoires sont tolérées sous un seuil de franchise annuel." },
    legal: { forms: ['Association loi 1901'], regime: 'Bénévolat et salariat', note: "La gestion désintéressée suppose des dirigeants bénévoles. Une rémunération est possible au-delà d'un certain niveau de ressources, mais elle est encadrée et peut faire basculer l'association dans le champ fiscal." },
    benchmarks: { grantShare: [0.4, 0.75], payrollRatio: [0.4, 0.65], reserveMonths: [3, 6] }, resourcesIncludeGrants: true,
    metrics: ['revenue', 'payrollCost', 'cashLow', 'runway'],
    traps: [
      { title: 'La dépendance aux subventions', body: "Au-delà de 60 % de subventions dans les ressources, une décision politique peut interrompre l'activité. Diversifier — cotisations, prestations, mécénat — n'est pas une préférence, c'est une assurance." },
      { title: 'Les subventions arrivent après les dépenses', body: "Le solde d'une subvention est souvent versé sur justification, l'année suivante. Les salaires, eux, se paient tous les mois : un fonds de roulement de trois à six mois de charges est le minimum." },
    ],
    build(s) {
      s.activities = [newActivity({ name: 'Adhésions et participations', unitPrice: 45, recurringPrice: 0, contractMonths: 0, deliveryLag: 0, paymentLag: 0, deposit: 1, unitCost: 4, vatRateSales: 0, vatRatePurchase: 0, volumes: { mode: 'growth', launchMonth: 0, startUnits: 90, monthlyGrowth: 0.03, growthDecay: 0.93, cap: 260, manual: [] } })]
      s.team = [
        newTeamMember({ role: 'Coordination', contractType: 'cdi', monthlyGross: 2400 }),
        newTeamMember({ role: 'Animation', contractType: 'cdi', monthlyGross: 2000, startMonth: 4 }),
      ]
      s.opex = opexSet([['Local et charges', 650], ['Assurances', 90], ['Comptable', 180], ['Matériel et activités', 420], ['Communication', 200]])
      s.financing.equityFounders = [{ month: 0, amount: 4000 }]
      s.financing.grants = [
        { id: uid('grt'), label: 'Subvention de fonctionnement', amount: 55000, month: 2, months: 12 },
        { id: uid('grt'), label: 'Subvention de projet', amount: 30000, month: 14, months: 12 },
      ]
      s.meta.vatExempt = true
      s.meta.nonProfit = true
      s.meta.reducedCorporateTax = false
    },
  },
}

export const SECTOR_KEYS = Object.keys(SECTORS)
export const getSector = (key) => SECTORS[key] || null

/** Secteurs regroupés par famille, pour l'écran de choix. */
export function sectorsByFamily() {
  return Object.entries(FAMILIES).map(([key, family]) => ({
    key, ...family,
    sectors: SECTOR_KEYS.filter((k) => SECTORS[k].family === key).map((k) => ({ key: k, ...SECTORS[k] })),
  })).filter((f) => f.sectors.length)
}

/** Vocabulaire du secteur courant, avec repli générique. */
export function vocabulary(scenario) {
  const sector = getSector(scenario?.meta?.sectorKey)
  return sector?.unit || { one: 'unité', many: 'unités', verb: 'vendues', client: 'client' }
}

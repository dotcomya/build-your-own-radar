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

/**
 * Cinq ans de volumes à partir d'une année type.
 *
 * Un glacier ne vend pas la même chose en février et en juillet. Saisir une
 * moyenne mensuelle donnerait un modèle faux là où il compte : la trésorerie
 * de l'hiver. On répète donc la saison, avec une légère croissance annuelle.
 */
const seasonal = (year, growth = 1.08) =>
  Array.from({ length: 60 }, (_, m) => Math.round(year[m % 12] * growth ** Math.floor(m / 12)))

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
      { title: "L'attrition mange la croissance", body: "À 3 % d'attrition mensuelle, tu perds 30 % de ta base chaque année. Il faut donc courir pour rester immobile : avant d'augmenter le budget d'acquisition, mesure ce que tu retiens." },
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
    tagline: "Ton chiffre d'affaires a un plafond : le nombre de jours dans l'année.",
    unit: { one: 'jour facturé', many: 'jours facturés', verb: 'vendus', client: 'client' },
    vat: { sales: 0.2, label: 'TVA 20 %', note: "Sous 37 500 € de recettes, la franchise en base dispense de facturer la TVA — mais interdit de la récupérer. Au-delà du seuil majoré de 41 250 €, la TVA est due dès le premier jour du dépassement." },
    legal: { forms: ['EI', 'MICRO', 'EURL', 'SASU'], regime: 'TNS ou assimilé salarié', note: "En micro-entreprise, tu cotises 25,6 % de ce que tu encaisses, sans rien déduire — simple tant que tu restes sous 83 600 € de chiffre d'affaires. En EURL le gérant est TNS : environ 45 % de cotisations sur la rémunération. En SASU il est assimilé salarié : environ 80 % de charges sur le net, mais une meilleure couverture et la possibilité de se verser des dividendes sans cotisations." },
    benchmarks: { grossMargin: [0.9, 1], billableDays: [180, 220], dailyRate: [400, 750] },
    metrics: ['revenue', 'arpu', 'payrollCost', 'runway'],
    traps: [
      { title: 'Les jours non facturables', body: "Sur 365 jours, retire week-ends, congés, jours fériés, prospection, administratif et formation : il reste rarement plus de 200 jours facturables. Un TJM de 500 € ne fait pas 182 500 € de chiffre d'affaires, mais plutôt 100 000 €." },
      { title: 'La dépendance à un client', body: "Au-delà de 70 % du chiffre d'affaires sur un seul client, l'URSSAF peut requalifier la relation en salariat déguisé, et la fin du contrat te laisse sans revenu du jour au lendemain." },
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
    tagline: "Tu vends du temps d'expert : le taux d'occupation fait le résultat.",
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
      { title: 'Les cotisations décalées', body: "Les cotisations CNBF et URSSAF de la première année sont calculées sur une base forfaitaire, puis régularisées en année deux sur le revenu réel. Une bonne première année produit un appel de cotisations brutal l'année suivante : provisionne." },
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
    tagline: "Ton plafond n'est pas commercial : c'est le nombre d'heures de consultation.",
    unit: { one: 'consultation', many: 'consultations', verb: 'réalisées', client: 'patient' },
    vat: { sales: 0, exempt: true, label: 'Exonéré de TVA', note: "Les soins dispensés aux personnes par les membres des professions médicales et paramédicales réglementées sont exonérés de TVA. En contrepartie, la TVA payée sur tes achats, ton matériel et ton loyer n'est pas récupérable : raisonne toujours en montants toutes taxes comprises." },
    legal: { forms: ['BNC', 'SELARL', 'SCM'], regime: 'TNS (CARMF)', note: "Le médecin libéral cotise à la CARMF. En secteur 1, l'assurance maladie prend en charge une part des cotisations en contrepartie du respect des tarifs opposables." },
    benchmarks: { grossMargin: [0.95, 1], actsPerDay: [20, 30], overheadRatio: [0.3, 0.45] }, ownerIsProfit: true,
    metrics: ['revenue', 'payrollCost', 'breakEven', 'runway'],
    traps: [
      { title: 'La TVA non récupérable', body: "Exonéré ne veut pas dire avantagé. Un fauteuil à 12 000 € HT te coûte 14 400 € : la TVA reste à ta charge. Saisis tes investissements et tes charges toutes taxes comprises." },
      { title: 'Le taux de charges', body: "Les charges d'un cabinet représentent couramment 35 à 45 % des honoraires : local, secrétariat, cotisations, RCP, matériel. Ce sont les honoraires nets, pas bruts, qui déterminent ton revenu." },
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
    tagline: "Trente minutes par patient : ton agenda est ton compte de résultat.",
    unit: { one: 'séance', many: 'séances', verb: 'réalisées', client: 'patient' },
    vat: { sales: 0, exempt: true, label: 'Exonéré de TVA', note: "Actes de soins exonérés. La TVA sur tes achats et ton matériel n'est pas récupérable : saisis tout en montants toutes taxes comprises." },
    legal: { forms: ['BNC', 'SELARL', 'SCM'], regime: 'TNS (CARPIMKO)', note: "Le kinésithérapeute cotise à la CARPIMKO. L'exercice en cabinet de groupe via une SCM permet de partager les charges sans partager les honoraires." },
    benchmarks: { grossMargin: [0.95, 1], sessionsPerDay: [18, 26], overheadRatio: [0.3, 0.4] }, ownerIsProfit: true,
    metrics: ['revenue', 'breakEven', 'payrollCost', 'runway'],
    traps: [
      { title: 'Le nombre de séances est borné', body: "À vingt minutes par séance et sept heures de soins par jour, on plafonne autour de vingt séances quotidiennes. Toute projection au-delà suppose un second praticien ou des séances collectives, pas un effort supplémentaire." },
      { title: 'La rétrocession en collaboration', body: "Un collaborateur libéral reverse en général 20 à 30 % de ses honoraires au titulaire. Ce n'est ni un salaire ni un chiffre d'affaires plein : modélise-le comme une charge variable." },
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
    vat: { sales: 0, exempt: true, label: 'Exonéré de TVA', note: "Soins dentaires et prothèses exonérés. La TVA sur le fauteuil, l'imagerie et les consommables reste à ta charge : compte tout toutes taxes comprises." },
    legal: { forms: ['BNC', 'SELARL', 'SCM'], regime: 'TNS (CARCDSF)', note: "Le chirurgien-dentiste cotise à la CARCDSF. L'exercice en SELARL permet d'arbitrer entre rémunération et dividendes, avec la contrainte des cotisations sur les dividendes du gérant majoritaire." },
    benchmarks: { grossMargin: [0.6, 0.75], prostheticCost: [0.2, 0.28], overheadRatio: [0.3, 0.45] }, ownerIsProfit: true,
    metrics: ['revenue', 'grossMargin', 'breakEven', 'cashLow'],
    traps: [
      { title: 'Le laboratoire de prothèse', body: "La sous-traitance prothétique représente 20 à 28 % du chiffre d'affaires correspondant. C'est une charge variable pure : elle doit figurer en coût de revient, sinon ta marge brute est fausse de vingt points." },
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
    vat: { sales: 0.1, label: 'TVA 10 %', note: "La restauration sur place et la vente à emporter de produits à consommation immédiate relèvent du taux de 10 %. Les boissons alcoolisées restent à 20 %, les produits vendus pour une consommation différée à 5,5 %. Si tu sers du vin, ton taux moyen sera supérieur à 10 %." },
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

  glacier: {
    family: 'retail', label: 'Glacier', glyph: '◔',
    tagline: "Quatre mois font ton année. Les vitrines, elles, tournent les douze.",
    unit: { one: 'glace', many: 'glaces', verb: 'vendues', client: 'client' },
    vat: { sales: 0.1, label: 'TVA 10 %', note: "Une glace consommée sur place ou à emporter pour consommation immédiate relève du taux de 10 %. Un pot vendu pour être emporté et consommé plus tard passe à 5,5 %. Si tu vends surtout des pots et des bacs, ton taux moyen sera plus bas." },
    legal: { forms: ['EI', 'MICRO', 'EURL', 'SARL', 'SAS'], regime: 'TNS ou assimilé salarié', note: "Formation hygiène obligatoire, agrément sanitaire si tu fabriques pour revendre à d'autres commerces, et registre HACCP dès l'ouverture." },
    benchmarks: { grossMargin: [0.72, 0.8], payrollRatio: [0.24, 0.34], rentRatio: [0.08, 0.14], ticket: [4, 9] },
    metrics: ['revenue', 'grossMargin', 'breakEven', 'cashLow'],
    traps: [
      { title: 'La saison n’est pas une moyenne', body: "De juin à septembre, tu fais souvent les deux tiers de l'année. Un prévisionnel lissé sur douze mois affiche une trésorerie confortable en février, alors que c'est le mois où les glaciers ferment." },
      { title: 'Le froid ne s’arrête jamais', body: "Conservateurs à −18 °C, vitrines à −14 °C : l'électricité court la nuit, le dimanche et hors saison. C'est une charge fixe, pas une charge d'exploitation." },
      { title: 'Le prix du lait et de la vanille', body: "Ta matière première suit des cours mondiaux. Indexe-la sur tes ventes plutôt qu'en montant fixe, et regarde ce qu'une hausse de 20 % fait à ta marge." },
    ],
    build(s) {
      s.activities = [
        newActivity({ name: 'Cornets et coupes', unitPrice: 4.5, unitCost: 0.95, paymentLag: 0, deposit: 1, vatRateSales: 0.1,
          volumes: { mode: 'manual', launchMonth: 0, startUnits: 0, manual: seasonal([300, 400, 900, 1600, 2600, 4200, 5200, 4800, 2400, 1000, 450, 500]) } }),
        newActivity({ name: 'Pots à emporter', unitPrice: 9.5, unitCost: 2.6, paymentLag: 0, deposit: 1, vatRateSales: 0.055,
          volumes: { mode: 'manual', launchMonth: 0, startUnits: 0, manual: seasonal([120, 140, 220, 320, 460, 700, 820, 780, 420, 220, 160, 260]) } }),
      ]
      s.team = [
        newTeamMember({ role: 'Gérant glacier', contractType: 'tns', monthlyGross: 2000 }),
        newTeamMember({ role: 'Vendeur saisonnier', contractType: 'cdd', monthlyGross: 1900, count: 2, startMonth: 4, endMonth: 9 }),
      ]
      s.opex = opexSet([['Loyer et charges', 1600], ['Électricité — vitrines et conservateurs', 620], ['Comptable', 200], ['Assurances', 120], ['Maintenance du froid', 180]])
      s.capex = [
        newCapex({ label: 'Turbine à glace et pasteurisateur', amount: 24000, amortYears: 7 }),
        newCapex({ label: 'Vitrine réfrigérée à bacs', amount: 13000, amortYears: 7 }),
        newCapex({ label: 'Laboratoire et agencement', amount: 26000, amortYears: 9 }),
      ]
      s.assumptions.stockDays = 20
      s.financing.equityFounders = [{ month: 0, amount: 25000 }]
      s.financing.loans = [{ id: uid('loan'), label: 'Prêt bancaire', amount: 60000, month: 0, rate: 0.042, months: 84, graceMonths: 3 }]
    },
  },

  boulangerie: {
    family: 'retail', label: 'Boulangerie et fabrication alimentaire', glyph: '▤',
    tagline: "Tu fabriques et tu vends le même jour : la perte, c'est de la marge partie à la poubelle.",
    unit: { one: 'vente', many: 'ventes', verb: 'encaissées', client: 'client' },
    vat: { sales: 0.055, label: 'TVA 5,5 %', note: "Le pain, la pâtisserie et les produits vendus à emporter pour une consommation différée relèvent du taux de 5,5 %. Ce qui est consommé sur place passe à 10 %, les confiseries et le chocolat à 20 %. Un point de vente mixte a donc trois taux à tenir." },
    legal: { forms: ['EI', 'MICRO', 'EURL', 'SARL', 'SAS'], regime: 'TNS ou assimilé salarié', note: "CAP exigé pour la fabrication, formation hygiène obligatoire, registre HACCP et déclaration d'activité auprès de la direction départementale." },
    benchmarks: { grossMargin: [0.65, 0.75], payrollRatio: [0.3, 0.4], rentRatio: [0.05, 0.1], ticket: [4, 12] },
    metrics: ['revenue', 'grossMargin', 'payrollRatio', 'breakEven'],
    traps: [
      { title: 'Les invendus', body: "Trois à huit pour cent de la production part chaque soir. Ce n'est pas une charge exceptionnelle, c'est une ligne du modèle : indexe-la sur les ventes." },
      { title: "L'énergie du fournil", body: "Un four à pain tourne la nuit. La facture d'énergie d'une boulangerie n'a rien à voir avec celle d'un commerce de même surface." },
      { title: 'Les horaires', body: "La production commence à quatre heures. La masse salariale porte des majorations de nuit qu'un calcul au taux horaire de base ignore." },
    ],
    build(s) {
      s.activities = [
        newActivity({ name: 'Pain et viennoiserie', unitPrice: 4.2, unitCost: 1.15, paymentLag: 0, deposit: 1, vatRateSales: 0.055, costPaymentLag: 1,
          volumes: { mode: 'growth', launchMonth: 0, startUnits: 3800, monthlyGrowth: 0.03, growthDecay: 0.93, cap: 6200, manual: [] } }),
        newActivity({ name: 'Pâtisserie et snacking', unitPrice: 9.5, unitCost: 3.1, paymentLag: 0, deposit: 1, vatRateSales: 0.055,
          volumes: { mode: 'growth', launchMonth: 0, startUnits: 700, monthlyGrowth: 0.035, growthDecay: 0.94, cap: 1400, manual: [] } }),
      ]
      s.team = [
        newTeamMember({ role: 'Gérant boulanger', contractType: 'tns', monthlyGross: 2100 }),
        newTeamMember({ role: 'Boulanger', contractType: 'cdi', monthlyGross: 2100, startMonth: 1 }),
        newTeamMember({ role: 'Vendeur', contractType: 'cdi', monthlyGross: 1900, count: 2, startMonth: 1 }),
      ]
      s.opex = opexSet([['Loyer et charges', 1900], ['Énergie — four et froid', 1250], ['Comptable', 240], ['Assurances', 160], ['Entretien et maintenance', 220]])
      s.capex = [
        newCapex({ label: 'Four et pétrin', amount: 62000, amortYears: 9 }),
        newCapex({ label: 'Agencement et vitrines', amount: 38000, amortYears: 9 }),
      ]
      s.assumptions.stockDays = 8
      s.financing.equityFounders = [{ month: 0, amount: 40000 }]
      s.financing.loans = [{ id: uid('loan'), label: 'Prêt bancaire', amount: 120000, month: 0, rate: 0.042, months: 96, graceMonths: 3 }]
    },
  },

  ecommerce: {
    family: 'retail', label: 'E-commerce', glyph: '⬒',
    tagline: "Tu n'achètes pas des ventes, tu achètes des clients.",
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
    tagline: "Ton stock se fane : la démarque est ton vraie charge.",
    unit: { one: 'vente', many: 'ventes', verb: 'réalisées', client: 'client' },
    vat: { sales: 0.1, label: 'TVA 10 %', note: "Les fleurs coupées et plantes d'ornement relèvent du taux de 10 %. Les contenants, accessoires et articles de décoration restent à 20 % : ton taux moyen dépend de ton mix." },
    legal: { forms: ['EI', 'MICRO', 'EURL', 'SARL'], regime: 'TNS', note: "Commerce de détail : emplacement et flux passants comptent davantage que la surface." },
    benchmarks: { grossMargin: [0.5, 0.6], shrinkage: [0.08, 0.12], rentRatio: [0.08, 0.12], ticket: [22, 40] },
    metrics: ['revenue', 'grossMargin', 'breakEven', 'cashLow'],
    traps: [
      { title: 'La démarque invisible', body: "Huit à douze pour cent des achats finissent à la poubelle. Si tu ne l'intègres pas au coût de revient, ta marge affichée est fausse d'autant, et tu croiras gagner de l'argent que tu jettes." },
      { title: 'Les pics de saison', body: "Fête des mères, Saint-Valentin et Toussaint peuvent représenter le quart de l'année. Ces pics exigent une avance de trésorerie sur les achats, quelques jours avant l'encaissement." },
    ],
    build(s) {
      s.activities = [newActivity({ name: 'Ventes en boutique', unitPrice: 28, recurringPrice: 0, contractMonths: 0, deliveryLag: 0, paymentLag: 0, deposit: 1, unitCost: 13, vatRateSales: 0.1, costPaymentLag: 1, volumes: { mode: 'growth', launchMonth: 0, startUnits: 620, monthlyGrowth: 0.03, growthDecay: 0.93, cap: 1100, manual: [] } })]
      s.team = [
        newTeamMember({ role: 'Gérant fleuriste', contractType: 'tns', monthlyGross: 2000 }),
        newTeamMember({ role: 'Vendeur', contractType: 'cdi', monthlyGross: 1870, startMonth: 6 }),
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
    legal: { forms: ['EI', 'MICRO', 'EURL', 'SARL', 'SAS'], regime: 'TNS ou assimilé salarié', note: "Le bail commercial engage sur neuf ans avec sortie possible tous les trois ans : c'est souvent l'engagement le plus lourd du projet." },
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
    legal: { forms: ['EI', 'MICRO', 'EURL', 'SARL'], regime: 'TNS', note: "Diplôme exigé pour l'exercice. La convention collective de la coiffure encadre les minima et les classifications." },
    benchmarks: { grossMargin: [0.85, 0.92], payrollRatio: [0.42, 0.52], rentRatio: [0.08, 0.13], ticket: [30, 48] },
    metrics: ['revenue', 'payrollRatio', 'breakEven', 'cashLow'],
    traps: [
      { title: 'Le seuil du fauteuil', body: "Un poste de travail supplémentaire ajoute un salaire chargé fixe. Il ne devient rentable qu'au-delà d'un remplissage minimal : simule l'embauche avant de la faire, pas après." },
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

  spa: {
    family: 'personal', label: 'Spa et institut de bien-être', glyph: '♨',
    tagline: "Le sauna chauffe pour un client comme pour vingt.",
    unit: { one: 'soin', many: 'soins', verb: 'réalisés', client: 'client' },
    vat: { sales: 0.2, label: 'TVA 20 %', note: "Soins du corps, accès au spa et revente de cosmétiques relèvent tous du taux normal. Seuls les actes médicaux pratiqués par un professionnel de santé en sont exonérés." },
    legal: { forms: ['EURL', 'SARL', 'SAS'], regime: 'TNS ou assimilé salarié', note: "Établissement recevant du public : commission de sécurité, accessibilité et contrôle sanitaire de l'eau conditionnent l'ouverture. Le CAP esthétique est exigé pour les soins du visage et du corps." },
    benchmarks: { grossMargin: [0.82, 0.9], payrollRatio: [0.35, 0.45], rentRatio: [0.12, 0.2], ticket: [60, 110] },
    metrics: ['revenue', 'payrollRatio', 'breakEven', 'recurringShare'],
    traps: [
      { title: 'Les charges fixes tournent à vide', body: "Hammam, sauna, filtration et ventilation consomment aux heures d'ouverture, pleines ou non. Ton seuil de rentabilité est haut et il se franchit par le remplissage, pas par le prix." },
      { title: "L'eau et l'humidité", body: "Un bassin se renouvelle, s'évapore et s'analyse. La déshumidification n'est pas une option de confort : sans elle, le bâtiment se dégrade en quelques saisons." },
      { title: 'Le temps de cabine', body: "Ta capacité n'est pas un nombre de clients mais un nombre d'heures de cabine. Deux praticiennes à temps plein plafonnent ton chiffre, quel que soit ton marketing." },
    ],
    build(s) {
      s.activities = [
        newActivity({ name: 'Modelages et soins', unitPrice: 85, unitCost: 9, paymentLag: 0, deposit: 1,
          volumes: { mode: 'growth', launchMonth: 1, startUnits: 90, monthlyGrowth: 0.05, growthDecay: 0.93, cap: 320, manual: [] } }),
        newActivity({ name: 'Abonnement bien-être', unitPrice: 0, recurringPrice: 120, contractMonths: 12, churnMonthly: 0.04, recurringCost: 14, paymentLag: 0, deposit: 1,
          volumes: { mode: 'growth', launchMonth: 2, startUnits: 6, monthlyGrowth: 0.1, growthDecay: 0.95, cap: '', manual: [] } }),
      ]
      s.team = [
        newTeamMember({ role: 'Gérante', contractType: 'tns', monthlyGross: 2200 }),
        newTeamMember({ role: 'Praticienne', contractType: 'cdi', monthlyGross: 2000, count: 2, startMonth: 1 }),
      ]
      s.opex = opexSet([['Loyer et charges', 2600], ['Électricité — sauna, hammam, pompes', 950], ['Eau — bassin et douches', 480], ['Linge et blanchisserie', 420], ['Traitement de l’eau et analyses', 260], ['Comptable', 240], ['Assurances', 180]])
      s.capex = [
        newCapex({ label: 'Sauna et hammam', amount: 32000, amortYears: 9 }),
        newCapex({ label: 'Bassin, filtration et traitement d’eau', amount: 48000, amortYears: 9 }),
        newCapex({ label: 'Cabines de soin et agencement', amount: 41000, amortYears: 9 }),
      ]
      s.financing.equityFounders = [{ month: 0, amount: 45000 }]
      s.financing.loans = [{ id: uid('loan'), label: 'Prêt bancaire', amount: 130000, month: 0, rate: 0.043, months: 96, graceMonths: 6 }]
    },
  },

  hebergement: {
    family: 'personal', label: 'Hébergement touristique', glyph: '⌂',
    tagline: "Ton chiffre d'affaires tient en deux nombres : le prix de la nuit et le taux de remplissage.",
    unit: { one: 'nuitée', many: 'nuitées', verb: 'vendues', client: 'voyageur' },
    vat: { sales: 0.1, label: 'TVA 10 %', note: "L'hébergement en hôtel, camping ou meublé de tourisme classé relève du taux de 10 %. La location nue de meublé non classé est exonérée ; dès que trois prestations para-hôtelières sont fournies — petit déjeuner, ménage, linge, accueil — la TVA s'applique." },
    legal: { forms: ['EI', 'MICRO', 'SARL', 'SAS'], regime: 'TNS ou assimilé salarié', note: "Déclaration en mairie, numéro d'enregistrement et taxe de séjour à collecter. En zone tendue, le changement d'usage peut être exigé et limiter la location à cent vingt jours par an." },
    benchmarks: { grossMargin: [0.72, 0.85], occupancy: [0.45, 0.7], payrollRatio: [0.2, 0.35], ticket: [70, 180] },
    metrics: ['revenue', 'grossMargin', 'breakEven', 'cashLow'],
    traps: [
      { title: 'Le taux de remplissage, pas le nombre de lits', body: "Six chambres ne font pas six fois trois cent soixante-cinq nuitées. À 55 % de remplissage annuel — déjà correct — tu vends la moitié de ce qu'un calcul naïf annonce." },
      { title: 'La commission des plateformes', body: "Quinze à vingt pour cent du prix de la nuit part en commission, et la TVA se calcule sur le prix payé par le voyageur, pas sur ce qui te reste." },
      { title: 'La saison', body: "Deux mois font souvent la moitié de l'année. Les charges fixes, elles, courent sur douze." },
    ],
    build(s) {
      s.activities = [newActivity({ name: 'Nuitées', unitPrice: 95, unitCost: 14, paymentLag: 0, deposit: 1, vatRateSales: 0.1,
        volumes: { mode: 'manual', launchMonth: 0, startUnits: 0, manual: seasonal([40, 45, 70, 95, 130, 165, 200, 195, 140, 85, 50, 70]) } })]
      s.team = [newTeamMember({ role: 'Gérant', contractType: 'tns', monthlyGross: 1900 })]
      s.opex = opexSet([['Charges de copropriété et taxe foncière', 480], ['Énergie et eau', 320], ['Ménage et blanchisserie', 560], ['Assurances', 140], ['Comptable', 190]])
      s.capex = [newCapex({ label: 'Ameublement et décoration', amount: 28000, amortYears: 7 })]
      s.financing.equityFounders = [{ month: 0, amount: 30000 }]
    },
  },

  services: {
    family: 'personal', label: 'Service à la personne', glyph: '◌',
    tagline: "Tu vends des heures : le prix et le nombre d'intervenants sont tes deux seuls leviers.",
    unit: { one: 'heure', many: 'heures', verb: 'facturées', client: 'client' },
    vat: { sales: 0, exempt: true, label: 'Exonéré de TVA', note: "Les services à la personne rendus par un organisme déclaré sont exonérés de TVA. En contrepartie, la TVA sur les achats n'est pas récupérable : raisonne en montants TTC. La déclaration ouvre au client le crédit d'impôt de 50 %, qui divise son prix perçu par deux." },
    legal: { forms: ['EI', 'MICRO', 'EURL', 'SARL', 'SAS'], regime: 'TNS ou assimilé salarié', note: "La déclaration en préfecture ouvre le crédit d'impôt au client ; l'agrément, obligatoire pour la garde d'enfants de moins de trois ans et l'assistance aux personnes dépendantes, va plus loin et se renouvelle." },
    benchmarks: { grossMargin: [0.28, 0.45], payrollRatio: [0.55, 0.7], ticket: [25, 40] },
    metrics: ['revenue', 'payrollRatio', 'breakEven', 'cashLow'],
    traps: [
      { title: 'La masse salariale est presque tout', body: "Soixante à soixante-dix pour cent du chiffre part en salaires chargés. Deux euros d'écart sur le taux horaire facturé changent tout le résultat." },
      { title: 'Le temps de trajet', body: "Entre deux interventions, l'intervenant est payé mais rien n'est facturé. Un planning mal rempli détruit la marge sans qu'aucune ligne comptable ne le dise." },
      { title: 'Le crédit d’impôt', body: "Ton client paie 25 € de l'heure et en récupère la moitié. C'est ton argument commercial, pas ton revenu : toi, tu encaisses bien 25 €." },
    ],
    build(s) {
      s.activities = [newActivity({ name: 'Heures d’intervention', unitPrice: 28, unitCost: 0, paymentLag: 0, deposit: 1, vatRateSales: 0,
        volumes: { mode: 'growth', launchMonth: 0, startUnits: 220, monthlyGrowth: 0.06, growthDecay: 0.94, cap: 900, manual: [] } })]
      s.team = [
        newTeamMember({ role: 'Gérant', contractType: 'tns', monthlyGross: 1900 }),
        newTeamMember({ role: 'Intervenant', contractType: 'cdi', monthlyGross: 1870, count: 2, startMonth: 1 }),
      ]
      s.opex = opexSet([['Assurance responsabilité civile professionnelle', 90], ['Déplacements des intervenants', 340], ['Comptable', 190], ['Logiciel de planning', 120], ['Bureau', 400]])
      s.capex = [newCapex({ label: 'Matériel et petit équipement', amount: 6000, amortYears: 5 })]
      s.meta.vatExempt = true
      s.financing.equityFounders = [{ month: 0, amount: 12000 }]
    },
  },

  coach: {
    family: 'personal', label: 'Coach et salle de sport', glyph: '◎',
    tagline: "Vendre un abonnement est facile ; le faire renouveler l'est moins.",
    unit: { one: 'adhérent', many: 'adhérents', verb: 'inscrits', client: 'adhérent' },
    vat: { sales: 0.2, label: 'TVA 20 %', note: "Prestations sportives au taux normal. Une association sportive à gestion désintéressée peut en revanche être exonérée." },
    legal: { forms: ['EI', 'MICRO', 'EURL', 'SASU'], regime: 'TNS ou assimilé salarié', note: "La carte professionnelle d'éducateur sportif est obligatoire pour l'encadrement contre rémunération, et se déclare en préfecture." },
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
  batiment: {
    family: 'services', label: 'Artisan du bâtiment', glyph: '◧',
    tagline: "Ta marge se joue sur le devis, et ta trésorerie sur la date de paiement.",
    unit: { one: 'chantier', many: 'chantiers', verb: 'réalisés', client: 'client' },
    vat: { sales: 0.1, label: 'TVA 10 %', note: "Les travaux d'amélioration, de transformation et d'entretien d'un logement achevé depuis plus de deux ans relèvent du taux de 10 %, et de 5,5 % pour la rénovation énergétique. Le neuf et les locaux professionnels restent à 20 %. L'attestation du client conditionne le taux réduit." },
    legal: { forms: ['EI', 'MICRO', 'EURL', 'SARL', 'SAS'], regime: 'TNS ou assimilé salarié', note: "Qualification professionnelle exigée, inscription à la chambre de métiers, et surtout assurance décennale obligatoire avant le premier chantier : sans elle, la responsabilité est personnelle et illimitée." },
    benchmarks: { grossMargin: [0.35, 0.5], payrollRatio: [0.3, 0.42], dailyRate: [350, 550] },
    metrics: ['revenue', 'grossMargin', 'payrollCost', 'cashLow'],
    traps: [
      { title: "L'assurance décennale", body: "Deux à cinq mille euros par an dès la première année, due avant le premier chantier et quel que soit le chiffre d'affaires. C'est la charge que les prévisionnels d'artisan oublient le plus souvent." },
      { title: 'Le décalage de paiement', body: "Tu achètes les matériaux au début, tu encaisses le solde à la réception. Entre les deux, c'est ta trésorerie qui finance le chantier : exige un acompte." },
      { title: 'Les heures non facturées', body: "Devis, déplacements, approvisionnement, SAV : compte un quart du temps qui ne se facture à personne." },
    ],
    build(s) {
      s.activities = [newActivity({ name: 'Chantiers', unitPrice: 4200, unitCost: 1900, paymentLag: 1, deposit: 0.3, vatRateSales: 0.1, costPaymentLag: 0,
        volumes: { mode: 'growth', launchMonth: 0, startUnits: 3, monthlyGrowth: 0.05, growthDecay: 0.93, cap: 8, manual: [] } })]
      s.team = [
        newTeamMember({ role: 'Gérant artisan', contractType: 'tns', monthlyGross: 2400 }),
        newTeamMember({ role: 'Compagnon', contractType: 'cdi', monthlyGross: 2200, startMonth: 4 }),
      ]
      s.opex = opexSet([['Assurance décennale et RC pro', 320], ['Véhicule — carburant et entretien', 480], ['Comptable', 200], ['Outillage et consommables', 260], ['Téléphone et logiciel de devis', 110]])
      s.capex = [
        newCapex({ label: 'Véhicule utilitaire', amount: 24000, amortYears: 5 }),
        newCapex({ label: 'Outillage professionnel', amount: 12000, amortYears: 5 }),
      ]
      s.financing.equityFounders = [{ month: 0, amount: 15000 }]
      s.financing.loans = [{ id: uid('loan'), label: 'Prêt bancaire', amount: 30000, month: 0, rate: 0.043, months: 60, graceMonths: 0 }]
    },
  },

  formation: {
    family: 'impact', label: 'Organisme de formation', glyph: '◫',
    tagline: "Sans certification, tes clients ne peuvent pas te financer.",
    unit: { one: 'stagiaire-jour', many: 'stagiaires-jours', verb: 'formés', client: 'stagiaire' },
    vat: { sales: 0, exempt: true, label: 'Exonéré de TVA', note: "La formation professionnelle continue est exonérée de TVA pour les organismes titulaires de l'attestation délivrée par la préfecture. À défaut, le taux normal s'applique. L'exonération prive du droit à déduction sur les achats." },
    legal: { forms: ['SAS', 'SASU', 'SARL', 'Association'], regime: 'Assimilé salarié ou TNS', note: "Un numéro de déclaration d'activité est obligatoire dès la première convention. La certification Qualiopi conditionne l'accès aux financements publics et mutualisés : sans elle, la plupart des entreprises ne peuvent pas faire prendre en charge tes formations." },
    benchmarks: { grossMargin: [0.55, 0.75], payrollRatio: [0.35, 0.5], fillRate: [0.6, 0.8] },
    metrics: ['revenue', 'grossMargin', 'breakEven', 'runway'],
    traps: [
      { title: 'Le taux de remplissage', body: "Une session à huit places qui en vend quatre coûte le même formateur et la même salle. C'est le remplissage, pas le prix, qui fait la marge d'un organisme de formation." },
      { title: 'Les délais de paiement des financeurs', body: "Un opérateur de compétences règle après service fait et sur dossier complet : compte soixante à quatre-vingt-dix jours. Le formateur, lui, est payé à la fin du mois." },
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

/**
 * Le vocabulaire courant, avec repli générique.
 *
 * L'activité passe avant le modèle : une auto-école tourne sur le moteur d'un
 * organisme de formation, mais elle vend des heures de conduite, pas des
 * « sessions ». Le mot choisi est rangé dans le scénario, pas déduit à chaque
 * lecture — il survit ainsi à un export et à une reprise sur un autre appareil.
 */
export function vocabulary(scenario) {
  const sector = getSector(scenario?.meta?.sectorKey)
  return scenario?.meta?.unit || sector?.unit || { one: 'unité', many: 'unités', verb: 'vendues', client: 'client' }
}

/** Le nom du métier tel que le fondateur l'a dit, sinon celui du modèle. */
export function tradeName(scenario) {
  return scenario?.meta?.activityLabel || getSector(scenario?.meta?.sectorKey)?.label || ''
}

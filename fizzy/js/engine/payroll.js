/**
 * Moteur de paie : du brut mensuel saisi par l'utilisateur au coût réel
 * pour l'entreprise (« super brut ») et au net perçu par le salarié.
 *
 * L'utilisateur ne saisit qu'un brut mensuel et un type de contrat. Tout le
 * reste — cotisations patronales, réduction générale dégressive, exonération
 * JEI, régime des stagiaires et des alternants, cotisations TNS — est calculé
 * ici, avec le détail conservé pour pouvoir être expliqué dans l'interface.
 */

import { fiscalContext } from './fiscal-fr-2026.js'

export const CONTRACT_TYPES = {
  cdi: { label: 'CDI', help: "Contrat à durée indéterminée. Cotisations patronales de droit commun, réduction générale applicable sous 3 SMIC." },
  cdd: { label: 'CDD', help: "Contrat à durée déterminée. Même assiette qu'un CDI, majorée de la contribution CPF-CDD de 1 %." },
  alternance: { label: 'Alternance', help: "Apprentissage ou professionnalisation. Cotisations patronales fortement réduites et salarié exclu de l'effectif pour les seuils sociaux." },
  stage: { label: 'Stage', help: "Gratification obligatoire au-delà de deux mois. Exonérée de cotisations tant qu'elle n'excède pas le minimum légal." },
  tns: { label: 'Dirigeant TNS', help: "Gérant majoritaire de SARL ou EURL, entrepreneur individuel. Régime des indépendants : environ 45 % de cotisations sur la rémunération, sensiblement moins que le régime général — mais une protection plus légère et aucun droit au chômage." },
  dirigeant: { label: 'Dirigeant assimilé salarié', help: "Président de SAS ou SASU, gérant minoritaire ou égalitaire de SARL. Régime général, comme un cadre — donc une meilleure couverture, mais le coût employeur le plus élevé. L'assurance chômage n'est pas due : le dirigeant n'y a pas droit." },
  freelance: { label: 'Freelance / prestataire', help: "Facturation externe. Aucune cotisation sociale : le montant saisi est le coût complet, soumis à TVA." },
}

export const STATUSES = {
  cadre: { label: 'Cadre', help: "Prévoyance obligatoire (1,50 % sur la tranche A) et contribution APEC en supplément." },
  'non-cadre': { label: 'Non-cadre', help: 'Régime général sans prévoyance cadre obligatoire.' },
}

/**
 * Avantages accordés aux salariés.
 *
 * Deux d'entre eux sont des obligations : la complémentaire santé collective
 * et la prise en charge de l'abonnement de transport. Les autres sont des
 * leviers d'attractivité — ils coûtent moins cher qu'une augmentation de
 * salaire équivalente, puisqu'ils échappent aux cotisations.
 *
 * `amount` est toujours la dépense mensuelle de l'employeur par personne.
 */
export const BENEFITS = {
  mutuelle: {
    label: 'Mutuelle santé',
    legal: true,
    suggested: 45,
    short: 'Obligatoire',
    help: "Complémentaire santé collective, obligatoire depuis 2016 pour tout salarié en CDI ou CDD de plus de trois mois. L'employeur en finance au moins la moitié. Comptez 40 à 60 € par mois et par personne pour un contrat d'entrée de gamme.",
    forfaitSocial: true,
    contracts: ['cdi', 'cdd', 'dirigeant'],
  },
  transport: {
    label: 'Abonnement de transport',
    legal: true,
    suggested: 45,
    short: 'Obligatoire',
    help: "L'employeur rembourse au moins 50 % de l'abonnement aux transports publics. En Île-de-France, la moitié d'un pass mensuel représente environ 45 € ; en région, plutôt 20 à 30 €. Exonéré de cotisations et d'impôt.",
  },
  tickets: {
    label: 'Titres-restaurant',
    legal: false,
    suggested: 108,
    short: 'Facultatif',
    help: "Part patronale comprise entre 50 et 60 % de la valeur du titre. Pour 18 titres de 10 € pris en charge à 60 %, la dépense est de 108 € par mois — dont la totalité est exonérée tant que la part patronale reste sous le plafond par titre.",
  },
  mobilite: {
    label: 'Forfait mobilités durables',
    legal: false,
    suggested: 50,
    short: 'Facultatif',
    help: "Vélo, covoiturage, trottinette. Exonéré de cotisations et d'impôt dans la limite d'un plafond annuel par salarié. Souvent le premier avantage mis en place, parce qu'il coûte peu et se voit beaucoup.",
  },
  teletravail: {
    label: 'Indemnité de télétravail',
    legal: false,
    suggested: 30,
    short: 'Facultatif',
    help: "Allocation forfaitaire couvrant électricité, chauffage et connexion. Exonérée de cotisations dans la limite d'un barème URSSAF proportionnel au nombre de jours télétravaillés.",
  },
  formation: {
    label: 'Budget formation et matériel',
    legal: false,
    suggested: 80,
    short: 'Facultatif',
    help: "Enveloppe annuelle lissée sur douze mois : conférences, cours, licences, renouvellement du poste de travail. Charge d'exploitation ordinaire, pas un avantage en nature.",
  },
  autres: {
    label: 'Autres avantages',
    legal: false,
    suggested: 40,
    short: 'Facultatif',
    help: "Chèques-vacances, chèques cadeaux, garde d'enfants, salle de sport. À saisir en coût employeur mensuel par personne.",
  },
}

/** Les avantages ne concernent pas un prestataire externe ni un TNS. */
const SALARIED = ['cdi', 'cdd', 'dirigeant', 'alternance', 'stage']

/**
 * Dépense mensuelle d'avantages pour un poste, et forfait social éventuel.
 * @returns {{total:number,lines:Array,forfaitSocial:number}}
 */
export function benefitsCost(member, { headcount = 1, fiscal = {} } = {}) {
  const ctx = fiscal && fiscal.get ? fiscal : fiscalContext(fiscal)
  const lines = []
  let total = 0
  let forfaitSocial = 0
  if (!SALARIED.includes(member.contractType)) return { total: 0, lines, forfaitSocial: 0 }
  const chosen = member.benefits || {}
  for (const [key, def] of Object.entries(BENEFITS)) {
    const amount = Math.max(0, Number(chosen[key]) || 0)
    if (amount <= 0) continue
    if (def.contracts && !def.contracts.includes(member.contractType)) continue
    total += amount
    // Le forfait social frappe la contribution patronale de prévoyance et de
    // mutuelle, mais seulement à partir de onze salariés.
    const fs = def.forfaitSocial && headcount >= 11 ? amount * ctx.get('forfaitSocialRate') : 0
    forfaitSocial += fs
    lines.push({ key, label: def.label, amount, forfaitSocial: fs, legal: def.legal })
  }
  return { total: total + forfaitSocial, lines, forfaitSocial }
}

/**
 * Coefficient de la réduction générale de cotisations patronales.
 * Formule dégressive : maximale au SMIC, nulle au plafond (3 SMIC).
 */
export function reductionCoefficient(monthlyGross, headcount, ctx) {
  const { maxCoefUnder50, maxCoefFrom50, ceilingSmicMultiple: K } = ctx.get('reductionGenerale')
  const T = headcount >= 50 ? maxCoefFrom50 : maxCoefUnder50
  if (monthlyGross <= 0) return 0
  const ratio = ctx.smicMonthly / monthlyGross
  const coef = (T / (K - 1)) * (K * ratio - 1)
  return Math.min(Math.max(coef, 0), T)
}

/**
 * Coût complet d'un poste pour un mois donné.
 * @returns {{gross,employerBase,reduction,jeiExemption,employerCharges,superGross,employeeCharges,net,detail}}
 */
export function monthlyCost(member, { headcount = 1, jeiActive = false, fiscal = {} } = {}) {
  const ctx = fiscalContext(fiscal)
  const gross = Math.max(0, Number(member.monthlyGross) || 0)
  const detail = []

  // Mutuelle, transport, titres-restaurant : une dépense réelle, qui ne passe
  // ni par le brut ni par les cotisations. On la calcule une fois et on
  // l'ajoute au coût de chaque régime concerné.
  const ben = benefitsCost(member, { headcount, fiscal: ctx })
  const withBenefits = (res) => {
    if (ben.total <= 0) return { ...res, benefits: 0, benefitsLines: [] }
    const lines = ben.lines.map((line) => ({
      label: line.label,
      amount: line.amount,
      note: line.legal
        ? 'Obligation légale. Exonéré de cotisations sociales dans les limites prévues.'
        : 'Avantage facultatif, exonéré de cotisations dans les limites prévues : il coûte moins cher qu’une augmentation de salaire du même montant.',
    }))
    if (ben.forfaitSocial > 0) {
      lines.push({ label: `Forfait social (${pct(ctx.get('forfaitSocialRate'))})`, amount: ben.forfaitSocial, note: "Dû à partir de 11 salariés sur la part patronale de mutuelle et de prévoyance." })
    }
    // Les avantages se lisent juste avant le total : ils font partie du coût
    // du poste, pas d'une annexe.
    const at = res.detail.findIndex((d) => d.emphasis)
    if (at >= 0) {
      res.detail.splice(at, 0, ...lines)
      const totalLine = res.detail.find((d) => d.emphasis)
      totalLine.amount += ben.total
      totalLine.label = 'Coût complet du poste'
      totalLine.note = 'Salaire, cotisations et avantages compris.'
    } else {
      res.detail.push(...lines)
      res.detail.push({ label: 'Coût complet du poste', amount: res.cost + ben.total, emphasis: true, note: 'Salaire, cotisations et avantages compris.' })
    }
    return { ...res, cost: res.cost + ben.total, superGross: res.superGross + ben.total, benefits: ben.total, benefitsLines: ben.lines }
  }

  // Prestataire externe : pas de paie, le montant saisi est le coût final.
  if (member.contractType === 'freelance') {
    detail.push({ label: 'Prestation facturée', amount: gross, note: 'Aucune cotisation sociale ; TVA récupérable en sus.' })
    return { gross: 0, employerBase: 0, reduction: 0, jeiExemption: 0, employerCharges: 0, superGross: gross, employeeCharges: 0, net: 0, cost: gross, detail, benefits: 0, benefitsLines: [] }
  }

  // Dirigeant TNS : cotisations du régime des indépendants sur la rémunération.
  if (member.contractType === 'tns') {
    const rate = ctx.get('tnsRate')
    const charges = gross * rate
    detail.push({ label: 'Rémunération du dirigeant', amount: gross })
    detail.push({ label: `Cotisations TNS (${pct(rate)})`, amount: charges, note: 'Régime des travailleurs non salariés : assiette et taux distincts du régime général.' })
    return { gross, employerBase: charges, reduction: 0, jeiExemption: 0, employerCharges: charges, superGross: gross + charges, employeeCharges: 0, net: gross, cost: gross + charges, detail, benefits: 0, benefitsLines: [] }
  }

  // Stagiaire : gratification exonérée jusqu'au minimum légal.
  if (member.contractType === 'stage') {
    const legalMinimum = ctx.get('internGratification') * ctx.get('monthlyHours')
    const excess = Math.max(0, gross - legalMinimum)
    const rate = ctx.get('employerRateNonCadre')
    const charges = excess * rate
    detail.push({ label: 'Gratification', amount: gross })
    detail.push({ label: 'Minimum légal exonéré', amount: -Math.min(gross, legalMinimum), note: `${fmt(legalMinimum)} € par mois pour un temps plein. Aucune cotisation en dessous de ce seuil.` })
    if (charges > 0) detail.push({ label: `Cotisations sur la fraction excédentaire (${pct(rate)})`, amount: charges })
    return withBenefits({ gross, employerBase: charges, reduction: 0, jeiExemption: 0, employerCharges: charges, superGross: gross + charges, employeeCharges: 0, net: gross, cost: gross + charges, detail })
  }

  // Alternant : taux patronal réduit, pas de réduction générale supplémentaire.
  if (member.contractType === 'alternance') {
    const rate = ctx.get('apprenticeEmployerRate')
    const charges = gross * rate
    detail.push({ label: 'Salaire brut', amount: gross })
    detail.push({ label: `Cotisations patronales réduites (${pct(rate)})`, amount: charges, note: 'Exonérations propres aux contrats en alternance.' })
    return withBenefits({ gross, employerBase: charges, reduction: 0, jeiExemption: 0, employerCharges: charges, superGross: gross + charges, employeeCharges: 0, net: gross, cost: gross + charges, detail })
  }

  // CDI, CDD, dirigeant assimilé salarié : régime général.
  //
  // Le dirigeant assimilé salarié — président de SAS, gérant minoritaire de
  // SARL — relève du même régime qu'un cadre, à une exception près : il ne
  // cotise pas à l'assurance chômage, puisqu'il n'y a pas droit. C'est environ
  // quatre points de moins, et c'est une différence que beaucoup de
  // simulateurs oublient.
  const isExecutive = member.contractType === 'dirigeant'
  const baseRate0 = isExecutive || member.status === 'cadre'
    ? ctx.get('employerRateCadre')
    : ctx.get('employerRateNonCadre')
  const unemploymentRate = 0.0405
  const baseRate = isExecutive ? Math.max(0, baseRate0 - unemploymentRate) : baseRate0
  const employerBase = gross * baseRate
  detail.push({ label: 'Salaire brut', amount: gross })
  detail.push({
    label: `Cotisations patronales (${pct(baseRate)})`,
    amount: employerBase,
    note: isExecutive
      ? `Maladie, vieillesse, famille, AT/MP, retraite complémentaire. L'assurance chômage (${pct(unemploymentRate)}) n'est pas due : un dirigeant assimilé salarié n'y a pas droit.`
      : 'Maladie, vieillesse, famille, chômage, AT/MP, retraite complémentaire.',
  })

  // La réduction générale vise les salariés au sens strict : un mandataire
  // social n'y ouvre pas droit.
  const coef = isExecutive ? 0 : reductionCoefficient(gross, headcount, ctx)
  const generalRelief = gross * coef

  // L'exonération JEI ne porte que sur les cotisations d'assurances sociales et
  // d'allocations familiales — environ 28 points sur les 42 à 45 dus — et n'est
  // pas cumulable avec la réduction générale. On retient donc le dispositif le
  // plus favorable, jamais les deux.
  const jeiCfg = ctx.get('jei')
  const jeiCap = jeiCfg.employeeCapSmicMultiple * ctx.smicMonthly
  const jeiCandidate = jeiActive && (Number(member.rdShare) || 0) > 0
    ? Math.min(gross, jeiCap) * jeiCfg.exemptibleRate
    : 0

  const jeiWins = jeiCandidate > generalRelief
  const reduction = jeiWins ? 0 : generalRelief
  const jeiExemption = jeiWins ? jeiCandidate : 0

  if (reduction > 0) {
    detail.push({
      label: `Réduction générale (coefficient ${coef.toFixed(4)})`,
      amount: -reduction,
      note: `Dégressive entre 1 et 3 SMIC. Ce poste est rémunéré ${(gross / ctx.smicMonthly).toFixed(2)} SMIC.`,
    })
  }
  if (jeiExemption > 0) {
    detail.push({
      label: 'Exonération JEI',
      amount: -jeiExemption,
      note: `Assurances sociales et allocations familiales (${pct(jeiCfg.exemptibleRate)} du brut) sur la fraction inférieure à 4,5 SMIC, soit ${fmt(jeiCap)} €. Chômage, retraite complémentaire et accidents du travail restent dus. Non cumulable avec la réduction générale : Fizzy retient le dispositif le plus favorable.`,
    })
  }

  const cdSurcharge = member.contractType === 'cdd' ? gross * 0.01 : 0
  if (cdSurcharge > 0) detail.push({ label: 'Contribution CPF-CDD (1 %)', amount: cdSurcharge })

  const employerCharges = Math.max(0, employerBase - reduction - jeiExemption + cdSurcharge)
  const superGross = gross + employerCharges
  const employeeCharges = gross * ctx.get('employeeRate')
  const net = gross - employeeCharges

  detail.push({ label: 'Coût total employeur', amount: superGross, emphasis: true })
  detail.push({ label: 'Net avant impôt versé au salarié', amount: net, note: `Après ${pct(ctx.get('employeeRate'))} de cotisations salariales. Le prélèvement à la source s'applique ensuite sur ce net.` })

  return withBenefits({ gross, employerBase, reduction, jeiExemption, employerCharges, superGross, employeeCharges, net, cost: superGross, detail })
}

/** Le poste est-il actif au mois `m` (index 0-59) ? */
export function isActive(member, m) {
  // Un poste désactivé reste dans le scénario mais ne coûte rien : c'est ce qui
  // permet de répondre à « et si je n'embauchais pas ? » sans perdre la saisie.
  if (member.enabled === false) return false
  const start = Number(member.startMonth) || 0
  const end = member.endMonth === null || member.endMonth === undefined || member.endMonth === '' ? Infinity : Number(member.endMonth)
  return m >= start && m <= end
}

/**
 * Masse salariale mensuelle sur l'horizon complet.
 * @returns {{cost:number[],gross:number[],employerCharges:number[],benefits:number[],headcount:number[],fte:number[],jeiExemption:number[],byMember:Array}}
 */
export function payrollSeries(team, { months = 60, jeiByMonth = [], fiscal = {} } = {}) {
  const cost = new Array(months).fill(0)
  const gross = new Array(months).fill(0)
  const employerCharges = new Array(months).fill(0)
  const jeiExemption = new Array(months).fill(0)
  const benefits = new Array(months).fill(0)
  const headcount = new Array(months).fill(0)
  const fte = new Array(months).fill(0)
  const byMember = []

  // Effectif brut, nécessaire au seuil de 50 salariés de la réduction générale.
  for (let m = 0; m < months; m++) {
    for (const member of team) {
      if (!isActive(member, m)) continue
      const n = Number(member.count) || 1
      if (member.contractType !== 'freelance') headcount[m] += n
      if (!['alternance', 'stage', 'freelance'].includes(member.contractType)) fte[m] += n
    }
  }

  for (const member of team) {
    const series = new Array(months).fill(0)
    for (let m = 0; m < months; m++) {
      if (!isActive(member, m)) continue
      const n = Number(member.count) || 1
      const r = monthlyCost(member, { headcount: headcount[m], jeiActive: !!jeiByMonth[m], fiscal })
      series[m] = r.cost * n
      cost[m] += r.cost * n
      gross[m] += r.gross * n
      employerCharges[m] += r.employerCharges * n
      jeiExemption[m] += r.jeiExemption * n
      benefits[m] += (r.benefits || 0) * n
    }
    byMember.push({ id: member.id, role: member.role, series })
  }

  return { cost, gross, employerCharges, jeiExemption, benefits, headcount, fte, byMember }
}

const fmt = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)
const pct = (n) => `${(n * 100).toFixed(n * 100 % 1 === 0 ? 0 : 2).replace('.', ',')} %`

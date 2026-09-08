/**
 * Vues par métier.
 *
 * Chaque persona ne se contente pas de masquer des pages : il possède des
 * leviers — des champs réels du modèle qu'il peut bouger — et il lit l'effet de
 * ses décisions dans une monnaie commune, l'euro d'EBITDA. C'est ce qui fait la
 * différence entre être propriétaire d'un sujet et le regarder.
 *
 * Un levier décrit où écrire dans le scénario, dans quelles bornes, et comment
 * l'énoncer. Le moteur ne connaît pas les personas : il recalcule, point.
 */

import { euro, pct, num } from './dom.js'

/**
 * Montant de tuile : exact tant qu'il tient, abrégé au-delà. Une tuile doit se
 * lire d'un coup d'œil ; un nombre coupé sur deux lignes ne se lit pas.
 */
const money = (v) => (Number.isFinite(v) ? euro(v, { compact: Math.abs(v) >= 100000 }) : '—')

/** Résout un chemin de levier vers l'objet porteur et la clé à écrire. */
export function resolveLever(scenario, lever) {
  const target = lever.target(scenario)
  return target ? { object: target.object, key: target.key, current: target.object?.[target.key] } : null
}

// ─── Fabriques de cibles, pour éviter de répéter la même navigation ──────────
const firstActivity = (s) => s.activities?.[0]
const activityField = (key) => (s) => {
  const a = firstActivity(s)
  return a ? { object: a, key } : null
}
const volumeField = (key) => (s) => {
  const a = firstActivity(s)
  return a?.volumes ? { object: a.volumes, key } : null
}
const campaignField = (key) => (s) => {
  const c = s.marketing?.find((x) => x.enabled !== false) || s.marketing?.[0]
  return c ? { object: c, key } : null
}
const teamField = (key) => (s) => {
  const m = s.team?.[0]
  return m ? { object: m, key } : null
}
const opexTotalField = () => (s) => {
  const o = s.opex?.[0]
  return o ? { object: o, key: 'monthlyAmount' } : null
}

/**
 * Leviers disponibles. `scale` sert au curseur ; `format` à l'affichage.
 * `absent` explique pourquoi le levier ne s'applique pas au scénario courant.
 */
export const LEVERS = {
  price: {
    label: 'Prix de vente unitaire', unit: '€ HT', field: 'unitPrice',
    target: activityField('unitPrice'), min: 0, max: 5000, step: 1,
    format: (v) => euro(v),
    absent: "Cette offre se vend uniquement par abonnement.",
    applies: (s) => (Number(firstActivity(s)?.unitPrice) || 0) > 0,
    why: "Le levier le plus direct sur la marge : il n'augmente aucun coût.",
  },
  subscription: {
    label: 'Abonnement mensuel', unit: '€ HT/mois', field: 'recurringPrice',
    target: activityField('recurringPrice'), min: 0, max: 2000, step: 1,
    format: (v) => euro(v),
    absent: 'Cette offre ne comporte pas de revenu récurrent.',
    applies: (s) => (Number(firstActivity(s)?.recurringPrice) || 0) > 0,
    why: "Chaque euro d'abonnement se cumule sur toute la durée du contrat.",
  },
  unitCost: {
    label: 'Coût de revient unitaire', unit: '€ HT', field: 'unitPrice',
    target: activityField('unitCost'), min: 0, max: 5000, step: 1,
    format: (v) => euro(v),
    applies: (s) => (Number(firstActivity(s)?.unitPrice) || 0) > 0,
    why: 'Ce que la vente coûte avant toute charge fixe.',
  },
  churn: {
    label: 'Attrition mensuelle', unit: '%', field: 'churnMonthly',
    target: activityField('churnMonthly'), min: 0, max: 0.15, step: 0.001, percent: true,
    format: (v) => pct(v, 1),
    absent: 'Sans revenu récurrent, il n\'y a pas de base à retenir.',
    applies: (s) => (Number(firstActivity(s)?.recurringPrice) || 0) > 0,
    why: 'Ce que vous perdez chaque mois par le bas pendant que vous remplissez par le haut.',
  },
  growth: {
    label: 'Croissance mensuelle des ventes', unit: '%', field: 'monthlyGrowth',
    target: volumeField('monthlyGrowth'), min: -0.1, max: 0.4, step: 0.005, percent: true,
    format: (v) => pct(v, 1),
    applies: (s) => firstActivity(s)?.volumes?.mode !== 'manual',
    why: 'Le pari commercial. Un investisseur le challengera avant tous les autres.',
  },
  startUnits: {
    label: 'Ventes le premier mois', unit: 'unités', field: 'startUnits',
    target: volumeField('startUnits'), min: 0, max: 2000, step: 1,
    format: (v) => num(v),
    applies: (s) => firstActivity(s)?.volumes?.mode !== 'manual',
    why: 'Le point de départ de toute la trajectoire.',
  },
  paymentLag: {
    label: 'Délai de paiement client', unit: 'mois', field: 'paymentLag',
    target: activityField('paymentLag'), min: 0, max: 6, step: 1,
    format: (v) => `${num(v)} mois`,
    why: "Sans effet sur le résultat, décisif sur la trésorerie.",
  },
  deposit: {
    label: 'Acompte à la commande', unit: '%', field: 'deposit',
    target: activityField('deposit'), min: 0, max: 1, step: 0.05, percent: true,
    format: (v) => pct(v, 0),
    why: 'Le moyen le plus rapide de réduire le besoin de financement.',
  },
  budget: {
    label: 'Budget marketing mensuel', unit: '€ HT/mois', field: 'monthlyBudget',
    target: campaignField('monthlyBudget'), min: 0, max: 50000, step: 100,
    format: (v) => euro(v),
    absent: "Aucune campagne n'est définie.",
    applies: (s) => (s.marketing || []).length > 0,
    why: 'Convertit du cash en clients — au taux que vous avez saisi.',
  },
  conversion: {
    label: 'Taux de conversion en client', unit: '%', field: 'leadToClient',
    target: campaignField('leadToClient'), min: 0, max: 0.6, step: 0.005, percent: true,
    format: (v) => pct(v, 1),
    absent: "Aucune campagne n'est définie.",
    applies: (s) => (s.marketing || []).length > 0,
    why: "Améliorer la conversion coûte moins cher qu'augmenter le budget.",
  },
  salary: {
    label: 'Salaire brut du premier poste', unit: '€/mois', field: 'monthlyGross',
    target: teamField('monthlyGross'), min: 0, max: 15000, step: 50,
    format: (v) => euro(v),
    absent: "Aucun poste n'est défini.",
    applies: (s) => (s.team || []).length > 0,
    why: 'Rappel : le coût réel dépasse le brut de 20 à 45 %.',
  },
  headcount: {
    label: 'Effectif sur ce poste', unit: 'personnes', field: 'count',
    target: teamField('count'), min: 0, max: 50, step: 1,
    format: (v) => `${num(v)}`,
    absent: "Aucun poste n'est défini.",
    applies: (s) => (s.team || []).length > 0,
    why: 'Chaque recrutement décale le point mort.',
  },
  hireMonth: {
    label: 'Mois de la première embauche', unit: 'M', field: 'month',
    target: teamField('startMonth'), min: 0, max: 36, step: 1,
    format: (v) => `M${num(v) + 1}`,
    absent: "Aucun poste n'est défini.",
    applies: (s) => (s.team || []).length > 0,
    why: 'Décaler une embauche de trois mois libère souvent tout le besoin de financement.',
  },
  fixedCost: {
    label: 'Première charge fixe mensuelle', unit: '€/mois', field: 'monthlyAmount',
    target: opexTotalField(), min: 0, max: 20000, step: 50,
    format: (v) => euro(v),
    absent: "Aucune charge fixe n'est définie.",
    applies: (s) => (s.opex || []).length > 0,
    why: 'Les charges fixes se paient que vous vendiez ou non.',
  },
  openingCash: {
    label: 'Trésorerie de départ', unit: '€', field: 'amount',
    target: (s) => ({ object: s.financing, key: 'openingCash' }), min: 0, max: 500000, step: 1000,
    format: (v) => euro(v),
    why: "Ce que vous mettez sur la table avant le premier euro encaissé.",
  },
}

/**
 * Indicateurs proposés aux personas. `read` extrait la valeur du résultat,
 * `tone` dit dans quel sens va le bien.
 */
export const METRICS = {
  revenue: { label: "Chiffre d'affaires", read: (r, y) => r.pnl.revenue[y], format: money, glossary: null, higher: true },
  ebitda: { label: 'EBITDA', read: (r, y) => r.pnl.ebitda[y], format: money, glossary: 'ebitda', higher: true },
  netResult: { label: 'Résultat net', read: (r, y) => r.pnl.netResult[y], format: money, higher: true },
  breakEven: { label: 'Point mort', read: (r, y) => r.kpis.breakEven[y], format: money, glossary: 'pointMort', higher: false },
  grossMargin: { label: 'Marge brute', read: (r, y) => r.pnl.grossMargin[y], format: money, glossary: 'margeBrute', higher: true },
  marginRate: { label: 'Taux de marge', read: (r, y) => r.kpis.marginRate[y], format: (v) => pct(v), glossary: 'marginRate', higher: true },
  ebitdaMargin: { label: "Marge d'EBITDA", read: (r, y) => r.kpis.ebitdaMargin[y], format: (v) => pct(v), higher: true },
  fundingNeed: { label: 'Besoin de financement', read: (r) => r.kpis.fundingNeed, format: money, glossary: 'tresorerie', higher: false },
  runway: { label: 'Autonomie', read: (r) => r.kpis.runwayMonths, format: (v) => (v === null ? '—' : `${num(v, 0)} mois`), glossary: 'runway', higher: true },
  cashLow: { label: 'Point bas de trésorerie', read: (r) => r.kpis.cashLow.value, format: money, higher: true },
  peakBfr: { label: 'BFR maximum', read: (r) => r.kpis.peakBfr, format: money, glossary: 'bfr', higher: false },
  cac: { label: "Coût d'acquisition", read: (r) => r.kpis.cac, format: (v) => (v === null ? '—' : money(v)), glossary: 'cac', higher: false },
  ltv: { label: 'Valeur client', read: (r) => r.kpis.ltv, format: (v) => (v === null ? '—' : money(v)), glossary: 'ltv', higher: true },
  ltvCac: { label: 'LTV / CAC', read: (r) => r.kpis.ltvCacRatio, format: (v) => (v === null ? '—' : `${num(v, 1)}×`), glossary: 'ltv', higher: true },
  payrollCost: { label: 'Coût employeur', read: (r, y) => r.pnl.payroll[y], format: euro, glossary: 'superBrut', higher: false },
  payrollRatio: { label: 'Masse salariale / CA', read: (r, y) => r.kpis.payrollRatio[y], format: (v) => pct(v, 0), higher: false },
  headcount: { label: 'Effectif', read: (r, y) => r.payroll.headcount[Math.min(59, y * 12 + 11)], format: (v) => num(v), higher: true },
  jeiSaving: { label: 'Économie JEI', read: (r, y) => r.pnl.jeiSaving[y], format: money, higher: true },
  credits: { label: "Crédits d'impôt", read: (r, y) => r.pnl.credits[y], format: money, glossary: 'cir', higher: true },
  corporateTax: { label: 'Impôt sur les sociétés', read: (r, y) => r.pnl.corporateTax[y], format: money, glossary: 'is', higher: false },
  recurringShare: {
    label: 'Part du récurrent',
    read: (r, y) => {
      const rec = r.revenue.perActivity.reduce((a, x) => a + sumYear(x.recurring, y), 0)
      const tot = r.pnl.revenue[y]
      return tot > 0 ? rec / tot : 0
    },
    format: (v) => pct(v, 0), higher: true,
  },
  arpu: { label: 'Revenu moyen par client', read: (r) => r.kpis.arpu, format: (v) => (v === null ? '—' : money(v)), higher: true },
}

const sumYear = (arr, y) => arr.slice(y * 12, y * 12 + 12).reduce((a, b) => a + b, 0)

/**
 * Les personas. `depth` module la quantité de détail pour le fondateur, qui
 * regarde tout ; les autres ont un périmètre par nature.
 */
export const PERSONAS = {
  founder: {
    label: 'Fondateur', short: 'Fondateur', code: 'FDR',
    tagline: "Vous décidez de tout, donc vous répondez de tout.",
    brief: "La vue d'ensemble : ce que vous vendez, ce que ça coûte, ce qu'il reste, et combien de temps vous tenez.",
    hasDepth: true,
    metrics: ['revenue', 'ebitda', 'breakEven', 'netResult', 'fundingNeed', 'runway'],
    levers: ['price', 'subscription', 'growth', 'budget', 'salary', 'hireMonth'],
    pages: ['tableau-de-bord', 'offre', 'marketing', 'equipe', 'charges', 'financement', 'resultats', 'mon-revenu', 'business-case', 'reglages'],
    question: "Ce modèle tient-il debout ?",
  },
  cfo: {
    label: 'Direction financière', short: 'DAF', code: 'CFO',
    tagline: "Le résultat est une opinion, la trésorerie est un fait.",
    brief: "Trésorerie, besoin en fonds de roulement, point mort et fiscalité. Ce qui décide si l'entreprise passe l'année.",
    metrics: ['fundingNeed', 'cashLow', 'peakBfr', 'breakEven', 'runway', 'corporateTax'],
    levers: ['paymentLag', 'deposit', 'openingCash', 'fixedCost', 'hireMonth'],
    pages: ['tableau-de-bord', 'financement', 'resultats', 'charges', 'offre', 'mon-revenu', 'business-case', 'reglages'],
    question: "À quel moment manque-t-il de l'argent, et combien ?",
  },
  cmo: {
    label: 'Direction marketing', short: 'CMO', code: 'CMO',
    tagline: "Un client qui coûte plus qu'il ne rapporte n'est pas une croissance.",
    brief: "Budgets, canaux, coût d'acquisition et valeur client. Combien coûte un euro de chiffre d'affaires.",
    metrics: ['cac', 'ltv', 'ltvCac', 'revenue', 'ebitda', 'arpu'],
    levers: ['budget', 'conversion', 'growth', 'price'],
    pages: ['tableau-de-bord', 'marketing', 'offre', 'resultats', 'mon-revenu', 'business-case', 'reglages'],
    question: "Chaque euro investi en acquisition en rapporte-t-il plus d'un ?",
  },
  chro: {
    label: 'Ressources humaines', short: 'RH', code: 'CHRO',
    tagline: "Un salaire brut n'est jamais le coût d'un salarié.",
    brief: "Masse salariale chargée, calendrier des recrutements, seuils d'effectif et dispositifs d'exonération.",
    metrics: ['payrollCost', 'payrollRatio', 'headcount', 'breakEven', 'jeiSaving', 'runway'],
    levers: ['salary', 'headcount', 'hireMonth'],
    pages: ['tableau-de-bord', 'equipe', 'charges', 'resultats', 'mon-revenu', 'business-case', 'reglages'],
    question: "Cette équipe est-elle finançable au rythme prévu ?",
  },
  cpo: {
    label: 'Produit', short: 'Produit', code: 'CPO',
    tagline: "Le prix est une décision produit, pas une décision commerciale.",
    brief: "Prix, coût de revient, récurrence et rétention. Ce que chaque unité vendue laisse dans la caisse.",
    metrics: ['grossMargin', 'marginRate', 'arpu', 'recurringShare', 'revenue', 'ebitda'],
    levers: ['price', 'subscription', 'unitCost', 'churn', 'startUnits'],
    pages: ['tableau-de-bord', 'offre', 'marketing', 'resultats', 'mon-revenu', 'business-case', 'reglages'],
    question: "Chaque vente laisse-t-elle assez pour payer la structure ?",
  },
  consultant: {
    label: 'Conseil', short: 'Conseil', code: 'CNS',
    tagline: "Un chiffre sans hypothèse derrière ne vaut rien.",
    brief: "Le modèle complet, sans filtre : bilan, BFR, crédits d'impôt, sensibilité et exports.",
    metrics: ['revenue', 'ebitda', 'breakEven', 'peakBfr', 'fundingNeed', 'netResult'],
    levers: ['price', 'growth', 'unitCost', 'salary', 'paymentLag', 'fixedCost'],
    pages: ['tableau-de-bord', 'offre', 'marketing', 'equipe', 'charges', 'financement', 'resultats', 'mon-revenu', 'business-case', 'reglages'],
    forceLevel: 'advanced',
    question: "Où se cassent les hypothèses ?",
  },
}

export const PERSONA_KEYS = Object.keys(PERSONAS)
export const getPersona = (key) => PERSONAS[key] || PERSONAS.founder

/** Leviers applicables au scénario courant, dans l'ordre du persona. */
export function activeLevers(persona, scenario) {
  return (persona.levers || [])
    .map((key) => ({ key, ...LEVERS[key] }))
    .filter((l) => l.target && (!l.applies || l.applies(scenario)))
    .filter((l) => resolveLever(scenario, l))
}

/**
 * Vues par métier.
 *
 * Chaque persona a son périmètre et ses indicateurs : ceux qu'il lit en
 * premier, dans une monnaie commune, l'euro d'EBE. Le moteur ne connaît pas
 * les personas : il recalcule, point.
 */

import { euro, pct, num } from './dom.js'

/**
 * Montant de tuile : exact tant qu'il tient, abrégé au-delà. Une tuile doit se
 * lire d'un coup d'œil ; un nombre coupé sur deux lignes ne se lit pas.
 */
const money = (v) => (Number.isFinite(v) ? euro(v, { compact: Math.abs(v) >= 100000 }) : '—')

/**
 * Indicateurs proposés aux personas. `read` extrait la valeur du résultat,
 * `tone` dit dans quel sens va le bien.
 */
export const METRICS = {
  revenue: { label: "Chiffre d'affaires", read: (r, y) => r.pnl.revenue[y], format: money, glossary: null, higher: true },
  ebe: { label: 'EBE', read: (r, y) => r.pnl.ebe[y], format: money, glossary: 'ebe', higher: true },
  netResult: { label: 'Résultat net', read: (r, y) => r.pnl.netResult[y], format: money, higher: true },
  breakEven: { label: 'Point mort', read: (r, y) => r.kpis.breakEven[y], format: money, glossary: 'pointMort', higher: false },
  grossMargin: { label: 'Marge brute', read: (r, y) => r.pnl.grossMargin[y], format: money, glossary: 'margeBrute', higher: true },
  marginRate: { label: 'Taux de marge', read: (r, y) => r.kpis.marginRate[y], format: (v) => pct(v), glossary: 'marginRate', higher: true },
  ebeMargin: { label: "Marge d'EBE", read: (r, y) => r.kpis.ebeMargin[y], format: (v) => pct(v), higher: true },
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
 * La vue du fondateur, la seule. Les vues direction financière, marketing,
 * RH, produit et conseil ont été retirées : Fynomia se lit en fondateur.
 */
export const PERSONAS = {
  founder: {
    label: 'Fondateur',
    metrics: ['revenue', 'ebe', 'breakEven', 'netResult', 'fundingNeed', 'runway'],
    pages: ['tableau-de-bord', 'modele', 'offre', 'marketing', 'equipe', 'charges', 'financement', 'resultats', 'mon-revenu', 'business-case', 'compte', 'reglages'],
  },
}

export const getPersona = (key) => PERSONAS[key] || PERSONAS.founder

/** Leviers applicables au scénario courant, dans l'ordre du persona. */


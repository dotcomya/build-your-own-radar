/**
 * Business case : la lecture narrative du modèle, et les exports.
 * C'est la page qu'on montre à un banquier ou à un jury.
 */

import { h, euro, pct, num, helpButton, monthLabel, yearLabel, toast, textField } from '../dom.js'
import { barChart, areaChart, PALETTE, YEAR_CATEGORIES } from '../charts.js'
import { exportPptx } from '../../export/pptx.js'
import { download } from '../../export/zip.js'
import store from '../../state/store.js'
import { pickYear } from './dashboard.js'

export function renderBusinessCase(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  if (!r) return h('div', { class: 'content' }, h('p', {}, 'Aucun résultat.'))
  const y = pickYear(r.pnl)
  const k = r.kpis

  const doPptx = () => {
    try {
      const n = exportPptx(s, r, store.profile)
      toast(`Présentation de ${n} diapositives téléchargée.`, 'ok')
    } catch (e) {
      toast(`Export impossible : ${e.message}`, 'err')
    }
  }
  const doJson = () => {
    download(new Blob([store.exportJSON()], { type: 'application/json' }), `${slug(s.meta.name)}-fizzy.json`)
    toast('Scénario exporté.', 'ok')
  }
  const doCsv = () => {
    download(new Blob(['﻿' + buildCsv(r)], { type: 'text/csv;charset=utf-8' }), `${slug(s.meta.name)}-previsionnel.csv`)
    toast('Tableau exporté.', 'ok')
  }

  return h('div', { class: 'content' },
    h('div', { class: 'page-head' },
      h('h1', {}, 'Business case'),
      h('p', {}, "La synthèse de votre projet, rédigée à partir de vos chiffres. Exportable en PowerPoint pour être présentée telle quelle."),
    ),

    h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Exporter'), h('span', { class: 'spacer' })),
      h('div', { class: 'card-body' },
        h('div', { class: 'grid grid-3' },
          exportTile('Présentation PowerPoint', 'Dix diapositives prêtes à présenter : chiffres clés, trajectoire, compte de résultat, trésorerie, point mort, équipe, financement, hypothèses.', 'Télécharger le .pptx', doPptx, true),
          exportTile('Tableau de chiffres', "Le prévisionnel complet au format CSV, ouvrable dans Excel, Numbers ou Google Sheets.", 'Télécharger le .csv', doCsv),
          exportTile('Sauvegarde du scénario', "Toutes vos données dans un fichier, pour les archiver ou les transférer sur un autre appareil.", 'Télécharger le .json', doJson),
        ),
      ),
    ),

    h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Le projet en une page')),
      h('div', { class: 'card-body' },
        h('div', { class: 'grid grid-4 kpis mb' },
          stat("Chiffre d'affaires", euro(r.pnl.revenue[y], { compact: true }), yearLabel(y)),
          stat('EBITDA', euro(r.pnl.ebitda[y], { compact: true }), pct(k.ebitdaMargin[y]) + ' du CA'),
          stat('Point mort', k.breakEven[y] ? euro(k.breakEven[y], { compact: true }) : '—', 'Seuil de rentabilité'),
          stat('Financement', k.fundingNeed > 0 ? euro(k.fundingNeed, { compact: true }) : 'Couvert', 'Besoin identifié'),
        ),
        ...narrative(s, r, y).map((para) => h('p', { style: { lineHeight: '1.65', maxWidth: '78ch' } }, ...para)),
      ),
    ),

    h('div', { class: 'grid grid-2 mb' },
      h('div', { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', {}, 'Trajectoire')),
        h('div', { class: 'card-body' },
          barChart({
            categories: YEAR_CATEGORIES,
            series: [
              { label: "Chiffre d'affaires", values: r.pnl.revenue, color: PALETTE[0] },
              { label: 'EBITDA', values: r.pnl.ebitda, color: PALETTE[1] },
              { label: 'Résultat net', values: r.pnl.netResult, color: PALETTE[2] },
            ],
          })),
      ),
      h('div', { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', {}, 'Trésorerie')),
        h('div', { class: 'card-body' }, areaChart({ values: r.cash.balance, startDate: r.startDate, color: k.fundingNeed > 0 ? '#d97a06' : '#05a578' })),
      ),
    ),

    h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Ce qu\'un financeur regardera'), h('span', { class: 'spacer' })),
      h('div', { class: 'card-body stack' }, ...checklist(s, r, y)),
    ),

    h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Hypothèses retenues')),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'data' },
          h('tbody', {},
            ...s.activities.map((a) => h('tr', {},
              h('td', {}, a.name),
              h('td', { style: { textAlign: 'left', whiteSpace: 'normal' } }, describeActivity(a)),
            )),
            h('tr', {}, h('td', {}, 'Fiscalité'), h('td', { style: { textAlign: 'left', whiteSpace: 'normal' } },
              `France ${new Date(s.meta.startDate).getFullYear()} — impôt sur les sociétés à 15 % jusqu'à 42 500 € de bénéfice puis 25 %, TVA au taux normal de 20 %.`)),
            h('tr', {}, h('td', {}, 'Cotisations sociales'), h('td', { style: { textAlign: 'left', whiteSpace: 'normal' } },
              `Taux moyens de marché avec application de la réduction générale dégressive jusqu'à 3 SMIC. Taux effectif constaté : ${pct(r.payroll.gross[11] > 0 ? r.payroll.employerCharges[11] / r.payroll.gross[11] : 0, 0)} en fin d'année 1.`)),
            s.meta.jeiClaimed && h('tr', {}, h('td', {}, 'Statut JEI'), h('td', { style: { textAlign: 'left', whiteSpace: 'normal' } },
              r.jei.some((j) => j.eligible)
                ? `Éligible sur ${r.jei.filter((j) => j.eligible).length} exercice(s), soit ${euro(r.payroll.jeiExemption.reduce((a, b) => a + b, 0))} d'exonération de cotisations patronales.`
                : "Revendiqué, mais le seuil de 15 % de dépenses de recherche n'est pas atteint sur l'horizon modélisé.")),
          ),
        ),
      ),
      h('div', { class: 'card-body' },
        h('div', { class: 'note plain' },
          "Ce prévisionnel est un outil d'aide à la décision. Les paramètres fiscaux et sociaux sont des valeurs de référence : faites-les valider par un expert-comptable avant tout dépôt de dossier bancaire ou toute levée de fonds.")),
    ),
  )
}

function narrative(s, r, y) {
  const k = r.kpis, p = r.pnl
  const paras = []
  const activityNames = s.activities.map((a) => a.name)
  const mainActivity = r.revenue.perActivity.reduce((best, a) =>
    a.total.reduce((x, z) => x + z, 0) > (best ? best.total.reduce((x, z) => x + z, 0) : -1) ? a : best, null)

  paras.push([
    `${s.meta.company || s.meta.name} `,
    `commercialise ${activityNames.length === 1 ? `une offre, ${activityNames[0]}` : `${activityNames.length} offres : ${activityNames.slice(0, -1).join(', ')} et ${activityNames.slice(-1)}`}. `,
    `Le prévisionnel porte sur cinq exercices à compter de ${monthLabel(0, r.startDate)}. `,
    `Le chiffre d'affaires atteint `, b(euro(p.revenue[0])), ` la première année et `, b(euro(p.revenue[4])), ` la cinquième, `,
    p.revenue[0] > 0 ? `soit une croissance annuelle moyenne de ${pct(Math.pow(p.revenue[4] / p.revenue[0], 0.25) - 1, 0)}.` : `le démarrage commercial intervenant en cours de première année.`,
  ])

  paras.push([
    `Le taux de marge sur coûts variables s'établit à `, b(pct(k.marginRate[y])), `, `,
    `pour des charges fixes de ${euro(k.fixedCosts[y])} en ${yearLabel(y).toLowerCase()}. `,
    k.breakEven[y]
      ? [`Le point mort se situe donc à `, b(euro(k.breakEven[y])), `, `,
         p.revenue[y] >= k.breakEven[y]
           ? `franchi dès ${theYear(y)} avec ${pct(p.revenue[y] / k.breakEven[y], 0)} de couverture.`
           : `soit ${pct(p.revenue[y] / k.breakEven[y], 0)} de l'objectif atteint : l'équilibre n'est pas encore acquis.`]
      : `La marge brute étant nulle ou négative, aucun point mort ne peut être établi.`,
  ].flat())

  paras.push([
    k.firstEbitdaPositiveYear !== null
      ? `L'exploitation dégage un EBITDA positif dès ${theYear(k.firstEbitdaPositiveYear)} (${euro(p.ebitda[k.firstEbitdaPositiveYear])}). `
      : `L'EBITDA reste négatif sur l'ensemble de l'horizon modélisé. `,
    k.firstProfitableYear !== null
      ? `Le résultat net devient positif en ${yearLabel(k.firstProfitableYear).toLowerCase()}, à ${euro(p.netResult[k.firstProfitableYear])}, `
      : `Le résultat net demeure négatif sur les cinq exercices, `,
    `et l'entreprise emploie ${Math.round(r.payroll.headcount[59])} personne${r.payroll.headcount[59] > 1 ? 's' : ''} en fin de période, `,
    `pour une masse salariale chargée de ${euro(p.payroll[4])} représentant ${pct(k.payrollRatio[4], 0)} du chiffre d'affaires.`,
  ])

  paras.push([
    k.fundingNeed > 0
      ? [`La trésorerie atteint son point bas en ${monthLabel(k.cashLow.month, r.startDate)} à ${euro(k.cashLow.value)}. `,
         `Un financement complémentaire de `, b(euro(k.fundingNeed)), ` est donc nécessaire avant cette échéance. `]
      : [`La trésorerie reste positive sur toute la période, au plus bas à ${euro(k.cashLow.value)} en ${monthLabel(k.cashLow.month, r.startDate)}. `],
    r.kpis.peakBfr > 0 ? `Le besoin en fonds de roulement culmine à ${euro(r.kpis.peakBfr)} et doit être financé de façon durable. ` : '',
    r.pnl.credits.some((c) => c > 0) ? `Les crédits d'impôt recherche et innovation apportent ${euro(r.pnl.credits.reduce((a, b2) => a + b2, 0))} sur la période.` : '',
  ].flat())

  return paras
}

function checklist(s, r, y) {
  const k = r.kpis
  const items = [
    {
      ok: k.breakEven[y] && r.pnl.revenue[y] >= k.breakEven[y],
      label: 'Le point mort est atteint',
      detail: k.breakEven[y]
        ? (r.pnl.revenue[y] >= k.breakEven[y]
            ? `Le chiffre d'affaires de ${theYear(y)} couvre les charges avec ${pct(r.pnl.revenue[y] / k.breakEven[y] - 1, 0)} de marge de sécurité.`
            : `Il manque ${euro(k.breakEven[y] - r.pnl.revenue[y])} de chiffre d'affaires pour atteindre l'équilibre en ${yearLabel(y).toLowerCase()}.`)
        : "Impossible à évaluer sans marge brute positive.",
    },
    {
      ok: k.fundingNeed === 0,
      label: 'Le financement couvre le besoin',
      detail: k.fundingNeed === 0 ? "La trésorerie ne passe jamais sous zéro." : `Il manque ${euro(k.fundingNeed)} au point bas de ${monthLabel(k.cashLow.month, r.startDate)}.`,
    },
    {
      ok: k.firstProfitableYear !== null && k.firstProfitableYear <= 2,
      label: 'La rentabilité arrive dans les trois ans',
      detail: k.firstProfitableYear !== null
        ? `Premier exercice bénéficiaire : ${yearLabel(k.firstProfitableYear).toLowerCase()}.`
        : "Aucun exercice bénéficiaire sur l'horizon modélisé.",
    },
    {
      ok: k.marginRate[y] >= 0.3,
      label: 'La marge brute est solide',
      detail: `${pct(k.marginRate[y])} de marge sur coûts variables. ${k.marginRate[y] >= 0.5 ? "Confortable : chaque vente contribue fortement aux frais fixes." : k.marginRate[y] >= 0.3 ? "Correcte pour une activité de production ou de négoce." : "Faible : le modèle exige un volume important."}`,
    },
    {
      ok: k.payrollRatio[y] > 0 && k.payrollRatio[y] < 0.6,
      label: 'La masse salariale est soutenable',
      detail: k.payrollRatio[y] > 0
        ? `Elle représente ${pct(k.payrollRatio[y], 0)} du chiffre d'affaires en ${yearLabel(y).toLowerCase()}. Au-delà de 60 %, la structure devient difficile à financer.`
        : "Aucun salarié rémunéré n'est modélisé — vérifiez que c'est volontaire.",
    },
    {
      ok: !r.balance.some((b2) => b2.equity < 0),
      label: 'Les capitaux propres restent positifs',
      detail: r.balance.some((b2) => b2.equity < 0)
        ? "Les pertes cumulées dépassent les apports sur au moins un exercice : renforcez le capital."
        : `Ils atteignent ${euro(r.balance[4].equity)} en fin de période.`,
    },
  ]
  if (k.ltvCacRatio) {
    items.push({
      ok: k.ltvCacRatio >= 3,
      label: "L'acquisition client est rentable",
      detail: `Un client coûte ${euro(k.cac)} et rapporte ${euro(k.ltv)} de marge, soit un rapport de ${num(k.ltvCacRatio, 1)}. Le seuil communément retenu est de 3.`,
    })
  }
  return items.map((i) => h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '10px' } },
    h('span', { class: `chip ${i.ok ? 'chip-pos' : 'chip-warn'}`, style: { flex: 'none', marginTop: '1px' } }, i.ok ? '✓' : '!'),
    h('div', {},
      h('div', { style: { fontWeight: '600' } }, i.label),
      h('div', { class: 'small muted' }, i.detail),
    ),
  ))
}

function exportTile(title, description, action, onClick, primary) {
  return h('div', { class: 'card', style: { background: primary ? 'var(--brand-50)' : 'var(--ink-50)', borderColor: primary ? 'var(--brand-100)' : 'var(--ink-200)' } },
    h('div', { class: 'card-body' },
      h('h3', {}, title),
      h('p', { class: 'small muted', style: { minHeight: '58px', marginTop: '6px' } }, description),
      h('button', { class: `btn ${primary ? 'btn-primary' : ''} btn-block`, onClick }, action),
    ),
  )
}

function stat(label, value, sub) {
  return h('div', { class: 'kpi' },
    h('span', { class: 'kpi-accent' }),
    h('div', { class: 'kpi-label' }, label),
    h('div', { class: 'kpi-value' }, value),
    h('div', { class: 'kpi-sub' }, sub),
  )
}

function describeActivity(a) {
  const bits = []
  if (Number(a.unitPrice) > 0) bits.push(`${euro(a.unitPrice)} l'unité, coût de revient ${euro(a.unitCost)}`)
  if (Number(a.recurringPrice) > 0) bits.push(`abonnement de ${euro(a.recurringPrice)} par mois sur ${a.contractMonths} mois`)
  if (Number(a.churnMonthly) > 0) bits.push(`attrition mensuelle de ${pct(a.churnMonthly, 1)}`)
  if (Number(a.paymentLag) > 0) bits.push(`paiement à ${Number(a.paymentLag) * 30} jours`)
  if (Number(a.deposit) > 0) bits.push(`acompte de ${pct(a.deposit, 0)}`)
  bits.push(`TVA ${pct(a.vatRateSales, 1)}`)
  return bits.join(' · ')
}

function buildCsv(r) {
  const rows = []
  const push = (label, values) => rows.push([label, ...values.map((v) => (Number.isFinite(v) ? Math.round(v) : ''))].join(';'))
  rows.push(['Poste', ...YEAR_CATEGORIES.map((c, i) => `Année ${i + 1}`)].join(';'))
  const p = r.pnl
  push("Chiffre d'affaires", p.revenue)
  push('Achats et charges variables', p.variableCost)
  push('Marge brute', p.grossMargin)
  push('Charges externes', p.external)
  push('Valeur ajoutée', p.valueAdded)
  push('Impôts et taxes', p.duties)
  push('Subventions', p.grants)
  push('Charges de personnel', p.payroll)
  push('EBITDA', p.ebitda)
  push('Amortissements', p.amortisation)
  push("Résultat d'exploitation", p.ebit)
  push('Charges financières', p.interest)
  push("Crédits d'impôt", p.credits)
  push('Impôt sur les sociétés', p.corporateTax)
  push('Résultat net', p.netResult)
  rows.push('')
  push('Point mort', r.kpis.breakEven.map((v) => v || 0))
  push('Trésorerie fin de période', r.cash.yearEnd)
  push('BFR fin de période', Array.from({ length: 5 }, (_, y) => r.bfr.total[y * 12 + 11]))
  rows.push('')
  rows.push(['Trésorerie mensuelle', ...Array.from({ length: 60 }, (_, m) => monthLabel(m, r.startDate))].join(';'))
  rows.push(['Solde', ...r.cash.balance.map((v) => Math.round(v))].join(';'))
  return rows.join('\n')
}

const b = (t) => h('strong', {}, t)
/** « l'année 3 » : forme élidée, à employer après « dès », « de », « à ». */
const theYear = (y) => `l'année ${y + 1}`
const slug = (s) => String(s || 'business-plan').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()

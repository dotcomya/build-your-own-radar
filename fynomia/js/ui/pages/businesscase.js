/**
 * Business case : la lecture narrative du modèle, et les exports.
 * C'est la page qu'on montre à un banquier ou à un jury.
 */

import { h, euro, pct, num, monthLabel, yearLabel, toast, moduleShell } from '../dom.js'
import { resetDeck } from './deck.js'
import { barChart, areaChart, PALETTE, YEAR_CATEGORIES, STATUS } from '../charts.js'
import { exportPptx } from '../../export/pptx.js'
import { download } from '../../export/zip.js'
import store from '../../state/store.js'
import { pickYear } from './dashboard.js'
import { lignesBanquier, banquierVerifie, tableauBanquier } from '../banquier.js'

export function renderBusinessCase(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  if (!r) return h('div', { class: 'content' }, h('p', {}, 'Aucun résultat.'))
  const y = pickYear(r.pnl)
  const k = r.kpis

  // Selon le contexte, le fichier est remis par l'hôte (qui demande
  // confirmation au visiteur) ou téléchargé directement par le navigateur :
  // download() choisit, et renvoie ce qui s'est réellement passé.
  const announce = (outcome, done) => {
    if (outcome === 'declined') toast('Téléchargement annulé.')
    else toast(done, 'ok')
  }
  const fail = (e) => toast(`Export impossible : ${(e && (e.message || e.code)) || e}`, 'err')

  const doPptx = async () => {
    try {
      const { slides, outcome } = await exportPptx(s, r, store.profile)
      announce(outcome, `Présentation de ${slides} diapositives prête.`)
    } catch (e) { fail(e) }
  }
  const doJson = async () => {
    try {
      const outcome = await download(new Blob([store.exportJSON()], { type: 'application/json' }), `${slug(s.meta.name)}-fynomia.json`)
      announce(outcome, 'Scénario exporté.')
    } catch (e) { fail(e) }
  }
  const doCsv = async () => {
    try {
      const outcome = await download(new Blob(['\ufeff' + buildCsv(r)], { type: 'text/csv;charset=utf-8' }), `${slug(s.meta.name)}-previsionnel.csv`)
      announce(outcome, 'Tableau exporté.')
    } catch (e) { fail(e) }
  }

  return h('div', { class: 'content' },
    moduleShell({
      no: '08', title: 'Business case',
      actions: [
        // La présentation se lance d'ici : c'est la page du dossier, et
        // présenter est ce qu'on fait d'un dossier une fois qu'il tient.
        h('button', {
          class: 'btn btn-primary btn-pill',
          onClick: () => { resetDeck(); navigate('#/presentation') },
        }, 'Présenter en 15 slides →'),
      ],
    }),

    readiness(s, r, y),

    h('div', { class: 'card mb' },
      h('div', { class: 'card-body' }, banquierVerifie(r)),
      h('div', { class: 'table-wrap' }, tableauBanquier(r, yearLabel)),
    ),

    h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Exporter'), h('span', { class: 'spacer' })),
      h('div', { class: 'card-body' },
        h('div', { class: 'grid grid-3' },
          exportTile('Présentation PowerPoint', "Le dossier complet, prêt à présenter : le verdict en ouverture, les chiffres clés, la trajectoire, le compte de résultat, la frise de trésorerie annotée, le point mort, l'équipe, le financement, ce qui changerait le plus, ce que touche le dirigeant, et les hypothèses.", 'Télécharger le .pptx', doPptx, true),
          exportTile('Tableau de chiffres', "Le prévisionnel complet au format CSV, ouvrable dans Excel, Numbers ou Google Sheets.", 'Télécharger le .csv', doCsv),
          exportTile('Sauvegarde du scénario', "Toutes tes données dans un fichier, pour les archiver ou les transférer sur un autre appareil.", 'Télécharger le .json', doJson),
        ),
      ),
    ),

    h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Le projet en une page')),
      h('div', { class: 'card-body' },
        h('div', { class: 'grid grid-4 kpis mb' },
          stat("Chiffre d'affaires", euro(r.pnl.revenue[y], { compact: true }), yearLabel(y)),
          stat('EBE', euro(r.pnl.ebe[y], { compact: true }), pct(k.ebeMargin[y]) + ' du CA'),
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
              { label: 'EBE', values: r.pnl.ebe, color: PALETTE[1] },
              { label: 'Résultat net', values: r.pnl.netResult, color: PALETTE[2] },
            ],
          })),
      ),
      h('div', { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', {}, 'Trésorerie')),
        h('div', { class: 'card-body' }, areaChart({ values: r.cash.balance, startDate: r.startDate, color: k.fundingNeed > 0 ? STATUS.warn : STATUS.gain })),
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
    k.firstEbePositiveYear !== null
      ? `L'exploitation dégage un EBE positif dès ${theYear(k.firstEbePositiveYear)} (${euro(p.ebe[k.firstEbePositiveYear])}). `
      : `L'EBE reste négatif sur l'ensemble de l'horizon modélisé. `,
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
        : "Aucun salarié rémunéré n'est modélisé — vérifie que c'est volontaire.",
    },
    {
      ok: !r.balance.some((b2) => b2.equity < 0),
      label: 'Les capitaux propres restent positifs',
      detail: r.balance.some((b2) => b2.equity < 0)
        ? "Les pertes cumulées dépassent les apports sur au moins un exercice : renforce le capital."
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

/* ───────────────────── Ce que chaque lecteur va vérifier ────────────────── */

/**
 * Trois lecteurs, trois grilles.
 *
 * Un même prévisionnel n'est pas jugé de la même façon selon qui l'ouvre. Une
 * banque regarde la capacité de remboursement et l'apport ; un business angel
 * regarde l'économie unitaire et ce que l'argent achète ; un fonds regarde la
 * pente et la taille que le modèle peut atteindre. Cette section confronte le
 * modèle aux trois grilles et dit, pour chacune, ce qui tient et ce qui manque.
 *
 * Les critères sont volontairement peu nombreux et vérifiables : il ne s'agit
 * pas de promettre un accord, mais d'éviter la question à laquelle on n'a pas
 * de réponse.
 */
function readiness(s, r, y) {
  const k = r.kpis, p = r.pnl
  const f = s.financing || {}
  const equity = [...(f.equityFounders || []), ...(f.equityInvestors || [])]
    .reduce((a, x) => a + (Number(x.amount) || 0), 0)
  const revenue5 = p.revenue[4] || 0
  const growth = p.revenue[0] > 0 && p.revenue[2] > 0 ? Math.pow(p.revenue[2] / p.revenue[0], 1 / 2) - 1 : null

  // La banque lit les ratios de l'échéancier réel : apport, couverture des
  // échéances par la capacité d'autofinancement, endettement en années de capacité, trésorerie, point
  // mort. Ce qui est sans objet — pas de prêt, pas d'échéance — ne compte pas.
  const banque = lignesBanquier(r).filter((l) => l.etat !== 'na')

  const audiences = [
    {
      key: 'banque', label: 'Banque', glyph: '▤',
      brief: "Elle prête contre une capacité de remboursement et un apport, pas contre une idée.",
      checks: banque.map((l) => ({
        label: l.titre,
        ok: l.etat === 'ok',
        value: l.valeur,
        need: [l.lu, l.faire].filter(Boolean).join(' '),
      })),
    },
    {
      key: 'angel', label: 'Business angel', glyph: '◈',
      brief: "Il investit son argent personnel. Il veut comprendre l'économie unitaire en cinq minutes.",
      checks: [
        {
          label: 'Marge unitaire positive',
          ok: k.marginRate[y] > 0,
          value: pct(k.marginRate[y], 0) + ' de marge brute',
          need: "Sans marge brute, aucun volume ne sauve le modèle. C'est la première chose vérifiée.",
        },
        {
          label: 'Un client rapporte plus qu’il ne coûte',
          ok: k.ltvCacRatio === null || k.ltvCacRatio >= 3,
          value: k.ltvCacRatio === null ? 'Acquisition non chiffrée' : `${num(k.ltvCacRatio, 1)}× le coût d'acquisition`,
          need: "En dessous de 3, dépenser plus en acquisition accélère les pertes. Travaille la conversion ou la rétention.",
        },
        {
          label: 'Le fondateur se rémunère',
          ok: (s.team || []).some((m) => m?.enabled !== false && (Number(m.monthlyGross) || 0) > 0),
          value: (s.team || []).some((m) => (Number(m.monthlyGross) || 0) > 0) ? 'Oui, dans le modèle' : 'Non',
          need: "Un plan où le fondateur ne se paie pas n'est pas prudent, il est faux — et le point mort est sous-estimé.",
        },
        {
          label: 'Montant demandé explicite',
          ok: k.fundingNeed > 0 || equity > 0,
          value: k.fundingNeed > 0 ? `${euro(k.fundingNeed)} avant ${monthLabel(k.cashLow.month, r.startDate)}` : `${euro(equity, { compact: true })} déjà mobilisés`,
          need: "Dites le montant et la date. « On cherche des fonds » n'est pas une demande.",
        },
      ],
    },
    {
      key: 'fonds', label: "Fonds d'investissement", glyph: '◆',
      brief: "Il cherche une pente et une taille de sortie. Un bon commerce rentable ne l'intéresse pas forcément.",
      checks: [
        {
          label: 'Croissance annuelle',
          ok: growth !== null && growth >= 0.5,
          value: growth === null ? 'Non mesurable' : `${pct(growth, 0)} par an`,
          need: "Un fonds attend un doublement annuel sur les premières années. En dessous, vise plutôt la dette ou l'autofinancement.",
        },
        {
          label: 'Taille à cinq ans',
          ok: revenue5 >= 3000000,
          value: euro(revenue5, { compact: true }) + ' en année 5',
          need: "En dessous de quelques millions à cinq ans, le calcul de sortie d'un fonds ne tombe pas juste.",
        },
        {
          label: 'Part de revenu récurrent',
          ok: (s.activities || []).some((a) => (Number(a.recurringPrice) || 0) > 0),
          value: (s.activities || []).some((a) => (Number(a.recurringPrice) || 0) > 0) ? 'Oui' : 'Aucun abonnement',
          need: "Le récurrent se valorise plusieurs fois mieux que la prestation : c'est ce qui rend la croissance capitalisable.",
        },
        {
          label: 'Autonomie financée',
          ok: k.fundingNeed === 0 || k.runwayMonths === null || k.runwayMonths >= 18,
          value: k.runwayMonths === null ? 'Pas de consommation nette' : `${num(k.runwayMonths, 0)} mois d'autonomie`,
          need: "Une levée prend quatre à six mois. Finance dix-huit mois, pas six, sinon tu repars en levée le jour où tu finis.",
        },
      ],
    },
  ]

  return h('section', { class: 'panel mb' },
    h('div', { class: 'panel-head' },
      h('h2', {}, 'Ce qu’on va vérifier dans ton dossier'),
      h('p', { class: 'panel-sub' }, "Les mêmes chiffres, lus par trois lecteurs différents. Ce qui manque ici est ce qu'on te demandera."),
    ),
    h('div', { class: 'audiences' },
      ...audiences.map((a) => {
        const passed = a.checks.filter((c) => c.ok).length
        return h('div', { class: `audience ${passed === a.checks.length ? 'ready' : ''}` },
          h('div', { class: 'audience-head' },
            h('span', { class: 'audience-glyph' }, a.glyph),
            h('span', { class: 'audience-label' }, a.label),
            h('span', { class: 'audience-score num' }, `${passed}/${a.checks.length}`),
          ),
          h('p', { class: 'audience-brief' }, a.brief),
          h('div', { class: 'audience-checks' },
            ...a.checks.map((c) => h('div', { class: `check ${c.ok ? 'ok' : ''}` },
              h('span', { class: 'check-mark' }, c.ok ? '✓' : '·'),
              h('div', {},
                h('div', { class: 'check-label' }, c.label),
                h('div', { class: 'check-value num' }, c.value),
                !c.ok ? h('p', { class: 'check-need' }, c.need) : null,
              ),
            )),
          ),
        )
      }),
    ),
  )
}

function exportTile(title, description, action, onClick, primary) {
  return h('div', { class: 'card', style: { background: primary ? 'var(--signal-wash)' : 'var(--surface-2)', borderColor: primary ? 'var(--signal)' : 'var(--rule)' } },
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
  push('EBE', p.ebe)
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
/** Nom de fichier : décompose les accents puis retire les diacritiques. */
const slug = (s) => String(s || 'business-plan').normalize('NFD').replace(/[\u0300-\u036F]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()

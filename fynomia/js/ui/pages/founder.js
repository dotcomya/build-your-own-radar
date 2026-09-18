/**
 * « Ce que je touche » — le trajet complet jusqu'au compte personnel.
 *
 * Tous les prévisionnels s'arrêtent au résultat de l'entreprise. Celui-ci
 * continue : cotisations, impôt sur les sociétés, flat tax, impôt sur le
 * revenu. Ce qui reste au bout est le seul chiffre que le dirigeant peut
 * effectivement dépenser.
 */

import { h, euro, pct, num, numberField, selectField, switchField, helpButton, yearLabel } from '../dom.js'
import { founderIncome } from '../../engine/founder.js'
import { barChart, PALETTE, STATUS, YEAR_CATEGORIES } from '../charts.js'
import { getSector } from '../../state/sectors.js'
import { tutorial, stepBanner } from '../tutorial.js'
import { journey } from '../../engine/journey.js'
import store from '../../state/store.js'

export function renderFounder(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  if (!r) return h('div', { class: 'content' }, h('p', {}, 'Aucun résultat.'))

  const income = founderIncome(s, r)
  const y = pickYear(income, r)
  const row = income.rows[y]
  const set = (patch) => store.update((sc) => Object.assign(sc.founder, patch), { label: 'Rémunération du dirigeant' })

  return h('div', { class: 'content embedded' },
    stepBanner('remuneration', journey(store.scenario, store.result), navigate),
    payLadder(income, row, r, y),

    h('div', { class: 'grid grid-2 mt', style: { alignItems: 'start' } },
      waterfall(income, r, y),
      settingsPanel(s, income, set, refresh),
    ),

    h('section', { class: 'panel mt' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Évolution du revenu disponible')),
      h('div', { class: 'panel-body' },
        // Comparer le coût supporté par l'entreprise et ce qui arrive
        // réellement sur le compte : l'écart est le sujet de cette page.
        barChart({
          categories: YEAR_CATEGORIES,
          series: [
            { label: "Ce que l'entreprise débourse", values: income.rows.map((x) => x.employerCost + x.distributed), color: PALETTE[1] },
            { label: 'Ce qui arrive sur ton compte', values: income.rows.map((x) => x.disposable), color: PALETTE[0] },
          ],
        }),
        h('p', { class: 'tiny muted', style: { margin: '10px 0 0' } },
          "L'écart entre les deux barres est la somme des cotisations, de l'impôt sur les sociétés, des prélèvements sur dividendes et de l'impôt sur le revenu."),
      ),
    ),

    h('section', { class: 'panel mt' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Le détail, exercice par exercice')),
      h('div', { class: 'table-wrap' }, detailTable(income, r)),
    ),

    income.settings.liberalBnc && h('div', { class: 'note warn mt' },
      h('div', { class: 'note-title' }, "Tu exerces en bénéfices non commerciaux"),
      "Fynomia modélise une société soumise à l'impôt sur les sociétés. En exercice libéral classique, il n'y a ni impôt sur les sociétés ni dividendes : le bénéfice du cabinet est imposé directement à ton nom, au barème progressif, et tes prélèvements ne sont que des acomptes sur ce bénéfice. Les montants ci-dessus restent utiles pour dimensionner ton train de vie, mais ton imposition réelle portera sur le résultat du cabinet, pas sur tes prélèvements. En SELARL en revanche, le calcul ci-dessus s'applique tel quel.",
    ),

    h('div', { class: 'note plain mt' },
      h('div', { class: 'note-title' }, 'Ce que ce calcul ne dit pas'),
      "Le prélèvement à la source lisse l'impôt sur l'année mais ne le change pas. Ne sont pas modélisés ici : la CSG déductible en cas d'option pour le barème, les réductions et crédits d'impôt personnels, ni l'éventuelle contribution exceptionnelle sur les hauts revenus. Un expert-comptable affinera ton arbitrage entre rémunération et dividendes, qui dépend aussi de tes droits à retraite et à prévoyance.",
    ),

    tutorial('remuneration', navigate),
  )
}

/**
 * L'échelle : quatre marches, dans l'ordre où l'argent descend.
 *
 * La page ouvrait sur une cascade de douze lignes — exacte, et illisible pour
 * qui découvre la différence entre un brut et un super brut. Ces quatre
 * montants-là sont ceux qu'on retient, et chacun porte en une phrase ce qui le
 * sépare du précédent. Le détail complet reste juste en dessous.
 */
function payLadder(income, row, r, y) {
  const salaryCost = row.employerCost || 0
  const employerCharges = salaryCost - (row.gross || 0)
  const employeeCharges = (row.gross || 0) - (row.netBeforeTax || 0)
  const steps = [
    row.gross > 0 ? {
      k: "Ce que l'entreprise débourse",
      v: salaryCost,
      note: `Le « super brut » : ton brut plus ${euro(employerCharges)} de cotisations patronales.`,
      tone: 'cost',
    } : null,
    row.gross > 0 ? {
      k: 'Ton salaire brut',
      v: row.gross,
      note: `Ce qui figure sur la fiche de paie, avant ${euro(employeeCharges)} de cotisations salariales.`,
    } : null,
    row.gross > 0 ? {
      k: 'Ton net avant impôt',
      v: row.netBeforeTax,
      note: "Ce qui arrive sur le compte chaque mois, avant l'impôt sur le revenu.",
    } : null,
    row.grossDividends > 0 ? {
      k: 'Tes dividendes nets',
      v: row.netDividends,
      note: `Sur ${euro(row.grossDividends)} distribués, après prélèvements sociaux${row.dividendIncomeTax > 0 ? ' et flat tax' : ''}.`,
    } : null,
    {
      k: 'Ce qui te reste, net de tout',
      v: row.disposable,
      note: `Impôt sur le revenu déduit — tranche marginale ${pct(row.marginalRate, 0)}. Soit ${euro(row.monthly)} par mois.`,
      tone: 'final',
    },
  ].filter(Boolean)

  return h('section', { class: 'pay' },
    h('div', { class: 'pay-head' },
      h('h2', {}, 'De ce que paie l’entreprise à ce que tu touches'),
      h('span', { class: 'pay-year' }, yearLabel(y)),
    ),
    h('div', { class: 'pay-steps' },
      ...steps.map((st, i) => h('div', { class: `pay-step ${st.tone || ''}` },
        h('div', { class: 'pay-step-main' },
          h('span', { class: 'pay-step-k' }, st.k),
          h('span', { class: 'pay-step-v num' }, euro(st.v)),
        ),
        h('p', { class: 'pay-step-note' }, st.note),
      )),
    ),
    row.costPerEuro > 0 ? h('p', { class: 'pay-foot' },
      `Autrement dit : l'entreprise doit produire ${num(row.costPerEuro, 2)} € de valeur pour en laisser 1 € dans ton poche.`) : null,
  )
}

/* ─────────────────────────── Chemin de l'argent ───────────────────────── */

/**
 * La cascade : de ce que produit l'entreprise à ce qui arrive sur le compte.
 * Chaque marche est un prélèvement, nommé et chiffré.
 */
function waterfall(income, r, y) {
  const row = income.rows[y]
  const ebitda = r.pnl.ebitda[y]
  const steps = []

  steps.push({ label: "EBITDA de l'entreprise", value: ebitda, kind: 'start' })
  if (row.employerCost > 0) steps.push({ label: 'dont ta rémunération chargée', value: -row.employerCost, kind: 'info', note: `${euro(row.gross)} de brut, ${euro(row.employerCost - row.gross)} de cotisations` })
  steps.push({ label: 'Amortissements et frais financiers', value: -(r.pnl.amortisation[y] + r.pnl.interest[y]), kind: 'cost' })
  if (r.pnl.credits[y] > 0) steps.push({ label: "Crédits d'impôt", value: r.pnl.credits[y], kind: 'gain' })
  steps.push({ label: 'Impôt sur les sociétés', value: -r.pnl.corporateTax[y], kind: 'cost' })
  steps.push({ label: "Résultat net de l'entreprise", value: r.pnl.netResult[y], kind: 'subtotal' })
  steps.push({
    label: `Distribué aux associés (${pct(income.settings.payout, 0)})`,
    value: -row.distributed, kind: 'info',
    note: row.retained > 0 ? `${euro(row.retained)} restent en réserves dans l'entreprise` : "rien n'est mis en réserve",
  })

  steps.push({ label: 'Tes dividendes bruts', value: row.grossDividends, kind: 'start' })
  if (row.dividendSocial > 0) steps.push({ label: row.tnsPortion > 0 ? 'Prélèvements sociaux et cotisations TNS' : 'Prélèvements sociaux (17,2 %)', value: -row.dividendSocial, kind: 'cost' })
  if (row.dividendIncomeTax > 0) steps.push({ label: "Impôt forfaitaire sur dividendes (12,8 %)", value: -row.dividendIncomeTax, kind: 'cost' })
  steps.push({ label: 'Ton salaire net', value: row.netBeforeTax, kind: 'gain' })
  steps.push({ label: "Impôt sur le revenu", value: -row.incomeTax, kind: 'cost' })
  steps.push({ label: 'Sur ton compte', value: row.disposable, kind: 'total' })

  return h('section', { class: 'panel' },
    h('div', { class: 'card-head' },
      h('div', {}, h('h2', {}, "Le chemin de l'argent"), h('div', { class: 'tiny muted' }, yearLabel(y))),
    ),
    h('div', { class: 'flow' },
      ...steps.map((st) => h('div', { class: `flow-step flow-${st.kind}` },
        h('div', { class: 'flow-line' },
          h('span', { class: 'flow-label' }, st.label),
          h('span', { class: `flow-value num ${st.value < 0 ? 'neg' : ''}` }, euro(st.value, { sign: st.kind === 'gain' })),
        ),
        st.note && h('div', { class: 'flow-note' }, st.note),
      )),
    ),
    row.costPerEuro && row.costPerEuro > 0 ? h('div', { class: 'panel-body', style: { paddingTop: 0 } },
      h('div', { class: 'note plain' },
        h('div', { class: 'note-title' }, `${num(row.costPerEuro, 2)} € pour un euro dans ton poche`),
        `L'entreprise doit dégager ${num(row.costPerEuro, 2)} € de valeur pour te laisser 1 € net d'impôt. C'est le prix de la chaîne complète : cotisations, impôt sur les sociétés, prélèvements sur dividendes et impôt sur le revenu.`),
    ) : null,
  )
}

function settingsPanel(s, income, set, refresh) {
  const f = s.founder
  const isSarl = ['SARL', 'EURL'].includes(s.meta.legalForm)
  return h('section', { class: 'panel' },
    h('header', { class: 'panel-head' },
      h('h2', {}, 'Tes paramètres'),
      h('p', { class: 'panel-sub' }, "Ce qui détermine le partage entre toi, l'entreprise et l'État."),
    ),
    h('div', { class: 'panel-body stack' },
      income.member
        ? selectField({
            label: 'Poste correspondant à ta rémunération',
            value: f.memberId || income.member.id,
            options: (s.team || []).map((m) => ({ value: m.id, label: `${m.role} — ${euro(m.monthlyGross)}/mois` })),
            hint: "Modifie le montant dans l'onglet Équipe.",
            onInput: (v) => set({ memberId: v }),
          })
        : h('div', { class: 'note warn' },
            h('div', { class: 'note-title' }, "Aucun poste n'est défini"),
            "Ajoute ton poste dans l'onglet Équipe pour que ta rémunération entre dans le calcul."),

      h('div', { class: 'grid grid-2' },
        numberField({ label: 'Ta part du capital', field: 'rdShare', value: f.equityShare, percent: true,
          hint: 'Détermine la part des dividendes qui te revient.', onInput: (v) => set({ equityShare: v }) }),
        numberField({ label: 'Part du résultat distribuée', field: 'rdShare', value: f.dividendPayout, percent: true,
          hint: "Le reste alimente les réserves et reste dans l'entreprise.", onInput: (v) => set({ dividendPayout: v }) }),
      ),
      h('div', { class: 'grid grid-2' },
        numberField({ label: 'Parts fiscales du foyer', field: 'count', value: f.taxParts, step: 0.5, max: 10,
          hint: 'Célibataire 1, couple 2, plus une demi-part par enfant.', onInput: (v) => set({ taxParts: v }) }),
        numberField({ label: 'Autres revenus du foyer', field: 'amount', value: f.otherIncome, suffix: '€/an',
          hint: "Salaire du conjoint, revenus fonciers. Ils modifient ton tranche.", onInput: (v) => set({ otherIncome: v }) }),
      ),
      selectField({
        label: 'Imposition des dividendes', value: f.dividendRegime,
        options: [
          { value: 'pfu', label: 'Flat tax — 30 % (12,8 % + 17,2 %)' },
          { value: 'bareme', label: 'Barème progressif — abattement de 40 %' },
        ],
        hint: "Le barème devient intéressant quand ton taux marginal est faible.",
        onInput: (v) => set({ dividendRegime: v }),
      }),
      isSarl && switchField({
        label: 'Gérant majoritaire',
        checked: !!f.majorityManager,
        hint: `En SARL ou EURL, la part des dividendes dépassant 10 % du capital — soit ${euro(income.capitalBase * 0.1)} ici — supporte les cotisations d'indépendant au lieu des 17,2 % de prélèvements sociaux.`,
        onInput: (v) => set({ majorityManager: v }),
      }),
      comparison(income, s),
    ),
  )
}

/** Mise en perspective : le même argent, autrement réparti. */
function comparison(income, s) {
  const rows = income.rows
  const y = rows.findIndex((x) => x.disposable > 0)
  if (y < 0) return null
  const row = rows[y]
  const total = row.netBeforeTax + row.netDividends
  if (total <= 0) return null
  const salaryShare = row.netBeforeTax / total
  return h('div', { class: 'note' },
    h('div', { class: 'note-title' }, 'Ton équilibre actuel'),
    salaryShare > 0.85
      ? "Toi tu te rémunères presque exclusivement en salaire. C'est le choix le plus protecteur — retraite, chômage en SAS, prévoyance — mais aussi le plus coûteux pour l'entreprise. Un peu de dividende peut alléger la facture une fois le résultat installé."
      : salaryShare < 0.25
        ? "Tu vis surtout de dividendes. C'est fiscalement efficace, mais les dividendes n'ouvrent aucun droit à la retraite ni à la prévoyance, et ils supposent un résultat bénéficiaire chaque année. Une rémunération minimale sécurise ton couverture."
        : "Tu combines salaire et dividendes. C'est l'équilibre le plus courant : le salaire assure la couverture sociale, le dividende récompense le résultat sans en supporter les cotisations.",
  )
}

function detailTable(income, r) {
  const rows = income.rows
  const line = (label, get, cls, indent) => h('tr', { class: cls || '' },
    h('td', { style: indent ? { paddingLeft: '26px' } : {} }, label),
    ...rows.map((x) => h('td', { class: 'num' }, euro(get(x)))),
  )
  return h('table', { class: 'data' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), ...YEAR_CATEGORIES.map((c, i) => h('th', {}, yearLabel(i))))),
    h('tbody', {},
      h('tr', { class: 'section' }, h('td', { colspan: 6 }, 'Rémunération')),
      line('Salaire brut', (x) => x.gross),
      line("Coût pour l'entreprise", (x) => x.employerCost, '', true),
      line('Net avant impôt', (x) => x.netBeforeTax, 'highlight'),
      h('tr', { class: 'section' }, h('td', { colspan: 6 }, 'Dividendes')),
      h('tr', {}, h('td', {}, 'Résultat net de la société'), ...r.pnl.netResult.map((v) => h('td', { class: 'num' }, euro(v)))),
      line('Dividendes bruts qui te reviennent', (x) => x.grossDividends),
      line('Prélèvements sociaux et cotisations', (x) => -x.dividendSocial, '', true),
      line('Impôt forfaitaire', (x) => -x.dividendIncomeTax, '', true),
      line('Dividendes nets', (x) => x.netDividends, 'highlight'),
      h('tr', { class: 'section' }, h('td', { colspan: 6 }, 'Impôt sur le revenu')),
      line('Revenu imposable du foyer', (x) => x.taxableIncome),
      h('tr', {}, h('td', {}, 'Taux marginal'), ...rows.map((x) => h('td', { class: 'num pct' }, pct(x.marginalRate, 0)))),
      line('Impôt dû', (x) => -x.incomeTax),
      h('tr', { class: 'total' }, h('td', {}, 'Disponible sur ton compte'), ...rows.map((x) => h('td', { class: 'num' }, euro(x.disposable)))),
      h('tr', {}, h('td', { class: 'muted small' }, 'soit par mois'), ...rows.map((x) => h('td', { class: 'num muted small' }, euro(x.monthly)))),
    ),
  )
}

/* ────────────────────────────── Présentation ──────────────────────────── */

function bigNumber(label, value, sub, tone) {
  return h('div', { class: `takehome-hero ${tone || ''}` },
    h('div', { class: 'eyebrow', style: { color: 'var(--ink-4)' } }, label),
    h('div', { class: 'takehome-value num' }, euro(value)),
    h('div', { class: 'takehome-sub' }, sub),
  )
}

function splitCell(label, value, sub, negative) {
  return h('div', { class: 'takehome-cell' },
    h('div', { class: 'eyebrow', style: { color: 'var(--ink-4)' } }, label),
    h('div', { class: `takehome-cell-value num ${negative ? 'neg' : ''}` }, euro(value)),
    h('div', { class: 'takehome-sub' }, sub),
  )
}

function headline(income, r, y) {
  const row = income.rows[y]
  const sector = getSector(store.scenario.meta.sectorKey)
  if (row.disposable <= 0) {
    return "Rien ne remonte encore jusqu'à toi. Tant que l'entreprise ne dégage pas de résultat et que tu ne te verses pas de rémunération, ton revenu est nul — beaucoup de dirigeants passent une à deux années dans cette situation, mais il faut alors savoir de quoi on vit."
  }
  const parts = []
  parts.push(`${euro(row.monthly)} par mois, net de tout : cotisations, impôt sur les sociétés, prélèvements sur dividendes et impôt sur le revenu.`)
  if (row.costPerEuro) parts.push(`L'entreprise produit ${num(row.costPerEuro, 2)} € de valeur pour chaque euro qui arrive chez toi.`)
  if (sector) parts.push(`Référence ${sector.label.toLowerCase()}.`)
  return parts.join(' ')
}

/** Premier exercice où le dirigeant se verse quelque chose, sinon la troisième. */
function pickYear(income, r) {
  const i = income.rows.findIndex((x) => x.disposable > 0)
  return i >= 0 ? i : 2
}

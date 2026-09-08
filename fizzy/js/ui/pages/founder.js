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
import store from '../../state/store.js'

export function renderFounder(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  if (!r) return h('div', { class: 'content' }, h('p', {}, 'Aucun résultat.'))

  const income = founderIncome(s, r)
  const y = pickYear(income, r)
  const row = income.rows[y]
  const set = (patch) => store.update((sc) => Object.assign(sc.founder, patch), { label: 'Rémunération du dirigeant' })

  return h('div', { class: 'content' },
    h('section', { class: 'persona-banner' },
      h('div', { class: 'eyebrow', style: { color: 'var(--ink-4)', marginBottom: '7px' } }, `Dirigeant · ${yearLabel(y)}`),
      h('div', { class: 'persona-question' }, "Combien puis-je dépenser, une fois tout le monde payé ?"),
      h('p', { class: 'persona-answer' }, headline(income, r, y)),
    ),

    h('div', { class: 'takehome' },
      bigNumber('Disponible', row.disposable, `soit ${euro(row.monthly)} par mois`, 'signal'),
      h('div', { class: 'takehome-split' },
        splitCell('Salaire net', row.netBeforeTax, row.gross > 0 ? `sur ${euro(row.gross)} de brut` : 'aucune rémunération'),
        splitCell('Dividendes nets', row.netDividends, row.grossDividends > 0 ? `sur ${euro(row.grossDividends)} distribués` : 'aucune distribution'),
        splitCell("Impôt sur le revenu", -row.incomeTax, `taux marginal ${pct(row.marginalRate, 0)}`, true),
      ),
    ),

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
            { label: 'Ce qui arrive sur votre compte', values: income.rows.map((x) => x.disposable), color: PALETTE[0] },
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
      h('div', { class: 'note-title' }, "Vous exercez en bénéfices non commerciaux"),
      "Fizzy modélise une société soumise à l'impôt sur les sociétés. En exercice libéral classique, il n'y a ni impôt sur les sociétés ni dividendes : le bénéfice du cabinet est imposé directement à votre nom, au barème progressif, et vos prélèvements ne sont que des acomptes sur ce bénéfice. Les montants ci-dessus restent utiles pour dimensionner votre train de vie, mais votre imposition réelle portera sur le résultat du cabinet, pas sur vos prélèvements. En SELARL en revanche, le calcul ci-dessus s'applique tel quel.",
    ),

    h('div', { class: 'note plain mt' },
      h('div', { class: 'note-title' }, 'Ce que ce calcul ne dit pas'),
      "Le prélèvement à la source lisse l'impôt sur l'année mais ne le change pas. Ne sont pas modélisés ici : la CSG déductible en cas d'option pour le barème, les réductions et crédits d'impôt personnels, ni l'éventuelle contribution exceptionnelle sur les hauts revenus. Un expert-comptable affinera votre arbitrage entre rémunération et dividendes, qui dépend aussi de vos droits à retraite et à prévoyance.",
    ),
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
  if (row.employerCost > 0) steps.push({ label: 'dont votre rémunération chargée', value: -row.employerCost, kind: 'info', note: `${euro(row.gross)} de brut, ${euro(row.employerCost - row.gross)} de cotisations` })
  steps.push({ label: 'Amortissements et frais financiers', value: -(r.pnl.amortisation[y] + r.pnl.interest[y]), kind: 'cost' })
  if (r.pnl.credits[y] > 0) steps.push({ label: "Crédits d'impôt", value: r.pnl.credits[y], kind: 'gain' })
  steps.push({ label: 'Impôt sur les sociétés', value: -r.pnl.corporateTax[y], kind: 'cost' })
  steps.push({ label: "Résultat net de l'entreprise", value: r.pnl.netResult[y], kind: 'subtotal' })
  steps.push({
    label: `Distribué aux associés (${pct(income.settings.payout, 0)})`,
    value: -row.distributed, kind: 'info',
    note: row.retained > 0 ? `${euro(row.retained)} restent en réserves dans l'entreprise` : "rien n'est mis en réserve",
  })

  steps.push({ label: 'Vos dividendes bruts', value: row.grossDividends, kind: 'start' })
  if (row.dividendSocial > 0) steps.push({ label: row.tnsPortion > 0 ? 'Prélèvements sociaux et cotisations TNS' : 'Prélèvements sociaux (17,2 %)', value: -row.dividendSocial, kind: 'cost' })
  if (row.dividendIncomeTax > 0) steps.push({ label: "Impôt forfaitaire sur dividendes (12,8 %)", value: -row.dividendIncomeTax, kind: 'cost' })
  steps.push({ label: 'Votre salaire net', value: row.netBeforeTax, kind: 'gain' })
  steps.push({ label: "Impôt sur le revenu", value: -row.incomeTax, kind: 'cost' })
  steps.push({ label: 'Sur votre compte', value: row.disposable, kind: 'total' })

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
        h('div', { class: 'note-title' }, `${euro(row.costPerEuro)} pour un euro dans votre poche`),
        `L'entreprise doit dégager ${euro(row.costPerEuro)} de valeur pour vous laisser 1 € net d'impôt. C'est le prix de la chaîne complète : cotisations, impôt sur les sociétés, prélèvements sur dividendes et impôt sur le revenu.`),
    ) : null,
  )
}

function settingsPanel(s, income, set, refresh) {
  const f = s.founder
  const isSarl = ['SARL', 'EURL'].includes(s.meta.legalForm)
  return h('section', { class: 'panel' },
    h('header', { class: 'panel-head' },
      h('h2', {}, 'Vos paramètres'),
      h('p', { class: 'panel-sub' }, "Ce qui détermine le partage entre vous, l'entreprise et l'État."),
    ),
    h('div', { class: 'panel-body stack' },
      income.member
        ? selectField({
            label: 'Poste correspondant à votre rémunération',
            value: f.memberId || income.member.id,
            options: (s.team || []).map((m) => ({ value: m.id, label: `${m.role} — ${euro(m.monthlyGross)}/mois` })),
            hint: "Modifiez le montant dans l'onglet Équipe.",
            onInput: (v) => set({ memberId: v }),
          })
        : h('div', { class: 'note warn' },
            h('div', { class: 'note-title' }, "Aucun poste n'est défini"),
            "Ajoutez votre poste dans l'onglet Équipe pour que votre rémunération entre dans le calcul."),

      h('div', { class: 'grid grid-2' },
        numberField({ label: 'Votre part du capital', field: 'rdShare', value: f.equityShare, percent: true,
          hint: 'Détermine la part des dividendes qui vous revient.', onInput: (v) => set({ equityShare: v }) }),
        numberField({ label: 'Part du résultat distribuée', field: 'rdShare', value: f.dividendPayout, percent: true,
          hint: "Le reste alimente les réserves et reste dans l'entreprise.", onInput: (v) => set({ dividendPayout: v }) }),
      ),
      h('div', { class: 'grid grid-2' },
        numberField({ label: 'Parts fiscales du foyer', field: 'count', value: f.taxParts, step: 0.5, max: 10,
          hint: 'Célibataire 1, couple 2, plus une demi-part par enfant.', onInput: (v) => set({ taxParts: v }) }),
        numberField({ label: 'Autres revenus du foyer', field: 'amount', value: f.otherIncome, suffix: '€/an',
          hint: "Salaire du conjoint, revenus fonciers. Ils modifient votre tranche.", onInput: (v) => set({ otherIncome: v }) }),
      ),
      selectField({
        label: 'Imposition des dividendes', value: f.dividendRegime,
        options: [
          { value: 'pfu', label: 'Flat tax — 30 % (12,8 % + 17,2 %)' },
          { value: 'bareme', label: 'Barème progressif — abattement de 40 %' },
        ],
        hint: "Le barème devient intéressant quand votre taux marginal est faible.",
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
    h('div', { class: 'note-title' }, 'Votre équilibre actuel'),
    salaryShare > 0.85
      ? "Vous vous rémunérez presque exclusivement en salaire. C'est le choix le plus protecteur — retraite, chômage en SAS, prévoyance — mais aussi le plus coûteux pour l'entreprise. Un peu de dividende peut alléger la facture une fois le résultat installé."
      : salaryShare < 0.25
        ? "Vous vivez surtout de dividendes. C'est fiscalement efficace, mais les dividendes n'ouvrent aucun droit à la retraite ni à la prévoyance, et ils supposent un résultat bénéficiaire chaque année. Une rémunération minimale sécurise votre couverture."
        : "Vous combinez salaire et dividendes. C'est l'équilibre le plus courant : le salaire assure la couverture sociale, le dividende récompense le résultat sans en supporter les cotisations.",
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
      line('Dividendes bruts qui vous reviennent', (x) => x.grossDividends),
      line('Prélèvements sociaux et cotisations', (x) => -x.dividendSocial, '', true),
      line('Impôt forfaitaire', (x) => -x.dividendIncomeTax, '', true),
      line('Dividendes nets', (x) => x.netDividends, 'highlight'),
      h('tr', { class: 'section' }, h('td', { colspan: 6 }, 'Impôt sur le revenu')),
      line('Revenu imposable du foyer', (x) => x.taxableIncome),
      h('tr', {}, h('td', {}, 'Taux marginal'), ...rows.map((x) => h('td', { class: 'num pct' }, pct(x.marginalRate, 0)))),
      line('Impôt dû', (x) => -x.incomeTax),
      h('tr', { class: 'total' }, h('td', {}, 'Disponible sur votre compte'), ...rows.map((x) => h('td', { class: 'num' }, euro(x.disposable)))),
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
    return "Rien ne remonte encore jusqu'à vous. Tant que l'entreprise ne dégage pas de résultat et que vous ne vous versez pas de rémunération, votre revenu est nul — beaucoup de dirigeants passent une à deux années dans cette situation, mais il faut alors savoir de quoi on vit."
  }
  const parts = []
  parts.push(`${euro(row.monthly)} par mois, net de tout : cotisations, impôt sur les sociétés, prélèvements sur dividendes et impôt sur le revenu.`)
  if (row.costPerEuro) parts.push(`L'entreprise produit ${euro(row.costPerEuro)} de valeur pour chaque euro qui arrive chez vous.`)
  if (sector) parts.push(`Référence ${sector.label.toLowerCase()}.`)
  return parts.join(' ')
}

/** Premier exercice où le dirigeant se verse quelque chose, sinon la troisième. */
function pickYear(income, r) {
  const i = income.rows.findIndex((x) => x.disposable > 0)
  return i >= 0 ? i : 2
}

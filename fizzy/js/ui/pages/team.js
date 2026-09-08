/**
 * Équipe : l'utilisateur saisit un brut mensuel, Fizzy calcule le coût réel.
 * Le détail du passage brut → coût employeur est affiché ligne par ligne,
 * parce que c'est là que se joue l'essentiel du budget d'une jeune entreprise.
 */

import { h, euro, pct, num, numberField, textField, selectField, switchField, monthField, helpButton, confirmDialog, toast, monthLabel } from '../dom.js'
import { newTeamMember } from '../../state/schema.js'
import { monthlyCost, CONTRACT_TYPES, STATUSES } from '../../engine/payroll.js'
import { barChart, PALETTE, YEAR_CATEGORIES } from '../charts.js'
import store from '../../state/store.js'

export function renderTeam(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  const level = store.level
  const open = renderTeam.open || (renderTeam.open = new Set())

  const add = () => {
    const m = newTeamMember({ role: s.team.length === 0 ? 'Fondateur' : 'Nouveau poste' })
    store.update((sc) => sc.team.push(m), { label: "Ajout d'un poste" })
    open.add(m.id)
    refresh()
  }

  const jeiActive = r?.jei?.some((j) => j.eligible)

  return h('div', { class: 'content' },
    h('div', { class: 'page-head' },
      h('h1', {}, 'Équipe'),
      h('p', {}, "Saisissez le salaire brut mensuel : Fizzy calcule les cotisations patronales, applique la réduction générale et en déduit le coût réel pour l'entreprise. Raisonner en brut sous-estime la masse salariale de 25 à 45 %."),
    ),

    s.team.length === 0
      ? h('div', { class: 'card' }, h('div', { class: 'empty' },
          h('div', { class: 'empty-icon' }, '◷'),
          h('h3', {}, 'Aucun poste'),
          h('p', { class: 'muted' }, "Ajoutez les personnes de l'équipe, y compris les fondateurs rémunérés."),
          h('button', { class: 'btn btn-primary mt', onClick: add }, 'Ajouter un premier poste'),
        ))
      : h('div', {}, ...s.team.map((m, i) => memberCard(m, i, r, level, open, refresh, jeiActive))),

    s.team.length > 0 && h('button', { class: 'btn btn-block mt', onClick: add }, '＋ Ajouter un poste'),

    r && s.team.length > 0 && payrollSummary(r, level),
    level === 'advanced' && s.team.length > 0 && jeiPanel(r),
  )
}

function memberCard(m, index, r, level, open, refresh, jeiActive) {
  const isOpen = open.has(m.id)
  const set = (patch, label = 'Modification du poste', opts = {}) =>
    store.update((sc) => Object.assign(sc.team.find((x) => x.id === m.id), patch), { label, ...opts })

  const headcount = r?.payroll.headcount[Number(m.startMonth) || 0] || 1
  const cost = monthlyCost(m, { headcount, jeiActive: jeiActive && (Number(m.rdShare) || 0) > 0, fiscal: store.scenario.fiscal })
  const count = Number(m.count) || 1
  const contract = CONTRACT_TYPES[m.contractType] || CONTRACT_TYPES.cdi

  const remove = async () => {
    if (await confirmDialog({ title: 'Supprimer ce poste ?', message: `« ${m.role} » sera retiré du modèle.`, confirmLabel: 'Supprimer', danger: true })) {
      store.update((sc) => { sc.team = sc.team.filter((x) => x.id !== m.id) }, { label: 'Suppression du poste' })
      refresh()
    }
  }

  return h('div', { class: `item ${isOpen ? 'open' : ''}` },
    h('div', { class: 'item-head', onClick: () => { isOpen ? open.delete(m.id) : open.add(m.id); refresh() } },
      h('div', { class: 'spacer' },
        h('div', { class: 'item-title' }, m.role || 'Poste sans nom', count > 1 ? h('span', { class: 'chip', style: { marginLeft: '7px' } }, `× ${count}`) : null),
        h('div', { class: 'item-meta' },
          `${contract.label} · ${euro(m.monthlyGross)} brut/mois · à partir de ${monthLabel(m.startMonth || 0, r?.startDate)}`),
      ),
      h('div', { class: 'right', style: { marginRight: '10px' } },
        h('div', { class: 'small num', style: { fontWeight: '650' } }, euro(cost.cost * count)),
        h('div', { class: 'tiny muted' }, 'coût mensuel'),
      ),
      h('span', { class: 'disclose' }, '›'),
    ),
    isOpen && h('div', { class: 'item-body' },
      h('div', { class: 'grid grid-3 mt' },
        textField({ label: 'Intitulé du poste', value: m.role, onInput: (v, o) => set({ role: v }, undefined, o) }),
        selectField({
          label: 'Type de contrat', value: m.contractType,
          options: Object.entries(CONTRACT_TYPES).map(([k, v]) => ({ value: k, label: v.label })),
          hint: contract.help,
          onInput: (v) => set({ contractType: v }),
        }),
        ['cdi', 'cdd'].includes(m.contractType) && selectField({
          label: 'Statut', value: m.status,
          options: Object.entries(STATUSES).map(([k, v]) => ({ value: k, label: v.label })),
          hint: STATUSES[m.status]?.help,
          onInput: (v) => set({ status: v }),
        }),
      ),

      h('div', { class: 'grid grid-3 mt' },
        numberField({
          label: m.contractType === 'tns' ? 'Rémunération mensuelle' : m.contractType === 'freelance' ? 'Facturation mensuelle' : 'Salaire brut mensuel',
          field: 'monthlyGross', value: m.monthlyGross, suffix: '€',
          help: 'superBrut',
          hint: m.contractType === 'stage' ? 'La gratification minimale légale est exonérée de cotisations.' : null,
          onInput: (v) => set({ monthlyGross: v }),
        }),
        numberField({ label: 'Nombre de personnes', field: 'count', value: m.count, suffix: 'pers.', hint: 'Un même poste dupliqué.', onInput: (v) => set({ count: v }) }),
        monthField({ label: "Mois d'arrivée", value: m.startMonth, startDate: r?.startDate, onInput: (v) => set({ startMonth: v }) }),
      ),
      level !== 'easy' && h('div', { class: 'grid grid-3 mt' },
        monthField({ label: 'Mois de départ', value: m.endMonth, startDate: r?.startDate, allowEmpty: true, onInput: (v) => set({ endMonth: v }) }),
      ),

      costBreakdown(cost, count, m),

      level === 'advanced' && ['cdi', 'cdd'].includes(m.contractType) && h('div', {},
        h('h4', { style: { margin: '18px 0 4px', display: 'flex', gap: '6px', alignItems: 'center' } }, "Recherche et innovation", helpButton('cir')),
        h('div', { class: 'field-hint', style: { marginBottom: '10px', maxWidth: '70ch' } },
          "Part du temps de travail consacrée à des travaux éligibles. Ces pourcentages alimentent le crédit d'impôt recherche, le crédit d'impôt innovation et l'éligibilité au statut JEI."),
        h('div', { class: 'grid grid-3' },
          numberField({ label: 'Temps en recherche (CIR)', field: 'rdShare', value: m.rdShare, percent: true, onInput: (v) => set({ rdShare: v }) }),
          numberField({ label: 'Temps en innovation (CII)', field: 'rdShare', value: m.innovShare, percent: true, onInput: (v) => set({ innovShare: v }) }),
          switchField({ label: 'Jeune docteur', checked: m.youngDoctor, hint: 'Dépenses comptées double pendant 24 mois.', onInput: (v) => set({ youngDoctor: v }) }),
        ),
      ),

      h('div', { class: 'row mt', style: { justifyContent: 'flex-end' } },
        h('button', { class: 'btn btn-sm btn-danger', onClick: remove }, 'Supprimer ce poste')),
    ),
  )
}

/** Le passage du brut au coût employeur, poste par poste. */
function costBreakdown(cost, count, member) {
  return h('div', { class: 'card', style: { marginTop: '16px', background: 'var(--ink-50)' } },
    h('div', { class: 'card-body tight' },
      h('div', { class: 'row', style: { marginBottom: '8px' } },
        h('h4', {}, 'Du brut au coût réel'),
        h('span', { class: 'spacer' }),
        count > 1 && h('span', { class: 'chip' }, `montants pour 1 personne`),
      ),
      h('table', { class: 'data', style: { fontSize: '12.5px' } },
        h('tbody', {},
          ...cost.detail.map((d) => h('tr', { class: d.emphasis ? 'highlight' : '' },
            h('td', {},
              h('div', {}, d.label),
              d.note && h('div', { class: 'tiny muted', style: { whiteSpace: 'normal', maxWidth: '46ch' } }, d.note),
            ),
            h('td', { class: `num ${d.amount < 0 ? 'pos' : ''}` }, euro(d.amount, { sign: d.amount < 0 })),
          )),
        ),
      ),
      count > 1 && h('div', { class: 'note plain', style: { marginTop: '10px' } },
        `Pour ${count} personnes : ${euro(cost.cost * count)} par mois, soit ${euro(cost.cost * count * 12)} par an.`),
      cost.reduction > 0 && h('div', { class: 'note ok', style: { marginTop: '10px' } },
        h('div', { class: 'note-title' }, `Réduction générale : ${euro(cost.reduction)} par mois`),
        `Ce salaire bénéficie de l'allègement de cotisations patronales applicable jusqu'à 3 SMIC. Le taux effectif de charges tombe à ${pct(cost.employerCharges / Math.max(1, cost.gross), 0)} au lieu de ${pct(cost.employerBase / Math.max(1, cost.gross), 0)}.`),
      cost.jeiExemption > 0 && h('div', { class: 'note ok', style: { marginTop: '10px' } },
        h('div', { class: 'note-title' }, `Exonération JEI : ${euro(cost.jeiExemption)} par mois`),
        `Votre entreprise remplit les conditions du statut Jeune entreprise innovante et ce poste est affecté à la recherche.`),
    ),
  )
}

function payrollSummary(r, level) {
  const p = r.payroll
  const grossY = yearly(p.gross), costY = yearly(p.cost), chargesY = yearly(p.employerCharges)
  return h('div', { class: 'card mt' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Masse salariale'), h('span', { class: 'spacer' }),
      h('span', { class: 'tiny muted' }, `${num(p.headcount[11])} personnes fin d'année 1 · ${num(p.headcount[59])} fin d'année 5`)),
    h('div', { class: 'card-body' },
      barChart({
        categories: YEAR_CATEGORIES,
        series: [
          { label: 'Salaires bruts', values: grossY, color: PALETTE[0] },
          { label: 'Cotisations patronales', values: chargesY, color: PALETTE[2] },
        ],
      }),
      h('div', { class: 'table-wrap mt' },
        h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, ''), ...YEAR_CATEGORIES.map((c, i) => h('th', {}, `Année ${i + 1}`)))),
          h('tbody', {},
            h('tr', {}, h('td', {}, 'Salaires bruts'), ...grossY.map((v) => h('td', { class: 'num' }, euro(v)))),
            h('tr', {}, h('td', {}, 'Cotisations patronales'), ...chargesY.map((v) => h('td', { class: 'num' }, euro(v)))),
            ...(p.jeiExemption.some((v) => v) ? [h('tr', {}, h('td', {}, h('span', { class: 'rowlabel' }, 'dont exonération JEI', helpButton('jei'))), ...yearly(p.jeiExemption).map((v) => h('td', { class: 'num pos' }, euro(-v))))] : []),
            h('tr', { class: 'total' }, h('td', {}, h('span', { class: 'rowlabel' }, 'Coût total employeur', helpButton('superBrut'))), ...costY.map((v) => h('td', { class: 'num' }, euro(v)))),
            h('tr', {}, h('td', {}, 'Taux de charges effectif'), ...costY.map((v, i) => h('td', { class: 'num pct' }, grossY[i] > 0 ? pct(chargesY[i] / grossY[i], 0) : '—'))),
            h('tr', {}, h('td', {}, 'Part du chiffre d\'affaires'), ...costY.map((v, i) => h('td', { class: 'num pct' }, r.pnl.revenue[i] > 0 ? pct(v / r.pnl.revenue[i], 0) : '—'))),
          ),
        ),
      ),
    ),
  )
}

function jeiPanel(r) {
  return h('div', { class: 'card mt' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Statut Jeune entreprise innovante'), helpButton('jei'), h('span', { class: 'spacer' }),
      h('label', { class: 'switch' },
        (() => {
          const input = h('input', { type: 'checkbox', checked: !!store.scenario.meta.jeiClaimed })
          input.addEventListener('change', () => store.update((s) => { s.meta.jeiClaimed = input.checked }, { label: 'Statut JEI' }))
          return input
        })(),
        h('span', { class: 'track' }), h('span', { class: 'small' }, 'Revendiquer le statut'))),
    h('div', { class: 'card-body' },
      h('div', { class: 'table-wrap' },
        h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, ''), ...YEAR_CATEGORIES.map((c, i) => h('th', {}, `Année ${i + 1}`)))),
          h('tbody', {},
            h('tr', {}, h('td', {}, 'Part des charges de R&D'), ...r.jei.map((j) => h('td', { class: 'num' }, pct(j.ratio, 0)))),
            h('tr', {}, h('td', {}, 'Seuil requis'), ...r.jei.map((j) => h('td', { class: 'num muted' }, pct(j.threshold, 0)))),
            h('tr', {}, h('td', {}, 'Éligible'), ...r.jei.map((j) => h('td', {}, h('span', { class: `chip ${j.eligible ? 'chip-pos' : ''}` }, j.eligible ? 'Oui' : 'Non')))),
            h('tr', { class: 'total' }, h('td', {}, 'Économie de cotisations'), ...yearly(r.payroll.jeiExemption).map((v) => h('td', { class: 'num pos' }, v > 0 ? euro(v) : '—'))),
          ),
        ),
      ),
      h('div', { class: 'note mt' },
        h('div', { class: 'note-title' }, 'Ce que couvre le statut'),
        "L'exonération porte sur les cotisations patronales des salariés affectés à la recherche, sur la part de leur salaire inférieure à 4,5 SMIC. L'exonération d'impôt sur les sociétés qui accompagnait autrefois le statut a été supprimée pour les entreprises créées depuis 2024."),
    ),
  )
}

const yearly = (arr) => Array.from({ length: 5 }, (_, y) => arr.slice(y * 12, y * 12 + 12).reduce((a, b) => a + b, 0))

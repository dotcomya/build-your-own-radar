/**
 * Équipe : l'utilisateur saisit un brut mensuel, Fynomia calcule le coût réel.
 * Le détail du passage brut → coût employeur est affiché ligne par ligne,
 * parce que c'est là que se joue l'essentiel du budget d'une jeune entreprise.
 */

import { h, euro, pct, num, numberField, textField, selectField, switchField, monthField, helpButton, confirmDialog, toast, monthLabel } from '../dom.js'
import { newTeamMember } from '../../state/schema.js'
import { monthlyCost, CONTRACT_TYPES, STATUSES, BENEFITS } from '../../engine/payroll.js'
import { barChart, PALETTE, YEAR_CATEGORIES } from '../charts.js'
import { tutorial, stepBanner } from '../tutorial.js'
import { enableToggle, svg, levelBlock } from '../dom.js'
import { journey } from '../../engine/journey.js'
import store from '../../state/store.js'

export function renderTeam(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  const level = store.level
  const open = renderTeam.open || (renderTeam.open = new Set())
  if (open.size === 0 && s.team[0]) open.add(s.team[0].id)

  const add = () => {
    const m = newTeamMember({ role: s.team.length === 0 ? 'Fondateur' : 'Nouveau poste' })
    store.update((sc) => sc.team.push(m), { label: "Ajout d'un poste" })
    open.add(m.id)
    refresh()
  }

  const jeiActive = r?.jei?.some((j) => j.eligible)

  return h('div', { class: 'content' },
    stepBanner('equipe', journey(store.scenario, store.result), navigate),

    s.team.length > 0 && h('div', { class: 'list-head' },
      h('div', {},
        h('h2', {}, s.team.length > 1 ? `Vos ${s.team.length} postes` : 'Votre équipe'),
        h('div', { class: 'tiny muted' }, r
          ? `${euro(yearly(r.payroll.cost)[0])} de masse salariale la première année, avantages compris`
          : 'Vous compris, si vous vous rémunérez'),
      ),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn btn-primary btn-sm', onClick: add }, '＋ Ajouter un poste'),
    ),

    s.team.length === 0
      ? h('div', { class: 'card' }, h('div', { class: 'empty' },
          h('div', { class: 'empty-icon' }, '◷'),
          h('h3', {}, 'Aucun poste'),
          h('p', { class: 'muted' }, "Ajoutez les personnes de l'équipe, y compris les fondateurs rémunérés."),
          h('button', { class: 'btn btn-primary mt', onClick: add }, 'Ajouter un premier poste'),
        ))
      : h('div', {}, ...s.team.map((m, i) => memberCard(m, i, r, level, open, refresh, jeiActive))),

    r && s.team.length > 0 && payrollSummary(r, level),
    level === 'advanced' && s.team.length > 0 && levelBlock('advanced', null, jeiPanel(r)),

    tutorial('equipe', navigate),
  )
}

/**
 * Une silhouette par poste.
 *
 * Une liste de lignes de texte fait oublier qu'il s'agit de personnes — et
 * qu'embaucher est la décision la plus lourde et la plus difficile à défaire
 * d'un business plan. La couleur distingue le statut ; le nombre se lit sur le
 * jeton quand le poste est dupliqué.
 */
function personGlyph(m, count) {
  const type = m.contractType || 'cdi'
  return h('span', { class: `who who-${type}`, title: (CONTRACT_TYPES[type] || {}).label || '' },
    svg('svg', { viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': 'true' },
      svg('circle', { cx: 12, cy: 8, r: 3.6, fill: 'currentColor' }),
      svg('path', { d: 'M4.6 20.5c0-4.1 3.3-6.6 7.4-6.6s7.4 2.5 7.4 6.6z', fill: 'currentColor' }),
    ),
    count > 1 ? h('span', { class: 'who-count num' }, String(count)) : null,
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

  const on = m.enabled !== false
  return h('div', { class: `item ${isOpen ? 'open' : ''} ${on ? '' : 'is-off'}` },
    h('div', { class: 'item-head', onClick: () => { isOpen ? open.delete(m.id) : open.add(m.id); refresh() } },
      personGlyph(m, count),
      enableToggle(on, (v) => {
        store.update((sc) => { const t = sc.team.find((x) => x.id === m.id); if (t) t.enabled = v },
          { label: v ? 'Poste réactivé' : 'Poste en pause' })
        refresh()
      }),
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

      level === 'advanced' && costBreakdown(cost, count, m),

      level === 'advanced' && benefitsPanel(m, set, headcount),

      level === 'advanced' && ['cdi', 'cdd'].includes(m.contractType) && levelBlock('advanced', null,
        h('h4', { style: { margin: '0 0 4px', display: 'flex', gap: '6px', alignItems: 'center' } }, "Recherche et innovation", helpButton('cir')),
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
  // Le détail ligne à ligne est une vérification, pas une lecture courante :
  // il reste disponible, replié, et seulement au niveau expert.
  const open = costBreakdown.open || (costBreakdown.open = new Set())
  const id = member.id
  const details = h('details', { class: 'fold', open: open.has(id) || null },
    h('summary', { class: 'fold-summary' },
      h('span', { class: 'fold-title' }, 'Du brut au coût réel'),
      h('span', { class: 'fold-hint' }, `${euro(cost.gross)} brut → ${euro(cost.cost)} pour l'entreprise → ${euro(cost.net)} net`),
    ),
    h('div', { class: 'fold-body' },
      count > 1 && h('div', { class: 'row', style: { marginBottom: '8px' } },
        h('span', { class: 'spacer' }),
        h('span', { class: 'chip' }, 'montants pour 1 personne'),
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
  details.addEventListener('toggle', () => { details.open ? open.add(id) : open.delete(id) })
  return details
}

/**
 * Ce que le salarié reçoit en plus de son salaire.
 *
 * Deux lignes ne sont pas négociables — la mutuelle collective et la moitié de
 * l'abonnement de transport — et sont pourtant absentes de la plupart des
 * prévisionnels. Les autres sont des leviers d'attractivité : à coût égal, un
 * avantage exonéré vaut environ deux fois une augmentation de salaire.
 */
function benefitsPanel(m, set, headcount) {
  const chosen = m.benefits || {}
  const applies = (key) => {
    const def = BENEFITS[key]
    return !def.contracts || def.contracts.includes(m.contractType)
  }
  const keys = Object.keys(BENEFITS).filter(applies)
  if (keys.length === 0) return null

  const setBenefit = (key, value) =>
    set({ benefits: { ...chosen, [key]: Math.max(0, Number(value) || 0) } }, 'Avantages salariés')

  const total = keys.reduce((a, k) => a + (Number(chosen[k]) || 0), 0)
  const missing = keys.filter((k) => BENEFITS[k].legal && !(Number(chosen[k]) > 0))

  return levelBlock('advanced', null, h('div', { class: 'perks' },
    h('div', { class: 'perks-head' },
      h('h4', {}, 'Ce que reçoit la personne en plus du salaire'),
      h('span', { class: 'spacer' }),
      h('span', { class: 'tiny muted' }, 'coût employeur mensuel'),
    ),
    h('div', { class: 'perk-list' }, ...keys.map((key) => {
      const def = BENEFITS[key]
      const amount = Number(chosen[key]) || 0
      const on = amount > 0
      return h('div', { class: `perk ${on ? 'on' : ''} ${def.legal ? 'is-legal' : ''}` },
        enableToggle(on, (v) => setBenefit(key, v ? def.suggested : 0)),
        h('div', { class: 'spacer' },
          h('div', { class: 'perk-name' }, def.label,
            h('span', { class: `chip ${def.legal ? 'chip-warn' : ''}` }, def.short)),
          h('div', { class: 'perk-help' }, def.help),
        ),
        h('div', { class: 'perk-amount' },
          on
            ? (() => {
                const input = h('input', {
                  class: 'perk-input num', type: 'number', min: '0', step: '5', value: String(amount),
                  onInput: (e) => setBenefit(key, e.target.value),
                  onClick: (e) => e.stopPropagation(),
                })
                return h('label', { class: 'perk-box' }, input, h('span', {}, '€'))
              })()
            : h('button', { class: 'btn btn-sm btn-ghost', onClick: () => setBenefit(key, def.suggested) }, `+ ${euro(def.suggested)}`),
        ),
      )
    })),
    h('div', { class: 'perk-total' },
      h('span', {}, 'Total des avantages'),
      h('span', { class: 'spacer' }),
      h('span', { class: 'num' }, `${euro(total)} / mois`),
      h('span', { class: 'tiny muted' }, `soit ${euro(total * 12)} par an`),
    ),
    headcount >= 11 && (Number(chosen.mutuelle) || 0) > 0 && h('div', { class: 'note mt' },
      h('div', { class: 'note-title' }, 'Forfait social'),
      "À partir de onze salariés, la part patronale de mutuelle et de prévoyance supporte un forfait social de 8 %. Fynomia l'ajoute automatiquement au coût du poste."),
    missing.length > 0 && h('div', { class: 'note warn mt' },
      h('div', { class: 'note-title' }, 'Une obligation manque à l’appel'),
      `${missing.map((k) => BENEFITS[k].label).join(' et ')} : ce n’est pas un avantage que vous choisissez d’accorder, c’est une dépense que vous aurez. La laisser à zéro rend le plan optimiste de ${euro(missing.reduce((a, k) => a + BENEFITS[k].suggested, 0) * 12)} par an et par personne.`),
  ))
}

function payrollSummary(r, level) {
  const p = r.payroll
  const grossY = yearly(p.gross), costY = yearly(p.cost), chargesY = yearly(p.employerCharges)
  const benY = yearly(p.benefits || new Array(60).fill(0))
  return h('div', { class: 'card mt' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Masse salariale'), h('span', { class: 'spacer' }),
      h('span', { class: 'tiny muted' }, `${num(p.headcount[11])} personnes fin d'année 1 · ${num(p.headcount[59])} fin d'année 5`)),
    h('div', { class: 'card-body' },
      barChart({
        categories: YEAR_CATEGORIES,
        series: [
          { label: 'Salaires bruts', values: grossY, color: PALETTE[0] },
          { label: 'Cotisations patronales', values: chargesY, color: PALETTE[2] },
          ...(benY.some((v) => v > 0) ? [{ label: 'Avantages salariés', values: benY, color: PALETTE[4] || PALETTE[1] }] : []),
        ],
      }),
      h('div', { class: 'table-wrap mt' },
        h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, ''), ...YEAR_CATEGORIES.map((c, i) => h('th', {}, `Année ${i + 1}`)))),
          h('tbody', {},
            h('tr', {}, h('td', {}, 'Salaires bruts'), ...grossY.map((v) => h('td', { class: 'num' }, euro(v)))),
            h('tr', {}, h('td', {}, 'Cotisations patronales'), ...chargesY.map((v) => h('td', { class: 'num' }, euro(v)))),
            ...(benY.some((v) => v > 0) ? [h('tr', {}, h('td', {}, 'Avantages (mutuelle, transport, titres‑restaurant…)'), ...benY.map((v) => h('td', { class: 'num' }, euro(v))))] : []),
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

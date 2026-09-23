/**
 * Équipe.
 *
 * Trois sujets, pas un de plus : qui travaille ici, ce que ça coûte, ce que
 * l'entreprise accorde à tout le monde. Ils se rangent sur une ligne d'onglets
 * plutôt que de s'empiler, et la saisie se fait en brut annuel — c'est ainsi
 * qu'un salaire se négocie et se compare.
 */

import { h, euro, pct, num, numberField, textField, selectField, switchField, monthField, helpButton, confirmDialog, toast, monthLabel, moduleShell, foldSign } from '../dom.js'
import { newTeamMember } from '../../state/schema.js'
import { monthlyCost, CONTRACT_TYPES, STATUSES, BENEFITS } from '../../engine/payroll.js'
import { barChart, PALETTE, YEAR_CATEGORIES, A_PLAT } from '../charts.js'
import { tutorial, stepGuide } from '../tutorial.js'
import { enableToggle, svg, tabs, fold, unitAmount } from '../dom.js'
import { journey } from '../../engine/journey.js'
import { todoPanel } from '../todo.js'
import { claim } from '../spotlight.js'
import store from '../../state/store.js'
import { celebrate } from '../burst.js'
import { gardePage } from '../garde.js'
import { chiffresDePage, partieTravail } from '../chiffres-pages.js'
import { gardeSalaire } from '../../engine/plausible.js'

/** Un salaire se dit à l'année ; le modèle, lui, raisonne au mois. */
const PAY_UNITS = [
  { key: 'year', label: '€ / an', title: 'Brut annuel', toDisplay: (v) => (Number(v) || 0) * 12, fromDisplay: (v) => v / 12 },
  { key: 'month', label: '€ / mois', title: 'Brut mensuel', toDisplay: (v) => Number(v) || 0, fromDisplay: (v) => v },
]
const payUnit = () => renderTeam.unit || (renderTeam.unit = 'year')

export function renderTeam(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  const level = store.level
  const jeiActive = r?.jei?.some((j) => j.eligible)

  const add = (e) => {
    let depuis = null
    try { depuis = e?.currentTarget?.getBoundingClientRect() || null } catch { depuis = null }
    const m = newTeamMember({ role: s.team.length === 0 ? 'Fondateur' : 'Nouveau poste' })
    store.update((sc) => sc.team.push(m), { label: "Ajout d'un poste" })
    renderTeam.openId = m.id
    renderTeam.view = 'postes'
    refresh()
    if (depuis) celebrate(depuis, { kind: 'team', label: m.role, cible: `[data-row="${m.id}"]` })
  }

  const perks = Object.values(store.scenario.hr?.benefits || {}).filter((v) => Number(v) > 0).length
  const views = [
    { key: 'postes', label: 'Équipe', count: s.team.length },
    { key: 'avantages', label: 'Avantages', count: perks },
    r && s.team.length > 0 ? { key: 'masse', read: true, label: 'Masse salariale' } : null,
    s.team.length > 0 ? { key: 'jei', read: true, label: 'Recherche et JEI' } : null,
  ]
  const want = claim('equipe')
  if (want && want.view) renderTeam.view = want.view
  const view = views.some((v) => v && v.key === renderTeam.view) ? renderTeam.view : 'postes'
  renderTeam.view = view

  const payrollY = r ? yearly(r.payroll.cost)[0] : 0

  // Les chiffres de la page d'abord, la zone de travail ensuite (partie 02).
  const chiffres = chiffresDePage('equipe', refresh, navigate, { forme: 'cartes' })

  return h('div', { class: 'content' },

    moduleShell({
      no: '04', title: 'Équipe',
      lede: "Les postes salariés, leur brut annuel et ce qu’ils coûtent vraiment.",
      figure: r && s.team.length
        ? { value: euro(payrollY), note: 'la première année, avantages compris' }
        : null,
      guide: stepGuide('equipe', journey(store.scenario, store.result)),
      views, view, onPick: (k) => { renderTeam.view = k; refresh() },
      actions: [view === 'postes' ? h('button', { class: 'btn btn-primary btn-sm', onClick: add }, '＋ Ajouter un poste') : null],
    }),
    chiffres ? null : gardePage('equipe', navigate),
    chiffres,
    partieTravail('equipe', view, !!chiffres),

    view === 'postes' ? h('div', { class: 'view', 'data-gap': 'equipe' },
      s.team.length === 0
        ? h('div', { class: 'card' }, h('div', { class: 'empty' },
            h('div', { class: 'empty-icon' }, '◷'),
            h('h3', {}, 'Aucun poste'),
            h('p', { class: 'muted' }, "Ajoute les personnes de l'équipe, y compris les fondateurs rémunérés."),
            h('button', { class: 'btn btn-primary mt', onClick: add }, 'Ajouter un premier poste'),
          ))
        : h('div', {}, ...s.team.map((m, i) => memberCard(m, i, r, level, refresh, jeiActive))),
    ) : null,

    view === 'avantages' ? h('div', { class: 'view', 'data-gap': 'avantages' }, benefitsPanel(r, refresh)) : null,
    // « Du brut au coût réel » ne se modifiait pas : c'était un onglet de
    // lecture posé au milieu de trois onglets de saisie, sur chaque fiche de
    // poste. Il rejoint la masse salariale, le seul endroit de la page où l'on
    // vient pour lire — et il y détaille chaque poste, l'un sous l'autre.
    view === 'masse' && r ? h('div', { class: 'view' },
      payrollSummary(r, level),
      s.team.length ? h('section', { class: 'card mt' },
        h('div', { class: 'card-head' },
          h('h2', {}, 'Du brut au coût réel'),
          h('div', { class: 'tiny muted' }, 'Ce que chaque poste ajoute au brut, ligne par ligne'),
        ),
        h('div', { class: 'card-body' },
          ...s.team.map((mb) => {
            const hc = r?.payroll.headcount[Number(mb.startMonth) || 0] || 1
            let c = null
            try {
              c = monthlyCost(mb, {
                headcount: hc, jeiActive: jeiActive && (Number(mb.rdShare) || 0) > 0,
                fiscal: s.fiscal, benefits: s.hr?.benefits,
              })
            } catch { return null }
            return h('div', { class: 'costblock' },
              h('div', { class: 'costblock-name' }, mb.role || 'Poste sans nom'),
              costBreakdown(c, Number(mb.count) || 1, mb),
            )
          }).filter(Boolean),
        ),
      ) : null,
    ) : null,
    view === 'jei' && r ? h('div', { class: 'view' }, jeiPanel(r)) : null,

    todoPanel('equipe', store.scenario, navigate),

    tutorial('equipe', navigate),
  )
}

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

/**
 * Un poste.
 *
 * L'entête dit tout ce qu'on vient vérifier : qui, quel contrat, combien ça
 * coûte. Ouvert, le poste ne déroule plus quatre grilles à la suite : ses
 * sujets se rangent sur une ligne d'onglets, et seuls ceux qui existent
 * vraiment pour ce contrat et ce niveau de détail s'y trouvent.
 */
function memberCard(m, index, r, level, refresh, jeiActive) {
  const isOpen = renderTeam.openId === m.id
  const set = (patch, label = 'Modification du poste', opts = {}) =>
    store.update((sc) => Object.assign(sc.team.find((x) => x.id === m.id), patch), { label, ...opts })

  const headcount = r?.payroll.headcount[Number(m.startMonth) || 0] || 1
  const cost = monthlyCost(m, {
    headcount, jeiActive: jeiActive && (Number(m.rdShare) || 0) > 0,
    fiscal: store.scenario.fiscal, benefits: store.scenario.hr?.benefits,
  })
  const count = Number(m.count) || 1
  const contract = CONTRACT_TYPES[m.contractType] || CONTRACT_TYPES.cdi
  const unit = payUnit()
  const annual = unit === 'year'

  const remove = async () => {
    if (await confirmDialog({ title: 'Supprimer ce poste ?', message: `« ${m.role} » sera retiré du modèle.`, confirmLabel: 'Supprimer', danger: true })) {
      store.update((sc) => { sc.team = sc.team.filter((x) => x.id !== m.id) }, { label: 'Suppression du poste' })
      refresh()
    }
  }

  const payLabel = m.contractType === 'tns' ? 'Rémunération'
    : m.contractType === 'freelance' ? 'Facturation'
      : m.contractType === 'stage' ? 'Gratification' : 'Salaire brut'

  const sections = [
    { key: 'poste', label: 'Le poste' },
    { key: 'dates', label: 'Dates et effectif' },
    ['cdi', 'cdd'].includes(m.contractType) ? { key: 'rd', label: 'Recherche' } : null,
  ]
  const sec = sections.some((x) => x && x.key === memberCard.sec) ? memberCard.sec : 'poste'

  const on = m.enabled !== false
  return h('div', { class: `item ${isOpen ? 'open' : ''} ${on ? '' : 'is-off'}`, 'data-row': m.id },
    h('div', { class: 'item-head', onClick: () => { renderTeam.openId = isOpen ? null : m.id; refresh() } },
      personGlyph(m, count),
      enableToggle(on, (v) => {
        store.update((sc) => { const t = sc.team.find((x) => x.id === m.id); if (t) t.enabled = v },
          { label: v ? 'Poste réactivé' : 'Poste en pause' })
        refresh()
      }, `poste-${m.id}`),
      h('div', { class: 'spacer' },
        h('div', { class: 'item-title' }, m.role || 'Poste sans nom', count > 1 ? h('span', { class: 'chip', style: { marginLeft: '7px' } }, `× ${count}`) : null),
        h('div', { class: 'item-meta' },
          `${contract.label} · ${euro((Number(m.monthlyGross) || 0) * 12)} brut/an · dès ${monthLabel(m.startMonth || 0, r?.startDate)}`),
      ),
      h('div', { class: 'right', style: { marginRight: '10px' } },
        h('div', { class: 'small num', style: { fontWeight: '650' } }, euro(cost.cost * count * 12)),
        h('div', { class: 'tiny muted' }, 'coût annuel'),
      ),
      foldSign(),
    ),

    isOpen && h('div', { class: 'item-body' },
      tabs(sections, sec, (k) => { memberCard.sec = k; refresh() }),

      sec === 'poste' ? h('div', { class: 'view' }, (() => {
        // Le coût se recalcule sous les doigts.
        //
        // Le salaire s'enregistrait « en silence » — le modèle était à jour,
        // l'écran ne l'apprenait jamais. On tapait 50 000 € et on lisait le
        // coût de 3 000 €, sans rien pour signaler l'écart. C'est le défaut le
        // plus grave qu'on puisse avoir dans un outil de chiffrage : il donne
        // un chiffre faux avec l'assurance d'un chiffre juste.
        //
        // Le silence reste — un redessin complet à chaque caractère ferait
        // perdre le curseur — mais les trois nombres qui dépendent du salaire
        // sont réécrits à la main, à chaque frappe. Pas de rendu, pas de perte
        // de focus, et le chiffre est toujours celui qu'on vient de taper.
        const coutValue = h('strong', { class: 'num' }, `${euro(cost.cost * 12)} / an`)
        const netValue = h('strong', { class: 'num' }, `${euro((m.contractType === 'tns' ? cost.gross : cost.net) * 12)} / an`)
        const plural = h('div', { class: 'paycard-note' },
          count > 1 ? `Pour ${count} personnes : ${euro(cost.cost * count * 12)} par an.` : '')

        const relire = (brut) => {
          const vivant = { ...m, monthlyGross: brut }
          let neuf
          try {
            neuf = monthlyCost(vivant, {
              headcount, jeiActive: jeiActive && (Number(m.rdShare) || 0) > 0,
              fiscal: store.scenario.fiscal, benefits: store.scenario.hr?.benefits,
            })
          } catch { return }
          coutValue.textContent = `${euro(neuf.cost * 12)} / an`
          netValue.textContent = `${euro((m.contractType === 'tns' ? neuf.gross : neuf.net) * 12)} / an`
          plural.textContent = count > 1 ? `Pour ${count} personnes : ${euro(neuf.cost * count * 12)} par an.` : ''
        }

        const champSalaire = unitAmount({
          label: `${payLabel} — ${annual ? 'brut annuel' : 'brut mensuel'}`,
          value: m.monthlyGross, units: PAY_UNITS, unit, help: 'superBrut',
          onUnit: (k) => { renderTeam.unit = k; refresh() },
          onInput: (v) => { set({ monthlyGross: v }, undefined, { silent: true }); relire(v) },
          garde: (v) => gardeSalaire(v * 12, m.contractType),
        })

        return [
          // Tout ce qui décrit le poste sur une ligne ; ce qu'il coûte dessous.
          // Le résultat rejoint la ligne de saisie.
          //
          // Il vivait sur un bandeau en dessous : on posait un salaire, puis on
          // baissait les yeux pour lire ce qu'il coûte. Les deux choses sont la
          // même question — ce que je paie, ce que ça pèse — et elles tiennent
          // sur une ligne dès lors que le contrat et le statut cessent d'occuper
          // un quart de largeur chacun pour afficher deux mots.
          (() => {
            const statut = ['cdi', 'cdd'].includes(m.contractType) ? selectField({
              label: 'Statut', value: m.status,
              options: Object.entries(STATUSES).map(([k, v]) => ({ value: k, label: v.label })),
              onInput: (v) => set({ status: v }),
            }) : null
            return h('div', { class: `postline ${statut ? '' : 'is-short'}` },
              textField({ label: 'Intitulé du poste', value: m.role, onInput: (v, o) => set({ role: v }, undefined, o) }),
              selectField({
                label: 'Type de contrat', value: m.contractType,
                options: Object.entries(CONTRACT_TYPES).map(([k, v]) => ({ value: k, label: v.label })),
                onInput: (v) => set({ contractType: v }),
              }),
              statut,
              champSalaire,
              h('div', { class: 'postresult' },
                h('span', { class: 'postresult-label' }, "Coût pour l’entreprise"),
                coutValue,
                h('span', { class: 'postresult-net' },
                  m.contractType === 'tns' ? 'Perçu avant impôt' : 'Net avant impôt', ' ', netValue),
              ),
            )
          })(),
          plural,
        ]
      })()) : null,

      sec === 'dates' ? h('div', { class: 'view' },
        h('div', { class: 'grid grid-3' },
          numberField({ label: 'Nombre de personnes', field: 'count', value: m.count, suffix: 'pers.', hint: 'Un même poste dupliqué.', onInput: (v) => set({ count: v }) }),
          monthField({ label: "Mois d'arrivée", value: m.startMonth, startDate: r?.startDate, onInput: (v) => set({ startMonth: v }) }),
          monthField({ label: 'Mois de départ', value: m.endMonth, startDate: r?.startDate, allowEmpty: true, onInput: (v) => set({ endMonth: v }) }),
        ),
      ) : null,

      sec === 'rd' ? h('div', { class: 'view' },
        h('p', { class: 'view-intro' },
          "Part du temps de travail consacrée à des travaux éligibles. Ces pourcentages alimentent le crédit d'impôt recherche, le crédit d'impôt innovation et l'éligibilité au statut JEI.",
          helpButton('cir')),
        h('div', { class: 'grid grid-3' },
          numberField({ label: 'Temps en recherche (CIR)', field: 'rdShare', value: m.rdShare, percent: true, onInput: (v) => set({ rdShare: v }) }),
          numberField({ label: 'Temps en innovation (CII)', field: 'rdShare', value: m.innovShare, percent: true, onInput: (v) => set({ innovShare: v }) }),
          switchField({ label: 'Jeune docteur', checked: m.youngDoctor, hint: 'Dépenses comptées double pendant 24 mois.', onInput: (v) => set({ youngDoctor: v }) }),
        ),
      ) : null,

      h('div', { class: 'view-foot' },
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
        `Ton entreprise remplit les conditions du statut Jeune entreprise innovante et ce poste est affecté à la recherche.`),
    ),
  )
  details.addEventListener('toggle', () => { details.open ? open.add(id) : open.delete(id) })
  return details
}

/**
 * La politique d'avantages, une fois pour toute l'entreprise.
 *
 * On ne négocie pas une mutuelle poste par poste : on la met en place, et tout
 * le monde en bénéficie. Deux lignes ne sont d'ailleurs pas négociables — la
 * complémentaire santé et la moitié de l'abonnement de transport — et sont
 * pourtant absentes de la plupart des prévisionnels.
 */
function benefitsPanel(r, refresh) {
  const chosen = store.scenario.hr?.benefits || {}
  const salaried = (store.scenario.team || [])
    .filter((m) => m.enabled !== false && !['tns', 'freelance'].includes(m.contractType))
  const heads = salaried.reduce((a, m) => a + (Number(m.count) || 1), 0)

  const setBenefit = (key, value) =>
    store.update((sc) => {
      sc.hr = sc.hr || {}
      sc.hr.benefits = { ...(sc.hr.benefits || {}), [key]: Math.max(0, Number(value) || 0) }
    }, { label: 'Avantages salariés' })

  const perHead = Object.keys(BENEFITS).reduce((a, k) => a + (Number(chosen[k]) || 0), 0)
  const missing = Object.entries(BENEFITS).filter(([k, d]) => d.legal && !(Number(chosen[k]) > 0))

  return h('div', {},
    h('div', { class: 'policy-top' },
      h('div', {},
        h('div', { class: 'policy-figure num' }, euro(perHead)),
        h('div', { class: 'policy-label' }, 'par salarié et par mois'),
      ),
      h('div', {},
        h('div', { class: 'policy-figure num' }, euro(perHead * heads * 12)),
        h('div', { class: 'policy-label' }, `coût annuel pour ${heads || 0} salarié${heads > 1 ? 's' : ''}`),
      ),
      h('p', { class: 'policy-note' },
        "Ces avantages s'appliquent à tous les salariés — pas aux dirigeants non salariés ni aux prestataires. À coût égal, un avantage exonéré vaut environ deux fois une augmentation de salaire."),
    ),

    h('div', { class: 'perk-list' }, ...Object.entries(BENEFITS).map(([key, def]) => {
      const amount = Number(chosen[key]) || 0
      const on = amount > 0
      return h('div', { class: `perk ${on ? 'on' : ''} ${def.legal ? 'is-legal' : ''}` },
        enableToggle(on, (v) => { setBenefit(key, v ? def.suggested : 0); refresh() }, `perk-${key}`),
        h('div', { class: 'spacer' },
          h('div', { class: 'perk-name' }, def.label,
            h('span', { class: `chip ${def.legal ? 'chip-warn' : 'chip-quiet'}` }, def.short)),
          h('div', { class: 'perk-help' }, def.help, def.only ? ` Ne concerne que : ${def.only}.` : ''),
        ),
        h('div', { class: 'perk-amount' },
          on
            ? h('label', { class: 'perk-box' },
                h('input', {
                  class: 'perk-input num', type: 'number', min: '0', step: '5', value: String(amount),
                  onInput: (e) => setBenefit(key, e.target.value),
                }),
                h('span', {}, '€'))
            : h('button', { class: 'btn btn-sm btn-ghost', onClick: () => { setBenefit(key, def.suggested); refresh() } }, `+ ${euro(def.suggested)}`),
        ),
      )
    })),

    heads >= 11 && (Number(chosen.mutuelle) || 0) > 0 ? h('div', { class: 'note mt' },
      h('div', { class: 'note-title' }, 'Forfait social'),
      "À partir de onze salariés, la part patronale de mutuelle et de prévoyance supporte un forfait social de 8 %. Fynomia l'ajoute automatiquement au coût de chaque poste.") : null,

    missing.length > 0 ? h('div', { class: 'note warn mt' },
      h('div', { class: 'note-title' }, 'Une obligation manque à l’appel'),
      `${missing.map(([, d]) => d.label).join(' et ')} : ce n’est pas un avantage que tu choisis d’accorder, c’est une dépense que tu auras. La laisser à zéro rend le plan optimiste de ${euro(missing.reduce((a, [, d]) => a + d.suggested, 0) * 12 * Math.max(1, heads))} par an.`) : null,
  )
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
        ...A_PLAT,
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

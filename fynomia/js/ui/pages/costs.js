/** Charges externes et investissements. */

import { h, euro, pct, num, numberField, textField, selectField, switchField, monthField, helpButton, confirmDialog, tabs, moduleShell } from '../dom.js'
import { newOpex, newCapex } from '../../state/schema.js'
import { OPEX_TEMPLATES } from '../../engine/engine.js'
import { donut, barChart, PALETTE, YEAR_CATEGORIES } from '../charts.js'
import { tutorial, stepGuide } from '../tutorial.js'
import { enableToggle } from '../dom.js'
import { journey } from '../../engine/journey.js'
import { todoPanel } from '../todo.js'
import { claim } from '../spotlight.js'
import { tradeSuggest } from '../trade-suggest.js'
import { pop } from '../spotlight.js'
import store from '../../state/store.js'

export function renderCosts(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  const level = store.level

  const addFromTemplate = (tpl) => {
    store.update((sc) => sc.opex.push(newOpex({ label: tpl.label, mode: tpl.mode, monthlyAmount: tpl.monthlyAmount, perEmployee: tpl.perEmployee || 0, pctRevenue: tpl.pctRevenue || 0 })), { label: 'Ajout de charge' })
    refresh()
  }
  const addCustom = () => {
    store.update((sc) => sc.opex.push(newOpex()), { label: 'Ajout de charge' })
    refresh()
  }
  const addAllSuggested = () => {
    store.update((sc) => {
      for (const tpl of OPEX_TEMPLATES) {
        if (sc.opex.some((o) => o.label === tpl.label)) continue
        sc.opex.push(newOpex({ label: tpl.label, mode: tpl.mode, monthlyAmount: tpl.monthlyAmount, perEmployee: tpl.perEmployee || 0, pctRevenue: tpl.pctRevenue || 0 }))
      }
    }, { label: 'Charges courantes' })
    refresh()
  }

  const missing = OPEX_TEMPLATES.filter((t) => !s.opex.some((o) => o.label === t.label))

  const views = [
    { key: 'charges', label: 'Charges', count: s.opex.length },
    { key: 'invest', label: 'Investissements', count: s.capex.length },
    r && s.opex.length > 0 ? { key: 'repartition', read: true, label: 'Répartition' } : null,
  ]
  const want = claim('achats')
  if (want && want.view) renderCosts.view = want.view
  const view = views.some((v) => v && v.key === renderCosts.view) ? renderCosts.view : 'charges'
  renderCosts.view = view

  const addCapex = () => { store.update((sc) => sc.capex.push(newCapex({ enabled: true })), { label: "Ajout d'investissement" }); refresh() }
  const monthlyTotal = s.opex.filter((o) => o.enabled !== false).reduce((a, o) => a + (Number(o.monthlyAmount) || 0), 0)

  return h('div', { class: 'content' },

    moduleShell({
      no: '03', title: 'Achats et coûts',
      lede: "Les charges qui tombent chaque mois, et le matériel amorti sur sa durée d’usage.",
      figure: monthlyTotal > 0
        ? { value: `${euro(monthlyTotal)}/mois`, note: `soit ${euro(monthlyTotal * 12)} par an` }
        : null,
      guide: stepGuide('charges', journey(store.scenario, store.result), 'achats'),
      views, view, onPick: (k) => { renderCosts.view = k; refresh() },
      actions: [
        view === 'charges' ? h('button', { class: 'btn btn-primary btn-sm', onClick: addCustom }, '＋ Ajouter une charge') : null,
        view === 'invest' ? h('button', { class: 'btn btn-primary btn-sm', onClick: addCapex }, '＋ Ajouter un investissement') : null,
      ],
    }),

    view === 'charges' ? h('div', { class: 'view' },
      // Les suggestions du métier ouvrent la vue, comme dans Offre et revenus :
      // ce sont des lignes qu'on prend ou qu'on laisse avant de dérouler tout
      // ce qu'on a déjà posé, pas une note de bas de page.
      tradeSuggest('opex', navigate, refresh)
        || (missing.length > 0 ? h('div', { class: 'suggest', 'data-gap': 'oublis' },
            h('span', { class: 'suggest-tag' }, 'Souvent oublié'),
            ...missing.slice(0, 6).map((t) => h('button', { class: 'suggest-chip', onClick: (e) => { pop(e.currentTarget); addFromTemplate(t) } }, `＋ ${t.label}`)),
          ) : null),

      s.opex.length === 0
        ? h('div', { class: 'card', 'data-gap': 'charges' }, h('div', { class: 'empty' },
            h('div', { class: 'empty-icon' }, '▦'),
            h('h3', {}, 'Aucune charge saisie'),
            h('p', { class: 'muted', style: { maxWidth: '54ch', margin: '0 auto 4px' } },
              "Fynomia propose une liste de charges courantes calibrée sur des jeunes entreprises françaises. Ajoute-les d'un clic, puis ajuste les montants."),
            h('button', { class: 'btn btn-primary mt', onClick: addAllSuggested }, `Ajouter les ${OPEX_TEMPLATES.length} charges courantes`),
          ))
        : h('div', { 'data-gap': 'charges' },
            // Deux natures de charges, et les mélanger fait perdre le fil.
            //
            // Le loyer tombe qu'on vende ou non ; la commission d'une plateforme
            // n'existe que s'il y a une vente. La première fixe le nombre de
            // clients qu'il te faut, la seconde rogne la marge de chacun — ce
            // ne sont pas les mêmes questions, et on les range à part.
            ...costBlocks(s, r, level, refresh)),
    ) : null,

    view === 'invest' ? h('div', { class: 'view', 'data-gap': 'capex' },
      tradeSuggest('capex', navigate, refresh),
      capexSection(s, r, level, refresh),
    ) : null,

    view === 'repartition' && r ? h('div', { class: 'view' },
      h('div', { class: 'board-pair' },
        h('div', { class: 'card' },
          h('div', { class: 'card-head' }, h('h2', {}, 'Répartition des charges'), h('span', { class: 'spacer' }), h('span', { class: 'tiny muted' }, 'Année 1')),
          h('div', { class: 'card-body' },
            donut({ items: r.opex.perItem.map((i, idx) => ({ label: i.label, value: i.yearly[0], color: PALETTE[idx % PALETTE.length] })) }),
          ),
        ),
        h('div', { class: 'card' },
          h('div', { class: 'card-head' }, h('h2', {}, 'Évolution')),
          h('div', { class: 'card-body' },
            barChart({ categories: YEAR_CATEGORIES, series: [{ label: 'Charges externes', values: r.opex.yearly, color: PALETTE[2] }] }),
            h('div', { class: 'note plain mt' },
              `Ces charges représentent ${pct(r.pnl.revenue[0] > 0 ? r.opex.yearly[0] / r.pnl.revenue[0] : 0, 0)} du chiffre d'affaires en année 1. Combinées à la masse salariale, elles fixent ton point mort à ${r.kpis.breakEven[0] ? euro(r.kpis.breakEven[0]) : '—'}.`),
          ),
        ),
      ),
    ) : null,

    todoPanel('achats', store.scenario, navigate),

    tutorial('charges', navigate),
  )
}

/**
 * Sur quelles offres porte cette charge.
 *
 * Un menu déroulant n'acceptait qu'une réponse : il fallait dupliquer le
 * carton d'expédition pour l'offre A et pour l'offre B, et le pain à burger
 * autant de fois qu'il entre dans un plat. Des pastilles acceptaient tout le
 * monde, mais une par offre sur une ligne déjà pleine : à quatre offres, la
 * ligne de charge ne parlait plus que de ça.
 *
 * Un bouton, donc, qui dit l'état en trois mots — « Toutes les offres »,
 * « Menu du midi », « 3 offres » — et ouvre la liste à cocher. On coche
 * plusieurs cases sans que le menu se referme, puisque c'est tout l'intérêt.
 */
function scopePicker(o, set, refresh) {
  const offres = store.scenario.activities || []
  const ids = Array.isArray(o.activityIds) && o.activityIds.length
    ? o.activityIds
    : (o.activityId ? [o.activityId] : [])
  const ouverts = scopePicker.ouverts || (scopePicker.ouverts = new Set())

  const nom = (id) => offres.find((a) => a.id === id)?.name || 'Sans nom'
  const resume = ids.length === 0 ? 'Toutes les offres'
    : ids.length === 1 ? nom(ids[0])
      : `${ids.length} offres`

  const poser = (liste) => {
    // La liste fait foi ; l'ancien champ reste écrit pour qu'une version
    // antérieure du logiciel lise la même chose.
    set({ activityIds: liste, activityId: liste.length === 1 ? liste[0] : null })
    refresh()
  }

  const ligne = (texte, coche, aller) => h('button', {
    class: `scopepick-row ${coche ? 'on' : ''}`, type: 'button',
    onClick: (e) => { e.stopPropagation(); aller() },
  },
    h('span', { class: 'scopepick-box', 'aria-hidden': 'true' }, coche ? '\u2713' : ''),
    h('span', { class: 'scopepick-name' }, texte),
  )

  const d = h('details', { class: 'scopepick', open: ouverts.has(o.id) || null },
    h('summary', { class: 'scopepick-sum', title: 'Offres concernées par cette charge' },
      h('span', { class: 'scopepick-text' }, resume),
      h('span', { class: 'scopepick-chev', 'aria-hidden': 'true' }, '\u203A'),
    ),
    h('div', { class: 'scopepick-menu' },
      ligne('Toutes les offres', ids.length === 0, () => poser([])),
      ...offres.map((a) => ligne(a.name || 'Sans nom', ids.includes(a.id),
        () => poser(ids.includes(a.id) ? ids.filter((x) => x !== a.id) : [...ids, a.id]))),
    ),
  )
  d.addEventListener('toggle', () => { d.open ? ouverts.add(o.id) : ouverts.delete(o.id) })
  return d
}

/**
 * Une charge, sur une ligne.
 *
 * Chaque poste occupait une carte entière avec quatre champs déployés : dix
 * charges, et la page devenait un rouleau. Une charge, c'est un nom et un
 * montant — le reste (mode de calcul, dates, R&D) se déplie à la demande, et
 * la plupart du temps on n'en a pas besoin.
 */
function opexRow(o, r, level, refresh) {
  const set = (patch, opts = {}) => store.update((sc) => Object.assign(sc.opex.find((x) => x.id === o.id), patch), { label: 'Modification de charge', ...opts })
  const detail = r?.opex.perItem.find((x) => x.id === o.id)
  const on = o.enabled !== false
  const open = opexRow.open || (opexRow.open = new Set())
  const isOpen = open.has(o.id)
  const annual = opexRow.annual || (opexRow.annual = new Set())
  const yearly = annual.has(o.id)

  const remove = async () => {
    if (await confirmDialog({ title: 'Supprimer cette charge ?', message: `« ${o.label} » sera retirée.`, confirmLabel: 'Supprimer', danger: true })) {
      store.update((sc) => { sc.opex = sc.opex.filter((x) => x.id !== o.id) }, { label: 'Suppression de charge' })
      refresh()
    }
  }

  return h('div', { class: `cost-row ${on ? '' : 'is-off'} ${isOpen ? 'open' : ''}`, 'data-row': o.id },
    h('div', { class: 'cost-line' },
      enableToggle(on, (v) => { set({ enabled: v }, { label: v ? 'Charge réactivée' : 'Charge en pause' }); refresh() }, `opex-${o.id}`),

      h('input', {
        class: 'cost-label', value: o.label, 'aria-label': 'Nom de la charge',
        onInput: (e) => set({ label: e.target.value }, { silent: true }),
      }),

      // Le montant et son unité se lisent et se changent sur la ligne. Cacher
      // « par an » ou « % du CA » derrière trois points obligeait à ouvrir
      // chaque charge pour savoir ce qu'on regardait.
      h('div', { class: 'cost-amount' },
        h('input', {
          class: 'num', inputmode: 'decimal',
          value: yearly ? String(Math.round((Number(o.monthlyAmount) || 0) * 12) || '') : String(o.monthlyAmount ?? ''),
          'aria-label': yearly ? 'Montant annuel' : 'Montant mensuel',
          onInput: (e) => {
            const v = Number(e.target.value.replace(',', '.')) || 0
            set({ monthlyAmount: yearly ? v / 12 : v }, { silent: true })
          },
        }),
        h('button', {
          class: 'cost-unit', title: yearly ? 'Saisir un montant mensuel' : 'Saisir un montant annuel',
          onClick: () => { yearly ? annual.delete(o.id) : annual.add(o.id); refresh() },
        }, yearly ? '€/an' : '€/mois'),
      ),

      h('div', { class: 'cost-mode' },
        (() => {
          const sel = h('select', { 'aria-label': 'Mode de calcul' },
            ...[
              { value: 'fixed', label: 'montant fixe' },
              { value: 'perEmployee', label: '+ par salarié' },
              { value: 'pctRevenue', label: '+ % des ventes' },
              { value: 'perUnit', label: '+ par unité vendue' },
            ].map((opt) => h('option', { value: opt.value, selected: o.mode === opt.value || null }, opt.label)),
          )
          sel.addEventListener('change', () => { set({ mode: sel.value }); refresh() })
          return sel
        })(),
      ),

      o.mode === 'perEmployee' ? h('div', { class: 'cost-extra' },
        h('input', {
          class: 'num', inputmode: 'decimal', value: String(o.perEmployee ?? ''), 'aria-label': 'Montant par salarié',
          onInput: (e) => set({ perEmployee: Number(e.target.value.replace(',', '.')) || 0 }, { silent: true }),
        }),
        h('span', {}, '€/sal.'),
      ) : null,

      o.mode === 'pctRevenue' ? h('div', { class: 'cost-extra' },
        h('input', {
          class: 'num', inputmode: 'decimal', value: String(Math.round((Number(o.pctRevenue) || 0) * 1000) / 10), 'aria-label': 'Part des ventes',
          onInput: (e) => set({ pctRevenue: (Number(e.target.value.replace(',', '.')) || 0) / 100 }, { silent: true }),
        }),
        h('span', {}, '%'),
      ) : null,

      o.mode === 'perUnit' ? h('div', { class: 'cost-extra' },
        h('input', {
          class: 'num', inputmode: 'decimal', value: String(o.perUnit ?? ''), 'aria-label': 'Montant par unité vendue',
          onInput: (e) => set({ perUnit: Number(e.target.value.replace(',', '.')) || 0 }, { silent: true }),
        }),
        h('span', {}, '€/unité'),
      ) : null,

      // Sur quelle offre ? Une commission de 1 % ne porte pas forcément sur
      // tout ce qu'on vend : elle porte sur la glace, pas sur le café servi au
      // comptoir. Le sélecteur n'apparaît que pour les charges indexées.
      ['pctRevenue', 'perUnit'].includes(o.mode) && store.scenario.activities.length
        ? scopePicker(o, set, refresh)
        : null,

      detail ? h('span', { class: 'cost-year num' }, `${euro(detail.yearly[0], { compact: true })}/an`) : null,

      h('button', {
        class: 'cost-more', title: 'Dates et recherche',
        onClick: () => { isOpen ? open.delete(o.id) : open.add(o.id); refresh() },
      }, '\u22EF'),
      h('button', {
        class: 'cost-more cost-drop', title: 'Supprimer cette charge', onClick: remove,
      }, '\u00d7'),
    ),

    isOpen && h('div', { class: 'cost-detail' },
      h('div', { class: 'grid grid-3' },
        monthField({ label: 'À partir de', value: o.startMonth, startDate: r?.startDate, onInput: (v) => set({ startMonth: v }) }),
        monthField({ label: "Jusqu'à", value: o.endMonth, startDate: r?.startDate, allowEmpty: true, onInput: (v) => set({ endMonth: v }) }),
      ),
      h('div', { class: 'row-wrap mt' },
        level === 'advanced' && h('label', { class: 'switch' },
          (() => { const i = h('input', { type: 'checkbox', checked: !!o.rdApproved }); i.addEventListener('change', () => set({ rdApproved: i.checked })); return i })(),
          h('span', { class: 'track' }),
          h('span', { class: 'small' }, 'Dépense de recherche (CIR)'),
        ),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn-sm btn-danger', onClick: remove }, 'Supprimer'),
      ),
    ),
  )
}


function capexSection(s, r, level, refresh) {
  if (level === 'easy' && s.capex.length === 0) {
    return h('div', { class: 'note plain mt' },
      h('div', { class: 'note-title' }, 'Investissements'),
      "Passe en niveau Intermédiaire pour ajouter du matériel, des aménagements ou du crédit-bail, et suivre leur amortissement.")
  }
  return h('div', {},
    s.capex.length === 0
      ? h('p', { class: 'view-intro' }, "Aucun investissement. La trésorerie sort en une fois, le résultat est impacté progressivement par l'amortissement.")
      : null,
    ...s.capex.map((c) => capexRow(c, r, level, refresh)),

    r && s.capex.length > 0 && h('div', { class: 'card mt' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Amortissements'), helpButton('ebit')),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Investissement'), h('th', {}, 'Montant'), h('th', {}, 'Acquisition'), ...YEAR_CATEGORIES.map((c, i) => h('th', {}, `A${i + 1}`)))),
          h('tbody', {},
            ...r.capex.perItem.filter((i) => i.amount > 0).map((i) => h('tr', {},
              h('td', {}, i.label),
              h('td', { class: 'num' }, euro(i.amount)),
              h('td', { class: 'num muted' }, `M${i.month + 1}`),
              ...i.yearly.map((v) => h('td', { class: 'num' }, v > 0 ? euro(v) : '—')),
            )),
            h('tr', { class: 'total' },
              h('td', {}, 'Dotation totale'), h('td', {}, ''), h('td', {}, ''),
              ...r.capex.yearly.map((v) => h('td', { class: 'num' }, euro(v))),
            ),
          ),
        ),
      ),
    ),
  )
}

function capexRow(c, r, level, refresh) {
  const set = (patch, opts = {}) => store.update((sc) => Object.assign(sc.capex.find((x) => x.id === c.id), patch), { label: 'Modification investissement', ...opts })
  const remove = async () => {
    if (await confirmDialog({ title: 'Supprimer cet investissement ?', message: `« ${c.label} » sera retiré.`, confirmLabel: 'Supprimer', danger: true })) {
      store.update((sc) => { sc.capex = sc.capex.filter((x) => x.id !== c.id) }, { label: 'Suppression' })
      refresh()
    }
  }
  // Un investissement s'allume avant de compter.
  //
  // Une liste de matériel déjà cochée engage la trésorerie de quelqu'un qui
  // n'a encore rien décidé : cinquante mille euros sortent au premier mois
  // parce qu'une suggestion de métier a été ajoutée. Éteint, l'investissement
  // reste dans la liste, se lit d'une ligne, et ne pèse ni sur le compte ni
  // sur l'amortissement. Allumé, il s'ouvre et compte — comme la JEI.
  const on = c.enabled !== false
  const bascule = (v) => { set({ enabled: v }, { label: v ? 'Investissement retenu' : 'Investissement écarté' }); refresh() }

  return h('div', { class: `card capexcard ${on ? 'is-on' : ''}`, style: { marginBottom: '9px' }, 'data-row': c.id },
    h('div', { class: 'capexcard-head' },
      enableToggle(on, bascule, `capex-${c.id}`),
      h('div', { class: 'spacer' },
        h('div', { class: 'capexcard-name' }, c.label || 'Investissement'),
        h('div', { class: 'capexcard-sub' }, on
          ? `${euro(c.amount)} au mois ${(Number(c.month) || 0) + 1}${Number(c.amortYears) > 0 ? ` · amorti sur ${c.amortYears} ans` : ' · non amortissable'}`
          : `${euro(c.amount)} — écarté, ne compte pas dans le plan`),
      ),
    ),
    on ? h('div', { class: 'card-body tight' },
      // Les cadres de saisie s'alignent, pas les cellules.
      //
      // En alignant les cellules par le bas, le champ « Amortissement » — seul
      // à porter une aide sous son cadre — remontait de vingt-deux pixels.
      // Les cellules s'étirent donc à la même hauteur, l'aide occupe le bas, et
      // les quatre cadres se posent sur la même ligne.
      h('div', { class: 'grid grid-fields', style: { gridTemplateColumns: 'minmax(150px,2fr) repeat(3, minmax(110px,1fr)) auto', gap: '10px' } },
        textField({ label: 'Intitulé', value: c.label, onInput: (v, opt) => set({ label: v }, opt) }),
        numberField({ label: 'Montant', field: 'amount', value: c.amount, suffix: '€ HT', onInput: (v) => set({ amount: v }) }),
        monthField({ label: "Mois d'achat", value: c.month, startDate: r?.startDate, onInput: (v) => set({ month: v }) }),
        numberField({ label: 'Amortissement', field: 'amortYears', value: c.amortYears, suffix: 'ans', hint: '0 = non amortissable', onInput: (v) => set({ amortYears: v }) }),
        // Le bouton prend la place d'un champ, libellé vide compris : c'est ce
        // qui le pose sur la ligne des cadres et non sous eux.
        h('div', { class: 'field' },
          h('label', { 'aria-hidden': 'true' }, '\u00a0'),
          h('button', { class: 'btn btn-sm btn-danger', onClick: remove }, 'Retirer'),
        ),
      ),
      level === 'advanced' && h('div', { class: 'grid grid-4 grid-fields mt' },
        switchField({ label: 'Crédit-bail', checked: c.leasing, hint: "Loyer en charges plutôt qu'immobilisation.", onInput: (v) => set({ leasing: v }) }),
        c.leasing && numberField({ label: 'Loyer mensuel', field: 'monthlyAmount', value: c.leaseMonthly, suffix: '€/mois', onInput: (v) => set({ leaseMonthly: v }) }),
        c.leasing && numberField({ label: 'Durée du bail', field: 'months', value: c.leaseMonths, suffix: 'mois', onInput: (v) => set({ leaseMonths: v }) }),
        !c.leasing && numberField({ label: 'Usage en recherche', field: 'rdShare', value: c.rdShare, percent: true, hint: "Compte dans l'assiette du CIR.", onInput: (v) => set({ rdShare: v }) }),
        !c.leasing && switchField({ label: 'Apport en nature', checked: c.contribution, hint: 'Apporté au capital, sans sortie de trésorerie.', onInput: (v) => set({ contribution: v }) }),
      ),
      c.amortYears > 0 && !c.leasing && h('div', { class: 'tiny muted', style: { marginTop: '8px' } },
        `Soit ${euro((Number(c.amount) || 0) / (Number(c.amortYears) * 12))} de charge par mois pendant ${c.amortYears} an${c.amortYears > 1 ? 's' : ''}, alors que la trésorerie sort intégralement au mois ${(Number(c.month) || 0) + 1}.`),
    ) : null,
  )
}

/**
 * Les charges en deux blocs : ce qui tombe, et ce qui suit les ventes.
 *
 * Un fondateur qui a déjà saisi un coût de revient dans son offre le remet
 * souvent ici, en charge. Le bloc « par vente » porte donc l'avertissement à
 * l'endroit exact où l'erreur se commet.
 */
function costBlocks(s, r, level, refresh) {
  const fixed = s.opex.filter((o) => !o.mode || o.mode === 'fixed' || o.mode === 'perEmployee')
  const variable = s.opex.filter((o) => ['perUnit', 'pctRevenue'].includes(o.mode))
  const block = (title, note, rows, tone = '') => rows.length
    ? h('section', { class: `costblock ${tone}` },
        h('header', { class: 'costblock-head' },
          h('div', { class: 'costblock-title' }, title),
          h('div', { class: 'costblock-note' }, note),
          h('span', { class: 'costblock-count num' }, `${rows.length}`),
        ),
        ...rows.map((o) => opexRow(o, r, level, refresh)),
      )
    : null
  return [
    block('Charges générales', 'Elles tombent chaque mois, que tu vendes ou non. Ce sont elles qui fixent le nombre de clients qu’il te faut.', fixed),
    block('Charges par vente', 'Elles n’existent que s’il y a une vente : commissions, emballage, matière. Si tu as déjà saisi un coût de revient sur ton offre, ne le remets pas ici — il serait compté deux fois.', variable, 'is-variable'),
  ].filter(Boolean)
}

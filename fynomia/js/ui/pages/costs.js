/** Charges externes et investissements. */

import { h, euro, pct, num, numberField, textField, switchField, monthField, helpButton, confirmDialog, moduleShell, saisieDifferee, lireNombre } from '../dom.js'
import { newOpex, newCapex } from '../../state/schema.js'
import { OPEX_TEMPLATES } from '../../engine/engine.js'
import { donut, barChart, PALETTE, YEAR_CATEGORIES } from '../charts.js'
import { tutorial } from '../tutorial.js'
import { enableToggle } from '../dom.js'
import { todoPanel } from '../todo.js'
import { claim, goToGap } from '../spotlight.js'
import { tradeSuggest } from '../trade-suggest.js'
import { celebrate } from '../burst.js'
import store from '../../state/store.js'
import { gardePage, gardeLigne } from '../garde.js'
import { chiffresDePage } from '../chiffres-pages.js'
import { memoire } from '../memoire.js'
import { uniteOffre } from '../../state/sectors.js'

export function renderCosts(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  const level = store.level

  // Chaque ajout se voit comme une suggestion acceptée : des icônes
  // jaillissent du bouton, une pastille cochée rejoint la ligne créée, et la
  // ligne s'éclaire en arrivant. Le bouton est mesuré avant le rendu qui va
  // le remplacer.
  const ajout = (e, id, label, kind = 'opex') => {
    let depuis = null
    try { depuis = e?.currentTarget?.getBoundingClientRect() || null } catch { depuis = null }
    refresh()
    if (depuis) celebrate(depuis, { kind, label, cible: id ? `[data-row="${id}"]` : null })
  }
  const addFromTemplate = (tpl, e) => {
    const o = newOpex(depuisModele(tpl))
    store.update((sc) => sc.opex.push(o), { label: 'Ajout de charge' })
    ajout(e, o.id, tpl.label)
  }
  const addCustom = (e) => {
    // Une charge à soi n'a encore ni nom ni montant juste : elle s'ouvre
    // directement, prête à être renseignée.
    const o = newOpex()
    ;(opexRow.open || (opexRow.open = new Set())).add(o.id)
    store.update((sc) => sc.opex.push(o), { label: 'Ajout de charge' })
    ajout(e, o.id, o.label)
  }
  const addAllSuggested = (e) => {
    let premier = null, n = 0
    store.update((sc) => {
      for (const tpl of OPEX_TEMPLATES) {
        if (sc.opex.some((o) => o.label === tpl.label)) continue
        const o = newOpex(depuisModele(tpl))
        if (!premier) premier = o.id
        n++
        sc.opex.push(o)
      }
    }, { label: 'Charges courantes' })
    ajout(e, premier, `${n} charge${n > 1 ? 's' : ''} courante${n > 1 ? 's' : ''}`)
  }

  const missing = OPEX_TEMPLATES.filter((t) => !s.opex.some((o) => o.label === t.label))

  const views = [
    { key: 'charges', label: 'Charges', count: s.opex.length },
    { key: 'invest', label: 'Investissements', count: s.capex.length },
    r && s.opex.length > 0 ? { key: 'repartition', read: true, label: 'Répartition' } : null,
  ]
  const want = claim('achats')
  if (want && want.view) memoire.achats.view = want.view
  const view = views.some((v) => v && v.key === memoire.achats.view) ? memoire.achats.view : 'charges'
  memoire.achats.view = view

  const addCapex = (e) => {
    const c = newCapex({ enabled: true })
    store.update((sc) => sc.capex.push(c), { label: "Ajout d'investissement" })
    ajout(e, c.id, c.label || 'Nouvel investissement', 'capex')
  }
  const monthlyTotal = s.opex.filter((o) => o.enabled !== false).reduce((a, o) => a + (Number(o.monthlyAmount) || 0), 0)

  // Les chiffres de la page d'abord, en une ligne ; la zone de travail ensuite.
  const chiffres = chiffresDePage('achats', refresh, navigate)

  return h('div', { class: 'content' },

    moduleShell({
      no: '03', title: 'Achats et coûts',
      figure: !chiffres && monthlyTotal > 0
        ? { value: `${euro(monthlyTotal)}/mois`, note: `soit ${euro(monthlyTotal * 12)} par an` }
        : null,
      views, view, onPick: (k) => { memoire.achats.view = k; refresh() },
      actions: [
        view === 'charges' ? h('button', { class: 'btn btn-primary btn-sm', onClick: addCustom }, '＋ Ajouter une charge') : null,
        view === 'invest' ? h('button', { class: 'btn btn-primary btn-sm', onClick: addCapex }, '＋ Ajouter un investissement') : null,
      ],
    }),
    chiffres || gardePage('achats', navigate),

    view === 'charges' ? h('div', { class: 'view' },
      // Les suggestions du métier ouvrent la vue, comme dans Offre et revenus :
      // ce sont des lignes qu'on prend ou qu'on laisse avant de dérouler tout
      // ce qu'on a déjà posé, pas une note de bas de page.
      tradeSuggest('opex', navigate, refresh)
        || (missing.length > 0 ? h('div', { class: 'suggest', 'data-gap': 'oublis' },
            h('span', { class: 'suggest-tag' }, 'Souvent oublié'),
            ...missing.slice(0, 6).map((t) => h('button', { class: 'suggest-chip', onClick: (e) => addFromTemplate(t, e) }, `＋ ${t.label}`)),
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
            ...costBlocks(s, r, level, refresh, navigate)),
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
            donut({ items: r.opex.perItem.map((i, idx) => ({ label: i.label, value: i.yearly[0], color: PALETTE[idx % PALETTE.length] })), size: 132 }),
          ),
        ),
        h('div', { class: 'card' },
          h('div', { class: 'card-head' }, h('h2', {}, 'Évolution')),
          h('div', { class: 'card-body' },
            // Les charges générales et les charges par vente, séparées comme
            // dans le compte de résultat : les unes fixent le point mort, les
            // autres suivent les ventes et entament la marge.
            barChart({ categories: YEAR_CATEGORIES, series: [
              { label: 'Charges générales', values: r.opex.fixeY, color: PALETTE[2] },
              ...(r.opex.variableY.some((v) => v) ? [{ label: 'Charges par vente', values: r.opex.variableY, color: PALETTE[4] }] : []),
            ], height: 160 }),
            h('div', { class: 'note plain mt' },
              `Les charges générales représentent ${pct(r.pnl.revenue[0] > 0 ? r.opex.fixeY[0] / r.pnl.revenue[0] : 0, 0)} du chiffre d'affaires en année 1. Avec la masse salariale, elles fixent ton point mort à ${r.kpis.breakEven[0] ? euro(r.kpis.breakEven[0]) : '—'}.${r.opex.variableY[0] ? ` Les charges par vente, ${euro(r.opex.variableY[0])} en année 1, sont comptées dans le coût de ce que tu vends.` : ''}`),
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

  const d = h('details', { class: 'scopepick', 'data-ferme-dehors': '', open: ouverts.has(o.id) || null },
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
  // Un clic ailleurs la referme (voir dom.js) ; et l'on oublie qu'elle était
  // ouverte, pour qu'elle ne se rouvre pas au prochain rendu.
  d.fermer = () => ouverts.delete(o.id)
  return d
}

/** Les deux façons de chiffrer une charge par vente — et seulement elles. */
const PAR_VENTE = ['pctRevenue', 'perUnit']
const estParVente = (o) => PAR_VENTE.includes(o.mode)

/**
 * Une charge proposée, prête à entrer dans le plan.
 *
 * Une charge par vente n'a pas de montant mensuel fixe : elle est un
 * pourcentage du prix, ou un montant par produit vendu. Le modèle d'une
 * commission de paiement portait un forfait mensuel en plus de son
 * pourcentage — c'était une charge fixe et une charge variable dans la même
 * ligne, et le forfait ne se voyait nulle part.
 */
function depuisModele(tpl) {
  const parVente = PAR_VENTE.includes(tpl.mode)
  return {
    label: tpl.label, mode: tpl.mode,
    monthlyAmount: parVente ? 0 : tpl.monthlyAmount,
    perEmployee: tpl.perEmployee || 0, pctRevenue: tpl.pctRevenue || 0, perUnit: tpl.perUnit || 0,
  }
}

/**
 * Une charge par vente : deux choix, pas quatre.
 *
 * Elle n'existe que s'il y a une vente. Elle se chiffre donc soit en part du
 * prix — une commission de 1,5 % —, soit en montant fixe par produit vendu —
 * un emballage à 0,15 €. Un montant par mois ou par salarié n'a pas de sens
 * ici : c'est une charge générale, elle vit dans le bloc du dessus.
 */
function modeParVente(o, set, refresh) {
  const choisir = (mode) => {
    if (mode === o.mode) return
    set({ mode, monthlyAmount: 0 })
    refresh()
  }
  return h('div', { class: 'cost-seg', role: 'radiogroup', 'aria-label': 'Comment se chiffre cette charge' },
    ...[
      { mode: 'pctRevenue', label: '% du prix' },
      { mode: 'perUnit', label: '€ par produit vendu' },
    ].map((x) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(o.mode === x.mode),
      class: `cost-seg-opt ${o.mode === x.mode ? 'is-on' : ''}`,
      onClick: () => choisir(x.mode),
    }, x.label)),
  )
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

  const parVente = estParVente(o)
  // Un montant de charge s'écrit une seconde après la dernière frappe, comme
  // tout nombre du plan ; son effet sur le résultat s'affiche sous la ligne.
  const montant = (attrs, ecrire) => {
    const input = h('input', { class: 'num', inputmode: 'decimal', autocomplete: 'off', ...attrs })
    let dernier = input.value
    saisieDifferee(input, (texte) => {
      if (texte === dernier) return
      const v = lireNombre(texte)
      if (Number.isNaN(v)) return
      dernier = texte
      ecrire(v === '' ? 0 : v)
    })
    return input
  }
  return h('div', { class: `cost-row ${on ? '' : 'is-off'} ${isOpen ? 'open' : ''} ${parVente ? 'is-par-vente' : ''}`, 'data-row': o.id, 'data-effet': 'charge' },
    h('div', { class: 'cost-line', 'data-effet-ancre': '' },
      enableToggle(on, (v) => { set({ enabled: v }, { label: v ? 'Charge réactivée' : 'Charge en pause' }); refresh() }, `opex-${o.id}`),

      h('input', {
        class: 'cost-label', value: o.label, 'aria-label': 'Nom de la charge',
        onInput: (e) => set({ label: e.target.value }, { silent: true }),
      }),

      // Le montant et son unité se lisent et se changent sur la ligne. Cacher
      // « par an » ou « % du CA » derrière trois points obligeait à ouvrir
      // chaque charge pour savoir ce qu'on regardait. Une charge par vente
      // n'a pas de montant mensuel : elle se chiffre au prix ou à l'unité.
      parVente ? modeParVente(o, set, refresh) : h('div', { class: 'cost-amount' },
        montant({
          value: yearly ? String(Math.round((Number(o.monthlyAmount) || 0) * 12) || '') : String(o.monthlyAmount ?? ''),
          'aria-label': yearly ? 'Montant annuel' : 'Montant mensuel',
        }, (v) => set({ monthlyAmount: yearly ? v / 12 : v })),
        h('button', {
          class: 'cost-unit', title: yearly ? 'Saisir un montant mensuel' : 'Saisir un montant annuel',
          onClick: () => { yearly ? annual.delete(o.id) : annual.add(o.id); refresh() },
        }, yearly ? '€/an' : '€/mois'),
      ),

      // Une charge générale : un montant fixe, ou un montant par salarié. La
      // passer « par vente » l'envoie dans le bloc du dessous, sans forfait
      // mensuel caché.
      parVente ? null : h('div', { class: 'cost-mode' },
        (() => {
          const sel = h('select', { 'aria-label': 'Mode de calcul' },
            ...[
              { value: 'fixed', label: 'montant fixe' },
              { value: 'perEmployee', label: '+ par salarié' },
              { value: 'pctRevenue', label: 'par vente : % du prix' },
              { value: 'perUnit', label: 'par vente : € par produit' },
            ].map((opt) => h('option', { value: opt.value, selected: o.mode === opt.value || null }, opt.label)),
          )
          sel.addEventListener('change', () => {
            set(PAR_VENTE.includes(sel.value) ? { mode: sel.value, monthlyAmount: 0 } : { mode: sel.value })
            refresh()
          })
          return sel
        })(),
      ),

      o.mode === 'perEmployee' ? h('div', { class: 'cost-extra' },
        montant({ value: String(o.perEmployee ?? ''), 'aria-label': 'Montant par salarié' },
          (v) => set({ perEmployee: v })),
        h('span', {}, '€/sal.'),
      ) : null,

      o.mode === 'pctRevenue' ? h('div', { class: 'cost-extra' },
        montant({ value: String(Math.round((Number(o.pctRevenue) || 0) * 1000) / 10), 'aria-label': 'Part des ventes' },
          (v) => set({ pctRevenue: v / 100 })),
        h('span', {}, '% du prix'),
      ) : null,

      o.mode === 'perUnit' ? h('div', { class: 'cost-extra' },
        montant({ value: String(o.perUnit ?? ''), 'aria-label': 'Montant par unité vendue' },
          (v) => set({ perUnit: v })),
        h('span', {}, '€ / produit'),
      ) : null,

      // Un forfait mensuel resté d'une ancienne saisie : il compte encore, il
      // se voit donc, et se retire d'un clic.
      parVente && (Number(o.monthlyAmount) || 0) > 0 ? h('button', {
        class: 'cost-forfait', type: 'button', title: 'Retirer ce forfait mensuel',
        onClick: () => { set({ monthlyAmount: 0 }); refresh() },
      }, `+ ${euro(Number(o.monthlyAmount))}/mois fixes ×`) : null,

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
    // Une charge hors de proportion se dit sur sa ligne : c'est là qu'on
    // corrige, ou qu'on valide si le montant est voulu.
    on ? gardeLigne(`charge:${o.id}`) : null,

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
        parVente ? h('button', { class: 'btn btn-sm', onClick: () => { set({ mode: 'fixed' }); refresh() } }, 'En faire une charge générale') : null,
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
 * Le coût de revient d'une offre, en tête des charges par vente.
 *
 * L'offre affichait un coût de revient qu'aucun écran ne permettait de
 * modifier : il avait quitté le prix, et le lien disait de le régler « dans
 * les charges par vente », où il n'était pas. Chaque offre vendue a donc ici
 * sa ligne, à côté des commissions et des emballages qui s'y ajoutent, et
 * l'offre lit le total.
 */
function coutRevientRow(s, a) {
  const n = (v) => Number(v) || 0
  const rec = n(a.recurringPrice) > 0
  const champ = rec ? 'recurringCost' : 'unitCost'
  const unite = uniteOffre(s, a)
  const input = h('input', {
    class: 'num', inputmode: 'decimal', autocomplete: 'off', value: n(a[champ]) ? String(n(a[champ])).replace('.', ',') : '',
    placeholder: '0', 'aria-label': `Coût de revient — ${a.name || 'offre'}`,
  })
  let dernier = input.value
  saisieDifferee(input, (texte) => {
    if (texte === dernier) return
    const v = lireNombre(texte)
    if (Number.isNaN(v)) return
    dernier = texte
    store.update((sc) => { const t = sc.activities.find((x) => x.id === a.id); if (t) t[champ] = v === '' ? 0 : Math.max(0, v) }, { label: 'Coût de revient' })
  })
  return h('div', { class: 'cost-row is-par-vente is-revient', 'data-row': `revient-${a.id}`, 'data-effet': 'revient' },
    h('div', { class: 'cost-line', 'data-effet-ancre': '' },
      h('span', { class: 'cost-revient-tag' }, 'Coût de revient'),
      h('span', { class: 'cost-label is-fixe' }, a.name || 'Offre'),
      h('div', { class: 'cost-amount' }, input, h('span', { class: 'cost-unit is-static' }, rec ? '€ / abonné / mois' : `€ par ${unite.one}`)),
    ),
  )
}

/**
 * Une campagne marketing, lue ici, réglée dans Acquisition.
 *
 * Son budget est une charge comme une autre : il pèse sur le résultat et sort
 * de la trésorerie. Il se lit donc avec les charges générales — sinon leur
 * total ne correspondrait pas aux charges externes du bandeau — mais il se
 * règle avec la campagne, là où l'on voit les clients qu'il apporte.
 */
function campagneRow(c, navigate) {
  const debut = Number(c.startMonth) || 0
  const duree = Math.max(1, Number(c.durationMonths) || 1)
  return h('div', { class: 'cost-row is-campagne', 'data-row': `campagne-${c.id}` },
    h('div', { class: 'cost-line' },
      h('span', { class: 'cost-revient-tag' }, 'Campagne'),
      h('span', { class: 'cost-label is-fixe' }, c.name || 'Campagne marketing'),
      h('div', { class: 'cost-amount' },
        h('b', { class: 'num cost-fige' }, euro(Number(c.monthlyBudget) || 0)),
        h('span', { class: 'cost-unit is-static' }, `€/mois · M${debut + 1}–M${Math.min(60, debut + duree)}`)),
      h('button', { class: 'cost-lien', type: 'button', onClick: () => goToGap({ route: 'offre', view: 'acquisition' }, navigate) }, 'Régler dans Acquisition →'),
    ),
  )
}

/**
 * Les charges en deux blocs : ce qui tombe, et ce qui suit les ventes.
 *
 * Le bloc « par vente » s'ouvre sur le coût de revient de chaque offre ; les
 * commissions, emballages et matières qui s'y ajoutent suivent. Le tout
 * forme le coût d'une vente, que l'offre affiche et que la marge brute
 * retranche.
 */
function costBlocks(s, r, level, refresh, navigate) {
  const fixed = s.opex.filter((o) => !o.mode || o.mode === 'fixed' || o.mode === 'perEmployee')
  const variable = s.opex.filter((o) => ['perUnit', 'pctRevenue'].includes(o.mode))
  const vendues = (s.activities || []).filter((a) => (Number(a.unitPrice) > 0 || Number(a.recurringPrice) > 0) && !(Number(a.commissionRate) > 0 && Number(a.dealValue) > 0))
  const block = (title, note, rows, tone = '', tete = [], queue = []) => rows.length || tete.length || queue.length
    ? h('section', { class: `costblock ${tone}` },
        h('header', { class: 'costblock-head' },
          h('div', { class: 'costblock-title' }, title),
          h('div', { class: 'costblock-note' }, note),
          h('span', { class: 'costblock-count num' }, `${rows.length + tete.length + queue.length}`),
        ),
        ...tete,
        ...rows.map((o) => opexRow(o, r, level, refresh)),
        ...queue,
      )
    : null
  return [
    block('Charges générales', 'Elles tombent chaque mois, que tu vendes ou non. Ce sont elles qui fixent le nombre de clients qu’il te faut.', fixed, '', [],
      (s.marketing || []).filter((c) => c.enabled !== false && Number(c.monthlyBudget) > 0).map((c) => campagneRow(c, navigate))),
    block('Charges par vente', 'Elles n’existent que s’il y a une vente. En tête, le coût de revient de chaque offre — ce que tu achètes ou produis pour la livrer ; dessous, ce qui s’y ajoute : commissions, emballages. Ne mets pas deux fois le même coût.', variable, 'is-variable', vendues.map((a) => coutRevientRow(s, a))),
  ].filter(Boolean)
}

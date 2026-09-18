/**
 * Module 01 — Projet.
 *
 * Le cadre, et rien d'autre. Quelques paramètres structurants suffisent à
 * adapter tout le reste : le métier fixe le vocabulaire, la TVA et les repères
 * de marge ; la forme juridique décide du statut social et donc du coût de la
 * rémunération ; le type de client commande les cycles de vente et les délais
 * de paiement.
 *
 * Ce qui relève du réglage fin — régime d'imposition, statut JEI, date de
 * clôture — n'a pas disparu : il est derrière « affiner », et n'apparaît que
 * pour qui le cherche.
 */

import { h, euro, num, textField, selectField, switchField, helpButton, refine, moduleHead } from '../dom.js'
import { SECTORS, sectorsByFamily, getSector, FAMILIES } from '../../state/sectors.js'
import { LEGAL_FORMS } from '../../state/schema.js'
import { partBanner } from '../tutorial.js'
import { todoPanel } from '../todo.js'
import store from '../../state/store.js'

/** Les clients type : ils ne payent pas au même rythme. */
const CLIENTS = [
  { key: 'b2b', name: 'Entreprises', note: 'Cycles longs, paiement à 30 ou 60 jours' },
  { key: 'b2c', name: 'Particuliers', note: 'Cycles courts, paiement comptant' },
  { key: 'b2b2c', name: 'B2B2C', note: 'Tu vends à une entreprise qui distribue' },
]

export function renderProject(navigate, refresh) {
  const s = store.scenario
  const sector = getSector(s.meta.sectorKey)
  const set = (patch, label = 'Cadrage du projet', opts = {}) =>
    store.update((sc) => Object.assign(sc.meta, patch), { label, ...opts })

  return h('div', { class: 'content' },
    moduleHead('01', 'Mon projet',
      "Ce qui cadre le mod\u00e8le avant tout chiffrage : le m\u00e9tier, le client, le calendrier, la forme juridique."),

    partBanner('projet'),

    h('section', { class: 'slab' },
      h('div', { class: 'slab-head' },
        h('div', {},
          h('div', { class: 'slab-title' }, 'Le projet'),
          h('div', { class: 'slab-sub' }, 'On garde uniquement les éléments qui vont conditionner le modèle.'),
        ),
        h('div', { class: 'slab-tags' },
          h('span', { class: 'slab-tag' }, 'Structure'),
          h('span', { class: 'slab-tag' }, 'Parcours'),
        ),
      ),
      h('div', { class: 'grid grid-2' },
        textField({
          label: 'Nom du projet', value: s.meta.company || s.meta.name,
          placeholder: 'Ton projet',
          onInput: (v, o) => set({ company: v, name: v || 'Mon business plan' }, undefined, o),
        }),
        (() => {
          const input = h('input', { type: 'date', value: s.meta.startDate })
          input.addEventListener('change', () => set({ startDate: input.value }, 'Date de démarrage'))
          return h('div', { class: 'field' },
            h('label', {}, "Début d’activité"),
            h('div', { class: 'control' }, input),
            h('div', { class: 'field-hint' }, 'Décale tout le calendrier : volumes, salaires, échéances.'),
          )
        })(),
      ),

      h('div', { class: 'mt' }, sectorPicks(s, set, refresh)),

      refine('projet-cloture', 'Affiner le calendrier',
        h('div', { class: 'grid grid-2' },
          selectField({
            label: 'Mois de clôture', value: String(s.meta.fiscalYearEnd ?? 12),
            options: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
              .map((m, i) => ({ value: String(i + 1), label: m })),
            hint: "Décembre dans la plupart des cas. Un exercice décalé change la date des impôts, pas les montants.",
            onInput: (v) => set({ fiscalYearEnd: Number(v) }, 'Clôture'),
          }),
        ),
      ),
    ),

    h('div', { class: 'slab-pair' },
    h('section', { class: 'slab' },
      h('div', { class: 'slab-head' },
        h('div', {},
          h('div', { class: 'slab-title' }, 'Décris ce que tu vends'),
          h('div', { class: 'slab-sub' }, "Cette phrase alimentera la partie narrative du dossier, pas les calculs."),
        ),
        h('div', { class: 'slab-tags' }, h('span', { class: 'slab-tag' }, 'Document')),
      ),
      (() => {
        const ta = h('textarea', { rows: 3, placeholder: 'Ex. Une plateforme qui…' }, s.meta.pitch || '')
        ta.value = s.meta.pitch || ''
        ta.addEventListener('input', () => set({ pitch: ta.value }, 'Description', { silent: true }))
        return h('div', { class: 'control' }, ta)
      })(),
      h('div', { class: 'note plain mt' },
        h('div', { class: 'note-title' }, 'Pas de génération magique'),
        "Fynomia garde le fond que tu saisis. Une mise en forme viendra ensuite dans le dossier, mais le modèle financier ne dépend d’aucun texte."),
    ),
    h('section', { class: 'slab' },
      h('div', { class: 'slab-head' },
        h('div', {},
          h('div', { class: 'slab-title' }, 'Le client'),
          h('div', { class: 'slab-sub' }, "B2B et B2C n’impliquent pas les mêmes cycles de vente ni les mêmes flux."),
        ),
        h('div', { class: 'slab-tags' },
          h('span', { class: 'slab-tag' }, 'Revenus'),
          h('span', { class: 'slab-tag' }, 'BFR'),
        ),
      ),
      h('div', { class: 'picks' },
        ...CLIENTS.map((c) => h('button', {
          class: `pick ${(s.meta.clientType || 'b2b') === c.key ? 'active' : ''}`,
          onClick: () => { set({ clientType: c.key }, 'Type de client'); refresh() },
        },
          h('div', { class: 'pick-name' }, c.name),
          h('div', { class: 'pick-note' }, c.note),
        )),
      ),
    ),
    ),

    h('section', { class: 'slab' },
      h('div', { class: 'slab-head' },
        h('div', {},
          h('div', { class: 'slab-title' }, 'Le cadre juridique et fiscal'),
          h('div', { class: 'slab-sub' }, "C’est lui qui décide de ton statut social, donc du coût de ta rémunération."),
        ),
        h('div', { class: 'slab-tags' },
          h('span', { class: 'slab-tag' }, 'Statut'),
          h('span', { class: 'slab-tag' }, 'Fiscalité'),
        ),
      ),
      h('div', { class: 'picks' },
        ...legalChoices(sector).map((k) => h('button', {
          class: `pick ${s.meta.legalForm === k ? 'active' : ''}`,
          onClick: () => { applyLegal(k); refresh() },
        },
          h('div', { class: 'pick-name' }, LEGAL_FORMS[k].label),
          h('div', { class: 'pick-note' }, LEGAL_FORMS[k].short),
        )),
      ),
      h('p', { class: 'field-hint mt' }, LEGAL_FORMS[s.meta.legalForm]?.note || ''),

      refine('projet-fiscal', 'Affiner le régime fiscal',
        h('div', { class: 'grid grid-2' },
          switchField({
            label: "Taux réduit d’impôt sur les sociétés",
            checked: s.meta.reducedCorporateTax !== false,
            hint: "15 % jusqu’à 42 500 € de bénéfice, sous conditions de capital et de chiffre d’affaires.",
            onInput: (v) => set({ reducedCorporateTax: v }, 'Régime IS'),
          }),
          switchField({
            label: 'Jeune entreprise innovante',
            checked: !!s.meta.jeiClaimed,
            hint: "Exonération de cotisations patronales sur les postes affectés à la recherche.",
            onInput: (v) => set({ jeiClaimed: v }, 'Statut JEI'),
          }),
          switchField({
            label: 'Franchise en base de TVA',
            checked: !!s.meta.vatExempt,
            hint: "Tu ne factures pas la TVA et ne la récupères pas. Sous les seuils de chiffre d’affaires.",
            onInput: (v) => set({ vatExempt: v }, 'Régime de TVA'),
          }),
        ),
      ),
    ),

    todoPanel('projet', store.scenario, () => refresh()),

    h('div', { class: 'row mt', style: { justifyContent: 'space-between' } },
      h('span', { class: 'tiny muted' }, 'Toutes les valeurs restent modifiables plus tard.'),
      h('button', { class: 'btn btn-go', onClick: () => navigate('#/offre') }, 'Continuer →'),
    ),
  )
}

/* ───────────────────────────── Le métier ───────────────────────────────── */

function sectorPicks(s, set, refresh) {
  const open = renderProject.sectorOpen ?? !s.meta.sectorKey
  const current = getSector(s.meta.sectorKey)
  const families = sectorsByFamily()

  if (!open && current) {
    return h('div', { class: 'picked' },
      h('div', {},
        h('div', { class: 'picked-tag' }, "Type d’activité"),
        h('div', { class: 'picked-name' }, current.glyph, ' ', current.label),
        h('div', { class: 'picked-note' }, current.tagline),
      ),
      h('button', { class: 'btn btn-sm btn-pill', onClick: () => { renderProject.sectorOpen = true; refresh() } }, 'Changer'),
    )
  }

  return h('div', {},
    ...families.map((fam) => h('div', { class: 'sector-family' },
      h('div', { class: 'sector-family-tag' }, FAMILIES[fam.key]?.label || fam.label),
      h('div', { class: 'picks' },
        ...fam.sectors.map((sec) => h('button', {
          class: `pick ${s.meta.sectorKey === sec.key ? 'active' : ''}`,
          onClick: () => {
            set({ sectorKey: sec.key, vatExempt: !!SECTORS[sec.key].vat.exempt }, "Type d’activité")
            renderProject.sectorOpen = false
            refresh()
          },
        },
          h('div', { class: 'pick-name' }, sec.label),
          h('div', { class: 'pick-note' }, sec.tagline),
        )),
      ),
    )),
  )
}

/* ─────────────────────────── La forme juridique ────────────────────────── */

function legalChoices(sector) {
  const suggested = sector?.legal?.forms || []
  const rest = Object.keys(LEGAL_FORMS).filter((k) => !suggested.includes(k))
  return [...suggested.filter((k) => LEGAL_FORMS[k]), ...rest]
}

function applyLegal(key) {
  store.update((sc) => {
    sc.meta.legalForm = key
    sc.founder.majorityManager = ['SARL', 'EURL', 'SELARL'].includes(key)
    const me = sc.team?.find((x) => /fondateur|dirigeant|moi/i.test(x.role || ''))
    if (me) me.contractType = LEGAL_FORMS[key].contract
  }, { label: 'Forme juridique' })
}

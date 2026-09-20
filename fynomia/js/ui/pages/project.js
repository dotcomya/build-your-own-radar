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

import { h, euro, num, textField, selectField, switchField, helpButton, refine, fold, moduleShell, confirmDialog } from '../dom.js'
import { SECTORS, getSector } from '../../state/sectors.js'
import { LEGAL_FORMS } from '../../state/schema.js'
import { stepGuide } from '../tutorial.js'
import { todoPanel } from '../todo.js'
import store from '../../state/store.js'
import { FAMILIES as ACTIVITY_FAMILIES, activitiesOf, getActivity } from '../../state/activities.js'
import { resetSetup } from './setup.js'

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
    moduleShell({
      no: '01', title: 'Mon projet',
      lede: "Ce qui cadre le modèle avant tout chiffrage : le métier, le client, le calendrier, la forme juridique.",
      guide: stepGuide(null, null, 'projet'),
    }),

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

      h('div', { class: 'mt', 'data-gap': 'secteur' }, sectorPicks(s, set, refresh)),

      h('div', { 'data-gap': 'calendrier' },
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
      )),
    ),

    h('div', { class: 'slab-pair' },
    h('section', { class: 'slab', 'data-gap': 'pitch' },
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
    h('section', { class: 'slab', 'data-gap': 'client' },
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

    // Le cadre juridique change de sujet : il ne parle plus du marché mais de
    // la structure. Il lui faut donc l'espace qui sépare deux chapitres, pas
    // celui qui sépare deux paragraphes.
    h('section', { class: 'slab slab-apart', 'data-gap': 'juridique' },
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

    todoPanel('projet', store.scenario, navigate),

    h('div', { class: 'row mt', style: { justifyContent: 'space-between' } },
      h('span', { class: 'tiny muted' }, 'Toutes les valeurs restent modifiables plus tard.'),
      h('button', { class: 'btn btn-go', onClick: () => navigate('#/offre') }, 'Continuer →'),
    ),
  )
}

/* ───────────────────────────── Le métier ───────────────────────────────── */

/**
 * Le choix du métier, repliable.
 *
 * La liste s'ouvrait et ne se refermait plus : il fallait choisir pour en
 * sortir. Elle vit désormais dans un volet, comme « affiner le calendrier » —
 * le titre porte le métier retenu, le chevron ouvre et referme, et la grille
 * ne prend de la place que le temps qu'on en a besoin.
 */
function sectorPicks(s, set, refresh) {
  const chosen = getActivity(s.meta.activityKey)
  const sector = getSector(s.meta.sectorKey)

  /**
   * Changer de métier n'est pas anodin.
   *
   * Les charges suggérées, les repères de marge, le taux de TVA et le
   * vocabulaire viennent tous du métier. Basculer de glacier à plombier laisse
   * en place des cornets et une turbine à glace, et compare une marge de
   * bâtiment à une fourchette de glacier. Rien ne casse — mais le dossier ment
   * jusqu'à ce que le fondateur reprenne ses lignes une à une.
   *
   * On le dit donc avant, pas après, et on propose la sortie propre : repartir
   * d'un plan neuf, qui arrive avec les bonnes hypothèses.
   */
  const pick = async (act) => {
    const changing = s.meta.sectorKey && s.meta.sectorKey !== act.sector
    if (changing) {
      const go = await confirmDialog({
        title: `Passer de ${sector?.label.toLowerCase() || 'ton métier'} à ${act.label.toLowerCase()} ?`,
        message: "Tes charges, tes investissements et tes prix restent tels quels — ils viennent de ton métier actuel et ne correspondront plus. Les repères de marge et le taux de TVA, eux, changent tout de suite. Reprends tes lignes après le changement, ou repars d’un plan neuf : il arrivera avec les hypothèses du nouveau métier.",
        confirmLabel: 'Changer quand même',
      })
      if (!go) return
    }
    set({
      sectorKey: act.sector,
      activityKey: act.key,
      activityLabel: act.label,
      unit: act.unit || null,
      vatExempt: !!SECTORS[act.sector].vat.exempt,
    }, "Type d’activité")
    refresh()
  }

  // Cent cinquante métiers déroulés d'un coup font une page de trois mètres.
  // Chaque famille se replie ; celle du métier retenu s'ouvre seule.
  const grid = h('div', { class: 'famfolds' },
    ...ACTIVITY_FAMILIES.map((fam) => {
      const acts = activitiesOf(fam.key)
      const here = acts.some((a) => a.key === s.meta.activityKey)
      return fold(
        `${fam.glyph}  ${fam.label}`,
        here ? chosen?.label : `${acts.length} métiers`,
        h('div', { class: 'picks' },
          ...acts.map((act) => h('button', {
            class: `pick ${s.meta.activityKey === act.key ? 'active' : ''}`,
            onClick: () => pick(act),
          },
            h('div', { class: 'pick-name' }, act.label),
            SECTORS[act.sector].label !== act.label
              ? h('div', { class: 'pick-note' }, `Modèle ${SECTORS[act.sector].label.toLowerCase()}`)
              : null,
          )),
        ),
        { id: `fam-${fam.key}`, open: here, tone: here ? 'is-here' : '' },
      )
    }),
    h('button', {
      class: 'btn btn-quiet btn-block mt',
      onClick: () => { resetSetup(); navigateToNew() },
    }, 'Plutôt repartir d’un plan neuf →'),
  )

  const title = chosen ? chosen.label : sector ? sector.label : 'À choisir'
  return fold(
    "Type d’activité",
    sector ? `${sector.glyph} ${title}` : title,
    grid,
    { id: 'projet-secteur', open: !s.meta.sectorKey },
  )
}

/** Repartir d'un plan neuf, depuis le module Projet. */
function navigateToNew() { location.hash = '#/creer' }

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

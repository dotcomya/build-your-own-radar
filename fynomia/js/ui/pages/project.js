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

import { h, euro, textField, selectField, switchField, refine, moduleShell, confirmDialog, infoPoint } from '../dom.js'
import { SECTORS, getSector } from '../../state/sectors.js'
import { LEGAL_FORMS } from '../../state/schema.js'
import { stepGuide } from '../tutorial.js'
import { todoPanel } from '../todo.js'
import store from '../../state/store.js'
import { FAMILIES as ACTIVITY_FAMILIES, activitiesOf, getActivity } from '../../state/activities.js'
import { resetSetup } from './setup.js'
import { familyIcon } from '../icons.js'
import { MICRO_CATEGORIES, microCategory, acreMicroMonths, acreMicroReduction } from '../../engine/micro.js'
import { fiscalContext } from '../../engine/fiscal-fr-2026.js'

/** Les clients type : ils ne payent pas au même rythme. */
/**
 * Un choix fait n'a plus besoin de montrer ses concurrents.
 *
 * Trois cartes de type de client et sept formes juridiques restaient dépliées
 * en permanence, longtemps après qu'on avait tranché. Elles occupaient la
 * moitié de l'écran pour répéter une décision prise, et donnaient à la page
 * l'air d'un formulaire qu'on n'a pas fini de remplir.
 *
 * Une fois le choix posé, il tient sur une ligne : ce qu'on a choisi, ce que
 * ça implique, et « Modifier » pour rouvrir la grille. C'est la hiérarchie
 * qu'on cherche — d'abord ce qui permet de décider, ensuite ce qui affine.
 */
const ouverts = new Set()

function pickSet({ id, chosen, nom, note, cartes, refresh }) {
  if (!chosen || ouverts.has(id)) {
    return h('div', { class: 'picks' }, ...cartes)
  }
  return h('div', { class: 'pickdone' },
    h('span', { class: 'pickdone-mark', 'aria-hidden': 'true' }, '\u2713'),
    h('span', { class: 'pickdone-name' }, nom),
    note ? h('span', { class: 'pickdone-note' }, note) : null,
    h('span', { class: 'spacer' }),
    h('button', {
      class: 'pickdone-edit',
      onClick: () => { ouverts.add(id); refresh() },
    }, 'Modifier'),
  )
}

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
      // Deux lignes, deux paires : qui tu es (le nom, la forme juridique), puis
      // ce que tu fais et à partir de quand (le métier, la date). Le métier et
      // la forme se lisent de la même façon — une réponse d'une ligne, et
      // « Modifier » qui déplie la grille juste en dessous. Ce sont deux
      // réponses qu'on relit vingt fois et qu'on change une.
      h('div', { class: 'grid grid-2' },
        textField({
          label: 'Nom du projet', value: s.meta.company || s.meta.name,
          placeholder: 'Ton projet',
          onInput: (v, o) => set({ company: v, name: v || 'Mon business plan' }, undefined, o),
        }),
        legalLine(s, refresh),
      ),
      legalOpen(s) ? legalBlock(s, sector, set, refresh) : null,
      regimeBlock(s, sector, set),

      h('div', { class: 'grid grid-2 mt' },
        activityLine(s, refresh),
        (() => {
          const input = h('input', { type: 'date', value: s.meta.startDate })
          input.addEventListener('change', () => set({ startDate: input.value, startDateChosen: true }, 'Date de début d’activité'))
          const ok = !!s.meta.startDateChosen || !!s.meta.confirmes?.demarrage
          return h('div', { class: 'field', 'data-gap': 'demarrage' },
            h('label', {}, "Début d’activité",
              ok ? null : valider('Valider cette date', () => set({ startDateChosen: true }, 'Date de début d’activité validée'))),
            h('div', { class: 'control' }, input),
            h('div', { class: 'field-hint' }, 'Décale tout le calendrier : volumes, salaires, échéances.'),
          )
        })(),
      ),
      activityOpen(s) ? h('div', { class: 'legalopen' }, sectorGrid(s, set, refresh)) : null,

      // La clôture de l'exercice, à côté de rien d'autre : la question du
      // régime de TVA est partie. Elle doublonnait le statut juridique et le
      // taux de TVA de chaque offre, et personne ne savait quoi y répondre ;
      // la franchise, qui ne concerne que les petites affaires, reste dans le
      // régime fiscal du statut.
      h('div', { class: 'grid grid-2 mt' },
        h('div', { 'data-gap': 'calendrier' },
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
      (() => {
        // Rien n'est choisi tant que le fondateur n'a pas choisi : afficher
        // « Entreprises » par défaut faisait croire la case remplie, pendant
        // que le dossier la réclamait encore.
        const cle = s.meta.clientType || null
        const choisi = CLIENTS.find((c) => c.key === cle)
        return pickSet({
          id: 'client', chosen: !!choisi, nom: choisi?.name, note: choisi?.note, refresh,
          cartes: CLIENTS.map((c) => h('button', {
            class: `pick ${cle === c.key ? 'active' : ''}`,
            onClick: () => { set({ clientType: c.key }, 'Type de client'); ouverts.delete('client'); refresh() },
          },
            h('div', { class: 'pick-name' }, c.name),
            h('div', { class: 'pick-note' }, c.note),
          )),
        })
      })(),
    ),
    ),

    todoPanel('projet', store.scenario, navigate),

    h('div', { class: 'row mt', style: { justifyContent: 'space-between' } },
      h('span', { class: 'tiny muted' }, 'Toutes les valeurs restent modifiables plus tard.'),
      h('button', { class: 'btn btn-go', onClick: () => navigate('#/offre') }, 'Continuer →'),
    ),
  )
}

/** La grille des formes est-elle ouverte ? Tant qu'on n'a pas choisi, oui. */
function legalOpen(s) { return !LEGAL_FORMS[s.meta.legalForm] || ouverts.has('forme') }

/** Le cadre juridique en une ligne, à côté du nom et de la date. */
function legalLine(s, refresh) {
  const forme = LEGAL_FORMS[s.meta.legalForm]
  const ouvert = legalOpen(s)
  const bascule = () => { ouverts.has('forme') ? ouverts.delete('forme') : ouverts.add('forme'); refresh() }

  const ok = !!s.meta.legalFormChosen || !!s.meta.confirmes?.forme
  return h('div', { class: 'field', 'data-gap': 'juridique' },
    h('label', {}, 'Statut juridique',
      ok || !forme ? null : valider('Valider ce statut', () => store.update((sc) => { sc.meta.legalFormChosen = true }, { label: 'Statut juridique validé' }))),
    h('div', { class: 'control control-bare' },
      h('button', {
        class: `legalline ${forme ? '' : 'is-empty'} ${ouvert ? 'is-open' : ''}`,
        onClick: bascule,
        title: forme ? 'Changer de forme juridique' : 'Choisir une forme juridique',
      },
        h('span', { class: 'legalline-name' }, forme ? forme.label : 'À choisir'),
        forme ? h('span', { class: 'legalline-note' }, forme.short) : null,
        h('span', { class: 'spacer' }),
        h('span', { class: 'legalline-edit' }, ouvert ? 'Fermer' : forme ? 'Modifier' : 'Choisir'),
      ),
    ),
    h('div', { class: 'field-hint' }, 'Décide de ton statut social, donc du coût de ta rémunération.'),
  )
}

/** Tout ce que « Modifier » rouvre : les formes, leur note, le régime fiscal. */
function legalBlock(s, sector, set, refresh) {
  return h('div', { class: 'legalopen' },
    h('div', { class: 'picks' }, ...legalChoices(sector).map((k) => h('button', {
      class: `pick ${s.meta.legalForm === k ? 'active' : ''}`,
      onClick: () => { applyLegal(k); ouverts.delete('forme'); refresh() },
    },
      h('div', { class: 'pick-name' }, LEGAL_FORMS[k].label),
      h('div', { class: 'pick-note' }, LEGAL_FORMS[k].short),
    ))),
    h('p', { class: 'field-hint mt' }, LEGAL_FORMS[s.meta.legalForm]?.note || ''),

    s.meta.legalForm === 'MICRO' ? null : refine('projet-fiscal', 'Affiner le régime fiscal',
      h('div', { class: 'grid grid-2' },
        switchField({
          label: "Taux réduit d\u2019impôt sur les sociétés",
          checked: s.meta.reducedCorporateTax !== false,
          hint: "15 % jusqu\u2019à 42 500 € de bénéfice, sous conditions de capital et de chiffre d\u2019affaires.",
          onInput: (v) => set({ reducedCorporateTax: v }, 'Régime IS'),
        }),
        switchField({
          label: 'Jeune entreprise innovante',
          checked: !!s.meta.jeiClaimed,
          hint: "Exonération de cotisations patronales sur les postes affectés à la recherche.",
          onInput: (v) => set({ jeiClaimed: v }, 'Statut JEI'),
        }),
        switchField({
          label: 'Je ne facture pas la TVA (franchise en base)',
          checked: !!s.meta.vatExempt,
          hint: "Seulement pour les petites affaires sous les seuils de chiffre d\u2019affaires, souvent en micro-entreprise. Sinon, laisse éteint : le taux de TVA de chaque offre se règle dans Offre et revenus.",
          onInput: (v) => set({ vatExempt: v, vatChecked: true }, 'Régime de TVA'),
        }),
      ),
    ),
  )
}

/* ───────────────────────────── Le métier ───────────────────────────────── */

/** La grille des métiers est-elle ouverte ? Tant qu'on n'a pas choisi, oui. */
function activityOpen(s) { return !s.meta.sectorKey || ouverts.has('metier') }

/**
 * Le métier en une ligne, présenté comme le cadre juridique.
 *
 * Il vivait dans un volet à part, sous la première ligne, avec un titre de
 * volet et un glyphe : on ne voyait pas du premier coup d'œil que c'était une
 * réponse, ni laquelle. Il prend maintenant la même forme que la forme
 * juridique — l'icône de sa famille, le métier en clair, ce qu'il implique
 * (la famille, le taux de TVA), et « Modifier » qui déplie les familles juste
 * en dessous, comme avant.
 */
function activityLine(s, refresh) {
  const chosen = getActivity(s.meta.activityKey)
  const sector = getSector(s.meta.sectorKey)
  const fam = ACTIVITY_FAMILIES.find((f) => activitiesOf(f.key).some((a) => a.key === s.meta.activityKey))
  const nom = chosen ? chosen.label : sector ? sector.label : null
  const note = sector ? [fam?.label, sector.vat?.label].filter(Boolean).join(' · ') : null
  const ouvert = activityOpen(s)
  const bascule = () => { ouverts.has('metier') ? ouverts.delete('metier') : ouverts.add('metier'); refresh() }

  return h('div', { class: 'field', 'data-gap': 'secteur' },
    h('label', {}, 'Type d’activité'),
    h('div', { class: 'control control-bare' },
      h('button', {
        class: `legalline is-activity ${nom ? '' : 'is-empty'} ${ouvert ? 'is-open' : ''}`,
        onClick: bascule,
        title: nom ? 'Changer de métier' : 'Choisir un métier',
      },
        fam ? h('span', { class: 'legalline-icon', 'aria-hidden': 'true', html: familyIcon(fam.key) }) : null,
        h('span', { class: 'legalline-name' }, nom || 'À choisir'),
        note ? h('span', { class: 'legalline-note' }, note) : null,
        h('span', { class: 'spacer' }),
        h('span', { class: 'legalline-edit' }, ouvert && nom ? 'Fermer' : nom ? 'Modifier' : 'Choisir'),
      ),
    ),
    h('div', { class: 'field-hint' }, 'Fixe le vocabulaire, la TVA et les repères de marge.'),
  )
}

/**
 * Tout ce que « Modifier » déplie sous le métier : les familles, puis leurs
 * métiers. Choisir referme la grille, comme pour la forme juridique.
 */
function sectorGrid(s, set, refresh) {
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
    ouverts.delete('metier')
    refresh()
  }

  // Douze volets empilés font une colonne de trois écrans qu'on parcourt au
  // pouce pour trouver sa famille. En grille, elles tiennent toutes à l'œil :
  // on en ouvre une, et les métiers prennent la place — le même geste que dans
  // le parcours, où il ne fait pas défaut.
  const here = ACTIVITY_FAMILIES.find((f) => activitiesOf(f.key).some((a) => a.key === s.meta.activityKey))
  if (sectorGrid.fam === undefined) sectorGrid.fam = null
  const open = sectorGrid.fam

  const famGrid = h('div', { class: 'famgrid' },
    ...ACTIVITY_FAMILIES.map((fam) => {
      const acts = activitiesOf(fam.key)
      const mine = here?.key === fam.key
      return h('button', {
        class: `famcard ${mine ? 'is-here' : ''}`,
        onClick: () => { sectorGrid.fam = fam.key; refresh() },
      },
        h('span', { class: 'famcard-icon', html: familyIcon(fam.key) }),
        h('span', { class: 'famcard-name' }, fam.label),
        h('span', { class: 'famcard-note' }, mine ? chosen?.label || sector?.label : `${acts.length} m\u00e9tiers`),
      )
    }),
  )

  const famOpen = open ? (() => {
    const fam = ACTIVITY_FAMILIES.find((f) => f.key === open)
    // Une fois dans la famille, son icône ne se répète pas à chaque ligne :
    // elle est déjà en tête, et douze fois le même objet ne distingue rien.
    return h('div', { class: 'famopen' },
      h('button', { class: 'famopen-back', onClick: () => { sectorGrid.fam = null; refresh() } },
        '\u2190 Toutes les familles'),
      h('div', { class: 'famopen-head' },
        h('span', { class: 'famopen-icon', html: familyIcon(fam.key) }),
        h('span', {}, fam.label),
      ),
      h('div', { class: 'picks' },
        ...activitiesOf(fam.key).map((act) => h('button', {
          class: `pick ${s.meta.activityKey === act.key ? 'active' : ''}`,
          onClick: () => pick(act),
        },
          h('div', { class: 'pick-name' }, act.label),
          SECTORS[act.sector].label !== act.label
            ? h('div', { class: 'pick-note' }, `Mod\u00e8le ${SECTORS[act.sector].label.toLowerCase()}`)
            : null,
        )),
      ),
    )
  })() : null

  const grid = h('div', {},
    famOpen || famGrid,
    h('button', {
      class: 'btn btn-quiet btn-block mt',
      onClick: () => { resetSetup(); navigateToNew() },
    }, 'Plut\u00f4t repartir d\u2019un plan neuf \u2192'),
  )

  return grid
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
    const avant = sc.meta.legalForm
    sc.meta.legalForm = key
    sc.meta.legalFormChosen = true
    sc.founder.majorityManager = ['SARL', 'EURL', 'SELARL'].includes(key)
    const me = sc.team?.find((x) => new RegExp('fondateur|dirigeant|g\u00e9rant|moi', 'i').test(x.role || ''))
    if (me) me.contractType = LEGAL_FORMS[key].contract
    // Un micro-entrepreneur démarre en franchise de TVA ; qui quitte la
    // micro-entreprise la quitte aussi — sauf s'il a tranché lui-même, ou si
    // son métier est exonéré.
    if (!sc.meta.vatChecked) {
      if (key === 'MICRO') sc.meta.vatExempt = true
      else if (avant === 'MICRO') sc.meta.vatExempt = !!SECTORS[sc.meta.sectorKey]?.vat?.exempt
    }
  }, { label: 'Forme juridique' })
}

/**
 * Le régime social et les aides, sous le statut.
 *
 * Deux choses changent le premier exercice d'un créateur plus que n'importe
 * quel réglage fiscal : la micro-entreprise, qui fait cotiser sur le chiffre
 * d'affaires au lieu d'une paie, et l'ACRE, qui efface une partie des
 * cotisations la première année. Elles sont à côté de la forme juridique,
 * parce que c'est là qu'on les décide.
 */
function regimeBlock(s, sector, set) {
  const micro = s.meta.legalForm === 'MICRO'
  const ctx = fiscalContext(s.fiscal || {})
  const cat = microCategory(s, sector)
  const taux = ctx.get('microSocialRates')
  const vl = ctx.get('microFlatIncomeTax')
  const pctFr = (v) => `${String(Math.round(v * 1000) / 10).replace('.', ',')} %`
  const acreNote = micro
    ? `Tes cotisations baissent de ${pctFr(acreMicroReduction(s, ctx))} pendant ${acreMicroMonths(s)} mois — jusqu’à la fin du troisième trimestre civil après ton début d’activité.`
    : 'Pendant douze mois, 25 % de tes cotisations de base effacées, en entier sous 36 045 € de revenu annuel, puis de moins en moins jusqu’à 48 060 €.'
  return h('div', { class: 'regime', 'data-gap': 'regime' },
    micro ? h('div', { class: 'grid grid-3' },
      selectField({
        label: 'Nature de ton activité',
        value: cat,
        options: Object.entries(MICRO_CATEGORIES).map(([k, c]) => ({ value: k, label: `${c.label} — ${pctFr(taux[k])}` })),
        hint: `${MICRO_CATEGORIES[cat].note} Tes cotisations : ${pctFr(taux[cat])} de ce que tu encaisses.`,
        onInput: (v) => set({ microActivity: v }, 'Nature de l’activité'),
      }),
      switchField({
        label: 'Versement libératoire de l’impôt',
        checked: !!s.meta.microVL,
        hint: `Ton impôt sur le revenu payé avec tes cotisations : ${pctFr(vl[cat])} de ce que tu encaisses. Ouvert si ton revenu fiscal de référence ne dépasse pas ${euro(vl.rfrPerPart)} par part. Rentable si ton foyer est imposé à 11 % ou plus.`,
        onInput: (v) => set({ microVL: v }, 'Versement libératoire'),
      }),
      switchField({
        label: 'Franchise de TVA',
        checked: !!s.meta.vatExempt,
        hint: 'Tu ne factures pas la TVA et tu ne la récupères pas. Tu la factures dès que tu dépasses le seuil majoré.',
        onInput: (v) => set({ vatExempt: v, vatChecked: true }, 'Régime de TVA'),
      }),
    ) : null,
    h('div', { class: `grid ${micro ? 'grid-3' : 'grid-2'} ${micro ? 'mt' : ''}` },
      // Ce que l'ACRE efface, et à qui elle est ouverte : une seule bulle, à
      // côté de l'interrupteur, plutôt qu'un paragraphe sous lui.
      switchField({
        label: h('span', { class: 'switch-name-i' }, 'J’ai droit à l’ACRE', infoPoint(
          `${acreNote} Depuis 2026, elle se demande à l’URSSAF dans les 60 jours et reste réservée à certains créateurs : demandeurs d’emploi, bénéficiaires du RSA ou de l’ASS, moins de 26 ans, entre autres.`,
          { classe: 'is-champ' })),
        checked: !!s.meta.acre,
        onInput: (v) => set({ acre: v }, 'ACRE'),
      }),
    ),
  )
}

/**
 * « Valider » : une valeur posée par défaut n'est pas une réponse.
 *
 * La forme juridique, la date de début, le régime de TVA ont tous une valeur
 * dès la création du plan — il en faut une pour que le moteur calcule. Le
 * fondateur qui la lit et la trouve juste n'avait aucun moyen de le dire :
 * la ligne restait « à faire » alors que le champ était rempli. Ce bouton le
 * dit, d'un clic, et disparaît.
 */
function valider(texte, onClick) {
  return h('button', { class: 'valider-chip', type: 'button', onClick: (e) => { e.preventDefault(); onClick() } }, '✓ ', texte)
}

/** Réglages : projet, scénarios, paramètres fiscaux, données. */

import { h, euro, pct, num, textField, selectField, numberField, switchField, toast, confirmDialog, moduleShell, infoPoint } from '../dom.js'
import { PARAMS, paramsToVerify, FISCAL_YEAR, LAST_ENACTED_YEAR, fiscalContext } from '../../engine/fiscal-fr-2026.js'
import { acreMicroMonths, acreMicroReduction } from '../../engine/micro.js'
import { SECTORS, SECTOR_KEYS } from '../../state/sectors.js'
import { relative } from './onboarding.js'
import { renderAccount } from './account.js'
import store from '../../state/store.js'

export function renderSettings(navigate, refresh) {
  const s = store.scenario
  const usage = store.storageUsage()

  return h('div', { class: 'content' },
    moduleShell({
      no: '08', title: 'Réglages',
    }),

    h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Ce projet')),
      h('div', { class: 'card-body' },
        h('div', { class: 'grid grid-2' },
          textField({ label: 'Nom du scénario', value: s.meta.name, onInput: (v, o) => store.update((sc) => { sc.meta.name = v }, { label: 'Renommage', ...(o || {}) }) }),
          textField({ label: 'Société', value: s.meta.company, placeholder: 'Nom commercial', onInput: (v, o) => store.update((sc) => { sc.meta.company = v }, { label: 'Société', ...(o || {}) }) }),
          selectField({
            label: "Type d'activité", value: s.meta.sectorKey || '',
            options: [{ value: '', label: '— Aucun —' }, ...SECTOR_KEYS.map((k) => ({ value: k, label: SECTORS[k].label }))],
            hint: "Détermine le vocabulaire, le régime de TVA, les repères de marché et les alertes. Changer ce choix ne modifie pas tes chiffres.",
            onInput: (v) => store.update((sc) => {
              sc.meta.sectorKey = v || null
              if (v && SECTORS[v].vat.exempt) sc.meta.vatExempt = true
            }, { label: "Type d'activité" }),
          }),
          selectField({
            label: 'Forme juridique', value: s.meta.legalForm,
            options: ['SAS', 'SASU', 'SARL', 'EURL', 'SA', 'Entreprise individuelle'].map((v) => ({ value: v, label: v })),
            onInput: (v) => store.update((sc) => { sc.meta.legalForm = v; sc.meta.legalFormChosen = true }, { label: 'Forme juridique' }),
          }),
          h('div', { class: 'field' },
            h('label', {}, "Début d’activité"),
            (() => {
              const input = h('input', { type: 'date', value: s.meta.startDate })
              input.addEventListener('change', () => store.update((sc) => { sc.meta.startDate = input.value; sc.meta.startDateChosen = true }, { label: 'Date de début d’activité' }))
              return h('div', { class: 'control' }, input)
            })(),
            h('div', { class: 'field-hint' }, "Premier mois du prévisionnel."),
          ),
          // Le calendrier et le droit à l'ACRE vivent ici, avec les autres
          // réglages du premier exercice, plus dans la page Projet.
          h('div', { 'data-gap': 'calendrier' },
            selectField({
              label: 'Mois de clôture', value: String(s.meta.fiscalYearEnd ?? 12),
              options: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
                .map((m, i) => ({ value: String(i + 1), label: m })),
              hint: "Décembre dans la plupart des cas. Un exercice décalé change la date des impôts, pas les montants.",
              onInput: (v) => store.update((sc) => { sc.meta.fiscalYearEnd = Number(v) }, { label: 'Clôture' }),
            }),
          ),
        ),
        h('div', { class: 'grid grid-3 mt' },
          switchField({
            label: "Éligible au taux réduit d'impôt sur les sociétés",
            checked: s.meta.reducedCorporateTax !== false,
            hint: "15 % sur les 42 500 premiers euros de bénéfice. Réservé aux PME de moins de 10 M€ de chiffre d'affaires, au capital entièrement libéré et détenu à 75 % au moins par des personnes physiques.",
            onInput: (v) => store.update((sc) => { sc.meta.reducedCorporateTax = v }, { label: 'Régime IS' }),
          }),
          switchField({
            label: 'Revendiquer le statut Jeune entreprise innovante',
            checked: !!s.meta.jeiClaimed,
            hint: "Fynomia vérifiera chaque année si le seuil de dépenses de recherche est atteint.",
            onInput: (v) => store.update((sc) => { sc.meta.jeiClaimed = v }, { label: 'Statut JEI' }),
          }),
          h('div', { 'data-gap': 'acre' }, acreSwitch(s)),
        ),
        h('div', { class: 'grid grid-2 mt', 'data-gap': 'stock' },
          numberField({
            label: 'Marchandises en réserve', field: 'stockDays', value: s.assumptions?.stockDays, suffix: 'jours d’achats',
            hint: stockHint(s),
            onInput: (v) => store.update((sc) => { sc.assumptions.stockDays = v }, { label: 'Stock' }),
          }),
        ),
      ),
    ),

    scenarioManager(navigate, refresh),
    fiscalPanel(refresh),
    dataPanel(navigate, refresh, usage),

    // Le compte et les réglages répondaient à la même question — « où sont mes
    // affaires ? » — sur deux pages. Ils n'en font plus qu'une.
    h('div', { class: 'merged' }, renderAccount(navigate, refresh)),
  )
}

function scenarioManager(navigate, refresh) {
  const list = store.list()
  const create = async () => {
    const s = store.create({ name: 'Nouveau scénario', level: store.level })
    toast('Scénario créé.', 'ok')
    navigate('#/tableau-de-bord')
  }
  return h('div', { class: 'card mb' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Mes scénarios'), h('span', { class: 'spacer' }),
      h('button', { class: 'btn btn-sm', onClick: create }, '＋ Nouveau')),
    h('div', { class: 'card-body' },
      h('p', { class: 'small muted', style: { marginTop: 0 } },
        "Duplique un scénario pour comparer plusieurs hypothèses — un cas prudent et un cas optimiste, par exemple — sans perdre ton travail."),
      ...list.map((item) => h('div', { class: 'row scenario-row', style: { padding: '10px 0', borderTop: '1px solid var(--ink-100)' } },
        h('div', { class: 'spacer scenario-name' },
          h('div', { style: { fontWeight: '600' } }, item.name,
            item.id === store.currentId ? h('span', { class: 'chip chip-brand', style: { marginLeft: '7px' } }, 'Actuel') : null),
          h('div', { class: 'tiny muted' }, `Modifié ${relative(item.updatedAt)}`),
        ),
        item.id !== store.currentId && h('button', { class: 'btn btn-sm', onClick: () => { store.load(item.id); navigate('#/tableau-de-bord') } }, 'Ouvrir'),
        h('button', { class: 'btn btn-sm btn-ghost', onClick: () => { store.duplicate(item.id); toast('Scénario dupliqué.', 'ok'); refresh() } }, 'Dupliquer'),
        list.length > 1 && h('button', {
          class: 'btn btn-sm btn-ghost btn-danger',
          onClick: async () => {
            if (await confirmDialog({ title: 'Supprimer ce scénario ?', message: `« ${item.name} » sera définitivement effacé de cet appareil.`, confirmLabel: 'Supprimer', danger: true })) {
              store.remove(item.id); toast('Scénario supprimé.'); refresh()
            }
          },
        }, 'Supprimer'),
      )),
    ),
  )
}

function fiscalPanel(refresh) {
  const s = store.scenario
  const toVerify = paramsToVerify()
  const overridden = Object.keys(s.fiscal || {}).length

  const editable = [
    { key: 'employerRateNonCadre', percent: true },
    { key: 'employerRateCadre', percent: true },
    { key: 'employeeRate', percent: true },
    { key: 'tnsRate', percent: true },
    { key: 'smicHourly', percent: false, suffix: '€/h' },
  ]

  return h('div', { class: 'card mb' },
    h('div', { class: 'card-head' },
      h('div', {}, h('h2', {}, `Paramètres fiscaux et sociaux — France ${FISCAL_YEAR}`),
        h('div', { class: 'tiny muted' }, overridden > 0 ? `${overridden} paramètre(s) personnalisé(s)` : 'Valeurs par défaut')),
      h('span', { class: 'spacer' }),
      overridden > 0 && h('button', { class: 'btn btn-sm', onClick: () => { store.update((sc) => { sc.fiscal = {} }, { label: 'Réinitialisation fiscale' }); toast('Paramètres réinitialisés.', 'ok'); refresh() } }, 'Réinitialiser'),
    ),
    h('div', { class: 'card-body' },
      h('p', { class: 'small muted', style: { margin: '0 0 12px' } }, 'Chaque valeur cite son texte ; les repères du métier, leurs sources. ',
        h('a', { class: 'repere-src', href: '#/methode' }, 'La méthode et les sources →')),
      h('div', { class: 'note warn mb' },
        h('div', { class: 'note-title' }, `${toVerify.length} paramètres à confirmer pour ${FISCAL_YEAR}`),
        h('p', { style: { margin: '0 0 8px' } },
          `Les règles structurelles appliquées sont celles de l'exercice ${LAST_ENACTED_YEAR}, dernier promulgué. `
          + `Un plan démarrant en ${LAST_ENACTED_YEAR + 1} les reconduit : aucune loi de finances ${LAST_ENACTED_YEAR + 1} `
          + `n'existe encore, et Fynomia préfère le dire plutôt que d'inventer un barème. `
          + `Les valeurs ci-dessous sont revalorisées chaque année — confirme-les avant un dossier bancaire ou une levée.`),
        "Les règles pérennes — barème de l'impôt sur les sociétés, taux de TVA, seuils de la CVAE et de la C3S — sont appliquées telles quelles. En revanche, les valeurs revalorisées chaque année (SMIC, plafond de la Sécurité sociale, coefficients de la réduction générale, barème de la CFE) sont ici des valeurs de référence reconduites. Confirme-les avec ton expert-comptable avant tout usage officiel.",
      ),

      h('h4', { class: 'mb' }, 'Ajuster les taux'),
      h('div', { class: 'grid grid-3' },
        ...editable.map(({ key, percent, suffix }) => {
          const p = PARAMS[key]
          const current = s.fiscal[key] !== undefined ? s.fiscal[key] : p.value
          return numberField({
            label: p.label, field: percent ? 'rate' : 'monthlyGross', value: current,
            percent, suffix, max: percent ? 100 : undefined, step: percent ? 0.5 : 0.01,
            hint: p.note.length > 130 ? p.note.slice(0, 128) + '…' : p.note,
            onInput: (v) => store.update((sc) => { sc.fiscal[key] = v }, { label: 'Paramètre fiscal' }),
          })
        }),
      ),

      h('h4', { style: { margin: '22px 0 8px' } }, 'Toutes les règles appliquées'),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Paramètre'), h('th', {}, 'Valeur'), h('th', {}, 'Statut'))),
          h('tbody', {},
            ...Object.entries(PARAMS).map(([key, p]) => h('tr', {},
              h('td', {},
                h('div', {}, p.label),
                h('div', { class: 'tiny muted', style: { whiteSpace: 'normal', maxWidth: '68ch', marginTop: '2px' } }, p.note),
                // Un chiffre sans son texte est une affirmation. Avec, c'est
                // une référence que le comptable du fondateur peut rouvrir.
                p.source ? h('div', { class: 'tiny', style: { whiteSpace: 'normal', marginTop: '3px', color: 'var(--signal-ink)' } }, p.source) : null,
              ),
              h('td', { class: 'num nowrap', style: { verticalAlign: 'top' } }, formatParam(s.fiscal[key] !== undefined ? s.fiscal[key] : p.value, p.unit)),
              h('td', { style: { verticalAlign: 'top' } },
                h('span', { class: `chip ${CONF[p.confidence]?.chip || 'chip-warn'}` }, CONF[p.confidence]?.label || 'À confirmer')),
            )),
          ),
        ),
      ),
    ),
  )
}

/**
 * Trois statuts, trois niveaux d'engagement.
 *
 * « Règle pérenne » ne bouge qu'avec une loi de finances. « 2026, texte publié »
 * est une valeur relevée dans un texte promulgué, cité juste au-dessus.
 * « À confirmer » est un ordre de grandeur assumé — un taux moyen de
 * cotisations n'existe dans aucun journal officiel.
 */
const CONF = {
  stable: { chip: 'chip-pos', label: 'Règle pérenne' },
  enacted: { chip: 'chip-brand', label: '2026, texte publié' },
  'to-verify': { chip: 'chip-warn', label: 'À confirmer' },
}

function dataPanel(navigate, refresh, usage) {
  const importFile = () => {
    const input = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } })
    input.addEventListener('change', async () => {
      const file = input.files[0]
      if (!file) return
      try {
        store.importJSON(await file.text())
        toast('Scénario importé.', 'ok')
        navigate('#/tableau-de-bord')
      } catch (e) { toast(`Import impossible : ${e.message}`, 'err') }
    })
    document.body.appendChild(input)
    input.click()
    setTimeout(() => input.remove(), 1000)
  }

  return h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Tes données')),
    h('div', { class: 'card-body' },
      h('p', { class: 'small muted', style: { marginTop: 0, maxWidth: '72ch' } },
        `Tout est enregistré dans le stockage local de ce navigateur — rien n'est envoyé sur un serveur. Espace occupé : ${usage.human}. Vider les données du navigateur effacerait tes scénarios : exporte-les régulièrement.`),
      h('div', { class: 'row-wrap mt' },
        h('button', { class: 'btn', onClick: importFile }, 'Importer un scénario'),
        h('button', {
          class: 'btn btn-danger',
          onClick: async () => {
            if (await confirmDialog({ title: 'Tout effacer ?', message: "Tous tes scénarios et ton profil seront définitivement supprimés de cet appareil. Cette action est irréversible.", confirmLabel: 'Tout effacer', danger: true })) {
              for (const k of ['scenarios', 'current', 'profile']) localStorage.removeItem('fynomia.' + k)
              location.hash = '#/'
              location.reload()
            }
          },
        }, 'Effacer toutes mes données'),
      ),
      h('div', { class: 'note plain mt' },
        h('div', { class: 'note-title' }, 'Profil'),
        `${store.profile?.name || '—'}${store.profile?.company ? ` · ${store.profile.company}` : ''}`),
    ),
  )
}

/**
 * Le droit à l'ACRE : ce qu'elle efface et à qui elle est ouverte, dans une
 * seule bulle à côté de l'interrupteur, plutôt qu'un paragraphe sous lui.
 */
function acreSwitch(s) {
  const micro = s.meta.legalForm === 'MICRO'
  const ctx = fiscalContext(s.fiscal || {})
  const pctFr = (v) => `${String(Math.round(v * 1000) / 10).replace('.', ',')} %`
  const acreNote = micro
    ? `Tes cotisations baissent de ${pctFr(acreMicroReduction(s, ctx))} pendant ${acreMicroMonths(s)} mois — jusqu’à la fin du troisième trimestre civil après ton début d’activité.`
    : 'Pendant douze mois, 25 % de tes cotisations de base effacées, en entier sous 36 045 € de revenu annuel, puis de moins en moins jusqu’à 48 060 €.'
  return switchField({
    label: h('span', { class: 'switch-name-i' }, 'J’ai droit à l’ACRE', infoPoint(
      `${acreNote} Depuis 2026, elle se demande à l’URSSAF dans les 60 jours et reste réservée à certains créateurs : demandeurs d’emploi, bénéficiaires du RSA ou de l’ASS, moins de 26 ans, entre autres.`,
      { classe: 'is-champ' })),
    checked: !!s.meta.acre,
    onInput: (v) => store.update((sc) => { sc.meta.acre = v }, { label: 'ACRE' }),
  })
}

/**
 * Le stock, dit en clair.
 *
 * « Stock moyen, jours » ne parlait à personne. C'est ce qu'on a acheté et
 * pas encore vendu, compté en jours d'achats : de l'argent sorti de la
 * caisse qui dort sur une étagère. Il pèse sur la trésorerie, jamais sur le
 * résultat — et le montant que cela représente dans le plan le montre.
 */
function stockHint(s) {
  const jours = Number(s.assumptions?.stockDays) || 0
  const base = 'Ce que tu as acheté et pas encore vendu, compté en jours d’achats : 30, c’est un mois d’achats payé qui attend sur l’étagère. Cet argent manque à la trésorerie, pas au résultat. Laisse 0 si tu ne stockes rien.'
  const immobilise = jours > 0 ? Number(store.result?.bfr?.stock?.[11]) || 0 : 0
  return immobilise > 0 ? `${base} Dans ton plan : ${euro(immobilise)} immobilisés en fin d’année 1.` : base
}

/**
 * Un taux écrit tel qu'il s'applique.
 *
 * Cette table est le seul endroit où le comptable du fondateur peut vérifier
 * ce que le moteur applique. Elle arrondissait : 0,55 % s'y lisait 0,5 %,
 * 0,68 % devenait 0,7 %, 4,5 SMIC devenait 5, et trois entrées sur sept
 * seulement étaient montrées. Un relecteur y a vu six erreurs de droit là où
 * il n'y avait qu'un affichage : c'est pire qu'inutile, ça détruit la
 * confiance dans des chiffres justes. Ici, rien n'est arrondi et rien n'est
 * omis.
 */
function formatParam(value, unit) {
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  if (typeof value === 'number') {
    if (unit && unit.includes('%')) return pct(value, decimalsOf(value * 100))
    if (unit === '€/an' || unit === '€') return euro(value)
    return `${num(value, decimalsOf(value))}${unit && unit.startsWith('€') ? ' ' + unit : ''}`
  }
  if (Array.isArray(value)) return `${value.length} tranches`
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([, v]) => typeof v === 'number' || typeof v === 'boolean')
      .map(([k, v]) => `${shortKey(k)} ${typeof v === 'boolean' ? (v ? 'oui' : 'non')
        : v < 1 && v > 0 ? pct(v, decimalsOf(v * 100)) : num(v, decimalsOf(v))}`)
      .join(' · ')
  }
  return String(value)
}

/** Combien de décimales il faut pour ne rien perdre, jusqu'à quatre. */
function decimalsOf(v) {
  for (let d = 0; d < 4; d++) if (Math.abs(v - Number(v.toFixed(d))) < 1e-9) return d
  return 4
}

const shortKey = (k) => ({
  reducedRate: '15 %', reducedBracket: 'jusqu\'à', normalRate: 'puis', revenueCapForReduced: 'CA max',
  normal: 'normal', intermediate: 'intermédiaire', reduced: 'réduit', superReduced: 'super-réduit',
  under11: '< 11 sal.', from11: '≥ 11 sal.', threshold: 'seuil', rate: 'taux',
  maxCoefUnder50: 'T < 50', maxCoefFrom50: 'T ≥ 50', ceilingSmicMultiple: 'plafond SMIC',
  flatCap: 'plafond', rateAboveCap: 'au-delà', cap: 'plafond', expenseCap: 'plafond',
  maxAgeYears: 'âge max', rdRatioThreshold: 'seuil R&D', ceiling: 'plafond', windowYears: 'fenêtre',
  exemptionThreshold: 'seuil', maxRate: 'taux max', minimumContribution: 'minimum', additionalTaxRate: 'taxe add.',
  operatingAllowance: 'forfait', equipmentAllowance: 'matériel', exemptFirstYear: '1re année exonérée',
  // La flat tax et l'abattement : personne n'a à lire « socialCharges » dans
  // un tableau qui sert à vérifier des taux devant un comptable.
  total: 'total', incomeTax: 'impôt', socialCharges: 'prélèv. sociaux',
  min: 'plancher', max: 'plafond',
  // Les clés qui manquaient. Faute de traduction, la table affichait
  // « employeeCapSmicMultiple 5 » : un nom de variable et un nombre arrondi,
  // là où la règle dit 4,5 SMIC par salarié.
  employeeCapSmicMultiple: 'plafond / salarié (SMIC)',
  establishmentCapPassMultiple: 'plafond / établissement (PASS)',
  corporateTaxExemption: 'exonération IS', exemptibleRate: 'part exonérable',
  reliefSecondYear: 'abattement 2e année', youngDoctorMultiplier: 'jeune docteur',
  youngDoctorAllowance: 'forfait jeune docteur', subcontractingMultiple: 'sous-traitance',
  launchYear: 'année de lancement', years: 'années', months: 'mois',
}[k] || k)

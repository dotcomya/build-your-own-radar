/** Réglages : projet, scénarios, paramètres fiscaux, données. */

import { h, euro, pct, num, textField, selectField, numberField, switchField, toast, confirmDialog, helpButton } from '../dom.js'
import { PARAMS, paramsToVerify, FISCAL_YEAR } from '../../engine/fiscal-fr-2026.js'
import { LEVEL_META } from '../../state/schema.js'
import { SECTORS, SECTOR_KEYS } from '../../state/sectors.js'
import { relative } from './onboarding.js'
import store from '../../state/store.js'

export function renderSettings(navigate, refresh) {
  const s = store.scenario
  const usage = store.storageUsage()

  return h('div', { class: 'content' },
    h('div', { class: 'page-head' },
      h('h1', {}, 'Réglages'),
      h('p', {}, "Votre projet, vos scénarios et les paramètres fiscaux du modèle."),
    ),

    h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Ce projet')),
      h('div', { class: 'card-body' },
        h('div', { class: 'grid grid-2' },
          textField({ label: 'Nom du scénario', value: s.meta.name, onInput: (v, o) => store.update((sc) => { sc.meta.name = v }, { label: 'Renommage', ...(o || {}) }) }),
          textField({ label: 'Société', value: s.meta.company, placeholder: 'Nom commercial', onInput: (v, o) => store.update((sc) => { sc.meta.company = v }, { label: 'Société', ...(o || {}) }) }),
          selectField({
            label: "Type d'activité", value: s.meta.sectorKey || '',
            options: [{ value: '', label: '— Aucun —' }, ...SECTOR_KEYS.map((k) => ({ value: k, label: SECTORS[k].label }))],
            hint: "Détermine le vocabulaire, le régime de TVA, les repères de marché et les alertes. Changer ce choix ne modifie pas vos chiffres.",
            onInput: (v) => store.update((sc) => {
              sc.meta.sectorKey = v || null
              if (v && SECTORS[v].vat.exempt) sc.meta.vatExempt = true
            }, { label: "Type d'activité" }),
          }),
          selectField({
            label: 'Forme juridique', value: s.meta.legalForm,
            options: ['SAS', 'SASU', 'SARL', 'EURL', 'SA', 'Entreprise individuelle'].map((v) => ({ value: v, label: v })),
            onInput: (v) => store.update((sc) => { sc.meta.legalForm = v }, { label: 'Forme juridique' }),
          }),
          h('div', { class: 'field' },
            h('label', {}, "Date de démarrage"),
            (() => {
              const input = h('input', { type: 'date', value: s.meta.startDate })
              input.addEventListener('change', () => store.update((sc) => { sc.meta.startDate = input.value }, { label: 'Date de démarrage' }))
              return h('div', { class: 'control' }, input)
            })(),
            h('div', { class: 'field-hint' }, "Premier mois du prévisionnel."),
          ),
          selectField({
            label: "Niveau d'analyse", value: s.meta.level,
            options: Object.entries(LEVEL_META).map(([k, v]) => ({ value: k, label: `${v.label} — ${v.tagline}` })),
            hint: LEVEL_META[s.meta.level]?.description,
            onInput: (v) => { store.setLevel(v); refresh() },
          }),
        ),
        h('div', { class: 'grid grid-2 mt' },
          switchField({
            label: "Éligible au taux réduit d'impôt sur les sociétés",
            checked: s.meta.reducedCorporateTax !== false,
            hint: "15 % sur les 42 500 premiers euros de bénéfice. Réservé aux PME de moins de 10 M€ de chiffre d'affaires, au capital entièrement libéré et détenu à 75 % au moins par des personnes physiques.",
            onInput: (v) => store.update((sc) => { sc.meta.reducedCorporateTax = v }, { label: 'Régime IS' }),
          }),
          switchField({
            label: 'Revendiquer le statut Jeune entreprise innovante',
            checked: !!s.meta.jeiClaimed,
            hint: "Fizzy vérifiera chaque année si le seuil de dépenses de recherche est atteint.",
            onInput: (v) => store.update((sc) => { sc.meta.jeiClaimed = v }, { label: 'Statut JEI' }),
          }),
        ),
        store.level === 'advanced' && h('div', { class: 'grid grid-2 mt' },
          numberField({
            label: 'Stock moyen', field: 'stockDays', value: s.assumptions?.stockDays, suffix: 'jours',
            hint: "Nombre de jours d'achats immobilisés en stock. Augmente le besoin en fonds de roulement.",
            onInput: (v) => store.update((sc) => { sc.assumptions.stockDays = v }, { label: 'Stock' }),
          }),
        ),
      ),
    ),

    scenarioManager(navigate, refresh),
    fiscalPanel(refresh),
    dataPanel(navigate, refresh, usage),
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
        "Dupliquez un scénario pour comparer plusieurs hypothèses — un cas prudent et un cas optimiste, par exemple — sans perdre votre travail."),
      ...list.map((item) => h('div', { class: 'row', style: { padding: '10px 0', borderTop: '1px solid var(--ink-100)' } },
        h('div', { class: 'spacer' },
          h('div', { style: { fontWeight: '600' } }, item.name,
            item.id === store.currentId ? h('span', { class: 'chip chip-brand', style: { marginLeft: '7px' } }, 'Actuel') : null),
          h('div', { class: 'tiny muted' }, `${LEVEL_META[item.level]?.label || item.level} · modifié ${relative(item.updatedAt)}`),
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
      h('div', { class: 'note warn mb' },
        h('div', { class: 'note-title' }, `${toVerify.length} paramètres à confirmer pour ${FISCAL_YEAR}`),
        "Les règles pérennes — barème de l'impôt sur les sociétés, taux de TVA, seuils de la CVAE et de la C3S — sont appliquées telles quelles. En revanche, les valeurs revalorisées chaque année (SMIC, plafond de la Sécurité sociale, coefficients de la réduction générale, barème de la CFE) sont ici des valeurs de référence reconduites. Confirmez-les avec votre expert-comptable avant tout usage officiel.",
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
              ),
              h('td', { class: 'num nowrap', style: { verticalAlign: 'top' } }, formatParam(s.fiscal[key] !== undefined ? s.fiscal[key] : p.value, p.unit)),
              h('td', { style: { verticalAlign: 'top' } },
                h('span', { class: `chip ${p.confidence === 'stable' ? 'chip-pos' : 'chip-warn'}` }, p.confidence === 'stable' ? 'Règle pérenne' : 'À confirmer')),
            )),
          ),
        ),
      ),
    ),
  )
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
    h('div', { class: 'card-head' }, h('h2', {}, 'Vos données')),
    h('div', { class: 'card-body' },
      h('p', { class: 'small muted', style: { marginTop: 0, maxWidth: '72ch' } },
        `Tout est enregistré dans le stockage local de ce navigateur — rien n'est envoyé sur un serveur. Espace occupé : ${usage.human}. Vider les données du navigateur effacerait vos scénarios : exportez-les régulièrement.`),
      h('div', { class: 'row-wrap mt' },
        h('button', { class: 'btn', onClick: importFile }, 'Importer un scénario'),
        h('button', {
          class: 'btn btn-danger',
          onClick: async () => {
            if (await confirmDialog({ title: 'Tout effacer ?', message: "Tous vos scénarios et votre profil seront définitivement supprimés de cet appareil. Cette action est irréversible.", confirmLabel: 'Tout effacer', danger: true })) {
              localStorage.removeItem('fizzy.scenarios'); localStorage.removeItem('fizzy.current'); localStorage.removeItem('fizzy.profile')
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

function formatParam(value, unit) {
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  if (typeof value === 'number') {
    if (unit && unit.includes('%')) return pct(value, value * 100 % 1 === 0 ? 0 : 2)
    if (unit === '€/an' || unit === '€') return euro(value)
    return `${num(value, value % 1 === 0 ? 0 : 2)}${unit && unit.startsWith('€') ? ' ' + unit : ''}`
  }
  if (Array.isArray(value)) return `${value.length} tranches`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => typeof v === 'number' || typeof v === 'boolean')
    return entries.slice(0, 3).map(([k, v]) => `${shortKey(k)} ${typeof v === 'boolean' ? (v ? 'oui' : 'non') : v < 1 && v > 0 ? pct(v, 2) : num(v)}`).join(' · ')
  }
  return String(value)
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
}[k] || k)

/**
 * État applicatif : profils, scénarios, sauvegarde et historique.
 *
 * Tout vit dans le navigateur (localStorage). Chaque modification déclenche un
 * recalcul du modèle et une sauvegarde différée. La navigation entre les pages
 * ne perd jamais rien : le scénario courant est la source de vérité unique.
 */

import { emptyScenario, scenarioFromTemplate, SCHEMA_VERSION, validate } from './schema.js'
import { compute } from '../engine/engine.js'

const KEY_PROFILE = 'fizzy.profile'
const KEY_SCENARIOS = 'fizzy.scenarios'
const KEY_CURRENT = 'fizzy.current'
const AUTOSAVE_DELAY = 400
const HISTORY_LIMIT = 60

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true } catch { return false }
}

class Store {
  constructor() {
    this.listeners = new Set()
    this.profile = read(KEY_PROFILE, null)
    this.scenarios = read(KEY_SCENARIOS, {})
    this.currentId = read(KEY_CURRENT, null)
    this.scenario = null
    this.result = null
    this.issues = []
    this.history = []
    this.future = []
    this.saveTimer = null
    this.saveState = 'idle'

    const ids = Object.keys(this.scenarios)
    if (this.currentId && this.scenarios[this.currentId]) this.load(this.currentId, { silent: true })
    else if (ids.length) this.load(ids[0], { silent: true })
    else this.seedDemo()
  }

  /**
   * Premier lancement : plutôt qu'un formulaire vide, on charge un scénario
   * d'exemple complet. L'outil se montre en fonctionnement dès l'ouverture, et
   * l'exemple est explicitement signalé comme tel dans l'interface.
   */
  seedDemo() {
    const scenario = scenarioFromTemplate('saas', 'Exemple — Abonnement SaaS')
    scenario.meta.isDemo = true
    scenario.meta.company = 'Nova Analytics'
    scenario.meta.sector = 'Logiciel en abonnement'
    scenario.meta.level = 'intermediate'
    this.scenarios[scenario.meta.id] = scenario
    this.currentId = scenario.meta.id
    this.scenario = scenario
    this.recompute()
    return scenario
  }

  /** L'utilisateur reprend l'exemple à son compte : il cesse d'en être un. */
  adoptDemo(name) {
    this.update((s) => {
      s.meta.isDemo = false
      if (name) s.meta.name = name
    }, { label: "Reprise de l'exemple" })
    this.persist()
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  emit(reason = 'change') { for (const fn of this.listeners) fn(this, reason) }

  // ───────────────────────────── Profil ────────────────────────────────
  hasProfile() { return !!(this.profile && this.profile.name) }
  saveProfile(profile) {
    this.profile = { ...(this.profile || {}), ...profile, updatedAt: Date.now() }
    write(KEY_PROFILE, this.profile)
    this.emit('profile')
  }

  // ──────────────────────────── Scénarios ───────────────────────────────
  list() {
    return Object.values(this.scenarios)
      .map((s) => ({ id: s.meta.id, name: s.meta.name, level: s.meta.level, template: s.meta.template, updatedAt: s.meta.updatedAt, company: s.meta.company }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  create({ template, name, level = 'easy' } = {}) {
    const scenario = template ? scenarioFromTemplate(template, name) : emptyScenario(name)
    scenario.meta.level = level
    this.scenarios[scenario.meta.id] = scenario
    this.currentId = scenario.meta.id
    this.scenario = scenario
    this.history = []; this.future = []
    this.persist()
    this.recompute()
    this.emit('scenario')
    return scenario
  }

  load(id, { silent = false } = {}) {
    const s = this.scenarios[id]
    if (!s) return null
    this.currentId = id
    this.scenario = migrate(s)
    this.history = []; this.future = []
    write(KEY_CURRENT, id)
    this.recompute()
    if (!silent) this.emit('scenario')
    return this.scenario
  }

  duplicate(id) {
    const src = this.scenarios[id]
    if (!src) return null
    const copy = JSON.parse(JSON.stringify(src))
    copy.meta.id = `scn_${Math.random().toString(36).slice(2, 9)}`
    copy.meta.name = `${src.meta.name} (copie)`
    copy.meta.createdAt = copy.meta.updatedAt = Date.now()
    this.scenarios[copy.meta.id] = copy
    this.persist()
    this.emit('scenario')
    return copy
  }

  remove(id) {
    delete this.scenarios[id]
    if (this.currentId === id) {
      const next = Object.keys(this.scenarios)[0]
      if (next) this.load(next, { silent: true })
      else { this.scenario = null; this.currentId = null; this.result = null }
    }
    this.persist()
    this.emit('scenario')
  }

  rename(id, name) {
    if (!this.scenarios[id]) return
    this.scenarios[id].meta.name = name
    this.scenarios[id].meta.updatedAt = Date.now()
    this.persist()
    this.emit('scenario')
  }

  // ─────────────────────────── Modifications ────────────────────────────
  /**
   * Applique une mutation au scénario courant.
   * `label` sert à décrire l'action dans l'historique d'annulation.
   */
  update(mutator, { label = 'Modification', recompute = true, silent = false } = {}) {
    if (!this.scenario) return
    this.history.push({ label, snapshot: JSON.stringify(this.scenario) })
    if (this.history.length > HISTORY_LIMIT) this.history.shift()
    this.future = []
    mutator(this.scenario)
    this.scenario.meta.updatedAt = Date.now()
    this.scenarios[this.scenario.meta.id] = this.scenario
    if (recompute) this.recompute()
    this.scheduleSave()
    // `silent` sert aux saisies caractère par caractère : l'état est à jour,
    // mais on n'impose pas un redessin qui ferait perdre le focus.
    if (!silent) this.emit('data')
  }

  undo() {
    const entry = this.history.pop()
    if (!entry) return false
    this.future.push({ label: entry.label, snapshot: JSON.stringify(this.scenario) })
    this.scenario = JSON.parse(entry.snapshot)
    this.scenarios[this.scenario.meta.id] = this.scenario
    this.recompute(); this.scheduleSave(); this.emit('data')
    return true
  }

  redo() {
    const entry = this.future.pop()
    if (!entry) return false
    this.history.push({ label: entry.label, snapshot: JSON.stringify(this.scenario) })
    this.scenario = JSON.parse(entry.snapshot)
    this.scenarios[this.scenario.meta.id] = this.scenario
    this.recompute(); this.scheduleSave(); this.emit('data')
    return true
  }

  canUndo() { return this.history.length > 0 }
  canRedo() { return this.future.length > 0 }

  setLevel(level) { this.update((s) => { s.meta.level = level }, { label: 'Changement de niveau' }) }
  get level() { return this.scenario?.meta?.level || 'easy' }

  // ─────────────────────────── Calcul et sauvegarde ─────────────────────
  recompute() {
    if (!this.scenario) { this.result = null; this.issues = []; return }
    try {
      this.result = compute(this.scenario)
      this.issues = validate(this.scenario, this.result)
      this.computeError = null
    } catch (err) {
      this.computeError = err
      this.issues = [{ level: 'error', page: 'resultats', message: 'Le calcul a échoué.', hint: String(err.message || err) }]
    }
  }

  scheduleSave() {
    this.saveState = 'saving'
    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      const ok = this.persist()
      this.saveState = ok ? 'saved' : 'error'
      this.emit('save')
    }, AUTOSAVE_DELAY)
  }

  persist() {
    const ok = write(KEY_SCENARIOS, this.scenarios) && write(KEY_CURRENT, this.currentId)
    if (ok) this.saveState = 'saved'
    return ok
  }

  // ──────────────────────────── Import / export ─────────────────────────
  exportJSON() {
    return JSON.stringify({ kind: 'fizzy-scenario', version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), profile: this.profile, scenario: this.scenario }, null, 2)
  }

  importJSON(text) {
    const data = JSON.parse(text)
    const scenario = data.scenario || data
    if (!scenario.meta || !scenario.activities) throw new Error("Ce fichier n'est pas un scénario Fizzy valide.")
    const migrated = migrate(scenario)
    migrated.meta.id = `scn_${Math.random().toString(36).slice(2, 9)}`
    migrated.meta.updatedAt = Date.now()
    this.scenarios[migrated.meta.id] = migrated
    this.load(migrated.meta.id)
    this.persist()
    return migrated
  }

  storageUsage() {
    try {
      const bytes = new Blob([JSON.stringify(this.scenarios)]).size
      return { bytes, human: bytes > 1024 * 1024 ? `${(bytes / 1048576).toFixed(1)} Mo` : `${Math.round(bytes / 1024)} Ko` }
    } catch { return { bytes: 0, human: '—' } }
  }
}

/** Migration ascendante des scénarios enregistrés par une version antérieure. */
function migrate(scenario) {
  const s = JSON.parse(JSON.stringify(scenario))
  s.version = s.version || 1
  s.meta = s.meta || {}
  s.fiscal = s.fiscal || {}
  s.activities = s.activities || []
  s.marketing = s.marketing || []
  s.team = s.team || []
  s.opex = s.opex || []
  s.capex = s.capex || []
  s.assumptions = s.assumptions || { stockDays: 0 }
  s.financing = { openingCash: 0, equityFounders: [], equityInvestors: [], loans: [], grants: [], advances: [], shareholderLoans: [], ...(s.financing || {}) }
  for (const a of s.activities) {
    a.volumes = a.volumes || { mode: 'growth', launchMonth: 0, startUnits: 0, monthlyGrowth: 0, manual: [] }
    if (a.volumes.growthDecay === undefined) a.volumes.growthDecay = 0.96
  }
  s.version = SCHEMA_VERSION
  return s
}

export const store = new Store()
export default store

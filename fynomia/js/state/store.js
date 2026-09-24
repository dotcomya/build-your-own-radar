/**
 * État applicatif : compte, plans, sauvegarde et historique.
 *
 * Deux couches de mémoire, dans cet ordre. Le navigateur d'abord : instantané,
 * hors ligne, jamais perdu si le réseau tombe. Le compte ensuite : les mêmes
 * plans, sur n'importe quelle machine. Le local n'est pas un cache du distant,
 * c'est l'inverse — on écrit localement puis on pousse, de sorte qu'une panne
 * de synchronisation ne coûte jamais une frappe.
 *
 * Quand les deux divergent, la date de modification tranche. C'est grossier,
 * mais c'est prévisible, et un fondateur qui reprend son plan sur un autre
 * poste veut la dernière version, pas une fusion qu'il n'a pas demandée.
 */

import { emptyScenario, scenarioFromTemplate, SCHEMA_VERSION, validate } from './schema.js'
import { compute } from '../engine/engine.js'
import { connect, isOnline, pullPlans, pushPlan, deletePlan, pushProfile, watchPlans } from './cloud.js'

const KEY_PROFILE = 'fynomia.profile'
const KEY_SCENARIOS = 'fynomia.scenarios'
const KEY_CURRENT = 'fynomia.current'
const AUTOSAVE_DELAY = 400
const HISTORY_LIMIT = 60

/** Lecture d'une clé locale. */
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
    // Repère : instantané des indicateurs auquel tout est comparé, pour que
    // l'effet d'une modification reste lisible après plusieurs changements.
    this.baseline = null
    this.baselineLabel = null

    // Rien n'est chargé d'office : un premier lancement s'ouvre sur une page
    // blanche et une seule question. L'exemple existe, mais il se demande.
    const ids = Object.keys(this.scenarios)
    if (this.currentId && this.scenarios[this.currentId]) this.load(this.currentId, { silent: true })
    else if (ids.length) this.load(ids[0], { silent: true })
  }

  /**
   * L'exemple, à la demande.
   *
   * Il n'est plus chargé au démarrage : arriver sur le modèle de quelqu'un
   * d'autre ne dit pas quoi faire. Mais pouvoir en ouvrir un d'un clic lève le
   * doute sur ce que l'outil produit, alors il reste — à côté, et en petit.
   */
  seedDemo() {
    const scenario = scenarioFromTemplate('logiciel', 'Exemple — Logiciel en abonnement')
    scenario.meta.isDemo = true
    scenario.meta.company = 'Nova Analytics'
    scenario.meta.level = 'intermediate'
    this.scenarios[scenario.meta.id] = scenario
    this.currentId = scenario.meta.id
    this.scenario = scenario
    this.recompute()
    this.setBaseline("l'ouverture")
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

  /** Fige la situation courante comme point de comparaison. */
  setBaseline(label = "l'ouverture") {
    this.baseline = snapshot(this.result)
    this.baselineLabel = label
  }

  get persona() { return this.scenario?.meta?.persona || 'founder' }
  setPersona(key) {
    this.update((s) => { s.meta.persona = key }, { label: 'Changement de vue' })
  }
  emit(reason = 'change') { for (const fn of this.listeners) fn(this, reason) }

  // ───────────────────────────── Profil ────────────────────────────────
  hasProfile() { return !!(this.profile && this.profile.name) }

  saveProfile(profile) {
    pushProfile(profile)
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

  create({ template, name, level = 'easy', sample = true } = {}) {
    const scenario = template ? scenarioFromTemplate(template, name, { sample }) : emptyScenario(name)
    scenario.meta.level = level
    this.scenarios[scenario.meta.id] = scenario
    this.currentId = scenario.meta.id
    this.scenario = scenario
    this.history = []; this.future = []
    this.persist()
    this.recompute()
    this.setBaseline("la création")
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
    this.setBaseline("l'ouverture")
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
    deletePlan(id)
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
    //
    // Une saisie silencieuse reste due à l'interface : tant qu'on ne l'a pas
    // annoncée, l'avancement, le guide et le pilotage lisent l'état d'avant.
    // On la note ; la sortie du champ la rend (voir flushSilent).
    this.silentPending = !!silent
    if (!silent) this.emit('data')
    // Après le redessin éventuel : ce qui suit une saisie — l'effet affiché à
    // côté du champ — trouve la page telle qu'elle est désormais.
    if (recompute) this.emit('saisie')
  }

  /**
   * Annoncer ce qui a été saisi en silence.
   *
   * Une description tapée dans Mon projet était enregistrée mais jamais
   * annoncée : l'étape restait « à poser » dans le pilotage, le compteur ne
   * bougeait pas, le guide continuait de la réclamer — jusqu'au changement de
   * page. L'application appelle ceci à la sortie de chaque champ.
   */
  flushSilent() {
    if (!this.silentPending) return false
    this.silentPending = false
    this.emit('data')
    return true
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

  // Les niveaux « facile / intermédiaire / expert » ont disparu : personne ne
  // sait répondre à « es-tu débutant ? », et la mauvaise réponse cachait
  // des réglages utiles à ceux qui en avaient besoin. Le modèle est le même
  // pour tout le monde ; la profondeur se demande là où elle sert, au moyen
  // d'un « affiner ». Ce getter reste, figé, pour que le code qui n'a pas
  // encore été converti n'aille rien masquer.
  get level() { return 'advanced' }

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
    // Le compte reçoit le plan courant seulement : pousser les soixante à
    // chaque frappe coûterait cher pour rien.
    if (this.scenario) pushPlan(this.scenario)
    return ok
  }

  /* ─────────────────────────────── Le compte ───────────────────────────── */

  /**
   * Ouvre la session et réconcilie. Appelé une fois au démarrage.
   *
   * Un plan présent des deux côtés est arbitré par sa date ; un plan qui
   * n'existe que d'un côté est conservé. On ne supprime jamais rien au nom
   * d'une synchronisation : l'utilisateur seul supprime.
   */
  async syncAccount() {
    await connect()
    if (!isOnline()) { this.emit('account'); return }

    const remote = await pullPlans()
    let changed = false

    for (const plan of remote) {
      const id = plan.meta?.id
      if (!id) continue
      const mine = this.scenarios[id]
      if (!mine || (Number(plan.meta.updatedAt) || 0) > (Number(mine.meta?.updatedAt) || 0)) {
        this.scenarios[id] = migrate(plan)
        changed = true
      }
    }

    // Les plans nés sur cette machine et jamais poussés montent maintenant.
    const remoteIds = new Set(remote.map((p) => p.meta?.id))
    for (const [id, plan] of Object.entries(this.scenarios)) {
      if (!remoteIds.has(id) && !plan.meta?.isDemo) pushPlan(plan)
    }
    if (this.profile) pushProfile(this.profile)

    // Un compte qui contient déjà des plans n'a pas besoin de l'exemple.
    if (remote.length && this.scenario?.meta?.isDemo) {
      const newest = remote[0]
      if (newest?.meta?.id) { this.load(newest.meta.id, { silent: true }); changed = true }
    } else if (changed && this.currentId && this.scenarios[this.currentId]) {
      this.load(this.currentId, { silent: true })
    }

    write(KEY_SCENARIOS, this.scenarios)
    this.watchRemote()
    this.emit(changed ? 'scenario' : 'account')
  }

  /** Une modification faite sur un autre appareil arrive ici. */
  watchRemote() {
    if (this.unwatch) this.unwatch()
    this.unwatch = watchPlans((remote) => {
      let changed = false
      for (const plan of remote) {
        const id = plan.meta?.id
        if (!id) continue
        const mine = this.scenarios[id]
        if (!mine || (Number(plan.meta.updatedAt) || 0) > (Number(mine.meta?.updatedAt) || 0)) {
          this.scenarios[id] = migrate(plan)
          changed = true
        }
      }
      if (!changed) { this.emit('account'); return }
      write(KEY_SCENARIOS, this.scenarios)
      // Ne pas arracher la page sous les doigts : on ne recharge le plan
      // courant que s'il a lui-même changé ailleurs.
      if (this.currentId && this.scenarios[this.currentId]) this.load(this.currentId, { silent: true })
      this.emit('scenario')
    })
  }

  /**
   * Franchissement d'étape : la date est conservée dans le plan.
   *
   * L'état d'une étape reste déduit des données — on ne coche rien — mais
   * savoir *quand* elle a été franchie est une information que le fondateur
   * perdrait à chaque rechargement si on ne l'écrivait pas.
   */
  backfillSteps(keys) {
    if (!keys?.length || !this.scenario) return
    const done = this.scenario.meta.stepsDoneAt || (this.scenario.meta.stepsDoneAt = {})
    const when = Number(this.scenario.meta.updatedAt) || Date.now()
    let touched = false
    for (const k of keys) if (!done[k]) { done[k] = when; touched = true }
    if (touched) { this.scenarios[this.scenario.meta.id] = this.scenario; write(KEY_SCENARIOS, this.scenarios) }
  }

  markSteps(keys) {
    if (!keys?.length || !this.scenario) return
    const done = this.scenario.meta.stepsDoneAt || (this.scenario.meta.stepsDoneAt = {})
    let touched = false
    for (const k of keys) if (!done[k]) { done[k] = Date.now(); touched = true }
    if (touched) { this.scenarios[this.scenario.meta.id] = this.scenario; this.scheduleSave() }
  }

  // ──────────────────────────── Import / export ─────────────────────────
  exportJSON() {
    return JSON.stringify({ kind: 'fynomia-scenario', version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), profile: this.profile, scenario: this.scenario }, null, 2)
  }

  importJSON(text) {
    const data = JSON.parse(text)
    const scenario = data.scenario || data
    if (!scenario.meta || !scenario.activities) throw new Error("Ce fichier n'est pas un scénario Fynomia valide.")
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

/**
 * Instantané des indicateurs suivis par le rail d'impact.
 * Volontairement restreint : comparer tout le modèle n'apprendrait rien.
 */
function snapshot(result) {
  if (!result) return null
  const i = result.pnl.netResult.findIndex((v) => v > 0)
  const y = i >= 0 ? i : 2
  return {
    year: y,
    revenue: result.pnl.revenue[y],
    ebe: result.pnl.ebe[y],
    breakEven: result.kpis.breakEven[y],
    fundingNeed: result.kpis.fundingNeed,
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
  if (!s.meta.persona) s.meta.persona = 'founder'
  s.financing = { openingCash: 0, equityFounders: [], equityInvestors: [], loans: [], grants: [], advances: [], shareholderLoans: [], ...(s.financing || {}) }
  for (const a of s.activities) {
    a.volumes = a.volumes || { mode: 'growth', launchMonth: 0, startUnits: 0, monthlyGrowth: 0, manual: [] }
    if (a.volumes.growthDecay === undefined) a.volumes.growthDecay = 0.96
  }
  // Les avantages étaient saisis poste par poste ; ils relèvent de l'entreprise.
  // On remonte le plus généreux de ce qui avait été saisi, puis on oublie le reste.
  s.hr = s.hr || {}
  if (!s.hr.benefits) {
    const merged = {}
    for (const m of s.team) {
      for (const [k, v] of Object.entries(m.benefits || {})) merged[k] = Math.max(merged[k] || 0, Number(v) || 0)
    }
    s.hr.benefits = Object.keys(merged).length ? merged : { mutuelle: 45 }
  }
  for (const m of s.team) delete m.benefits
  s.version = SCHEMA_VERSION
  return s
}

export const store = new Store()
export default store

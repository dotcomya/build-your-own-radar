/**
 * Le compte et la synchronisation.
 *
 * Jusqu'ici tout vivait dans le navigateur : fermer l'onglet gardait le
 * travail, changer d'ordinateur le perdait. Ce module ajoute la couche qui
 * manquait — une identité, et des plans qui suivent leur auteur d'une machine
 * à l'autre.
 *
 * L'identité ne vient pas d'un couple courriel / mot de passe que Fizzy
 * inventerait : elle vient de la session déjà authentifiée dans laquelle la
 * page s'exécute. C'est un choix, et il est délibéré — stocker des empreintes
 * de mots de passe dans une base que chaque lecteur de la page peut interroger
 * serait une faille, pas une fonctionnalité. Le compte est donc réel, l'adresse
 * affichée est la vraie, et aucun secret n'est conservé par l'application.
 *
 * Chaque plan est un document sous `data/users/<id>/`, un espace que le
 * serveur réserve à son propriétaire : personne d'autre ne peut le lire, pas
 * même le propriétaire de la page.
 *
 * Et quand rien de tout cela n'est disponible — page ouverte depuis un fichier,
 * hébergement statique — l'application continue de fonctionner en local. La
 * synchronisation est un gain, jamais une condition.
 */

const PLANS = 'plans'

/** État observable de la couche distante. */
export const cloud = {
  status: 'checking',   // checking · off · ready · error
  id: null,
  name: '',
  email: null,
  lastSync: null,
  error: null,
  listeners: new Set(),
}

const emit = () => { for (const fn of cloud.listeners) fn(cloud) }
export function onCloud(fn) { cloud.listeners.add(fn); return () => cloud.listeners.delete(fn) }

const set = (patch) => { Object.assign(cloud, patch); emit() }

let db = null
let root = null          // référence du document de profil, porte la collection

/**
 * Ouvre la session. Résout toujours — l'absence de compte est un état normal,
 * pas une erreur à remonter à l'utilisateur.
 */
export async function connect() {
  try {
    if (typeof window === 'undefined' || typeof window.claude?.use !== 'function') {
      set({ status: 'off' }); return cloud
    }
    const [user, database] = await Promise.all([
      window.claude.use('user').catch(() => null),
      window.claude.use('db').catch(() => null),
    ])
    if (!user || !database) { set({ status: 'off' }); return cloud }

    const me = await user.me()
    if (!me?.id) { set({ status: 'off' }); return cloud }

    db = database
    root = db.doc(`data/users/${me.id}/profile`)
    set({ status: 'ready', id: me.id, name: me.name || '', email: me.email || null, error: null })
    return cloud
  } catch (err) {
    set({ status: 'off', error: String(err?.code || err?.message || err) })
    return cloud
  }
}

export const isOnline = () => cloud.status === 'ready'

/* ───────────────────────────── Lecture / écriture ───────────────────────── */

/**
 * Tous les plans du compte, du plus récemment modifié au plus ancien.
 * Renvoie un tableau vide plutôt que d'échouer : l'application doit démarrer.
 */
export async function pullPlans() {
  if (!isOnline()) return []
  try {
    const snap = await root.collection(PLANS).orderBy('updatedAt', 'desc').limit(60).get()
    const out = []
    for (const doc of snap.docs) {
      const body = doc.data()
      if (body?.scenario?.meta) out.push(body.scenario)
    }
    set({ lastSync: Date.now(), error: null })
    return out
  } catch (err) {
    set({ error: err?.code || 'unavailable' })
    return []
  }
}

/** Écrit un plan. Le document porte aussi ses dates, pour pouvoir trier. */
export async function pushPlan(scenario) {
  if (!isOnline() || !scenario?.meta?.id) return false
  try {
    await root.collection(PLANS).doc(scenario.meta.id).set({
      scenario,
      name: String(scenario.meta.name || ''),
      updatedAt: Number(scenario.meta.updatedAt) || Date.now(),
      schema: Number(scenario.version) || 1,
    })
    set({ lastSync: Date.now(), error: null })
    return true
  } catch (err) {
    // Un document trop gros ou un quota atteint doivent se voir : l'utilisateur
    // croirait sinon son travail sauvegardé alors qu'il ne l'est pas.
    set({ error: err?.code || 'unavailable' })
    return false
  }
}

export async function deletePlan(id) {
  if (!isOnline() || !id) return false
  try { await root.collection(PLANS).doc(id).delete(); set({ lastSync: Date.now() }); return true }
  catch (err) { set({ error: err?.code || 'unavailable' }); return false }
}

/**
 * Le profil : ce qui vaut pour le compte entier, pas pour un plan.
 * Le document de profil doit exister avant de porter une sous-collection.
 */
export async function pushProfile(profile) {
  if (!isOnline()) return false
  try {
    await root.set({
      name: String(profile?.name || ''),
      role: String(profile?.role || ''),
      updatedAt: Date.now(),
    })
    return true
  } catch { return false }
}

export async function pullProfile() {
  if (!isOnline()) return null
  try {
    const snap = await root.get()
    return snap.exists ? snap.data() : null
  } catch { return null }
}

/**
 * Surveille les écritures faites depuis un autre appareil.
 * `fn` reçoit la liste des plans à chaque changement côté serveur.
 */
export function watchPlans(fn) {
  if (!isOnline()) return () => {}
  try {
    return root.collection(PLANS).orderBy('updatedAt', 'desc').limit(60).onSnapshot(
      (snap) => {
        // Une livraison qui ne contient que nos propres écritures en attente ne
        // nous apprend rien : on ne redessine que sur un état confirmé.
        if (snap.metadata.hasPendingWrites) return
        const out = []
        for (const doc of snap.docs) {
          const body = doc.data()
          if (body?.scenario?.meta) out.push(body.scenario)
        }
        set({ lastSync: Date.now() })
        fn(out)
      },
      (err) => set({ error: err?.code || 'unavailable' }),
    )
  } catch { return () => {} }
}

/** « il y a 2 min », pour l'indicateur de synchronisation. */
export function syncLabel() {
  if (cloud.status === 'checking') return 'Connexion…'
  if (cloud.status !== 'ready') return 'Sur cet appareil'
  if (cloud.error) return 'Synchronisation interrompue'
  if (!cloud.lastSync) return 'Compte connecté'
  const s = Math.round((Date.now() - cloud.lastSync) / 1000)
  if (s < 5) return 'Synchronisé'
  if (s < 60) return `Synchronisé il y a ${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `Synchronisé il y a ${m} min`
  return `Synchronisé il y a ${Math.round(m / 60)} h`
}

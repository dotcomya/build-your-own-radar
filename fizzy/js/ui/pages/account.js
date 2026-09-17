/**
 * Mon compte.
 *
 * Ce que l'utilisateur veut savoir tient en trois réponses : qui je suis, où
 * sont mes plans, et est-ce que c'est sauvegardé. La page ne dit rien d'autre.
 *
 * Sur l'identité, Fizzy est explicite plutôt que magique : elle vient de la
 * session dans laquelle la page s'exécute, et l'application ne conserve aucun
 * secret. Une page qui prétendrait gérer elle-même des mots de passe, dans un
 * stockage que ses lecteurs peuvent interroger, mentirait.
 */

import { h, euro, toast, confirmDialog } from '../dom.js'
import { cloud, syncLabel } from '../../state/cloud.js'
import { journey, points } from '../../engine/journey.js'
import { relative } from './onboarding.js'
import store from '../../state/store.js'

export function renderAccount(navigate, refresh) {
  const online = cloud.status === 'ready'
  const plans = store.list()

  return h('div', { class: 'content narrow' },
    h('div', { class: 'page-head' },
      h('h1', {}, 'Mon compte'),
      h('p', {}, online
        ? 'Vos plans vous suivent sur tous vos appareils. Rien à sauvegarder à la main.'
        : "Vos plans sont enregistrés dans ce navigateur. Exportez-les pour les emporter."),
    ),

    identityCard(online),
    plansCard(plans, navigate, refresh),
    dataCard(navigate, refresh),
  )
}

/* ─────────────────────────────── Identité ───────────────────────────────── */

function identityCard(online) {
  const initial = (cloud.name || store.profile?.name || '?').trim().charAt(0).toUpperCase()

  return h('section', { class: `account-card ${online ? 'is-online' : ''}` },
    h('div', { class: 'account-id' },
      h('div', { class: 'account-avatar' }, initial),
      h('div', { class: 'account-who' },
        h('div', { class: 'account-name' }, cloud.name || store.profile?.name || 'Session locale'),
        cloud.email
          ? h('div', { class: 'account-mail' }, cloud.email)
          : h('div', { class: 'account-mail muted' },
              online ? 'Session vérifiée · aucun mot de passe conservé' : 'Aucun compte connecté'),
      ),
      h('span', { class: `account-badge ${online ? 'ok' : ''}` }, online ? 'Connecté' : 'Local'),
    ),

    h('div', { class: 'account-rows' },
      row('Sauvegarde', syncLabel(), online ? 'ok' : ''),
      row('Appareils', online
        ? 'Tous ceux où vous ouvrez Fizzy avec ce compte'
        : 'Ce navigateur uniquement'),
      row('Confidentialité', online
        ? 'Espace privé : personne d’autre n’y accède, pas même l’éditeur de la page'
        : 'Rien ne quitte cet appareil'),
      row('Identification', online
        ? 'Héritée de votre session — Fizzy ne stocke aucun identifiant'
        : 'Aucune'),
    ),

    !online ? h('p', { class: 'account-note' },
      "Fizzy n'a pas trouvé de session à laquelle rattacher vos plans. Tout continue de fonctionner : le travail est conservé dans ce navigateur, et l'export JSON vous permet de le reprendre ailleurs.",
    ) : null,
  )
}

const row = (label, value, tone = '') => h('div', { class: 'account-row' },
  h('span', { class: 'account-row-label' }, label),
  h('span', { class: `account-row-value ${tone}` }, value),
)

/* ─────────────────────────────── Les plans ──────────────────────────────── */

/**
 * Les plans, repliés.
 *
 * La liste occupait la moitié de la page pour une action qu'on fait une fois
 * par mois. Un chevron suffit : ouvert, on choisit ; fermé, on voit combien il
 * y en a et on passe.
 */
function plansCard(plans, navigate, refresh) {
  return h('details', { class: 'panel mt plans-fold' },
    h('summary', { class: 'panel-head' },
      h('h2', {}, `Mes plans`),
      h('p', { class: 'panel-sub' }, `${plans.length} plan${plans.length > 1 ? 's' : ''} · le dernier modifié en premier`),
      h('span', { class: 'plans-chevron', 'aria-hidden': 'true' }, '\u203A'),
    ),
    h('div', { class: 'plan-list' },
      ...plans.map((p) => planRow(p, navigate, refresh)),
    ),
    h('div', { class: 'panel-body' },
      h('button', { class: 'btn', onClick: () => navigate('#/demarrer') }, '＋ Nouveau plan'),
    ),
  )
}

function planRow(meta, navigate, refresh) {
  const scenario = store.scenarios[meta.id]
  const current = store.currentId === meta.id
  let pct = null
  try {
    if (scenario) pct = points(journey(scenario, current ? store.result : null))
  } catch { /* un plan illisible ne doit pas casser la liste */ }

  return h('div', { class: `plan-row ${current ? 'current' : ''}` },
    h('button', {
      class: 'plan-open',
      onClick: () => { store.load(meta.id); navigate('#/parcours') },
    },
      h('span', { class: 'plan-name' }, meta.name || 'Sans titre'),
      h('span', { class: 'plan-meta' },
        current ? 'Ouvert' : `Modifié ${relative(meta.updatedAt)}`,
        scenario?.meta?.isDemo ? ' · exemple' : ''),
    ),
    pct !== null ? h('span', { class: 'plan-pct num' }, `${pct} %`) : null,
    h('button', {
      class: 'btn btn-sm btn-quiet', title: 'Dupliquer',
      onClick: () => { store.duplicate(meta.id); toast('Plan dupliqué.', 'ok'); refresh() },
    }, 'Dupliquer'),
    h('button', {
      class: 'btn btn-sm btn-quiet btn-danger', title: 'Supprimer',
      onClick: async () => {
        const ok = await confirmDialog({
          title: `Supprimer « ${meta.name} » ?`,
          message: "Le plan est retiré de cet appareil et de votre compte. C'est définitif.",
          confirmLabel: 'Supprimer', danger: true,
        })
        if (!ok) return
        store.remove(meta.id)
        toast('Plan supprimé.')
        refresh()
      },
    }, 'Supprimer'),
  )
}

/* ─────────────────────────── Emporter ses données ───────────────────────── */

function dataCard(navigate, refresh) {
  return h('section', { class: 'panel mt' },
    h('div', { class: 'panel-head' },
      h('h2', {}, 'Emporter mes données'),
      h('p', { class: 'panel-sub' }, "Un fichier JSON complet : vos chiffres vous appartiennent, et rien ne vous retient ici."),
    ),
    h('div', { class: 'panel-body row-wrap' },
      h('button', {
        class: 'btn',
        onClick: () => {
          const blob = new Blob([store.exportJSON()], { type: 'application/json' })
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = `${(store.scenario?.meta?.name || 'fizzy').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`
          document.body.appendChild(a); a.click(); a.remove()
          setTimeout(() => URL.revokeObjectURL(a.href), 4000)
        },
      }, 'Exporter ce plan'),
      h('label', { class: 'btn' }, 'Importer un fichier',
        h('input', {
          type: 'file', accept: 'application/json', style: { display: 'none' },
          onChange: async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            try {
              store.importJSON(await file.text())
              toast('Plan importé.', 'ok')
              navigate('#/parcours')
            } catch (err) { toast(err.message || "Fichier illisible.", 'err') }
          },
        }),
      ),
    ),
  )
}

/** Accueil : création du profil puis choix d'un point de départ. */

import { h, textField, selectField, toast } from '../dom.js'
import { TEMPLATES, LEVEL_META } from '../../state/schema.js'
import store from '../../state/store.js'

export function renderOnboarding(navigate) {
  return store.hasProfile() ? chooseStart(navigate) : createProfile(navigate)
}

function createProfile(navigate) {
  const draft = { name: '', company: '', role: '' }
  const submit = () => {
    if (!draft.name.trim()) { toast('Indiquez au moins votre prénom.', 'err'); return }
    store.saveProfile(draft)
    navigate('#/demarrer')
  }
  return h('div', { class: 'content', style: { maxWidth: '560px', paddingTop: '8vh' } },
    h('div', { class: 'center mb' },
      h('div', { class: 'rail-logo', style: { width: '52px', height: '52px', fontSize: '26px', margin: '0 auto 16px', borderRadius: '15px' } }, 'F'),
      h('h1', {}, 'Bienvenue sur Fizzy'),
      h('p', { class: 'muted', style: { marginTop: '8px' } },
        "Construisez un business plan qui tient debout : des chiffres liés entre eux, la fiscalité française appliquée automatiquement, et de quoi convaincre un banquier."),
    ),
    h('div', { class: 'card' },
      h('div', { class: 'card-body stack' },
        textField({ label: 'Votre prénom', value: draft.name, placeholder: 'Camille', onInput: (v) => { draft.name = v } }),
        textField({ label: 'Nom du projet ou de la société', value: draft.company, placeholder: 'Optionnel', onInput: (v) => { draft.company = v } }),
        selectField({
          label: 'Votre profil', value: draft.role,
          options: [
            { value: '', label: '— Sélectionnez —' },
            { value: 'student', label: "Étudiant, je découvre" },
            { value: 'founder', label: "Entrepreneur, je lance mon projet" },
            { value: 'manager', label: "Dirigeant, je pilote mon entreprise" },
            { value: 'consultant', label: "Consultant ou expert-comptable" },
          ],
          hint: "Fizzy adapte le niveau de détail proposé par défaut.",
          onInput: (v) => { draft.role = v },
        }),
        h('button', { class: 'btn btn-primary btn-lg btn-block', onClick: submit }, 'Commencer'),
        h('p', { class: 'tiny muted center', style: { margin: 0 } },
          "Vos données restent sur votre appareil. Aucun compte, aucun serveur, aucun envoi."),
      ),
    ),
  )
}

function chooseStart(navigate) {
  const existing = store.list()
  const start = (template) => {
    const level = store.profile?.role === 'consultant' ? 'advanced' : store.profile?.role === 'student' ? 'easy' : 'intermediate'
    const s = store.create({ template, level, name: template ? TEMPLATES[template].label : (store.profile?.company || 'Mon business plan') })
    toast(`« ${s.meta.name} » créé.`, 'ok')
    navigate('#/tableau-de-bord')
  }

  return h('div', { class: 'content', style: { maxWidth: '900px', paddingTop: '5vh' } },
    h('div', { class: 'page-head' },
      h('h1', {}, `Bonjour ${store.profile?.name || ''}`.trim()),
      h('p', {}, "Partez d'un modèle proche de votre activité — vous modifierez tout ensuite — ou d'une page blanche."),
    ),

    existing.length > 0 && h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Reprendre'), h('span', { class: 'spacer' })),
      h('div', { class: 'card-body', style: { paddingTop: '6px' } },
        ...existing.slice(0, 4).map((s) => h('div', { class: 'item' },
          h('div', {
            class: 'item-head',
            onClick: () => { store.load(s.id); navigate('#/tableau-de-bord') },
          },
            h('div', { class: 'spacer' },
              h('div', { class: 'item-title' }, s.name),
              h('div', { class: 'item-meta' }, `${LEVEL_META[s.level]?.label || s.level} · modifié ${relative(s.updatedAt)}`),
            ),
            h('span', { class: 'disclose' }, '›'),
          ),
        )),
      ),
    ),

    h('h2', { class: 'mb' }, 'Choisir un modèle'),
    h('div', { class: 'grid grid-3' },
      ...Object.entries(TEMPLATES).map(([key, tpl]) => h('button', {
        class: 'card',
        style: { textAlign: 'left', cursor: 'pointer', padding: '0', border: '1px solid var(--ink-200)', background: 'var(--paper)', font: 'inherit' },
        onClick: () => start(key),
      },
        h('div', { class: 'card-body' },
          h('div', { style: { fontSize: '22px', color: 'var(--brand-600)', marginBottom: '8px' } }, tpl.icon),
          h('h3', {}, tpl.label),
          h('p', { class: 'small muted', style: { margin: '5px 0 0' } }, tpl.description),
        ),
      )),
      h('button', {
        class: 'card',
        style: { textAlign: 'left', cursor: 'pointer', padding: '0', border: '1px dashed var(--ink-300)', background: 'transparent', font: 'inherit' },
        onClick: () => start(null),
      },
        h('div', { class: 'card-body' },
          h('div', { style: { fontSize: '22px', color: 'var(--ink-400)', marginBottom: '8px' } }, '＋'),
          h('h3', {}, 'Page blanche'),
          h('p', { class: 'small muted', style: { margin: '5px 0 0' } }, 'Tout construire depuis zéro.'),
        ),
      ),
    ),
  )
}

export function relative(ts) {
  const diff = Date.now() - ts
  const min = Math.round(diff / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const hr = Math.round(min / 60)
  if (hr < 24) return `il y a ${hr} h`
  const d = Math.round(hr / 24)
  if (d < 30) return `il y a ${d} j`
  return new Date(ts).toLocaleDateString('fr-FR')
}

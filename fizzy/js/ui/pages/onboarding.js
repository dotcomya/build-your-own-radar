/** Accueil : création du profil puis choix d'un point de départ. */

import { h, textField, selectField, toast } from '../dom.js'
import { LEVEL_META } from '../../state/schema.js'
import { sectorsByFamily, SECTORS } from '../../state/sectors.js'
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
    const s = store.create({ template, level, name: template ? SECTORS[template].label : (store.profile?.company || 'Mon business plan') })
    toast(`« ${s.meta.name} » créé.`, 'ok')
    navigate('#/tableau-de-bord')
  }

  return h('div', { class: 'content', style: { maxWidth: '1080px', paddingTop: '4vh' } },
    h('div', { class: 'page-head' },
      h('h1', {}, `Bonjour ${store.profile?.name || ''}`.trim()),
      h('p', {}, "Choisissez votre métier : Fizzy en tire le vocabulaire, le régime de TVA, les repères de marge et les pièges à éviter. Tout reste modifiable ensuite."),
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

    h('h2', { class: 'mb' }, 'Votre activité'),
    h('p', { class: 'muted', style: { marginTop: '-8px', marginBottom: '18px', maxWidth: '68ch' } },
      "Chaque métier a sa TVA, son régime social, ses repères de marge et ses pièges. Choisissez le vôtre : Fizzy adapte le vocabulaire, les hypothèses et les alertes."),

    ...sectorsByFamily().map((family) => h('div', { class: 'family' },
      h('div', { class: 'family-head' }, h('span', { class: 'eyebrow' }, family.label)),
      h('div', { class: 'sector-grid' },
        ...family.sectors.map((sector) => h('button', {
          class: 'sector-card',
          onClick: () => start(sector.key),
        },
          h('span', { class: 'sector-glyph' }, sector.glyph),
          h('span', { class: 'sector-name' }, sector.label),
          h('span', { class: 'sector-tag' }, sector.tagline),
          h('span', { class: 'sector-meta' },
            h('span', { class: 'chip chip-quiet' }, sector.vat.exempt ? 'TVA exonérée' : sector.vat.label),
            h('span', { class: 'chip chip-quiet' }, sector.legal.forms[0]),
          ),
        )),
      ),
    )),

    h('div', { class: 'family' },
      h('div', { class: 'family-head' }, h('span', { class: 'eyebrow' }, 'Autre')),
      h('div', { class: 'sector-grid' },
        h('button', { class: 'sector-card sector-blank', onClick: () => start(null) },
          h('span', { class: 'sector-glyph' }, '+'),
          h('span', { class: 'sector-name' }, 'Page blanche'),
          h('span', { class: 'sector-tag' }, "Tout construire depuis zéro, sans hypothèse de métier."),
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

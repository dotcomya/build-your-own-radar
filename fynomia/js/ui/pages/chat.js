/**
 * Le même parcours, en conversation.
 *
 * Certains remplissent un formulaire sans hésiter ; d'autres se figent devant
 * un champ vide et répondraient sans y penser à quelqu'un qui leur pose la
 * question. C'est la même information, demandée autrement — et ici, chaque
 * réponse s'écrit dans le plan au moment où elle est donnée.
 *
 * Tout se passe sur la machine : rien n'est envoyé nulle part, aucun modèle de
 * langage n'intervient. Les questions sont écrites, les réponses sont lues par
 * le même code que le reste de l'application. Une conversation, pas une
 * intelligence — et donc pas de réponse inventée.
 */

import { h, euro, num } from '../dom.js'
import { SECTORS, vocabulary } from '../../state/sectors.js'
import { FAMILIES, activitiesOf, getActivity, familyOf } from '../../state/activities.js'
import { LEGAL_FORMS } from '../../state/schema.js'
import { compute } from '../../engine/engine.js'
import store from '../../state/store.js'

const n = (v) => Number(String(v).replace(/\s/g, '').replace(',', '.')) || 0

/* ─────────────────────────────── Les tours ──────────────────────────────── */

/* La famille répondue au tour précédent : elle décide des métiers proposés au
   suivant. Cent trente-six boutons dans une conversation ne se lisent pas. */
const asked = { family: null }

const TURNS = [
  {
    key: 'famille',
    ask: () => 'Bonjour. On va poser ton business plan en quelques échanges — tu pourras tout reprendre ensuite. Tu es dans quel domaine ?',
    choices: () => FAMILIES.map((f) => ({ label: f.label, value: f.key })),
    apply: (value) => { asked.family = value },
    echo: (value) => `${familyOf(value)?.label}. Et plus précisément ?`,
  },
  {
    key: 'metier',
    ask: () => 'Ton métier, exactement ?',
    choices: () => activitiesOf(asked.family || FAMILIES[0].key).map((a) => ({ label: a.label, value: a.key })),
    apply: (value) => {
      const act = getActivity(value)
      if (!act) return
      store.create({ template: act.sector, level: 'easy', name: act.label, sample: false })
      store.update((d) => {
        d.meta.activityKey = act.key
        d.meta.activityLabel = act.label
        d.meta.unit = act.unit || null
      })
    },
    echo: (value) => `${getActivity(value)?.label}. Noté — la TVA et les repères de marge de ce métier sont appliqués.`,
  },
  {
    key: 'nom',
    ask: () => 'Ça s’appelle comment ?',
    input: 'text', placeholder: 'Le nom de ton projet',
    apply: (value) => store.update((sc) => { sc.meta.company = value; sc.meta.name = value }, { label: 'Nom', silent: true }),
    echo: (value) => `${value}. On continue.`,
  },
  {
    key: 'forme',
    ask: () => 'Sous quelle forme juridique ? Elle fixe ton statut social, donc le coût de ta rémunération.',
    choices: () => ['SASU', 'SAS', 'EURL', 'SARL', 'EI', 'BNC']
      .filter((k) => LEGAL_FORMS[k])
      .map((k) => ({ label: LEGAL_FORMS[k].label || k, value: k, note: LEGAL_FORMS[k].short })),
    apply: (value) => store.update((sc) => {
      sc.meta.legalForm = value
      sc.meta.legalFormChosen = true
      sc.founder.majorityManager = ['SARL', 'EURL'].includes(value)
    }, { label: 'Forme juridique', silent: true }),
    echo: (value) => `${value}. ${LEGAL_FORMS[value]?.note || ''}`.trim(),
  },
  {
    key: 'offre',
    ask: (s) => `Tu vends quoi ? Dis-le comme tu le dirais à un client — une ${vocabulary(s).one}, un forfait, un abonnement.`,
    input: 'text', placeholder: 'Le nom de ton offre',
    apply: (value) => store.update((sc) => { if (sc.activities[0]) sc.activities[0].name = value }, { label: 'Offre', silent: true }),
    echo: (value) => `« ${value} ». Bien.`,
  },
  {
    key: 'prix',
    ask: (s) => `Combien coûte une ${vocabulary(s).one} ?`,
    input: 'number', suffix: '€ HT', placeholder: '500',
    apply: (value) => store.update((sc) => { sc.activities[0].unitPrice = n(value) }, { label: 'Prix', silent: true }),
    echo: (value) => `${euro(n(value))}. Noté.`,
  },
  {
    key: 'cout',
    ask: (s) => `Et chaque ${vocabulary(s).one} vendue, elle te coûte combien à produire ? Matières, sous-traitance, commission — pas le loyer.`,
    input: 'number', suffix: '€ HT', placeholder: '0', skippable: true,
    apply: (value) => store.update((sc) => { sc.activities[0].unitCost = n(value) }, { label: 'Coût de revient', silent: true }),
    echo: (value, s) => {
      const a = s.activities[0]
      const m = (Number(a.unitPrice) || 0) - n(value)
      return `Il te reste ${euro(m)} de marge par vente.`
    },
  },
  {
    key: 'clients',
    ask: (s) => `Combien de ${vocabulary(s).many} le premier mois ? Pas une ambition : ce que tu peux livrer et facturer.`,
    input: 'number', placeholder: '3',
    apply: (value) => store.update((sc) => { sc.activities[0].volumes.startUnits = n(value) }, { label: 'Volumes', silent: true }),
    echo: (value) => `${num(n(value))} pour commencer.`,
  },
  {
    key: 'croissance',
    ask: () => 'Et ça grandit à quelle vitesse ?',
    choices: () => [
      { label: 'Doucement', value: '0.03', note: '+3 % par mois, le bouche-à-oreille' },
      { label: 'Normalement', value: '0.08', note: '+8 % par mois, tu prospectes' },
      { label: 'Vite', value: '0.15', note: '+15 % par mois, il faudra le démontrer' },
    ],
    apply: (value) => store.update((sc) => { sc.activities[0].volumes.monthlyGrowth = Number(value) }, { label: 'Croissance', silent: true }),
    echo: () => 'Fynomia freine la courbe dans la durée : aucune croissance ne tient cinq ans au même rythme.',
  },
  {
    key: 'salaire',
    ask: () => 'Tu te paies combien par mois ? Un plan où le fondateur ne se paie pas n’est pas prudent, il est faux.',
    input: 'number', suffix: '€ brut par mois', placeholder: '2500', skippable: true,
    apply: (value) => store.update((sc) => {
      const tns = ['SARL', 'EURL', 'EI', 'BNC'].includes(sc.meta.legalForm)
      const contrat = sc.meta.legalForm === 'MICRO' ? 'micro' : tns ? 'tns' : 'dirigeant'
      let me = sc.team.find((x) => /fondateur|dirigeant|moi/i.test(x.role || ''))
      if (!me) { me = { id: `tm${Date.now()}`, role: 'Moi', contractType: contrat, status: 'cadre', count: 1, monthlyGross: 0, startMonth: 0, enabled: true }; sc.team.push(me) }
      me.monthlyGross = n(value)
    }, { label: 'Rémunération', silent: true }),
    echo: (value) => `${euro(n(value))} brut par mois. Fynomia calcule ce que ça coûte à l’entreprise.`,
  },
  {
    key: 'depart',
    ask: () => 'Dernière question : tu démarres avec combien sur le compte ?',
    input: 'number', suffix: '€', placeholder: '10 000', skippable: true,
    apply: (value) => store.update((sc) => {
      sc.financing.equityFounders = n(value) > 0 ? [{ month: 0, amount: n(value) }] : []
    }, { label: 'Apport', silent: true }),
    echo: (value) => (n(value) > 0 ? `${euro(n(value))} d’apport.` : 'On part de zéro, c’est noté.'),
  },
]

/* ──────────────────────────────── L'écran ───────────────────────────────── */

const talk = { at: 0, said: [] }

export function resetChat() { asked.family = null; talk.at = 0; talk.said = [] }

export function renderChat(navigate, refresh) {
  const s = store.scenario
  const turn = TURNS[talk.at]
  const thread = h('div', { class: 'chat-thread' })

  for (const line of talk.said) {
    thread.appendChild(h('div', { class: `chat-line is-${line.who}` },
      h('div', { class: 'chat-bubble' }, line.text)))
  }

  if (turn) {
    thread.appendChild(h('div', { class: 'chat-line is-app' },
      h('div', { class: 'chat-bubble' }, typeof turn.ask === 'function' ? turn.ask(s) : turn.ask)))
  }

  const answer = (raw, label) => {
    talk.said.push({ who: 'app', text: typeof turn.ask === 'function' ? turn.ask(s) : turn.ask })
    talk.said.push({ who: 'me', text: label ?? String(raw) })
    turn.apply(raw)
    const after = store.scenario
    const echo = turn.echo ? turn.echo(raw, after) : null
    if (echo) talk.said.push({ who: 'app', text: echo })
    talk.at += 1
    refresh()
  }

  let composer = null
  if (turn && turn.choices) {
    composer = h('div', { class: 'chat-choices' },
      ...turn.choices().map((c) => h('button', {
        class: 'chat-choice',
        onClick: () => answer(c.value, c.label),
      },
        h('span', { class: 'chat-choice-label' }, c.label),
        c.note ? h('span', { class: 'chat-choice-note' }, c.note) : null,
      )),
    )
  } else if (turn) {
    const input = h('input', {
      class: 'chat-input', type: 'text', autocomplete: 'off',
      inputmode: turn.input === 'number' ? 'decimal' : null,
      placeholder: turn.placeholder || 'Ta réponse',
      onInput: (e) => {
        if (turn.input !== 'number') return
        const cleaned = e.target.value.replace(/[^0-9 .,]/g, '')
        if (cleaned !== e.target.value) e.target.value = cleaned
      },
      onKeyDown: (e) => { if (e.key === 'Enter' && e.target.value.trim()) answer(e.target.value.trim()) },
    })
    requestAnimationFrame(() => { try { input.focus({ preventScroll: true }) } catch { /* rien */ } })
    composer = h('div', { class: 'chat-composer' },
      h('div', { class: 'chat-field' },
        input,
        turn.suffix ? h('span', { class: 'chat-suffix' }, turn.suffix) : null,
      ),
      h('button', {
        class: 'btn btn-primary chat-send',
        onClick: () => { if (input.value.trim()) answer(input.value.trim()) },
      }, 'Répondre'),
      turn.skippable ? h('button', {
        class: 'chat-skip', onClick: () => { talk.at += 1; refresh() },
      }, 'Passer') : null,
    )
  }

  // Le fil terminé : ce que ça donne, et la sortie vers le logiciel.
  let ending = null
  if (!turn) {
    let r = null
    try { r = compute(store.scenario) } catch { /* rien à montrer */ }
    ending = h('div', { class: 'chat-end' },
      h('div', { class: 'chat-line is-app' },
        h('div', { class: 'chat-bubble' },
          r
            ? `Voilà. Ton chiffre d’affaires de première année ressort à ${euro(r.pnl.revenue[0], { compact: true })}, et la trésorerie touche son point bas à ${euro(r.kpis.cashLow.value, { compact: true })}. Tout se règle maintenant dans le logiciel.`
            : 'Voilà. Tout se règle maintenant dans le logiciel.')),
      h('div', { class: 'chat-actions' },
        h('button', { class: 'btn btn-primary btn-lg', onClick: () => { resetChat(); navigate('#/tableau-de-bord') } }, 'Voir mon business plan →'),
        h('button', { class: 'btn btn-lg btn-ghost', onClick: () => { resetChat(); refresh() } }, 'Recommencer'),
      ),
    )
  }

  return h('div', { class: 'chat' },
    h('div', { class: 'chat-head' },
      h('div', { class: 'chat-tag' },
        h('span', { class: 'chat-dot' }),
        `Conversation · ${Math.min(talk.at + 1, TURNS.length)} / ${TURNS.length}`),
      h('button', { class: 'chat-exit', onClick: () => navigate('#/creer') }, 'Répondre par formulaire'),
    ),
    thread,
    ending,
    composer,
    h('p', { class: 'chat-foot' },
      'Tout se passe sur ton appareil : aucune réponse n’est envoyée, aucun modèle de langage n’intervient.'),
  )
}

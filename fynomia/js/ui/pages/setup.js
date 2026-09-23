/**
 * Le parcours guidé — onze questions, une à la fois.
 *
 * Un prévisionnel demande une soixantaine de chiffres. Les demander tous sur le
 * même écran, c'est ce que fait un tableur, et c'est précisément ce qui fait
 * abandonner. On en demande donc onze, une par écran, dans l'ordre où ils se
 * répondent — et Fynomia déduit le reste.
 *
 * Trois règles tenues bout à bout :
 *
 *  1. UNE question par écran. Jamais deux idées à la fois.
 *  2. Le vocabulaire du fondateur, pas celui du comptable. On demande « tu
 *     démarres avec combien ? », pas « quel est ton plan de financement
 *     initial ». Le mot juste arrive plus tard, quand le chiffre est là.
 *  3. Chaque réponse produit immédiatement une conséquence visible. C'est ce
 *     qui distingue ce parcours d'un formulaire : on voit le modèle se
 *     construire sous soi.
 *
 * Rien n'est irréversible : on revient en arrière, et tout reste modifiable
 * ensuite dans les pages détaillées.
 */

import { h, euro, num, pct, toast, keystone } from '../dom.js'
import { getSector, vocabulary } from '../../state/sectors.js'
import { newTeamMember, newOpex } from '../../state/schema.js'
import { monthlyCost } from '../../engine/payroll.js'
import { compute } from '../../engine/engine.js'
import store from '../../state/store.js'
import { pfuTotal, PARAMS } from '../../engine/fiscal-fr-2026.js'
import { STAGES } from '../stages.js'
import { aConfirmerDepuis } from '../checklist.js'
import { openSynthesis } from './dashboard.js'
import { changed } from '../motion.js'
import { FAMILIES, activitiesOf, searchActivities, familyOf } from '../../state/activities.js'
import { familyIcon, icon } from '../icons.js'

/** Le poste du fondateur dans l'équipe, quel que soit le mot employé. */
const ME = new RegExp('fondateur|dirigeant|g\u00E9rant|moi', 'i')

/**
 * Où en est le parcours.
 *
 * `touched` retient les questions auxquelles l'utilisateur a effectivement
 * répondu. Ça sert à une chose précise : une valeur encore suggérée par le
 * métier est présélectionnée, pour que la première touche la remplace ; une
 * valeur qu'il a saisie ne l'est plus, pour qu'il puisse la corriger sans la
 * perdre.
 */
const flow = { index: 0, reach: 0, touched: new Set(), way: 'fwd', vides: new Set(), reperes: {} }

/** Où en est le choix du métier : la famille ouverte, et ce qui est tapé. */
const pick = { family: null, query: '' }

export function resetSetup() { flow.index = 0; flow.reach = 0; flow.touched = new Set(); flow.vides = new Set(); flow.reperes = {}; pick.family = null; pick.query = '' }

/**
 * La fin du parcours.
 *
 * Ce qui a été répondu est noté pour être relu : le guide et le pilotage le
 * proposeront en premier (voir checklist.js). Puis la page qui montre le
 * business prendre forme.
 */
function finirParcours(navigate) {
  const relire = aConfirmerDepuis(flow.touched)
  store.update((sc) => {
    sc.meta.onboardedAt = Date.now()
    sc.meta.aConfirmer = relire
    sc.meta.confirmes = {}
  }, { label: 'Parcours terminé', silent: true })
  resetSetup()
  navigate('#/ton-business')
}

/**
 * Rien de pré-rempli : la réponse est celle du fondateur.
 *
 * Le modèle du métier pose un prix, des volumes, des frais cochés — il le
 * faut, pour qu'un plan existe dès qu'on a choisi son activité. Mais dans le
 * parcours, un champ déjà rempli se lit comme une réponse déjà donnée : on
 * clique « Continuer » sur un prix qu'on n'a jamais choisi. À la première
 * arrivée sur une question, on efface donc ce que le modèle y avait mis, et
 * on garde sa valeur en repère, écrite sous le champ — une indication, pas
 * une réponse.
 */
function vider(key, lire, effacer) {
  // Seulement pour un plan né dans ce parcours, et une seule fois par
  // question : ce qui a été effacé est noté dans le plan, pour qu'un
  // rechargement de page n'efface pas une réponse déjà donnée.
  const m = store.scenario?.meta || {}
  if (!m.parcours || m.onboardedAt) return
  if (flow.touched.has(key) || flow.vides.has(key) || (m.parcoursVides || []).includes(key)) return
  flow.vides.add(key)
  let v = null
  try { v = lire(store.scenario) || null } catch { v = null }
  if (v) flow.reperes[key] = v
  store.update((sc) => {
    effacer(sc)
    sc.meta.parcoursVides = [...(sc.meta.parcoursVides || []), key]
    if (v) sc.meta.parcoursReperes = { ...(sc.meta.parcoursReperes || {}), [key]: v }
  }, { label: 'Parcours', silent: true })
}
const repere = (key) => flow.reperes[key] || store.scenario?.meta?.parcoursReperes?.[key] || null

const pad = (n) => String(n).padStart(2, '0')


/**
 * Une étape a-t-elle reçu une réponse ?
 *
 * On ne se fie pas à la valeur présente dans le scénario : un modèle de métier
 * en pose déjà quelques-unes, et « Continuer » s'ouvrait alors sur des réponses
 * que le fondateur n'avait jamais données. Seule sa frappe ou son clic comptent.
 */
const answered = (key) => flow.touched.has(key)

/* ──────────────────────────────── Les écrans ────────────────────────────── */

const STEPS = [
  {
    key: 'bienvenue', short: 'Avant de commencer',
    question: 'Rien de ce que tu vas écrire n’est définitif.',
    render: welcomeScreen,
    ready: () => true,
    bare: true,
  },
  {
    key: 'metier', short: 'Ton métier',
    question: 'Tu fais quoi ?',
    help: "Il fixe ta TVA, ton statut, et les repères chiffrés de la suite.",
    render: sectorPicker,
    // « Autre chose » est une réponse : elle ne pose pas de secteur mais elle
    // engage le fondateur autant qu'un métier de la liste.
    ready: (s) => !!s?.meta?.sectorKey || answered('metier'),
  },
  {
    key: 'stade', short: 'Où tu en es',
    question: 'Où en est ton projet, aujourd’hui ?',
    help: 'Ça ne change aucun chiffre, seulement l’ordre des questions.',
    render: stageScreen,
    ready: (s) => !!s?.meta?.stage,
  },
  {
    key: 'nom', short: 'Le nom',
    question: 'Ça s’appelle comment ?',
    help: 'Modifiable à tout moment.',
    render: (ctx) => field(ctx, {
      type: 'text', placeholder: 'Mon projet',
      value: (s) => s.meta.company || '',
      apply: (s, v) => { s.meta.company = v; if (v.trim()) s.meta.name = v.trim() },
    }),
    ready: (s) => !!(s?.meta?.company || '').trim(),
  },
  {
    key: 'forme', short: 'La forme juridique',
    question: 'Sous quelle forme ?',
    help: "Elle décide de ce que te coûte ta propre rémunération.",
    render: legalScreen,
    // Une forme est posée par défaut dans tout scénario pour que le moteur
    // tourne. Elle n'est pas un choix : il faut que le fondateur en désigne une.
    ready: (s) => answered('forme') || s?.meta?.legalFormChosen === true,
  },
  {
    key: 'depart', short: 'La mise de départ',
    question: 'Tu démarres avec combien ?',
    help: "Ce que tu mets sur la table : ton apport et celui de tes associés.",
    optional: true,
    render: cashScreen,
    ready: () => answered('depart'),
  },
  {
    key: 'offre', short: 'Ton produit phare',
    question: 'Quel est ton produit phare ?',
    // Beaucoup ont dix produits et bloquaient ici : lequel mettre ? Le
    // principal — les autres s'ajoutent ensuite, un par un.
    help: 'Celui qui te rapportera le plus. Tu en as plusieurs ? Mets le principal ici : tu ajouteras les autres ensuite, dans Offre et revenus.',
    render: (ctx) => {
      vider('offre', (sc) => (sc.activities[0]?.name && sc.activities[0].name !== 'À définir' ? sc.activities[0].name : null), (sc) => { if (sc.activities[0]) sc.activities[0].name = 'À définir' })
      return field(ctx, {
        type: 'text', placeholder: (s) => vocabulary(s).one,
        value: (s) => (s.activities[0]?.name === 'À définir' ? '' : s.activities[0]?.name || ''),
        apply: (s, v) => { if (s.activities[0]) s.activities[0].name = v.trim() || 'Mon offre' },
        repere: repere('offre') ? `Dans ton métier, on dit souvent « ${repere('offre')} ».` : null,
      })
    },
    ready: (s) => {
      const n = (s?.activities?.[0]?.name || '').trim()
      return !!n && n !== 'À définir'
    },
  },
  {
    key: 'prix', short: 'Son prix',
    question: (s) => {
      const nom = (s?.activities?.[0]?.name || '').trim()
      return nom && nom !== 'À définir' ? `Comment ton client paie « ${nom} » ?` : 'Comment ton client paie ton produit phare ?'
    },
    help: 'Choisis comment il paie, puis indique son prix moyen, hors taxes.',
    render: priceScreen,
    ready: (s) => (Number(s?.activities?.[0]?.unitPrice) || 0) > 0 || (Number(s?.activities?.[0]?.recurringPrice) || 0) > 0,
  },
  {
    key: 'salaire', short: 'Ta rémunération',
    question: 'Tu te paies combien ?',
    help: "Un plan où tu ne te paies pas n'est pas prudent, il est faux. Fynomia chiffre ce que ça coûte.",
    optional: true,
    render: salaryScreen,
    ready: () => answered('salaire'),
  },
  {
    key: 'frais', short: 'Tes frais fixes',
    question: 'Tes frais tous les mois',
    help: 'Coche ce qui te concerne. Tu pourras en ajouter plus tard.',
    optional: true,
    render: costsScreen,
    ready: () => answered('frais'),
  },
  {
    key: 'clients', short: 'Tes premières ventes',
    question: 'Combien en vends-tu le premier mois ?',
    help: "De ton produit phare. Ce que tu peux vraiment livrer et facturer au démarrage, pas une ambition.",
    render: clientsScreen,
    ready: (s) => (Number(s?.activities?.[0]?.volumes?.startUnits) || 0) > 0,
  },
  {
    key: 'cout', short: 'Le coût de revient',
    // On ne demande le coût de revient qu'ici, une fois les frais connus : sans
    // ce repère, « ce que ça te coûte de produire » ne veut rien dire pour
    // quelqu'un qui n'a jamais tenu de comptabilité — et la confusion la plus
    // fréquente est justement d'y ranger le loyer ou le comptable.
    question: 'Et chaque vente, elle te coûte combien ?',
    help: "Ce qui augmente quand tu vends une unité de plus. Ni le loyer, ni le comptable.",
    optional: true,
    render: costScreen,
    ready: () => answered('cout'),
  },
  {
    key: 'croissance', short: 'La croissance',
    question: 'Ça grandit à quelle vitesse ?',
    help: 'Aucune croissance ne tient cinq ans au même rythme : Fynomia freine la courbe.',
    optional: true,
    render: growthScreen,
    ready: () => answered('croissance'),
  },
  {
    key: 'fin', short: 'Le résultat',
    question: 'C’est fait : ton modèle est calculé',
    help: 'Ces chiffres sortent de tes réponses. Tout se modifie ensuite, champ par champ.',
    render: doneScreen,
    ready: () => true,
    last: true,
  },

]

/**
 * Combien de questions sont vraiment posées.
 *
 * Le compte était tiré de la longueur du tableau : la page d'ouverture et
 * l'écran de résultat passaient pour des questions, et l'écran annonçait
 * treize là où la barre latérale en listait douze. On les compte.
 */
const QUESTIONS = STEPS.filter((st) => !st.bare && !st.last).length

/* ─────────────────────────────── La page ────────────────────────────────── */

export function renderSetup(navigate, refresh) {
  const s = store.scenario
  const step = STEPS[Math.min(flow.index, STEPS.length - 1)]

  const ctx = { navigate, refresh, scenario: s, step }

  // Le sens du pas, retenu pour l'animation : on avance, la question suivante
  // vient de la droite ; on revient, elle vient de la gauche. Rien de plus —
  // mais sans ce sens, douze écrans se succèdent sans qu'on sente avancer.
  const go = (delta) => {
    const next = flow.index + delta
    if (next < 0 || next >= STEPS.length) { if (next >= STEPS.length) navigate('#/parcours'); return }
    // La dernière réponse donnée, on ne montre pas un écran de résultat de
    // plus : on emmène voir le business prendre forme.
    if (delta > 0 && STEPS[next].last) { finirParcours(navigate); return }
    flow.way = delta >= 0 ? 'fwd' : 'back'
    flow.index = next
    flow.reach = Math.max(flow.reach, next)
    refresh()
  }

  // « Je ne sais pas encore » avance sans répondre.
  //
  // Le modèle du métier a déjà posé une valeur pour que le moteur tourne ; on
  // la garde, on n'enregistre aucun choix, et la ligne reste dans ce qu'il y a
  // à confirmer plus tard. C'est la différence entre une hypothèse assumée et
  // une réponse donnée — et c'est ce que le tableau de bord compte.
  ctx.later = () => go(1)

  /**
   * La liste de gauche revient en arrière, elle n'avance pas.
   *
   * Les numéros étaient des raccourcis vers n'importe quelle question : trois
   * clics et on arrivait au résultat sans avoir rien répondu, avec un modèle
   * fabriqué de bout en bout par les valeurs du métier. Le parcours ne veut pas
   * dire grand-chose dans ces conditions, et le tableau de bord qui suit encore
   * moins.
   *
   * On ne peut donc revenir que sur ce qu'on a déjà vu. Pour aller vite, il
   * reste « Plus tard » : c'est une réponse, elle est assumée, et l'outil sait
   * qu'il lui manque cette ligne.
   */
  const jump = (i) => {
    if (i > flow.reach) return
    flow.way = i >= flow.index ? 'fwd' : 'back'
    flow.index = i
    refresh()
  }
  ctx.go = go

  // Les nœuds que la frappe met à jour. Tout le reste — la question, le champ,
  // la liste des étapes — reste en place : un champ qui se recrée à chaque
  // touche perd le curseur, et la frappe suivante écrase la précédente.
  const nextBtn = h('button', {
    class: 'btn btn-primary btn-lg',
    onClick: () => go(1),
  }, flow.index === STEPS.length - 2 ? 'Voir mon business prendre forme' : 'Continuer')

  // Le récapitulatif qui s'affichait à droite est parti : il montrait des
  // chiffres que l'utilisateur n'avait pas encore donnés — des valeurs de
  // métier, des charges suggérées — et personne ne pouvait savoir d'où elles
  // venaient. Le résultat se lit à la fin du parcours, une fois qu'il est à soi.
  // La ligne sous le bouton : pourquoi il attend, ou comment le contourner.
  // Elle vit avec le bouton — c'est-à-dire qu'elle se met à jour à la frappe,
  // sans redessiner la question — sinon le reproche restait affiché une fois la
  // réponse donnée.
  // « Cette réponse-là fait tourner le calcul : sans elle, la suite serait
  // inventée. » Elle s'affichait sous chaque question obligatoire, identique à
  // elle-même, à côté d'un bouton déjà gris : elle expliquait une évidence et
  // faisait bouger l'écran en apparaissant. Seule reste la phrase qui apprend
  // quelque chose — qu'on a le droit de passer.
  const hint = h('p', { class: 'setup-reassure' },
    step.optional ? 'Tu peux passer cette question et y revenir plus tard.' : '')

  ctx.tick = () => {
    const live = store.scenario
    ctx.scenario = live
    const ok = step.ready(live)
    nextBtn.disabled = !ok
    nextBtn.classList.toggle('is-waiting', !ok)
    hint.hidden = !step.optional || ok
  }
  // Ajouter ou retirer une ligne change la question elle-même (une personne de
  // plus dans l'équipe, par exemple) : là, on redessine tout.
  ctx.redraw = () => refresh()

  const body = h('div', { class: 'setup-body' }, step.render(ctx))
  const ready = step.ready(s)
  nextBtn.disabled = !ready
  if (!ready) nextBtn.classList.add('is-waiting')
  hint.hidden = ready && !step.optional
  return h('div', { class: 'setup' },
    h('div', { class: 'setup-bar' },
      h('div', { class: 'setup-bar-fill', style: { width: `${(flow.index / (STEPS.length - 1)) * 100}%` } }),
    ),

    h('div', { class: 'setup-shell' },
      stepList(s, jump, navigate),

      h('div', { class: 'setup-main' },
        // Le bandeau « Rien n'est définitif » est parti.
        //
        // Il répétait, en trois lignes et sur chaque écran, ce que la colonne
        // de gauche annonce déjà d'un trait : « 12 questions · tout reste
        // modifiable ». Deux fois la même promesse, dont l'une occupait le
        // haut de la page à chaque question.

        // L'ouverture n'est pas une question.
        //
        // Elle portait pourtant tout l'attirail : « Question 01 / 12 », un
        // titre, et un « Continuer » sous le bouton
        // « Commencer » qui faisait exactement la même chose. Trois façons de
        // dire la même chose sur le premier écran qu'on voit du produit. Un
        // écran marqué `bare` n'en garde aucune : il se présente seul.
        h('div', {
          class: `setup-card ${step.last ? 'is-last' : ''} ${step.bare ? 'is-bare' : ''}`
            + (changed('setup-step', flow.index) ? ` is-in-${flow.way || 'fwd'}` : ''),
        },
          !step.bare ? h('div', { class: 'setup-tag' },
            h('span', { class: 'setup-tag-bar' }),
            h('span', {}, step.last ? 'Résultat' : `Question ${pad(flow.index)} / ${pad(QUESTIONS)}`),
            step.optional ? h('span', { class: 'setup-tag-opt' }, 'facultatif') : null,
          ) : null,
          !step.bare ? h('h1', { class: 'setup-q' }, typeof step.question === 'function' ? step.question(s) : step.question) : null,
          step.help && !step.bare ? h('p', { class: 'setup-help' }, typeof step.help === 'function' ? step.help(s) : step.help) : null,
          body,
          !step.last && !step.bare ? h('div', {},
            h('div', { class: 'setup-actions' },
              flow.index > 0 ? h('button', { class: 'btn btn-lg btn-ghost', onClick: () => go(-1) }, 'Retour') : null,
              nextBtn,
              step.optional ? h('button', { class: 'setup-later', onClick: () => go(1) }, 'Plus tard') : null,
            ),
            hint,
          ) : null,
        ),
      ),
    ),
  )
}

/**
 * La liste des questions, à gauche.
 *
 * Elle enlève au parcours ce qu'il avait de rigide : on voit tout ce qui sera
 * demandé, on saute où l'on veut, on revient. Un fondateur qui ne connaît pas
 * encore son prix doit pouvoir passer à la suite et y revenir, pas se cogner à
 * un bouton grisé.
 */
function stepList(s, jump, navigate) {
  return h('nav', { class: 'setup-steps', 'aria-label': 'Les questions' },
    h('div', { class: 'setup-steps-head' },
      h('span', { class: 'setup-steps-title' }, 'Ton business plan'),
      h('span', { class: 'setup-steps-sub' }, `${QUESTIONS} questions · tout reste modifiable`),
    ),
    ...STEPS.map((st, i) => {
      const done = i < flow.index && st.ready(s)
      const shut = i > flow.reach
      return h('button', {
        class: `setup-step ${i === flow.index ? 'current' : ''} ${done ? 'done' : ''} ${shut ? 'is-shut' : ''}`,
        disabled: shut,
        title: shut
          ? 'On y viendra. Réponds à la question ouverte — ou dis « Plus tard » quand c’est proposé.'
          : st.short || '',
        onClick: () => jump(i),
      },
        h('span', { class: 'setup-step-dot' }, done ? '\u2713' : String(i + 1)),
        h('span', { class: 'setup-step-label' }, st.short || st.question),
      )
    }),
    s ? h('button', { class: 'setup-steps-exit', onClick: () => navigate('#/parcours') }, 'Ouvrir le logiciel complet') : null,
  )
}

/** Les plans déjà commencés, pour y revenir sans passer par une page d'accueil. */
function resumeLinks(navigate) {
  const plans = store.list().filter((p) => p.id !== store.currentId)
  if (!plans.length) return null
  return h('div', { class: 'setup-resume' },
    h('span', { class: 'setup-resume-tag' }, 'Reprendre'),
    ...plans.slice(0, 3).map((p) => h('button', {
      class: 'setup-resume-item',
      onClick: () => { store.load(p.id); navigate('#/tableau-de-bord') },
    }, p.name)),
  )
}

/* ────────────────────────────── Les contrôles ───────────────────────────── */

/**
 * Le champ.
 *
 * Il n'est créé qu'une fois par question et ne se redessine jamais pendant la
 * frappe : on écrit dans le scénario, puis on met à jour l'écho et le bouton,
 * rien d'autre. Un champ recréé à chaque touche perd le curseur — et s'il est
 * resélectionné au passage, chaque lettre efface la précédente.
 */
function field(ctx, { type, placeholder, value, apply, suffix, libelle = null, repere: indice = null }) {
  const initial = value(ctx.scenario)
  const input = h('input', {
    class: 'setup-input',
    type: 'text',
    inputmode: type === 'number' ? 'decimal' : null,
    autocomplete: 'off', spellcheck: 'false',
    value: initial === '' || initial === null || initial === undefined ? '' : String(initial),
    placeholder: typeof placeholder === 'function' ? placeholder(ctx.scenario) : placeholder,
    onInput: (e) => {
      // Une question chiffrée n'accepte que des chiffres. Taper « abc » dans
      // « tu démarres avec combien ? » laissait le champ plein de lettres, la
      // valeur à zéro, et l'étape franchissable : on croyait avoir répondu.
      if (type === 'number') {
        const cleaned = e.target.value.replace(/[^0-9 .,-]/g, '')
        if (cleaned !== e.target.value) {
          const at = Math.max(0, e.target.selectionStart - (e.target.value.length - cleaned.length))
          e.target.value = cleaned
          try { e.target.setSelectionRange(at, at) } catch { /* champ sans sélection */ }
        }
      }
      const raw = e.target.value
      const v = type === 'number' ? (parseFloat(raw.replace(/\s/g, '').replace(',', '.')) || 0) : raw
      // Une réponse compte quand elle est lisible : un champ vide, ou qui ne
      // contient qu'un séparateur, n'en est pas une.
      const answered = type === 'number' ? /[0-9]/.test(raw) : raw.trim() !== ''
      if (answered) flow.touched.add(ctx.step.key)
      else flow.touched.delete(ctx.step.key)
      store.update((sc) => apply(sc, v), { label: ctx.step.question, silent: true })
      ctx.tick()
    },
    onKeyDown: (e) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      if (ctx.step.ready(store.scenario)) ctx.go(1)
    },
  })

  // Le focus est posé une fois, à l'arrivée sur la question ; une réponse
  // déjà donnée ne se sélectionne pas — on vient la corriger, pas la refaire.
  requestAnimationFrame(() => {
    input.focus({ preventScroll: true })
    try { input.setSelectionRange(input.value.length, input.value.length) } catch { /* champ sans sélection */ }
  })

  return h('div', {},
    libelle ? h('p', { class: 'setup-libelle' }, libelle) : null,
    h('div', { class: 'setup-field' },
      input,
      suffix ? h('span', { class: 'setup-suffix' }, suffix) : null,
    ),
    indice ? h('p', { class: 'setup-suggested' }, indice) : null,
  )
}

/**
 * Choix parmi des options, en grandes cartes cliquables.
 *
 * Le dernier argument ajoute une issue : « Je ne sais pas encore ». Elle ne
 * choisit rien — elle passe à la suite en laissant l'hypothèse du métier en
 * place, et dit laquelle. Sans elle, un fondateur qui ignore encore sa forme
 * juridique devait cocher au hasard pour avancer.
 */
function choice(ctx, options, incertain) {
  const host = h('div', { class: 'setup-choices' })
  const draw = () => host.replaceChildren(
    ...options.map((o) => h('button', {
      class: `setup-choice ${o.active() ? 'active' : ''}`,
      onClick: () => { flow.touched.add(ctx.step.key); o.pick(); draw(); ctx.tick(); ctx.onChoice?.() },
    },
      h('span', { class: 'setup-choice-label' }, o.label),
      o.note ? h('span', { class: 'setup-choice-note' }, o.note) : null,
    )),
    incertain ? h('button', {
      class: 'setup-choice is-unsure',
      onClick: () => ctx.later?.(),
    },
      h('span', { class: 'setup-choice-label' }, 'Je ne sais pas encore'),
      h('span', { class: 'setup-choice-note' }, incertain()),
    ) : null,
  )
  draw()
  return host
}

/* ───────────────────────────── Écran : métier ───────────────────────────── */

/**
 * Deux temps, et une recherche qui les court-circuite.
 *
 * Personne ne se décrit comme « commerce de détail non alimentaire ». On dit
 * « pizzeria », « Airbnb », « plombier ». Montrer d'emblée vingt et un modèles
 * économiques, c'est demander au fondateur de faire lui-même la traduction.
 *
 * On lui montre donc douze familles larges, puis les métiers de la famille
 * qu'il a désignée. Et par-dessus, un champ de recherche : celui qui sait déjà
 * tape « piz » et n'ouvre jamais Restauration.
 *
 * Le champ ne se recrée pas à chaque frappe — il perdrait le curseur, et la
 * touche suivante écraserait la précédente. Seule la grille de dessous se
 * redessine.
 */
function sectorPicker(ctx) {
  const grid = h('div', { class: 'setup-sectors' })
  const input = h('input', {
    type: 'text', class: 'setup-search-input', placeholder: 'Tape ton métier',
    'aria-label': 'Chercher une activité', value: pick.query,
  })
  const clear = h('button', {
    class: 'setup-search-clear', 'aria-label': 'Effacer',
    onClick: () => { pick.query = ''; input.value = ''; input.focus(); draw() },
  }, '✕')

  /**
   * Retenir le métier — celui de la liste, ou celui qu'on a tapé.
   *
   * Les cent cinquante métiers de la liste ne couvrent pas tout, et « Autre
   * chose » effaçait ce que le fondateur venait d'écrire : il repartait avec
   * un plan sans nom de métier, et l'outil ne savait plus de quoi il parlait.
   * Le texte saisi est désormais gardé tel quel. Il ne débloque aucun modèle
   * — pas de charges suggérées, pas de repères de marge, il n'y en a pas pour
   * un métier qu'on ne connaît pas — mais tout le reste du parcours l'affiche
   * et le dossier le porte.
   */
  const choose = (activity, typed = '') => {
    // Le stade du projet parle du fondateur, pas du commerce : passer de
    // glacier à salon de coiffure ne le fait pas revenir à l'idée.
    const stage = store.scenario?.meta?.stage || ''
    const level = store.scenario?.meta?.level || 'easy'
    const own = !activity && typed.trim()
    store.create({
      template: activity ? activity.sector : null, level,
      name: activity ? activity.label : (own || 'Mon projet'), sample: false,
    })
    store.update((d) => {
      if (stage) d.meta.stage = stage
      d.meta.activityKey = activity ? activity.key : ''
      d.meta.activityLabel = activity ? activity.label : (own || '')
      // Un métier écrit à la main : le parcours reste le même, mais rien ne
      // sera pré-rempli à sa place — et c'est à dire, pas à taire.
      d.meta.customActivity = !!own
      // Le mot du métier quand il diffère de celui du modèle : une auto-école
      // vend des heures de conduite, pas des sessions de formation.
      d.meta.unit = activity?.unit || null
      // Né dans le parcours : ses questions s'ouvriront vides (voir vider).
      d.meta.parcours = true
    })
    flow.touched.add('metier')
    ctx.refresh()
  }

  // Un glyphe de police disait le sérieux d'un formulaire administratif. Les
  // icônes sont dessinées : même lumière, même volume, même jeu.
  const card = (glyph, name, note, active, onClick, famKey = null) => h('button', {
    class: `setup-sector ${active ? 'active' : ''} ${!famKey && !glyph ? 'is-bare' : ''}`, onClick,
  },
    famKey
      ? h('span', { class: 'setup-sector-icon', html: familyIcon(famKey) })
      : glyph ? h('span', { class: 'setup-sector-glyph' }, glyph) : null,
    h('span', { class: 'setup-sector-name' }, name),
    note ? h('span', { class: 'setup-sector-note' }, note) : null,
  )

  // Le fil de retour vit dans son propre hôte : il apparaît en entrant dans
  // une famille et disparaît en sortant, au même rythme que la grille.
  const trail = h('div', { class: 'setup-trail' })

  const draw = () => {
    const current = store.scenario?.meta?.activityKey
    const q = pick.query.trim()
    clear.style.display = q ? '' : 'none'

    trail.replaceChildren(...(pick.family && q.length < 2
      ? [h('button', { class: 'setup-back', onClick: () => { pick.family = null; draw() } },
          '← Toutes les activités', h('b', {}, familyOf(pick.family)?.label))]
      : []))

    // ─── Recherche libre : elle traverse les douze familles d'un coup ───
    if (q.length >= 2) {
      const hits = searchActivities(q)
      grid.replaceChildren(
        ...hits.map((a) => card('▸', a.label,
          familyOf(a.in[0])?.label, current === a.key, () => choose(a), a.in[0])),
        // Ce qu'il a tapé est une réponse, pas un échec de recherche : on le
        // lui propose tel quel, avec son nom dans le bouton.
        card('＋', `Garder « ${q} »`,
          'Ton métier, sans modèle pré-rempli', false, () => choose(null, q)),
      )
      if (!hits.length) {
        grid.prepend(h('p', { class: 'setup-search-none' },
          `Aucun métier de la liste ne correspond à « ${q} » — garde le tien : le parcours est le même, simplement rien ne sera pré-rempli à ta place.`))
      }
      return
    }

    // ─── Premier temps : les familles ───
    if (!pick.family) {
      grid.replaceChildren(...FAMILIES.map((f) => card(f.glyph, f.label,
        `${activitiesOf(f.key).length} métiers`, false,
        () => { pick.family = f.key; draw() }, f.key)))
      return
    }

    // ─── Second temps : les métiers de la famille ───
    // L'icône de la famille ne se répète pas sur chacun de ses métiers : elle
    // est déjà dans le fil de retour, et seize fois le même objet ne distingue
    // rien — il occupe seulement la place du nom.
    grid.replaceChildren(
      ...activitiesOf(pick.family).map((a) => card(null, a.label, null, current === a.key, () => choose(a))),
      card(null, 'Autre chose', 'Tu l’écriras toi-même', false, () => choose(null)),
    )
  }

  input.addEventListener('input', () => { pick.query = input.value; draw() })
  draw()

  return h('div', { class: 'setup-pick' },
    h('div', { class: 'setup-search' }, h('span', { class: 'setup-search-icon' }, '⌕'), input, clear),
    trail,
    grid,
  )
}

/* ─────────────────────────── Écran : l'accueil ──────────────────────────── */

/**
 * La page qu'on lit avant la première question.
 *
 * Trois versions ont échoué pour la même raison. Quatre cartes de promesses se
 * lisaient comme un formulaire : on cherchait laquelle cliquer. Une phrase
 * géante et un bouton ne disaient plus rien du tout. Et surtout, l'écran
 * gardait par-dessus tout l'attirail des questions — « Question 01 / 12 », un
 * titre, un bandeau, un « Continuer » sous le « Commencer ». C'était ça, le
 * désordre, plus que le texte.
 *
 * Ce qu'il faut ici tient en trois temps : ce que tu obtiens, ce que ça coûte
 * en temps, et pourquoi tu ne peux pas te tromper. Les trois lignes du bas
 * répondent aux trois objections qu'on entend vraiment — « je ne connais pas
 * mes chiffres », « je ne sais pas par où commencer », « et si je me trompe ».
 */
function welcomeScreen(ctx) {
  return h('div', { class: 'welcome' },
    h('div', { class: 'welcome-hero' },
      h('div', { class: 'welcome-say' },
        // Quatre niveaux : la marque, la promesse, à qui elle s'adresse, et la
        // petite note qui lève la dernière objection avant le bouton.
        h('div', { class: 'welcome-kicker' }, 'Fynomia'),
        h('h1', { class: 'welcome-big' },
          'La puissance d’une direction financière',
          h('b', {}, ' à la portée de chaque entrepreneur.'),
        ),
        h('p', { class: 'welcome-lede' },
          'Que tu ouvres une boulangerie ou que tu développes une startup, piloter ton activité ne devrait pas nécessiter un master en finance.'),
        h('p', { class: 'welcome-note' },
          'Tu n’as pas besoin de connaître tes chiffres pour commencer, Fynomia va t’aider à tout intégrer'),
        h('div', { class: 'welcome-cta' },
          h('button', {
            class: 'btn btn-primary btn-lg welcome-go',
            onClick: () => ctx.go(1),
          }, 'Commencer'),
          h('span', { class: 'welcome-meta' }, 'Environ trois minutes'),
        ),
      ),
      h('div', { class: 'welcome-art', 'aria-hidden': 'true', html: icon('depart', 'welcome-art-img') }),
    ),

    h('ul', { class: 'welcome-points' },
      ...[
        ['idee', 'Renseigne tes estimations', 'Pas besoin de chiffres exacts, des ordres de grandeur suffisent pour démarrer.'],
        ['cible', 'Utilise les benchmarks sectoriels', 'Prix, charges fixes et marges types sont déjà pré-configurés selon ton secteur d’activité.'],
        ['savoir', 'Pivote à volonté', 'Chaque paramètre reste ajustable. Modifie une valeur, l’intégralité du modèle financier se recalcule à la seconde.'],
      ].map(([ico, title, note], i) => h('li', {
        class: 'welcome-point',
        style: { '--d': `${0.3 + i * 0.09}s` },
      },
        h('span', { class: 'welcome-point-ico', 'aria-hidden': 'true', html: icon(ico) }),
        h('div', {},
          h('b', {}, title),
          h('span', {}, note),
        ),
      )),
    ),
  )
}


/* ───────────────────────────── Écran : le stade ─────────────────────────── */

/**
 * Quatre réponses, et la question suivante n'est plus la même.
 *
 * Ce n'est pas un sondage : le stade choisi remonte, dans tout le reste de
 * l'application, les lignes qui comptent pour lui. Celui qui monte un dossier
 * bancaire verra son apport et son emprunt proposés en premier ; celui qui a
 * une idée verra son prix et ses volumes. On le dit sous chaque carte, pour
 * que le choix ait l'air de ce qu'il est : utile.
 */
function stageScreen(ctx) {
  const host = h('div', { class: 'setup-stages' })
  const draw = () => host.replaceChildren(...STAGES.map((st) => {
    const on = store.scenario?.meta?.stage === st.key
    return h('button', {
      class: `stagepick ${on ? 'active' : ''}`,
      'aria-pressed': on ? 'true' : 'false',
      // Le détail du stade se lit au survol, pas en permanence sur l'écran.
      title: st.says,
      onClick: () => {
        flow.touched.add(ctx.step.key)
        store.update((d) => { d.meta.stage = st.key })
        draw(); ctx.tick(); ctx.onChoice?.()
      },
    },
      h('span', { class: 'stagepick-head' },
        h('span', { class: 'stagepick-label' }, st.label),
        h('span', { class: 'stagepick-mark', 'aria-hidden': 'true' }, on ? '\u2713' : ''),
      ),
      // Deux lignes par carte, pas cinq.
      //
      // Chaque carte portait son titre, une précision, une étiquette en
      // capitales, une conséquence et un paragraphe de trois lignes. Quatre
      // cartes de cinq éléments, c'était un mur — « trop de texte et
      // d'artefact ». Il reste ce qui fait choisir : le stade, et ce vers quoi
      // il emmène. Le reste est dans l'infobulle.
      h('span', { class: 'stagepick-then' }, st.cap),
    )
  }))
  draw()
  return host
}

/* ──────────────────────────── Écran : forme juridique ───────────────────── */

/**
 * La forme juridique, dite par ses conséquences.
 *
 * « SAS ou SARL » ne veut rien dire à qui n'a jamais créé de société. Ce qui
 * veut dire quelque chose, c'est : combien ça coûte de me payer, et quelle
 * protection j'ai en échange. On propose donc trois choix décrits comme ça.
 */
function legalScreen(ctx) {
  const sector = getSector(store.scenario.meta.sectorKey)
  // Les formes du métier d'abord — ce sont les plus probables — puis les
  // autres. Un fondateur qui sait déjà ce qu'il veut ne doit pas être bloqué
  // par un métier qui ne la propose pas.
  const suggested = sector?.legal?.forms || ['SAS', 'SARL']
  // On ne propose que les formes dont Fynomia sait tirer un calcul différent :
  // statut social du dirigeant, imposition du bénéfice, traitement des
  // dividendes. Une SCI ou une SCM n'abritent pas une activité d'exploitation
  // et ne changeraient rien au prévisionnel — les proposer serait du décor.
  const allowed = [...suggested, ...['MICRO', 'SASU', 'SAS', 'EURL', 'SARL', 'EI', 'BNC', 'Association']
    .filter((f) => !suggested.includes(f))]
  const current = () => store.scenario.meta.legalForm
  // Tant que rien n'a été choisi, aucune carte n'est allumée : une forme
  // présélectionnée se lit comme une réponse déjà donnée.
  const chosen = () => flow.touched.has('forme') || store.scenario.meta.legalFormChosen === true

  const FORMS = {
    SASU: { label: 'SASU', note: `Toi seul. Président assimilé salarié : environ 41 % de cotisations patronales sur ton brut, une vraie protection sociale, pas de chômage. Dividendes à la flat tax de ${pfuTotal()}.`, contract: 'dirigeant' },
    SAS: { label: 'SAS', note: "Plusieurs associés possibles. Même régime que la SASU pour le président. C'est la forme des projets qui lèvent des fonds.", contract: 'dirigeant' },
    EURL: { label: 'EURL', note: "Toi seul. Gérant travailleur non salarié : environ 45 % de cotisations, sensiblement moins cher qu'un assimilé salarié à revenu égal, mais une couverture plus légère.", contract: 'tns' },
    SARL: { label: 'SARL', note: "Plusieurs associés. Gérant majoritaire TNS. Attention aux dividendes : au-delà de 10 % du capital, ils supportent les cotisations d'indépendant, pas la flat tax.", contract: 'tns' },
    MICRO: { label: 'Micro-entreprise', note: "Toi seul, le plus simple pour démarrer. Tu cotises sur ce que tu encaisses — 12,3 % en vente, 21,2 % en services, 25,6 % en libéral — sans impôt sur les sociétés. Tes charges ne se déduisent pas, et le chiffre d'affaires est plafonné : 203 100 € en vente, 83 600 € en services.", contract: 'micro' },
    EI: { label: 'Entreprise individuelle', note: "Pas de société, pas de capital. Le bénéfice est ton revenu : il est imposé à l'impôt sur le revenu, sans impôt sur les sociétés ni dividendes.", contract: 'tns' },
    BNC: { label: 'Exercice libéral', note: "Professions libérales non réglementées en société. Bénéfices non commerciaux : le résultat est ton revenu imposable, sans abattement de 10 %.", contract: 'tns' },
    SELARL: { label: 'SELARL', note: "Réservée aux professions réglementées. Gérant majoritaire TNS, même traitement des dividendes qu'une SARL.", contract: 'tns' },
    SELAS: { label: 'SELAS', note: "Réservée aux professions réglementées. Président assimilé salarié, dividendes à la flat tax.", contract: 'dirigeant' },
    Association: { label: 'Association', note: "Loi 1901. Gestion désintéressée : aucun bénéfice ne peut être distribué. Un dirigeant rémunéré relève du régime général.", contract: 'dirigeant' },
  }

  return h('div', {},
    choice(ctx, allowed.filter((f) => FORMS[f]).map((f) => ({
      label: FORMS[f].label,
      note: FORMS[f].note,
      active: () => chosen() && current() === f,
      pick: () => store.update((sc) => {
        sc.meta.legalForm = f
        sc.meta.legalFormChosen = true
        sc.founder.majorityManager = ['SARL', 'EURL', 'SELARL'].includes(f)
        // Le statut du dirigeant suit la forme : c'est elle qui le détermine,
        // pas un choix séparé qu'on oublierait de mettre à jour.
        const me = sc.team?.find((x) => ME.test(x.role || ''))
        if (me) me.contractType = FORMS[f].contract
        // Un micro-entrepreneur démarre en franchise de TVA.
        if (!sc.meta.vatChecked) sc.meta.vatExempt = f === 'MICRO' ? true : !!getSector(sc.meta.sectorKey)?.vat?.exempt
      }, { label: 'Forme juridique', silent: true }),
    })),
    () => `On garde ${FORMS[current()]?.label || 'la forme la plus courante'} pour l\u2019instant, la plus fréquente dans ton métier.`),
  )
}

/* ─────────────────────────── Écran : prix et coût ───────────────────────── */

/**
 * Le prix.
 *
 * Le type de prix change la question posée juste en dessous — une fois, ou
 * tous les mois. Le champ est donc reconstruit quand on bascule, et seulement
 * là : la frappe, elle, ne reconstruit rien.
 */
/**
 * Le modèle de revenus.
 *
 * Quatre formes, et une seule question derrière : est-ce que cette vente se
 * répète ? La commission mérite sa place — marketplace, agence, apporteur
 * d'affaires : on ne vend pas un produit, on prélève un pourcentage sur ce qui
 * passe. Le raisonnement est différent, et se tromper de modèle à ce stade
 * fausse tout le reste.
 */
function priceScreen(ctx) {
  vider('prix', (sc) => {
    const a = sc.activities[0]
    return Number(a?.recurringPrice) > 0 ? `${euro(a.recurringPrice)} par mois` : Number(a?.unitPrice) > 0 ? euro(a.unitPrice) : null
  }, (sc) => { const a = sc.activities[0]; if (a) { a.unitPrice = 0; a.recurringPrice = 0 } })
  const act = () => store.scenario.activities[0]
  /**
   * Le modèle retenu.
   *
   * Il est lu dans le scénario dès qu'il a été choisi. Le déduire des prix
   * saisis ne marchait pas : choisir « par abonnement » remet justement les
   * prix à zéro, et la déduction renvoyait alors « à la vente » — le clic
   * semblait sans effet. La déduction ne sert plus qu'aux plans anciens, qui
   * portent des prix mais pas encore de modèle déclaré.
   */
  const mode = () => {
    const declared = store.scenario.meta.revenueModel
    if (declared) return declared
    const a = act()
    const u = Number(a.unitPrice) || 0, r = Number(a.recurringPrice) || 0
    if (u > 0 && r > 0) return 'mixte'
    if (r > 0) return 'abonnement'
    return 'unitaire'
  }
  const fieldHost = h('div', { class: 'setup-field-host' })

  const drawField = () => {
    const m = mode()
    if (m === 'commission') { fieldHost.replaceChildren(commissionFields(ctx)); return }
    const recurring = m === 'abonnement' || m === 'mixte'
    const nodes = []
    if (m === 'unitaire' || m === 'mixte') {
      nodes.push(field(ctx, {
        type: 'number', placeholder: '500', suffix: m === 'mixte' ? '\u20AC à la signature' : '\u20AC',
        libelle: m === 'mixte' ? 'Frais d’entrée, payés une fois à la signature (hors taxes)' : 'Prix moyen payé par un client (hors taxes)',
        value: (sc) => (Number(sc.activities[0].unitPrice) > 0 ? sc.activities[0].unitPrice : ''),
        apply: (sc, v) => { sc.activities[0].unitPrice = v },
        repere: repere('prix') ? `Repère dans ton métier : ${repere('prix')}.` : null,
      }))
    }
    if (recurring) {
      nodes.push(field(ctx, {
        type: 'number', placeholder: '49', suffix: '\u20AC par mois',
        libelle: 'Prix de l’abonnement, par mois (hors taxes)',
        value: (sc) => (Number(sc.activities[0].recurringPrice) > 0 ? sc.activities[0].recurringPrice : ''),
        apply: (sc, v) => { sc.activities[0].recurringPrice = v },
        repere: m !== 'mixte' && repere('prix') ? `Repère dans ton métier : ${repere('prix')}.` : null,
      }))
    }
    fieldHost.replaceChildren(...nodes)
  }

  // Même règle que pour la forme juridique et la croissance : le modèle de
  // revenu vient du métier pour que le moteur tourne, il n'a pas été choisi.
  // Tant que le fondateur n'a pas cliqué, aucune carte n'est allumée.
  const chosen = () => answered('prix')

  const setMode = (patch) => store.update((sc) => patch(sc), { label: 'Modèle de revenu', silent: true })

  ctx.onChoice = drawField
  const picker = choice(ctx, [
    {
      label: 'Une fois', note: 'Il achète, il paie, c’est réglé. Un repas, un meuble, une prestation.',
      active: () => chosen() && mode() === 'unitaire',
      pick: () => setMode((sc) => {
        const a = sc.activities[0]
        sc.meta.revenueModel = 'unitaire'
        // Le modèle s'inscrit aussi sur l'offre elle-même : c'est là que la
        // page « Prix et marge » le relit, et deux endroits qui se contredisent
        // valent moins qu'un seul qui fait foi.
        a.priceMode = 'unit'
        a.dealValue = 0; a.commissionRate = 0
        if (!(Number(a.unitPrice) > 0)) a.unitPrice = 0
        a.recurringPrice = 0; a.recurringCost = 0; a.contractMonths = 0
      }),
    },
    {
      label: 'Chaque mois', note: 'Un abonnement : il paie tant qu’il reste client.',
      active: () => chosen() && mode() === 'abonnement',
      pick: () => setMode((sc) => {
        const a = sc.activities[0]
        sc.meta.revenueModel = 'abonnement'
        a.priceMode = 'recurring'
        a.dealValue = 0; a.commissionRate = 0
        a.unitPrice = 0; a.unitCost = 0
        if (!(Number(a.contractMonths) > 0)) a.contractMonths = 12
        if (!(Number(a.churnMonthly) > 0)) a.churnMonthly = 0.03
      }),
    },
    {
      label: 'Une fois, puis chaque mois', note: 'Des frais d’entrée à la signature, puis un abonnement.',
      active: () => chosen() && mode() === 'mixte',
      pick: () => setMode((sc) => {
        const a = sc.activities[0]
        sc.meta.revenueModel = 'mixte'
        // « Les deux » n'est pas un quatrième mode : c'est un abonnement qui
        // porte en plus un montant à la signature. L'éditeur l'affiche ainsi.
        a.priceMode = 'recurring'
        a.dealValue = 0; a.commissionRate = 0
        if (!(Number(a.contractMonths) > 0)) a.contractMonths = 12
      }),
    },
    {
      label: 'Une commission', note: 'Tu touches un pourcentage de chaque vente que tu fais passer.',
      active: () => chosen() && mode() === 'commission',
      pick: () => setMode((sc) => {
        const a = sc.activities[0]
        sc.meta.revenueModel = 'commission'
        sc.meta.commissionBasket = sc.meta.commissionBasket || 0
        sc.meta.commissionRate = sc.meta.commissionRate || 0.1
        a.priceMode = 'commission'
        a.dealValue = sc.meta.commissionBasket
        a.commissionRate = sc.meta.commissionRate
        a.recurringPrice = 0; a.recurringCost = 0; a.contractMonths = 0; a.unitCost = 0
        a.unitPrice = Math.round((sc.meta.commissionBasket || 0) * (sc.meta.commissionRate || 0))
      }),
    },
  ], () => {
    const noms = { unitaire: 'un paiement unique', abonnement: 'un abonnement', commission: 'une commission', mixte: 'des frais d\u2019entrée puis un abonnement' }
    return `Pas encore sûr ? On part sur ${noms[mode()] || 'un paiement unique'}, le plus courant dans ton métier. Tu pourras changer.`
  })

  drawField()
  return h('div', {}, picker, fieldHost)
}

/**
 * La commission : deux nombres, et le prix unitaire s'en déduit.
 * Ce que Fynomia enregistre reste un prix par transaction — le moteur n'a pas
 * besoin de connaître la notion de commission, seulement son résultat.
 */
function commissionFields(ctx) {
  const recompute = (sc) => {
    const a = sc.activities[0]
    // Les deux nombres vivent sur l'offre — la page « Prix et marge » les y
    // relit et les y réécrit. `meta` n'en garde qu'un écho, pour que ce parcours
    // retrouve ce qu'on vient d'y taper.
    a.dealValue = Number(sc.meta.commissionBasket) || 0
    a.commissionRate = Number(sc.meta.commissionRate) || 0
    a.unitPrice = Math.round(a.dealValue * a.commissionRate)
  }
  return h('div', {},
    field(ctx, {
      type: 'number', placeholder: '1200', suffix: '\u20AC par transaction', libelle: 'Montant moyen d’une vente que tu fais passer',
      value: (sc) => (Number(sc.meta.commissionBasket) > 0 ? sc.meta.commissionBasket : ''),
      apply: (sc, v) => { sc.meta.commissionBasket = v; recompute(sc) },
    }),
    field(ctx, {
      type: 'number', placeholder: '10', suffix: '% pour toi', libelle: 'Ta commission sur chaque vente',
      value: (sc) => (Number(sc.meta.commissionRate) > 0 ? Math.round(sc.meta.commissionRate * 1000) / 10 : ''),
      apply: (sc, v) => { sc.meta.commissionRate = (Number(v) || 0) / 100; recompute(sc) },
    }),
  )
}

/**
 * Le coût de revient, détaillé.
 *
 * « Ça te coûte combien à produire ? » est une question à laquelle personne
 * ne sait répondre d'un seul nombre. En revanche, chacun sait dire s'il a des
 * matières, une commission de paiement, une livraison — et combien. On propose
 * donc les postes du métier, on additionne, et le total devient le coût de
 * revient. Exactement le geste des charges, appliqué à l'unité vendue.
 */
const COST_PARTS = {
  produit: [
    { label: 'Matières ou achat de marchandise', share: 0.45 },
    { label: 'Emballage', share: 0.03 },
    { label: 'Livraison', share: 0.08 },
    { label: 'Commission de paiement', share: 0.02 },
  ],
  service: [
    { label: 'Sous-traitance', share: 0.15 },
    { label: 'Déplacement sur mission', share: 0.05 },
    { label: 'Commission de paiement', share: 0.02 },
  ],
  logiciel: [
    { label: 'Hébergement et infrastructure', share: 0.08 },
    { label: 'Licences et briques tierces', share: 0.04 },
    { label: 'Commission de paiement', share: 0.02 },
  ],
}

function costFamily(sector) {
  if (['tech'].includes(sector?.family)) return 'logiciel'
  if (['retail'].includes(sector?.family) || sector?.key === 'restaurant') return 'produit'
  return 'service'
}

function costScreen(ctx) {
  vider('cout', () => null, (sc) => {
    const a0 = sc.activities[0]
    if (a0) { a0.unitCost = 0; a0.recurringCost = 0 }
    sc.meta.costParts = {}
  })
  const sector = getSector(store.scenario.meta.sectorKey)
  const a = () => store.scenario.activities[0]
  const recurring = () => (Number(a().recurringPrice) || 0) > 0 && !(Number(a().unitPrice) > 0)
  const price = () => (recurring() ? Number(a().recurringPrice) : Number(a().unitPrice)) || 0
  const parts = COST_PARTS[costFamily(sector)]

  const lines = () => store.scenario.meta.costParts || {}
  const total = () => Object.values(lines()).reduce((x, v) => x + (Number(v) || 0), 0)

  const write = () => store.update((sc) => {
    const sum = Object.values(sc.meta.costParts || {}).reduce((x, v) => x + (Number(v) || 0), 0)
    if (recurring()) sc.activities[0].recurringCost = sum
    else sc.activities[0].unitCost = sum
  }, { label: 'Coût de revient', silent: true })

  const host = h('div', { class: 'setup-costs' })
  const summary = h('div', { class: 'cost-sum' })

  const drawSummary = () => {
    const t = total(), p = price()
    summary.replaceChildren(
      h('div', { class: 'cost-sum-line' },
        h('span', {}, 'Coût de revient'),
        h('span', { class: 'num' }, euro(t)),
      ),
      p > 0 ? h('div', { class: `cost-sum-line strong ${p - t <= 0 ? 'bad' : ''}` },
        h('span', {}, 'Marge par vente'),
        h('span', { class: 'num' }, `${euro(p - t)} · ${pct((p - t) / p, 0)}`),
      ) : null,
    )
  }

  const draw = () => {
    host.replaceChildren(...parts.map((part) => {
      const v = lines()[part.label]
      const on = v !== undefined
      const row = h('div', { class: `setup-cost ${on ? 'on' : ''}` })
      row.append(
        h('button', {
          class: 'setup-cost-toggle',
          onClick: () => {
            flow.touched.add(ctx.step.key)
            store.update((sc) => {
              sc.meta.costParts = sc.meta.costParts || {}
              if (on) delete sc.meta.costParts[part.label]
              else sc.meta.costParts[part.label] = Math.round(price() * part.share)
            }, { label: 'Coût de revient', silent: true })
            write(); draw(); drawSummary(); ctx.tick()
          },
        },
          h('span', { class: 'setup-cost-box' }, on ? '\u2713' : ''),
          h('span', { class: 'setup-cost-label' }, part.label),
        ),
        on
          ? h('input', {
              class: 'setup-cost-amount num', inputmode: 'decimal', value: String(v ?? ''),
              onInput: (e) => {
                const n = parseFloat(e.target.value.replace(/\s/g, '').replace(',', '.')) || 0
                store.update((sc) => { (sc.meta.costParts = sc.meta.costParts || {})[part.label] = n }, { label: 'Coût de revient', silent: true })
                write(); drawSummary(); ctx.tick()
              },
            })
          : h('span', { class: 'setup-cost-hint num' }, price() > 0 ? `\u2248 ${euro(Math.round(price() * part.share))}` : ''),
      )
      return row
    }))
  }

  draw(); drawSummary()
  return h('div', {}, host, summary,
    h('p', { class: 'setup-note' },
      "Ce ne sont pas des frais fixes. Ajuste le coût par unité (matières, packaging, commissions) pour calculer ta marge exacte."))
}

/* ───────────────────── Écran : clients et croissance ────────────────────── */

function clientsScreen(ctx) {
  vider('clients', (sc) => {
    const v = Number(sc.activities[0]?.volumes?.startUnits) || 0
    return v > 0 ? `${num(v, 0)} ${vocabulary(sc).many} le premier mois` : null
  }, (sc) => { if (sc.activities[0]?.volumes) sc.activities[0].volumes.startUnits = 0 })
  const voc = vocabulary(ctx.scenario)
  return field(ctx, {
    repere: repere('clients') ? `Repère dans ton métier : ${repere('clients')}.` : null,
    type: 'number', placeholder: '3', suffix: voc.many,
    value: (sc) => {
      const v = sc.activities[0].volumes.startUnits
      return Number(v) > 0 ? v : ''
    },
    apply: (sc, v) => { sc.activities[0].volumes.startUnits = v },
  })
}

function growthScreen(ctx) {
  const g = () => Number(store.scenario.activities[0].volumes.monthlyGrowth) || 0
  const pick = (value) => store.update((sc) => { sc.activities[0].volumes.monthlyGrowth = value; sc.meta.croissanceChoisie = true },
    { label: 'Croissance', silent: true })
  // Aucune carte n'est allumée tant que le fondateur n'a pas choisi.
  //
  // Le modèle de métier pose déjà une croissance pour que le moteur tourne :
  // « Normalement » apparaissait donc cochée avant le moindre clic, et le
  // fondateur validait un rythme qu'il n'avait pas choisi. Une valeur présente
  // n'est pas une réponse — c'est la même règle que pour la forme juridique.
  const chosen = () => answered('croissance')
  return choice(ctx, [
    { label: 'Doucement', note: '+3 % par mois — le bouche-à-oreille', active: () => chosen() && g() > 0 && g() <= 0.04, pick: () => pick(0.03) },
    { label: 'Normalement', note: '+8 % par mois — tu prospectes', active: () => chosen() && g() > 0.04 && g() <= 0.10, pick: () => pick(0.08) },
    { label: 'Vite', note: '+15 % par mois — il faudra le démontrer', active: () => chosen() && g() > 0.10, pick: () => pick(0.15) },
  ], () => `On garde ${Math.round((g() || 0.08) * 100)} % par mois pour l\u2019instant, le rythme courant dans ton métier.`)
}

/* ──────────────────── Écran : rémunération et frais ─────────────────────── */

/**
 * Ta rémunération, et ce qu'elle coûte vraiment.
 *
 * Le statut n'est pas demandé : il découle de la forme juridique choisie deux
 * questions plus tôt. On l'affiche pour que le fondateur comprenne pourquoi le
 * même brut ne coûte pas la même chose selon la société qu'il a créée.
 */
function salaryScreen(ctx) {
  vider('salaire', () => null, (sc) => {
    const m = sc.team?.find((x) => ME.test(x.role || ''))
    if (m) m.monthlyGross = 0
  })
  const me = () => store.scenario.team?.find((x) => ME.test(x.role || ''))
  const type = () => me()?.contractType || (store.scenario.meta.legalForm === 'MICRO' ? 'micro' : ['SARL', 'EURL', 'EI', 'BNC', 'SELARL'].includes(store.scenario.meta.legalForm) ? 'tns' : 'dirigeant')
  const label = () => (type() === 'micro' ? 'Micro-entrepreneur' : type() === 'tns' ? 'Dirigeant TNS' : 'Dirigeant assimilé salarié')

  const host = h('div', { class: 'setup-salary-echo' })
  const draw = () => {
    const m = me()
    const gross = Number(m?.monthlyGross) || 0
    if (!gross) { host.replaceChildren(h('p', { class: 'setup-note' }, 'Laisse vide si tu ne te verses rien la première année.')); return }
    // En micro-entreprise, il n'y a pas d'échelle à descendre : ce que tu
    // retires n'est pas un salaire, et tes cotisations se comptent sur ce
    // que tu encaisses. On le dit, plutôt que d'afficher un super brut faux.
    if (type() === 'micro') {
      host.replaceChildren(
        h('div', { class: 'ladder' },
          h('div', { class: 'ladder-row bottom' },
            h('span', { class: 'ladder-main' },
              h('span', { class: 'ladder-label' }, 'Ce que tu retires'),
              h('span', { class: 'ladder-note' }, 'un prélèvement, pas une charge'),
            ),
            h('span', { class: 'ladder-figures' },
              h('span', { class: 'num ladder-month' }, `${euro(gross * 12)} / an`),
              h('span', { class: 'num ladder-year' }, `${euro(gross)} / mois`),
            ),
          ),
        ),
        h('p', { class: 'setup-note' }, 'En micro-entreprise, tes cotisations se calculent sur ton chiffre d’affaires encaissé, pas sur ce que tu retires. Fynomia vérifiera que ton activité le permet.'),
      )
      return
    }
    let c = null
    try { c = monthlyCost({ ...m, monthlyGross: gross }, { headcount: 1, fiscal: store.scenario.fiscal }) } catch { /* rien */ }
    if (!c) { host.replaceChildren(); return }
    const tns = type() === 'tns'
    const perks = c.benefits || 0
    // Les trois marches, au mois et à l'année : c'est à l'année qu'on compare
    // un salaire, et à l'année que le coût pour l'entreprise se négocie.
    // Trois marches, une ligne chacune.
    //
    // Chaque marche portait une phrase complète sous son libellé — « le chiffre
    // qui figure sur le contrat », « un indépendant n'a pas de cotisations
    // salariées » — et l'écran faisait trois fois la hauteur qu'il lui fallait
    // pour dire trois montants. Ce qui reste tient en quelques mots, sur la
    // même ligne que le libellé : le montant des cotisations, qui est la seule
    // chose que le lecteur ne peut pas déduire lui-même.
    const rows = [
      {
        label: 'Coût pour l’entreprise', value: c.superGross, tone: 'top',
        note: tns ? 'cotisations comprises'
          : `dont ${euro(c.employerCharges)} de cotisations${perks > 0 ? ` et ${euro(perks)} de mutuelle` : ''}`,
      },
      { label: tns ? 'Ta rémunération' : 'Ton brut', value: gross },
      {
        label: 'Ce que tu touches', value: tns ? gross : c.net, tone: 'bottom',
        note: tns ? 'avant impôt sur le revenu'
          : `après ${euro(c.employeeCharges)} de cotisations, avant impôt`,
      },
    ]
    const ratio = gross > 0 ? c.superGross / (tns ? gross : c.net) : 0
    host.replaceChildren(
      h('div', { class: 'ladder' },
        ...rows.map((r) => h('div', { class: `ladder-row ${r.tone || ''}` },
          h('span', { class: 'ladder-main' },
            h('span', { class: 'ladder-label' }, r.label),
            r.note ? h('span', { class: 'ladder-note' }, r.note) : null,
          ),
          h('span', { class: 'ladder-figures' },
            h('span', { class: 'num ladder-month' }, `${euro(r.value * 12)} / an`),
            h('span', { class: 'num ladder-year' }, `${euro(r.value)} / mois`),
          ),
        )),
        taxLine(tns ? gross : c.net),
      ),
      h('p', { class: 'setup-note' },
        `${label()} · 1 € en poche coûte ${ratio.toFixed(2).replace('.', ',')} € à l'entreprise.`),
    )
  }

  // Un salaire se dit à l'année : c'est l'unité des offres d'emploi, des
  // conventions collectives et de toutes les conversations. Le modèle, lui,
  // raisonne au mois ; la conversion se fait ici, une fois.
  const f = field(ctx, {
    type: 'number', placeholder: '30000',
    suffix: ['tns', 'micro'].includes(type()) ? '\u20AC par an' : '\u20AC brut par an',
    value: (sc) => {
      const m = sc.team?.find((x) => ME.test(x.role || ''))
      return m && Number(m.monthlyGross) > 0 ? Math.round(m.monthlyGross * 12) : ''
    },
    apply: (sc, v) => {
      let m = sc.team?.find((x) => ME.test(x.role || ''))
      const monthly = (Number(v) || 0) / 12
      if (!m) { m = newTeamMember({ role: 'Moi', contractType: type(), status: 'cadre', monthlyGross: monthly }); sc.team.push(m) }
      m.monthlyGross = monthly
      m.contractType = type()
    },
  })

  /**
   * Ne rien se verser est un choix, pas un oubli.
   *
   * Beaucoup de fondateurs démarrent sans salaire la première année, et le
   * leur interdire produirait un plan faux. Mais un prévisionnel où personne
   * ne se paie n'est pas prudent : il est incomplet, et un financeur le lit
   * comme tel. On enregistre donc le choix, et la ligne « ta rémunération »
   * reste ouverte dans ce qu'il reste à poser — elle reviendra.
   */
  const skip = h('button', {
    class: 'setup-skip',
    onClick: () => {
      store.update((sc) => {
        const m = sc.team?.find((x) => ME.test(x.role || ''))
        if (m) m.monthlyGross = 0
        sc.meta.noSalaryChosen = true
      }, { label: 'Pas de rémunération' })
      flow.touched.add(ctx.step.key)
      ctx.go(1)
    },
  }, 'Je ne me verse rien la première année')

  // L'échelle se redessine à la frappe ; le champ, lui, reste en place.
  const tick = ctx.tick
  ctx.tick = () => { tick(); draw() }
  draw()

  return h('div', {},
    h('div', { class: 'setup-status' },
      h('span', { class: 'setup-status-tag' }, 'Ton statut'),
      h('span', { class: 'setup-status-value' }, label()),
      h('span', { class: 'setup-status-why' }, `découle de la forme ${store.scenario.meta.legalForm}`),
    ),
    f, host, skip,
  )
}

/**
 * L'impôt sur le revenu, pour un foyer d'une part et sans autre revenu.
 *
 * C'est l'hypothèse la plus simple et la plus fausse de toutes — un conjoint,
 * un enfant, un revenu foncier la déplacent. Elle a pourtant sa place ici :
 * entre « je me verse 30 000 € » et « il m'en reste tant », il y a un impôt
 * que personne ne calcule au moment de choisir, et dont l'ordre de grandeur
 * change la décision. On le dit, et on dit sous quelle hypothèse.
 */
function incomeTaxOn(net) {
  const brackets = PARAMS.incomeTaxBrackets.value
  const ab = PARAMS.salaryAllowance.value
  const base = Math.max(0, net - Math.min(ab.max, Math.max(Math.min(net, ab.min), net * ab.rate)))
  let tax = 0, floor = 0
  for (const b of brackets) {
    if (base <= floor) break
    tax += (Math.min(base, b.upTo) - floor) * b.rate
    floor = b.upTo
  }
  return Math.round(tax)
}

/** Ce que l'impôt prendra, et sous quelle hypothèse. */
/**
 * Ce qu'il reste après impôt, sur une ligne.
 *
 * Le calcul valait d'être montré — c'est la seule fois où le fondateur voit son
 * revenu net d'impôt — mais il occupait trois lignes et un avertissement de
 * quarante mots pour deux montants. La réserve tient dans la parenthèse : une
 * part fiscale, rien d'autre.
 */
function taxLine(monthlyNet) {
  const yearly = Math.round(monthlyNet * 12)
  if (yearly <= 0) return null
  const tax = incomeTaxOn(yearly)
  return h('div', { class: 'ladder-row is-tax' },
    h('span', { class: 'ladder-main' },
      h('span', { class: 'ladder-label' }, 'Après impôt sur le revenu'),
      h('span', { class: 'ladder-note' }, `estimé à ${euro(tax)} par an, pour une part fiscale`),
    ),
    h('span', { class: 'ladder-figures' },
      h('span', { class: 'num ladder-month' }, `${euro(yearly - tax)} / an`),
    ),
  )
}

/**
 * Les frais, sous forme de cases à cocher.
 *
 * Un tableau vide n'appelle aucune réponse ; une liste de ce qu'on oublie
 * habituellement en appelle une pour chaque ligne. Les montants proposés
 * viennent du métier choisi.
 */
function costsScreen(ctx) {
  const sector = getSector(store.scenario.meta.sectorKey)
  const shop = ['retail', 'personal'].includes(sector?.family) || sector?.key === 'restaurant'

  const suggestions = [
    { label: 'Comptable', amount: 200 },
    { label: 'Assurances', amount: 90 },
    { label: 'Banque et paiement', amount: 60 },
    { label: shop ? 'Local' : 'Bureau ou coworking', amount: shop ? 1400 : 300 },
    { label: 'Logiciels et téléphone', amount: 120 },
    { label: 'Déplacements', amount: 150 },
    { label: 'Publicité', amount: 300 },
  ]

  // Aucune case cochée d'avance : les frais du modèle de métier s'effacent à
  // la première arrivée, et ne reviennent que ceux que le fondateur coche.
  vider('frais', () => null, (sc) => { sc.opex = [] })
  const find = (label) => (store.scenario.opex || []).find((o) => o.label === label)
  const host = h('div', { class: 'setup-costs' })

  const draw = () => host.replaceChildren(...suggestions.map((sug) => {
    const item = find(sug.label)
    const row = h('div', { class: `setup-cost ${item ? 'on' : ''}` })

    const toggle = h('button', {
      class: 'setup-cost-toggle',
      onClick: () => {
        flow.touched.add(ctx.step.key)
        store.update((sc) => {
          const i = (sc.opex || []).findIndex((o) => o.label === sug.label)
          if (i >= 0) sc.opex.splice(i, 1)
          else sc.opex.push(newOpex({ label: sug.label, monthlyAmount: sug.amount }))
        }, { label: 'Frais', silent: true })
        draw(); ctx.tick()
      },
    },
      h('span', { class: 'setup-cost-box' }, item ? '\u2713' : ''),
      h('span', { class: 'setup-cost-label' }, sug.label),
    )

    // Le montant garde son élément entre deux frappes : seul l'écho suit.
    const amount = item
      ? h('input', {
          class: 'setup-cost-amount num', inputmode: 'decimal', autocomplete: 'off',
          value: String(item.monthlyAmount ?? ''),
          onInput: (e) => {
            const v = parseFloat(e.target.value.replace(/\s/g, '').replace(',', '.')) || 0
            store.update((sc) => {
              const o = sc.opex.find((x) => x.label === sug.label)
              if (o) o.monthlyAmount = v
            }, { label: 'Frais', silent: true })
            ctx.tick()
          },
        })
      : h('span', { class: 'setup-cost-hint num' }, `\u2248 ${euro(sug.amount)}`)

    row.append(toggle, amount)
    return row
  }))

  draw()
  return h('div', {}, host,
    h('p', { class: 'setup-note' }, 'Ordres de grandeur pour ton métier. Corrige-les maintenant ou plus tard.'))
}

function cashScreen(ctx) {
  vider('depart', () => null, (sc) => { sc.financing.equityFounders = [] })
  return h('div', {},
    field(ctx, {
      type: 'number', placeholder: '10 000', suffix: '€',
      value: (sc) => {
        const total = (sc.financing.equityFounders || []).reduce((a, x) => a + (Number(x.amount) || 0), 0)
        return total > 0 ? total : ''
      },
      apply: (sc, v) => { sc.financing.equityFounders = v > 0 ? [{ month: 0, amount: v }] : [] },
    }),
    h('p', { class: 'setup-note' }, "Rien de côté ? Mets zéro : Fynomia dira combien il te manque, et quand."),
  )
}

/* ──────────────────────────────── La fin ────────────────────────────────── */

function doneScreen(ctx) {
  const s = ctx.scenario
  let r = null
  try { r = compute(s) } catch { /* rien à montrer */ }
  if (!r) return h('p', {}, 'Le modèle n’a pas pu être calculé.')

  const k = r.kpis, p = r.pnl
  const need = k.fundingNeed > 0
  const rentable = k.firstProfitableYear !== null

  // La fin du parcours est un moment, pas un bulletin de notes.
  //
  // On rendait un grand nombre, trois lignes commentées et une liste : un
  // premier créateur y lisait un verdict, et le verdict était souvent « tu
  // perds de l'argent ». Or à cet instant précis, ce qui est vrai pour tout le
  // monde, c'est qu'on vient de poser douze réponses et qu'un modèle complet
  // existe. C'est cela qu'on félicite ; les chiffres, eux, restent exacts,
  // rangés sur une ligne, et la suite est ce qu'on met en avant.
  const chiffres = [
    { l: 'Chiffre d’affaires, année 1', v: euro(p.revenue[0], { compact: true }) },
    { l: 'Point mort', v: k.breakEven[0] ? euro(k.breakEven[0], { compact: true }) : 'à calculer' },
    { l: 'Premier exercice rentable', v: rentable ? `Année ${k.firstProfitableYear + 1}` : 'au-delà de 5 ans' },
    { l: need ? 'À financer' : 'Trésorerie', v: need ? euro(k.fundingNeed, { compact: true }) : 'jamais négative' },
  ]

  return h('div', { class: 'setup-done' },
    h('section', { class: 'keystone done-hero' },
      h('span', { class: 'keystone-arc', 'aria-hidden': 'true' }),
      h('div', { class: 'keystone-tag' }, 'Parcours terminé'),
      h('div', { class: 'keystone-value' }, 'Super, tu as déjà bien avancé'),
      h('p', { class: 'keystone-note' },
        'Voilà ce que tes réponses produisent aujourd’hui. Maintenant, allons affiner ton modèle.'),
      h('div', { class: 'done-strip' }, ...chiffres.map((c) => h('div', { class: 'done-fig' },
        h('span', { class: 'done-fig-label' }, c.l),
        h('span', { class: 'done-fig-value num' }, c.v),
      ))),
    ),

    h('div', { class: 'setup-unlocked done-next' },
      h('div', { class: 'setup-unlocked-title' }, 'Tes trois prochaines étapes'),
      h('ol', { class: 'setup-next' },
        nextStep('1', 'Regarde ta synthèse', 'Ton modèle en français : ce que tu gagnes, ce qu’il te reste, ce qu’il te manque.'),
        nextStep('2', 'Corrige ce qui te paraît faux', 'Chaque chiffre s’ouvre là où il a été saisi, et tout se recalcule.'),
        nextStep('3', 'Complète ce que tu as passé', 'Les lignes vides sont listées, de la plus utile à la moins urgente.'),
      ),
    ),

    h('div', { class: 'setup-actions' },
      h('button', {
        class: 'btn btn-primary btn-lg',
        onClick: () => { resetSetup(); openSynthesis(); ctx.navigate('#/tableau-de-bord') },
      }, 'Voir ma synthèse →'),
      h('button', {
        class: 'btn btn-lg',
        onClick: () => { resetSetup(); ctx.navigate('#/business-case') },
      }, 'Exporter le dossier'),
    ),
  )
}

const nextStep = (no, title, body) => h('li', { class: 'setup-next-item' },
  h('span', { class: 'setup-next-no' }, no),
  h('div', {},
    h('div', { class: 'setup-next-title' }, title),
    h('p', { class: 'setup-next-body' }, body),
  ),
)


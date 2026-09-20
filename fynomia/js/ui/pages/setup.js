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
import { sectorsByFamily, SECTORS, getSector, vocabulary } from '../../state/sectors.js'
import { newTeamMember, newOpex } from '../../state/schema.js'
import { monthlyCost } from '../../engine/payroll.js'
import { compute } from '../../engine/engine.js'
import store from '../../state/store.js'
import { pfuTotal } from '../../engine/fiscal-fr-2026.js'
import { STAGES } from '../stages.js'

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
const flow = { index: 0, touched: new Set() }

export function resetSetup() { flow.index = 0; flow.touched = new Set() }

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
    key: 'metier', short: 'Ton métier',
    question: 'Tu fais quoi ?',
    help: "Ce choix commande la TVA, ton statut et les repères de marge du reste du parcours.",
    render: sectorPicker,
    ready: (s) => !!s?.meta?.sectorKey,
  },
  {
    key: 'stade', short: 'Où tu en es',
    question: 'Où en est ton projet ?',
    help: "Personne ne démarre au même endroit. Ça change ce que Fynomia te proposera ensuite — et ça se change à tout moment.",
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
    help: "Elle fixe ton statut social, donc le coût de ta rémunération. Modifiable ensuite.",
    render: legalScreen,
    // Une forme est posée par défaut dans tout scénario pour que le moteur
    // tourne. Elle n'est pas un choix : il faut que le fondateur en désigne une.
    ready: (s) => answered('forme') || s?.meta?.legalFormChosen === true,
  },
  {
    key: 'depart', short: 'La mise de départ',
    question: 'Tu démarres avec combien ?',
    help: "L'argent déjà disponible : ton apport et celui de tes associés.",
    optional: true,
    render: cashScreen,
    ready: () => answered('depart'),
  },
  {
    key: 'offre', short: 'Ce que tu vends',
    question: 'Tu vends quoi ?',
    help: (s) => `Le nom que tu emploies devant un client. Une ${vocabulary(s).one}, un forfait, un abonnement.`,
    render: (ctx) => field(ctx, {
      type: 'text', placeholder: (s) => vocabulary(s).one,
      value: (s) => (s.activities[0]?.name === 'À définir' ? '' : s.activities[0]?.name || ''),
      apply: (s, v) => { if (s.activities[0]) s.activities[0].name = v.trim() || 'Mon offre' },
    }),
    ready: (s) => {
      const n = (s?.activities?.[0]?.name || '').trim()
      return !!n && n !== 'À définir'
    },
  },
  {
    key: 'prix', short: 'Le prix',
    question: 'Comment rentre l’argent ?',
    help: 'Une vente qui se répète ne vaut pas une vente unique.',
    render: priceScreen,
    ready: (s) => (Number(s?.activities?.[0]?.unitPrice) || 0) > 0 || (Number(s?.activities?.[0]?.recurringPrice) || 0) > 0,
  },
  {
    key: 'salaire', short: 'Ta rémunération',
    question: 'Tu te paies combien ?',
    help: "Un plan où le fondateur ne se paie pas n'est pas prudent : il est faux. Fynomia calcule ce que ça coûte à l'entreprise.",
    optional: true,
    render: salaryScreen,
    ready: () => answered('salaire'),
  },
  {
    key: 'frais', short: 'Tes frais fixes',
    question: 'Tes frais tous les mois',
    help: 'Coche ce qui te concerne. Ces frais fixent le nombre de clients qu\'il te faut.',
    optional: true,
    render: costsScreen,
    ready: () => answered('frais'),
  },
  {
    key: 'clients', short: 'Tes premiers clients',
    question: 'Combien de clients le premier mois ?',
    help: "Ce que tu peux livrer et facturer dès le début, pas une ambition. C'est le chiffre le plus discuté d'un business plan.",
    render: clientsScreen,
    ready: (s) => (Number(s?.activities?.[0]?.volumes?.startUnits) || 0) > 0,
  },
  {
    key: 'cout', short: 'Le coût de revient',
    // On ne demande le coût de revient qu'ici, une fois les frais connus : sans
    // ce repère, « ce que ça te coûte de produire » ne veut rien dire pour
    // quelqu'un qui n'a jamais tenu de comptabilité — et la confusion la plus
    // fréquente est justement d'y ranger le loyer ou le comptable.
    question: 'Et chaque vente, elle te coûte quoi ?',
    help: "Uniquement ce qui augmente quand tu vends une unité de plus. Pas le loyer ni le comptable : tu viens de les saisir.",
    optional: true,
    render: costScreen,
    ready: () => answered('cout'),
  },
  {
    key: 'croissance', short: 'La croissance',
    question: 'Ça grandit à quelle vitesse ?',
    help: 'Aucune croissance ne tient cinq ans au même rythme : Fynomia freine la courbe dans la durée.',
    optional: true,
    render: growthScreen,
    ready: () => answered('croissance'),
  },
  {
    key: 'fin', short: 'Le résultat',
    question: 'Ton business plan est prêt',
    render: doneScreen,
    ready: () => true,
    last: true,
  },

]

/* ─────────────────────────────── La page ────────────────────────────────── */

export function renderSetup(navigate, refresh) {
  const s = store.scenario
  const step = STEPS[Math.min(flow.index, STEPS.length - 1)]

  const ctx = { navigate, refresh, scenario: s, step }

  const go = (delta) => {
    const next = flow.index + delta
    if (next < 0 || next >= STEPS.length) { if (next >= STEPS.length) navigate('#/parcours'); return }
    flow.index = next
    refresh()
  }
  const jump = (i) => { flow.index = i; refresh() }
  ctx.go = go

  // Les nœuds que la frappe met à jour. Tout le reste — la question, le champ,
  // la liste des étapes — reste en place : un champ qui se recrée à chaque
  // touche perd le curseur, et la frappe suivante écrase la précédente.
  const nextBtn = h('button', {
    class: 'btn btn-primary btn-lg',
    onClick: () => go(1),
  }, flow.index === STEPS.length - 2 ? 'Voir le résultat' : 'Continuer')

  // Le récapitulatif qui s'affichait à droite est parti : il montrait des
  // chiffres que l'utilisateur n'avait pas encore donnés — des valeurs de
  // métier, des charges suggérées — et personne ne pouvait savoir d'où elles
  // venaient. Le résultat se lit à la fin du parcours, une fois qu'il est à soi.
  ctx.tick = () => {
    const live = store.scenario
    ctx.scenario = live
    const ok = step.ready(live)
    nextBtn.disabled = !ok
    nextBtn.classList.toggle('is-waiting', !ok)
  }
  // Ajouter ou retirer une ligne change la question elle-même (une personne de
  // plus dans l'équipe, par exemple) : là, on redessine tout.
  ctx.redraw = () => refresh()

  const body = h('div', { class: 'setup-body' }, step.render(ctx))
  const ready = step.ready(s)
  nextBtn.disabled = !ready
  if (!ready) nextBtn.classList.add('is-waiting')
  return h('div', { class: 'setup' },
    h('div', { class: 'setup-bar' },
      h('div', { class: 'setup-bar-fill', style: { width: `${(flow.index / (STEPS.length - 1)) * 100}%` } }),
    ),

    h('div', { class: 'setup-shell' },
      stepList(s, jump, navigate),

      h('div', { class: 'setup-main' },
        // Le bandeau rassurant.
        //
        // En test, les gens s'arrêtaient sur chaque question comme s'ils
        // signaient : « et si je me trompe ? ». Ils ne se trompent pas, ils
        // commencent. Le dire une fois, en haut, à demeure, vaut mieux que de
        // le répéter sous chaque bouton.
        !step.last ? h('div', { class: 'setup-banner' },
          h('span', { class: 'setup-banner-mark' }, '\u21BA'),
          h('div', {},
            h('strong', {}, 'Rien n’est définitif.'),
            h('span', {}, ' Ces questions servent à poser un premier chiffrage. Tout se modifie ensuite, champ par champ, dans le logiciel.'),
          ),
        ) : null,

        h('div', { class: `setup-card ${step.last ? 'is-last' : ''}` },
          h('div', { class: 'setup-tag' },
            h('span', { class: 'setup-tag-bar' }),
            h('span', {}, step.last ? 'Résultat' : `Question ${pad(flow.index + 1)} / ${pad(STEPS.length - 1)}`),
            step.optional ? h('span', { class: 'setup-tag-opt' }, 'facultatif') : null,
          ),
          h('h1', { class: 'setup-q' }, typeof step.question === 'function' ? step.question(s) : step.question),
          step.help ? h('p', { class: 'setup-help' }, typeof step.help === 'function' ? step.help(s) : step.help) : null,
          body,
          !step.last ? h('div', {},
            h('div', { class: 'setup-actions' },
              flow.index > 0 ? h('button', { class: 'btn btn-lg btn-ghost', onClick: () => go(-1) }, 'Retour') : null,
              nextBtn,
              step.optional ? h('button', { class: 'setup-later', onClick: () => go(1) }, 'Plus tard') : null,
            ),
            step.optional
              ? h('p', { class: 'setup-reassure' }, 'Tu peux passer cette question et y revenir plus tard.')
              : null,
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
      h('span', { class: 'setup-steps-sub' }, `${STEPS.length - 1} questions · tout reste modifiable`),
    ),
    ...STEPS.map((st, i) => {
      const done = i < flow.index && st.ready(s)
      return h('button', {
        class: `setup-step ${i === flow.index ? 'current' : ''} ${done ? 'done' : ''}`,
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
function field(ctx, { type, placeholder, value, apply, suffix }) {
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
    // Tant que la valeur n'est qu'une suggestion, tout retour dans le champ la
    // resélectionne : cliquer dessus veut dire « je vais mettre la mienne »,
    // pas « je veux ajouter des chiffres derrière ».
    onFocus: (e) => { if (!flow.touched.has(ctx.step.key)) e.target.select() },
    onMouseUp: (e) => { if (!flow.touched.has(ctx.step.key)) { e.preventDefault(); e.target.select() } },
  })

  // Le focus est posé une fois, à l'arrivée sur la question. Une suggestion du
  // métier est sélectionnée — la première touche la remplace ; une réponse déjà
  // donnée ne l'est pas — on vient la corriger, pas la refaire.
  const suggested = !flow.touched.has(ctx.step.key) && String(initial ?? '') !== ''
  requestAnimationFrame(() => {
    input.focus({ preventScroll: true })
    try {
      if (suggested) input.select()
      else input.setSelectionRange(input.value.length, input.value.length)
    } catch { /* champ sans sélection */ }
  })

  return h('div', {},
    h('div', { class: 'setup-field' },
      input,
      suffix ? h('span', { class: 'setup-suffix' }, suffix) : null,
    ),
    suggested
      ? h('p', { class: 'setup-suggested' }, 'Valeur courante dans ton métier. Écris la tienne par-dessus.')
      : null,
  )
}

/** Choix parmi des options, en grandes cartes cliquables. */
function choice(ctx, options) {
  const host = h('div', { class: 'setup-choices' })
  const draw = () => host.replaceChildren(...options.map((o) => h('button', {
    class: `setup-choice ${o.active() ? 'active' : ''}`,
    onClick: () => { flow.touched.add(ctx.step.key); o.pick(); draw(); ctx.tick(); ctx.onChoice?.() },
  },
    h('span', { class: 'setup-choice-label' }, o.label),
    o.note ? h('span', { class: 'setup-choice-note' }, o.note) : null,
  )))
  draw()
  return host
}

/* ───────────────────────────── Écran : métier ───────────────────────────── */

function sectorPicker(ctx) {
  const current = store.scenario?.meta?.sectorKey
  return h('div', { class: 'setup-sectors' },
    ...sectorsByFamily().flatMap((family) => family.sectors.map((sector) => h('button', {
      class: `setup-sector ${current === sector.key ? 'active' : ''}`,
      onClick: () => {
        // Le stade du projet parle du fondateur, pas du commerce : passer de
        // glacier à salon de coiffure ne le fait pas revenir à l'idée.
        const stage = store.scenario?.meta?.stage || ''
        if (store.scenario && !store.scenario.meta.isDemo && store.scenario.meta.sectorKey) {
          // Changer de métier réécrit les hypothèses : on repart d'un plan neuf
          // plutôt que de mélanger deux jeux de valeurs par défaut.
          store.create({ template: sector.key, level: store.scenario.meta.level || 'easy', name: SECTORS[sector.key].label, sample: false })
        } else {
          store.create({ template: sector.key, level: 'easy', name: SECTORS[sector.key].label, sample: false })
        }
        if (stage) store.update((d) => { d.meta.stage = stage })
        ctx.refresh()
      },
    },
      h('span', { class: 'setup-sector-glyph' }, sector.glyph),
      h('span', { class: 'setup-sector-name' }, sector.label),
    ))),
    h('button', {
      class: `setup-sector ${current === null && store.scenario ? 'active' : ''}`,
      onClick: () => {
        const stage = store.scenario?.meta?.stage || ''
        store.create({ template: null, level: 'easy', name: 'Mon projet' })
        if (stage) store.update((d) => { d.meta.stage = stage })
        ctx.refresh()
      },
    },
      h('span', { class: 'setup-sector-glyph' }, '＋'),
      h('span', { class: 'setup-sector-name' }, 'Autre chose'),
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
  return choice(ctx, STAGES.map((st) => ({
    label: st.label,
    note: st.hint,
    active: () => store.scenario?.meta?.stage === st.key,
    pick: () => store.update((d) => { d.meta.stage = st.key }),
  })))
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
  const allowed = [...suggested, ...['SASU', 'SAS', 'EURL', 'SARL', 'EI', 'BNC', 'Association']
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
    EI: { label: 'Entreprise individuelle', note: "Pas de société, pas de capital. Le bénéfice est ton revenu : il est impôté à l'impôt sur le revenu, sans impôt sur les sociétés ni dividendes.", contract: 'tns' },
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
      }, { label: 'Forme juridique', silent: true }),
    }))),
    h('p', { class: 'setup-note' },
      "C'est ce choix qui décide du coût de ta rémunération, pas l'inverse."),
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
        value: (sc) => (Number(sc.activities[0].unitPrice) > 0 ? sc.activities[0].unitPrice : ''),
        apply: (sc, v) => { sc.activities[0].unitPrice = v },
      }))
    }
    if (recurring) {
      nodes.push(field(ctx, {
        type: 'number', placeholder: '49', suffix: '\u20AC par mois',
        value: (sc) => (Number(sc.activities[0].recurringPrice) > 0 ? sc.activities[0].recurringPrice : ''),
        apply: (sc, v) => { sc.activities[0].recurringPrice = v },
      }))
    }
    fieldHost.replaceChildren(...nodes)
  }

  const setMode = (patch) => store.update((sc) => patch(sc), { label: 'Modèle de revenu', silent: true })

  ctx.onChoice = drawField
  const picker = choice(ctx, [
    {
      label: 'À la vente', note: 'Le client paie une fois, et c’est réglé.',
      active: () => mode() === 'unitaire',
      pick: () => setMode((sc) => {
        const a = sc.activities[0]
        sc.meta.revenueModel = 'unitaire'
        if (!(Number(a.unitPrice) > 0)) a.unitPrice = 0
        a.recurringPrice = 0; a.recurringCost = 0; a.contractMonths = 0
      }),
    },
    {
      label: 'Par abonnement', note: 'Il paie tous les mois tant qu’il reste.',
      active: () => mode() === 'abonnement',
      pick: () => setMode((sc) => {
        const a = sc.activities[0]
        sc.meta.revenueModel = 'abonnement'
        a.unitPrice = 0; a.unitCost = 0
        if (!(Number(a.contractMonths) > 0)) a.contractMonths = 12
        if (!(Number(a.churnMonthly) > 0)) a.churnMonthly = 0.03
      }),
    },
    {
      label: 'Les deux', note: 'Un montant à la signature, puis un abonnement.',
      active: () => mode() === 'mixte',
      pick: () => setMode((sc) => {
        const a = sc.activities[0]
        sc.meta.revenueModel = 'mixte'
        if (!(Number(a.contractMonths) > 0)) a.contractMonths = 12
      }),
    },
    {
      label: 'À la commission', note: 'Tu prélèves un pourcentage sur ce qui passe par toi.',
      active: () => mode() === 'commission',
      pick: () => setMode((sc) => {
        const a = sc.activities[0]
        sc.meta.revenueModel = 'commission'
        sc.meta.commissionBasket = sc.meta.commissionBasket || 0
        sc.meta.commissionRate = sc.meta.commissionRate || 0.1
        a.recurringPrice = 0; a.recurringCost = 0; a.contractMonths = 0; a.unitCost = 0
        a.unitPrice = Math.round((sc.meta.commissionBasket || 0) * (sc.meta.commissionRate || 0))
      }),
    },
  ])

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
    sc.activities[0].unitPrice = Math.round((Number(sc.meta.commissionBasket) || 0) * (Number(sc.meta.commissionRate) || 0))
  }
  return h('div', {},
    field(ctx, {
      type: 'number', placeholder: '1200', suffix: '\u20AC par transaction',
      value: (sc) => (Number(sc.meta.commissionBasket) > 0 ? sc.meta.commissionBasket : ''),
      apply: (sc, v) => { sc.meta.commissionBasket = v; recompute(sc) },
    }),
    h('p', { class: 'setup-note' }, 'Le montant moyen de ce qui passe par toi.'),
    field(ctx, {
      type: 'number', placeholder: '10', suffix: '% pour toi',
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
      "Les montants proposés sont des ordres de grandeur pour ton métier. Rien ici n'est un frais fixe : le loyer et le comptable, tu viens de les saisir."))
}

/* ───────────────────── Écran : clients et croissance ────────────────────── */

function clientsScreen(ctx) {
  const voc = vocabulary(ctx.scenario)
  return field(ctx, {
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
  const pick = (value) => store.update((sc) => { sc.activities[0].volumes.monthlyGrowth = value },
    { label: 'Croissance', silent: true })
  return choice(ctx, [
    { label: 'Doucement', note: '+3 % par mois — le bouche-à-oreille', active: () => g() > 0 && g() <= 0.04, pick: () => pick(0.03) },
    { label: 'Normalement', note: '+8 % par mois — tu prospectes', active: () => g() > 0.04 && g() <= 0.10, pick: () => pick(0.08) },
    { label: 'Vite', note: '+15 % par mois — il faudra le démontrer', active: () => g() > 0.10, pick: () => pick(0.15) },
  ])
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
  const me = () => store.scenario.team?.find((x) => ME.test(x.role || ''))
  const type = () => me()?.contractType || (['SARL', 'EURL', 'EI', 'BNC', 'SELARL'].includes(store.scenario.meta.legalForm) ? 'tns' : 'dirigeant')
  const label = () => (type() === 'tns' ? 'Dirigeant TNS' : 'Dirigeant assimilé salarié')

  const host = h('div', { class: 'setup-salary-echo' })
  const draw = () => {
    const m = me()
    const gross = Number(m?.monthlyGross) || 0
    if (!gross) { host.replaceChildren(h('p', { class: 'setup-note' }, 'Laisse vide si tu ne te verses rien la première année.')); return }
    let c = null
    try { c = monthlyCost({ ...m, monthlyGross: gross }, { headcount: 1, fiscal: store.scenario.fiscal }) } catch { /* rien */ }
    if (!c) { host.replaceChildren(); return }
    const tns = type() === 'tns'
    const perks = c.benefits || 0
    // Les trois marches, au mois et à l'année : c'est à l'année qu'on compare
    // un salaire, et à l'année que le coût pour l'entreprise se négocie.
    const rows = [
      {
        label: 'Ce que débourse l’entreprise', value: c.superGross, tone: 'top',
        note: tns
          ? `Ta rémunération plus les cotisations d'indépendant.`
          : `Ton brut plus ${euro(c.employerCharges)} de cotisations patronales${perks > 0 ? ` et ${euro(perks)} de mutuelle obligatoire` : ''}.`,
      },
      {
        label: tns ? 'Ta rémunération' : 'Ton salaire brut', value: gross,
        note: tns ? "C'est la base sur laquelle tes cotisations sont appelées." : 'Le chiffre qui figure sur le contrat.',
      },
      {
        label: 'Ce que tu touches', value: tns ? gross : c.net, tone: 'bottom',
        note: tns
          ? "Un indépendant n'a pas de cotisations salariées : ce montant est celui versé, avant impôt sur le revenu."
          : `Après ${euro(c.employeeCharges)} de cotisations salariales, avant impôt sur le revenu.`,
      },
    ]
    const ratio = gross > 0 ? c.superGross / (tns ? gross : c.net) : 0
    host.replaceChildren(
      h('div', { class: 'ladder' },
        ...rows.map((r) => h('div', { class: `ladder-row ${r.tone || ''}` },
          h('span', { class: 'ladder-main' },
            h('span', { class: 'ladder-label' }, r.label),
            h('span', { class: 'ladder-note' }, r.note),
          ),
          h('span', { class: 'ladder-figures' },
            h('span', { class: 'num ladder-month' }, `${euro(r.value)} / mois`),
            h('span', { class: 'num ladder-year' }, `${euro(r.value * 12)} par an`),
          ),
        )),
      ),
      h('p', { class: 'setup-note' },
        `Statut ${label()}. Pour te laisser 1 € en poche, l'entreprise doit en sortir ${ratio.toFixed(2).replace('.', ',')} € — c'est ce rapport, pas le brut, qui décide de ce que tu peux te verser.`),
    )
  }

  const f = field(ctx, {
    type: 'number', placeholder: '2500',
    suffix: type() === 'tns' ? '\u20AC par mois' : '\u20AC brut par mois',
    value: (sc) => {
      const m = sc.team?.find((x) => ME.test(x.role || ''))
      return m && Number(m.monthlyGross) > 0 ? m.monthlyGross : ''
    },
    apply: (sc, v) => {
      let m = sc.team?.find((x) => ME.test(x.role || ''))
      if (!m) { m = newTeamMember({ role: 'Moi', contractType: type(), status: 'cadre', monthlyGross: v }); sc.team.push(m) }
      m.monthlyGross = v
      m.contractType = type()
    },
  })

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
    f, host,
  )
}

const ladderRow = (label, value, tone = '') => h('div', { class: `ladder-row ${tone}` },
  h('span', {}, label),
  h('span', { class: 'num' }, value),
)

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
  return h('div', {},
    field(ctx, {
      type: 'number', placeholder: '10 000', suffix: '€',
      value: (sc) => {
        const total = (sc.financing.equityFounders || []).reduce((a, x) => a + (Number(x.amount) || 0), 0)
        return total > 0 ? total : ''
      },
      apply: (sc, v) => { sc.financing.equityFounders = v > 0 ? [{ month: 0, amount: v }] : [] },
    }),
    h('p', { class: 'setup-note' }, "Si tu n'as rien de côté, mets zéro : Fynomia te dira exactement combien il te manque et à quelle date."),
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

  return h('div', {},
    // Le chiffre qu'on emporte en quittant le parcours. Le reste était la
    // manière de l'obtenir.
    keystone("Chiffre d'affaires année 1", euro(p.revenue[0], { compact: true }),
      need
        ? `Il manque ${euro(k.fundingNeed)} au point bas de trésorerie. Le module Financement dit quoi aller chercher.`
        : 'La trésorerie ne passe jamais sous zéro sur cinq ans.'),

    h('div', { class: 'setup-results' },
      resultRow('Point mort', k.breakEven[0] ? euro(k.breakEven[0], { compact: true }) : '—'),
      resultRow('Premier exercice rentable',
        k.firstProfitableYear !== null ? `Année ${k.firstProfitableYear + 1}` : 'Au-delà de 5 ans',
        k.firstProfitableYear !== null ? 'ok' : 'warn'),
      resultRow(need ? 'Financement à trouver' : 'Trésorerie',
        need ? euro(k.fundingNeed) : 'Jamais négative', need ? 'warn' : 'ok'),
    ),

    h('div', { class: 'setup-unlocked' },
      h('div', { class: 'setup-unlocked-title' }, 'Ce qui s’ouvre maintenant'),
      h('ul', { class: 'setup-unlocked-list' },
        h('li', {}, 'Des offres, des salariés, des campagnes et des investissements, chacun activable pour voir ce qu’il coûte.'),
        h('li', {}, 'Les délais de paiement, la TVA, la saisonnalité et les crédits d’impôt.'),
        h('li', {}, 'Le tableau de bord, les états financiers et le dossier à exporter.'),
      ),
    ),

    h('div', { class: 'setup-actions' },
      h('button', {
        class: 'btn btn-primary btn-lg',
        onClick: () => { resetSetup(); ctx.navigate('#/parcours') },
      }, 'Voir mon business plan →'),
      h('button', {
        class: 'btn btn-lg',
        onClick: () => { resetSetup(); ctx.navigate('#/business-case') },
      }, 'Exporter le dossier'),
    ),
  )
}

const resultRow = (label, value, tone = '') => h('div', { class: `setup-result ${tone}` },
  h('span', { class: 'setup-result-label' }, label),
  h('span', { class: 'setup-result-value num' }, value),
)

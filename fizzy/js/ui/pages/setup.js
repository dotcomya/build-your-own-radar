/**
 * Le parcours guidé — onze questions, une à la fois.
 *
 * Un prévisionnel demande une soixantaine de chiffres. Les demander tous sur le
 * même écran, c'est ce que fait un tableur, et c'est précisément ce qui fait
 * abandonner. On en demande donc onze, une par écran, dans l'ordre où ils se
 * répondent — et Fizzy déduit le reste.
 *
 * Trois règles tenues bout à bout :
 *
 *  1. UNE question par écran. Jamais deux idées à la fois.
 *  2. Le vocabulaire du fondateur, pas celui du comptable. On demande « vous
 *     démarrez avec combien ? », pas « quel est votre plan de financement
 *     initial ». Le mot juste arrive plus tard, quand le chiffre est là.
 *  3. Chaque réponse produit immédiatement une conséquence visible. C'est ce
 *     qui distingue ce parcours d'un formulaire : on voit le modèle se
 *     construire sous soi.
 *
 * Rien n'est irréversible : on revient en arrière, et tout reste modifiable
 * ensuite dans les pages détaillées.
 */

import { h, euro, num, pct, toast } from '../dom.js'
import { sectorsByFamily, SECTORS, getSector, vocabulary } from '../../state/sectors.js'
import { newTeamMember, newOpex } from '../../state/schema.js'
import { monthlyCost } from '../../engine/payroll.js'
import { compute } from '../../engine/engine.js'
import store from '../../state/store.js'

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

/* ──────────────────────────────── Les écrans ────────────────────────────── */

const STEPS = [
  {
    key: 'metier', short: 'Votre métier',
    question: 'Vous faites quoi ?',
    help: "Le métier commande la TVA, votre statut et les repères de marge. C'est le seul choix qui change tout le reste.",
    render: sectorPicker,
    ready: (s) => !!s?.meta?.sectorKey,
  },
  {
    key: 'nom', short: 'Le nom',
    question: 'Ça s’appelle comment ?',
    help: 'Le nom de votre projet. Vous pourrez le changer quand vous voudrez.',
    render: (ctx) => field(ctx, {
      type: 'text', placeholder: 'Mon projet',
      value: (s) => s.meta.company || '',
      apply: (s, v) => { s.meta.company = v; if (v.trim()) s.meta.name = v.trim() },
    }),
    ready: () => true,
  },
  {
    key: 'forme', short: 'La forme juridique',
    question: 'Sous quelle forme ?',
    help: "Elle décide de votre statut social et de la façon dont vous vous rémunérez. Rien n'est définitif : on la change en un clic.",
    render: legalScreen,
    ready: (s) => !!s?.meta?.legalForm,
  },
  {
    key: 'depart', short: 'Votre mise de départ',
    question: 'Vous démarrez avec combien ?',
    help: "L'argent déjà disponible : votre apport, celui de vos associés. On verra à la fin s'il en manque.",
    optional: true,
    render: cashScreen,
    ready: () => true,
  },
  {
    key: 'offre', short: 'Ce que vous vendez',
    question: 'Vous vendez quoi ?',
    help: (s) => `Une ${vocabulary(s).one}, un forfait, un abonnement — dites-le comme vous le diriez à un client.`,
    render: (ctx) => field(ctx, {
      type: 'text', placeholder: (s) => vocabulary(s).one,
      value: (s) => (s.activities[0]?.name === 'À définir' ? '' : s.activities[0]?.name || ''),
      apply: (s, v) => { if (s.activities[0]) s.activities[0].name = v.trim() || 'Mon offre' },
    }),
    ready: () => true,
  },
  {
    key: 'prix', short: 'Le prix',
    question: 'Comment rentre l’argent ?',
    help: 'La forme du revenu change tout : une vente qui se répète ne vaut pas une vente unique.',
    render: priceScreen,
    ready: (s) => (Number(s?.activities?.[0]?.unitPrice) || 0) > 0 || (Number(s?.activities?.[0]?.recurringPrice) || 0) > 0,
  },
  {
    key: 'salaire', short: 'Votre rémunération',
    question: 'Vous vous payez combien ?',
    help: "Fizzy calcule ce que ça coûte vraiment à l'entreprise. Un plan où le fondateur ne se paie pas n'est pas prudent — il est faux.",
    optional: true,
    render: salaryScreen,
    ready: () => true,
  },
  {
    key: 'frais', short: 'Vos frais fixes',
    question: 'Vos frais tous les mois',
    help: 'Cochez ce qui vous concerne. Ce sont eux qui fixent le nombre de clients dont vous avez besoin.',
    optional: true,
    render: costsScreen,
    ready: () => true,
  },
  {
    key: 'clients', short: 'Vos premiers clients',
    question: 'Combien de clients le premier mois ?',
    help: "Pas une ambition : ce que vous pouvez livrer et facturer dès le début. C'est le chiffre le plus discuté d'un business plan.",
    render: clientsScreen,
    ready: (s) => (Number(s?.activities?.[0]?.volumes?.startUnits) || 0) > 0,
  },
  {
    key: 'cout', short: 'Le coût de revient',
    // On ne demande le coût de revient qu'ici, une fois les frais connus : sans
    // ce repère, « ce que ça vous coûte de produire » ne veut rien dire pour
    // quelqu'un qui n'a jamais tenu de comptabilité — et la confusion la plus
    // fréquente est justement d'y ranger le loyer ou le comptable.
    question: 'Et chaque vente, elle vous coûte quoi ?',
    help: "Uniquement ce qui augmente quand vous vendez une unité de plus : matières, sous-traitance, commission. Pas le loyer ni le comptable — ceux-là, vous venez de les saisir.",
    optional: true,
    render: costScreen,
    ready: () => true,
  },
  {
    key: 'croissance', short: 'La croissance',
    question: 'Ça grandit à quelle vitesse ?',
    help: 'Fizzy freine automatiquement la courbe dans la durée — aucune croissance ne tient cinq ans au même rythme.',
    optional: true,
    render: growthScreen,
    ready: () => true,
  },
  {
    key: 'fin', short: 'Le résultat',
    question: 'Votre business plan est prêt',
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
  const echoHost = h('div', { class: 'plan-host' })
  const nextBtn = h('button', {
    class: 'btn btn-primary btn-lg',
    onClick: () => go(1),
  }, flow.index === STEPS.length - 2 ? 'Voir le résultat' : 'Continuer')

  ctx.tick = () => {
    const live = store.scenario
    ctx.scenario = live
    echoHost.replaceChildren(livePlan(live, step, ctx))
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
  echoHost.replaceChildren(livePlan(s, step, ctx))

  return h('div', { class: 'setup' },
    h('div', { class: 'setup-bar' },
      h('div', { class: 'setup-bar-fill', style: { width: `${(flow.index / (STEPS.length - 1)) * 100}%` } }),
    ),

    h('div', { class: 'setup-shell' },
      stepList(s, jump, navigate),

      h('div', { class: 'setup-main' },
        h('div', { class: `setup-card ${step.last ? 'is-last' : ''}` },
          h('h1', { class: 'setup-q' }, typeof step.question === 'function' ? step.question(s) : step.question),
          step.help ? h('p', { class: 'setup-help' }, typeof step.help === 'function' ? step.help(s) : step.help) : null,
          body,
          !step.last ? h('div', { class: 'setup-actions' },
            flow.index > 0 ? h('button', { class: 'btn btn-lg btn-ghost', onClick: () => go(-1) }, 'Retour') : null,
            nextBtn,
            step.optional ? h('button', { class: 'setup-later', onClick: () => go(1) }, 'Plus tard') : null,
          ) : null,
        ),
        echoHost,
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
      h('span', { class: 'setup-steps-title' }, 'Votre business plan'),
      h('span', { class: 'setup-steps-sub' }, `${STEPS.length} questions · tout reste modifiable`),
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

/**
 * Votre plan, à droite, qui se remplit.
 *
 * Ce n'est pas un résumé : ce sont les lignes réelles du modèle. Elles
 * commencent vides — un tiret, pas un zéro — et chaque réponse en fait
 * apparaître une. Le fondateur voit son tableau se construire au lieu de
 * remplir un formulaire et de découvrir le résultat à la fin.
 *
 * Les lignes sont vivantes : on décoche un frais, on retire un poste, on
 * ajoute une ligne, sans quitter la question en cours.
 */
function livePlan(s, step, ctx) {
  if (!s) return emptyPlan()
  let r = null
  try { r = compute(s) } catch { /* modèle incomplet : on affiche ce qu'on a */ }

  const voc = vocabulary(s)
  const a = s.activities[0] || {}
  const months = Math.max(1, Number(a.contractMonths) || 1)
  const perClient = (Number(a.unitPrice) || 0) - (Number(a.unitCost) || 0)
    + ((Number(a.recurringPrice) || 0) - (Number(a.recurringCost) || 0)) * months

  const team = (s.team || []).filter((m) => m.enabled !== false)
  const opex = (s.opex || []).filter((o) => o.enabled !== false)
  const cash = (s.financing?.equityFounders || []).reduce((x, e) => x + (Number(e.amount) || 0), 0)

  const revenue = r ? r.pnl.revenue[0] || 0 : 0
  const fixed = r ? r.kpis.fixedCosts[0] || 0 : 0
  const need = perClient > 0 && fixed > 0 ? Math.ceil(fixed / perClient) : null

  return h('aside', { class: 'plan' },
    h('div', { class: 'plan-head' },
      h('span', { class: 'plan-title' }, 'Votre plan'),
      h('span', { class: 'plan-live' }, 'se remplit à mesure'),
    ),

    // ── Ce que vous vendez ───────────────────────────────────────────────
    planBlock('Ce que vous vendez', [
      (Number(a.unitPrice) || 0) > 0 || (Number(a.recurringPrice) || 0) > 0
        ? planRow(a.name, (Number(a.recurringPrice) || 0) > 0
            ? `${euro(a.recurringPrice)}/mois`
            : euro(a.unitPrice))
        : planEmpty('Aucun prix'),
      perClient > 0 ? planRow(`Marge par ${voc.client}`, euro(perClient), 'sub') : null,
      (Number(a.volumes?.startUnits) || 0) > 0
        ? planRow('Au départ', `${num(a.volumes.startUnits)} ${voc.many}/mois`, 'sub')
        : null,
    ]),

    // ── L'équipe ─────────────────────────────────────────────────────────
    planBlock('Votre équipe', team.length
      ? team.map((m) => planRow(m.role, `${euro(m.monthlyGross)}/mois`, '', () => {
          store.update((sc) => { sc.team = sc.team.filter((x) => x.id !== m.id) }, { label: 'Équipe', silent: true })
          ctx.redraw()
        }))
      : [planEmpty('Personne, pas même vous')],
      step.key === 'salaire' ? { label: '＋ Quelqu’un d’autre', act: () => {
        store.update((sc) => sc.team.push(newTeamMember({ role: 'Nouveau poste', monthlyGross: 2200 })), { label: 'Équipe', silent: true })
        ctx.redraw()
      } } : null),

    // ── Les frais ────────────────────────────────────────────────────────
    planBlock('Vos frais', opex.length
      ? opex.map((o) => planRow(o.label, `${euro(o.monthlyAmount)}/mois`))
      : [planEmpty('Aucun frais')]),

    // ── L'argent de départ ───────────────────────────────────────────────
    planBlock('Votre mise', [
      cash > 0 ? planRow('Apport', euro(cash)) : planEmpty('Rien pour l’instant'),
    ]),

    // ── Ce que ça donne ──────────────────────────────────────────────────
    h('div', { class: 'plan-out' },
      planOut("Chiffre d'affaires année 1", revenue > 0 ? euro(revenue, { compact: true }) : null),
      planOut('Charges fixes année 1', fixed > 0 ? euro(fixed, { compact: true }) : null),
      planOut(`${voc.many} pour l'équilibre`, need !== null ? num(need) : null, 'strong'),
      r && r.kpis.fundingNeed > 0 && STEPS.findIndex((x) => x.key === 'depart') <= flow.index
        ? planOut('Il vous manque', euro(r.kpis.fundingNeed), 'bad') : null,
    ),
  )
}

const emptyPlan = () => h('aside', { class: 'plan' },
  h('div', { class: 'plan-head' },
    h('span', { class: 'plan-title' }, 'Votre plan'),
    h('span', { class: 'plan-live' }, 'encore vide'),
  ),
  h('p', { class: 'plan-nothing' }, 'Choisissez votre métier : les lignes apparaîtront ici à mesure que vous répondez.'),
)

function planBlock(title, rows, add) {
  const live = rows.filter(Boolean)
  return h('div', { class: 'plan-block' },
    h('div', { class: 'plan-block-title' }, title),
    ...live,
    add ? h('button', { class: 'plan-add', onClick: add.act }, add.label) : null,
  )
}

const planRow = (label, value, tone = '', remove = null) => h('div', { class: `plan-row ${tone}` },
  h('span', { class: 'plan-row-label' }, label),
  h('span', { class: 'plan-row-value num' }, value),
  remove ? h('button', { class: 'plan-row-x', title: 'Retirer', onClick: remove }, '\u00D7') : null,
)

const planEmpty = (text) => h('div', { class: 'plan-row is-empty' },
  h('span', { class: 'plan-row-label' }, text),
  h('span', { class: 'plan-row-value num' }, '\u2014'),
)

const planOut = (label, value, tone = '') => h('div', { class: `plan-out-row ${tone} ${value ? '' : 'is-empty'}` },
  h('span', {}, label),
  h('span', { class: 'num' }, value || '\u2014'),
)

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
      const raw = e.target.value
      const v = type === 'number' ? (parseFloat(raw.replace(/\s/g, '').replace(',', '.')) || 0) : raw
      flow.touched.add(ctx.step.key)
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
      ? h('p', { class: 'setup-suggested' }, 'Valeur courante dans votre métier — écrivez la vôtre par-dessus.')
      : null,
  )
}

/** Choix parmi des options, en grandes cartes cliquables. */
function choice(ctx, options) {
  const host = h('div', { class: 'setup-choices' })
  const draw = () => host.replaceChildren(...options.map((o) => h('button', {
    class: `setup-choice ${o.active() ? 'active' : ''}`,
    onClick: () => { o.pick(); draw(); ctx.tick(); ctx.onChoice?.() },
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
        if (store.scenario && !store.scenario.meta.isDemo && store.scenario.meta.sectorKey) {
          // Changer de métier réécrit les hypothèses : on repart d'un plan neuf
          // plutôt que de mélanger deux jeux de valeurs par défaut.
          store.create({ template: sector.key, level: store.scenario.meta.level || 'easy', name: SECTORS[sector.key].label, sample: false })
        } else {
          store.create({ template: sector.key, level: 'easy', name: SECTORS[sector.key].label, sample: false })
        }
        ctx.refresh()
      },
    },
      h('span', { class: 'setup-sector-glyph' }, sector.glyph),
      h('span', { class: 'setup-sector-name' }, sector.label),
    ))),
    h('button', {
      class: `setup-sector ${current === null && store.scenario ? 'active' : ''}`,
      onClick: () => { store.create({ template: null, level: 'easy', name: 'Mon projet' }); ctx.refresh() },
    },
      h('span', { class: 'setup-sector-glyph' }, '＋'),
      h('span', { class: 'setup-sector-name' }, 'Autre chose'),
    ),
  )
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
  const allowed = sector?.legal?.forms || ['SAS', 'SARL', 'EI']
  const current = () => store.scenario.meta.legalForm

  const FORMS = {
    SAS: { label: 'SAS', note: 'Président assimilé salarié : meilleure protection, coût le plus élevé. La forme des projets qui lèvent.', contract: 'dirigeant' },
    SASU: { label: 'SASU', note: 'La SAS à associé unique. Même régime pour le président.', contract: 'dirigeant' },
    SARL: { label: 'SARL', note: 'Gérant majoritaire TNS : environ 45 % de cotisations, protection plus légère, pas de chômage.', contract: 'tns' },
    EURL: { label: 'EURL', note: 'La SARL à associé unique. Gérant TNS.', contract: 'tns' },
    EI: { label: 'Entreprise individuelle', note: 'Pas de société : le bénéfice est imposé directement à votre nom.', contract: 'tns' },
    BNC: { label: 'Exercice libéral', note: 'Bénéfices non commerciaux. Le résultat du cabinet est votre revenu imposable.', contract: 'tns' },
    SELARL: { label: 'SELARL', note: 'Société d’exercice libéral. Gérant majoritaire TNS.', contract: 'tns' },
    SELAS: { label: 'SELAS', note: 'Société d’exercice libéral par actions. Président assimilé salarié.', contract: 'dirigeant' },
    SCM: { label: 'SCM', note: 'Société civile de moyens : on partage les charges, pas les honoraires.', contract: 'tns' },
  }

  return h('div', {},
    choice(ctx, allowed.filter((f) => FORMS[f]).map((f) => ({
      label: FORMS[f].label,
      note: FORMS[f].note,
      active: () => current() === f,
      pick: () => store.update((sc) => {
        sc.meta.legalForm = f
        sc.founder.majorityManager = ['SARL', 'EURL', 'SELARL'].includes(f)
        // Le statut du dirigeant suit la forme : c'est elle qui le détermine,
        // pas un choix séparé qu'on oublierait de mettre à jour.
        const me = sc.team?.find((x) => ME.test(x.role || ''))
        if (me) me.contractType = FORMS[f].contract
      }, { label: 'Forme juridique', silent: true }),
    }))),
    h('p', { class: 'setup-note' },
      "Ce choix fixe votre statut social — c'est lui qui décide du coût de votre rémunération, pas l'inverse."),
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
 * D'où vient l'argent.
 *
 * Quatre formes, et une seule question derrière : est-ce que cette vente se
 * répète ? La commission mérite sa place — marketplace, agence, apporteur
 * d'affaires : on ne vend pas un produit, on prélève un pourcentage sur ce qui
 * passe. Le raisonnement est différent, et se tromper de modèle à ce stade
 * fausse tout le reste.
 */
function priceScreen(ctx) {
  const act = () => store.scenario.activities[0]
  const mode = () => {
    const a = act()
    if (store.scenario.meta.revenueModel === 'commission') return 'commission'
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
      label: 'À la commission', note: 'Vous prélevez un pourcentage sur ce qui passe par vous.',
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
 * Ce que Fizzy enregistre reste un prix par transaction — le moteur n'a pas
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
    h('p', { class: 'setup-note' }, 'Le montant moyen de ce qui passe par vous.'),
    field(ctx, {
      type: 'number', placeholder: '10', suffix: '% pour vous',
      value: (sc) => (Number(sc.meta.commissionRate) > 0 ? Math.round(sc.meta.commissionRate * 1000) / 10 : ''),
      apply: (sc, v) => { sc.meta.commissionRate = (Number(v) || 0) / 100; recompute(sc) },
    }),
  )
}

function costScreen(ctx) {
  const recurring = (Number(ctx.scenario.activities[0].recurringPrice) || 0) > 0
  return field(ctx, {
    type: 'number', placeholder: '0',
    suffix: recurring ? '\u20AC par mois et par client' : '\u20AC',
    value: (sc) => {
      const v = recurring ? sc.activities[0].recurringCost : sc.activities[0].unitCost
      return Number(v) > 0 ? v : ''
    },
    apply: (sc, v) => { if (recurring) sc.activities[0].recurringCost = v; else sc.activities[0].unitCost = v },
  })
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
    { label: 'Normalement', note: '+8 % par mois — vous prospectez', active: () => g() > 0.04 && g() <= 0.10, pick: () => pick(0.08) },
    { label: 'Vite', note: '+15 % par mois — il faudra le démontrer', active: () => g() > 0.10, pick: () => pick(0.15) },
  ])
}

/* ──────────────────── Écran : rémunération et frais ─────────────────────── */

/**
 * Votre rémunération, et ce qu'elle coûte vraiment.
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
    if (!gross) { host.replaceChildren(h('p', { class: 'setup-note' }, 'Laissez vide si vous ne vous versez rien la première année.')); return }
    let c = null
    try { c = monthlyCost({ ...m, monthlyGross: gross }, { headcount: 1, fiscal: store.scenario.fiscal }) } catch { /* rien */ }
    if (!c) { host.replaceChildren(); return }
    host.replaceChildren(
      h('div', { class: 'ladder' },
        ladderRow('Coût pour l’entreprise', euro(c.superGross), 'top'),
        ladderRow(type() === 'tns' ? 'Votre rémunération' : 'Votre brut', euro(gross)),
        ladderRow('Ce que vous touchez', euro(c.net), 'bottom'),
      ),
      h('p', { class: 'setup-note' },
        type() === 'tns'
          ? `Statut ${label()} : les cotisations s’ajoutent à votre rémunération. L’impôt sur le revenu s’applique ensuite.`
          : `Statut ${label()} : cotisations patronales puis salariales. L’impôt sur le revenu s’applique ensuite.`),
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
      h('span', { class: 'setup-status-tag' }, 'Votre statut'),
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
    h('p', { class: 'setup-note' }, 'Ces montants sont des ordres de grandeur pour votre métier. Corrigez-les maintenant ou plus tard.'))
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
    h('p', { class: 'setup-note' }, "Si vous n'avez rien de côté, mettez zéro : Fizzy vous dira exactement combien il vous manque et à quelle date."),
  )
}

/* ──────────────────────────────── La fin ────────────────────────────────── */

function doneScreen(ctx) {
  const s = ctx.scenario
  let r = null
  try { r = compute(s) } catch { /* rien à montrer */ }
  if (!r) return h('p', {}, 'Le modèle n’a pas pu être calculé.')

  const k = r.kpis, p = r.pnl
  const y = k.firstProfitableYear !== null ? k.firstProfitableYear : 0

  return h('div', {},
    h('div', { class: 'setup-results' },
      resultRow("Chiffre d'affaires année 1", euro(p.revenue[0], { compact: true })),
      resultRow('Point mort', k.breakEven[0] ? euro(k.breakEven[0], { compact: true }) : '—'),
      resultRow('Premier exercice rentable',
        k.firstProfitableYear !== null ? `Année ${k.firstProfitableYear + 1}` : 'Au-delà de 5 ans',
        k.firstProfitableYear !== null ? 'ok' : 'warn'),
      resultRow(k.fundingNeed > 0 ? 'Il vous manque' : 'Trésorerie',
        k.fundingNeed > 0 ? euro(k.fundingNeed) : 'Jamais négative',
        k.fundingNeed > 0 ? 'warn' : 'ok'),
    ),
    h('div', { class: 'setup-unlocked' },
      h('div', { class: 'setup-unlocked-title' }, 'Le logiciel complet vous attend'),
      h('ul', { class: 'setup-unlocked-list' },
        h('li', {}, 'Ajoutez des salariés, des campagnes, des offres, des investissements — et mettez chaque ligne en pause pour voir ce qu’elle coûte vraiment.'),
        h('li', {}, 'Réglez les délais de paiement, la TVA, la saisonnalité, les crédits d’impôt.'),
        h('li', {}, 'Lisez les graphiques : trésorerie mois par mois, compte de résultat, bilan, point mort.'),
        h('li', {}, 'Un guide reste à droite pour vous emmener page après page.'),
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

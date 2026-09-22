/**
 * La synthèse, deuxième écriture.
 *
 * Première tentative : une métrique en très grand dans un bloc noir, des
 * barres sans cadre, tout en chasse fixe. C'était plus beau, et c'était un
 * autre écran — on y perdait ce qui fait la synthèse : l'avancement du
 * dossier, le verdict, les trois actes qui répondent dans l'ordre où l'on se
 * pose les questions, le texte qui explique chaque chiffre, les six chiffres
 * qu'on te demandera avec ce qu'ils signifient.
 *
 * Celle-ci garde le fond et ne change que la forme. Le récit vient du même
 * endroit que l'onglet d'origine — synthese() dans plain.js, figureSet() et
 * avancement() dans figures.js — si bien que les deux écrans disent toujours
 * la même chose, mot pour mot. Ce qui change :
 *
 *   — une seule surface noire, pour la seule question qui compte ce matin-là
 *     (ce qu'il reste à poser, ou le verdict quand tout est posé) ;
 *   — plus de cartes encadrées : des colonnes séparées par un filet, de
 *     l'air autour, une hiérarchie dite par la taille et non par les boîtes ;
 *   — des images qu'on interroge : chaque barre, chaque courbe, chaque
 *     répartition donne son chiffre au survol ;
 *   — un écran qui se monte en séquence à l'arrivée, et dont les chiffres
 *     battent quand ils changent.
 */

import { h, euro, num, pct, monthLabel } from '../dom.js'
import { hot, STATUS } from '../charts.js'
import { checklist } from '../checklist.js'
import { goToGap } from '../spotlight.js'
import { lookup } from '../glossary.js'
import { changed } from '../motion.js'
import { synthese, RELIRE, lignesRestantes } from '../plain.js'
import { figureSet, PAGE_NAME, avancement } from '../figures.js'
import { revenueSentence, costsSentence, mixSentence, cashSentence, bfrSentence, moneyFlowSentence } from '../explain.js'
import { suggestActions } from '../../engine/simulate.js'
import { verdict } from '../../engine/verdict.js'
import { referenceYear } from '../../format.js'
import store from '../../state/store.js'

const n = (v) => Number(v) || 0
const somme = (a) => (a || []).reduce((x, y) => x + n(y), 0)
const TON = { good: STATUS.gain, bad: STATUS.loss, watch: STATUS.warn }

/**
 * La typographie française, pour les titres.
 *
 * « 37 % » coupé entre le nombre et son signe, « salariale » laissé seul en
 * bout de ligne et « : 99 360 € » rejeté au début de la suivante : les titres
 * de l'essai sont grands, et chaque coupure s'y voit. L'espace avant les
 * signes doubles et le pourcentage devient insécable. Pas d'expression
 * régulière sur des caractères accentués : le paquet ne les échapperait pas.
 */
const INSECABLE = '\u00a0'
const titre = (t) => [' %', ' :', ' ;', ' ?', ' !', ' \u20ac', ' \u00bb', '\u00ab ']
  .reduce((acc, m) => acc.split(m).join(m[0] === ' ' ? INSECABLE + m.slice(1) : m.slice(0, -1) + INSECABLE), String(t))

/* ───────────────────────────── L'état de l'écran ─────────────────────────── */

/**
 * Ce que l'écran retient d'un rendu à l'autre.
 *
 * Le tableau de bord se redessine à chaque changement de chiffre. Sans
 * mémoire, le moindre réglage refermerait le raisonnement qu'on lisait,
 * replierait l'analyse qu'on venait d'ouvrir et ramènerait l'année 1 alors
 * qu'on examinait l'année 4.
 */
const etat = {
  annee: null,          // l'exercice lu par les six chiffres et l'analyse
  raisonnement: false,  // le verdict est-il déplié
  analyse: false,       // l'analyse détaillée est-elle ouverte
  analyseNeuve: false,  // vient-elle d'être ouverte (ses images se tracent alors)
  chiffres: new Set(),  // les chiffres dépliés
}

/**
 * La racine du dernier rendu.
 *
 * L'entrée en séquence se joue quand on arrive sur l'écran, jamais quand il se
 * redessine sous les doigts : des barres qui repoussent à chaque clic rendent
 * la page illisible. Un délai ne suffit pas à distinguer les deux — on lit
 * une minute, on clique sur une année, et tout se rejouait. Le critère est
 * donc la présence de l'écran : si la racine précédente est encore dans le
 * document, on redessine en place ; sinon, on arrive.
 */
let racine = null

export function renderStudio(navigate, refresh, goView) {
  const s = store.scenario
  const r = store.result
  if (!r) return h('div', { class: 'content' }, h('p', {}, 'Aucun résultat.'))

  const entree = !(racine && racine.isConnected)

  const y = etat.annee !== null && etat.annee >= 0 && etat.annee < 5 ? etat.annee : referenceYear(r)
  const choisir = (k) => { etat.annee = k; refresh() }
  const pilotage = () => (goView ? goView('pilotage') : navigate('#/tableau-de-bord'))

  let c = null
  try { c = checklist(s) } catch { c = null }
  const v = verdict(r, s)
  const { actes } = synthese(s, r)
  const complet = !c || !c.open || !c.next

  racine = h('div', { class: `sy ${entree ? 'is-enter' : ''}` },
    // Ce qui manque se dit avant ce qu'on a trouvé — tant qu'il manque
    // quelque chose. Un dossier complet ouvre directement sur son verdict.
    complet ? heroVerdict(v, r, navigate) : heroAvancement(c, navigate, pilotage),
    complet ? null : verdictLigne(v),
    ...actes.map((a, i) => acte(a, i, actes.length, r, s)),
    pied(navigate, pilotage),
    sixChiffres(r, s, y, choisir, navigate),
    analyse(r, s, y, choisir, navigate, refresh),
  )
  return racine
}

/* ─────────────────────────── 1. Où en est le dossier ─────────────────────── */

/**
 * L'avancement, en grand, et un échantillon de ce qui vient.
 *
 * Le noir porte la promesse — un dossier prêt pour la banque — et le geste
 * suivant. La colonne claire montre la file : ce qui vient d'être posé,
 * coché, puis les quatre lignes suivantes avec la raison de chacune. On voit
 * le chemin, pas seulement la prochaine marche.
 */
function heroAvancement(c, navigate, pilotage) {
  const t = avancement(c)
  const part = c.done / Math.max(1, c.total)
  const ouvertes = c.items.filter((i) => !i.done)
  const suite = [c.next, ...ouvertes.filter((i) => i !== c.next && !i.later)].slice(0, 4)
  const faites = c.items.filter((i) => i.done).slice(-2)

  return h('section', { class: 'sy-hero' },
    h('div', { class: 'sy-ink' },
      h('div', { class: 'sy-ink-top' },
        h('span', { class: 'sy-kicker is-accent' }, t.surtitre),
        h('span', { class: 'sy-live' }, h('i', { 'aria-hidden': 'true' }), 'Live'),
      ),
      h('h2', { class: 'sy-ink-title' }, t.titre),
      h('p', { class: 'sy-ink-text' }, t.texte),

      // Une case par ligne du dossier : on voit ce qui est fait et ce qui
      // reste, sans avoir à lire un pourcentage.
      h('div', { class: 'sy-cells', role: 'img', 'aria-label': `${c.done} lignes posées sur ${c.total}` },
        ...c.items.map((i, k) => h('i', {
          class: i.done ? 'is-done' : i === c.next ? 'is-next' : '',
          style: { '--i': String(k) },
        })),
      ),
      h('div', { class: 'sy-cells-legend' },
        ...c.groups.map((g) => h('span', {},
          h('b', {}, `${g.done}/${g.total}`), ` ${g.label.toLowerCase()}`)),
      ),

      h('div', { class: 'sy-ink-acts' },
        h('button', {
          class: 'sy-btn is-accent',
          onClick: (e) => goToGap(c.next.go, navigate, e.currentTarget),
        }, `Renseigner « ${c.next.label} » →`),
        h('button', { class: 'sy-btn is-ghost', onClick: pilotage }, t.parcourir),
      ),
      h('div', { class: 'sy-ink-meter', 'aria-hidden': 'true' },
        h('i', { style: { width: `${Math.round(part * 100)}%` } })),
    ),

    h('aside', { class: 'sy-next' },
      h('div', { class: 'sy-kicker' }, 'Tes prochaines étapes'),
      h('ol', { class: 'sy-steps' },
        ...faites.map((i) => h('li', { class: 'sy-step is-done' },
          h('button', { class: 'sy-step-go', onClick: (e) => goToGap(i.go, navigate, e.currentTarget) },
            h('span', { class: 'sy-step-mark', 'aria-hidden': 'true' }, '✓'),
            h('span', { class: 'sy-step-txt' }, h('span', { class: 'sy-step-label' }, i.label)),
          ))),
        ...suite.map((i, k) => h('li', { class: `sy-step ${k === 0 ? 'is-next' : ''}` },
          h('button', { class: 'sy-step-go', onClick: (e) => goToGap(i.go, navigate, e.currentTarget) },
            h('span', { class: 'sy-step-mark', 'aria-hidden': 'true' }, k === 0 ? '→' : String(k + 1)),
            h('span', { class: 'sy-step-txt' },
              k === 0 ? h('span', { class: 'sy-step-tag' }, 'Prochaine étape') : null,
              h('span', { class: 'sy-step-label' }, i.label),
              i.why ? h('span', { class: 'sy-step-why' }, i.why) : null,
            ),
          ))),
      ),
      c.open > suite.length
        ? h('button', { class: 'sy-link', onClick: pilotage },
            `+ ${c.open - suite.length} autre${c.open - suite.length > 1 ? 's' : ''} à poser`)
        : null,
    ),
  )
}

/**
 * Quand tout est posé, le noir revient au verdict.
 *
 * Il n'y a plus rien à renseigner : la seule question qui reste est « est-ce
 * que ça tient ». Le mot du verdict prend la place, le raisonnement suit, et la
 * colonne claire donne le chiffre qui décide.
 */
function heroVerdict(v, r, navigate) {
  const bas = r.kpis.cashLow || {}
  const quand = bas.month != null ? monthLabel(bas.month, r.startDate) : null
  return h('section', { class: 'sy-hero' },
    h('div', { class: `sy-ink is-${v.tone}` },
      h('div', { class: 'sy-ink-top' },
        h('span', { class: 'sy-kicker is-accent' }, 'Dossier complet · le verdict'),
        h('span', { class: 'sy-live' }, h('i', { 'aria-hidden': 'true' }), 'Live'),
      ),
      h('div', { class: 'sy-ink-word' }, v.word),
      h('h2', { class: 'sy-ink-title is-small' }, v.line),
      h('p', { class: 'sy-ink-text' }, v.body),
    ),
    h('aside', { class: 'sy-next' },
      h('div', { class: 'sy-kicker' }, v.figure ? v.figure.label : 'Trésorerie au plus bas'),
      h('div', { class: 'sy-side-num' }, v.figure ? v.figure.value : euro(n(bas.value), { compact: true })),
      h('div', { class: 'sy-side-when' }, quand ? `Trésorerie au plus bas en ${quand} : ${euro(n(bas.value))}` : ''),
      h('span', { class: 'spacer' }),
      h('button', {
        class: 'sy-btn is-ink',
        onClick: (e) => goToGap({ route: 'financement' }, navigate, e.currentTarget),
      }, 'Voir le plan de financement'),
    ),
  )
}

/* ─────────────────────────────── 2. Le verdict ───────────────────────────── */

/**
 * Le mot, la phrase, et le raisonnement à un geste.
 *
 * C'est la phrase qui résume les actes qui suivent : elle se lit avant eux.
 * Le raisonnement se déplie sur place — l'œil ne quitte pas la ligne.
 */
function verdictLigne(v) {
  const el = h('section', { class: `sy-verdict is-${v.tone} ${etat.raisonnement ? 'is-open' : ''}` })
  const tete = h('button', {
    class: 'sy-verdict-head',
    'aria-expanded': String(etat.raisonnement),
    onClick: () => {
      etat.raisonnement = !etat.raisonnement
      el.classList.toggle('is-open', etat.raisonnement)
      tete.setAttribute('aria-expanded', String(etat.raisonnement))
    },
  },
    h('span', { class: 'sy-verdict-word' }, h('i', { 'aria-hidden': 'true' }), v.word),
    h('span', { class: 'sy-verdict-line' }, titre(v.line)),
    h('span', { class: 'sy-verdict-more' }, h('span', {}, 'Le raisonnement'), h('i', { 'aria-hidden': 'true' })),
  )
  el.append(tete,
    h('div', { class: 'sy-unfold' },
      h('div', {},
        h('div', { class: 'sy-verdict-body' },
          h('p', {}, v.body),
          v.figure ? h('div', { class: 'sy-verdict-fig' },
            h('span', {}, v.figure.label),
            h('strong', {}, v.figure.value)) : null,
        ),
      ),
    ),
  )
  return el
}

/* ─────────────────────────────── 3. Les actes ────────────────────────────── */

/**
 * Un acte : une question, sa réponse en titre, et les lectures qui la fondent.
 *
 * Le numéro en chasse fixe dit où l'on en est du récit ; le titre est déjà la
 * réponse — c'est la différence entre un sommaire et une synthèse. Les
 * lectures se rangent en colonnes séparées par un filet, sans cadre.
 */
function acte(a, i, total, r, s) {
  const cartes = a.cartes.filter(Boolean)
  const leviers = i === total - 1 ? leviersChiffres(s, r) : null
  return h('section', { class: 'sy-act' },
    h('div', { class: 'sy-act-no' }, `${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`),
    h('h2', { class: 'sy-act-title' }, titre(a.titre)),
    h('p', { class: 'sy-act-say' }, titre(a.dit)),
    h('div', { class: `sy-cards is-${Math.min(3, cartes.length)}` },
      ...cartes.map((c, k) => carte(c, k, r))),
    leviers,
  )
}

/**
 * Une lecture : surtitre, titre, explication, image, chiffre.
 *
 * Le texte est celui de la synthèse d'origine, sans une virgule de moins —
 * c'est lui qui fait comprendre. L'image vient après, pour confirmer ce qu'on
 * vient de lire ; le chiffre ferme la lecture, et bat quand il change.
 */
function carte(c, k, r) {
  const frais = c.figure ? changed(`sy-carte-${c.kicker}`, c.figure.value) : false
  return h('article', { class: `sy-card is-${c.tone}`, style: { '--i': String(k) } },
    h('div', { class: 'sy-card-kicker' }, h('i', { 'aria-hidden': 'true' }), c.kicker),
    h('h3', { class: 'sy-card-title' }, titre(c.title)),
    h('p', { class: 'sy-card-body' }, c.body),
    c.bars ? barres(c.bars, c.kicker) : null,
    c.line ? courbe(c.line, r.startDate, { hauteur: 74, legende: 'Ton compte, mois par mois' }) : null,
    c.split ? repartition(c.split, c.kicker) : null,
    c.meter ? jauge(c.meter) : null,
    c.figure ? h('div', { class: 'sy-card-fig' },
      h('span', { class: 'sy-card-fig-label' }, c.figure.label),
      h('span', { class: `sy-card-fig-val ${c.figure.good ? 'is-pos' : 'is-neg'} ${frais ? 'is-fresh' : ''}` }, c.figure.value),
    ) : null,
  )
}

/**
 * Où agir, chiffré par le moteur.
 *
 * Le troisième acte dit quels leviers existent. Le moteur sait aussi ce que
 * chacun rapporte, en rejouant le modèle entier : les trois meilleurs gestes
 * ferment l'acte, avec leur gain. Le détail et l'essai se font dans Pilotage.
 */
function leviersChiffres(s, r) {
  let best = []
  try { best = suggestActions(s, r, { limit: 3 }).best } catch { best = [] }
  if (!best.length) return null
  return h('div', { class: 'sy-levers' },
    h('div', { class: 'sy-kicker' }, 'Chiffré par le moteur — les trois gestes qui rapportent le plus'),
    h('div', { class: 'sy-levers-rows' },
      ...best.map((a, i) => {
        const tresor = -n(a.delta.fundingNeed) > 0
        const gain = tresor ? -n(a.delta.fundingNeed) : n(a.delta.ebitda)
        return h('div', { class: 'sy-lever', style: { '--i': String(i) } },
          h('span', { class: 'sy-lever-no' }, String(i + 1)),
          h('span', { class: 'sy-lever-txt' },
            h('span', { class: 'sy-lever-label' }, a.label),
            a.detail ? h('span', { class: 'sy-lever-detail' }, a.detail) : null,
          ),
          h('span', { class: 'sy-lever-gain' },
            h('b', {}, `${gain >= 0 ? '+' : ''}${euro(gain)}`),
            h('span', {}, tresor ? 'de trésorerie' : 'd’EBITDA'),
          ),
        )
      }),
    ),
  )
}

/** La phrase qui clôt le récit, et la suite. */
function pied(navigate, pilotage) {
  const reste = lignesRestantes()
  return h('div', { class: 'sy-foot' },
    h('p', {}, RELIRE),
    h('div', { class: 'sy-foot-go' },
      h('button', { class: 'sy-btn is-accent is-sm', onClick: pilotage }, reste > 0
        ? `Affiner : ${reste} ligne${reste > 1 ? 's' : ''} à poser`
        : 'Ce qu’il me reste à poser'),
      h('button', {
        class: 'sy-btn is-line is-sm',
        onClick: () => goToGap({ route: 'resultats' }, navigate),
      }, 'Voir les états financiers'),
    ),
  )
}

/* ─────────────────────────── 4. Les six chiffres ─────────────────────────── */

/**
 * Les six chiffres qu'on te demandera — et ce qu'ils veulent dire.
 *
 * Même logique que la synthèse : un clic déplie la définition, l'usage et le
 * piège à connaître, puis un bouton dit où le chiffre se corrige. L'exercice
 * se choisit ici ; l'analyse détaillée, plus bas, lit le même.
 */
function sixChiffres(r, s, y, choisir, navigate) {
  const figures = figureSet(r, s, y)
  return h('section', { class: 'sy-figs' },
    h('div', { class: 'sy-sec-head' },
      h('div', {},
        h('h2', { class: 'sy-sec-title' }, 'Les six chiffres qu’on te demandera'),
        h('p', { class: 'sy-sec-say' }, 'Clique sur l’un d’eux : il dit ce qu’il signifie avant d’emmener là où il se corrige.'),
      ),
      anneeChips(y, choisir),
    ),
    // Trois piles plutôt qu'une grille : une définition dépliée n'allonge que
    // sa colonne. Dans une grille, elle étirait toute la rangée et laissait
    // deux grands vides à côté d'elle.
    h('div', { class: 'sy-figs-grid' },
      ...[0, 1, 2].map((col) => h('div', { class: 'sy-figs-col' },
        ...figures.map((f, i) => (i % 3 === col ? chiffre(f, i, navigate) : null)))),
    ),
  )
}

/** Cinq pastilles, une par exercice. */
function anneeChips(y, choisir) {
  return h('div', { class: 'sy-years', role: 'tablist', 'aria-label': 'Exercice' },
    ...Array.from({ length: 5 }, (_, k) => h('button', {
      class: `sy-year ${k === y ? 'is-on' : ''}`,
      role: 'tab',
      'aria-selected': String(k === y),
      onClick: () => choisir(k),
    }, `A${k + 1}`)),
  )
}

function chiffre(f, i, navigate) {
  const g = lookup(f.help)
  // Seul un chiffre qui a réellement bougé bat : changer d'année sans que le
  // point mort change ne doit pas faire clignoter le point mort.
  const frais = changed(`sy-fig-${f.help}`, f.value)
  const ouvert = etat.chiffres.has(f.help)
  const el = h('div', { class: `sy-fig is-${f.tone || 'none'} ${ouvert ? 'is-open' : ''}`, style: { '--i': String(i), order: String(i) } })
  const tete = h('button', {
    class: 'sy-fig-head',
    'aria-expanded': String(ouvert),
    onClick: () => {
      const on = !etat.chiffres.has(f.help)
      on ? etat.chiffres.add(f.help) : etat.chiffres.delete(f.help)
      el.classList.toggle('is-open', on)
      tete.setAttribute('aria-expanded', String(on))
    },
  },
    h('span', { class: 'sy-fig-label' }, f.label),
    h('span', { class: `sy-fig-val ${frais ? 'is-fresh' : ''}` }, f.value),
    h('span', { class: 'sy-fig-note' }, f.note),
    f.spark && f.spark.some((v) => v) ? etincelle(f.spark, TON[f.tone === 'pos' ? 'good' : f.tone === 'neg' ? 'bad' : 'watch']) : null,
    h('i', { class: 'sy-fig-chev', 'aria-hidden': 'true' }),
  )
  el.append(tete,
    h('div', { class: 'sy-unfold' },
      h('div', {},
        h('div', { class: 'sy-fig-body' },
          g ? h('p', { class: 'sy-fig-what' }, g.what) : null,
          g && g.use ? h('p', { class: 'sy-fig-use' }, g.use) : null,
          g && g.watch ? h('p', { class: 'sy-fig-watch' }, h('b', {}, 'À surveiller — '), g.watch) : null,
          h('button', {
            class: 'sy-link',
            onClick: () => goToGap({ route: f.go }, navigate),
          }, `Aller voir — ${PAGE_NAME[f.go] || f.go} →`),
        ),
      ),
    ),
  )
  return el
}

/* ─────────────────────────── 5. L'analyse détaillée ──────────────────────── */

/**
 * Tout le détail, replié tant qu'on ne le demande pas.
 *
 * Qui demande le détail le demande en entier : une fois ouverte, l'analyse ne
 * cache plus rien. Tant qu'elle est fermée, elle n'est même pas construite —
 * le tableau de bord se redessine à chaque saisie, et six graphiques qu'on ne
 * regarde pas n'ont pas à être recalculés. À l'ouverture, ses images se
 * tracent devant le lecteur.
 */
function analyse(r, s, y, choisir, navigate, refresh) {
  const neuve = etat.analyseNeuve
  etat.analyseNeuve = false
  return h('section', { class: `sy-deep ${etat.analyse ? 'is-open' : ''} ${neuve ? 'is-opening' : ''}` },
    h('button', {
      class: 'sy-deep-head',
      'aria-expanded': String(etat.analyse),
      onClick: () => {
        etat.analyse = !etat.analyse
        etat.analyseNeuve = etat.analyse
        refresh()
      },
    },
      h('span', {},
        h('span', { class: 'sy-sec-title' }, 'Analyse détaillée'),
        h('span', { class: 'sy-sec-say' }, 'Les cinq exercices, la cascade du résultat, les courbes — tout, d’un coup.'),
      ),
      h('i', { class: 'sy-fig-chev', 'aria-hidden': 'true' }),
    ),
    etat.analyse ? h('div', { class: 'sy-deep-body' },
      exercices(r, y, choisir),
      equation(r, y),
      h('div', { class: 'sy-pair' }, cinqAns(r, y, choisir), cascade(r, y)),
      tresorerie(r),
      h('div', { class: 'sy-pair' }, structure(r, y), offres(r)),
      ratios(r, y),
      h('div', { class: 'sy-deep-go' },
        h('button', { class: 'sy-btn is-line is-sm', onClick: () => goToGap({ route: 'resultats' }, navigate) }, 'Les états financiers'),
        h('button', { class: 'sy-btn is-line is-sm', onClick: () => navigate('#/presentation') }, 'La présentation en plein écran'),
      ),
    ) : null,
  )
}

/** Les cinq exercices, chacun avec son chiffre d'affaires et son résultat net. */
function exercices(r, y, choisir) {
  return h('div', { class: 'sy-ex' },
    ...Array.from({ length: 5 }, (_, i) => {
      const net = n(r.pnl.netResult[i])
      return h('button', { class: `sy-ex-year ${i === y ? 'is-on' : ''}`, onClick: () => choisir(i) },
        h('span', { class: 'sy-ex-no' }, `Année ${i + 1}`),
        h('span', { class: 'sy-ex-ca' }, euro(n(r.pnl.revenue[i]), { compact: true })),
        h('span', { class: `sy-ex-net ${net >= 0 ? 'is-pos' : 'is-neg'}` },
          `${net >= 0 ? '+' : '−'}${euro(Math.abs(net), { compact: true })} net`),
      )
    }),
  )
}

/**
 * Du chiffre d'affaires au résultat, en une soustraction.
 *
 * Ce qui entre, ce qui sort, ce qui reste : l'opération se comprend sans mode
 * d'emploi. Le détail des lignes intermédiaires vient juste en dessous.
 */
function equation(r, y) {
  const rev = n(r.pnl.revenue[y])
  const net = n(r.pnl.netResult[y])
  const couts = rev - net
  return h('div', { class: 'sy-eq' },
    h('div', { class: 'sy-eq-term' },
      h('span', { class: 'sy-eq-tag' }, 'Ce que tu encaisses'),
      h('span', { class: 'sy-eq-val' }, euro(rev, { compact: true })),
      h('span', { class: 'sy-eq-note' }, 'Chiffre d’affaires de l’exercice'),
    ),
    h('span', { class: 'sy-eq-op' }, '−'),
    h('div', { class: 'sy-eq-term' },
      h('span', { class: 'sy-eq-tag' }, 'Ce que ça coûte'),
      h('span', { class: 'sy-eq-val' }, euro(couts, { compact: true })),
      h('span', { class: 'sy-eq-note' }, 'Achats, salaires, charges, impôts, amortissements'),
    ),
    h('span', { class: 'sy-eq-op' }, '='),
    h('div', { class: `sy-eq-term is-result ${net >= 0 ? '' : 'is-loss'}` },
      h('span', { class: 'sy-eq-tag' }, net >= 0 ? 'Ce qu’il reste' : 'Ce que tu perds'),
      h('span', { class: 'sy-eq-val' }, euro(net, { compact: true })),
      h('span', { class: 'sy-eq-note' }, `${pct(rev > 0 ? net / rev : 0, 0)} du chiffre d’affaires`),
    ),
  )
}

/**
 * Cinq exercices, trois séries, une ligne de zéro, un repère de point mort.
 *
 * Une perte descend, elle ne disparaît pas. Survoler une colonne donne le
 * compte de résultat entier de l'année — c'est là que se lit le détail de
 * l'EBITDA ; cliquer choisit l'exercice lu partout ailleurs.
 */
function cinqAns(r, y, choisir) {
  const p = r.pnl
  const k = r.kpis
  const series = [
    { cle: 'ca', nom: 'Chiffre d’affaires', vals: p.revenue },
    { cle: 'ebitda', nom: 'EBITDA', vals: p.ebitda },
    { cle: 'net', nom: 'Résultat net', vals: p.netResult },
  ]
  const seuils = (k.breakEven || []).map((v) => n(v))
  const toutes = [...series.flatMap((x) => x.vals.map(n)), ...seuils]
  const haut = Math.max(0, ...toutes)
  const bas = Math.min(0, ...toutes)
  if (haut === 0 && bas === 0) return null
  const span = haut - bas || 1
  const zero = haut / span

  return h('div', { class: 'sy-block' },
    h('div', { class: 'sy-block-head' },
      h('h3', { class: 'sy-block-title' }, 'Chiffre d’affaires et résultat'),
      h('div', { class: 'sy-keys' },
        ...series.map((x) => h('span', { class: `sy-key is-${x.cle}` }, h('i', {}), x.nom)),
        seuils.some((v) => v) ? h('span', { class: 'sy-key is-seuil' }, h('i', {}), 'Point mort') : null,
      ),
    ),
    h('div', { class: 'sy-perf', style: { '--zero': String(zero) } },
      h('i', { class: 'sy-perf-zero', 'aria-hidden': 'true' }),
      ...Array.from({ length: 5 }, (_, a) => {
        const col = h('div', {
          class: `sy-perf-col ${a === y ? 'is-on' : ''}`,
          role: 'button', tabindex: '0', 'aria-label': `Année ${a + 1}`,
          onClick: () => choisir(a),
          onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choisir(a) } },
        },
          h('div', { class: 'sy-perf-bars' },
            ...series.map((x, si) => {
              const v = n(x.vals[a])
              const t = (Math.abs(v) / span) * 100
              const pose = v >= 0
                ? { bottom: `${((0 - bas) / span) * 100}%`, height: `${t}%` }
                : { top: `${zero * 100}%`, height: `${t}%` }
              return h('span', { class: 'sy-perf-slot' },
                h('i', { class: `sy-perf-bar is-${x.cle} ${v < 0 ? 'is-down' : ''}`, style: { ...pose, '--i': String(a * 3 + si) } }))
            }),
            seuils[a] > 0
              ? h('i', { class: 'sy-perf-seuil', style: { bottom: `${((seuils[a] - bas) / span) * 100}%` }, 'aria-hidden': 'true' })
              : null,
          ),
          h('span', { class: 'sy-perf-year' }, `A${a + 1}`),
        )
        return hot(col, `Année ${a + 1}`, () => compteAnnee(r, a))
      }),
    ),
    h('p', { class: 'sy-note' }, revenueSentence(r)),
  )
}

/**
 * Le compte de résultat d'une année, dans l'ordre du plan comptable.
 *
 * Le libellé porte le signe de l'opération ; le montant ne le répète pas,
 * sinon « − Achats -71 647 € » se lirait comme une double négation.
 */
function compteAnnee(r, y) {
  const p = r.pnl
  const signe = (label) => label[0] === '−' || label[0] === '+'
  const l = (label, v, strong = false) => ({ label, strong, value: euro(signe(label) ? Math.abs(n(v)) : n(v)) })
  return [
    l('Chiffre d’affaires', p.revenue[y], true),
    l('− Achats', p.variableCost[y]),
    l('= Marge brute', p.grossMargin[y], true),
    l('− Charges externes', p.external[y]),
    n(p.duties[y]) ? l('− Impôts et taxes', p.duties[y]) : null,
    n(p.grants[y]) ? l('+ Subventions', p.grants[y]) : null,
    l('− Salaires et cotisations', p.payroll[y]),
    l('= EBITDA', p.ebitda[y], true),
    n(p.amortisation[y]) ? l('− Amortissements', p.amortisation[y]) : null,
    l('= Résultat d’exploitation', p.ebit[y], true),
    n(p.interest[y]) ? l('− Intérêts', p.interest[y]) : null,
    n(p.corporateTax[y]) ? l('− Impôt sur les sociétés', p.corporateTax[y]) : null,
    n(p.credits[y]) ? l('+ Crédits d’impôt', p.credits[y]) : null,
    n(p.jeiSaving[y]) ? l('+ Économie JEI', p.jeiSaving[y]) : null,
    l('= Résultat net', p.netResult[y], true),
  ].filter(Boolean)
}

/**
 * Du chiffre d'affaires au résultat net, marche par marche.
 *
 * Chaque marche a la longueur de sa part du chiffre d'affaires : la plus
 * longue est le poste à traiter en premier. La phrase dessous le nomme.
 */
function cascade(r, y) {
  const p = r.pnl
  const ca = n(p.revenue[y])
  const tete = h('div', { class: 'sy-block-head' },
    h('h3', { class: 'sy-block-title' }, 'Du chiffre d’affaires au résultat net'),
    h('span', { class: 'sy-block-meta' }, `Soldes intermédiaires — année ${y + 1}`),
  )
  if (ca <= 0) return h('div', { class: 'sy-block' }, tete, h('p', { class: 'sy-note' }, moneyFlowSentence(r, y)))

  const marches = [
    { nom: 'Chiffre d’affaires', v: ca, solde: true },
    { nom: 'Subventions', v: n(p.grants[y]) },
    { nom: 'Achats', v: -Math.abs(n(p.variableCost[y])) },
    { nom: 'Charges externes', v: -Math.abs(n(p.external[y])) },
    { nom: 'Impôts et taxes', v: -Math.abs(n(p.duties[y])) },
    { nom: 'Personnel', v: -Math.abs(n(p.payroll[y])) },
    { nom: 'EBITDA', v: n(p.ebitda[y]), solde: true },
    { nom: 'Amortissements', v: -Math.abs(n(p.amortisation[y])) },
    { nom: 'Frais financiers', v: -Math.abs(n(p.interest[y])) },
    { nom: 'Impôt sur les sociétés', v: -Math.abs(n(p.corporateTax[y])) },
    { nom: 'Crédits d’impôt', v: n(p.credits[y]) },
    { nom: 'Résultat net', v: n(p.netResult[y]), solde: true },
  ].filter((m) => m.solde || Math.abs(m.v) > 0.5)

  return h('div', { class: 'sy-block' },
    tete,
    h('div', { class: 'sy-ladder' },
      ...marches.map((m, i) => {
        const montant = m.solde ? m.v : Math.abs(m.v)
        return hot(h('div', {
          class: `sy-rung ${m.solde ? 'is-solde' : ''} ${m.v < 0 ? 'is-out' : ''} ${i === marches.length - 1 ? 'is-last' : ''}`,
        },
          h('span', { class: 'sy-rung-nom' }, m.nom),
          h('span', { class: 'sy-rung-bar' },
            h('i', { style: { width: `${Math.min(1, Math.abs(m.v) / ca) * 100}%`, '--i': String(i) } })),
          h('span', { class: 'sy-rung-val' }, euro(montant, { compact: true })),
        ), m.nom, () => [
          { label: 'Montant', value: euro(montant), strong: true },
          { label: 'Pour 100 € facturés', value: `${num((montant / ca) * 100, 1)} €` },
        ])
      }),
    ),
    h('p', { class: 'sy-note' }, moneyFlowSentence(r, y)),
  )
}

/**
 * Le compte en banque sur cinq ans, et ce qui le fait bouger.
 *
 * La courbe se trace à l'ouverture ; un repère suit le curseur et donne le
 * mois et le solde. Deux phrases dessous : ce que dit la trésorerie, et ce que
 * le cycle d'exploitation immobilise.
 */
function tresorerie(r) {
  const vals = (r.cash?.balance || []).map(n)
  const runway = r.kpis.runwayMonths
  return h('div', { class: 'sy-block' },
    h('div', { class: 'sy-block-head' },
      h('h3', { class: 'sy-block-title' }, 'Trésorerie'),
      h('span', { class: 'sy-block-meta' },
        Number.isFinite(runway) && runway !== null ? `${num(runway, 0)} mois au rythme de consommation actuel` : 'La caisse ne se vide pas'),
    ),
    courbe(vals, r.startDate, { hauteur: 190, mois: true }),
    h('p', { class: 'sy-note' }, cashSentence(r)),
    h('p', { class: 'sy-note' }, bfrSentence(r)),
  )
}

/** Ce que coûte l'entreprise, poste par poste, exercice par exercice. */
function structure(r, y) {
  const p = r.pnl
  const postes = [
    { nom: 'Achats', vals: p.variableCost, cle: 'a' },
    { nom: 'Charges externes', vals: p.external, cle: 'b' },
    { nom: 'Personnel', vals: p.payroll, cle: 'c' },
    { nom: 'Impôts et taxes', vals: p.duties, cle: 'd' },
    { nom: 'Amortissements', vals: p.amortisation, cle: 'e' },
  ].filter((x) => x.vals.some((v) => Math.abs(n(v)) > 0))
  const totaux = Array.from({ length: 5 }, (_, a) => postes.reduce((t, x) => t + Math.abs(n(x.vals[a])), 0))
  const max = Math.max(1, ...totaux)
  if (!postes.length) return null

  return h('div', { class: 'sy-block' },
    h('div', { class: 'sy-block-head' },
      h('h3', { class: 'sy-block-title' }, 'Structure des charges'),
      h('span', { class: 'sy-block-meta' }, 'Par exercice'),
    ),
    h('div', { class: 'sy-stack' },
      ...Array.from({ length: 5 }, (_, a) => hot(h('div', { class: `sy-stack-col ${a === y ? 'is-on' : ''}` },
        h('div', { class: 'sy-stack-bar', style: { height: `${(totaux[a] / max) * 100}%`, '--i': String(a) } },
          ...postes.map((x) => h('i', {
            class: `is-${x.cle}`,
            style: { flexGrow: String(Math.abs(n(x.vals[a])) / Math.max(1, totaux[a])) },
          })),
        ),
        h('span', { class: 'sy-perf-year' }, `A${a + 1}`),
      ), `Charges — année ${a + 1}`, () => [
        ...postes.map((x) => ({ label: x.nom, value: euro(Math.abs(n(x.vals[a]))) })),
        { label: 'Total', value: euro(totaux[a]), strong: true },
      ])),
    ),
    h('div', { class: 'sy-keys is-below' },
      ...postes.map((x) => h('span', { class: `sy-key is-st-${x.cle}` }, h('i', {}), x.nom))),
    h('p', { class: 'sy-note' }, costsSentence(r, y)),
  )
}

/**
 * D'où vient le chiffre d'affaires.
 *
 * Une seule offre ne se répartit pas : le bloc ne s'affiche qu'à partir de
 * deux sources de revenus, comme dans l'analyse d'origine.
 */
function offres(r) {
  const items = (r.revenue?.perActivity || [])
    .map((a) => ({ label: a.name || 'Offre', value: somme(a.total) }))
    .filter((a) => a.value > 0)
    .sort((a, b) => b.value - a.value)
  if (items.length < 2) return null
  const tot = items.reduce((t, x) => t + x.value, 0)
  return h('div', { class: 'sy-block' },
    h('div', { class: 'sy-block-head' },
      h('h3', { class: 'sy-block-title' }, 'Répartition du chiffre d’affaires'),
      h('span', { class: 'sy-block-meta' }, 'Cumul sur cinq ans'),
    ),
    h('div', { class: 'sy-ladder' },
      ...items.slice(0, 8).map((o, i) => hot(h('div', { class: `sy-rung ${i === 0 ? 'is-lead' : ''}` },
        h('span', { class: 'sy-rung-nom' }, o.label),
        h('span', { class: 'sy-rung-bar' }, h('i', { style: { width: `${(o.value / tot) * 100}%`, '--i': String(i) } })),
        h('span', { class: 'sy-rung-val' }, `${Math.round((o.value / tot) * 100)} %`),
      ), o.label, () => [
        { label: 'Sur cinq ans', value: euro(o.value), strong: true },
        { label: 'Part du total', value: pct(o.value / tot) },
      ])),
    ),
    h('p', { class: 'sy-note' }, mixSentence(items)),
  )
}

/** Les ratios qu'un financeur calcule lui-même si on ne les lui donne pas. */
function ratios(r, y) {
  const k = r.kpis
  const ca = n(r.pnl.revenue[y])
  const rien = '—'
  const lignes = [
    { nom: 'Marge brute', v: ca > 0 ? pct(n(k.marginRate[y])) : rien, dit: 'Ce qui reste après les achats' },
    { nom: 'Marge d’EBITDA', v: ca > 0 ? pct(n(k.ebitdaMargin[y])) : rien, dit: 'Ce que dégage l’exploitation' },
    { nom: 'Marge nette', v: ca > 0 ? pct(n(k.netMargin[y])) : rien, dit: 'Ce qui reste, tout payé' },
    { nom: 'Masse salariale', v: ca > 0 ? pct(n(k.payrollRatio[y])) : rien, dit: 'Part du CA versée en salaires' },
    { nom: 'Point mort', v: k.breakEven[y] ? euro(n(k.breakEven[y]), { compact: true }) : rien, dit: 'CA qui couvre les charges' },
    { nom: 'BFR au plus haut', v: euro(n(k.peakBfr), { compact: true }), dit: 'L’argent immobilisé par le cycle' },
    { nom: 'Coût d’acquisition', v: k.cac ? euro(n(k.cac)) : rien, dit: k.cac ? 'Marketing dépensé par client gagné' : 'Aucune campagne chiffrée' },
    {
      nom: 'LTV / CAC',
      v: k.ltvCacRatio ? `× ${num(n(k.ltvCacRatio), 1)}` : rien,
      dit: k.ltvCacRatio ? (n(k.ltvCacRatio) >= 3 ? 'Au-dessus du seuil de 3 attendu' : 'Sous le seuil de 3 attendu') : 'Demande une campagne et un panier',
    },
  ]
  return h('div', { class: 'sy-block' },
    h('div', { class: 'sy-block-head' },
      h('h3', { class: 'sy-block-title' }, 'Les ratios'),
      h('span', { class: 'sy-block-meta' }, `Année ${y + 1}`),
    ),
    h('div', { class: 'sy-ratios' },
      ...lignes.map((l, i) => h('div', { class: 'sy-ratio', style: { '--i': String(i) } },
        h('span', { class: 'sy-ratio-nom' }, l.nom),
        h('span', { class: 'sy-ratio-val' }, l.v),
        h('span', { class: 'sy-ratio-dit' }, l.dit),
      )),
    ),
  )
}

/* ───────────────────────────── Les petites images ────────────────────────── */

/**
 * Cinq barres de part et d'autre d'un zéro.
 *
 * La barre dit le sens — ça monte, ça part du rouge, ça passe au positif
 * telle année ; le survol donne le montant exact.
 */
function barres(items, nom) {
  const haut = Math.max(0, ...items.map((i) => n(i.value)))
  const bas = Math.min(0, ...items.map((i) => n(i.value)))
  const span = haut - bas || 1
  // La ligne de zéro tombe là où le zéro se trouve vraiment : une perte de
  // 12 000 € face à un bénéfice de 800 000 € ne mérite pas la moitié du dessin.
  // Une échelle, une seule, pour les deux sens.
  const zero = haut / span
  return h('div', { class: 'sy-mini', style: { '--zero': String(zero) } },
    h('i', { class: 'sy-mini-zero', 'aria-hidden': 'true' }),
    ...items.map((it, k) => {
      const v = n(it.value)
      const part = (Math.abs(v) / span) * 100
      const pose = v >= 0
        ? { bottom: `${(1 - zero) * 100}%`, height: `${part}%` }
        : { top: `${zero * 100}%`, height: `${part}%` }
      return hot(h('div', { class: 'sy-mini-col' },
        h('div', { class: 'sy-mini-track' },
          h('i', { class: v < 0 ? 'is-neg' : 'is-pos', style: { ...pose, '--i': String(k) } })),
        h('span', { class: 'sy-mini-label' }, it.label),
      ), nom, () => [{ label: it.label, value: euro(v), strong: true }])
    }),
  )
}

/** Où part chaque euro : une barre, des parts, une légende en chasse fixe. */
function repartition(parts, nom) {
  const garde = parts.filter((p) => n(p.value) > 0)
  const total = garde.reduce((a, p) => a + n(p.value), 0) || 100
  return h('div', { class: 'sy-split' },
    hot(h('div', { class: 'sy-split-bar' },
      ...garde.map((p) => h('i', { class: `is-${p.tone}`, style: { flexGrow: String(n(p.value) / total) } }))),
      nom, () => garde.map((p) => ({ label: p.label, value: String(p.value), strong: p.tone === 'left' }))),
    h('div', { class: 'sy-split-keys' },
      ...garde.map((p) => h('span', { class: `sy-split-key is-${p.tone}` },
        h('i', { 'aria-hidden': 'true' }), p.label, h('b', {}, String(p.value))))),
  )
}

/** Une jauge : la part d'un seuil atteinte, et le repère du seuil. */
function jauge({ part, label }) {
  const echelle = Math.max(1, n(part))
  return h('div', { class: 'sy-gauge' },
    h('div', { class: 'sy-gauge-track' },
      h('i', {
        class: n(part) >= 1 ? 'is-ok' : '',
        style: { width: `${Math.min(100, Math.max(2, (n(part) / echelle) * 100))}%` },
      }),
      h('span', { class: 'sy-gauge-mark', style: { left: `${(1 / echelle) * 100}%` }, 'aria-hidden': 'true' }),
    ),
    h('span', { class: 'sy-gauge-label' }, label),
  )
}

/** Une étincelle : la forme d'une série, sans axe, dans la couleur du verdict. */
function etincelle(values, couleur) {
  const vals = values.map(n)
  const max = Math.max(...vals), min = Math.min(...vals)
  const span = max - min || 1
  const W = 64, H = 22
  const pts = vals.map((v, i) => `${((i / Math.max(1, vals.length - 1)) * W).toFixed(1)},${(H - 2 - ((v - min) / span) * (H - 4)).toFixed(1)}`).join(' ')
  return h('span', {
    class: 'sy-spark',
    'aria-hidden': 'true',
    html: `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><polyline pathLength="1" points="${pts}" fill="none" stroke="${couleur}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  })
}

/**
 * Une courbe de trésorerie qu'on peut interroger.
 *
 * Lissée sans inventer de relief, posée sur une ligne de zéro pointillée ; un
 * repère suit le curseur, au mois près, et l'infobulle dit le solde.
 */
let courbes = 0
function courbe(values, startDate, { hauteur = 80, legende = null, mois = false } = {}) {
  const vals = values.map(n)
  if (vals.length < 2) return null
  const id = `syg${++courbes}`
  const max = Math.max(...vals, 0), min = Math.min(...vals, 0)
  const span = max - min || 1
  const W = 1000, H = hauteur
  const x = (i) => (i / (vals.length - 1)) * W
  const yv = (v) => H - 2 - ((v - min) / span) * (H - 4)
  let d = `M ${x(0)} ${yv(vals[0])}`
  for (let i = 1; i < vals.length; i++) {
    const xm = (x(i - 1) + x(i)) / 2
    d += ` C ${xm} ${yv(vals[i - 1])}, ${xm} ${yv(vals[i])}, ${x(i)} ${yv(vals[i])}`
  }
  const z = yv(0)
  const negatif = vals.some((v) => v < 0)

  const boite = h('div', {
    class: 'sy-curve-svg',
    style: { height: `${hauteur}px` },
    html: `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="rgba(14,15,12,.14)"/><stop offset="100%" stop-color="rgba(14,15,12,0)"/>
  </linearGradient></defs>
  <line x1="0" y1="${z}" x2="${W}" y2="${z}" class="sy-curve-zero"/>
  <path class="sy-curve-fill" d="${d} L ${W} ${H} L 0 ${H} Z" fill="url(#${id})"/>
  <path class="sy-curve-line ${negatif ? 'has-neg' : ''}" pathLength="1" d="${d}"/>
</svg>`,
  })

  const regle = h('i', { class: 'sy-curve-rule', 'aria-hidden': 'true' })
  const point = h('i', { class: 'sy-curve-dot', 'aria-hidden': 'true' })
  let m = 0
  const zone = h('div', { class: 'sy-curve-hit' }, regle, point)
  zone.addEventListener('mousemove', (e) => {
    const b = zone.getBoundingClientRect()
    if (!b.width) return
    m = Math.round(Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)) * (vals.length - 1))
    const px = (m / (vals.length - 1)) * b.width
    const py = (yv(vals[m]) / H) * b.height
    regle.style.transform = `translateX(${px}px)`
    point.style.transform = `translate(${px}px, ${py}px)`
    point.classList.toggle('is-neg', vals[m] < 0)
    zone.classList.add('is-on')
  })
  zone.addEventListener('mouseleave', () => zone.classList.remove('is-on'))
  hot(zone, 'Trésorerie', () => [
    { label: monthLabel(m, startDate), value: euro(vals[m]), strong: true },
    { label: vals[m] < 0 ? 'Sous zéro' : 'Au-dessus de zéro', value: vals[m] < 0 ? 'à financer' : 'couvert' },
  ])

  const reperes = mois
    ? [0, 12, 24, 36, 48, 59].filter((k) => k < vals.length)
    : [0, Math.floor((vals.length - 1) / 2), vals.length - 1]

  return h('div', { class: 'sy-curve' },
    h('div', { class: 'sy-curve-wrap' }, boite, zone),
    h('div', { class: 'sy-curve-axis' },
      ...reperes.map((k) => h('span', {}, monthLabel(k, startDate)))),
    legende ? h('span', { class: 'sy-curve-legend' }, legende) : null,
  )
}

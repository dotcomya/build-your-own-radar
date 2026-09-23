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
import { checklist, parAxe, destination } from '../checklist.js'
import { goToGap } from '../spotlight.js'
import { lookup } from '../glossary.js'
import { changed } from '../motion.js'
import { synthese, RELIRE, lignesRestantes } from '../plain.js'
import { gardeBloc } from '../garde.js'
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

/**
 * Les images se tracent quand on arrive dessus, pas avant.
 *
 * Elles se jouaient toutes à l'ouverture de l'écran, y compris celles qu'on ne
 * voyait pas : quand on descendait jusqu'à elles, elles étaient déjà posées,
 * immobiles. Chaque bloc est maintenant guetté ; il se trace la première fois
 * qu'il entre dans la fenêtre, puis reste tel quel — un recalcul ne le
 * rejoue pas, une nouvelle visite de l'écran, si.
 */
const vus = new Set()
let guetteur = null
const reduit = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }

function guet(el, cle, { visuel = false, min = 0.14 } = {}) {
  if (!el) return el
  el.classList.add(visuel ? 'sy-vis' : 'sy-watch')
  if (vus.has(cle) || reduit() || typeof IntersectionObserver !== 'function') {
    el.classList.add('is-seen')
    return el
  }
  if (!guetteur) {
    guetteur = new IntersectionObserver((entrees) => {
      for (const e of entrees) {
        if (!e.isIntersecting) continue
        // Une image ne se joue que lorsqu'on la voit presque entière : c'est
        // elle qu'on regarde pousser, pas le haut de la partie qui la porte.
        // Un bloc plus haut que la fenêtre n'atteint jamais une grande
        // proportion visible : on le déclenche aussi sur une hauteur absolue.
        const t = e.target
        const m = Number(t.dataset.min) || 0.14
        const assez = Math.max(220, window.innerHeight * 0.45)
        if (e.intersectionRatio < m && e.intersectionRect.height < assez) continue
        vus.add(t.dataset.guet)
        t.classList.add('is-seen', 'is-play')
        guetteur.unobserve(t)
      }
    }, { threshold: [0, 0.14, 0.3, 0.5, 0.65, 0.8, 1], rootMargin: '0px 0px -6% 0px' })
  }
  el.dataset.guet = cle
  el.dataset.min = String(min)
  guetteur.observe(el)
  return el
}

/** Une image — barres, courbe, jauge — guettée pour elle-même. */
const vis = (el, cle) => guet(el, cle, { visuel: true, min: 0.65 })

export function renderStudio(navigate, refresh, goView) {
  const s = store.scenario
  const r = store.result
  if (!r) return h('div', { class: 'content' }, h('p', {}, 'Aucun résultat.'))

  const entree = !(racine && racine.isConnected)
  // Chaque arrivée sur l'écran rejoue les images au fil du défilement ; un
  // simple recalcul, non. Le guetteur précédent observait des nœuds que ce
  // rendu va remplacer : on le relâche.
  if (entree) vus.clear()
  if (guetteur) guetteur.disconnect()

  const y = etat.annee !== null && etat.annee >= 0 && etat.annee < 5 ? etat.annee : referenceYear(r)
  const choisir = (k) => { etat.annee = k; refresh() }
  const pilotage = () => (goView ? goView('pilotage') : navigate('#/tableau-de-bord'))

  const { actes, sansCA } = synthese(s, r)

  racine = h('div', { class: `sy ${entree ? 'is-enter' : ''}` },
    // Ce qui manque se dit avant ce qu'on a trouvé — tant qu'il manque
    // quelque chose. Un dossier complet ouvre directement sur son verdict.
    ...teteDossier(navigate, pilotage),
    ...actes.map((a, i) => acte(a, i, actes.length, r, s, sansCA, navigate)),
    pied(navigate, pilotage),
    guet(sixChiffres(r, s, y, choisir, navigate), 'chiffres'),
    analyse(r, s, y, choisir, navigate, refresh),
  )
  return racine
}

/**
 * La tête du dossier : l'avancement (ou le verdict, quand tout est posé), la
 * ligne de verdict, et ce qui est fait et reste à faire, page par page.
 *
 * Le pitch investisseur l'affiche à l'identique : les deux onglets se
 * comparent d'un coup d'œil, et avancer le dossier fait avancer les deux.
 * `prefixe` sépare leurs animations — on ne veut pas qu'un bloc déjà vu dans
 * l'essai arrive figé dans le pitch.
 */
export function teteDossier(navigate, pilotage, prefixe = '') {
  const s = store.scenario
  const r = store.result
  let c = null
  try { c = checklist(s) } catch { c = null }
  const v = verdict(r, s)
  const complet = !c || !c.open || !c.next
  return [
    guet(complet ? heroVerdict(v, r, navigate) : heroAvancement(c, navigate, pilotage), `${prefixe}hero`),
    complet ? null : guet(verdictLigne(v), `${prefixe}verdict`),
    complet ? null : guet(dossierParAxe(c, navigate), `${prefixe}dossier`),
  ]
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
  const axes = parAxe(c)
  const suivante = c.next

  return h('section', { class: 'sy-hero' },
    h('div', { class: 'sy-ink' },
      h('div', { class: 'sy-ink-top' },
        h('span', { class: 'sy-kicker is-accent' }, t.surtitre),
        h('span', { class: 'sy-live' }, h('i', { 'aria-hidden': 'true' }), 'Live'),
      ),
      h('h2', { class: 'sy-ink-title' }, t.titre),
      h('p', { class: 'sy-ink-text' }, t.texte),

      // Une case par ligne du dossier, rangée par page : on voit d'un coup
      // d'œil que l'offre est presque finie et que le financement attend.
      // Chaque case se survole — ce qu'elle est, fait ou non, et la page où
      // elle se remplit — et se clique : on y va.
      h('div', { class: 'sy-cells', role: 'list', 'aria-label': `${c.done} lignes posées sur ${c.total}` },
        ...axes.map((ax) => h('div', { class: 'sy-cells-axe', style: { flexGrow: String(ax.lignes.length) } },
          h('div', { class: 'sy-cells-row' },
            ...ax.lignes.map((i, k) => hot(h('button', {
              class: `sy-cell ${i.done ? 'is-done' : i === suivante ? 'is-next' : ''}`,
              style: { '--i': String(k) },
              role: 'listitem',
              'aria-label': `${i.label} — ${i.done ? 'fait' : 'à faire'} — ${destination(i)}`,
              onClick: (e) => (i.go ? goToGap(i.go, navigate, e.currentTarget) : null),
            }, h('i', { 'aria-hidden': 'true' })), i.label, () => [
              { label: i.done ? '✓ Fait' : (i === suivante ? '→ Prochaine étape' : '○ À faire'), value: '', strong: true },
              { label: `Clique pour aller à : ${destination(i)}`, value: '' },
              i.why ? { label: i.why, value: '' } : null,
            ])),
          ),
          h('span', { class: 'sy-cells-cap' }, h('b', {}, `${ax.posees}/${ax.lignes.length}`), ` ${ax.court || ax.label}`),
        )),
      ),

      h('div', { class: 'sy-ink-acts' },
        h('button', {
          class: 'sy-btn is-accent',
          onClick: (e) => goToGap(suivante.go, navigate, e.currentTarget),
        }, `Renseigner « ${suivante.label} » →`),
        h('button', { class: 'sy-btn is-ghost', onClick: pilotage }, t.parcourir),
      ),
      h('div', { class: 'sy-ink-meter', 'aria-hidden': 'true' },
        h('i', { style: { width: `${Math.round(part * 100)}%` } })),
    ),

    // La colonne claire : la prochaine étape, en clair — ce qu'elle est, où
    // elle mène, pourquoi elle compte — puis l'avancement de chaque page, qui
    // emmène à ce qu'il y reste à faire.
    h('aside', { class: 'sy-next' },
      h('div', { class: 'sy-kicker' }, 'Prochaine étape'),
      h('button', { class: 'sy-nextstep', onClick: (e) => goToGap(suivante.go, navigate, e.currentTarget) },
        h('span', { class: 'sy-nextstep-label' }, suivante.label),
        h('span', { class: 'sy-nextstep-where' }, destination(suivante)),
        suivante.why ? h('span', { class: 'sy-nextstep-why' }, suivante.why) : null,
        h('span', { class: 'sy-nextstep-go' }, 'Y aller →'),
      ),
      h('div', { class: 'sy-kicker sy-axes-kicker' }, 'Par page'),
      h('ul', { class: 'sy-axes' },
        ...axes.map((ax) => {
          const cible = ax.reste[0]
          return h('li', {},
            h('button', {
              class: `sy-axe ${ax.reste.length ? '' : 'is-complete'}`,
              disabled: cible ? null : true,
              onClick: (e) => (cible ? goToGap(cible.go, navigate, e.currentTarget) : null),
              title: cible ? `Prochaine chose à faire ici : ${cible.label}` : 'Tout est fait ici',
            },
              h('span', { class: 'sy-axe-nom' }, ax.label),
              h('span', { class: 'sy-axe-bar', 'aria-hidden': 'true' }, h('i', { style: { width: `${Math.round(ax.part * 100)}%` } })),
              h('span', { class: 'sy-axe-num' }, ax.reste.length ? `${ax.posees}/${ax.lignes.length}` : '✓'),
            ),
          )
        }),
      ),
    ),
  )
}

/**
 * Ce que tu as fait, ce qu'il te reste — page par page.
 *
 * Quatre prochaines étapes ne disaient pas tout : on ne voyait ni ce qui
 * était déjà acquis, ni que l'équipe ou les charges méritaient d'être
 * reprises. Chaque page a ici sa colonne : ce qui est fait, coché ; ce qui
 * reste, avec l'endroit exact où ça se remplit. Un clic y emmène.
 */
function dossierParAxe(c, navigate) {
  const axes = parAxe(c)
  const aller = (i) => (e) => goToGap(i.go, navigate, e.currentTarget)
  // Une colonne de douze lignes écrase les autres : on en montre cinq, et le
  // reste se déplie sur place. Ce qui est déplié le reste d'un rendu à l'autre.
  const liste = (cle, lignes, max, rendre) => {
    const tout = dossierDeplie.has(cle) || lignes.length <= max + 1
    return [
      ...(tout ? lignes : lignes.slice(0, max)).map(rendre),
      tout ? null : h('button', {
        class: 'sy-dossier-more',
        onClick: (e) => {
          dossierDeplie.add(cle)
          const bloc = e.currentTarget.parentElement
          e.currentTarget.remove()
          lignes.slice(max).forEach((i) => bloc.appendChild(rendre(i)))
        },
      }, `Voir ${lignes.length - max > 1 ? `les ${lignes.length - max} autres` : 'l’autre'}`),
    ]
  }
  const aFaire = (i) => h('button', { class: `sy-todo ${i === c.next ? 'is-next' : ''} ${i.relire ? 'is-relire' : ''} ${i.optionnel ? 'is-option' : ''}`, onClick: aller(i) },
    h('span', { class: 'sy-todo-label' }, i.label),
    h('span', { class: 'sy-todo-where' },
      i.relire ? h('b', {}, 'À relire · ') : i.optionnel ? h('b', {}, 'Facultatif · ') : null,
      destination(i).split(' › ').slice(1).join(' › ') || destination(i)),
  )
  const fait = (i) => h('button', { class: `sy-done ${i.na ? 'is-na' : ''}`, onClick: aller(i), title: i.na ? 'Ne concerne pas ton activité pour l’instant' : 'Revoir' },
    h('i', { 'aria-hidden': 'true' }, i.na ? '–' : '✓'),
    h('span', {}, i.label, i.na ? h('em', {}, 'Sans objet pour ton activité') : null))

  return h('section', { class: 'sy-dossier' },
    h('div', { class: 'sy-sec-head' },
      h('div', {},
        h('h2', { class: 'sy-sec-title' }, 'Ce que tu as fait, ce qu’il te reste'),
        h('p', { class: 'sy-sec-say' }, 'Page par page. Chaque ligne emmène à l’endroit exact où elle se remplit.'),
      ),
    ),
    h('div', { class: 'sy-dossier-grid' },
      ...axes.map((ax, k) => h('article', { class: `sy-dossier-col ${ax.reste.length ? '' : 'is-complete'}`, style: { '--i': String(k) } },
        h('header', { class: 'sy-dossier-head' },
          h('span', { class: 'sy-dossier-nom' }, ax.label),
          h('span', { class: 'sy-dossier-num' }, `${ax.posees}/${ax.lignes.length}`),
        ),
        h('div', { class: 'sy-axe-bar', 'aria-hidden': 'true' }, h('i', { style: { width: `${Math.round(ax.part * 100)}%` } })),
        ax.reste.length
          ? h('div', { class: 'sy-dossier-bloc' },
              h('div', { class: 'sy-dossier-tag' }, `À faire · ${ax.reste.length}`),
              ...liste(`${ax.key}:reste`, ax.reste, 3, aFaire))
          : h('p', { class: 'sy-dossier-ok' }, 'Tout est posé ici.'),
        ax.faites.length
          ? h('div', { class: 'sy-dossier-bloc is-done' },
              h('div', { class: 'sy-dossier-tag' }, `Fait · ${ax.faites.length}`),
              ...liste(`${ax.key}:faites`, ax.faites, 3, fait))
          : null,
      )),
    ),
  )
}
const dossierDeplie = new Set()

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
 * Les trois actes se ressemblaient trop : trois rangées de colonnes de texte,
 * même poids, même forme, et l'œil ne voyait plus où finissait l'un et
 * commençait l'autre. Chacun a désormais sa forme, choisie pour ce qu'il dit :
 *
 *   — le premier pose deux cartes de mesure : un grand chiffre, sa courbe,
 *     puis ce qu'il faut en retenir ;
 *   — le deuxième met une seule image au centre — où part chaque euro — et
 *     range les autres lectures en texte libre à côté ;
 *   — le troisième tend une bande : le seuil à franchir en grand, puis les
 *     leviers chiffrés.
 *
 * Dans les trois, la même hiérarchie : ce que l'on mesure, combien, ce qu'il
 * faut en retenir, puis le détail pour qui le veut. Le texte reste celui de la
 * synthèse d'origine ; c'est l'ordre et la taille qui ont changé.
 */
// Le nom de chaque partie est la question à laquelle elle répond : on doit
// savoir de quoi elle parle avant d'en lire le titre.
const SECTIONS = {
  plein: ['Gagnes-tu de l’argent, et quand ?', 'Où part chaque euro encaissé', 'Combien vendre pour être rentable'],
  avant: ['Ce que ton projet coûte chaque mois', 'Ce qui pèse le plus dans tes dépenses', 'Combien il faudra vendre'],
}

function acte(a, i, total, r, s, sansCA, navigate) {
  const cartes = a.cartes.filter(Boolean)
  const nom = (sansCA ? SECTIONS.avant : SECTIONS.plein)[i] || ''
  const tete = h('header', { class: 'sy-act-head' },
    h('div', { class: 'sy-act-no' },
      h('b', {}, String(i + 1).padStart(2, '0')),
      h('span', {}, nom),
      // Le titre dit ce que le plan donne tel qu'il est saisi ; un chiffre qui
      // étonne se signale sur la ligne du numéro, replié, et s'ouvre par-dessus.
      a.garde ? h('div', { class: 'sx-right-row' }, gardeBloc(a.garde, navigate, { classe: 'sy-garde' })) : null,
      h('em', {}, `${i + 1} / ${total}`),
    ),
    h('h2', { class: 'sy-act-title' }, titre(a.titre)),
    h('p', { class: 'sy-act-say' }, titre(a.dit)),
  )

  const dernier = i === total - 1
  let corps
  if (i === 1 && cartes.length > 1) corps = miseEnAvant(cartes, r)
  else if (i === 2 && cartes.some((c) => c.cle === 'seuil' || c.cle === 'objectif')) corps = bande(cartes, r, dernier ? leviersChiffres(s, r) : null)
  else corps = [duo(cartes, r), dernier ? leviersChiffres(s, r) : null]

  return guet(h('section', { class: `sy-act is-${i === 1 ? 'feature' : i === 2 ? 'band' : 'duo'}` },
    tete, corps,
  ), `acte-${i}`)
}

/* ─────────── Forme 1 : deux cartes de mesure ─────────── */

function duo(cartes, r) {
  return h('div', { class: `sy-cards is-${Math.min(3, cartes.length)}` },
    ...cartes.map((c, k) => carte(c, k, r)))
}

/**
 * Une carte de mesure.
 *
 * Ce que l'on mesure, en surtitre ; combien, en très grand ; l'image qui le
 * confirme ; la phrase à retenir, en gras ; le détail, en clair. On lit la
 * carte de haut en bas en s'arrêtant où l'on veut : au chiffre si l'on est
 * pressé, à l'explication si l'on veut comprendre.
 */
function carte(c, k, r) {
  return h('article', { class: `sy-card is-${c.tone}`, style: { '--i': String(k) } },
    h('div', { class: 'sy-card-kicker' }, h('i', { 'aria-hidden': 'true' }), c.kicker),
    grandChiffre(c),
    visuel(c, r),
    h('h3', { class: 'sy-card-title' }, titre(c.title)),
    h('p', { class: 'sy-card-body' }, c.body),
    c.pourquoi ? h('p', { class: 'sy-card-why' }, h('b', {}, 'Pourquoi c’est important · '), c.pourquoi) : null,
  )
}

/**
 * Le chiffre de la lecture, en grand, et son libellé exact dessous.
 *
 * Un montant de neuf chiffres ne se lit pas d'un coup d'œil : il s'écrit en
 * millions dans le grand format, et la valeur exacte reste juste dessous, à
 * l'euro près — précis sans être illisible.
 */
function grandChiffre(c) {
  if (!c.figure) return null
  const exact = String(c.figure.value)
  const court = abrege(exact)
  const frais = changed(`sy-chiffre-${c.cle || c.kicker}`, exact)
  return h('div', { class: 'sy-big' },
    h('span', { class: `sy-big-val ${c.figure.good ? 'is-pos' : 'is-neg'} ${frais ? 'is-fresh' : ''}` }, court),
    h('span', { class: 'sy-big-cap' }, court !== exact ? `${c.figure.label} · ${exact}` : c.figure.label),
  )
}

/** « 280 582 085 € » devient « 280,6 M€ » ; un pourcentage ou un tiret reste tel quel. */
function abrege(texte) {
  // Tests par chaînes, pas par expressions régulières : esbuild réécrit en
  // clair les caractères échappés d'un littéral /…/, et un € ou un signe moins
  // typographique y casserait le paquet livré en ASCII.
  if (!texte.trim().endsWith('\u20ac')) return texte
  const v = Number(texte.split('\u2212').join('-').replace(/[^\d,-]/g, '').replace(',', '.'))
  if (!Number.isFinite(v) || Math.abs(v) < 100000) return texte
  return euro(v, { compact: true })
}

/** L'image d'une lecture, quelle qu'elle soit. */
function visuel(c, r, { grand = false } = {}) {
  const cle = `vis-${c.cle || c.kicker}-${grand ? 'g' : 'p'}`
  if (c.bars) return vis(barres(c.bars, c.kicker, grand), cle)
  if (c.line) return vis(courbe(c.line, r.startDate, { hauteur: grand ? 120 : 84, legende: 'Ton compte, mois par mois' }), cle)
  if (c.split) return vis(grand ? grandeBarre(c.split, c.kicker) : repartition(c.split, c.kicker), cle)
  if (c.meter) return vis(jauge(c.meter, grand), cle)
  return null
}

/* ─────────── Forme 2 : une image au centre, le reste en texte libre ─────────── */

/**
 * Où part chaque euro, en grand, et ce qui l'explique à côté.
 *
 * La répartition des cent euros est l'image la plus parlante du dossier :
 * elle prend la largeur et la hauteur. Les autres lectures de l'acte — le
 * poste qui pèse, la rémunération — n'ont pas besoin de carte : ce sont des
 * faits, posés en texte libre dans la colonne d'à côté.
 */
function miseEnAvant(cartes, r) {
  const centre = cartes.find((c) => c.cle === 'sur100') || cartes.find((c) => c.split) || cartes[0]
  const autres = cartes.filter((c) => c !== centre)
  return h('div', { class: 'sy-feature' },
    h('article', { class: `sy-feature-main is-${centre.tone}` },
      h('div', { class: 'sy-card-kicker' }, h('i', { 'aria-hidden': 'true' }), centre.kicker),
      h('h3', { class: 'sy-feature-title' }, titre(centre.title)),
      visuel(centre, r, { grand: true }),
      h('p', { class: 'sy-card-body' }, centre.body),
      centre.pourquoi ? h('p', { class: 'sy-card-why' }, h('b', {}, 'Pourquoi c’est important · '), centre.pourquoi) : null,
      centre.figure ? h('div', { class: 'sy-feature-fig' },
        h('span', {}, centre.figure.label),
        h('b', { class: centre.figure.good ? 'is-pos' : 'is-neg' }, centre.figure.value)) : null,
    ),
    h('div', { class: 'sy-facts' }, ...autres.map((c, k) => fait(c, k, r))),
  )
}

/** Un fait : pas de carte, un filet, un chiffre, une phrase. */
function fait(c, k, r) {
  const exact = c.figure ? String(c.figure.value) : null
  return h('article', { class: `sy-fact is-${c.tone}`, style: { '--i': String(k) } },
    h('div', { class: 'sy-card-kicker' }, h('i', { 'aria-hidden': 'true' }), c.kicker),
    exact ? h('div', { class: `sy-fact-val ${c.figure.good ? 'is-pos' : 'is-neg'}` }, abrege(exact)) : null,
    h('h3', { class: 'sy-fact-title' }, titre(c.title)),
    c.split ? vis(repartition(c.split, c.kicker), `vis-${c.cle}-fait`) : null,
    h('p', { class: 'sy-card-body' }, c.body),
    c.pourquoi ? h('p', { class: 'sy-card-why' }, h('b', {}, 'Pourquoi c’est important · '), c.pourquoi) : null,
  )
}

/* ─────────── Forme 3 : une bande, puis les leviers ─────────── */

/**
 * Le seuil, en travers de la page.
 *
 * Le point mort est une distance : ce qu'il faut vendre, ce qu'on prévoit de
 * vendre, et l'écart entre les deux. Il se lit mieux en longueur qu'en
 * pourcentage — d'où une bande pleine largeur, avec les deux repères posés
 * sur la même règle.
 */
function bande(cartes, r, leviers) {
  const centre = cartes.find((c) => c.cle === 'seuil') || cartes.find((c) => c.cle === 'objectif')
  const autres = cartes.filter((c) => c !== centre)
  // Sous la bande, la trajectoire et les leviers côte à côte : ce qu'on
  // promet, et ce qui le rendrait plus sûr. Une carte seule en pleine largeur
  // étirait ses cinq barres jusqu'à ne plus rien dire.
  const suite = leviers && autres.length
    ? h('div', { class: 'sy-band-row' }, ...autres.map((c, k) => carte(c, k, r)), leviers)
    : [autres.length ? duo(autres, r) : null, leviers]
  return h('div', { class: 'sy-bandwrap' },
    h('article', { class: `sy-band is-${centre.tone}` },
      h('div', { class: 'sy-band-say' },
        h('div', { class: 'sy-card-kicker' }, h('i', { 'aria-hidden': 'true' }), centre.kicker),
        grandChiffre(centre),
        h('h3', { class: 'sy-card-title' }, titre(centre.title)),
        h('p', { class: 'sy-card-body' }, centre.body),
        centre.pourquoi ? h('p', { class: 'sy-card-why' }, h('b', {}, 'Pourquoi c’est important · '), centre.pourquoi) : null,
      ),
      h('div', { class: 'sy-band-viz' }, visuel(centre, r, { grand: true })),
    ),
    suite,
  )
}

/**
 * Les leviers, chiffrés par le moteur.
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
    h('div', { class: 'sy-levers-head' },
      h('div', { class: 'sy-kicker' }, 'Chiffré par le moteur'),
      h('h3', { class: 'sy-levers-title' }, 'Les trois gestes qui rapportent le plus'),
    ),
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
/** Le numéro d'une partie, au même format que les trois actes. */
function numero(no, nom) {
  return h('div', { class: 'sy-act-no' },
    h('b', {}, String(no).padStart(2, '0')),
    h('span', {}, nom),
  )
}

function sixChiffres(r, s, y, choisir, navigate) {
  const figures = figureSet(r, s, y)
  return h('section', { class: 'sy-figs sy-act' },
    numero(4, 'Les chiffres clés'),
    h('div', { class: 'sy-sec-head' },
      h('div', {},
        h('h2', { class: 'sy-act-title' }, 'Les six chiffres qu’un banquier te demandera'),
        h('p', { class: 'sy-act-say' }, 'EBITDA, point mort, trésorerie au plus bas, montant à financer, marge brute, autonomie : clique sur chacun pour savoir ce qu’il veut dire, pourquoi on te le demande, et où le corriger.'),
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
    f.spark && f.spark.some((v) => v) ? vis(etincelle(f.spark, TON[f.tone === 'pos' ? 'good' : f.tone === 'neg' ? 'bad' : 'watch']), `spark-${f.help}`) : null,
    h('span', { class: 'sy-fig-more' },
      h('span', { class: 'sy-fig-more-o' }, 'Comprendre'), h('span', { class: 'sy-fig-more-c' }, 'Refermer'),
      h('i', { class: 'sy-fig-chev', 'aria-hidden': 'true' })),
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
  return h('section', { class: `sy-deep sy-act ${etat.analyse ? 'is-open' : ''} ${neuve ? 'is-opening' : ''}` },
    numero(5, 'Le détail des comptes'),
    h('h2', { class: 'sy-act-title' }, 'D’où viennent tous ces chiffres'),
    h('p', { class: 'sy-act-say' }, 'Pour vérifier un chiffre ou répondre à une question précise : le compte de résultat de chaque année, ce qui fait passer du chiffre d’affaires au bénéfice, et le compte en banque mois par mois.'),
    h('button', {
      class: 'sy-deep-head',
      'aria-expanded': String(etat.analyse),
      onClick: () => {
        etat.analyse = !etat.analyse
        etat.analyseNeuve = etat.analyse
        refresh()
      },
    },
      h('span', { class: 'sy-deep-list' },
        ...['Les cinq années', 'Du chiffre d’affaires au bénéfice', 'Le compte en banque', 'Où part l’argent', 'Tes offres', 'Les ratios'].map((x) => h('span', {}, x))),
      h('span', { class: 'sy-deep-open' }, etat.analyse ? 'Refermer' : 'Ouvrir le détail', h('i', { class: 'sy-fig-chev', 'aria-hidden': 'true' })),
    ),
    etat.analyse ? h('div', { class: 'sy-deep-body' },
      exercices(r, y, choisir),
      equation(r, y),
      h('div', { class: 'sy-pair' }, vis(cinqAns(r, y, choisir), 'deep-cinq'), vis(cascade(r, y), 'deep-cascade')),
      vis(tresorerie(r), 'deep-tresor'),
      h('div', { class: 'sy-pair' }, vis(structure(r, y), 'deep-structure'), vis(offres(r), 'deep-offres')),
      guet(ratios(r, y), 'deep-ratios'),
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
function barres(items, nom, grand = false) {
  const haut = Math.max(0, ...items.map((i) => n(i.value)))
  const bas = Math.min(0, ...items.map((i) => n(i.value)))
  const span = haut - bas || 1
  // La ligne de zéro tombe là où le zéro se trouve vraiment : une perte de
  // 12 000 € face à un bénéfice de 800 000 € ne mérite pas la moitié du dessin.
  // Une échelle, une seule, pour les deux sens.
  const zero = haut / span
  return h('div', { class: `sy-mini ${grand ? 'is-grand' : ''}`, style: { '--zero': String(zero) } },
    h('i', { class: 'sy-mini-zero', 'aria-hidden': 'true' }),
    ...items.map((it, k) => {
      const v = n(it.value)
      const part = (Math.abs(v) / span) * 100
      const pose = v >= 0
        ? { bottom: `${(1 - zero) * 100}%`, height: `${part}%` }
        : { top: `${zero * 100}%`, height: `${part}%` }
      return hot(h('div', { class: 'sy-mini-col' },
        h('div', { class: 'sy-mini-track' },
          h('i', { class: v < 0 ? 'is-neg' : 'is-pos', style: { ...pose, '--i': String(k) } },
            // En grand, chaque barre porte son montant : l'image se lit sans
            // survol, et le survol garde l'euro près.
            grand ? h('span', { class: 'sy-mini-val' }, euro(v, { compact: true })) : null)),
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

/**
 * Une jauge : la part d'un seuil atteinte, et le repère du seuil.
 *
 * En grand, elle devient une règle : le seuil et le prévu y sont posés avec
 * leurs montants, et l'écart se lit comme une distance.
 */
function jauge(meter, grand = false) {
  const { part, label, seuil, prevu } = meter
  if (grand && n(seuil) > 0) {
    const max = Math.max(n(seuil), n(prevu)) * 1.08 || 1
    const franchi = n(prevu) >= n(seuil)
    const xs = (n(seuil) / max) * 100
    const xp = Math.max(1.5, (n(prevu) / max) * 100)
    return h('div', { class: `sy-rule ${franchi ? 'is-ok' : ''}` },
      h('div', { class: 'sy-rule-track' },
        h('i', { class: 'sy-rule-fill', style: { width: `${xp}%` } }),
        h('span', { class: 'sy-rule-mark', style: { left: `${xs}%` }, 'aria-hidden': 'true' }),
      ),
      h('div', { class: 'sy-rule-labels' },
        h('span', { class: 'sy-rule-seuil', style: { left: `${xs}%` } },
          h('b', {}, 'Point mort'), euro(n(seuil), { compact: true })),
        h('span', { class: 'sy-rule-prevu', style: { left: `${xp}%` } },
          h('b', {}, 'Prévu'), euro(n(prevu), { compact: true })),
      ),
      h('span', { class: 'sy-gauge-label' }, label),
    )
  }
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

/**
 * Cent euros, en une barre large.
 *
 * Chaque part porte son montant dans la barre quand elle est assez large pour
 * le contenir, et toutes se retrouvent dans la liste dessous, alignée sur la
 * droite : on lit l'image, puis on vérifie les nombres.
 */
function grandeBarre(parts, nom) {
  const garde = parts.filter((p) => n(p.value) > 0)
  const total = garde.reduce((a, p) => a + n(p.value), 0) || 100
  return h('div', { class: 'sy-hundred' },
    hot(h('div', { class: 'sy-hundred-bar' },
      ...garde.map((p, k) => h('i', {
        class: `is-${p.tone}`,
        style: { flexGrow: String(n(p.value) / total), '--i': String(k) },
      }, n(p.value) / total >= 0.09 ? h('span', {}, `${p.value} €`) : null))),
      nom, () => garde.map((p) => ({ label: p.label, value: `${p.value} € sur 100`, strong: p.tone === 'left' }))),
    h('div', { class: 'sy-hundred-keys' },
      ...garde.map((p) => h('div', { class: `sy-hundred-key is-${p.tone}` },
        h('i', { 'aria-hidden': 'true' }),
        h('span', {}, p.label),
        h('b', {}, `${p.value} €`)))),
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

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
import { hot, STATUS, barChart } from '../charts.js'
import { checklist, parAxe, destination } from '../checklist.js'
import { goToGap } from '../spotlight.js'
import { lookup } from '../glossary.js'
import { changed } from '../motion.js'
import { synthese, RELIRE, lignesRestantes, POURQUOI } from '../plain.js'
import { gardeBloc } from '../garde.js'
import { PAGE_NAME, avancement } from '../figures.js'
import { revenueSentence, costsSentence, mixSentence, cashSentence, bfrSentence, moneyFlowSentence } from '../explain.js'
import { verdict } from '../../engine/verdict.js'
import { periodeAnnee } from '../../format.js'
import { coutDUneVente } from '../../engine/engine.js'
import { bloquantes } from '../../engine/plausible.js'
import { lignesBanquier } from '../banquier.js'
import { barres as asBarres, cascade as asCascade, courbeTreso, equation as asEquation, lesOffres, formule, consommation, sensibilites, lignesDeCouts, tableau as asTableau, prixTxt } from './analyse.js'
import { SECTORS } from '../../state/schema.js'
import { uniteOffre } from '../../state/sectors.js'
import { mentionCourte } from '../../state/reperes.js'
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
const titre = (t) => [' %', ' :', ' ;', ' ?', ' !', ' \u20ac', ' \u00bb', '\u00ab ', 'ann\u00e9e ', 'Ann\u00e9e ']
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

  // Les six chiffres lisent l'année 1 par défaut : c'est par elle que le
  // détail s'ouvre ; les pastilles d'exercice en montrent une autre.
  const y = etat.annee !== null && etat.annee >= 0 && etat.annee < 5 ? etat.annee : 0
  const choisir = (k) => { etat.annee = k; refresh() }
  const pilotage = () => (goView ? goView('pilotage') : navigate('#/tableau-de-bord'))

  // Un chiffre hors de proportion avec le métier se signale dès l'ouverture,
  // et rien ne se colore en succès tant qu'il tient.
  const { garde } = synthese(s, r)
  const prudence = bloquantes(garde || []).length > 0

  racine = h('div', { class: `sy is-edito ${entree ? 'is-enter' : ''}` },
    // L'ordre du récit : le chiffre d'affaires et le résultat, puis ce qu'il
    // faut financer ; les six chiffres à connaître ; un chapitre pour chacun.
    introDetail(s, r, garde, prudence, navigate),
    guet(sixChiffres(r, s, y, choisir, navigate), 'chiffres'),
    sommaireDetail(),
    ...partiesDetail(s, r, prudence, navigate),
    guet(hypotheses(r, s, navigate), 'hypotheses'),
    analyse(r, s, y, choisir, navigate, refresh),
    pied(navigate, pilotage),
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
      i.relire ? h('b', {}, 'À relire · ') : i.aValider ? h('b', {}, 'À valider · ') : i.optionnel ? h('b', {}, 'Facultatif · ') : null,
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

/**
 * « Pourquoi c'est important », replié.
 *
 * Ouvert partout, il doublait la longueur de chaque carte : on lisait un
 * mur de texte là où l'on cherchait un chiffre. Il reste à un clic, sous la
 * carte, pour qui veut comprendre.
 */
function pourquoi(texte) {
  if (!texte) return null
  return h('details', { class: 'sy-why' },
    h('summary', {}, 'Pourquoi c’est important'),
    h('p', {}, texte))
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

/* ───────────────────────── Le détail, dans l'ordre du récit ───────────────────────── */

/**
 * L'ordre du détail : ce que tout le monde veut savoir d'abord, puis pourquoi.
 *
 * Le détail s'ouvrait sur la trésorerie — « Rentable tout de suite, mais
 * 78 981 € à avancer » — avant d'avoir dit ce que l'entreprise vend et gagne.
 * Il commence désormais par le chiffre d'affaires et le résultat ; le besoin
 * de trésorerie vient juste après, puis les six chiffres à connaître, puis un
 * chapitre pour chacun d'eux.
 *
 * La mise en page est celle d'un article : un grand titre, trois chiffres, un
 * dessin, puis un filet. Les panneaux blancs empilés sont partis ; seuls les
 * objets qui méritent d'être isolés — un tableau, une cascade — ont leur cadre.
 */
const PARTIES = [
  { cle: 'ca', nom: 'Chiffre d’affaires et résultat' },
  { cle: 'offres', nom: 'D’où vient le chiffre d’affaires' },
  { cle: 'vente', nom: 'Économie d’une vente' },
  { cle: 'couts', nom: 'Structure des coûts' },
  { cle: 'equipe', nom: 'Équipe et masse salariale' },
  { cle: 'treso', nom: 'Trésorerie' },
  { cle: 'finance', nom: 'Financement' },
  { cle: 'hypotheses', nom: 'Hypothèses et risques', id: 'sy-hypotheses' },
  { cle: 'comptes', nom: 'Analyse détaillée', id: 'sy-comptes' },
]
const idPartie = (cle) => PARTIES.find((x) => x.cle === cle)?.id || `sy-ed-${cle}`
const allerA = (cle) => document.getElementById(idPartie(cle))?.scrollIntoView({ behavior: reduit() ? 'auto' : 'smooth', block: 'start' })
const eurC = (v) => euro(v, { compact: Math.abs(v) >= 100000 })
const tauxDe = (a, b) => (n(b) > 0 && Math.abs(n(a) / n(b)) <= 10 ? n(a) / n(b) : null)

/** L'ouverture : le chiffre d'affaires, le résultat, la marge ; puis ce qu'il faut financer. */
function introDetail(s, r, garde, prudence, navigate) {
  const p = r.pnl, k = r.kpis
  const ca = n(p.revenue[0]), net = n(p.netResult[0])
  const marge = tauxDe(net, ca)
  const besoin = n(k.fundingNeed)
  const premier = k.firstProfitableYear
  const sansCA = !p.revenue.some((v) => n(v) > 0)
  const ton = (v) => (v < 0 ? 'bad' : prudence ? '' : 'good')
  return guet(h('section', { class: 'sy-act sy-intro', id: 'sy-intro' },
    h('div', { class: 'sy-act-no' },
      h('span', {}, 'Le plan en trois chiffres'),
      garde?.length ? h('div', { class: 'sx-right-row' }, gardeBloc(garde, navigate, { classe: 'sy-garde' })) : null,
    ),
    // Le titre conclut ; les trois chiffres dessous le prouvent. Il redisait
    // le chiffre d'affaires juste au-dessus du même chiffre.
    h('h2', { class: 'sy-act-title' }, titre(sansCA ? 'Le plan ne prévoit pas encore de ventes'
      : premier === 0 ? 'Bénéficiaire dès l’année 1'
        : premier > 0 ? `Bénéficiaire à partir de l’année ${premier + 1}`
          : 'Pas de bénéfice sur les cinq ans du plan')),
    h('div', { class: 'sy-intro-figs' },
      h('div', { class: 'sy-intro-fig' }, h('b', {}, eurC(ca)), h('span', {}, 'de chiffre d’affaires en année 1')),
      h('div', { class: `sy-intro-fig is-${ton(net)}` }, h('b', {}, eurC(net)), h('span', {}, 'de résultat net')),
      h('div', { class: `sy-intro-fig is-${ton(net)}` }, h('b', {}, marge === null ? '—' : pct(marge, 1)), h('span', {}, 'de marge nette')),
    ),
    h('p', { class: 'sy-intro-suite' }, titre(besoin > 0
      ? `${premier === 0 ? 'Il faut tout de même financer' : premier > 0 ? 'Pour y arriver, il faut financer' : 'Le plan demande de financer'} ${euro(besoin)} : c’est le point bas de la trésorerie, en ${monthLabel(k.cashLow.month, r.startDate).replace(' ', '\u00a0')}.`
      : 'La trésorerie reste positive : aucun financement supplémentaire n’est nécessaire dans ce scénario.')),
  ), 'intro')
}

/** Le sommaire : les neuf parties, dans l'ordre où on les lit. */
function sommaireDetail() {
  return h('nav', { class: 'sy-sommaire', 'aria-label': 'Sommaire du détail' },
    h('span', { class: 'sy-sommaire-t' }, 'Dans ce détail'),
    h('ol', {},
      ...PARTIES.map((x, i) => h('li', {},
        h('button', { type: 'button', onClick: () => allerA(x.cle) },
          h('b', {}, String(i + 1).padStart(2, '0')), h('span', {}, x.nom))))),
  )
}

/**
 * Une partie, mise en page comme un article : le numéro et son nom, un grand
 * titre qui répond, une explication courte, trois chiffres, le dessin, puis ce
 * qui le détaille. Un filet la sépare de la suivante.
 */
function partie({ cle, titre: t, dit, chiffres = [], dessin = null, apres = [], pourquoiTexte = null, lien = null }, navigate) {
  const i = PARTIES.findIndex((x) => x.cle === cle)
  return guet(h('section', { class: 'sy-act sy-chapitre sy-ed', id: idPartie(cle), 'data-partie': cle },
    h('header', { class: 'sy-act-head' },
      h('div', { class: 'sy-act-no' }, h('b', {}, String(i + 1).padStart(2, '0')), h('span', {}, PARTIES[i].nom)),
      h('h2', { class: 'sy-act-title' }, titre(t)),
    ),
    dit ? h('p', { class: 'sy-clair sy-ed-dit' }, titre(dit)) : null,
    chiffres.filter(Boolean).length ? h('div', { class: 'sy-ed-figs' },
      ...chiffres.filter(Boolean).map((c) => h('div', { class: `sy-ed-fig ${c.ton ? `is-${c.ton}` : ''}` },
        h('span', { class: 'sy-ed-fig-l' }, c.l),
        h('b', { class: 'sy-ed-fig-v' }, c.v),
        c.note ? h('small', { class: 'sy-ed-fig-n' }, c.note) : null))) : null,
    dessin ? vis(h('div', { class: 'sy-ed-dessin' }, dessin), `ed-${cle}`) : null,
    ...apres.filter(Boolean),
    pourquoi(pourquoiTexte),
    lien ? h('button', { class: 'sy-link sy-ed-lien', onClick: () => goToGap(lien.go, navigate) }, `${lien.label} →`) : null,
  ), `ed-${cle}`)
}

/** Les sept parties chiffrées ; les hypothèses et l'analyse détaillée suivent. */
function partiesDetail(s, r, prudence, navigate) {
  const p = r.pnl, k = r.kpis
  const debut = r.startDate
  const ANS = [0, 1, 2, 3, 4]
  const ca = p.revenue.map(n)
  const aucune = !ca.some((v) => v > 0)
  const ton = (v) => (v < 0 ? 'bad' : prudence ? '' : 'good')
  const offresPlan = lesOffres(s, r).sort((a, b) => b.ca[0] - a.ca[0] || b.ca[4] - a.ca[4])
  const top = offresPlan[0] || null
  const parts = []
  const tetes = (premier) => [premier, 'Année 1', 'Année 2', 'Année 3', 'Année 4', 'Année 5']

  /* 1 — Chiffre d'affaires et résultat */
  {
    const net = p.netResult.map(n)
    const cagr = ca[0] > 0 && ca[4] > 0 && ca[4] / ca[0] <= 1000 ? Math.pow(ca[4] / ca[0], 1 / 4) - 1 : null
    const premierAn = Number.isInteger(k.firstProfitableYear) ? k.firstProfitableYear : null
    parts.push(partie({
      cle: 'ca',
      titre: aucune ? 'Pas encore de chiffre d’affaires' : `${eurC(ca[0])} en année 1, ${eurC(ca[4])} en année 5`,
      dit: aucune ? 'Fixe un prix et un volume dans Offre et revenus : cette partie se remplira.'
        : `Le résultat net passe de ${eurC(net[0])} en année 1 à ${eurC(net[4])} en année 5.`,
      // L'ouverture a posé l'année 1 ; cette partie dit la trajectoire.
      chiffres: aucune ? [] : [
        cagr !== null ? { l: 'Croissance annuelle moyenne', v: `${cagr >= 0 ? '+' : '−'}${pct(Math.abs(cagr), 0)}`, note: 'Du chiffre d’affaires, de l’année 1 à l’année 5.' } : null,
        { l: 'Premier bénéfice', v: premierAn === null ? 'Aucun' : `Année ${premierAn + 1}`, ton: premierAn === null ? 'bad' : null,
          note: premierAn === null ? 'Sur les cinq ans du plan.' : `${eurC(net[premierAn])} de résultat net.` },
        { l: 'Marge nette, année 5', v: tauxDe(net[4], ca[4]) === null ? '—' : pct(tauxDe(net[4], ca[4]), 1), ton: ton(net[4]), note: 'Le résultat net rapporté au chiffre d’affaires.' },
      ].filter(Boolean),
      dessin: aucune ? null : barChart({
        series: [{ label: 'Chiffre d’affaires', values: ca, color: '#0E0F0C' }],
        line: { label: 'Résultat net', values: net, color: '#1B7F4B' },
        categories: ['A1', 'A2', 'A3', 'A4', 'A5'], height: 210, largeur: 640,
        periodes: ANS.map((i) => periodeAnnee(i, debut)),
      }),
      apres: aucune ? [] : [asTableau(tetes(''), [
        ['Chiffre d’affaires', ...ca.map((v) => euro(v))],
        ['Variation', '—', ...ANS.slice(1).map((y) => (ca[y - 1] > 0 ? `${ca[y] >= ca[y - 1] ? '+' : '−'}${pct(Math.abs(ca[y] / ca[y - 1] - 1), 0)}` : '—'))],
        ['Marge brute', ...p.grossMargin.map((v) => euro(v))],
        ['EBE', ...p.ebe.map((v) => euro(v))],
        ['Résultat net', ...net.map((v) => euro(v))],
        ['Marge nette', ...ANS.map((y) => (tauxDe(net[y], ca[y]) === null ? '—' : pct(tauxDe(net[y], ca[y]), 1)))],
      ])],
      pourquoiTexte: POURQUOI.profit,
      lien: { label: 'Les états financiers', go: { route: 'resultats' } },
    }, navigate))
  }

  /* 2 — D'où vient le chiffre d'affaires */
  {
    const total = (y) => offresPlan.reduce((t, o) => t + o.ca[y], 0)
    const part = top && total(0) > 0 ? top.ca[0] / total(0) : 0
    parts.push(partie({
      cle: 'offres',
      titre: !top ? 'Aucune offre ne vend encore'
        : offresPlan.length === 1 ? `Une offre, « ${top.nom} », porte tout le chiffre d’affaires`
          : `${pct(part, 0)} du chiffre d’affaires vient de « ${top.nom} »`,
      dit: !top ? null : `${formule(top, 0)} en année 1 : le prix multiplié par le volume donne le revenu. En année 5 : ${formule(top, 4)}.`,
      chiffres: !top ? [] : [
        { l: 'Offres qui vendent', v: String(offresPlan.length) },
        { l: top.modeRec ? 'Abonnés en fin d’année' : 'Volume de l’offre principale', v: top.modeRec ? `${num(top.abonnesFin[0], 0)} → ${num(top.abonnesFin[4], 0)}` : `${num(top.volume[0], 0)} → ${num(top.volume[4], 0)}`, note: 'De l’année 1 à l’année 5.' },
        { l: 'Prix moyen', v: prixTxt(top.prixMoyen[0]), note: top.modeRec ? 'par abonné et par mois' : `par ${top.u.one}` },
      ],
      dessin: top ? asBarres(offresPlan.slice(0, 6).map((o) => ({ nom: o.nom, v: o.ca[0], sous: formule(o, 0) })), {
        format: (v) => eurC(v), periode: `Chiffre d’affaires · ${periodeAnnee(0, debut)}`,
      }) : null,
      apres: !top ? [] : [
        asTableau(tetes('Chiffre d’affaires'), offresPlan.map((o) => [o.nom, ...o.ca.map((v) => euro(v))])),
        asTableau(tetes('Volumes'), offresPlan.map((o) => [`${o.nom} (${o.modeRec ? 'mensualités' : o.u.many})`, ...o.volume.map((v) => num(v, 0))])),
        asTableau(tetes('Contribution'), offresPlan.map((o) => [o.nom, ...ANS.map((y) => (total(y) > 0 ? pct(o.ca[y] / total(y), 0) : '—'))])),
      ],
      pourquoiTexte: 'Un chiffre d’affaires se défend offre par offre : un prix qu’on peut justifier, un volume qu’on peut atteindre. C’est ce produit, et lui seul, qui fait le revenu.',
      lien: { label: 'Les offres', go: { route: 'offre', view: 'offres' } },
    }, navigate))
  }

  /* 3 — Économie d'une vente */
  {
    const cv = top ? coutDUneVente(s, top.a) : null
    const prix = cv && cv.prix > 0 ? cv.prix : top ? top.prixMoyen[0] : 0
    const cout = cv ? cv.total : 0
    const marge = prix - cout
    const pm = n(k.breakEven?.[0])
    const par = top?.modeRec ? 'par mois' : top ? `par ${top.u.one}` : ''
    const lignes = cv ? [cv.propre > 0 ? { l: 'Coût de revient', v: cv.propre } : null, ...cv.lignes.map((x) => ({ l: x.label, v: x.v }))].filter(Boolean) : []
    const anPM = (k.breakEvenMonth || []).findIndex((m) => m)
    parts.push(partie({
      cle: 'vente',
      titre: !top ? 'Sans prix, une vente ne se calcule pas encore' : `${prixTxt(prix)} − ${prixTxt(cout)} = ${prixTxt(marge)} de marge par vente`,
      dit: !top ? null : `Chaque vente de « ${top.nom} » laisse ${prixTxt(marge)} une fois payé ce qu’elle coûte. C’est cette marge qui paie les charges fixes ; le point mort est le chiffre d’affaires où elle les couvre toutes.`,
      chiffres: !top ? [] : [
        { l: 'Coût de revient', v: prixTxt(cout), note: 'Coût direct d’une vente, charges par vente comprises.' },
        { l: 'Marge brute', v: tauxDe(p.grossMargin[0], ca[0]) === null ? '—' : pct(tauxDe(p.grossMargin[0], ca[0]), 1), note: `${eurC(n(p.grossMargin[0]))} en année 1.` },
        { l: 'Point mort, année 1', v: pm > 0 ? eurC(pm) : 'Non atteint', note: anPM >= 0 ? `Franchi en année ${anPM + 1}.` : 'Pas franchi sur cinq ans.' },
      ],
      dessin: top ? asEquation({ prix, cout, marge, par, lignes, periode: `Une vente de « ${top.nom} »` }) : null,
      apres: !top ? [] : [
        asTableau(['Offre', 'Prix', 'Coût de revient', 'Charges par vente', 'Contribution par vente', 'Taux'], offresPlan.map((o) => {
          const c = coutDUneVente(s, o.a)
          const px = c.prix > 0 ? c.prix : o.prixMoyen[0]
          return [o.nom, prixTxt(px), prixTxt(c.propre), c.charges > 0 ? prixTxt(c.charges) : '—', prixTxt(px - c.total), px > 0 ? pct((px - c.total) / px, 0) : '—']
        })),
        asTableau(tetes(''), [
          ['Charges fixes, amortissements et intérêts compris', ...ANS.map((y) => euro(n(k.fixedCosts?.[y])))],
          ['Taux de marge brute', ...ANS.map((y) => (tauxDe(p.grossMargin[y], ca[y]) === null ? '—' : pct(tauxDe(p.grossMargin[y], ca[y]), 1)))],
          ['Point mort', ...ANS.map((y) => (n(k.breakEven?.[y]) > 0 ? euro(k.breakEven[y]) : '—'))],
          ['Chiffre d’affaires', ...ca.map((v) => euro(v))],
        ]),
      ],
      pourquoiTexte: POURQUOI.seuil,
      lien: { label: 'Le coût de revient', go: { route: 'achats', view: 'charges', anchor: 'charges' } },
    }, navigate))
  }

  /* 4 — Structure des coûts */
  {
    const lignes = lignesDeCouts(s, r, 0)
    const fixeHors = ANS.map((y) => lignesDeCouts(s, r, y).filter((l) => l.nature === 'fixe').reduce((t, l) => t + l.v, 0))
    const variable = ANS.map((y) => lignesDeCouts(s, r, y).filter((l) => l.nature === 'variable').reduce((t, l) => t + l.v, 0))
    const masse = p.payroll.map(n)
    const fixes0 = fixeHors[0] + masse[0]
    const postes = Object.values(lignes.reduce((acc, l) => {
      const c = acc[l.poste.cle] || (acc[l.poste.cle] = { nom: l.poste.nom, v: 0, n: 0 })
      c.v += l.v; c.n += 1
      return acc
    }, {})).sort((a, b) => b.v - a.v)
    parts.push(partie({
      cle: 'couts',
      titre: fixes0 > 0 ? `${eurC(fixes0)} de charges fixes en année 1, dont ${pct(masse[0] / fixes0, 0)} pour l’équipe` : 'Aucune charge saisie',
      dit: 'Trois natures de coûts, qui ne bougent pas pour les mêmes raisons. Les coûts variables suivent les ventes. La masse salariale suit l’équipe. Les autres charges fixes tombent chaque mois, avec ou sans ventes.',
      chiffres: [
        { l: 'Charges fixes hors équipe', v: eurC(fixeHors[0]), note: `${euro(fixeHors[0] / 12)} par mois en année 1.` },
        { l: 'Masse salariale', v: eurC(masse[0]), note: 'Suit l’équipe : salaires et cotisations.' },
        { l: 'Coûts variables', v: eurC(variable[0]), note: tauxDe(variable[0], ca[0]) !== null ? `${pct(tauxDe(variable[0], ca[0]), 0)} du chiffre d’affaires : ils suivent les ventes.` : 'Ils suivent les ventes.' },
      ],
      dessin: barChart({
        series: [
          { label: 'Coûts variables', values: variable, color: '#9BA59A' },
          { label: 'Charges fixes hors équipe', values: fixeHors, color: '#4B5049' },
          { label: 'Masse salariale', values: masse, color: '#0E0F0C' },
        ],
        categories: ['A1', 'A2', 'A3', 'A4', 'A5'], height: 210, largeur: 640,
        periodes: ANS.map((i) => periodeAnnee(i, debut)),
      }),
      apres: [
        postes.length ? h('div', { class: 'sy-ed-sous' }, h('h3', {}, 'Les principaux postes hors équipe, année 1'),
          asBarres(postes.slice(0, 6).map((x) => ({ nom: x.nom, v: x.v, sous: x.n > 1 ? `${x.n} lignes` : null })), { format: (v) => eurC(v), periode: `Coûts hors équipe · ${periodeAnnee(0, debut)}` })) : null,
        lignes.length ? asTableau(['Ligne', 'Poste', 'Nature', 'Année 1', 'Année 5'], [...lignes].sort((a, b) => b.v - a.v).map((l) => [
          l.nom, l.poste.nom, l.nature === 'variable' ? 'Suit les ventes' : 'Fixe', euro(l.v), euro(lignesDeCouts(s, r, 4).find((z) => z.nom === l.nom)?.v || 0),
        ])) : null,
      ],
      pourquoiTexte: POURQUOI.poste,
      lien: { label: 'Les charges', go: { route: 'achats', view: 'charges', anchor: 'charges' } },
    }, navigate))
  }

  /* 5 — Équipe et masse salariale */
  {
    const team = (s.team || []).filter((m) => m.enabled !== false)
    const serieDe = (m) => (r.payroll?.byMember || []).find((b) => b.id === m.id)?.series
    const parAnS = (serie, y) => (serie || []).slice(y * 12, y * 12 + 12).reduce((a, v) => a + n(v), 0)
    const hc = (m) => n(r.payroll?.headcount?.[m])
    const masse = p.payroll.map(n)
    const ratio = ANS.map((y) => tauxDe(masse[y], ca[y]))
    const bm = SECTORS[s.meta?.sectorKey]?.benchmarks?.payrollRatio
    const RE_F = new RegExp('fondat|dirigeant|gérant|président|associé', 'i')
    const fondateurs = team.filter((m) => ['tns', 'dirigeant', 'micro'].includes(m.contractType) || RE_F.test(m.role || ''))
    const brutF = fondateurs.reduce((t, m) => t + n(m.monthlyGross) * Math.max(1, n(m.count) || 1), 0)
    parts.push(partie({
      cle: 'equipe',
      titre: masse[0] > 0 ? `${num(hc(11), 0)} personne${hc(11) > 1 ? 's' : ''}, ${eurC(masse[0])} de masse salariale en année 1` : 'Aucune rémunération prévue en année 1',
      dit: [
        ratio[0] !== null ? `L’équipe pèse ${pct(ratio[0], 0)} du chiffre d’affaires en année 1, ${ratio[4] !== null ? `${pct(ratio[4], 0)} en année 5` : ''}.` : null,
        bm && ratio[2] !== null ? `Dans ce métier, ce ratio se situe habituellement entre ${pct(bm[0], 0)} et ${pct(bm[1], 0)}.` : null,
      ].filter(Boolean).join(' ') || null,
      chiffres: [
        { l: 'Effectif', v: `${num(hc(11), 0)} → ${num(hc(59), 0)}`, note: 'En fin d’année 1, puis en fin d’année 5.' },
        { l: 'Masse salariale, année 1', v: eurC(masse[0]), note: 'Coût employeur : salaires bruts et cotisations patronales.' },
        { l: 'Rémunération des fondateurs', v: brutF > 0 ? `${euro(brutF)} brut/mois` : 'Aucune', ton: brutF > 0 ? '' : 'bad' },
      ],
      dessin: team.length ? asBarres(team.map((m) => ({ nom: `${m.role || 'Poste'}${n(m.count) > 1 ? ` ×${m.count}` : ''}`, v: parAnS(serieDe(m), 1) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 6), {
        format: (v) => `${eurC(v)}/an`, periode: `Coût employeur · ${periodeAnnee(1, debut)}`,
      }) : null,
      apres: [
        team.length ? asTableau(['Poste', 'Contrat', 'Brut mensuel', 'Arrivée', 'Coût employeur A1', 'Coût employeur A5'], team.map((m) => [
          `${m.role || 'Poste'}${fondateurs.includes(m) ? ' — fondateur' : ''}`, m.contractType || '—', euro(n(m.monthlyGross)), monthLabel(n(m.startMonth), debut),
          euro(parAnS(serieDe(m), 0)), euro(parAnS(serieDe(m), 4)),
        ])) : null,
        asTableau(tetes(''), [
          ['Masse salariale', ...masse.map((v) => euro(v))],
          ['Part du chiffre d’affaires', ...ratio.map((v) => (v === null ? '—' : pct(v, 0)))],
          ['Effectif en fin d’année', ...ANS.map((y) => num(hc(y * 12 + 11), 0))],
        ]),
      ],
      pourquoiTexte: POURQUOI.remuneration,
      lien: { label: 'L’équipe', go: { route: 'equipe', view: 'postes', anchor: 'equipe' } },
    }, navigate))
  }

  /* 6 — Trésorerie */
  const conso = consommation(s, r)
  {
    const bal = r.cash.balance.map(n)
    const bas = k.cashLow?.month ?? 0
    const vBas = bal[bas]
    const sousZero = k.firstNegativeMonth ?? null
    const remonte = vBas < 0 ? bal.findIndex((v, m) => m > bas && v >= 0) : -1
    const negatifs = bal.filter((v) => v < 0).length
    parts.push(partie({
      cle: 'treso',
      titre: vBas >= 0 ? `La trésorerie ne passe jamais sous zéro ; point bas à ${eurC(vBas)}` : `Point bas en ${monthLabel(bas, debut)}, à ${eurC(vBas)}`,
      dit: 'Être rentable et avoir de la trésorerie sont deux choses différentes. Le résultat compte ce qui est vendu et dépensé ; la trésorerie, ce qui est encaissé et payé, et quand.',
      chiffres: [
        { l: 'Cash minimum', v: eurC(vBas), ton: vBas < 0 ? 'bad' : prudence ? '' : 'good', note: monthLabel(bas, debut) },
        { l: 'Mois sous zéro', v: String(negatifs), ton: negatifs ? 'bad' : '', note: sousZero !== null ? `Dès ${monthLabel(sousZero, debut)}${remonte >= 0 ? `, jusqu’à ${monthLabel(remonte - 1, debut)}` : ''}.` : 'Aucun.' },
        { l: 'Fin d’année 5', v: eurC(n(r.cash.yearEnd[4])) },
      ],
      dessin: courbeTreso(bal, debut, { bas, sousZero, remonte: remonte >= 0 ? remonte : null }),
      apres: [asTableau(tetes(''), [
        ['Trésorerie en début d’année', ...ANS.map((y) => euro(y === 0 ? n(conso.parts.depart) : n(r.cash.yearEnd[y - 1])))],
        ['Activité et investissements', ...conso.activiteAn.map((v) => euro(v, { sign: true }))],
        ['Financement', ...ANS.map((y) => euro(n(r.cash.yearEnd[y]) - (y === 0 ? n(conso.parts.depart) : n(r.cash.yearEnd[y - 1])) - conso.activiteAn[y], { sign: true }))],
        ['Trésorerie en fin d’année', ...ANS.map((y) => euro(n(r.cash.yearEnd[y])))],
        ['BFR en fin d’année', ...ANS.map((y) => euro(n(r.bfr?.total?.[y * 12 + 11])))],
      ])],
      pourquoiTexte: POURQUOI.cash,
      lien: { label: 'Le tableau de trésorerie', go: { route: 'resultats' } },
    }, navigate))
  }

  /* 7 — Financement */
  {
    const f = s.financing || {}
    const x = conso.parts
    const besoin = n(k.fundingNeed)
    const quand = monthLabel(conso.mois, debut)
    const bank = lignesBanquier(r)
    const somme2 = (xs) => (xs || []).reduce((a, e) => a + n(e?.amount), 0)
    parts.push(partie({
      cle: 'finance',
      titre: besoin > 0 ? `Il manque ${euro(besoin)} au point bas, en ${quand}` : 'Le plan est financé jusqu’au bout',
      dit: conso.besoin > 0
        ? `Le business consomme ${eurC(conso.besoin)} jusqu’à son point bas. Les ressources prévues en couvrent ${eurC(Math.min(conso.besoin, conso.ressources))}.${besoin > 0 ? ` Il faut donc financer ${euro(besoin)}.` : ''}`
        : 'Les ventes financent l’activité dès le départ.',
      chiffres: [
        { l: 'Besoin total', v: eurC(Math.max(0, conso.besoin)), note: 'Ce que l’activité consomme avant de se financer elle-même.' },
        { l: 'Ressources prévues', v: eurC(conso.ressources), note: `Versées avant ${quand}.` },
        { l: 'Manque', v: euro(besoin), ton: besoin > 0 ? 'bad' : prudence ? '' : 'good', note: besoin > 0 ? `${eurC(Math.ceil((besoin * 1.2) / 1000) * 1000)} avec 20 % de marge de sécurité.` : 'Rien à trouver.' },
      ],
      dessin: conso.besoin > 0 ? asCascade([
        { type: 'depart', l: 'Besoin total', v: conso.besoin },
        x.depart ? { l: 'Trésorerie déjà disponible', v: -x.depart, ton: 'couvre' } : null,
        x.fondateurs ? { l: 'Apport des fondateurs', v: -x.fondateurs, ton: 'couvre' } : null,
        x.dette ? { l: 'Dette', v: -x.dette, ton: x.dette > 0 ? 'couvre' : null } : null,
        x.subventions ? { l: 'Subventions et avances', v: -x.subventions, ton: 'couvre' } : null,
        x.levee ? { l: 'Levée de fonds', v: -x.levee, ton: 'couvre' } : null,
        { type: 'total', l: besoin > 0 ? 'Manque' : 'Marge au point bas', ton: besoin > 0 ? 'manque' : 'total' },
      ], `Au point bas · ${quand}`) : null,
      apres: [
        asTableau(['Ressource', 'Montant', 'Versée'], [
          n(f.openingCash) > 0 ? ['Trésorerie de départ', euro(n(f.openingCash)), monthLabel(0, debut)] : null,
          ...(f.equityFounders || []).map((e) => ['Apport des fondateurs', euro(n(e.amount)), monthLabel(n(e.month), debut)]),
          ...(f.honourLoans || []).map((e) => ['Prêt d’honneur', euro(n(e.amount)), monthLabel(n(e.month), debut)]),
          ...(f.loans || []).map((e) => ['Prêt bancaire', euro(n(e.amount)), monthLabel(n(e.month), debut)]),
          ...(f.equityInvestors || []).map((e) => ['Levée de fonds', euro(n(e.amount)), monthLabel(n(e.month), debut)]),
          ...(f.grants || []).map((e) => ['Subvention', euro(n(e.amount)), monthLabel(n(e.month), debut)]),
          ...(f.advances || []).map((e) => ['Avance remboursable', euro(n(e.amount)), monthLabel(n(e.month), debut)]),
          ...(f.shareholderLoans || []).map((e) => ['Compte courant d’associé', euro(n(e.amount)), monthLabel(n(e.month), debut)]),
        ]),
        somme2(f.loans) > 0 ? h('ul', { class: 'as-bk' }, ...bank.map((l) => h('li', { class: `as-bk-ligne is-${l.etat}` },
          h('span', { class: 'as-bk-etat' }, l.etat === 'ok' ? 'Validé' : l.etat === 'juste' ? 'Juste' : l.etat === 'revoir' ? 'À revoir' : '—'),
          h('span', { class: 'as-bk-titre' }, l.titre), h('b', { class: 'as-bk-val' }, l.valeur)))) : null,
      ],
      pourquoiTexte: POURQUOI.manque,
      lien: { label: 'Le financement', go: { route: 'financement', view: 'sources', anchor: 'sources' } },
    }, navigate))
  }
  return parts
}

/** Ce qui ferait bouger le plan : chaque hypothèse rejouée seule, par le moteur. */
function risquesDetail(s, r) {
  const offresPlan = lesOffres(s, r).sort((a, b) => b.ca[0] - a.ca[0])
  const sens = sensibilites(s, r, offresPlan[0] || null).sort((a, b) => b.dBesoin - a.dBesoin || a.dNet - b.dNet)
  const pieges = (SECTORS[s.meta?.sectorKey]?.traps || []).slice(0, 3)
  if (!sens.length && !pieges.length) return null
  return h('div', { class: 'sy-ed-risques' },
    sens.length ? h('div', { class: 'sy-ed-sous' },
      h('h3', {}, 'Ce qui ferait bouger le plan'),
      h('p', { class: 'sy-ed-note' }, 'Chaque hypothèse est modifiée seule, tout le reste égal ; le moteur recalcule la paie, la TVA, l’impôt et la trésorerie.'),
      asTableau(['Hypothèse', 'Dans le plan', 'Test', 'Besoin de financement', 'Écart', 'Résultat net A3', 'Écart'], sens.map((x) => [
        x.nom, x.plan, x.test, euro(x.besoin), euro(x.dBesoin, { sign: true }), euro(x.net), euro(x.dNet, { sign: true }),
      ]))) : null,
    pieges.length ? h('div', { class: 'sy-ed-sous' },
      h('h3', {}, 'Les pièges propres au métier'),
      h('ul', { class: 'sy-ed-pieges' }, ...pieges.map((t) => h('li', {}, h('b', {}, t.title), ' — ', t.body)))) : null,
  )
}

/* ───────────────────────────── 8. Les hypothèses ───────────────────────────── */

/**
 * Les hypothèses du plan, et ce qui les justifie.
 *
 * Tout ce que le détail explique découle d'une poignée de choix : un prix, un
 * point de départ, une pente, ce qu'on garde sur chaque vente, ce que coûte
 * l'équipe, le temps que les clients mettent à payer, l'argent réuni. Les
 * voici, avec leur valeur exacte et ce qui les fonde : le repère du métier et
 * sa source quand il existe, et sinon ce qu'il faudra apporter pour les
 * défendre. Une hypothèse hors des repères n'est pas fausse ; elle demande
 * une preuve.
 */
const majuscule = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)
function hypotheses(r, s, navigate) {
  const p = r.pnl, k = r.kpis
  const n = (v) => Number(v) || 0
  const bm = SECTORS[s.meta?.sectorKey]?.benchmarks || {}
  const src = mentionCourte(s.meta?.sectorKey)
  const offres = (s.activities || []).filter((a) => n(a.unitPrice) > 0 || n(a.recurringPrice) > 0)
  const a = offres[0]
  const f = s.financing || {}
  const somme = (xs) => (xs || []).reduce((t, x) => t + n(x?.amount), 0)
  const ca3 = n(p.revenue[2])
  const fourchette = (b, fmt) => `${fmt(b[0])} – ${fmt(b[1])}`
  // Situer une valeur dans la fourchette du métier : dedans, au-dessus, en dessous.
  const situer = (v, b, fmt, { plusHaut = 'au-dessus', plusBas = 'en dessous' } = {}) => {
    if (!b) return null
    const rep = `repère du métier ${fourchette(b, fmt)} (${src})`
    if (v < b[0]) return { etat: 'watch', j: `${plusBas.charAt(0).toUpperCase()}${plusBas.slice(1)} du ${rep} : à justifier.` }
    if (v > b[1]) return { etat: 'watch', j: `${plusHaut.charAt(0).toUpperCase()}${plusHaut.slice(1)} du ${rep} : à justifier.` }
    return { etat: 'ok', j: `Dans le ${rep}.` }
  }
  const lignes = []

  if (a) {
    const rec = n(a.recurringPrice) > 0
    const prix = rec ? n(a.recurringPrice) : n(a.unitPrice)
    const unite = uniteOffre(s, a)
    const panier = !rec && bm.ticket ? situer(prix, bm.ticket, (v) => euro(v), { plusHaut: 'au-dessus', plusBas: 'en dessous' }) : null
    lignes.push({
      h: `Prix de « ${a.name || 'l’offre principale'} »`, v: rec ? `${euro(prix)} par mois HT` : `${euro(prix)} HT par ${unite.one}`,
      etat: panier?.etat || 'none',
      j: panier ? panier.j.replace('repère du métier', 'panier moyen du métier') : 'Fixé par toi : à appuyer sur les prix de la concurrence, des devis signés ou une première vente.',
    })
    const v = a.volumes || {}
    if (v.mode === 'manual') {
      lignes.push({ h: 'Volumes', v: 'saisis mois par mois', etat: 'none', j: 'À rattacher à ce qui les fonde : carnet de commandes, capacité de production, contrats.' })
    } else {
      lignes.push({
        h: 'Point de départ des ventes', v: `${num(n(v.startUnits))} ${n(v.startUnits) > 1 ? unite.many : unite.one} au mois ${n(v.launchMonth) + 1}`,
        etat: 'none', j: 'Saisi par toi : à appuyer sur des précommandes, une liste d’attente, des lettres d’intention ou la capacité réelle.',
      })
      const campagnes = (s.marketing || []).filter((c) => c.enabled !== false)
      const budget = campagnes.reduce((t, c) => t + n(c.monthlyBudget), 0)
      lignes.push({
        h: 'Croissance des volumes', v: `${pct(n(v.monthlyGrowth), 1)} par mois${n(v.growthDecay) > 0 && n(v.growthDecay) < 1 ? `, ralentie de ${pct(1 - n(v.growthDecay), 0)} chaque mois` : ''}`,
        etat: campagnes.length ? 'ok' : 'watch',
        j: campagnes.length
          ? `Portée par ${campagnes.length} campagne${campagnes.length > 1 ? 's' : ''} : ${euro(budget)} par mois${k.cac ? `, soit ${euro(n(k.cac))} pour acquérir un client` : ''}.`
          : 'Aucune campagne chiffrée : la pente repose sur le bouche-à-oreille et la prospection, à démontrer par les premiers mois de vente.',
      })
    }
    if (rec) {
      const attr = situer(n(a.churnMonthly), bm.churn, (x) => pct(x, 1), { plusHaut: 'au-dessus', plusBas: 'en dessous' })
      lignes.push({ h: 'Attrition des abonnés', v: `${pct(n(a.churnMonthly), 1)} par mois`, etat: attr?.etat || 'none',
        j: attr?.j || 'Saisie par toi : à mesurer sur les premiers abonnés, cohorte par cohorte.' })
    }
    const delai = n(a.paymentLag), acompte = n(a.deposit)
    lignes.push({
      h: 'Encaissement des ventes', v: `${delai === 0 ? 'comptant' : `à ${num(delai)} mois`}${acompte > 0 ? `, acompte de ${pct(acompte, 0)}` : ''}`,
      etat: 'none', j: 'Conditions de paiement saisies : elles déplacent le besoin de trésorerie, pas le résultat.',
    })
  }
  if (ca3 > 0) {
    const marge = n(k.marginRate?.[2])
    const m = situer(marge, bm.grossMargin, (x) => pct(x, 0))
    lignes.push({ h: 'Marge brute, année 3', v: pct(marge, 1), etat: m?.etat || 'none',
      j: m?.j || 'Découle de tes prix et de tes coûts de revient : à appuyer sur des devis fournisseurs.' })
    const masse = Math.abs(n(p.payroll[2])) / ca3
    const ms = masse <= 10 ? situer(masse, bm.payrollRatio, (x) => pct(x, 0)) : null
    lignes.push({ h: 'Masse salariale / chiffre d’affaires, année 3', v: masse <= 10 ? pct(masse, 1) : '—', etat: ms?.etat || 'none',
      j: ms?.j || 'Découle des postes et de leurs dates d’arrivée : chaque embauche doit suivre un palier de ventes.' })
  }
  const apports = n(f.openingCash) + somme(f.equityFounders)
  const dettes = somme(f.loans) + somme(f.honourLoans) + somme(f.shareholderLoans) + somme(f.advances)
  const leve = somme(f.equityInvestors)
  const aides = somme(f.grants)
  lignes.push({
    h: 'Financement réuni', v: euro(apports + dettes + leve + aides),
    etat: n(k.fundingNeed) > 0 ? 'watch' : 'ok',
    j: `${majuscule([apports ? `apports ${euro(apports)}` : null, dettes ? `emprunts ${euro(dettes)}` : null, leve ? `levée ${euro(leve)}` : null, aides ? `aides ${euro(aides)}` : null].filter(Boolean).join(', ')) || 'Rien de réuni'}. `
      + (n(k.fundingNeed) > 0 ? `Il manque ${euro(n(k.fundingNeed))} au point bas : un montant à couvrir par un accord écrit — offre de prêt, lettre d’intention.` : 'Suffisant pour ne jamais passer sous zéro : chaque montant reste à confirmer par écrit.'),
  })
  lignes.push({
    h: 'Fiscalité et cotisations', v: 'barèmes 2026',
    etat: 'ok', j: 'Impôt sur les sociétés, cotisations sociales, TVA et taxes locales appliqués par le moteur aux règles en vigueur — détail dans la page Méthode.',
  })

  const ETAT = { ok: 'Étayée', watch: 'À justifier', none: 'À documenter' }
  return h('section', { class: 'sy-hyp sy-act sy-chapitre sy-ed', id: 'sy-hypotheses' },
    numero(8, 'Hypothèses et risques'),
    h('div', { class: 'sy-sec-head' },
      h('div', {},
        h('h2', { class: 'sy-act-title' }, 'Les hypothèses du plan, et ce qui les justifie'),
        h('p', { class: 'sy-act-say' }, 'Chaque chiffre de ce détail découle de ces choix. Un repère du métier les situe quand il existe ; sinon, il faudra les défendre par une preuve — contrat, devis, historique, précommandes.'),
      ),
    ),
    h('div', { class: 'table-wrap' },
      h('table', { class: 'data sy-hyp-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Hypothèse'), h('th', {}, 'Valeur retenue'), h('th', {}, 'Ce qui la justifie'))),
        h('tbody', {}, ...lignes.map((l) => h('tr', {},
          h('td', {}, h('b', {}, l.h)),
          h('td', { class: 'num' }, l.v),
          h('td', {}, h('span', { class: `sy-hyp-etat is-${l.etat}` }, ETAT[l.etat]), ' ', l.j),
        ))),
      ),
    ),
    risquesDetail(s, r),
    h('button', { class: 'sy-btn is-line is-sm', onClick: () => goToGap({ route: 'methode' }, navigate) }, 'Voir la méthode et les sources →'),
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

/**
 * Les six chiffres qu'on doit connaître : le chiffre d'affaires, le résultat
 * net, la marge brute, le point mort, le cash minimum et le besoin de
 * financement. Posés juste après l'ouverture, en une rangée ; chaque partie
 * qui suit en explique un.
 */
function sixDuDetail(r, y) {
  const p = r.pnl, k = r.kpis
  const ca = n(p.revenue[y]), net = n(p.netResult[y])
  const mr = ca > 0 ? n(k.marginRate?.[y]) : null
  const pm = n(k.breakEven?.[y])
  const franchi = pm > 0 && ca >= pm
  // Pas franchi cette année : le mois où il le sera, s'il l'est un jour.
  const anPM = (k.breakEvenMonth || []).findIndex((m) => m)
  const notePM = franchi ? 'franchi cette année'
    : anPM > y ? `franchi en ${monthLabel(anPM * 12 + n(k.breakEvenMonth[anPM]) - 1, r.startDate)}` : 'pas franchi cette année'
  const besoin = n(k.fundingNeed)
  const C = (v) => euro(v, { compact: true })
  return [
    { label: 'Chiffre d’affaires', value: C(ca), note: `année ${y + 1}`, tone: 'pos', go: 'offre', help: 'chiffreAffaires', cible: 'ca' },
    { label: 'Résultat net', value: C(net), note: ca > 0 ? `${pct(net / ca, 1)} du chiffre d’affaires` : `année ${y + 1}`, tone: net >= 0 ? 'pos' : 'neg', go: 'resultats', help: 'resultatNet', cible: 'ca' },
    { label: 'Marge brute', value: mr === null ? '—' : pct(mr, 0), note: `${C(n(p.grossMargin[y]))} après les coûts directs`, tone: mr === null ? '' : mr >= 0.4 ? 'pos' : mr >= 0.15 ? 'warn' : 'neg', go: 'offre', help: 'margeBrute', cible: 'vente' },
    { label: 'Point mort', value: pm > 0 ? C(pm) : '—', note: notePM, tone: franchi ? 'pos' : 'warn', go: 'resultats', help: 'pointMort', cible: 'vente' },
    { label: 'Cash minimum', value: C(k.cashLow.value), note: `au plus bas en ${monthLabel(k.cashLow.month, r.startDate)}`, tone: k.cashLow.value < 0 ? 'neg' : 'pos', go: 'financement', help: 'tresorerie', cible: 'treso' },
    { label: 'Besoin de financement', value: besoin > 0 ? C(besoin) : 'Aucun', note: besoin > 0 ? `à réunir avant ${monthLabel(k.cashLow.month, r.startDate)}` : 'la trésorerie se suffit', tone: besoin > 0 ? 'warn' : 'pos', go: 'financement', help: 'besoinFinancement', cible: 'finance' },
  ]
}

function sixChiffres(r, s, y, choisir, navigate) {
  const figures = sixDuDetail(r, y)
  return h('section', { class: 'sy-figs sy-act is-compact', id: 'sy-chiffres' },
    h('div', { class: 'sy-sec-head' },
      h('div', {},
        h('h2', { class: 'sy-act-title' }, 'Les six chiffres à connaître par cœur'),
        h('p', { class: 'sy-act-say' }, 'Chacun est expliqué dans une partie ci-dessous. Clique sur un chiffre pour sa définition et pour aller à sa partie.'),
      ),
      anneeChips(y, choisir),
    ),
    h('div', { class: 'sy-figs-grid is-six' }, ...figures.map((f, i) => chiffre(f, i, navigate))),
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
          f.cible ? h('button', { class: 'sy-link', onClick: () => allerA(f.cible) }, `Lire la partie « ${PARTIES.find((x) => x.cle === f.cible)?.nom} » ↓`) : null,
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
  return h('section', { class: `sy-deep sy-act sy-chapitre ${etat.analyse ? 'is-open' : ''} ${neuve ? 'is-opening' : ''}`, id: 'sy-comptes' },
    numero(9, 'Analyse détaillée'),
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
 * l'EBE ; cliquer choisit l'exercice lu partout ailleurs.
 */
function cinqAns(r, y, choisir) {
  const p = r.pnl
  const k = r.kpis
  const series = [
    { cle: 'ca', nom: 'Chiffre d’affaires', vals: p.revenue },
    { cle: 'ebe', nom: 'EBE', vals: p.ebe },
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
    l('= EBE', p.ebe[y], true),
    n(p.amortisation[y]) ? l('− Amortissements', p.amortisation[y]) : null,
    n(p.badDebts?.[y]) ? l('− Pertes sur créances', p.badDebts[y]) : null,
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
    { nom: 'EBE', v: n(p.ebe[y]), solde: true },
    { nom: 'Amortissements', v: -Math.abs(n(p.amortisation[y])) },
    { nom: 'Impayés', v: -Math.abs(n(p.badDebts?.[y])) },
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
    { nom: 'Marge d’EBE', v: ca > 0 ? pct(n(k.ebeMargin[y])) : rien, dit: 'Ce que dégage l’exploitation' },
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

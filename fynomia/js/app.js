/**
 * Point d'entrée : charpente, navigation et rendu.
 *
 * Une seule source de vérité — le scénario du store. Chaque page est une
 * fonction pure qui produit un fragment de DOM à partir de cet état. Naviguer
 * ne perd rien : l'état survit aux changements de page comme aux rechargements.
 */

import { h, clear, setDrawerHost, setPanelHost, toast, euro, narrow } from './ui/dom.js'
import { GLOSSARY } from './ui/glossary.js'
import { installEffet, reposerEffet, decrire as decrireSaisie, retrouverSaisie } from './ui/effet.js'
import { renderMethode } from './ui/pages/methode.js'
import store from './state/store.js'
import { getPersona } from './ui/personas.js'

import { renderOnboarding } from './ui/pages/onboarding.js'
import { renderHome } from './ui/pages/home.js'
import { renderChat } from './ui/pages/chat.js'
import { renderDeck } from './ui/pages/deck.js'
import { installMotion, travel, takeTravel, armTravel } from './ui/motion.js'
import { coach, setCoachHost } from './ui/coach.js'
import { checklist } from './ui/checklist.js'
import { goToGap, settle } from './ui/spotlight.js'
import { renderDashboard } from './ui/pages/dashboard.js'
import { renderOffer } from './ui/pages/offer.js'
import { renderTeam } from './ui/pages/team.js'
import { renderCosts } from './ui/pages/costs.js'
import { renderFinancing } from './ui/pages/financing.js'
import { renderResults } from './ui/pages/results.js'
import { renderBusinessCase } from './ui/pages/businesscase.js'
import { renderSettings } from './ui/pages/settings.js'
import { renderProject } from './ui/pages/project.js'
import { renderSetup, resetSetup } from './ui/pages/setup.js'
import { renderReveal, revelationPermise } from './ui/pages/reveal.js'
import { journey, points } from './engine/journey.js'
import { buildState } from './engine/build.js'
import { cloud, onCloud, syncLabel } from './state/cloud.js'

/**
 * Les neuf modules.
 *
 * L'ordre suit la construction d'un prévisionnel, pas l'organigramme d'un
 * cabinet comptable : on pose le cadre, on décrit ce qu'on vend, ce que ça
 * coûte, qui le fait, avec quel argent — puis on lit ce que ça donne.
 *
 * Il n'y a plus de niveaux. Chaque module pose ses questions au premier degré
 * et range la profondeur derrière « affiner », là où elle sert. Personne n'a
 * à se déclarer débutant ou expert pour construire le même modèle.
 */
const PAGES = {
  projet: { no: '01', label: 'Projet', render: renderProject, build: true },
  offre: { no: '02', label: 'Offre & revenus', render: renderOffer, build: true },
  achats: { no: '03', label: 'Achats & coûts', render: renderCosts, build: true },
  equipe: { no: '04', label: 'Équipe', render: renderTeam, build: true },
  financement: { no: '05', label: 'Financement', render: renderFinancing, build: true },
  'tableau-de-bord': { no: '06', label: 'Tableau de bord', render: renderDashboard },
  resultats: { no: '07', label: 'États financiers', render: renderResults },
  'business-case': { no: '08', label: 'Business case', render: renderBusinessCase },
  reglages: { no: '09', label: 'Réglages', render: renderSettings },
  // Hors du rail : on y arrive depuis chaque repère « dans ton métier ».
  methode: { no: '—', label: 'Méthode', render: renderMethode },
}

// Les anciennes adresses restent valides : un lien enregistré ou un signet ne
// doit pas tomber à côté parce que le produit s'est réorganisé.
const ALIASES = {
  modele: 'projet',
  charges: 'achats',
  marketing: 'offre',
  clients: 'offre',
  compte: 'reglages',
  'mon-revenu': 'resultats',
  parcours: 'tableau-de-bord',
}

const GROUPS = [
  { title: 'Construire', keys: ['projet', 'offre', 'achats', 'equipe', 'financement'] },
  { title: 'Lire', keys: ['tableau-de-bord', 'resultats', 'business-case'] },
  { title: '', keys: ['reglages'] },
]

const root = document.getElementById('app')
let currentRoute = null

function route() {
  const hash = location.hash.replace(/^#\/?/, '') || ''
  return hash.split('?')[0]
}

/**
 * Le menu ne voyage pas.
 *
 * Le voyage — le fondu qui éloigne l'écran qu'on quitte et ramène l'autre — dit
 * qu'on parcourt un document. Il a sa place quand on suit un lien dans le texte
 * : « y aller », « voir les comptes ». Il n'en a aucune quand on clique dans le
 * menu, où l'on ne parcourt rien : on choisit une partie, et elle doit être là.
 * D'où ce drapeau, qui laisse le changement d'adresse se faire sèchement.
 */
let plain = false

function navigate(to, { move = true } = {}) {
  const next = to.startsWith('#') ? to : `#/${to}`
  // Cliquer sur le module où l'on se trouve déjà ne change pas l'adresse, donc
  // ne déclenche aucun événement : l'écran restait figé et le clic semblait
  // perdu. On redessine explicitement dans ce cas.
  if (location.hash === next) { render(); window.scrollTo(0, 0); return }
  // Tout déplacement vers un autre module est un voyage.
  //
  // Seul « Y aller » l'armait, parce que lui seul passait par `goToGap`. Un
  // clic sur l'EBE, sur le rail, sur « Les comptes » changeait d'écran
  // sans rien montrer du trajet — la même action se sentait ou non selon le
  // bouton qui la déclenchait. C'est armé ici, une fois, pour tous.
  if (move) armTravel('page'); else plain = true
  location.hash = next
}

// La route courante, retenue pour que la barre du haut puisse annoncer ce que
// chaque profondeur ajoute à cette page-ci.
let currentKey = ''

/**
 * Aucun redessin ne part sous le doigt de quelqu'un.
 *
 * C'est la cause du « pas toujours de temps réel », et c'est un défaut de
 * synchronisation, pas de calcul. Sortir d'un champ modifié enregistre la
 * valeur et reconstruit toute l'interface — or la sortie de champ est
 * provoquée par l'appui du clic suivant. L'interface se reconstruisait donc
 * entre l'appui et le relâchement, le bouton visé n'existait plus quand le
 * clic arrivait, et le clic était perdu. Mesuré : le premier clic dans le
 * menu, après avoir changé un prix, ne changeait pas de page ; il en fallait
 * un second. Vu du fondateur : « je modifie une valeur, je clique ailleurs,
 * rien ne bouge ».
 *
 * Le modèle, lui, était juste : la valeur était bien enregistrée et
 * recalculée. C'est l'écran qui ne suivait pas.
 *
 * Un geste en cours suspend donc le redessin. Ce qui arrive entre l'appui et
 * le clic est mis en attente et rejoué juste après, une fois le clic
 * distribué et les gestionnaires de la page exécutés. Le filet de sécurité
 * couvre le geste qui n'aboutit pas — un doigt qui sort de la fenêtre.
 */
let holding = false
let heldScroll = false
let release = null

const flush = () => {
  clearTimeout(release)
  release = null
  holding = false
  if (heldScroll === false) return
  const opts = heldScroll
  heldScroll = false
  render(opts)
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => {
    // Un curseur qu'on fait glisser est l'exception : son geste dure, et tout
    // l'intérêt est de voir les chiffres bouger pendant qu'on le tire. Il ne
    // fait disparaître aucun bouton — on ne quitte pas le curseur — donc rien
    // ne justifie de suspendre le redessin.
    if (e.target && e.target.closest && e.target.closest('input[type=range]')) return
    holding = true
    clearTimeout(release)
    // Un geste qui ne se termine jamais ne doit pas geler l'écran.
    release = setTimeout(flush, 600)
  }, true)
  // On relâche après le clic, pas au relâchement du doigt : c'est le clic qui
  // porte l'action, et il doit trouver les nœuds encore en place.
  document.addEventListener('click', flush, false)
  // Ce filet-là est le seul qui ne puisse pas être coupé.
  //
  // L'écoute ci-dessus est en phase de remontée : un gestionnaire qui appelle
  // `stopPropagation` — l'interrupteur d'une ligne, une carte cliquable —
  // empêche le clic d'atteindre le document, et le redessin restait suspendu
  // jusqu'au délai de secours. Une seconde et demie pendant laquelle les
  // chiffres ne bougeaient plus : exactement ce qu'on reprochait à l'outil.
  //
  // Le relâchement du pointeur, lui, est capté à la descente : personne ne
  // l'intercepte. On y programme une tâche qui s'exécutera après la fin du
  // clic, quoi qu'il arrive en chemin.
  document.addEventListener('pointerup', () => setTimeout(flush, 0), true)
  // Au clavier, il n'y a pas de pointeur : le relâchement d'une touche joue
  // le même rôle.
  document.addEventListener('keyup', () => setTimeout(flush, 0), true)
  // Tab déplace le focus : un redessin qui tombe pendant ce déplacement —
  // la sortie d'un champ modifié en déclenche un — remplace le champ de
  // départ avant que le navigateur ait trouvé le suivant, et le curseur
  // tombe dans le vide. On retient le redessin jusqu'au relâchement, comme
  // pour un clic ; le focus est alors posé, et on sait où le rendre.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return
    holding = true
    clearTimeout(release)
    release = setTimeout(flush, 600)
  }, true)
  document.addEventListener('pointercancel', flush, true)
  // La sortie d'un champ annonce ce qui y a été tapé en silence.
  //
  // Après le passage du focus, pas avant : au moment de « focusout », le
  // champ suivant n'a pas encore le focus, et le redessin ne saurait pas où
  // le rendre. Si un doigt est posé sur un bouton, le rendu attend son clic
  // comme n'importe quel autre.
  document.addEventListener('focusout', () => setTimeout(() => store.flushSilent(), 0), true)
}

/**
 * Où était le curseur, pour l'y remettre après un redessin.
 *
 * Seuls les champs portant un `data-field-key` retrouvaient leur focus ; les
 * autres le perdaient à chaque redessin — passer d'un champ au suivant avec
 * Tab renvoyait le curseur nulle part. On retient aussi sa position parmi les
 * champs de la page, et la sélection du texte.
 */
const CHAMPS = 'input:not([type=hidden]), textarea, select, button, a[href], [tabindex]:not([tabindex="-1"])'
function curseur() {
  const el = document.activeElement
  // Tab peut poser le focus sur un bouton (« Modifier ») autant que sur un
  // champ : on retient l'un comme l'autre, par sa place dans la page.
  if (!el || !el.matches || !el.matches(CHAMPS) || !root.contains(el)) return null
  const tous = [...root.querySelectorAll(CHAMPS)]
  let sel = null
  try { sel = [el.selectionStart, el.selectionEnd] } catch { sel = null }
  // Par son identité d'abord — la page, la ligne, le libellé — puis, à
  // défaut, par sa place : un redessin qui ajoute une note au-dessus du champ
  // décalerait sinon le curseur d'un cran.
  let desc = null
  try { desc = decrireSaisie(el) } catch { desc = null }
  return { index: tous.indexOf(el), tag: el.tagName, sel, desc }
}
function rendreCurseur(c) {
  if (!c) return
  let el = null
  try { el = c.desc ? retrouverSaisie(c.desc) : null } catch { el = null }
  if (!el && c.index >= 0) el = [...root.querySelectorAll(CHAMPS)][c.index]
  if (!el || el.tagName !== c.tag || document.activeElement === el) return
  try {
    el.focus({ preventScroll: true })
    if (c.sel && c.sel[0] !== null && typeof el.setSelectionRange === 'function') el.setSelectionRange(c.sel[0], c.sel[1])
  } catch { /* un champ qui refuse la sélection (nombre) garde au moins le focus */ }
}

/**
 * Le calcul a échoué : il faut le dire, fort.
 *
 * Quand le moteur lève, le résultat précédent reste en mémoire — sans quoi
 * l'écran se viderait d'un coup. Mais il reste aussi à l'écran, inchangé, et
 * l'outil donne alors le pire des signaux : des chiffres qui ne bougent plus
 * alors qu'on saisit. Ce bandeau dit que ce qu'on lit ne correspond plus à ce
 * qu'on a tapé, ce qui est la seule chose honnête à afficher dans cet état.
 */
function calcFail() {
  if (!store.computeError) return null
  return h('div', { class: 'calcfail', role: 'alert' },
    h('strong', {}, 'Les chiffres affichés ne sont plus à jour.'),
    h('span', {}, `Le calcul a échoué sur ta dernière saisie : ${String(store.computeError.message || store.computeError)}. Ce que tu vois date de la dernière version qui tenait. Annule la dernière modification, ou corrige la valeur en cause.`),
    h('button', {
      class: 'btn btn-sm', onClick: () => { if (store.undo()) render() },
    }, 'Annuler la dernière modification'),
  )
}

function render({ preserveScroll = false } = {}) {
  if (holding) {
    // On retient la demande la plus exigeante : si l'une d'elles veut garder
    // la position, on la garde.
    heldScroll = heldScroll === false ? { preserveScroll } : { preserveScroll: heldScroll.preserveScroll || preserveScroll }
    return
  }
  const key = route()
  currentKey = key
  const scrollY = preserveScroll ? window.scrollY : 0
  const place = preserveScroll ? curseur() : null
  currentRoute = key

  // On n'impose l'accueil que s'il n'y a rien à montrer : avec un scénario
  // d'exemple chargé, l'outil s'ouvre directement en fonctionnement.
  // Le parcours guidé vit hors de la charpente : pas de rail, pas d'onglets,
  // rien d'autre que la question en cours. C'est ce qui le rend lisible.
  if (key === 'creer') {
    clear(root).appendChild(renderSetup(navigate, render))
    document.title = 'Fynomia — Ton business plan'
    return
  }

  // Au sortir du parcours, une page plein écran, vue une seule fois : le
  // business qui prend forme. Y revenir ensuite mène au tableau de bord.
  if (key === 'ton-business' && store.scenario) {
    if (!revelationPermise()) { navigate('#/tableau-de-bord'); return }
    clear(root).appendChild(renderReveal(navigate))
    document.title = `${store.scenario.meta.company || store.scenario.meta.name} — prend forme`
    window.scrollTo(0, 0)
    return
  }

  // La présentation occupe tout l'écran : on ne défend pas un plan avec un
  // rail de navigation et un fil d'Ariane à côté.
  if (key === 'presentation' && store.scenario) {
    clear(root).appendChild(renderDeck(navigate, () => render()))
    document.title = `${store.scenario.meta.name} — Présentation`
    return
  }

  // La conversation vit hors de la charpente, comme le parcours : une question,
  // une réponse, rien d'autre à l'écran.
  if (key === 'discuter') {
    clear(root).appendChild(renderChat(navigate, () => render()))
    document.title = 'Fynomia — Ton business plan'
    return
  }

  // La page d'accueil du site : ce que fait Fynomia, avant qu'on demande
  // quoi que ce soit. L'adresse racine y mène ; l'outil est à un clic.
  if (key === 'accueil' || (!store.scenario && key === '')) {
    clear(root).appendChild(renderHome(navigate))
    document.title = 'Fynomia — Le business plan calculé'
    window.scrollTo(0, 0)
    return
  }

  if (!store.scenario || key === 'demarrer' || key === '') {
    if (!store.scenario) { resetSetup(); navigate('#/creer'); return }
    clear(root).appendChild(renderOnboarding(navigate))
    document.title = 'Fynomia — Business plan'
    window.scrollTo(0, 0)
    return
  }

  if (ALIASES[key]) { navigate(`#/${ALIASES[key]}`); return }
  const page = PAGES[key] || PAGES['tableau-de-bord']
  if (!PAGES[key]) { navigate('#/tableau-de-bord'); return }

  // Une page se redessine des dizaines de fois pendant la saisie — un clic sur
  // un pavé, une case cochée, une ligne ajoutée. Si ce redessin remonte en haut
  // de page, on perd l'endroit où l'on travaillait. Seule une vraie navigation
  // remet l'écran à zéro.
  const refresh = (opts) => render({ preserveScroll: true, ...(opts || {}) })
  const main = h('div', { class: 'main' }, topbar(page, key), calcFail(), page.render(navigate, refresh))
  // Construire d'abord, remplacer ensuite : la transition de vue photographie
  // l'écran actuel, et tout ce qui se calcule pendant qu'elle est ouverte
  // allonge le figement.
  const shell = h('div', { class: 'shell' },
    // Le bandeau de droite est parti : sur un écran d'ordinateur portable, il
    // volait deux cent cinquante pixels à la page pour répéter ce que la barre
    // de progression en haut et les pastilles du rail disent déjà. La page
    // respire, et c'est elle qu'on est venu lire.
    // Le bandeau « depuis le repère » a disparu : il annonçait des écarts
    // par rapport à un instant que personne n'avait posé, avec un bouton
    // « nouveau repère » dont l'objet ne se devinait pas. Un tableau de bord
    // dit où l'on est ; il n'a pas à commenter le chemin sans qu'on demande.
    rail(key), main, tabbar(key), coach(navigate))
  // Le projecteur lit le DOM d'arrivée : il doit donc passer après le
  // remplacement, y compris quand celui-ci est différé par la transition.
  const swap = () => {
    clear(root).appendChild(shell)
    if (preserveScroll) {
      window.scrollTo(0, scrollY)
      // Le focus et le curseur, là où ils étaient : même champ, même position.
      rendreCurseur(place)
    } else {
      window.scrollTo(0, 0)
    }
    settle()
    reposerEffet()
  }
  const mode = takeTravel()
  if (mode) travel(swap, mode); else swap()
  document.title = `${page.label} — ${store.scenario.meta.name}`
}



function rail(active) {
  const b = buildState(store.scenario)
  const doneByPage = Object.fromEntries(b.bricks.map((x) => [x.page, x.done]))

  const el = h('nav', { class: 'rail', id: 'rail' },
    // Le logo est cliquable : il ramène à la page qui explique l'outil.
    h('button', { class: 'rail-brand', onClick: () => navigate('#/accueil'), title: 'Accueil Fynomia' },
      h('span', { class: 'rail-mark' }, 'FYNOMIA'),
      h('span', { class: 'rail-year' }, 'FR / 2026'),
    ),
    h('div', { class: 'rail-claim' },
      h('b', {}, 'Le business plan, sans la couche de vernis.'),
      'On construit le mod\u00e8le. Les \u00e9tats financiers suivent.'),

    ...GROUPS.flatMap((group) => [
      group.title ? h('div', { class: 'rail-section' }, group.title) : null,
      ...group.keys.map((k) => {
        const p = PAGES[k]
        const warn = store.issues.some((i) => i.page === k && i.level !== 'info')
        const done = p.build ? !!doneByPage[k] : false
        return h('button', {
          class: `rail-link ${active === k ? 'active' : ''} ${done ? 'done' : ''}`,
          onClick: () => { navigate(`#/${k}`, { move: false }); document.getElementById('rail')?.classList.remove('open') },
        },
          h('span', { class: 'rail-no' }, p.no),
          h('span', {}, p.label),
          warn ? h('span', { class: 'badge-dot' }) : p.build ? h('span', { class: 'rail-tick' }, done ? '\u25cf' : '\u25cb') : null,
        )
      }),
    ]),

    h('div', { class: 'rail-foot' },
      h('button', { class: 'rail-link', onClick: () => { resetSetup(); navigate('#/creer', { move: false }) } },
        h('span', { class: 'rail-no' }, '\uff0b'), h('span', {}, 'Nouveau plan')),
      h('button', {
        class: 'rail-account', onClick: () => { navigate('#/reglages', { move: false }); document.getElementById('rail')?.classList.remove('open') },
      },
        h('span', { class: 'rail-account-name' }, cloud.user?.name || 'Mon compte'),
        h('span', { class: 'rail-account-sync' }, syncLabel()),
      ),
    ),
  )
  return el
}

function topbar(page, key) {
  const canUndo = store.canUndo(), canRedo = store.canRedo()
  const c = checklist(store.scenario)
  return h('header', { class: 'topbar' },
    // Le tout premier pixel de l'\u00e9cran : le trait d'avancement. Il ne demande
    // rien, il ne se ferme pas, il est simplement l\u00e0 \u00e0 chaque page.
    h('div', { class: 'topline', 'aria-hidden': 'true' },
      h('i', { style: { width: `${Math.round(c.ratio * 100)}%` } })),
    h('button', {
      class: 'btn btn-sm btn-ghost mobile-only', 'aria-label': 'Menu',
      onClick: () => document.getElementById('rail')?.classList.toggle('open'),
    }, '\u2630'),
    h('div', { class: 'crumb' },
      `${store.scenario.meta.company || store.scenario.meta.name} / ${page.label}`),
    h('span', { class: 'spacer' }),
    progressTop(c),
    h('button', { class: 'btn btn-sm btn-ghost desktop-only', disabled: !canUndo, title: 'Annuler', onClick: () => { store.undo(); render() } }, '\u21b6'),
    h('button', { class: 'btn btn-sm btn-ghost desktop-only', disabled: !canRedo, title: 'R\u00e9tablir', onClick: () => { store.redo(); render() } }, '\u21b7'),
    key !== 'tableau-de-bord' ? h('button', {
      class: 'btn btn-sm btn-go btn-pill desktop-only', onClick: () => navigate('#/tableau-de-bord'),
    }, 'Voir la synth\u00e8se') : null,
  )
}

/**
 * L'avancement, tout en haut, et pas en résumé.
 *
 * « Étape 4 sur 12 » mesure le remplissage d'un formulaire, et une barre lisse
 * ne dit rien de ce qu'il reste à faire. Ici, une encoche par ligne du dossier :
 * dix-neuf, groupées en trois paliers. Pleines, ce qui est posé ; creuses, ce
 * qui attend ; en pointillé, ce qu'on a remis à plus tard. Le fondateur voit
 * d'un coup d'œil le chemin parcouru et celui qui reste, sans rien ouvrir.
 *
 * Chaque encoche est un bouton : elle emmène au champ exact. Le compte, lui,
 * ouvre la liste complète sur le tableau de bord.
 */
function progressTop(c) {
  const pct = Math.round(c.ratio * 100)
  const left = c.total - c.done
  return h('div', { class: `topprog ${left === 0 ? 'is-full' : ''}` },
    h('div', { class: 'topprog-steps', role: 'group', 'aria-label': 'Avancement du dossier' },
      ...c.groups.map((g) => h('div', { class: `topprog-tier is-${g.key}` },
        ...g.items.map((it) => h('button', {
          class: `topprog-step ${it.done ? 'is-done' : ''} ${it.later ? 'is-later' : ''}`,
          'aria-label': it.label,
          // Le libellé se lit au survol sans infobulle système : une étiquette
          // posée sous la barre, qui apparaît et disparaît doucement.
          'data-label': it.done ? `${it.label} · posé` : it.later ? `${it.label} · plus tard` : it.label,
          title: it.done ? `${it.label} \u2014 pos\u00e9`
            : it.later ? `${it.label} \u2014 remis \u00e0 plus tard. ${it.why}`
              : `${it.label} \u2014 ${it.why}`,
          onClick: (e) => goToGap(it.go, navigate, e.currentTarget),
        })),
      )),
    ),
    h('button', {
      class: 'topprog-score',
      title: left > 0
        ? `${left} ligne${left > 1 ? 's' : ''} encore \u00e0 poser sur ${c.total}. Voir la liste.`
        : 'Dossier complet.',
      onClick: () => navigate('#/tableau-de-bord'),
    },
      h('span', { class: 'topprog-done num' }, `${c.done}`),
      h('span', { class: 'topprog-of num' }, `/${c.total}`),
      h('span', { class: 'topprog-pct num' }, `${pct} %`),
    ),
  )
}

function tabbar(active) {
  const allowed = getPersona(store.persona).pages
  const keys = Object.keys(PAGES).filter((k) => PAGES[k].tab && PAGES[k].levels.includes(store.level) && allowed.includes(k))
  if (allowed.includes('business-case')) keys.push('business-case')
  return h('nav', { class: 'tabbar' },
    ...keys.map((k) => h('button', {
      class: `tab ${active === k ? 'active' : ''}`,
      // La barre du bas est le menu du téléphone : même règle que le rail.
      onClick: () => navigate(`#/${k}`, { move: false }),
    }, h('span', { class: 'ico' }, PAGES[k].icon), h('span', {}, shortLabel(PAGES[k].label)))),
  )
}

const shortLabel = (l) => ({ 'Tableau de bord': 'Bilan', 'Mon modèle': 'Modèle',
  'Offre et clients': 'Clients', 'États financiers': 'Comptes', 'Ce que je touche': 'Ma paie',
  'Business case': 'Dossier' }[l] || l)

// ───────────────────────────── Tiroir du glossaire ─────────────────────────
/**
 * Le panneau latéral, une seule mécanique pour deux usages.
 *
 * Il servait au glossaire — « c'est quoi, l'EBE ». La note de chaque module
 * y entre maintenant aussi : c'est le même geste, au même endroit, avec la même
 * façon d'en sortir. Une explication ne pousse plus jamais la page.
 */
function openDrawer(title, ...body) {
  const close = () => { scrim.remove(); drawer.remove() }
  const scrim = h('div', { class: 'scrim', onClick: close })
  const drawer = h('aside', { class: 'drawer', role: 'dialog', 'aria-label': title },
    h('div', { class: 'drawer-head' },
      h('div', { class: 'spacer' }, h('h2', {}, title)),
      h('button', { class: 'btn btn-sm btn-ghost', onClick: close, 'aria-label': 'Fermer' }, '✕'),
    ),
    h('div', { class: 'drawer-body' }, ...body),
  )
  document.body.append(scrim, drawer)
  const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey) } }
  document.addEventListener('keydown', onKey)
}

setDrawerHost((key) => {
  const entry = GLOSSARY[key]
  if (!entry) return
  openDrawer(entry.title,
    h('h4', {}, "De quoi s'agit-il"),
    h('p', {}, entry.what),
    entry.formula && [h('h4', {}, 'Formule'), h('div', { class: 'formula' }, entry.formula)],
    entry.how && [h('h4', {}, 'Comment Fynomia le calcule'), h('p', {}, entry.how)],
    entry.use && [h('h4', {}, 'À quoi ça sert'), h('p', {}, entry.use)],
    entry.watch && [h('h4', {}, 'Point de vigilance'), h('div', { class: 'note warn' }, entry.watch)],
    currentValue(key),
  )
})

setPanelHost(({ title, lede, body }) => {
  openDrawer(title || 'À propos de cette partie',
    lede ? h('p', { class: 'drawer-lede' }, lede) : null,
    body || null,
  )
})

/** Rattache la définition aux chiffres du scénario ouvert. */
function currentValue(key) {
  const r = store.result
  if (!r) return null
  const y = r.pnl.netResult.findIndex((v) => v > 0)
  const ref = y >= 0 ? y : 2
  const map = {
    pointMort: () => r.kpis.breakEven[ref] ? `${euro(r.kpis.breakEven[ref])} en année ${ref + 1}` : null,
    ebitda: () => `${euro(r.pnl.ebitda[ref])} en année ${ref + 1}`,
    ebit: () => `${euro(r.pnl.ebit[ref])} en année ${ref + 1}`,
    margeBrute: () => `${euro(r.pnl.grossMargin[ref])} en année ${ref + 1}`,
    valeurAjoutee: () => `${euro(r.pnl.valueAdded[ref])} en année ${ref + 1}`,
    bfr: () => `${euro(r.kpis.peakBfr)} au maximum`,
    tresorerie: () => `${euro(r.cash.yearEnd[0])} en fin d'année 1`,
    runway: () => (r.kpis.runwayMonths === null ? null : `${Math.round(r.kpis.runwayMonths)} mois`),
    cac: () => (r.kpis.cac ? euro(r.kpis.cac) : null),
    ltv: () => (r.kpis.ltv ? `${euro(r.kpis.ltv)} par client` : null),
    is: () => `${euro(r.pnl.corporateTax[ref])} en année ${ref + 1}`,
    cir: () => (r.credits[ref]?.cir ? euro(r.credits[ref].cir) : null),
    cii: () => (r.credits[ref]?.cii ? euro(r.credits[ref].cii) : null),
    marginRate: () => `${(r.kpis.marginRate[ref] * 100).toFixed(1).replace('.', ',')} %`,
  }
  const value = map[key]?.()
  if (!value) return null
  return h('div', { class: 'note ok', style: { marginTop: '18px' } },
    h('div', { class: 'note-title' }, 'Dans ton scénario'),
    value)
}

// Certains dessins sont composés différemment sur un écran étroit : ils sont
// donc redessinés quand la fenêtre franchit la limite, et à ce moment-là seul.
// Redessiner à chaque pixel de redimensionnement coûterait cher pour rien.
let wasNarrow = narrow()
window.addEventListener('resize', () => {
  if (narrow() === wasNarrow) return
  wasNarrow = narrow()
  render({ preserveScroll: true })
})

// ────────────────────────────────── Démarrage ──────────────────────────────
// Le retour du navigateur est un déplacement comme un autre : il voyage aussi.
window.addEventListener('hashchange', () => { if (plain) plain = false; else armTravel('page'); render() })
/**
 * La célébration d'une étape franchie.
 *
 * Un parcours qui ne dit rien quand on avance n'est pas un parcours. On compare
 * l'avancement avant et après chaque modification, et on ne félicite que sur un
 * franchissement réel — jamais sur une frappe au clavier.
 */
let lastDone = new Set()

/**
 * Relève l'état du parcours sans rien annoncer — au chargement d'un plan.
 *
 * Et complète les dates manquantes : un plan importé, ou rempli avant que
 * Fynomia ne date les franchissements, a des étapes faites sans date. On les
 * rattache à la dernière modification du plan plutôt que de les laisser vides,
 * sinon l'historique ment par omission.
 */
function markJourney() {
  if (!store.scenario || !store.result) { lastDone = new Set(); return }
  const j = journey(store.scenario, store.result)
  const done = j.steps.filter((s) => s.status === 'done').map((s) => s.key)
  lastDone = new Set(done)
  store.backfillSteps(done)
}

function celebrate() {
  if (!store.scenario || !store.result) return
  const j = journey(store.scenario, store.result)
  const done = new Set(j.steps.filter((s) => s.status === 'done').map((s) => s.key))
  const fresh = [...done].filter((k) => !lastDone.has(k))
  lastDone = done
  if (!fresh.length) return
  // La date du franchissement part avec le plan : elle survit au rechargement
  // et à un changement d'appareil.
  store.markSteps(fresh)
  const step = j.steps.find((s) => s.key === fresh[0])
  const left = j.total - j.done
  toast(left === 0
    ? `${step.label} \u2713 Ton business plan est complet.`
    : `${step.label} \u2713 ${points(j)} % \u2014 il reste ${left} étape${left > 1 ? 's' : ''}.`, 'ok')
}

store.subscribe((_, reason) => {
  if (reason === 'scenario' || reason === 'profile') { markJourney(); render() }
  // Une modification de données relance le calcul : on redessine la page pour
  // que les indicateurs suivent, en conservant la position de lecture.
  else if (reason === 'data') { celebrate(); render({ preserveScroll: true }) }
})

markJourney()
installMotion()
installEffet()
// Le guide se redessine tout seul quand on le masque ou le rouvre.
setCoachHost(() => render({ preserveScroll: true }))
if (!location.hash) location.hash = store.scenario ? '#/tableau-de-bord' : '#/accueil'
render()

// Le compte s'ouvre après le premier rendu : la page ne doit jamais attendre
// le réseau pour s'afficher. Le rail se met à jour quand la réponse arrive.
onCloud(() => {
  const foot = document.querySelector('.rail-account-sync')
  if (foot) {
    foot.className = `rail-account-sync ${cloud.status === 'ready' ? 'live' : ''}`
    foot.replaceChildren(...[
      cloud.status === 'ready' ? h('i', { class: 'sync-dot' }) : null,
      saveLabel(),
    ].filter(Boolean))
  }
  const name = document.querySelector('.rail-account-name')
  if (name && cloud.name) name.textContent = cloud.name
})
store.syncAccount()

// Le service worker n'accompagne que la version auto-hébergée : la page
// publiée n'en sert pas et tenterait un enregistrement voué à l'échec.
if (window.__FYNOMIA_HAS_SW__ && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}

/**
 * « Ce que ton banquier va vérifier » — cinq lignes, validé ou à revoir.
 *
 * Le dossier bancaire se joue sur une poignée de ratios que le chargé
 * d'affaires recalcule lui-même, dans cet ordre : l'apport, la couverture des
 * échéances par la capacité d'autofinancement, l'endettement en années de CAF,
 * la trésorerie, le point mort. Les dire au fondateur avant le rendez-vous, avec
 * les chiffres de son propre échéancier, c'est lui éviter la question à
 * laquelle il n'a pas de réponse — et lui dire quoi changer quand une ligne
 * ne passe pas.
 */

import { h, euro, num, pct, monthLabel } from './dom.js'
import { SEUILS_BANQUE } from '../engine/bank.js'

const ETATS = {
  ok: { mot: 'Validé', cls: 'is-ok' },
  juste: { mot: 'Juste', cls: 'is-juste' },
  revoir: { mot: 'À revoir', cls: 'is-revoir' },
  na: { mot: 'Sans objet', cls: 'is-na' },
}

const fois = (x) => `${num(x, x < 10 ? 2 : 1)}\u00a0fois`
const an = (y) => `année\u00a0${y + 1}`

/** Chaque vérification dite en clair : ce qu'on lit, ce qu'on attend, quoi faire. */
export function lignesBanquier(r) {
  const b = r?.bank
  if (!b) return []
  const S = SEUILS_BANQUE
  return b.checks.map((c) => {
    if (c.cle === 'apport') {
      return {
        ...c, titre: 'Ton apport',
        valeur: c.etat === 'na' ? euro(c.apport, { compact: c.apport >= 100000 }) : `${pct(c.part, 0)} du projet`,
        lu: c.etat === 'na'
          ? 'Tu ne demandes pas de prêt bancaire : l’apport ne se discute pas.'
          : `${euro(c.apport)} apportés — capital, compte courant, prêts d’honneur — pour ${euro(c.emprunt)} empruntés.`,
        attendu: `Au moins ${pct(S.apport, 0)} du projet, ${pct(S.apportMin, 0)} au strict minimum.`,
        faire: c.etat === 'ok' || c.etat === 'na' ? null : 'Un prêt d’honneur compte comme un apport, et c’est souvent lui qui déclenche le prêt. Sinon, réduis le montant emprunté.',
      }
    }
    if (c.cle === 'couverture') {
      return {
        ...c, titre: 'Ta CAF couvre tes échéances',
        valeur: c.etat === 'na' ? '—' : c.ratio < 0 ? 'CAF négative' : fois(c.ratio),
        lu: c.etat === 'na'
          ? 'Aucun prêt à rembourser.'
          : `En ${an(c.annee)}, ta capacité d’autofinancement (${euro(c.caf)}) face au capital à rembourser (${euro(c.capital)})${c.croisiere !== null && c.anneeCroisiere !== c.annee ? ` ; ${fois(c.croisiere)} en ${an(c.anneeCroisiere)}` : ''}.`,
        attendu: `${num(S.couverture, 1)} fois au moins chaque année : une marge pour les mauvais mois.`,
        faire: c.etat === 'ok' || c.etat === 'na' ? null
          : c.etat === 'juste' && c.croisiere >= S.couverture ? 'La première année se paie avec ta trésorerie : un différé de remboursement de six à douze mois la soulagerait.'
            : 'Allonge la durée du prêt, emprunte moins, ou remonte ta marge : chaque point d’EBE couvre une échéance.',
      }
    }
    if (c.cle === 'endettement') {
      return {
        ...c, titre: 'Tes dettes en années de CAF',
        valeur: c.etat === 'na' ? '—' : Number.isFinite(c.annees) ? `${num(c.annees, 1)}\u00a0ans` : 'CAF négative',
        lu: c.etat === 'na'
          ? 'Aucune dette bancaire à la clôture.'
          : Number.isFinite(c.annees)
            ? `Fin ${an(c.annee)}, il resterait ${euro(c.dette)} à rembourser, soit ${num(c.annees, 1)} ans de CAF.`
            : `Fin ${an(c.annee)}, ${euro(c.dette)} restent dus et ta CAF est négative : rien ne rembourse la dette.`,
        attendu: `${S.endettement} ans au plus, ${S.endettementMax} au-delà de quoi la banque demandera une garantie.`,
        faire: c.etat === 'ok' || c.etat === 'na' ? null : 'Plus d’apport ou un prêt plus court allègent la dette ; une CAF plus forte la rembourse plus vite.',
      }
    }
    if (c.cle === 'tresorerie') {
      return {
        ...c, titre: 'Ta trésorerie tient',
        valeur: c.etat === 'ok' ? 'Toujours positive' : `−${euro(c.manque, { compact: c.manque >= 100000 })}`,
        lu: c.etat === 'ok'
          ? 'Prêts compris, ton compte ne passe jamais sous zéro sur cinq ans.'
          : `Il manque ${euro(c.manque)} au point bas, en ${monthLabel(c.mois, r.startDate)}.`,
        attendu: 'Jamais sous zéro : un plan qui y passe n’est pas finançable en l’état.',
        faire: c.etat === 'ok' ? null : 'Comble le point bas avant le rendez-vous : un apport, un prêt d’honneur, ou des dépenses décalées.',
      }
    }
    return {
      ...c, titre: 'Tu gagnes de l’argent',
      valeur: c.annee === null ? 'Pas sur 5 ans' : `Dès l’${an(c.annee)}`,
      lu: c.annee === null ? 'Le résultat reste négatif sur les cinq années du plan.' : `Premier résultat net positif en ${an(c.annee)}.`,
      attendu: 'Un bénéfice dès la deuxième année ; la troisième se discute.',
      faire: c.etat === 'ok' ? null : 'Revois le prix, le volume de départ ou les charges fixes : c’est le point mort qui recule.',
    }
  })
}

/**
 * Le bloc complet : cinq lignes et un verdict.
 *
 * @param {object} r  le résultat du moteur
 * @param {{titre?:string, court?:boolean, navigate?:Function}} o
 */
export function banquierVerifie(r, { titre = 'Ce que ton banquier va vérifier', court = false } = {}) {
  const lignes = lignesBanquier(r)
  if (!lignes.length) return null
  const comptees = lignes.filter((l) => l.etat !== 'na')
  const ok = comptees.filter((l) => l.etat === 'ok').length
  const revoir = comptees.filter((l) => l.etat === 'revoir').length
  const bilan = revoir === 0 && ok === comptees.length ? 'Tout est validé'
    : revoir === 0 ? `${ok} sur ${comptees.length} validés, le reste est juste`
      : `${revoir} ${revoir > 1 ? 'points' : 'point'} à revoir avant le rendez-vous`
  return h('section', { class: `bk ${court ? 'is-court' : ''}`, 'data-banquier': '' },
    h('header', { class: 'bk-head' },
      h('h3', { class: 'bk-titre' }, titre),
      h('span', { class: `bk-bilan ${revoir ? 'is-revoir' : ok === comptees.length ? 'is-ok' : 'is-juste'}` }, bilan),
    ),
    h('ol', { class: 'bk-liste' },
      ...lignes.map((l) => {
        const e = ETATS[l.etat] || ETATS.na
        return h('li', { class: `bk-ligne ${e.cls}`, 'data-cle': l.cle },
          h('span', { class: 'bk-etat' }, e.mot),
          h('div', { class: 'bk-corps' },
            h('div', { class: 'bk-ligne-tete' },
              h('b', { class: 'bk-ligne-titre' }, l.titre),
              h('span', { class: 'bk-valeur num' }, l.valeur),
            ),
            court ? null : h('p', { class: 'bk-lu' }, l.lu),
            court ? null : h('p', { class: 'bk-attendu' }, h('span', {}, 'Attendu'), ' ', l.attendu),
            l.faire ? h('p', { class: 'bk-faire' }, l.faire) : null,
          ),
        )
      }),
    ),
  )
}

/**
 * Les chiffres du banquier, année par année : EBE, CAF, échéances réelles,
 * couverture, dette restante. C'est le tableau qu'il refera de son côté.
 */
export function tableauBanquier(r, yearLabel) {
  const b = r?.bank
  if (!b) return null
  const ligne = (nom, vals, f = (v) => euro(v), cls = '') => h('tr', { class: cls },
    h('td', {}, nom), ...vals.map((v) => h('td', { class: 'num' }, v === null || v === undefined ? '—' : f(v))))
  const emprunte = b.loansTotal > 0
  return h('table', { class: 'data bk-table' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), ...b.cafY.map((_, i) => h('th', {}, yearLabel ? yearLabel(i) : `Année ${i + 1}`)))),
    h('tbody', {},
      ligne('EBE — excédent brut d’exploitation', r.pnl.ebe),
      ligne('CAF — capacité d’autofinancement', b.cafY, (v) => euro(v), 'highlight'),
      emprunte ? ligne('Échéances de prêt (capital + intérêts)', b.annuityY) : null,
      emprunte ? ligne('dont capital remboursé', b.capitalY, (v) => euro(v), 'muted') : null,
      emprunte ? ligne('Couverture du capital par la CAF', b.coverageY, (v) => `${num(v, 2)}×`) : null,
      emprunte ? ligne('Dette bancaire restante', b.debtEndY) : null,
      emprunte ? ligne('Dette en années de CAF', b.debtToCafY, (v) => (Number.isFinite(v) ? `${num(v, 1)} ans` : 'CAF < 0')) : null,
    ),
  )
}

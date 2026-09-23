/**
 * Les garde-fous de vraisemblance : muets sur un plan sensé, clairs sur une faute.
 *
 * Un garde-fou qui s'allume sur un plan normal apprend au fondateur à ne plus
 * le lire ; un garde-fou qui se tait devant 280 millions de résultat la
 * première année ne sert à rien. Ce fichier vérifie les deux côtés :
 *
 *   - les vingt et un plans types et toutes les offres suggérées par métier
 *     ne déclenchent rien ;
 *   - les fautes courantes — un zéro de trop dans un prix, une croissance
 *     saisie en entier, un salaire en milliers, un financement sans ses
 *     zéros — sont attrapées, avec le bon niveau, et changent le verdict.
 */
import { compute } from '../js/engine/engine.js'
import { scenarioFromTemplate, SECTORS } from '../js/state/schema.js'
import { TRADE } from '../js/state/trade.js'
import { verdict } from '../js/engine/verdict.js'
import {
  REPERES, SMIC_ANNUEL, vraisemblance, bloquantes, gardePrix, gardeAbonnement, gardeCroissance, gardeSalaire,
} from '../js/engine/plausible.js'

const ok = (l, c, d = '') => { console.log(`${c ? '✓' : '✗'} ${l}${d ? ' — ' + d : ''}`); if (!c) process.exitCode = 1 }

// ── Chaque métier a ses repères ────────────────────────────────────────────
const sansRepere = Object.keys(SECTORS).filter((k) => !REPERES[k])
ok('chaque modèle économique a sa fourchette', sansRepere.length === 0, sansRepere.join(', '))
ok('SMIC annuel brut 35 h ≈ 22 405 €', Math.abs(SMIC_ANNUEL - 22405) <= 2, String(SMIC_ANNUEL))

// ── Aucun faux positif ─────────────────────────────────────────────────────
for (const k of Object.keys(SECTORS)) {
  const s = scenarioFromTemplate(k, 'plan type')
  const r = compute(s)
  const v = vraisemblance(s, r)
  ok(`${SECTORS[k].label} : le plan type ne déclenche rien`, v.length === 0, v.map((x) => x.texte).join(' | '))
  const offres = (TRADE[k]?.offers || []).filter((o) => (o.recurring ? gardeAbonnement(s, o.price) : gardePrix(s, o.price, { principale: false })))
  ok(`${SECTORS[k].label} : aucune offre suggérée n'est jugée aberrante`, offres.length === 0, offres.map((o) => `${o.label} ${o.price}`).join(', '))
}

// ── Les fautes courantes sont attrapées ────────────────────────────────────
const pizzeria = { meta: { sectorKey: 'restaurant', activityKey: 'pizzeria' } }
const p1 = gardePrix(pizzeria, 24000)
ok('un couvert à 24 000 € : alerte, en fois, dans l’unité du métier',
  p1?.niveau === 'alerte' && /160 fois au-dessus/.test(p1.texte) && /couvert/.test(p1.texte), p1?.texte)
ok('un couvert à 24 € : rien', gardePrix(pizzeria, 24) === null)
ok('un couvert à 0,30 € : alerte, en dessous', gardePrix(pizzeria, 0.3)?.niveau === 'alerte')
ok('une privatisation à 900 € en seconde offre : rien', gardePrix(pizzeria, 900, { principale: false }) === null)

const g1 = gardeCroissance(pizzeria, 8)
ok('« 8 » au lieu de 8 % de croissance : alerte, et la correction proposée', g1?.niveau === 'alerte' && /8 %/.test(g1.texte), g1?.texte)
ok('4 % de croissance mensuelle en restauration : rien', gardeCroissance(pizzeria, 0.04) === null)

const s1 = gardeSalaire(44, 'cdi')
ok('un salaire de 44 €/an : alerte, et « 44 000 € » proposé', s1?.niveau === 'alerte' && /44\s000/.test(s1.texte), s1?.texte)
ok('un salaire de 1 800 € dans le champ annuel : la lecture mensuelle proposée', /21\s600/.test(gardeSalaire(1800, 'cdi')?.texte || ''), gardeSalaire(1800, 'cdi')?.texte)
ok('un salaire au SMIC : rien', gardeSalaire(SMIC_ANNUEL, 'cdi') === null)
ok('un dirigeant TNS à 12 000 € : rien', gardeSalaire(12000, 'tns') === null)
ok('un salaire de 900 000 € : alerte', gardeSalaire(900000, 'dirigeant')?.niveau === 'alerte')

// ── Et le verdict ne présente plus un succès ───────────────────────────────
const s = scenarioFromTemplate('restaurant', 'faute')
s.meta.activityKey = 'pizzeria'
const avant = verdict(compute(s), s)
s.activities[0].unitPrice = 24000
const r = compute(s)
const v = vraisemblance(s, r)
ok('la faute de prix remonte au plan, avec le résultat et le chiffre d’affaires',
  ['prix:', 'ca1', 'net1'].every((c) => v.some((x) => x.cle.startsWith(c))), v.map((x) => x.cle).join(', '))
ok('toutes trois bloquent', bloquantes(v).length >= 3)
const apres = verdict(r, s)
ok('le verdict passe à « À vérifier »', apres.word === 'À vérifier' && apres.tone === 'watch', `${avant.word} → ${apres.word}`)

// Un financement sans ses zéros : signalé, sans bloquer.
const f = scenarioFromTemplate('restaurant', 'financement')
f.financing.equityFounders = [{ month: 0, amount: 944 }]
f.financing.loans = []
const vf = vraisemblance(f, compute(f))
const lf = vf.find((x) => x.cle === 'financement')
ok('944 € de financement face au besoin : signalé', !!lf && lf.niveau === 'attention', lf?.texte)

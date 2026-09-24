/**
 * La saisonnalité suit le calendrier et répartit les ventes sans en changer
 * le total.
 *
 * Douze coefficients, un par mois de janvier à décembre. Juillet reste
 * juillet quel que soit le mois de démarrage du plan ; les coefficients sont
 * ramenés à une moyenne de 1, si bien que l'année compte autant de ventes
 * qu'à plat ; le plafond de capacité tient aussi le mois de pointe.
 */
import { baseVolumes, moisDebut } from '../js/engine/revenue.js'
import { compute } from '../js/engine/engine.js'
import { scenarioFromTemplate } from '../js/state/schema.js'
import { SAISONS } from '../js/state/saisons.js'
const ok = (l, c, d = '') => { console.log(`${c ? '✓' : '✗'} ${l}${d ? ' — ' + d : ''}`); if (!c) process.exitCode = 1 }
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t
const somme = (xs, a, b) => xs.slice(a, b).reduce((t, v) => t + v, 0)

const offre = (volumes) => ({ volumes: { mode: 'growth', launchMonth: 0, startUnits: 100, monthlyGrowth: 0, growthDecay: 1, cap: '', ...volumes } })
const ete = SAISONS.ete.coefs

const plat = baseVolumes(offre({}))
const janvier = baseVolumes(offre({ seasonality: ete }), { moisDebut: 0 })
const avril = baseVolumes(offre({ seasonality: ete }), { moisDebut: 3 })
ok('moisDebut lit le mois de la date de démarrage', moisDebut('2026-04-01') === 3 && moisDebut('2026-01-15') === 0 && moisDebut('') === 0)
ok('un plan qui démarre en janvier : juillet est le 7e mois', near(janvier[6], 200) && near(janvier[0], 40), `${janvier[6]} en juillet, ${janvier[0]} en janvier`)
ok('un plan qui démarre en avril : juillet est le 4e mois', near(avril[3], 200) && near(avril[0], 100), `${avril[3]} en juillet, ${avril[0]} en avril`)
ok('l’année compte autant de ventes qu’à plat', near(somme(janvier, 0, 12), somme(plat, 0, 12)) && near(somme(avril, 0, 12), somme(plat, 0, 12)), `${somme(janvier, 0, 12)} / ${somme(plat, 0, 12)}`)

// Des coefficients qui ne font pas 100 % en moyenne sont ramenés à 100 %.
const double = baseVolumes(offre({ seasonality: ete.map((c) => c * 2) }))
ok('des coefficients doublés donnent la même répartition', double.every((v, m) => near(v, janvier[m])))

// Le plafond tient le mois de pointe.
const plafond = baseVolumes(offre({ seasonality: ete, cap: 150 }))
ok('le plafond de capacité tient aussi le mois de pointe', Math.max(...plafond) <= 150 + 1e-9 && near(plafond[0], 40), `pointe ${Math.max(...plafond)}`)

// Le moteur complet, sur l'exemple du fleuriste : même chiffre d'affaires
// annuel qu'à plat, mais février et mai portent les ventes. (Le glacier et
// l'hébergement saisissent déjà leurs ventes mois par mois, saison comprise.)
const s = scenarioFromTemplate('fleuriste', 'fleuriste')
const saison = compute(s)
const aplat = compute({ ...s, activities: s.activities.map((a) => ({ ...a, volumes: { ...a.volumes, seasonality: null } })) })
ok('l’exemple du fleuriste porte sa saison', Array.isArray(s.activities[0].volumes.seasonality))
ok('le fleuriste saisonnier vend presque autant sur l’année qu’à plat — la croissance tombe sur d’autres mois', Math.abs(saison.pnl.revenue[2] - aplat.pnl.revenue[2]) / aplat.pnl.revenue[2] < 0.05,
  `${Math.round(saison.pnl.revenue[2])} € contre ${Math.round(aplat.pnl.revenue[2])} €`)
const mois = (r) => r.revenue.monthly.slice(12, 24)
ok('mais pas au même moment : février fait près du double d’août', mois(saison)[1] > 1.8 * mois(saison)[7], `février ${Math.round(mois(saison)[1])} €, août ${Math.round(mois(saison)[7])} €`)

/**
 * La saisonnalité se règle dans Volumes, et la saisie mois par mois part de
 * la courbe du moteur.
 *
 *   1. un profil choisi d'un clic répartit les ventes sans changer le total ;
 *   2. un mois se règle à la main, et « Aucune » ramène à plat ;
 *   3. passer en saisie mois par mois ne change pas le chiffre d'affaires —
 *      elle recalculait une courbe sans freinage : 1,3 M€ devenait 17 M€.
 */
export const nom = 'Saisonnalité — un profil, douze mois, et une saisie mois par mois fidèle'

const ca = (p) => p.evaluate(async () => (await import('./js/state/store.js')).default.result.pnl.revenue.slice())
const saison = (p) => p.evaluate(async () => (await import('./js/state/store.js')).default.scenario.activities[0].volumes.seasonality)

export default async function (t) {
  const p = await t.page('bureau')
  await t.exemple(p)
  await t.aller(p, 'offre')
  if (!(await p.locator('.item.open').count())) { await p.locator('.item-head').first().click(); await p.locator('.item.open').first().waitFor() }
  await p.locator('.item.open button', { hasText: /^Volumes$/ }).first().click()
  await t.pose(p)
  const bloc = p.locator('.item.open [data-gap="saison"]')
  t.verifie(await bloc.count() === 1 && await bloc.locator('.saison-m').count() === 12, 'la saisonnalité se règle dans Volumes, mois par mois')

  // 1. Un profil.
  const a0 = await ca(p)
  await bloc.locator('.saison-profil', { hasText: 'Fin d’année' }).click()
  await t.pose(p)
  const attendu = await p.evaluate(async () => (await import('./js/state/saisons.js')).SAISONS.finAnnee.coefs)
  const a1 = await ca(p)
  t.verifie(JSON.stringify(await saison(p)) === JSON.stringify(attendu), 'le profil « Fin d’année » est posé sur l’offre')
  t.verifie(Math.abs(a1[2] - a0[2]) / a0[2] < 0.05, 'il répartit les ventes sans changer le total de l’année', { avant: Math.round(a0[2]), apres: Math.round(a1[2]) })
  const decembre = await p.evaluate(async () => {
    const st = (await import('./js/state/store.js')).default
    const m = st.result.revenue.monthly
    const debut = Number(String(st.scenario.meta.startDate).slice(5, 7)) - 1
    const i = (12 - debut + 11) % 12 + 12
    return { dec: m[i], moyenne: m.slice(12, 24).reduce((a, b) => a + b, 0) / 12 }
  })
  t.verifie(decembre.dec > 1.5 * decembre.moyenne, 'décembre pèse près du double d’un mois moyen', decembre)

  // 2. Un mois à la main, puis « Aucune ».
  const champDec = p.locator('.item.open [data-gap="saison"] input[aria-label="Coefficient de déc."]')
  await champDec.fill('250')
  await champDec.press('Tab')
  await t.pose(p)
  const s2 = await saison(p)
  t.verifie(Array.isArray(s2) && Math.abs(s2[11] - 2.5) < 1e-9, 'un mois se règle à la main', s2 && s2[11])
  t.verifie(/sur mesure/.test(await bloc.locator('.saison-dit').innerText().catch(() => '')), 'le profil devient « sur mesure »')
  await bloc.locator('.saison-profil', { hasText: /^Aucune$/ }).click()
  await t.pose(p)
  t.verifie(await saison(p) === null, '« Aucune » ramène les ventes à plat')

  // 3. La saisie mois par mois part de la courbe du moteur.
  const avant = await ca(p)
  const courbe = await p.evaluate(async () => (await import('./js/state/store.js')).default.result.revenue.perActivity[0].base.map((x) => Math.round(x)))
  await p.locator('.item.open .seg-btn', { hasText: 'Saisie mois par mois' }).click()
  await t.pose(p)
  const apres = await ca(p)
  const manuel = await p.evaluate(async () => (await import('./js/state/store.js')).default.scenario.activities[0].volumes.manual)
  t.verifie(JSON.stringify(manuel) === JSON.stringify(courbe), 'les soixante mois reprennent la courbe du moteur, arrondie')
  t.verifie(apres.every((v, y) => Math.abs(v - avant[y]) / Math.max(1, avant[y]) < 0.01), 'le chiffre d’affaires ne change pas en passant à la saisie mois par mois',
    { avant: avant.map(Math.round), apres: apres.map(Math.round) })
  const tete = await p.locator('.item.open .table-wrap thead th').allTextContents()
  const debut = await p.evaluate(async () => Number(String((await import('./js/state/store.js')).default.scenario.meta.startDate).slice(5, 7)) - 1)
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  t.verifie(tete[1] === MOIS[debut], 'la grille commence au mois de démarrage du plan', tete.slice(0, 3))

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}

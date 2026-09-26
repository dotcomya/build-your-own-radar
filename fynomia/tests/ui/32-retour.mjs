/**
 * Changer de page repart de zéro : année 1, premier onglet, tout replié.
 *
 * « Il faut à chaque fois que je change de page rester sur année 1 et revenir
 * sur la page au premier onglet, sinon on se perd. Si le détail de “Ce que
 * tes offres rapportent” a été déplié, quand je reviens ça doit être replié. »
 *
 *   1. sur Offre et revenus : année 3, détail du bandeau déplié, onglet
 *      Volumes ; on part aux Achats, qui s'ouvrent en année 1 ; on revient :
 *      année 1, bandeau replié, premier onglet ;
 *   2. au tableau de bord : Pilotage, puis on part et on revient — la
 *      synthèse, en premier onglet, sur le récit.
 */
export const nom = 'Retour sur une page — année 1, premier onglet, replié'

export default async function (t) {
  const p = await t.page('bureau')
  await t.exemple(p)

  const etat = () => p.evaluate(() => ({
    annee: document.querySelector('.sx-year.is-on')?.textContent?.trim() || null,
    deplie: !!document.querySelector('.sx.is-bandeau.is-open'),
    onglet: document.querySelector('.module-nav .hnav-tab.active')?.textContent?.trim() || null,
    premier: document.querySelector('.module-nav .hnav-tab')?.textContent?.trim() || null,
  }))

  // 1. Offre et revenus.
  await t.aller(p, 'offre')
  await p.locator('.sx-year', { hasText: 'A3' }).first().click()
  await p.locator('.sx-ribbon-more').first().click()
  await t.pose(p)
  const onglets = await p.locator('.module-nav .hnav-tab').allTextContents()
  if (onglets.length > 1) { await p.locator('.module-nav .hnav-tab').nth(1).click(); await t.pose(p) }
  const avant = await etat()
  t.verifie(avant.annee === 'A3' && avant.deplie, 'l’offre est en année 3, bandeau déplié', avant)

  await t.aller(p, 'achats')
  const achats = await etat()
  t.verifie(achats.annee === 'A1' && !achats.deplie, 'une autre page s’ouvre en année 1, bandeau replié', achats)

  await t.aller(p, 'offre')
  const retour = await etat()
  t.verifie(retour.annee === 'A1', 'revenu sur l’offre : année 1', retour)
  t.verifie(!retour.deplie, 'le détail de « Ce que tes offres rapportent » est replié', retour)
  t.verifie(retour.onglet === retour.premier, 'la page est sur son premier onglet', retour)

  // 2. Le tableau de bord.
  await t.aller(p, 'tableau-de-bord')
  await t.onglet(p, 'Pilotage')
  await t.aller(p, 'resultats')
  await t.aller(p, 'tableau-de-bord')
  const tb = await etat()
  t.verifie(tb.onglet === 'Synthèse' && tb.premier === 'Synthèse', 'le tableau de bord revient sur « Synthèse », son premier onglet', tb)
  t.verifie(await p.locator('.pitch-mise.is-on', { hasText: 'Récit' }).count() === 1, 'la synthèse s’ouvre sur le récit')

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}

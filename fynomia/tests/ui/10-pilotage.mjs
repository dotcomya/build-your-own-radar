/**
 * Ce qu'on saisit fait avancer le dossier, tout de suite.
 *
 * Une description tapée dans Mon projet était enregistrée mais jamais
 * annoncée : le compteur ne bougeait pas, le pilotage la réclamait encore.
 * On la tape, on quitte le champ, et on vérifie sans changer de page que le
 * compteur avance ; puis que le pilotage la coche. Et que passer d'un champ
 * au suivant au clavier garde le curseur.
 */
export const nom = 'Pilotage — une saisie valide son étape'

const compteur = (p) => p.evaluate(() => {
  const t = document.querySelector('.topbar')?.innerText || ''
  const m = t.match(/(\d+)\s*\/\s*(\d+)/)
  return m ? Number(m[1]) : null
})

export default async function (t) {
  const p = await t.page('bureau')
  await t.exemple(p)
  await t.aller(p, 'projet')
  const avant = await compteur(p)
  t.verifie(avant !== null, 'le compteur d’avancement est lisible')

  const ta = p.locator('[data-gap="pitch"] textarea')
  await ta.click()
  await ta.fill('Une plateforme d’analyse pour les commerces indépendants.')
  await p.locator('h1').click()
  // La sortie du champ annonce la saisie : le compteur bouge, ou le constat dira qu'il ne bouge pas.
  await p.waitForFunction((a) => { const m = (document.querySelector('.topbar')?.innerText || '').match(/(\d+)\s*\/\s*(\d+)/); return m && Number(m[1]) !== a }, avant, { timeout: 3000 }).catch(() => {})
  const apres = await compteur(p)
  t.verifie(apres === avant + 1, 'quitter la description fait avancer le compteur, sans changer de page', `${avant} → ${apres}`)

  await t.aller(p, 'tableau-de-bord')
  await t.onglet(p, 'Pilotage')
  // Les paliers s'ouvrent et se ferment en entier : fermé, aucune ligne ;
  // ouvert, toutes. Le titre est un titre, plus une étiquette.
  const paliers = await p.$$eval('.refinery-group', (e) => e.map((g) => ({
    ouvert: g.classList.contains('is-open'), lignes: g.querySelectorAll('.refinery-item').length,
    total: Number((g.querySelector('.refinery-group-count')?.textContent || '0/0').split('/')[1]),
    titre: parseFloat(getComputedStyle(g.querySelector('.refinery-chip')).fontSize),
  })))
  t.verifie(paliers.length === 3 && paliers.every((x) => (x.ouvert ? x.lignes === x.total : x.lignes === 0)), 'un palier fermé ne montre aucune ligne, un palier ouvert les montre toutes', paliers)
  t.verifie(paliers.every((x) => x.titre >= 20), 'les titres des paliers sont en grand', paliers.map((x) => x.titre))
  const ferme = p.locator('.refinery-group.is-closed .refinery-group-head').first()
  if (await ferme.count()) {
    await ferme.click()
    await p.waitForFunction(() => document.querySelectorAll('.refinery-group.is-open').length >= 2, null, { timeout: 3000 }).catch(() => {})
    await t.pose(p)
    const rouvert = await p.$$eval('.refinery-group', (e) => e.filter((g) => g.classList.contains('is-open')).length)
    t.verifie(rouvert >= 2, 'un clic sur le titre ouvre le palier entier', String(rouvert))
  }
  await p.locator('.refinery-more').click()
  await p.waitForFunction(() => [...document.querySelectorAll('.refinery-item')].some((x) => /description/i.test(x.textContent)), null, { timeout: 3000 }).catch(() => {})
  await t.pose(p)
  const coche = await p.evaluate(() => [...document.querySelectorAll('.refinery-item')].some((x) => /description/i.test(x.textContent) && x.classList.contains('is-done')))
  t.verifie(coche, 'le pilotage coche la description')
  t.verifie(await p.locator('.pilote-dossier .sy-hero').count() === 1 && await p.locator('.pilote-dossier .sy-dossier').count() === 1, 'l’avancement du dossier est dans le pilotage : où tu en es, ce qui reste, page par page')

  // Au clavier : du nom du projet, Tab mène au champ suivant, et y reste.
  await t.aller(p, 'projet')
  const nomProjet = p.locator('.slab .grid input').first()
  await nomProjet.click()
  await nomProjet.fill('Nova Analytics Pro')
  await p.keyboard.press('Tab')
  // Le redessin tenu pendant la touche se joue au relâchement, puis le focus est rendu.
  await p.waitForFunction(() => /NOVA ANALYTICS PRO/i.test(document.querySelector('.topbar')?.innerText || ''), null, { timeout: 3000 }).catch(() => {})
  await t.pose(p)
  const focus = await p.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName}.${a.className}` : '' })
  t.verifie(!/^BODY/.test(focus), 'Tab après une saisie garde le curseur dans la page', focus)
  const titre = await p.evaluate(() => document.querySelector('.topbar')?.innerText || '')
  t.verifie(/NOVA ANALYTICS PRO/i.test(titre), 'le nouveau nom est annoncé dès la sortie du champ', titre.slice(0, 60))

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}

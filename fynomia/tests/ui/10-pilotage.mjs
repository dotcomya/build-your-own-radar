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
  await t.aller(p, 'projet', 900)
  const avant = await compteur(p)
  t.verifie(avant !== null, 'le compteur d’avancement est lisible')

  const ta = p.locator('[data-gap="pitch"] textarea')
  await ta.click()
  await ta.fill('Une plateforme d’analyse pour les commerces indépendants.')
  await p.locator('h1').click()
  await p.waitForTimeout(500)
  const apres = await compteur(p)
  t.verifie(apres === avant + 1, 'quitter la description fait avancer le compteur, sans changer de page', `${avant} → ${apres}`)

  await t.aller(p, 'tableau-de-bord', 800)
  await t.onglet(p, 'Pilotage', 900)
  const coche = await p.evaluate(() => [...document.querySelectorAll('.refinery-item')].some((x) => /description/i.test(x.textContent) && x.classList.contains('is-done')))
  t.verifie(coche, 'le pilotage coche la description')

  // Au clavier : du nom du projet, Tab mène au champ suivant, et y reste.
  await t.aller(p, 'projet', 900)
  const nomProjet = p.locator('.slab .grid input').first()
  await nomProjet.click()
  await nomProjet.fill('Nova Analytics Pro')
  await p.keyboard.press('Tab')
  await p.waitForTimeout(500)
  const focus = await p.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName}.${a.className}` : '' })
  t.verifie(!/^BODY/.test(focus), 'Tab après une saisie garde le curseur dans la page', focus)
  const titre = await p.evaluate(() => document.querySelector('.topbar')?.innerText || '')
  t.verifie(/NOVA ANALYTICS PRO/i.test(titre), 'le nouveau nom est annoncé dès la sortie du champ', titre.slice(0, 60))

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}

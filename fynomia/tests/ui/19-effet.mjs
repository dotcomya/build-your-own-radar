/**
 * L'effet d'une saisie se lit là où on tape.
 *
 *   1. monter un prix fait apparaître, sous le champ, ce que gagne le
 *      résultat — « +… € de résultat en année N » —, en vert ;
 *   2. le baisser le dit en rouge ;
 *   3. un salaire tapé chiffre par chiffre met la pastille à jour sans
 *      quitter le champ ;
 *   4. entrer dans un autre champ, ou changer de page, efface la pastille.
 */
export const nom = 'Effet — la saisie dit ce qu’elle déplace, sous le champ'

async function carteOuverte(t, p) {
  if (!(await p.locator('.item.open').count())) {
    await p.locator('.item-head').first().click()
    await p.locator('.item.open').first().waitFor()
    await t.pose(p)
  }
}

export default async function (t) {
  const p = await t.page('bureau')
  await t.exemple(p)

  await t.aller(p, 'offre')
  await carteOuverte(t, p)
  const champPrix = () => p.locator('.item.open .field', { has: p.locator('label', { hasText: /^(Prix|Abonnement)/ }) }).first()
  const prix = champPrix().locator('input').first()
  t.verifie(await prix.count() === 1, 'le champ de prix est trouvé')
  const avant = Number(await prix.inputValue())
  await prix.click()
  await prix.fill(String(Math.round(avant * 1.2)))
  await prix.blur()
  await champPrix().locator('.effet').waitFor({ timeout: 3000 }).catch(() => {})
  await t.pose(p)
  let chip = champPrix().locator('.effet')
  const haut = (await chip.count()) ? await chip.innerText() : ''
  const bon = (await chip.count()) ? await chip.evaluate((e) => e.classList.contains('is-bon')) : false
  t.verifie(/^\+.*de résultat en année\s\d/.test(haut) && bon, 'un prix plus haut : « +… € de résultat en année N », en vert', haut)

  await prix.click()
  await prix.fill(String(Math.round(avant * 0.8)))
  await prix.blur()
  // La pastille change de sens : on attend qu'elle ne dise plus la hausse.
  await p.waitForFunction((h) => { const e = document.querySelector('.item.open .effet'); return !!e && e.innerText !== h }, haut, { timeout: 3000 }).catch(() => {})
  await t.pose(p)
  chip = champPrix().locator('.effet')
  const bas = (await chip.count()) ? await chip.innerText() : ''
  const mauvais = (await chip.count()) ? await chip.evaluate((e) => e.classList.contains('is-mauvais')) : false
  t.verifie(/^[−-]/.test(bas) && mauvais, 'un prix plus bas se dit en rouge, avec son signe', bas)

  // Un salaire, chiffre par chiffre.
  await t.aller(p, 'equipe')
  await carteOuverte(t, p)
  const salaire = p.locator('.item.open .field', { has: p.locator('label', { hasText: /Salaire brut|Rémunération/ }) }).first()
  const input = salaire.locator('input').first()
  await input.click()
  const v0 = Number(await input.inputValue())
  await input.fill(String(Math.round(v0 * 1.5)))
  await salaire.locator('.effet').waitFor({ timeout: 3000 }).catch(() => {})
  await t.pose(p)
  const s1 = (await salaire.locator('.effet').count()) ? await salaire.locator('.effet').innerText() : ''
  t.verifie(/^[−-].*année/.test(s1), 'pendant la frappe, sans quitter le champ, le salaire dit ce qu’il coûte au résultat', s1)
  t.verifie(await p.evaluate(() => document.activeElement?.tagName === 'INPUT'), 'le curseur reste dans le champ')

  // Un autre champ repart de zéro ; une autre page efface tout.
  const autre = p.locator('.item.open .field input').filter({ hasNot: p.locator('[disabled]') }).first()
  await p.locator('.item.open .field', { has: p.locator('label', { hasText: /Intitulé/ }) }).locator('input').first().click()
  await salaire.locator('.effet').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {})
  t.verifie(!(await salaire.locator('.effet').count()), 'entrer dans un autre champ efface la pastille')
  await t.aller(p, 'achats')
  t.verifie(!(await p.locator('.effet').count()), 'changer de page aussi')

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}

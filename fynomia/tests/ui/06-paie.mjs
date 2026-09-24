/**
 * Le coût d'un salaire se recalcule dès que la main se pose — une seconde
 * après la dernière frappe —, sans quitter le champ.
 */
export const nom = 'Paie en direct'

export default async function (t) {
  const p = await t.page('large')
  await t.exemple(p)
  await t.aller(p, 'equipe')
  if (!(await p.locator('.item.open').count())) { await p.locator('.item-head').first().click(); await p.locator('.item.open').first().waitFor(); await t.pose(p) }
  const lire = () => p.evaluate(() => ({
    cout: document.querySelector('.postresult > .num')?.textContent.trim(),
    net: document.querySelector('.postresult-net .num')?.textContent.trim(),
  }))
  const f = p.locator('.postline input[inputmode=decimal], .postline input[inputmode=numeric]').first()
  t.verifie(await f.count() === 1, 'le champ du salaire existe')
  const vus = []
  for (const v of ['20000', '50000', '90000']) {
    const avant = (await lire()).cout
    await f.fill(v)
    // Le coût affiché change pendant la frappe ; s'il ne change pas, le constat le dira.
    await p.waitForFunction((a) => document.querySelector('.postresult > .num')?.textContent.trim() !== a, avant, { timeout: 3000 }).catch(() => {})
    vus.push(await lire())
  }
  const couts = vus.map((x) => Number(String(x.cout || '').replace(/[^\d]/g, '')))
  t.verifie(couts.every((c) => c > 0), 'un coût s’affiche à chaque frappe', vus)
  t.verifie(couts[0] < couts[1] && couts[1] < couts[2], 'le coût suit le salaire, sans quitter le champ', couts)
  t.verifie(vus.every((x, i) => i === 0 || x.net !== vus[i - 1].net), 'le net suit aussi', vus.map((x) => x.net))
  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}

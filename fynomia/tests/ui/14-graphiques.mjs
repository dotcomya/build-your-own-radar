/**
 * Les graphiques et les parties se révèlent — tous, sur toutes les pages.
 *
 * Les graphiques, les cartes de chiffres et les parties numérotées entrent en
 * scène quand on arrive dessus : avant, ils sont invisibles. Un observateur
 * mal réglé peut donc cacher une partie pour toujours sans qu'aucune erreur
 * ne le signale — c'est arrivé. On descend chaque page jusqu'en bas et on
 * vérifie qu'il ne reste rien de caché ; puis que les états financiers
 * s'ouvrent sur leurs trois parties et leurs quatre chiffres, que changer
 * d'exercice change les chiffres et la colonne surlignée, et que l'exercice
 * choisi suit d'une page à l'autre.
 */
import { PAGES, debordements } from '../lib/harnais.mjs'

export const nom = 'Graphiques et parties — tout se révèle, tout se lit'

// Seuls comptent les éléments affichés : un graphique dans un volet replié
// se révèle quand on ouvre le volet, pas avant.
const caches = (p) => p.evaluate(() => [...document.querySelectorAll('.ch-watch:not(.is-seen)')]
  .filter((x) => x.getClientRects().length > 0 && !x.closest('details:not([open])'))
  .map((x) => x.dataset.ch || x.className).slice(0, 4))

export default async function (t, { rapide } = {}) {
  const p = await t.page('bureau')
  await t.exemple(p)

  for (const route of PAGES) {
    await t.aller(p, route, 900)
    await t.defiler(p, 420, 180)
    await p.waitForTimeout(500)
    const reste = await caches(p)
    t.verifie(reste.length === 0, `${route} : tout ce qui se révèle au défilement s'est révélé`, reste)
  }

  // Un volet replié garde ses graphiques pour l'ouverture : ils s'y tracent.
  await t.aller(p, 'tableau-de-bord', 900)
  const volet = p.locator('details:not([open])', { has: p.locator('.ch-watch') }).first()
  if (await volet.count()) {
    await volet.locator('summary').first().click()
    await p.waitForTimeout(300)
    await volet.locator('.ch-watch').first().scrollIntoViewIfNeeded()
    await p.waitForTimeout(900)
    const ouverts = await volet.evaluate((d) => [...d.querySelectorAll('.ch-watch')].filter((x) => {
      const r = x.getBoundingClientRect()
      return r.top < innerHeight && r.bottom > 0
    }).every((x) => x.classList.contains('is-seen')))
    t.verifie(ouverts, 'ouvrir un volet trace les graphiques qu’il contient')
  }

  // Les onglets des états financiers ont chacun leurs graphiques.
  for (const tab of ['Trésorerie', 'Bilan', 'BFR', 'Fiscalité']) {
    await t.aller(p, 'resultats', 700)
    await t.onglet(p, tab, 800)
    await t.defiler(p, 420, 180)
    await p.waitForTimeout(500)
    const reste = await caches(p)
    t.verifie(reste.length === 0, `États financiers › ${tab} : rien ne reste caché`, reste)
  }

  // Les états financiers : trois parties numérotées, quatre chiffres.
  await t.aller(p, 'resultats', 900)
  await t.onglet(p, 'Compte de résultat', 900)
  const parties = await p.$$eval('.sx > .sx-head .sx-no > b', (e) => e.map((x) => x.textContent))
  t.verifie(parties.join(',') === '01,02,03', 'les états financiers ont trois parties numérotées', parties)
  t.verifie(await p.locator('.sx-card').count() === 4, 'l’exercice se lit en quatre chiffres')
  const exacts = await p.$$eval('.sx-card .sx-big-cap', (e) => e.map((x) => x.textContent))
  t.verifie(exacts.every((x) => /année \d/i.test(x)), 'chaque chiffre porte sa valeur exacte et son année', exacts)

  // Changer d'exercice change les chiffres et la colonne surlignée.
  const lire = () => p.evaluate(() => ({
    grand: [...document.querySelectorAll('.sx-card .sx-big-val')].map((x) => x.textContent).join('|'),
    an: [...document.querySelector('.fin-an')?.classList || []].find((c) => /^fin-an-\d$/.test(c)),
    fond: (() => { const td = document.querySelector('.fin-an table.data:not(.is-monthly) tbody tr td:nth-child(5)'); return td ? getComputedStyle(td).backgroundColor : '' })(),
  }))
  const avant = await lire()
  await p.locator('.sx-year', { hasText: 'A4' }).first().click()
  await p.waitForTimeout(700)
  const apres = await lire()
  t.verifie(apres.grand !== avant.grand, 'choisir A4 change les quatre chiffres', `${avant.grand} → ${apres.grand}`)
  t.verifie(apres.an === 'fin-an-3', 'la colonne de l’année 4 est surlignée dans les tableaux', apres.an)
  t.verifie(apres.fond && apres.fond !== 'rgba(0, 0, 0, 0)', 'la colonne surlignée a un fond', apres.fond)

  // Cliquer une barre d'une carte choisit aussi l'exercice.
  await p.locator('.sx-card').first().locator('.sx-bar').nth(1).click()
  await p.waitForTimeout(600)
  t.verifie(await p.locator('.sx-year.is-on', { hasText: 'A2' }).count() === 1, 'cliquer une barre choisit son exercice')

  // L'exercice choisi suit sur les pages de saisie, qui ont leurs chiffres.
  for (const route of ['offre', 'achats', 'equipe', 'financement']) {
    await t.aller(p, route, 900)
    const n = await p.locator('.sx-card').count()
    t.verifie(n >= 3, `${route} : la page s’ouvre sur ses chiffres`, String(n))
    t.verifie(await p.locator('.sx-year.is-on', { hasText: 'A2' }).count() === 1, `${route} : l’exercice choisi a suivi`)
    const parts = await p.$$eval('.sx-no > b', (e) => e.map((x) => x.textContent))
    t.verifie(parts[0] === '01' && parts[1] === '02', `${route} : chiffres en 01, zone de travail en 02`, parts)
  }

  // Les graphiques gardent leur survol : une année s'allume, les autres s'éteignent.
  await t.aller(p, 'resultats', 900)
  const svg = p.locator('.ch svg.chart').first()
  await svg.scrollIntoViewIfNeeded()
  await p.waitForTimeout(1300)
  const box = await svg.boundingBox()
  await p.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5)
  await p.waitForTimeout(250)
  const dims = await p.locator('.ch .is-dim').count()
  t.verifie(dims > 0, 'survoler une année éteint les autres')
  t.verifie(await p.locator('.ctip.is-on').count() === 1, 'l’infobulle donne les montants exacts')

  // Au téléphone, rien ne déborde et aucun chiffre n'est coupé.
  if (!rapide) {
    const q = await t.page('telephone')
    await t.exemple(q)
    for (const route of ['resultats', 'offre', 'equipe', 'financement', 'achats']) {
      await t.aller(q, route, 900)
      await t.defiler(q, 500, 120)
      const d = await debordements(q)
      t.verifie(!d.page && d.coupes.length === 0, `téléphone › ${route} : ni débordement ni chiffre coupé`, d)
    }
    await q.fermer()
  }

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}

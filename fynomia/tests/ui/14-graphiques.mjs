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
const caches = (p) => p.evaluate(() => [...document.querySelectorAll('.ch-watch:not(.is-seen), .rv-watch:not(.is-seen), .sy-watch:not(.is-seen), .sy-vis:not(.is-seen)')]
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

  // Une image ne se joue qu'à l'arrivée : ni au chargement, ni quand seul son
  // bord supérieur dépasse du bas de l'écran — c'est ce que le fondateur
  // voyait : des graphiques déjà figés quand il arrivait dessus.
  async function arrivee(route, onglet, selecteur, libelle) {
    await t.aller(p, route, 900)
    if (onglet) await t.onglet(p, onglet, 900)
    await p.evaluate(() => window.scrollTo(0, 0))
    await p.waitForTimeout(400)
    const cible = p.locator(selecteur).first()
    if (!(await cible.count())) { t.verifie(false, `${libelle} : l’image existe`); return }
    const etat = () => cible.evaluate((x) => ({ vu: x.classList.contains('is-seen'), haut: x.getBoundingClientRect().top }))
    const e0 = await etat()
    const vh = await p.evaluate(() => window.innerHeight)
    if (e0.haut < vh * 0.8) { t.verifie(e0.vu, `${libelle} : à l’écran dès l’arrivée, jouée`); return }
    t.verifie(!e0.vu, `${libelle} : pas jouée au chargement, hors de l’écran`)
    // Seul le bord supérieur dépasse.
    await cible.evaluate((x) => window.scrollBy(0, x.getBoundingClientRect().top - window.innerHeight + 30))
    await p.waitForTimeout(500)
    t.verifie(!(await etat()).vu, `${libelle} : pas jouée quand seul son bord dépasse`)
    await cible.evaluate((x) => x.scrollIntoView({ block: 'center' }))
    await p.waitForTimeout(600)
    t.verifie((await etat()).vu, `${libelle} : jouée une fois à l’écran`)
  }
  await arrivee('resultats', 'Compte de résultat', '.fin .ch.ch-watch', 'États financiers › graphique')
  await arrivee('resultats', 'Compte de résultat', '.sx-bars.ch', 'États financiers › barres d’une carte')
  await arrivee('tableau-de-bord', 'Synthèse — essai', '.sy-act .sy-vis', 'Synthèse essai › image du premier acte')

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
  t.verifie(parties.join(',') === '01,02', 'le compte de résultat a deux parties numérotées', parties)
  t.verifie(await p.locator('.sx-card').count() === 4, 'l’exercice se lit en quatre chiffres')
  t.verifie(!(await p.locator('.netsum').count()), 'ce qui arrive sur ton compte perso n’est pas sur cet onglet')
  // Chaque onglet n'a que ses propres parties.
  for (const tab of ['Bilan', 'BFR', 'Trésorerie']) {
    await t.onglet(p, tab, 800)
    t.verifie(!(await p.locator('.sx-card').count()) && !(await p.locator('.netsum').count()), `${tab} : ni les quatre chiffres, ni le compte perso`)
  }
  await t.onglet(p, 'Ce que tu touches', 900)
  const net = await p.locator('.netsum').innerText().catch(() => '')
  t.verifie(/compte perso/i.test(net) && /ni l’argent sur le compte de ta société/i.test(net), '« Ce que tu touches » dit de quel argent il s’agit', net.slice(0, 80))
  await t.onglet(p, 'Compte de résultat', 900)
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

  // L'exercice choisi suit sur les pages de saisie, qui ont leurs chiffres —
  // en bandeau d'une ligne partout : le titre à gauche, les chiffres, puis
  // l'exercice et « Détail », qui déplie les cartes.
  for (const route of ['offre', 'achats', 'equipe', 'financement']) {
    await t.aller(p, route, 900)
    const n = await p.locator('.sx-ribbon-item').count()
    t.verifie(n >= 3, `${route} : la page montre ses chiffres en bandeau`, String(n))
    t.verifie(await p.locator('.sx-year.is-on', { hasText: 'A2' }).count() === 1, `${route} : l’exercice choisi a suivi`)
    const forme = await p.evaluate(() => {
      const r = document.querySelector('.sx-ribbon')
      const t = r?.querySelector('.sx-ribbon-title'), i = r?.querySelector('.sx-ribbon-item')
      return {
        haut: r ? r.getBoundingClientRect().height : 0,
        titreAGauche: !!t && !!i && t.getBoundingClientRect().right <= i.getBoundingClientRect().left + 1 && Math.abs(t.getBoundingClientRect().top - i.getBoundingClientRect().top) < 40,
        pastille: !!document.querySelector('.module-figure'),
        info: !!document.querySelector('.module-top .info-point'),
        texteInfo: !!document.querySelector('.module-why-text'),
        cote: !!document.querySelector('.saisie-aside'),
      }
    })
    t.verifie(forme.haut < 120, `${route} : les chiffres tiennent sur une ligne`, `${Math.round(forme.haut)} px`)
    t.verifie(forme.titreAGauche, `${route} : le titre est à gauche des chiffres, sur la même ligne`)
    t.verifie(!forme.pastille && !forme.cote, `${route} : ni pastille de total répétée, ni colonne à droite`)
    t.verifie(forme.info && !forme.texteInfo, `${route} : l’explication du module est un « i », sans texte à côté du titre`)
  }
  await t.aller(p, 'achats', 900)
  await p.locator('.sx-ribbon-more').click()
  await p.waitForTimeout(600)
  t.verifie(await p.locator('.sx.is-bandeau .sx-card').count() >= 3, 'achats : « Détail » déplie les cartes')

  // Cliquer une année d'une carte descend dans ses douze mois ; « ← 5 ans »
  // remonte. Les mois additionnés redonnent l'année.
  await t.aller(p, 'offre', 900)
  await p.locator('.sx-ribbon-more').click()
  await p.waitForTimeout(700)
  const carte = p.locator('.sx-card').first()
  await carte.scrollIntoViewIfNeeded()
  await p.waitForTimeout(800)
  await carte.locator('.sx-bar').nth(1).click()
  await p.waitForTimeout(700)
  const mois = await p.locator('.sx-card').first().locator('.sx-bars.is-zoom .sx-bar').count()
  t.verifie(mois === 12, 'un clic sur une année montre ses douze mois', String(mois))
  await p.locator('.sx-card').first().locator('.sx-unzoom').click()
  await p.waitForTimeout(600)
  t.verifie(await p.locator('.sx-card').first().locator('.sx-bars:not(.is-zoom) .sx-bar').count() === 5, '« ← 5 ans » ramène aux cinq exercices')
  const juste = await p.evaluate(async () => {
    const st = (await import('./js/state/store.js')).default
    const r = st.result
    return [0, 1, 2, 3, 4].every((y) => Math.abs(r.revenue.monthly.slice(y * 12, y * 12 + 12).reduce((a, b) => a + b, 0) - r.pnl.revenue[y]) < 1)
  })
  t.verifie(juste, 'les douze mois additionnés redonnent le chiffre d’affaires de l’année')

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

  // Au téléphone, rien ne déborde et aucun chiffre n'est coupé ; les barres
  // d'une carte empilée sous l'écran attendent qu'on arrive dessus.
  if (!rapide) {
    const q = await t.page('telephone')
    await t.exemple(q)
    // Les pages de saisie replient leurs cartes dans le bandeau : les états
    // financiers, eux, les empilent.
    await t.aller(q, 'resultats', 900)
    const barres = q.locator('.sx-bars.ch').nth(2)
    const avant = await barres.evaluate((x) => ({ vu: x.classList.contains('is-seen'), haut: x.getBoundingClientRect().top, vh: window.innerHeight }))
    t.verifie(avant.haut > avant.vh && !avant.vu, 'téléphone : les barres de la troisième carte attendent sous l’écran', avant)
    await barres.evaluate((x) => window.scrollBy(0, x.getBoundingClientRect().top - window.innerHeight + 20))
    await q.waitForTimeout(500)
    t.verifie(!(await barres.evaluate((x) => x.classList.contains('is-seen'))), 'téléphone : pas jouées quand seul leur bord dépasse')
    await barres.evaluate((x) => x.scrollIntoView({ block: 'center' }))
    await q.waitForTimeout(600)
    t.verifie(await barres.evaluate((x) => x.classList.contains('is-seen')), 'téléphone : jouées une fois à l’écran')
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

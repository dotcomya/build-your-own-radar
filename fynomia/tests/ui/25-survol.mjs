/**
 * Dans le récit du pitch, chaque donnée se consulte au survol.
 *
 * Les deux dessins de tête (cinq barres de chiffre d'affaires, soixante mois
 * de trésorerie), la trajectoire du chiffre d'affaires, la cascade du
 * résultat, la courbe de trésorerie et chaque barre des chapitres : au
 * survol, une infobulle dit la période, l'intitulé et la valeur exacte —
 * celle du moteur, pas l'arrondi affiché.
 */
export const nom = 'Survol — chaque donnée du récit dit sa période, son intitulé, sa valeur exacte'

export default async function (t) {
  const p = await t.page('bureau')
  await t.exemple(p)
  await t.aller(p, 'tableau-de-bord')
  await t.onglet(p, 'Pitch investisseur')
  await p.locator('.pitch-mise', { hasText: 'Récit' }).first().click()
  await t.pose(p)
  await t.defiler(p)

  const attendu = await p.evaluate(async () => {
    const { euro } = await import('./js/ui/dom.js')
    const { monthLabel } = await import('./js/format.js')
    const r = (await import('./js/state/store.js')).default.result
    return {
      ca: r.pnl.revenue.map((v) => euro(v)),
      net: r.pnl.netResult.map((v) => euro(v)),
      treso: r.cash.balance.map((v) => euro(v)),
      mois: r.cash.balance.map((_, m) => monthLabel(m, r.startDate)),
      annees: [0, 1, 2, 3, 4].map((y) => `${monthLabel(y * 12, r.startDate)} – ${monthLabel(y * 12 + 11, r.startDate)}`),
    }
  })

  /** Survoler une zone et lire l'infobulle : sa tête, puis ses lignes. */
  async function lire(zone) {
    await zone.scrollIntoViewIfNeeded()
    await zone.hover({ force: true })
    await p.locator('.ctip.is-on').waitFor({ timeout: 2000 }).catch(() => {})
    return p.evaluate(() => {
      const e = document.querySelector('.ctip.is-on')
      if (!e) return null
      return {
        tete: e.querySelector('.ctip-head')?.textContent || '',
        lignes: [...e.querySelectorAll('.ctip-row')].map((x) => [x.querySelector('.ctip-label')?.textContent || '', x.querySelector('.ctip-value')?.textContent || '']),
      }
    })
  }
  const bien = (b) => !!b && b.tete.length > 3 && b.lignes.length > 0 && b.lignes[0][0].length > 2 && /\d/.test(b.lignes[0][1])

  // Les cinq barres de tête : l'exercice, ses mois, le montant exact.
  const tete = p.locator('.pitch-hero .rvl-svg')
  const zonesCa = tete.nth(0).locator('.chart-hot')
  t.verifie(await zonesCa.count() === 5, 'les cinq barres de tête ont chacune leur zone', await zonesCa.count())
  const ca = []
  for (let i = 0; i < 5; i++) ca.push(await lire(zonesCa.nth(i)))
  t.verifie(ca.every((b, i) => bien(b) && b.tete.includes(`Année ${i + 1}`) && b.tete.includes(attendu.annees[i]) && b.lignes[0][1] === attendu.ca[i]),
    'chaque barre : « Année N · mois – mois », chiffre d’affaires exact', ca.map((b) => b && `${b.tete} ${b.lignes[0]?.join(' ')}`))

  // Les soixante mois de trésorerie.
  const zonesTreso = tete.nth(1).locator('.chart-hot')
  t.verifie(await zonesTreso.count() === 60, 'les soixante mois de trésorerie ont chacun leur zone', await zonesTreso.count())
  const mois = [0, 10, 23, 59]
  const treso = []
  for (const m of mois) treso.push(await lire(zonesTreso.nth(m)))
  t.verifie(treso.every((b, i) => bien(b) && b.tete.includes(attendu.mois[mois[i]]) && b.lignes[0][1] === attendu.treso[mois[i]]),
    'chaque mois : sa date, la trésorerie exacte en fin de mois', treso.map((b) => b && `${b.tete} ${b.lignes[0]?.join(' ')}`))

  // La trajectoire du chiffre d'affaires (chapitre 1).
  const traj = p.locator('.as-chap[data-chapitre="1"] .as-dessin .chart').first().locator('.chart-hot')
  const a3 = await lire(traj.nth(2))
  t.verifie(bien(a3) && a3.tete.includes('Année 3') && a3.lignes.some(([l, v]) => /Chiffre/.test(l) && v === attendu.ca[2]),
    'la trajectoire : l’année 3 et son chiffre d’affaires exact', a3)

  // La cascade du résultat (chapitre 2) : chaque étape, son montant exact.
  const etapes = p.locator('.as-chap[data-chapitre="2"] .as-cascade-l')
  const ne = await etapes.count()
  const derniere = ne ? await lire(etapes.nth(ne - 1)) : null
  const premiere = ne ? await lire(etapes.nth(0)) : null
  t.verifie(ne >= 5 && bien(premiere) && premiere.lignes[0][1] === attendu.ca[0] && bien(derniere) && /Résultat net/.test(derniere.lignes[0][0]) && derniere.lignes[0][1] === attendu.net[0],
    'la cascade : du chiffre d’affaires au résultat net, montants exacts', { premiere, derniere })

  // La trésorerie (chapitre 7) : un mois par zone, le solde exact.
  const j = p.locator('.as-chap[data-chapitre="7"] > .as-dessin svg.as-j .chart-hot')
  const nj = await j.count()
  const j0 = nj ? await lire(j.nth(0)) : null
  const jn = nj ? await lire(j.nth(nj - 1)) : null
  t.verifie(nj >= 12 && nj % 12 === 0 && bien(j0) && bien(jn) && j0.tete.includes(attendu.mois[0]) && jn.tete.includes(attendu.mois[nj - 1])
    && /Trésorerie/.test(j0.lignes[0][0]) && j0.lignes[0][1] === attendu.treso[0] && jn.lignes[0][1] === attendu.treso[nj - 1],
    'la trésorerie : chaque mois de la fenêtre, sa date et son solde exact', { nj, j0, jn })

  // Chaque barre visible des chapitres ; le détail replié attend qu'on l'ouvre.
  const barres = p.locator('.as-chap .as-barre:visible')
  const nb = await barres.count()
  const lues = []
  for (let i = 0; i < nb; i++) lues.push(await lire(barres.nth(i)))
  const muettes = lues.map((b, i) => (bien(b) ? null : i)).filter((x) => x !== null)
  t.verifie(nb >= 10 && muettes.length === 0, 'chaque barre des chapitres a son infobulle : période, intitulé, valeur', { nb, muettes })
  t.verifie(lues.every((b) => !b || /\d{2}/.test(b.tete) || /Année|mois|M\d/.test(b.tete)), 'chaque infobulle nomme sa période', lues.map((b) => b?.tete))

  // Quitter la zone éteint l'infobulle.
  await p.mouse.move(2, 2)
  await p.locator('.ctip.is-on').waitFor({ state: 'detached', timeout: 2000 }).catch(() => {})
  t.verifie(!(await p.locator('.ctip.is-on').count()), 'l’infobulle s’éteint quand on quitte le graphique')

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}

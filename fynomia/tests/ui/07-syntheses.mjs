/**
 * Les deux synthèses : elles bougent avec le plan, et disent la même chose.
 *
 * — la synthèse change quand on change une charge ou un salaire ;
 * — le détail du pitch suit l'ordre du récit : le chiffre d'affaires et le
 *   résultat d'abord, les six chiffres à connaître, puis une partie pour
 *   chacun ; ses chiffres sont ceux du moteur et du récit ;
 * — chaque bloc du détail se trace en défilant, et rien ne déborde.
 */
export const nom = 'Synthèses — recalcul, texte partagé, défilement'

const norm = (s) => String(s || '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim()

export default async function (t) {
  // 1. La synthèse suit les chiffres.
  {
    const p = await t.page('large')
    await t.exemple(p)
    // La synthèse s'ouvre sur le récit, une scène à la fois : on lit toutes
    // les scènes, pas seulement celle qui est à l'écran.
    const lire = async () => { await t.aller(p, 'tableau-de-bord'); return p.evaluate(() => (document.querySelector('.pitch .as') || {}).textContent || '') }
    const a = await lire()
    t.verifie(a.length > 200, 'la synthèse est rendue')
    await t.aller(p, 'achats')
    const f = p.locator('.cost-row input[inputmode=decimal], .cost-row input[inputmode=numeric]').first()
    await f.fill('35000'); await f.blur(); await t.pose(p)
    const b = await lire()
    t.verifie(a !== b, 'une charge décuplée change la synthèse')
    await t.aller(p, 'equipe')
    if (!(await p.locator('.item.open').count())) { await p.locator('.item-head').first().click(); await p.locator('.item.open').first().waitFor(); await t.pose(p) }
    const s = p.locator('.postline input[inputmode=decimal], .postline input[inputmode=numeric]').first()
    await s.fill('150000'); await s.blur(); await t.pose(p)
    const c = await lire()
    t.verifie(b !== c, 'un salaire changé change la synthèse')
    t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
    await p.fermer()
  }

  // 2 et 3. Le détail suit l'ordre du récit, dit les chiffres du moteur, et se trace au défilement.
  const PARTIES = ['Chiffre d’affaires et résultat', 'D’où vient le chiffre d’affaires', 'Économie d’une vente', 'Structure des coûts',
    'Équipe et masse salariale', 'Trésorerie', 'Financement', 'Hypothèses et risques', 'Analyse détaillée']
  const SIX = ['Chiffre d’affaires', 'Résultat net', 'Marge brute', 'Point mort', 'Cash minimum', 'Besoin de financement']
  for (const format of ['bureau', 'telephone']) {
    const p = await t.page(format)
    await t.exemple(p)
    await t.aller(p, 'tableau-de-bord')
    await t.onglet(p, 'essai')
    const moteur = await p.evaluate(async () => {
      const { euro } = await import('./js/ui/dom.js')
      const r = (await import('./js/state/store.js')).default.result
      const c = (v) => euro(v, { compact: Math.abs(v) >= 100000 })
      return { ca: c(r.pnl.revenue[0]), net: c(r.pnl.netResult[0]), besoin: euro(r.kpis.fundingNeed), caC: euro(r.pnl.revenue[0], { compact: true }) }
    })
    const lu = await p.evaluate(() => {
      const sy = document.querySelector('.pitch.is-detail .sy')
      const blocs = [...sy.children].map((x) => x.id || x.className.split(' ')[0])
      return {
        blocs,
        intro: (sy.querySelector('#sy-intro')?.textContent || '').replace(/\s+/g, ' '),
        six: [...sy.querySelectorAll('#sy-chiffres .sy-fig-label')].map((x) => x.textContent.trim()),
        sixVal: [...sy.querySelectorAll('#sy-chiffres .sy-fig-val')].map((x) => x.textContent.trim()),
        parties: [...sy.querySelectorAll('.sy-chapitre > .sy-act-head .sy-act-no > span, .sy-chapitre > .sy-act-no > span')].map((x) => x.textContent.trim()),
        fonds: [...sy.querySelectorAll('.sy-ed')].map((x) => getComputedStyle(x).backgroundColor),
      }
    })
    t.verifie(lu.blocs[0] === 'sy-intro' && lu.blocs[1] === 'sy-chiffres', `${format} : le détail s’ouvre sur le chiffre d’affaires et le résultat, puis les six chiffres`, lu.blocs.slice(0, 3))
    const intro = norm(lu.intro)
    t.verifie(intro.includes(norm(moteur.ca)) && intro.includes(norm(moteur.net)) && /marge nette/.test(intro) && intro.indexOf(norm(moteur.besoin)) > intro.indexOf(norm(moteur.net)),
      `${format} : l’ouverture dit le chiffre d’affaires, le résultat et la marge, puis le besoin de financement`, lu.intro.slice(0, 160))
    t.verifie(JSON.stringify(lu.six) === JSON.stringify(SIX) && lu.sixVal[0] === moteur.caC, `${format} : les six chiffres à connaître, dans l’ordre`, lu.six)
    t.verifie(JSON.stringify(lu.parties) === JSON.stringify(PARTIES), `${format} : les neuf parties, dans l’ordre du récit`, lu.parties)
    t.verifie(lu.fonds.length >= 7 && lu.fonds.every((f) => f === 'rgba(0, 0, 0, 0)'), `${format} : des parties en article, sans panneau blanc`, lu.fonds.slice(0, 2))

    const attendent = await p.evaluate(() => [...document.querySelectorAll('.sy-watch')].filter((x) => !x.classList.contains('is-seen')).length)
    t.verifie(attendent > 0, `${format} : des blocs attendent d’être vus avant le défilement`, `${attendent}`)
    await t.defiler(p)
    // Chaque bloc guetté se trace quand il entre à l'écran : on attend qu'ils l'aient tous fait.
    await p.waitForFunction(() => [...document.querySelectorAll('.sy-watch')].every((x) => x.classList.contains('is-seen')), null, { timeout: 4000 }).catch(() => {})
    await t.pose(p)
    const restent = await p.evaluate(() => [...document.querySelectorAll('.sy-watch')].filter((x) => !x.classList.contains('is-seen')).map((x) => x.dataset.guet))
    t.verifie(!restent.length, `${format} : tous les blocs se sont tracés au défilement`, restent)
    // « Doit rester fixé pour naviguer entre chaque partie » : en bas du
    // détail, le sommaire est toujours à l'écran (sauf sur téléphone, où il
    // ouvre la page).
    const sommaire = await p.evaluate(() => { const b = document.querySelector('.sy-sommaire').getBoundingClientRect(); return { haut: Math.round(b.top), bas: Math.round(b.bottom), allume: document.querySelector('.sy-sommaire button.is-on')?.dataset.cle || null } })
    if (format !== 'telephone') t.verifie(sommaire.haut > 0 && sommaire.bas < 400 && !!sommaire.allume, `${format} : le sommaire reste fixé en haut et allume la partie lue`, sommaire)
    const hors = await p.evaluate(() => ({ page: document.documentElement.scrollWidth > innerWidth + 1,
      blocs: [...document.querySelectorAll('.sy *')].filter((x) => x.getBoundingClientRect().right > innerWidth + 1 && !x.closest('.sy-ex, .as-table-wrap, .table-wrap')).map((x) => x.className).slice(0, 3) }))
    t.verifie(!hors.page && !hors.blocs.length, `${format} : rien ne déborde dans le détail`, hors)
    t.verifie(p.erreurs.length === 0, `${format} : aucune erreur JavaScript`, p.erreurs.slice(0, 2))
    await p.fermer()
  }
}

/**
 * Les deux synthèses : elles bougent avec le plan, et disent la même chose.
 *
 * — la synthèse d'origine change quand on change une charge ou un salaire ;
 * — l'essai porte exactement les mêmes lectures, mot pour mot ;
 * — chaque bloc de l'essai se trace en défilant, et rien ne déborde.
 */
export const nom = 'Synthèses — recalcul, texte partagé, défilement'

const norm = (s) => String(s || '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim()

export default async function (t) {
  // 1. La synthèse d'origine suit les chiffres.
  {
    const p = await t.page('large')
    await t.exemple(p)
    const lire = async () => { await t.aller(p, 'tableau-de-bord'); return p.evaluate(() => (document.querySelector('.plain') || {}).innerText || '') }
    const a = await lire()
    t.verifie(a.length > 200, 'la synthèse d’origine est rendue')
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

  // 2 et 3. L'essai dit la même chose que l'original, et se trace au défilement.
  for (const format of ['bureau', 'telephone']) {
    const p = await t.page(format)
    await t.exemple(p)
    await t.aller(p, 'tableau-de-bord')
    const orig = await p.evaluate(() => [...document.querySelectorAll('.plaincard')].map((c) => [
      c.querySelector('.plaincard-kicker').textContent, c.querySelector('.plaincard-title').textContent, c.querySelector('.plaincard-body').textContent]))
    const actesO = await p.evaluate(() => [...document.querySelectorAll('.plain-act-title')].map((x) => x.textContent))
    await t.onglet(p, 'essai')
    const essai = await p.evaluate(() => [...document.querySelectorAll('.sy-card, .sy-feature-main, .sy-fact, .sy-band-say')].map((c) => [
      c.querySelector('.sy-card-kicker').textContent,
      (c.querySelector('.sy-card-title, .sy-feature-title, .sy-fact-title') || {}).textContent,
      (c.querySelector('.sy-card-body') || {}).textContent]))
    // Les trois actes du récit ; les parties 04 et 05 (chiffres clés, détail
    // des comptes) reprennent leur style mais ne sont pas partagées.
    const actesE = await p.evaluate(() => [...document.querySelectorAll('.sy-act:not(.sy-figs):not(.sy-deep) > .sy-act-head .sy-act-title')].map((x) => x.textContent))
    const cle = (l) => l.map((x) => x.map(norm).join(' | ')).sort()
    const o = cle(orig), e = cle(essai)
    t.verifie(o.length >= 5 && o.length === e.length, `${format} : l’essai porte autant de lectures que l’original`, `${o.length} / ${e.length}`)
    const manquent = o.filter((x) => !e.includes(x))
    t.verifie(!manquent.length, `${format} : texte des lectures identique`, manquent[0]?.slice(0, 120))
    t.verifie(JSON.stringify(actesO.map(norm)) === JSON.stringify(actesE.map(norm)), `${format} : titres d’actes identiques`, { actesO, actesE })

    const attendent = await p.evaluate(() => [...document.querySelectorAll('.sy-watch')].filter((x) => !x.classList.contains('is-seen')).length)
    t.verifie(attendent > 0, `${format} : des blocs attendent d’être vus avant le défilement`, `${attendent}`)
    await t.defiler(p)
    // Chaque bloc guetté se trace quand il entre à l'écran : on attend qu'ils l'aient tous fait.
    await p.waitForFunction(() => [...document.querySelectorAll('.sy-watch')].every((x) => x.classList.contains('is-seen')), null, { timeout: 4000 }).catch(() => {})
    await t.pose(p)
    const restent = await p.evaluate(() => [...document.querySelectorAll('.sy-watch')].filter((x) => !x.classList.contains('is-seen')).map((x) => x.dataset.guet))
    t.verifie(!restent.length, `${format} : tous les blocs se sont tracés au défilement`, restent)
    const hors = await p.evaluate(() => ({ page: document.documentElement.scrollWidth > innerWidth + 1,
      blocs: [...document.querySelectorAll('.sy *')].filter((x) => x.getBoundingClientRect().right > innerWidth + 1 && !x.closest('.sy-ex')).map((x) => x.className).slice(0, 3) }))
    t.verifie(!hors.page && !hors.blocs.length, `${format} : rien ne déborde dans l’essai`, hors)
    t.verifie(p.erreurs.length === 0, `${format} : aucune erreur JavaScript`, p.erreurs.slice(0, 2))
    await p.fermer()
  }
}

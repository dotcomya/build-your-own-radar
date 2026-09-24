/**
 * Quatre lectures du même projet : mêmes faits, écriture différente, aucun
 * personnage.
 *
 * Les lecteurs imaginés — une équipe, un consultant en finance, une salle
 * pressée, un fonds ou une banque — guident la rédaction ; ils ne sont jamais
 * nommés à l'écran, et personne n'y parle. On vérifie :
 *
 *   1. qu'aucune des quatre formes ne nomme un lecteur, ne cite un
 *      questionneur entre guillemets, ni ne garde le bloc « Le dire à » ;
 *   2. que les faits clés — le besoin de financement, le mois du point bas,
 *      le premier exercice bénéficiaire, le chiffre d'affaires de l'année 5 —
 *      se lisent dans chacune, identiques ;
 *   3. que chacune a son registre : l'essentiel en clair dans le récit, des
 *      métriques exactes avec leur base dans le tableau, une phrase courte par
 *      diapositive, les hypothèses et leurs justifications dans le détail.
 */
export const nom = 'Formats du pitch — mêmes faits, quatre écritures, aucun personnage'

const PERSONNAGES = /\b(banquiers?|investisseurs?|business angels?|VC|financeurs?|associés)\b/i

export default async function (t) {
  const p = await t.page('bureau')
  await t.exemple(p)
  await t.aller(p, 'tableau-de-bord')
  await t.onglet(p, 'Pitch investisseur')

  const faits = await p.evaluate(async () => {
    const { euro, monthLabel } = await import('./js/ui/dom.js')
    const r = (await import('./js/state/store.js')).default.result
    const k = r.kpis
    return {
      besoin: euro(k.fundingNeed),
      mois: monthLabel(k.cashLow.month, r.startDate),
      premier: k.firstProfitableYear,
      ca5: euro(r.pnl.revenue[4], { compact: true }),
      ca5Exact: euro(r.pnl.revenue[4]),
    }
  })

  const choisir = async (mise) => {
    await p.locator('.pitch-mise', { hasText: mise }).first().click()
    await p.locator('.pitch-mise.is-on', { hasText: mise }).first().waitFor({ timeout: 3000 }).catch(() => {})
    await t.pose(p)
  }
  const lire = async (mise) => {
    await choisir(mise)
    await t.defiler(p)
    // « En détail » déplie aussi le glossaire, qui définit les notions — et dit
    // par exemple qui lit l'EBE ; ce n'est pas l'écriture du pitch. On y lit
    // les titres, les accroches et les questions.
    return p.evaluate(() => {
      const racine = document.querySelector('.pitch')
      return { texte: racine.innerText, titres: [...racine.querySelectorAll('h1, h2, h3, h4, .rvl-kicker, .as-dire-titre, .avis-question span, .sy-act-say')].map((x) => x.textContent).join('\n') }
    })
  }
  const formes = {}
  for (const mise of ['Récit', 'Tableau', 'Diapos', 'En détail']) formes[mise] = await lire(mise)

  // 1. Aucun lecteur nommé, aucun personnage.
  for (const [mise, f] of Object.entries(formes)) {
    const texte = mise === 'En détail' ? f.titres : f.texte
    const nomme = texte.match(PERSONNAGES)
    t.verifie(!nomme, `${mise} : aucun lecteur nommé`, nomme?.[0])
    t.verifie(!/On te demandera|Le dire à/i.test(f.texte), `${mise} : ni « On te demandera », ni « Le dire à »`)
  }

  // 2. Les mêmes faits, partout.
  for (const [mise, f] of Object.entries(formes)) {
    const txt = f.texte
    const premier = faits.premier === null ? /aucun|pas de bénéfice/i : new RegExp(`ann[ée]e\\s${faits.premier + 1}`, 'i')
    t.verifie(txt.includes(faits.besoin) && txt.includes(faits.mois) && premier.test(txt) && (txt.includes(faits.ca5) || txt.includes(faits.ca5Exact)),
      `${mise} : besoin, point bas, premier bénéfice et chiffre d’affaires de l’année 5, identiques`,
      { besoin: txt.includes(faits.besoin), mois: txt.includes(faits.mois), premier: premier.test(txt), ca5: txt.includes(faits.ca5) || txt.includes(faits.ca5Exact) })
  }

  // 3. Chaque forme a son registre.
  await choisir('Récit')
  const clairs = await p.$$eval('.as-chap > .as-clair', (e) => e.map((x) => x.textContent.trim()))
  const conclusions = await p.$$eval('.as-chap > .as-conclusion', (e) => e.map((x) => x.textContent.trim()))
  t.verifie(clairs.length === 9 && conclusions.length === 9 && clairs.every((c) => c.length > 40 && !/\bje\b|\bj’|\bnous\b|\bnotre\b/i.test(c)),
    'récit : une conclusion et une phrase d’interprétation par chapitre, sans « je » ni « nous »', clairs.map((c) => c.slice(0, 50)))
  t.verifie(conclusions.every((c) => c.split(/[.!?](\s|$)/).filter((x) => x && x.trim()).every((ph) => ph.split(/\s+/).length <= 34)),
    'récit : des phrases courtes, une idée chacune', conclusions.map((c) => c.slice(0, 40)))

  await choisir('Tableau')
  const fiches = await p.$$eval('.pz-cockpit .pitch-tuile', (e) => e.map((x) => ({
    constat: (x.querySelector('.pz-verdict')?.textContent || '').trim(),
    lignes: [...x.querySelectorAll('.pz-fiche-l')].map((l) => ({ v: l.querySelector('dd b')?.textContent || '', base: l.querySelector('dd small')?.textContent || '' })),
  })))
  const chiffrees = fiches.flatMap((f) => f.lignes).filter((l) => /\d/.test(l.v))
  t.verifie(fiches.length === 8 && fiches.every((f) => f.lignes.length >= 2 && /\d/.test(f.constat)) && chiffrees.length >= 18 && chiffrees.filter((l) => l.base).length >= 12,
    'tableau : chaque partie en métriques exactes, avec leur période ou leur base de calcul', { lignes: chiffrees.length, avecBase: chiffrees.filter((l) => l.base).length })
  t.verifie(fiches.some((f) => f.lignes.some((l) => /\d,\d\s%/.test(l.v))), 'tableau : les taux au dixième près')

  await choisir('Diapos')
  const phrases = await p.$$eval('.pitch-diapo.is-clair .pz-diapo-recit', (e) => e.map((x) => x.textContent.trim()))
  t.verifie(phrases.length === 8 && phrases.every((x) => x.length > 15 && x.length <= 160), 'diapos : une phrase courte par diapositive', phrases.map((x) => x.length))
  const notes = await p.$$eval('.pz-note', (e) => e.map((x) => x.textContent))
  t.verifie(notes.every((x) => !/[«»]/.test(x.replace(/« [^»]+ »/g, (m) => (m.length < 40 ? '' : m)))), 'diapos : la note d’orateur ne cite personne entre guillemets')

  await choisir('En détail')
  const hyp = await p.$$eval('#sy-hypotheses tbody tr', (e) => e.map((x) => ({
    h: x.children[0]?.textContent.trim(), v: x.children[1]?.textContent.trim(), j: x.children[2]?.textContent.trim(),
  })))
  t.verifie(hyp.length >= 6 && hyp.every((x) => x.h && x.v && x.j && x.j.length > 30), 'en détail : les hypothèses du plan, chacune avec sa valeur et sa justification', hyp.map((x) => x.h))
  t.verifie(hyp.some((x) => /repère du métier/.test(x.j) && /\d{4}/.test(x.j)), 'en détail : une hypothèse située par un repère du métier, source et année citées')

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}

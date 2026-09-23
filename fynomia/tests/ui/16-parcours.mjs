/**
 * Le parcours d'accueil, de la première question au pitch.
 *
 * On répond aux questions comme un fondateur et on vérifie :
 *
 *   1. aucune question ne s'ouvre sur un chiffre déjà tapé ni sur une case
 *      déjà cochée — le repère du métier s'écrit dessous, en indication ;
 *   2. la dernière réponse mène à la page « ton business prend forme », qui
 *      ne se voit qu'une fois, puis au pitch investisseur ;
 *   3. ce qui est proposé ensuite suit un seul ordre, le même pour le guide
 *      et le pilotage : relire ce que le parcours a posé, puis le plus
 *      important — jamais les délais de paiement ou la hausse des prix en
 *      tête, et jamais ce qui est déjà rempli.
 */
export const nom = 'Parcours — rien de pré-rempli, puis le business qui prend forme'

export default async function (t) {
  const p = await t.page('bureau')
  await t.metier(p, 'Pizzeria')

  const etat = () => p.evaluate(() => ({
    q: document.querySelector('.setup-q')?.textContent || '',
    remplis: [...document.querySelectorAll('.setup-input')].filter((i) => i.value.trim() !== '').length,
    coches: document.querySelectorAll('.setup-cost.on, .setup-choice.active, .stagepick.active').length,
  }))
  const vus = []
  for (let k = 0; k < 16; k++) {
    if (p.url().includes('ton-business')) break
    const e = await etat()
    vus.push(e)
    const q = e.q
    if (/en est ton projet/.test(q)) await p.locator('.stagepick').first().click()
    else if (/appelle/.test(q)) await p.locator('.setup-input').fill('Pizza Nonna')
    else if (/Sous quelle forme/.test(q)) await p.locator('.setup-choice').first().click()
    else if (/démarres avec combien/.test(q)) await p.locator('.setup-input').fill('15000')
    else if (/produit phare/.test(q)) await p.locator('.setup-input').fill('Pizza napolitaine')
    else if (/client paie/.test(q)) { await p.locator('.setup-choice').first().click(); await p.waitForTimeout(200); await p.locator('.setup-input').fill('14') }
    else if (/te paies combien/.test(q)) await p.locator('.setup-input').fill('24000')
    else if (/frais tous les mois/.test(q)) { await p.locator('.setup-cost-toggle').nth(0).click(); await p.locator('.setup-cost-toggle').nth(3).click() }
    else if (/vends-tu le premier mois/.test(q)) await p.locator('.setup-input').fill('900')
    else if (/elle te coûte combien/.test(q)) await p.locator('.setup-cost-toggle').first().click()
    else if (/quelle vitesse/.test(q)) await p.locator('.setup-choice').nth(1).click()
    await p.waitForTimeout(200)
    await p.locator('.setup-actions .btn-primary').click()
    await p.waitForTimeout(450)
  }
  t.verifie(vus.some((e) => /produit phare/.test(e.q)) && vus.some((e) => /Comment ton client paie « Pizza napolitaine »/.test(e.q)), 'on demande le produit phare, puis comment le client le paie', vus.map((e) => e.q))
  const pleins = vus.filter((e) => e.remplis || e.coches)
  t.verifie(vus.length >= 10, 'le parcours pose ses questions', String(vus.length))
  t.verifie(pleins.length === 0, 'aucune question ne s’ouvre pré-remplie ni cochée', pleins.map((e) => e.q))

  // 2. Le business qui prend forme, une seule fois.
  t.verifie(p.url().includes('#/ton-business'), 'la dernière réponse mène à « ton business prend forme »', p.url())
  await p.waitForTimeout(1500)
  const rv = await p.evaluate(() => ({
    nom: document.querySelector('.rvl-name')?.textContent || '',
    barres: document.querySelectorAll('.rvl-bar').length,
    courbe: !!document.querySelector('.rvl-line'),
    pieces: document.querySelectorAll('.rvl-piece').length,
  }))
  t.verifie(/Pizza/.test(rv.nom) && rv.barres === 5 && rv.courbe && rv.pieces === 5, 'la page montre le nom, cinq ans de chiffre d’affaires, la trésorerie et les pièces du dossier', rv)
  await p.locator('.rvl-cta').click()
  await p.waitForTimeout(1300)
  t.verifie(p.url().endsWith('#/tableau-de-bord') && await p.locator('.pitch').count() === 1, 'puis elle emmène au pitch investisseur')
  await t.aller(p, 'ton-business', 900)
  t.verifie(!p.url().includes('ton-business') && !(await p.locator('.rvl').count()), 'elle ne se revoit pas')

  // 3. Un seul ordre, le même partout.
  const ordre = await p.evaluate(async () => {
    const m = await import('./js/ui/checklist.js')
    const c = m.checklist()
    return { next: c.next && { key: c.next.key, relire: c.next.relire }, file: c.file.map((i) => i.key), faits: c.items.filter((i) => i.done && !i.relire).map((i) => i.key) }
  })
  t.verifie(ordre.next?.relire && ordre.next.key === 'prix', 'la première chose proposée est de relire son prix', ordre.next)
  t.verifie(ordre.file.indexOf('delai') < 0 || ordre.file.indexOf('delai') > 8, 'les délais de paiement ne viennent pas en tête', ordre.file.slice(0, 10))
  t.verifie(!ordre.file.includes('prixAnnee'), 'la hausse des prix est facultative : jamais proposée d’office', ordre.file)
  t.verifie(!ordre.file.some((k) => ordre.faits.includes(k)), 'rien de ce qui est déjà rempli n’est reproposé', ordre.file)
  const guide = (await p.locator('.nextstep-do').innerText().catch(() => '')).trim()
  const tag = (await p.locator('.nextstep-tag').innerText().catch(() => '')).trim()
  t.verifie(/prix/i.test(guide) && /relire/i.test(tag), 'le guide propose la même chose : relire le prix', `${tag} · ${guide}`)
  await t.onglet(p, 'Pilotage', 900)
  const pilote = (await p.locator('.refinery-item.is-next .refinery-label').first().innerText().catch(() => '')).trim()
  t.verifie(pilote === guide, 'le pilotage met en avant la même ligne que le guide', `${pilote} / ${guide}`)
  // Relire, c'est valider : y aller la retire de la tête de file.
  await p.locator('.nextstep-go').click()
  await p.waitForTimeout(1500)
  const apres = await p.evaluate(async () => (await import('./js/ui/checklist.js')).checklist().next?.key)
  t.verifie(apres && apres !== 'prix', 'une fois relu, le prix laisse la place à la suite', apres)

  // Une date de début déjà remplie se valide d'un clic, et compte.
  await t.aller(p, 'projet', 900)
  const valider = p.locator('[data-gap="demarrage"] .valider-chip')
  t.verifie(await valider.count() === 1, 'la date de début propose « Valider cette date »')
  await valider.click()
  await p.waitForTimeout(700)
  const date = await p.evaluate(async () => (await import('./js/ui/checklist.js')).checklist().items.find((i) => i.key === 'demarrage'))
  t.verifie(date?.done && !(await p.locator('[data-gap="demarrage"] .valider-chip').count()), 'une fois validée, la date de début compte comme faite', date?.label)
  // Le régime de TVA mène à la TVA, pas au statut juridique.
  const tva = await p.evaluate(async () => (await import('./js/ui/checklist.js')).checklist().items.find((i) => i.key === 'tva'))
  t.verifie(tva?.go?.anchor === 'tva' && await p.locator('[data-gap="tva"] .tva-pick').count() === 2, 'la ligne TVA mène à son propre champ', tva?.go)
  const libelles = await p.evaluate(async () => (await import('./js/ui/checklist.js')).checklist().items.filter((i) => !i.done).map((i) => i.label))
  t.verifie(libelles.every((l) => /^(Choisir|Nommer|Fixer|Estimer|Chiffrer|Lister|Indiquer|Prévoir|Valider|Ajouter|Décrire|Préciser)\b/.test(l)), 'chaque ligne à faire commence par un verbe d’action', libelles)

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}

/**
 * Un chiffre hors de proportion avec le métier se dit — et le verdict change.
 *
 * Un prix de couvert à 24 000 € au lieu de 24 € produisait des centaines de
 * millions de résultat, présentés en vert sous « Oui, dès la première
 * année ». On rejoue la faute sur une pizzeria neuve et on vérifie, dans
 * l'ordre où le fondateur la rencontre :
 *
 *   1. un plan neuf ne déclenche rien (pas de fausse alerte) ;
 *   2. la note apparaît sous le champ pendant la frappe, et s'efface quand le
 *      chiffre redevient plausible ;
 *   3. la page de saisie l'annonce en tête, sur une ligne qui se déplie ;
 *   4. les deux synthèses gardent un titre factuel et portent, dans le
 *      premier acte, un avertissement replié ; le verdict dit « À vérifier »
 *      et aucune carte ne se colore en succès ;
 *   5. « Corriger », une fois l'avertissement déplié, ramène sur le champ ;
 *   6. un salaire saisi en milliers (« 44 ») propose 44 000 € ;
 *   7. une charge démesurée se dit sur sa ligne, et « Je valide » la fait
 *      oublier tant que son montant ne change pas.
 */
export const nom = 'Garde-fous — un chiffre hors de proportion se dit'

const noteDe = (champ) => champ.locator('xpath=ancestor::div[contains(concat(" ", @class, " "), " field ")][1]').locator('.field-garde')

async function carteOuverte(t, p) {
  if (!(await p.locator('.item.open').count())) {
    await p.locator('.item-head').first().click()
    await p.locator('.item.open').first().waitFor()
    await t.pose(p)
  }
}

export default async function (t) {
  const p = await t.page('bureau')
  await t.metier(p, 'Pizzeria')

  // 1. Rien à signaler sur un plan neuf.
  await t.aller(p, 'tableau-de-bord')
  await t.onglet(p, 'Synthèse — essai')
  t.verifie(!(await p.locator('.garde').count()), 'un plan neuf ne déclenche aucun garde-fou')
  for (const route of ['offre', 'equipe', 'achats', 'financement']) {
    await t.aller(p, route)
    t.verifie(!(await p.locator('.garde').count()), `aucun bandeau sur ${route} pour un plan neuf`)
  }

  // 2. Sous le champ, pendant la frappe.
  await t.aller(p, 'offre')
  await carteOuverte(t, p)
  const prix = p.locator('.item.open .field', { has: p.locator('label', { hasText: /^Prix/ }) }).locator('input').first()
  t.verifie(await prix.count(), 'le champ Prix est trouvé')
  await prix.click()
  await prix.fill('24000')
  const note = noteDe(prix)
  await note.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
  const lu = (await note.isVisible()) ? await note.innerText() : ''
  t.verifie(/fois au-dessus/.test(lu) && /couvert/.test(lu), 'la note dit l’écart, en fois, dans l’unité du métier', lu)
  await prix.fill('24')
  await note.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
  t.verifie(!(await note.isVisible()), 'la note s’efface quand le prix redevient plausible')
  await prix.fill('24000')
  await prix.blur()
  await t.pose(p)

  // 3. En tête de la page de saisie.
  const bandeau = p.locator('.garde.is-page')
  t.verifie(await bandeau.count() === 1, 'la page Offre annonce le chiffre à vérifier')
  t.verifie(/prix/i.test(await bandeau.innerText().catch(() => '')), 'le bandeau nomme le prix')
  t.verifie(!(await bandeau.evaluate((d) => d.open)), 'le bandeau est replié : il ne prend qu’une ligne')
  const haut = await bandeau.evaluate((d) => d.getBoundingClientRect().height)
  t.verifie(haut < 48, 'une seule ligne tant qu’on ne l’ouvre pas', `${Math.round(haut)} px`)
  await bandeau.locator('summary').click()
  await bandeau.locator('.garde-go').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
  t.verifie(await bandeau.locator('.garde-go').isVisible(), 'au clic, il se déplie et propose de corriger')
  // Il se referme dès qu'on clique à côté, et ne suit pas sur une autre page.
  await p.mouse.click(5, 300)
  await p.waitForFunction(() => !document.querySelector('.garde.is-page')?.open, null, { timeout: 3000 }).catch(() => {})
  t.verifie(!(await p.locator('.garde.is-page').evaluate((d) => d.open)), 'un clic à côté le referme')
  await p.locator('.garde.is-page summary').click()
  await p.waitForFunction(() => !!document.querySelector('.garde.is-page')?.open, null, { timeout: 3000 }).catch(() => {})
  await t.aller(p, 'equipe')
  await t.aller(p, 'offre')
  t.verifie(!(await p.locator('.garde.is-page').evaluate((d) => d.open).catch(() => false)), 'changer de page le referme')

  // Sur une pizzeria sans volumes, il n'y a pas encore de résultat à juger :
  // le garde-fou est affiché, le verdict reste « à chiffrer ».
  await t.aller(p, 'tableau-de-bord')
  await t.onglet(p, 'Synthèse — essai')
  t.verifie(await p.locator('.sy-garde').count() === 1, 'plan sans ventes : la synthèse essai affiche déjà le garde-fou')

  // 4. Un plan qui vend : l'exemple, avec un abonnement à 490 000 € par mois.
  let q = await t.page('bureau')
  await t.exemple(q)
  await t.aller(q, 'offre')
  await carteOuverte(t, q)
  const abo = q.locator('.item.open .field', { has: q.locator('label', { hasText: /^Abonnement/ }) }).locator('input').first()
  t.verifie(await abo.count(), 'le champ Abonnement est trouvé')
  await abo.fill('490000')
  await abo.blur()
  await t.pose(q)
  await t.aller(q, 'tableau-de-bord')
  await t.onglet(q, 'Synthèse — essai')
  await t.defiler(q)
  t.verifie(await q.locator('.sy-act').first().locator('.sy-garde').count() === 1, 'le premier acte porte l’avertissement')
  const titre1 = (await q.locator('.sy-act-title').first().innerText().catch(() => '')).trim()
  t.verifie(titre1 && !/^À vérifier/.test(titre1), 'le titre du premier acte reste factuel', titre1)
  t.verifie(!(await q.locator('.sy-card.is-good, .sy-feature-main.is-good, .sy-fact.is-good').count()), 'aucune carte ne se colore en succès')
  // Le verdict du dossier se lit dans le pilotage, avec l'avancement.
  await t.onglet(q, 'Pilotage')
  await t.defiler(q)
  const mot = await q.evaluate(() => [...document.querySelectorAll('.sy-verdict-word, .sy-ink-word, .sy-ink .sy-kicker')].map((x) => x.textContent).join(' | '))
  t.verifie(/vérifier/i.test(mot), 'le verdict dit « À vérifier »', mot.slice(0, 120))

  await t.onglet(q, 'Synthèse')
  await q.locator('.pitch-mise', { hasText: 'Récit' }).first().click()
  await q.locator('.pitch-mise.is-on', { hasText: 'Récit' }).first().waitFor()
  await t.pose(q)
  t.verifie(await q.locator('.pitch .garde').count() === 1, 'le récit dit la même chose')
  t.verifie(!(await q.locator('.pitch .as .is-good').count()), 'le récit ne colore rien en succès')

  // 5. « Corriger » ramène sur le champ.
  await t.onglet(q, 'Synthèse — essai')
  const pill = q.locator('.sy-garde summary').first()
  await pill.evaluate((b) => b.scrollIntoView({ block: 'center' }))
  await pill.click()
  const go = q.locator('.sy-garde .garde-go').first()
  await go.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
  await go.evaluate((b) => b.scrollIntoView({ block: 'center' }))
  await t.pose(q)
  await go.click()
  // Le voyage, le rendu, puis l'anneau posé sur le champ.
  await q.waitForFunction(() => !!document.querySelector('[data-gap="prix"].spotlit'), null, { timeout: 4000 }).catch(() => {})
  const arrive = await q.evaluate(() => ({ hash: location.hash, spot: !!document.querySelector('[data-gap="prix"].spotlit') }))
  t.verifie(arrive.hash === '#/offre' && arrive.spot, '« Corriger » mène au prix et l’entoure', arrive)

  // 6. Un salaire saisi en milliers.
  await t.aller(q, 'equipe')
  await carteOuverte(t, q)
  const libelles = await q.$$eval('.item.open .item-body input', (e) => e.map((x) => (x.closest('.field')?.querySelector('label')?.textContent || '').trim()))
  const i = libelles.findIndex((l) => /brut annuel/i.test(l))
  t.verifie(i >= 0, 'le champ du brut annuel est trouvé', libelles.slice(0, 6))
  if (i >= 0) {
    const sal = q.locator('.item.open .item-body input').nth(i)
    await sal.click()
    await sal.fill('44')
    const n2 = noteDe(sal)
    await n2.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
    const txt = (await n2.isVisible()) ? await n2.innerText() : ''
    // Le repère : le SMIC pour un salarié, ce qu'on verse d'ordinaire pour un
    // dirigeant, qui n'y est pas soumis.
    t.verifie(/SMIC|verse d.ordinaire/.test(txt) && /44\s000/.test(txt), 'un salaire de 44 € propose 44 000 €', txt)
  }

  // 7. Une charge hors de proportion se dit sur sa ligne ; « Je valide » la
  // fait oublier, tant que le montant ne change pas.
  // Sur un exemple neuf : l'abonnement à 490 000 € ci-dessus rendrait
  // n'importe quelle charge raisonnable.
  t.verifie(q.erreurs.length === 0, 'aucune erreur JavaScript (exemple)', q.erreurs.slice(0, 2))
  await q.fermer()
  q = await t.page('bureau')
  await t.exemple(q)
  await t.aller(q, 'achats')
  const montant = q.locator('.cost-row .cost-amount input').first()
  await montant.fill('900000')
  await montant.blur()
  await t.pose(q)
  const ligne = q.locator('.cost-row').first().locator('.garde-ligne')
  t.verifie(await ligne.count() === 1, 'une charge de 900 000 € par mois est signalée sur sa ligne')
  t.verifie(/meilleure année|aucune vente/.test(await ligne.innerText().catch(() => '')), 'la note compare la charge à ce que l’affaire vend', await ligne.innerText().catch(() => ''))
  t.verifie(await q.locator('.sx-ribbon .garde').count() === 1, 'le bandeau des chiffres le signale aussi, sur sa ligne')
  await ligne.locator('.garde-ok').click()
  await q.locator('.cost-row').first().locator('.garde-ligne').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {})
  await t.pose(q)
  t.verifie(await q.locator('.cost-row').first().locator('.garde-ligne').count() === 0, '« Je valide » fait disparaître l’avertissement')
  const encore = await q.evaluate(async () => {
    const m = await import('./js/ui/garde.js')
    return m.gardesDuPlan().filter((g) => g.cle.startsWith('charge:')).length
  })
  t.verifie(encore === 0, 'une charge validée ne se redit nulle part', String(encore))
  await q.locator('.cost-row .cost-amount input').first().fill('1900000')
  await q.locator('.cost-row .cost-amount input').first().blur()
  await t.pose(q)
  t.verifie(await q.locator('.cost-row').first().locator('.garde-ligne').count() === 1, 'si le montant change, l’avertissement revient')

  t.verifie(q.erreurs.length === 0, 'aucune erreur JavaScript (exemple)', q.erreurs.slice(0, 2))
  await q.fermer()

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}

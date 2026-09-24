/**
 * Les créateurs qui ne ressemblent pas à une SAS.
 *
 * Un coiffeur choisit la micro-entreprise, déclare l'ACRE, obtient un prêt
 * d'honneur. On vérifie, là où il le vit :
 *
 *   1. la micro-entreprise se choisit sous le statut, et ouvre ce qui la
 *      règle — nature d'activité, versement libératoire, franchise de TVA ;
 *   2. le moteur suit : pas d'impôt sur les sociétés, pas de TVA en
 *      franchise, des cotisations sur ce qu'il encaisse ;
 *   3. sa ligne dans Équipe devient un prélèvement, pas une charge ;
 *   4. l'ACRE déclarée efface une partie des cotisations la première année ;
 *   5. le prêt d'honneur est une source de financement, avec son réseau, et
 *      entre dans la trésorerie ;
 *   6. « Ce que je touche » descend de ce qu'il encaisse à ce qui lui reste,
 *      remboursement du prêt d'honneur compris.
 */
export const nom = 'Créateurs — micro-entreprise, ACRE, prêt d’honneur'

const etat = (p) => p.evaluate(async () => {
  const st = (await import('./js/state/store.js')).default
  const r = st.result, s = st.scenario
  const tot = (a) => (a || []).reduce((x, y) => x + y, 0)
  return {
    forme: s.meta.legalForm, franchise: !!s.meta.vatExempt, acre: !!s.meta.acre,
    is: tot(r.pnl.corporateTax), tva: tot(r.vat.collected), micro: !!r.micro,
    cot0: r.micro ? r.micro.socialY[0] : 0, remise: r.micro ? tot(r.micro.acreSaving) : 0,
    honneur: (s.financing.honourLoans || []).map((x) => ({ montant: x.amount, reseau: x.network })),
    tresoM0: r.cash.balance[0], apport: r.cash.rows.honour ? tot(r.cash.rows.honour) : 0,
  }
})

export default async function (t) {
  const p = await t.page('bureau')
  await t.exemple(p, 'Salon de coiffure')

  // 1. La micro-entreprise, sous le statut.
  await t.aller(p, 'projet')
  await p.locator('[data-gap="juridique"] .legalline').click()
  await p.locator('.legalopen .pick').first().waitFor({ timeout: 3000 }).catch(() => {})
  await t.pose(p)
  const carte = p.locator('.legalopen .pick', { hasText: 'Micro-entreprise' })
  t.verifie(await carte.count() === 1, 'la micro-entreprise est proposée parmi les formes')
  await carte.click()
  await p.locator('[data-gap="regime"]').first().waitFor({ timeout: 3000 }).catch(() => {})
  await t.pose(p)
  const libelles = await p.locator('[data-gap="regime"] label').allInnerTexts()
  const lu = libelles.join(' | ')
  t.verifie(/Nature de ton activit/.test(lu) && /Versement lib/.test(lu) && /Franchise de TVA/.test(lu),
    'le régime se règle sous le statut : nature, versement libératoire, franchise', lu)
  const ligne = await p.evaluate(() => {
    const cloture = [...document.querySelectorAll('.field')].find((f) => /Mois de clôture/.test(f.querySelector('label')?.textContent || ''))
    const acre = document.querySelector('[data-gap="acre"] .field-switch')
    const a = cloture?.getBoundingClientRect(), b = acre?.getBoundingClientRect()
    return a && b ? { memeLigne: Math.abs(a.top - b.top) < 30 && b.left > a.left } : null
  })
  t.verifie(ligne?.memeLigne, 'le droit à l’ACRE est sur la ligne du mois de clôture', ligne)

  // 2. Le moteur suit.
  let e = await etat(p)
  t.verifie(e.forme === 'MICRO' && e.micro, 'le plan passe en micro-entreprise', e)
  t.verifie(e.is === 0, 'aucun impôt sur les sociétés', String(e.is))
  t.verifie(e.franchise && e.tva === 0, 'franchise de TVA d’office, aucune TVA collectée', e)
  t.verifie(e.cot0 > 0, 'des cotisations sur le chiffre d’affaires encaissé', String(e.cot0))

  // 3. Dans Équipe, un prélèvement.
  await t.aller(p, 'equipe')
  const meta = await p.locator('.item .item-meta').allInnerTexts()
  t.verifie(meta.some((m) => /Micro-entrepreneur/.test(m) && /prélevés/.test(m)), 'la ligne du fondateur devient un prélèvement', meta.slice(0, 3))

  // 4. L'ACRE, déclarée.
  await t.aller(p, 'projet')
  const avant = e.cot0
  const champAcre = p.locator('[data-gap="acre"] .field-switch', { hasText: 'ACRE' })
  const bulle = await champAcre.locator('.switch-name .info-point').getAttribute('data-tip').catch(() => '')
  t.verifie(await champAcre.locator('.info-point').count() === 1 && await champAcre.locator('.field-hint').count() === 0
    && /cotisations/.test(bulle || '') && /URSSAF/.test(bulle || ''),
  'le droit à l’ACRE s’explique dans une seule bulle, à côté du libellé', bulle)
  await champAcre.locator('.switch').click()
  await t.pose(p)
  e = await etat(p)
  t.verifie(e.acre && e.remise > 0 && e.cot0 < avant, 'l’ACRE allège les cotisations de la première année', `${Math.round(avant)} → ${Math.round(e.cot0)}`)

  // 5. Le prêt d'honneur, une source de financement. L'exemple en porte
  // déjà un : on repart d'un plan qui n'en a pas, pour le poser comme un
  // fondateur le ferait.
  await p.evaluate(async () => {
    const st = (await import('./js/state/store.js')).default
    st.update((sc) => { sc.financing.honourLoans = [] }, { label: 'Sans prêt d’honneur' })
  })
  await t.pose(p)
  e = await etat(p)
  await t.aller(p, 'financement')
  const tuile = p.locator('.source', { hasText: 'Prêt d’honneur' }).or(p.locator('.source', { hasText: "Prêt d'honneur" }))
  t.verifie(await tuile.count() >= 1, 'le prêt d’honneur figure parmi les sources')
  const treso = e.tresoM0
  await tuile.first().locator('.source-act').click()
  await p.locator('.source-line select').first().waitFor({ timeout: 3000 }).catch(() => {})
  await t.pose(p)
  const reseaux = await p.locator('.source-line select').first().locator('option').allInnerTexts()
  t.verifie(reseaux.includes('Initiative France') && reseaux.includes('Réseau Entreprendre'), 'on choisit le réseau : Initiative France, Réseau Entreprendre…', reseaux)
  const montant = p.locator('.source-line .field', { has: p.locator('label', { hasText: /^Montant/ }) }).locator('input').first()
  await montant.fill('12000')
  await montant.blur()
  await t.pose(p)
  e = await etat(p)
  t.verifie(e.honneur[0]?.montant === 12000 && e.apport === 12000, 'le montant entre dans la trésorerie comme un apport', e.honneur)
  t.verifie(Math.round(e.tresoM0 - treso) === 12000, 'la trésorerie du premier mois gagne 12 000 €', `${Math.round(treso)} → ${Math.round(e.tresoM0)}`)
  const note = await p.locator('.source-line .tiny.muted').first().innerText().catch(() => '')
  t.verifie(/sans intérêts/.test(note) && /Initiative France/.test(note), 'la ligne dit la mensualité et le repère du réseau', note)

  // 6. Ce que je touche.
  await t.aller(p, 'resultats')
  await p.locator('.module-nav .hnav-tab', { hasText: /touche|Revenu/ }).first().click().catch(() => {})
  await p.locator('.pay-step-k').first().waitFor({ timeout: 3000 }).catch(() => {})
  await t.pose(p)
  const echelle = await p.locator('.pay-step-k').allInnerTexts()
  t.verifie(echelle.includes('Ce que tu encaisses') && echelle.includes('Tes cotisations') && echelle.includes('Ce qui te reste, net de tout'),
    'l’échelle part de ce qu’il encaisse, passe par les cotisations, finit sur ce qui reste', echelle)
  const table = await p.locator('table.data').last().innerText().catch(() => '')
  t.verifie(/prêt d’honneur/.test(table), 'le remboursement du prêt d’honneur se lit dans le détail', table.slice(0, 200))

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}

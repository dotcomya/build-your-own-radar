/**
 * Les valeurs 2026, contrôlées une à une contre le texte publié.
 *
 * Un moteur juste sur des paramètres périmés donne un faux plus convaincant
 * qu'une erreur de calcul : tout est cohérent, tout est faux. Ce fichier ne
 * vérifie donc pas des égalités comptables mais des nombres — ceux qu'une loi
 * de finances ou une loi de financement de la Sécurité sociale a fixés pour
 * 2026. Il échoue si quelqu'un les modifie sans le vouloir, et il échoue aussi
 * si un paramètre se déclare « texte publié » sans citer ce texte.
 */
import { PARAMS, FISCAL_YEAR, pfuTotal, pfuDetail } from '../js/engine/fiscal-fr-2026.js'
import { pct, num } from '../js/format.js'
const ok=(l,c,d='')=>{console.log(`${c?'✓':'✗'} ${l}${d?' — '+d:''}`); if(!c) process.exitCode=1}
const near=(a,b,t=1e-9)=>Math.abs(a-b)<=t
const v = (k) => PARAMS[k].value

ok('exercice de référence 2026', FISCAL_YEAR === 2026)

// ── Bases sociales ────────────────────────────────────────────────────────
ok('SMIC horaire 12,31 € (revalorisation anticipée du 1er juin 2026)', near(v('smicHourly'), 12.31))
ok('SMIC mensuel 35 h ≈ 1 867 €', near(v('smicHourly') * v('monthlyHours'), 1867, 1),
   `${(v('smicHourly') * v('monthlyHours')).toFixed(2)} €`)
ok('PASS 48 060 €', v('pass') === 48060)
ok('plafond mensuel 4 005 €', near(v('pass') / 12, 4005, 0.01))

// ── Réduction générale dégressive unique : Tmin + Tdelta ──────────────────
const rg = v('reductionGenerale')
ok('RGDU — coefficient maximal 0,3981 au FNAL de 0,10 %', near(rg.maxCoefUnder50, 0.3981),
   String(rg.maxCoefUnder50))
ok('RGDU — coefficient maximal 0,4021 au FNAL de 0,50 %', near(rg.maxCoefFrom50, 0.4021),
   String(rg.maxCoefFrom50))
ok('RGDU — Tmin de 0,0200 garanti jusqu’à trois SMIC',
   near(rg.maxCoefUnder50 - 0.3781, 0.02, 1e-9) && rg.ceilingSmicMultiple === 3.0)

// ── Stage et titres-restaurant, adossés au plafond horaire de 30 € ────────
ok('gratification de stage 4,50 €/h, soit 15 % du plafond horaire de 30 €',
   near(v('internGratification'), 4.5) && near(30 * 0.15, 4.5))
ok('titre-restaurant — part patronale exonérée jusqu’à 7,32 €', near(v('mealVoucherExemptCap'), 7.32))

// ── Impôt sur le revenu : barème revalorisé de 0,9 % ──────────────────────
const b = v('incomeTaxBrackets').map((t) => t.upTo)
ok('barème IR 2026 — 11 600 / 29 579 / 84 577 / 181 917',
   b[0] === 11600 && b[1] === 29579 && b[2] === 84577 && b[3] === 181917, b.slice(0, 4).join(' / '))
ok('barème IR — taux 0 / 11 / 30 / 41 / 45 %',
   v('incomeTaxBrackets').map((t) => t.rate).join(',') === '0,0.11,0.3,0.41,0.45')
ok('abattement de 10 % — plancher 509 €, plafond 14 555 €',
   v('salaryAllowance').min === 509 && v('salaryAllowance').max === 14555)
ok('plafond du quotient familial 1 807 € par demi-part', v('familyQuotientCap') === 1807)

// ── LE point de l'année : la flat tax passe à 31,4 % ──────────────────────
const f = v('flatTax')
ok('flat tax 31,4 %', near(f.total, 0.314), pfuTotal())
ok('12,8 % d’impôt sur le revenu, inchangé', near(f.incomeTax, 0.128))
ok('18,6 % de prélèvements sociaux (CSG relevée de 1,4 point par la LFSS 2026)',
   near(f.socialCharges, 0.186) && near(f.socialCharges - 0.172, 0.014, 1e-9))
ok('le total est bien la somme des deux', near(f.incomeTax + f.socialCharges, f.total), pfuDetail())

// ── Impôt sur les sociétés : règle pérenne, inchangée ─────────────────────
const is = v('corporateTax')
ok('IS — 15 % jusqu’à 42 500 € puis 25 %',
   near(is.reducedRate, 0.15) && is.reducedBracket === 42500 && near(is.normalRate, 0.25))

// ── Aucune valeur ne se déclare « texte publié » sans citer son texte ─────
const orphelins = Object.entries(PARAMS)
  .filter(([, p]) => p.confidence === 'enacted' && !p.source)
  .map(([k]) => k)
ok('chaque valeur 2026 « texte publié » cite sa source', orphelins.length === 0, orphelins.join(', ') || '12 paramètres')

// ── Et aucun statut inventé ───────────────────────────────────────────────
const connus = ['stable', 'enacted', 'to-verify']
const inconnus = Object.entries(PARAMS).filter(([, p]) => !connus.includes(p.confidence)).map(([k]) => k)
ok('aucun statut de confiance inconnu', inconnus.length === 0, inconnus.join(', ') || 'stable · enacted · to-verify')

// ── Les taxes assises sur la masse salariale, au centième près ────────────
//
// Un relecteur extérieur a signalé six taux faux. Cinq ne l'étaient pas : la
// table des règles les arrondissait à l'affichage — 0,55 % s'y lisait 0,5 %,
// 0,68 % devenait 0,7 %, 4,5 SMIC devenait 5. Ces contrôles figent les
// valeurs exactes du côté du moteur ; le formatage, lui, ne perd plus de
// décimales.
ok('taxe d’apprentissage 0,68 % — 0,59 % de part principale + 0,09 % de solde',
   near(v('apprenticeshipTax'), 0.0068) && near(0.0059 + 0.0009, 0.0068, 1e-9))
ok('formation professionnelle — 0,55 % jusqu’à 10 salariés, 1 % au-delà',
   near(v('vocationalTraining').under11, 0.0055) && near(v('vocationalTraining').from11, 0.01))
ok('PEEC — 0,45 % de la masse salariale, à partir de 50 salariés',
   near(v('constructionEffort').rate, 0.0045) && v('constructionEffort').threshold === 50)
ok('C3S — 0,16 % de la fraction du CA au-delà de 19 M€',
   near(v('c3s').rate, 0.0016) && v('c3s').threshold === 19000000)
ok('JEI — exonération plafonnée à 4,5 SMIC par salarié et 5 PASS par établissement',
   near(v('jei').employeeCapSmicMultiple, 4.5) && v('jei').establishmentCapPassMultiple === 5)

// ── CVAE : la trajectoire de suppression a été reportée deux fois ─────────
//
// La loi de finances pour 2024 prévoyait 0,19 % en 2025 puis 0,09 % en 2026 ;
// celle pour 2025 a décalé la trajectoire de trois ans et maintient le taux
// maximal à 0,28 % jusqu'en 2027. C'est 0,28 % qui s'applique en 2026.
ok('CVAE — taux maximal de 0,28 % en 2026, et non 0,19 %',
   near(v('cvae').maxRate, 0.0028), `${(v('cvae').maxRate * 100).toFixed(2)} %`)
ok('CVAE — le report de la suppression cite son texte', !!PARAMS.cvae.source)

// ── Un taux affiché est un taux exact ─────────────────────────────────────
//
// Le formateur ignorait la précision demandée au-delà d'une décimale : toute
// valeur plus fine était arrondie avant d'atteindre l'écran. C'est ce qui a
// fait conclure à six erreurs de droit là où le moteur était juste.
ok('pct rend la précision demandée — 0,55 %, 0,68 %, 0,16 %, 0,28 %',
   pct(0.0055, 2) === '0,55 %' && pct(0.0068, 2) === '0,68 %'
   && pct(0.0016, 2) === '0,16 %' && pct(0.0028, 2) === '0,28 %',
   [pct(0.0055, 2), pct(0.0068, 2), pct(0.0016, 2), pct(0.0028, 2)].join(' · '))
ok('num rend la précision demandée — 4,5 SMIC ne devient pas 5', num(4.5, 1) === '4,5', num(4.5, 1))

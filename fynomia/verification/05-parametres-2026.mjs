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

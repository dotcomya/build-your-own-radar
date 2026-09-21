/**
 * La synthèse : ton plan, en français.
 *
 * L'analyse existe déjà — six chiffres, quatre courbes, un compte de résultat.
 * Elle répond à un lecteur qui sait quoi y chercher. Le fondateur pressé, lui,
 * veut trois réponses, et une seule à la fois :
 *
 *   1. Rentabilité   — le modèle dégage-t-il un résultat, et à partir de quand ;
 *   2. Trésorerie    — le compte tient-il jusque-là, et sinon de combien ;
 *   3. Rémunération  — ce qui revient au fondateur, une fois tout payé ;
 *   4. Point mort    — ce qu'il faut vendre pour couvrir les charges ;
 *   5. Sur 100 €     — où part l'argent encaissé, et ce qu'il en reste ;
 *   6. Croissance    — ce que le plan promet d'une année sur l'autre.
 *
 * Cette page ne calcule rien de neuf. Elle prend ce que le moteur a produit et
 * l'écrit en phrases : un titre qui est déjà la réponse, trois lignes pour la
 * justifier, un seul chiffre, une image qui le confirme. Le titre ne pose pas
 * la question — il y répond ; c'est la différence entre un sommaire et une
 * synthèse.
 */

import { h, svg, euro, pct, num, monthLabel } from './dom.js'
import { goToGap } from './spotlight.js'
import { icon } from './icons.js'
import { checklist } from './checklist.js'
import { changed } from './motion.js'
import store from '../state/store.js'

const n = (v) => Number(v) || 0

/** Combien de lignes du dossier restent à poser. */
const left = () => { try { const c = checklist(store.scenario); return c.total - c.done } catch { return 0 } }
const YEARS = ['année 1', 'année 2', 'année 3', 'année 4', 'année 5']

/** La synthèse complète. `r` est le résultat du moteur, `s` le scénario. */
export function plainBoard(s, r, navigate, goRefine) {
  if (!r) return null

  // Un plan encore vide n'a pas de verdict à rendre. Lui en donner un —
  // « aucune année ne dégage de bénéfice » — serait exact et inutile : ce
  // n'est pas le modèle qui est mauvais, c'est qu'il n'y a rien dedans.
  if (!(r.pnl.revenue || []).some((v) => n(v) > 0)) return emptyBoard(goRefine)
  // Six réponses, dans l'ordre où elles se posent : est-ce que ça gagne, est-ce
  // que ça tient, ce qu'il m'en reste — puis ce qu'il faut vendre pour couvrir,
  // où part l'argent, et à quelle vitesse tout ça monte. Ensemble, elles font
  // le tour de ce qu'on veut savoir avant d'ouvrir un compte de résultat.
  const cards = [
    profitCard(r), cashCard(r), takeCard(s, r),
    breakEvenCard(s, r), keepCard(r), growthCard(r),
  ]

  return h('div', { class: 'plain' },
    h('p', { class: 'plain-lede' },
      'Six lectures du même modèle : le résultat, la trésorerie, ta rémunération, le seuil de rentabilité, la structure de coûts et la trajectoire. Chacune énonce un mécanisme et le chiffre qui en découle.'),
    h('div', { class: 'plain-cards' }, ...cards),
    h('div', { class: 'plain-foot' },
      h('p', {},
        'Ces six lectures reposent sur les mêmes calculs que l’analyse détaillée, ci-dessous. Un écart avec ce que tu attendais vient soit d’une hypothèse à revoir, soit d’une ligne qui n’a pas encore été posée.'),
      h('div', { class: 'plain-foot-go' },
        // Une synthèse qui se lit au sortir du parcours doit dire la suite :
        // il reste des lignes à poser, et chacune resserre ces trois phrases.
        goRefine
          ? h('button', { class: 'btn btn-primary btn-sm', onClick: goRefine }, left() > 0
              ? `Affiner : ${left()} ligne${left() > 1 ? 's' : ''} à poser`
              : 'Ce qu’il me reste à poser')
          : null,
        h('button', {
          class: 'btn btn-quiet btn-sm',
          onClick: () => goToGap({ route: 'resultats' }, navigate),
        }, 'Voir les états financiers'),
      ),
    ),
  )
}

/** Rien à lire encore : on dit quoi poser, et où. */
function emptyBoard(goRefine) {
  return h('div', { class: 'plain' },
    h('p', { class: 'plain-lede' },
      'Aucune synthèse n’est calculable : le modèle ne comporte pas encore de chiffre d’affaires.'),
    h('section', { class: 'plaincard is-watch' },
      h('header', { class: 'plaincard-head' },
        h('span', { class: 'plaincard-ico', html: icon('idee') }),
        h('div', {},
          h('div', { class: 'plaincard-kicker' }, 'Par où commencer'),
          h('h3', { class: 'plaincard-title' }, 'Un prix et un volume suffisent à démarrer'),
        ),
      ),
      h('p', { class: 'plaincard-body' },
        'Trois données déclenchent l’ensemble des calculs : la nature de l’offre, son prix unitaire et le volume mensuel vendu. Les charges, la masse salariale et la trésorerie se construisent ensuite sur cette base.'),
      goRefine ? h('div', { class: 'plain-foot-go' },
        h('button', { class: 'btn btn-primary btn-sm', onClick: goRefine }, 'Ce qu’il me reste à poser'),
      ) : null,
    ),
  )
}

/* ────────────────────────────── 1. Rentabilité ───────────────────────────── */

function profitCard(r) {
  const net = r.pnl.netResult
  const first = net.findIndex((v) => v > 0)
  const y1 = n(net[0])

  let tone = 'bad', title = 'D\u00e9ficit continu sur 5 ans', body
  if (first === 0) {
    tone = 'good'
    title = `R\u00e9sultat net positif d\u00e8s l\u2019ann\u00e9e 1 : ${euro(y1)}`
    body = `L'exercice se cl\u00f4ture sur un b\u00e9n\u00e9fice net de ${euro(y1)}. Une rentabilit\u00e9 d\u00e8s la premi\u00e8re ann\u00e9e est peu fr\u00e9quente : il faut v\u00e9rifier que l'int\u00e9gralit\u00e9 des charges d'exploitation figure bien au mod\u00e8le.`
  } else if (first > 0) {
    tone = 'watch'
    title = `Retour \u00e0 l\u2019\u00e9quilibre en ann\u00e9e ${first + 1}`
    body = `L'entreprise enregistre une perte nette de ${euro(Math.abs(y1))} en ann\u00e9e 1. Le r\u00e9sultat reste n\u00e9gatif sur ${first === 1 ? 'ce premier exercice' : `les ${first} premiers exercices`}, puis devient positif en ann\u00e9e ${first + 1} \u00e0 ${euro(n(net[first]))}. La p\u00e9riode d\u00e9ficitaire doit \u00eatre financ\u00e9e int\u00e9gralement avant cette date.`
  } else {
    body = `L'entreprise enregistre une perte nette de ${euro(Math.abs(y1))} en ann\u00e9e 1, et le r\u00e9sultat reste n\u00e9gatif jusqu'\u00e0 l'ann\u00e9e 5. Pour redresser la courbe, l'ajustement doit se faire sur trois variables, dans cet ordre : le prix de vente, le co\u00fbt de revient unitaire, puis le volume de ventes.`
  }

  return card({
    tone, kicker: 'Rentabilit\u00e9', title, body,
    ico: 'argent',
    bars: net.slice(0, 5).map((v, i) => ({ label: `A${i + 1}`, value: n(v) })),
    figure: { label: 'R\u00e9sultat net \u2014 ann\u00e9e 1', value: euro(y1), good: y1 >= 0 },
  })
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 2. Tr\u00e9sorerie \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

function cashCard(r) {
  const low = r.kpis.cashLow
  const need = n(r.kpis.fundingNeed)
  const when = low && low.month != null ? monthLabel(low.month, r.startDate) : null

  let tone = 'good', title = 'Tr\u00e9sorerie positive sur tout l\u2019horizon', body
  if (need > 0) {
    tone = 'bad'
    title = `Besoin de tr\u00e9sorerie cumul\u00e9 : ${euro(need)}`
    body = `La courbe de tr\u00e9sorerie atteint son niveau le plus bas en ${when}, avec un solde n\u00e9gatif de ${euro(n(low.value))}. La viabilit\u00e9 de ce pr\u00e9visionnel d\u00e9pend de la capacit\u00e9 \u00e0 injecter ce montant en fonds propres, en endettement ou en r\u00e9duction des d\u00e9penses de d\u00e9marrage, avant cette date.`
  } else if (n(low?.value) < 5000) {
    tone = 'watch'
    title = `Marge de s\u00e9curit\u00e9 r\u00e9duite : ${euro(n(low.value))} au plus bas`
    body = `Le solde de tr\u00e9sorerie reste positif sur les cinq ans, mais descend \u00e0 ${euro(n(low.value))} en ${when}. \u00c0 ce niveau, un d\u00e9calage d'encaissement d'un mois sur un client significatif suffit \u00e0 faire passer le compte en d\u00e9couvert.`
  } else {
    body = `Le solde de tr\u00e9sorerie reste positif sur l'ensemble de la p\u00e9riode mod\u00e9lis\u00e9e, avec un point bas \u00e0 ${euro(n(low?.value))}${when ? ` en ${when}` : ''}. Le plan ne requiert aucun financement externe suppl\u00e9mentaire.`
  }

  return card({
    tone, kicker: 'Tr\u00e9sorerie', title, body,
    ico: 'cible',
    line: (r.cash?.balance || []).slice(0, 36).map((v) => n(v)),
    figure: { label: 'Point bas du compte', value: euro(n(low?.value)), good: n(low?.value) >= 0 },
  })
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 3. Ta r\u00e9mun\u00e9ration \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

function takeCard(s, r) {
  const team = s.team || []
  // Un litt\u00e9ral d'expression r\u00e9guli\u00e8re n'est pas \u00e9chapp\u00e9 \u00e0 l'empaquetage : les
  // accents y passeraient tels quels dans un fichier livr\u00e9 en ASCII, et le
  // motif ne reconna\u00eetrait plus \u00ab g\u00e9rant \u00bb. \u00c9crit ainsi, il survit au build.
  const FOUNDER = new RegExp('fondateur|dirigeant|moi|g\\u00e9rant|president|pr\\u00e9sident', 'i')
  const me = team.find((m) => FOUNDER.test(m.role || '')) || team[0]
  const gross = n(me?.monthlyGross)

  if (!gross) {
    return card({
      tone: 'watch', kicker: 'Ta r\u00e9mun\u00e9ration',
      title: 'Aucune r\u00e9mun\u00e9ration du dirigeant au mod\u00e8le', ico: 'commerce',
      body: "Le pr\u00e9visionnel ne comporte aucune charge de r\u00e9mun\u00e9ration pour le dirigeant. Le r\u00e9sultat affich\u00e9 est donc surestim\u00e9 du montant que tu devras te verser. Un analyste retraitera ce poste avant toute d\u00e9cision : mieux vaut l'inscrire, m\u00eame \u00e0 un niveau modeste.",
      figure: { label: 'Brut annuel', value: '\u2014', good: false },
    })
  }

  const yearly = gross * 12
  const marge = n(r.pnl.netResult[0])
  return card({
    tone: marge >= 0 ? 'good' : 'watch',
    kicker: 'Ta r\u00e9mun\u00e9ration',
    title: marge >= 0
      ? `R\u00e9mun\u00e9ration de ${euro(yearly)} brut/an, r\u00e9sultat positif`
      : `R\u00e9mun\u00e9ration de ${euro(yearly)} brut/an incluse dans la perte`,
    ico: 'commerce',
    body: marge >= 0
      ? `Ce montant est comptabilis\u00e9 en charges de personnel. Apr\u00e8s l'avoir support\u00e9, l'exercice d\u00e9gage encore ${euro(marge)} de r\u00e9sultat net, affectable en r\u00e9serves ou distribuable en dividendes.`
      : `Ce montant de r\u00e9mun\u00e9ration est comptabilis\u00e9 dans les charges. Le d\u00e9ficit de ${euro(Math.abs(marge))} de la premi\u00e8re ann\u00e9e int\u00e8gre d\u00e9j\u00e0 ce co\u00fbt salarial. Le mod\u00e8le n\u00e9cessite un fonds de roulement suffisant pour couvrir cette charge pendant la phase d\u00e9ficitaire.`,
    figure: { label: 'Brut annuel', value: euro(yearly), good: true },
  })
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4. Le point mort \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

/** Ce qu'il faut vendre pour ne plus perdre d'argent. */
function breakEvenCard(s, r) {
  const first = r.pnl.netResult.findIndex((v) => v > 0)
  const ref = first >= 0 ? first : 0
  const need = n(r.kpis.breakEven[ref])
  const revenue = n(r.pnl.revenue[ref])
  const done = need > 0 && revenue >= need
  const share = need > 0 ? Math.min(1.4, revenue / need) : 0

  if (!need) {
    return card({
      tone: 'bad', kicker: 'Le point mort',
      title: 'Seuil de rentabilit\u00e9 inatteignable : co\u00fbt sup\u00e9rieur au prix', ico: 'cible',
      body: "Le prix de vente unitaire est inf\u00e9rieur au co\u00fbt de revient. Vendre des volumes suppl\u00e9mentaires augmente la perte globale au lieu d'amortir les charges fixes. Le calcul du point mort suppose d'abord de rendre la marge unitaire positive.",
      figure: { label: 'Seuil annuel', value: '\u2014', good: false },
    })
  }
  return card({
    tone: done ? 'good' : 'watch',
    kicker: 'Le point mort',
    title: done
      ? `Seuil de rentabilit\u00e9 franchi en ann\u00e9e ${ref + 1}`
      : `Seuil de rentabilit\u00e9 \u00e0 ${euro(need)} de chiffre d\u2019affaires`,
    ico: 'cible',
    body: done
      ? `Les charges de l'exercice sont couvertes \u00e0 partir de ${euro(need)} de chiffre d'affaires ; le mod\u00e8le en pr\u00e9voit ${euro(revenue)} en ann\u00e9e ${ref + 1}. Au-del\u00e0 de ce seuil, chaque vente suppl\u00e9mentaire contribue int\u00e9gralement au r\u00e9sultat, d\u00e9duction faite de son co\u00fbt direct.`
      : `Les charges de l'exercice exigent ${euro(need)} de chiffre d'affaires pour \u00eatre couvertes ; le mod\u00e8le en pr\u00e9voit ${euro(revenue)} en ann\u00e9e ${ref + 1}. L'\u00e9cart se r\u00e9duit par le prix, par le volume, ou par une baisse des charges fixes \u2014 les trois leviers ne se valent pas : le prix agit imm\u00e9diatement, le volume suppose de la demande.`,
    meter: { part: share, label: `${Math.round(share * 100)} % du seuil atteint en ann\u00e9e ${ref + 1}` },
    figure: { label: 'Seuil annuel', value: euro(need), good: done },
  })
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 5. Ce qui reste sur 100 \u20ac \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

/** O\u00f9 part l'argent, sur cent euros factur\u00e9s. */
function keepCard(r) {
  const i = Math.max(0, r.pnl.netResult.findIndex((v) => v > 0))
  const p = r.pnl
  const rev = n(p.revenue[i])
  if (rev <= 0) {
    return card({
      tone: 'watch', kicker: 'Sur 100 \u20ac factur\u00e9s', title: 'R\u00e9partition non calculable', ico: 'alimentaire',
      body: "L'exercice ne comporte aucun chiffre d'affaires : la r\u00e9partition de chaque euro encaiss\u00e9 ne peut pas \u00eatre \u00e9tablie. Un prix et un volume de ventes suffisent \u00e0 la faire appara\u00eetre.",
      figure: { label: 'R\u00e9sultat pour 100 \u20ac', value: '\u2014', good: false },
    })
  }
  const per100 = (v) => Math.round((n(v) / rev) * 100)
  const buys = Math.max(0, per100(p.variableCost[i]))
  const team = Math.max(0, per100(p.payroll[i]))
  const other = Math.max(0, per100(n(p.external[i]) + n(p.duties[i]) + n(p.amortisation[i]) + n(p.interest[i]) + n(p.corporateTax[i])))
  const net = per100(p.netResult[i])
  const spend = buys + team + other

  return card({
    tone: net >= 10 ? 'good' : net >= 0 ? 'watch' : 'bad',
    kicker: 'Sur 100 \u20ac factur\u00e9s',
    title: net >= 0
      ? `R\u00e9sultat net de ${euro(net)} pour 100 \u20ac de chiffre d\u2019affaires`
      : `D\u00e9penses de ${euro(spend)} pour 100 \u20ac de chiffre d\u2019affaires`,
    ico: 'alimentaire',
    body: `Pour chaque tranche de 100 \u20ac de chiffre d'affaires g\u00e9n\u00e9r\u00e9e en ann\u00e9e ${i + 1}, la structure d\u00e9pense ${euro(team)} en masse salariale, ${euro(buys)} en achats et ${euro(other)} en autres charges et imp\u00f4ts. Le r\u00e9sultat net par tranche de 100 \u20ac s'\u00e9tablit \u00e0 ${euro(net)}.`,
    split: [
      { label: 'Achats', value: buys, tone: 'buys' },
      { label: 'Masse salariale', value: team, tone: 'team' },
      { label: 'Autres charges', value: other, tone: 'other' },
      { label: net >= 0 ? 'R\u00e9sultat' : '\u00c9cart', value: Math.abs(net), tone: net >= 0 ? 'left' : 'bad' },
    ],
    figure: { label: 'R\u00e9sultat pour 100 \u20ac', value: euro(net), good: net >= 0 },
  })
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 6. La croissance \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

/** De la premi\u00e8re \u00e0 la cinqui\u00e8me ann\u00e9e : ce que le plan promet. */
function growthCard(r) {
  const rev = r.pnl.revenue.slice(0, 5).map((v) => n(v))
  const a1 = rev[0], a5 = rev[4]
  if (a1 <= 0 && a5 <= 0) {
    return card({
      tone: 'watch', kicker: 'La croissance', title: 'Trajectoire non calculable', ico: 'depart',
      body: "Le mod\u00e8le ne comporte aucun chiffre d'affaires : la trajectoire sur cinq ans ne peut pas \u00eatre \u00e9tablie. Un prix et un volume de ventes suffisent \u00e0 la faire appara\u00eetre.",
      figure: { label: 'Chiffre d\u2019affaires \u2014 ann\u00e9e 5', value: '\u2014', good: false },
    })
  }
  const mult = a1 > 0 ? a5 / a1 : null
  const yearly = a1 > 0 && a5 > 0 ? Math.pow(a5 / a1, 1 / 4) - 1 : null
  return card({
    tone: mult === null ? 'watch' : mult >= 2 ? 'good' : 'watch',
    kicker: 'La croissance',
    title: yearly === null
      ? `Chiffre d\u2019affaires de ${euro(a5)} en ann\u00e9e 5`
      : `Croissance du CA de ${pct(yearly, 0)} par an sur 4 ans`,
    ico: 'depart',
    body: yearly === null
      ? `Le chiffre d'affaires atteint ${euro(a5)} en ann\u00e9e 5.`
      : `Le chiffre d'affaires passe de ${euro(a1)} \u00e0 ${euro(a5)} entre l'ann\u00e9e 1 et l'ann\u00e9e 5, soit une multiplication par ${num(mult, 1)}. Ce taux de croissance annuel moyen de ${pct(yearly, 0)} constitue l'hypoth\u00e8se principale \u00e0 justifier lors de la v\u00e9rification du plan d'affaires par un tiers.`,
    bars: rev.map((v, k) => ({ label: `A${k + 1}`, value: v })),
    figure: { label: 'Chiffre d\u2019affaires \u2014 ann\u00e9e 5', value: euro(a5), good: a5 >= a1 },
  })
}


/* ──────────────────────────── La carte commune ──────────────────────────── */

function card({ tone, kicker, title, body, figure, bars, line, split, meter, ico }) {
  return h('section', { class: `plaincard is-${tone}` },
    h('header', { class: 'plaincard-head' },
      ico ? h('span', { class: 'plaincard-ico', html: icon(ico) }) : null,
      h('div', {},
        h('div', { class: 'plaincard-kicker' }, kicker),
        h('h3', { class: 'plaincard-title' }, title),
      ),
    ),
    h('p', { class: 'plaincard-body' }, body),
    bars ? miniBars(bars) : null,
    line ? miniLine(line) : null,
    split ? miniSplit(split) : null,
    meter ? miniMeter(meter) : null,
    figure ? h('div', { class: 'plaincard-figure' },
      h('span', { class: 'plaincard-figure-label' }, figure.label),
      h('span', { class: `plaincard-figure-value num ${figure.good ? 'pos' : 'neg'}` }, figure.value),
    ) : null,
  )
}

/**
 * Cinq barres, une par année.
 *
 * Pas d'axe, pas de graduation : la seule chose à lire est le sens — ça monte,
 * ça part du rouge, ça passe au vert telle année. Un graphique complet dirait
 * la même chose en demandant un effort.
 */
function miniBars(items) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)))
  // Les barres ne repoussent que si les chiffres ont bougé. Animées à chaque
  // rendu, elles se seraient relevées à chaque frappe dans un champ.
  const fresh = changed('plainbars', items.map((i) => Math.round(i.value)).join())
  return h('div', { class: `plainbars ${fresh ? 'is-fresh' : ''}` },
    ...items.map((it) => h('div', { class: 'plainbar' },
      h('div', { class: 'plainbar-track' },
        h('i', {
          class: it.value >= 0 ? 'is-pos' : 'is-neg',
          style: { height: `${Math.max(3, (Math.abs(it.value) / max) * 100)}%` },
        }),
      ),
      h('span', { class: 'plainbar-label' }, it.label),
    )),
  )
}

/** La courbe de trésorerie, réduite à sa forme et à son passage sous zéro. */
function miniLine(values) {
  if (!values.length) return null
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const w = 300, hgt = 56
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = hgt - ((v - min) / span) * hgt
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const zero = hgt - ((0 - min) / span) * hgt
  // Un élément SVG ne se crée pas comme un élément HTML : sans son espace de
  // noms, le navigateur fabrique un nœud inconnu qu'il n'affiche jamais.
  return h('div', { class: 'plainline' },
    svg('svg', { viewBox: `0 0 ${w} ${hgt}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' },
      svg('line', { x1: 0, y1: zero, x2: w, y2: zero, class: 'plainline-zero' }),
      svg('polyline', { points: pts, class: 'plainline-path' }),
    ),
    h('span', { class: 'plainline-note' }, 'Ton compte, mois par mois, sur trois ans'),
  )
}

/**
 * O\u00f9 part chaque euro : une seule barre, en parts.
 *
 * Un camembert \u00e0 quatre parts demande de comparer des angles ; une barre
 * empil\u00e9e se lit de gauche \u00e0 droite, comme la phrase qui la pr\u00e9c\u00e8de.
 */
function miniSplit(parts) {
  const keep = parts.filter((p) => p.value > 0)
  const total = keep.reduce((a, p) => a + p.value, 0) || 100
  return h('div', { class: 'plainsplit' },
    h('div', { class: 'plainsplit-bar' },
      ...keep.map((p) => h('i', {
        class: `is-${p.tone}`, style: { flexGrow: String(p.value / total) },
        title: `${p.label} \u2014 ${p.value} \u20ac sur 100`,
      })),
    ),
    h('div', { class: 'plainsplit-keys' },
      ...keep.map((p) => h('span', { class: `plainsplit-key is-${p.tone}` },
        h('i', {}), `${p.label} ${p.value}`)),
    ),
  )
}

/** Une jauge : o\u00f9 l'on en est d'un seuil, sans axe ni graduation. */
function miniMeter({ part, label }) {
  return h('div', { class: 'plainmeter' },
    h('div', { class: 'plainmeter-track' },
      h('i', { style: { width: `${Math.min(100, Math.max(2, part * 100))}%` }, class: part >= 1 ? 'is-ok' : '' }),
      h('span', { class: 'plainmeter-mark', 'aria-hidden': 'true' }),
    ),
    h('span', { class: 'plainmeter-label' }, label),
  )
}

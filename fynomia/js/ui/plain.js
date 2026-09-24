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
import { vraisemblance, bloquantes } from '../engine/plausible.js'
import { gardeBloc } from './garde.js'

const n = (v) => Number(v) || 0

/** Combien de lignes du dossier restent à poser. */
const left = () => { try { const c = checklist(store.scenario); return c.total - c.done } catch { return 0 } }

/**
 * Le récit de la synthèse, sans sa mise en page.
 *
 * Deux écrans lisent la même synthèse — l'onglet d'origine et son essai de
 * forme. S'ils écrivaient chacun leurs phrases, le moindre correctif de
 * formulation n'arriverait que dans l'un des deux, et le fondateur lirait deux
 * verdicts différents pour un même plan. Les actes et leurs cartes sont donc
 * produits ici, sous forme de données — titre, texte, chiffre, image à tracer
 * — et chaque écran les dessine à sa façon.
 */
export function synthese(s, r) {
  // Avant le premier euro de chiffre d'affaires, on ne renvoyait qu'une phrase
  // fixe : « aucune synthèse n'est calculable ». Elle était exacte et fausse à
  // la fois — le plan ne vend encore rien, mais il coûte déjà quelque chose, et
  // ce quelque chose bougeait à chaque charge ajoutée sans que l'écran ne
  // change d'un mot. Un fondateur qui remplit ses charges et son équipe voyait
  // donc le même texte pendant une heure, et concluait que l'outil ne calculait
  // rien. Il y a une synthèse à rendre dans cet état : ce que ça coûte, combien
  // de temps la trésorerie tient, et ce qu'il faudra vendre pour couvrir.
  const sansCA = !(r.pnl.revenue || []).some((v) => n(v) > 0)
  const actes = sansCA ? actsAvant(s, r) : acts(s, r)

  // Un chiffre hors de toute proportion avec le métier — un prix avec deux
  // zéros de trop, un salaire saisi en milliers — produit des résultats
  // exacts et absurdes. Le premier acte garde son titre, qui dit ce que le
  // plan donne tel qu'il est saisi ; il porte en plus un avertissement qui se
  // déplie, et aucune carte ne se colore en succès tant qu'il tient.
  // Chaque lecture dit aussi pourquoi elle compte : un chiffre sans ce qu'il
  // représente se lit comme une légende de graphique, pas comme un conseil.
  for (const a of actes) a.cartes = a.cartes.map((c) => (c && POURQUOI[c.cle] ? { ...c, pourquoi: POURQUOI[c.cle] } : c))

  let garde = []
  try { garde = vraisemblance(s, r) } catch { garde = [] }
  if (garde.length) actes[0] = { ...actes[0], garde }
  if (bloquantes(garde).length && !sansCA) {
    for (const a of actes) a.cartes = a.cartes.map((c) => (c && c.tone === 'good' ? { ...c, tone: 'watch' } : c))
  }
  return { sansCA, actes, garde }
}

/** Pourquoi chaque lecture compte — dit simplement, pour qui n'a jamais lu un bilan. */
export const POURQUOI = {
  cout: 'C’est ce que ton projet dépense chaque mois, même sans rien vendre : la somme à couvrir avant de gagner le premier euro.',
  tenue: 'Le nombre de mois que ton argent de départ te laisse : c’est le temps dont tu disposes pour trouver tes premiers clients.',
  invest: 'Le matériel acheté au départ vide le compte tout de suite, même s’il ne pèse sur le résultat que petit à petit.',
  objectif: 'Le chiffre d’affaires minimum pour ne plus perdre d’argent : c’est ton premier objectif commercial.',
  manque: 'L’argent à trouver pour ne jamais être à découvert : c’est ce que tu demandes à une banque ou à des investisseurs.',
  profit: 'Ce qui reste une fois tout payé, impôt compris : la preuve que l’activité crée de la valeur au lieu d’en consommer.',
  cash: 'On peut être rentable et manquer d’argent : c’est le compte en banque qui décide si tu tiens jusqu’au bénéfice.',
  remuneration: 'Ce que toi tu touches : un plan où le fondateur ne vit pas de son activité ne tient pas longtemps.',
  seuil: 'Le chiffre d’affaires à partir duquel tu gagnes de l’argent : en dessous, chaque mois te coûte.',
  poste: 'Ta plus grosse dépense : c’est là qu’une économie rapporte le plus vite.',
  sur100: 'Sur 100 € encaissés, ce qui part où : l’image la plus simple de ton modèle, celle qu’un associé comprend en dix secondes.',
  croissance: 'Comment ton chiffre d’affaires évolue d’une année sur l’autre : c’est ce qui dit si l’entreprise grandit, et à quel rythme.',
}

/** La phrase qui clôt la synthèse : d'où viennent ces lectures, et que faire d'un écart. */
export const RELIRE = 'Ces lectures reposent sur les mêmes calculs que l’analyse détaillée, ci-dessous. Un écart avec ce que tu attendais vient soit d’une hypothèse à revoir, soit d’une ligne qui n’a pas encore été posée.'

/** Combien de lignes du dossier restent à poser — pour le bouton qui y mène. */
export const lignesRestantes = () => left()

/** La synthèse complète. `r` est le résultat du moteur, `s` le scénario. */
export function plainBoard(s, r, navigate, goRefine) {
  if (!r) return null

  // Trois actes, pas six lectures.
  //
  // Les six cartes disaient quatre fois la même chose sous quatre formes : le
  // résultat net, le seuil non atteint, les dépenses pour cent euros facturés
  // et la rémunération incluse dans la perte énoncent tous « tu perds de
  // l'argent ». Un tableau de bord doit répondre à « qu'est-ce que je dois
  // traiter », pas énumérer ce que le logiciel sait calculer.
  //
  // L'ordre de lecture porte donc la question à laquelle chaque groupe répond :
  // est-ce que ça tient, d'où ça vient, où agir. C'est la même matière, rangée
  // dans l'ordre où on se la pose.
  const { actes } = synthese(s, r)

  return h('div', { class: 'plain' },
    ...actes.map((a) => h('section', { class: 'plain-act' },
      h('div', { class: 'plain-act-head' },
        h('h2', { class: 'plain-act-title' }, a.titre),
        a.garde ? gardeBloc(a.garde, navigate, { classe: 'is-act' }) : null,
        h('p', { class: 'plain-act-say' }, a.dit),
      ),
      h('div', { class: 'plain-cards' }, ...a.cartes.filter(Boolean).map(card)),
    )),
    h('div', { class: 'plain-foot' },
      h('p', {}, RELIRE),
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

/**
 * Les trois actes, dits pour la situation qu'on a sous les yeux.
 *
 * Un titre d'acte fixe — « Est-ce que ça tient ? » — pose la question sans
 * jamais y répondre, et laisse au lecteur le travail de trancher à partir de
 * six cartes. Or c'est exactement ce travail-là qu'on lui doit. Chaque acte
 * annonce donc sa réponse, tirée du modèle : rentable ou non, financé ou non,
 * quel poste pèse, quel levier reste. La matière ne change pas ; ce qui change,
 * c'est qu'on la lit au lieu de la déchiffrer.
 */
function acts(s, r) {
  const p = r.pnl, k = r.kpis
  const first = p.netResult.findIndex((v) => v > 0)
  const rentable = first >= 0
  const manque = n(k.fundingNeed) > 0
  const i = Math.max(0, first)

  // Le poste le plus lourd : c'est lui qui donne son verbe au troisième acte.
  const blocs = [
    { nom: 'la masse salariale', m: Math.abs(n(p.payroll[i])), ou: 'l\u2019équipe', pluriel: false },
    { nom: 'les achats', m: Math.abs(n(p.variableCost[i])), ou: 'le coût de revient', pluriel: true },
    { nom: 'les charges fixes', m: Math.abs(n(p.external[i])) + Math.abs(n(p.duties[i])), ou: 'les charges', pluriel: true },
  ].sort((a, b) => b.m - a.m)
  const tete = blocs[0]

  // Le titre du premier acte porte la réponse ET son échéance.
  //
  // « Ça tient, à condition d'être financé » était vrai pour un plan rentable
  // en année 2 avec 30 000 € à trouver comme pour un plan rentable en année 5
  // avec deux millions. Deux situations que rien ne sépare à l'écran, alors
  // que tout les sépare dans la vie du fondateur. Le titre nomme donc l'année
  // et le montant : c'est ce qui rend la lecture propre à ce plan-là.
  const titre1 = !rentable
    ? (manque ? `Non : il manque ${euro(k.fundingNeed)}` : 'Non, pas encore')
    : !manque
      ? (first === 0 ? 'Oui, dès la première année' : `Oui, à partir de l\u2019année ${first + 1}`)
      : first === 0
        ? `Rentable tout de suite, mais ${euro(k.fundingNeed)} à avancer`
        : `Oui en année ${first + 1}, avec ${euro(k.fundingNeed)} à trouver d\u2019ici là`

  const marge = n(k.netMargin?.[i])
  const tient = rentable && !manque
    ? `${Math.round(marge * 100)} % de résultat net, et la trésorerie ne passe jamais sous zéro.`
    : rentable && manque
      ? `Rentable ne veut pas dire financé : c\u2019est la trésorerie qui décide si tu vois l\u2019année ${first + 1}.`
      : manque
        ? `Aucun bénéfice sur cinq ans, et ${euro(k.fundingNeed)} manquent au point bas. À traiter avant tout le reste.`
        : `Aucun bénéfice sur cinq ans. La trésorerie tient, mais sur ce que tu as mis au départ.`

  // Le deuxième acte nomme le poste et ce qu'il absorbe du chiffre d'affaires.
  const rev = n(p.revenue[i])
  const absorbe = rev > 0 ? Math.round((tete.m / rev) * 100) : null
  const titre2 = absorbe !== null && absorbe > 100
    ? `${maj(tete.nom)} ${tete.pluriel ? 'coûtent' : 'coûte'} plus que tu ne vends`
    : absorbe !== null
      ? `${maj(tete.nom)} : ${absorbe} % de ce que tu encaisses`
      : `${maj(tete.nom)}, ton premier poste de dépense`
  const vient = absorbe !== null
    ? `Ton premier poste de dépense, en année ${i + 1}. Où part chaque euro encaissé, et ce qu\u2019il t\u2019en reste.`
    : 'Ton premier poste de dépense. Où part chaque euro encaissé, et ce qu\u2019il t\u2019en reste.'

  // Le troisième acte dit la distance au seuil, en euros ou en multiple :
  // « où agir » ne se lisait pas, « encore 40 000 € de ventes » se lit.
  const seuil = n(k.breakEven?.[i])
  const ecart = seuil > 0 && rev > 0 ? rev / seuil : null
  const fois = ecart ? (1 / ecart).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : null
  const titre3 = rentable
    ? (seuil > 0 ? `Au-delà de ${euro(seuil)} de ventes en année ${i + 1}, tu gagnes de l\u2019argent` : 'Chaque vente couvre déjà tes coûts')
    : ecart !== null && ecart >= 0.5
      ? `Encore ${euro(seuil - rev)} de ventes par an pour être rentable`
      : ecart !== null
        ? `Il faut vendre ${fois} fois plus pour être rentable`
        : rev > 0
          ? 'Aucun volume de ventes ne couvre tes coûts aujourd\u2019hui'
          : 'Ce qu\u2019il faudra vendre pour être rentable'
  const agir = rentable
    ? `Seuil franchi en année ${first + 1}. Tout ce qui passe au-dessus est du bénéfice ; en dessous, tu perds de l\u2019argent.`
    : ecart === null && rev > 0
      ? 'Chaque vente coûte plus qu\u2019elle ne rapporte : vendre davantage creuse la perte. Le prix ou le coût de revient d\u2019abord.'
    : ecart !== null && ecart > 0.8
      ? `Tu couvres ${Math.round(ecart * 100)} % du seuil : quelques pour cent de prix suffisent souvent.`
      : `Trois leviers déplacent le seuil : le prix, le volume, et ${tete.ou}. Le prix agit tout de suite.`

  return [
    { titre: titre1, dit: tient, cartes: [profitCard(r), cashCard(r)] },
    { titre: titre2, dit: vient, cartes: [causeCard(r), keepCard(r), takeCard(s, r)] },
    { titre: titre3, dit: agir, cartes: [breakEvenCard(s, r), growthCard(r)] },
  ]
}

/** Première lettre en capitale — sans jamais toucher au reste. */
const maj = (t) => `${t.charAt(0).toUpperCase()}${t.slice(1)}`

/**
 * Les trois actes d'un plan qui ne vend pas encore.
 *
 * Tant qu'aucune offre n'a de prix ni de volume, le moteur ne peut pas rendre
 * de verdict — mais il a déjà tout le reste : les charges, l'équipe, les
 * investissements, l'apport. Ces chiffres-là sont vrais, ils sont à lui, et ils
 * changent à chaque saisie. Les lui rendre, c'est la différence entre un outil
 * qui calcule et un outil qui attend.
 *
 * L'ordre est le même que pour un plan complet : ce que ça donne, d'où ça
 * vient, où agir. Ici la première question devient « combien ça coûte et
 * combien de temps ça tient », et la dernière « combien faut-il vendre ».
 */
function actsAvant(s, r) {
  const p = r.pnl, k = r.kpis
  const charge = charges(r, 0)
  const mois = charge / 12
  const equipe = Math.abs(n(p.payroll[0]))
  const fixe = Math.abs(n(p.external[0])) + Math.abs(n(p.duties[0]))
  const invest = somme(r.capex?.spendMonthly, 12)
  const mise = somme(r.financing?.equity) + somme(r.financing?.investors) +
    somme(r.financing?.grants) + somme(r.financing?.shareholderLoans) + somme(r.financing?.loanDrawdown) +
    n(r.financing?.openingCash)
  const tenue = n(k.runwayMonths)

  // Le premier paragraphe nomme la situation réelle, pas un état d'attente.
  const dit = charge <= 0
    ? 'Ni ce que tu vends, ni ce que ça te coûte. Les cartes se rempliront à la première charge saisie.'
    : mise <= 0
      ? `${euro(mois)} par mois, et rien de prévu pour le financer. Ce chiffre tombe même si tu ne vends rien.`
      : tenue > 0 && tenue < 60
        ? `${euro(mois)} par mois. Avec ${euro(mise)} au départ, tu tiens ${Math.floor(tenue)} mois sans vendre.`
        : `${euro(mois)} par mois. La moitié de l\u2019équation que le moteur sait déjà calculer — exactement.`

  const dominant = equipe >= fixe ? 'l\u2019équipe' : 'les charges fixes'
  const vient = charge <= 0
    ? 'Dès qu\u2019une charge existe, on dit laquelle pèse le plus.'
    : `Sur ${euro(charge)}, c\u2019est ${dominant} qui pèse le plus — et qui décide de ce qu\u2019il faudra vendre.`

  const agir = charge <= 0
    ? 'Une offre, un prix, un volume : ce trio déclenche le calcul complet.'
    : `Couvrir ${euro(charge)} demande un chiffre d\u2019affaires. Combien, cela dépend de ce que chaque vente coûte.`

  return [
    { titre: charge <= 0 ? 'Le plan est encore vide' : 'Ce que ton projet coûte, avant de vendre',
      dit,
      cartes: [coutCard(r), tenueCard(r)] },
    { titre: charge <= 0 ? 'Aucune dépense saisie pour l\u2019instant'
        : `${maj(dominant)} : ${euro(Math.max(equipe, fixe))} sur ${euro(charge)}`,
      dit: vient,
      cartes: [causeCard(r), investCard(r)] },
    { titre: charge <= 0 ? 'Rien à couvrir pour l\u2019instant' : `Au moins ${euro(charge)} de ventes la première année`,
      dit: agir,
      cartes: [objectifCard(r), manqueCard(s)] },
  ]
}

/** Les charges totales d'un exercice : ce que l'entreprise dépense pour exister. */
function charges(r, y) {
  const f = n(r.kpis?.fixedCosts?.[y])
  if (f > 0) return f
  const p = r.pnl
  return Math.abs(n(p.payroll[y])) + Math.abs(n(p.external[y])) + Math.abs(n(p.duties[y])) +
    Math.abs(n(p.amortisation[y])) + Math.abs(n(p.variableCost[y]))
}

/** Somme d'une série mensuelle, éventuellement bornée aux premiers mois. */
function somme(serie, jusqua) {
  if (!Array.isArray(serie)) return 0
  const fin = jusqua == null ? serie.length : Math.min(jusqua, serie.length)
  let t = 0
  for (let i = 0; i < fin; i++) t += n(serie[i])
  return t
}

/** Ce que ça coûte : le seul chiffre certain d'un plan qui ne vend pas encore. */
function coutCard(r) {
  const p = r.pnl
  const a1 = charges(r, 0)
  if (a1 <= 0) {
    return spec({ cle: 'cout',
      tone: 'watch', kicker: 'Charges', ico: 'argent',
      title: 'Aucune dépense saisie',
      body: 'Ni charge fixe, ni salaire, ni investissement n\u2019est encore entré dans le modèle. Le loyer, l\u2019assurance, le comptable, les logiciels : ce sont eux qui donnent la première marche à franchir.',
      figure: { label: 'Charges \u2014 année 1', value: euro(0), good: false },
    })
  }
  const equipe = Math.abs(n(p.payroll[0]))
  const fixe = Math.abs(n(p.external[0])) + Math.abs(n(p.duties[0]))
  const amort = Math.abs(n(p.amortisation[0]))
  const variable = Math.abs(n(p.variableCost[0]))
  const bloc = [
    { cle: 'team', nom: 'salaires', v: equipe },
    { cle: 'other', nom: 'charges fixes', v: fixe },
    { cle: 'buys', nom: 'amortissements', v: amort + variable },
  ].filter((b) => b.v > 0)
  const part = (v) => Math.round((v / a1) * 100)

  return spec({ cle: 'cout',
    tone: 'watch', kicker: 'Charges', ico: 'argent',
    title: `${euro(a1)} de charges la première année`,
    body: `Soit ${euro(a1 / 12)} par mois, avant d\u2019avoir vendu quoi que ce soit. ` + (equipe > 0
      ? `La masse salariale en représente ${part(equipe)} % — elle inclut les cotisations patronales, pas seulement les salaires affichés. `
      : 'Aucun salaire n\u2019est encore prévu : ce montant ne couvre donc pas ton propre travail. ') +
      `Ces charges tombent chaque mois, que tu vendes ou non.`,
    bars: [0, 1, 2, 3, 4].map((y) => ({ label: `A${y + 1}`, value: -charges(r, y) })),
    split: bloc.length > 1 ? bloc.map((b) => ({ label: b.nom, value: part(b.v), tone: b.cle })) : null,
    figure: { label: 'Par mois', value: euro(a1 / 12), good: false },
  })
}

/** Combien de temps la mise de départ absorbe la dépense. */
function tenueCard(r) {
  const k = r.kpis
  const brule = Math.abs(n(k.burnRate))
  const mise = somme(r.financing?.equity) + somme(r.financing?.investors) +
    somme(r.financing?.grants) + somme(r.financing?.shareholderLoans) +
    somme(r.financing?.loanDrawdown) + n(r.financing?.openingCash)
  const bas = k.cashLow
  const quand = bas && bas.month != null ? monthLabel(bas.month, r.startDate) : null
  const mois = brule > 0 ? mise / brule : 0
  const trésor = (r.cash?.balance || []).slice(0, 24).map((v) => n(v))

  if (mise <= 0) {
    return spec({ cle: 'tenue',
      tone: 'bad', kicker: 'Trésorerie', ico: 'depart',
      title: brule > 0 ? 'Rien n\u2019est prévu pour financer le démarrage' : 'Aucun financement saisi',
      body: brule > 0
        ? `Le modèle sort ${euro(brule)} par mois et n\u2019entre rien : ni apport, ni prêt, ni subvention. Le compte passe sous zéro dès le premier mois. Pose ce que tu mets au départ dans « Financement » — c\u2019est ce montant qui décide du temps dont tu disposes.`
        : 'Ni apport, ni prêt, ni subvention n\u2019est encore saisi. Rien ne sort non plus : le plan est à zéro des deux côtés.',
      line: trésor.length ? trésor : null,
      figure: { label: 'Sortie par mois', value: euro(brule), good: false },
    })
  }

  return spec({ cle: 'tenue',
    tone: mois >= 18 ? 'good' : mois >= 9 ? 'watch' : 'bad',
    kicker: 'Trésorerie', ico: 'depart',
    title: brule > 0
      ? `${euro(mise)} au départ : ${Math.floor(mois)} mois devant toi`
      : `${euro(mise)} au départ, aucune dépense en face`,
    body: brule > 0
      ? `À ${euro(brule)} de sortie par mois, la mise de départ est consommée en ${Math.floor(mois)} mois${quand ? `, et le point bas tombe en ${quand}` : ''}. C\u2019est le délai réel pour atteindre un chiffre d\u2019affaires — pas une estimation de confort : ` + (mois < 9
        ? 'moins de neuf mois laisse peu de place à un démarrage lent.'
        : mois < 18
          ? 'c\u2019est court pour une activité qui met un an à trouver ses clients.'
          : 'de quoi encaisser un démarrage plus lent que prévu.')
      : 'Aucune charge n\u2019est encore saisie en face : ce montant reste intact, faute de dépenses à absorber.',
    line: trésor.length ? trésor : null,
    figure: { label: 'Sortie par mois', value: euro(brule), good: false },
  })
}

/** Ce que l'ouverture coûte, une fois pour toutes. */
function investCard(r) {
  const invest = somme(r.capex?.spendMonthly)
  if (invest <= 0) return null
  const an1 = somme(r.capex?.spendMonthly, 12)
  const amort = Math.abs(n(r.pnl.amortisation[0]))
  const lignes = (r.capex?.perItem || []).filter((x) => n(x.amount ?? x.value ?? x.cost) > 0)
  const gros = lignes.slice().sort((a, b) => n(b.amount ?? b.value ?? b.cost) - n(a.amount ?? a.value ?? a.cost))[0]

  return spec({ cle: 'invest',
    tone: 'watch', kicker: 'Investissements', ico: 'savoir',
    title: `Ouvrir coûte ${euro(an1)}`,
    body: `${an1 === invest ? 'La totalité' : `${euro(an1)} sur ${euro(invest)}`} est dépensée la première année` +
      (gros && gros.label ? `, dont ${gros.label} pour ${euro(n(gros.amount ?? gros.value ?? gros.cost))}` : '') +
      `. Cet argent sort du compte tout de suite, mais ne pèse au résultat que par l\u2019amortissement — ${euro(amort)} la première année. C\u2019est ce décalage qui fait qu\u2019une entreprise rentable peut manquer de trésorerie.`,
    figure: { label: 'Sortie immédiate', value: euro(an1), good: false },
  })
}

/**
 * Le chiffre d'affaires à atteindre, calculé sans connaître l'offre.
 *
 * C'est la seule chose utile à dire à ce stade, et elle se calcule : couvrir
 * les charges demande un chiffre d'affaires d'autant plus grand que chaque
 * vente coûte cher. Trois taux de marge encadrent la réponse, et le fondateur
 * reconnaît le sien. Chaque charge ajoutée déplace les trois.
 */
function objectifCard(r) {
  const a1 = charges(r, 0)
  if (a1 <= 0) {
    return spec({ cle: 'objectif',
      tone: 'watch', kicker: 'Objectif', ico: 'argent',
      title: 'Rien à couvrir pour l\u2019instant',
      body: 'Sans charge saisie, il n\u2019y a pas de seuil à franchir. Pose ce que coûte ton activité — même approximativement — et cette carte dira ce qu\u2019il faut encaisser pour l\u2019absorber.',
    })
  }
  const a = (taux) => a1 / taux
  return spec({ cle: 'objectif',
    tone: 'watch', kicker: 'Objectif', ico: 'argent',
    title: `Il faut encaisser au moins ${euro(a1)} la première année`,
    body: `C\u2019est le montant qui couvre exactement tes charges, si chaque euro encaissé restait dans l\u2019entreprise. Il en faut davantage dès que tes ventes ont un coût : ` +
      `${euro(a(0.7))} avec 70 % de marge, ${euro(a(0.5))} avec 50 %, ${euro(a(0.3))} avec 30 %. ` +
      `Pose le prix et le volume de ton offre : le moteur remplacera ces trois repères par ton seuil réel, au mois près.`,
    bars: [
      { label: '70 %', value: a(0.7) },
      { label: '50 %', value: a(0.5) },
      { label: '30 %', value: a(0.3) },
    ],
    figure: { label: 'Par mois, à 50 % de marge', value: euro(a(0.5) / 12), good: false },
  })
}

/** Ce qui manque pour que le calcul complet démarre. */
function manqueCard(s) {
  let c
  try { c = checklist(s) } catch { return null }
  const reste = (c.items || []).filter((i) => !i.done && i.tier === 'fondation')
  const suite = reste.length ? reste : (c.items || []).filter((i) => !i.done)
  if (!suite.length) return null
  const trois = suite.slice(0, 3)

  return spec({ cle: 'manque',
    tone: 'watch', kicker: 'Ce qui manque', ico: 'idee',
    title: trois.length === 1
      ? `Une seule ligne manque : ${trois[0].label.toLowerCase()}`
      : `${suite.length} lignes manquent pour calculer ton chiffre d\u2019affaires`,
    body: trois.map((i) => `${i.label} \u2014 ${i.why}`).join(' ') +
      (suite.length > trois.length ? ` Et ${suite.length - trois.length} autre${suite.length - trois.length > 1 ? 's' : ''}.` : ''),
    meter: { part: c.done / Math.max(1, c.total), label: `${c.done} lignes posées sur ${c.total}` },
    figure: { label: 'Dossier rempli', value: `${Math.round((c.done / Math.max(1, c.total)) * 100)} %`, good: c.done / Math.max(1, c.total) > 0.6 },
  })
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

  return spec({ cle: 'profit',
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

  return spec({ cle: 'cash',
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
    return spec({ cle: 'remuneration',
      tone: 'watch', kicker: 'Ta r\u00e9mun\u00e9ration',
      title: 'Aucune r\u00e9mun\u00e9ration du dirigeant au mod\u00e8le', ico: 'commerce',
      body: "Le pr\u00e9visionnel ne comporte aucune charge de r\u00e9mun\u00e9ration pour le dirigeant. Le r\u00e9sultat affich\u00e9 est donc surestim\u00e9 du montant que tu devras te verser. Un analyste retraitera ce poste avant toute d\u00e9cision : mieux vaut l'inscrire, m\u00eame \u00e0 un niveau modeste.",
      figure: { label: 'Brut annuel', value: '\u2014', good: false },
    })
  }

  const yearly = gross * 12
  const marge = n(r.pnl.netResult[0])
  return spec({ cle: 'remuneration',
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
    return spec({ cle: 'seuil',
      tone: 'bad', kicker: 'Le point mort',
      title: 'Seuil de rentabilit\u00e9 inatteignable : co\u00fbt sup\u00e9rieur au prix', ico: 'cible',
      body: "Le prix de vente unitaire est inf\u00e9rieur au co\u00fbt de revient. Vendre des volumes suppl\u00e9mentaires augmente la perte globale au lieu d'amortir les charges fixes. Le calcul du point mort suppose d'abord de rendre la marge unitaire positive.",
      figure: { label: 'Seuil annuel', value: '\u2014', good: false },
    })
  }
  return spec({ cle: 'seuil',
    tone: done ? 'good' : 'watch',
    kicker: 'Le point mort',
    title: done
      ? `Seuil de rentabilit\u00e9 franchi en ann\u00e9e ${ref + 1}`
      : `Seuil de rentabilit\u00e9 \u00e0 ${euro(need)} de chiffre d\u2019affaires`,
    ico: 'cible',
    body: done
      ? `Les charges de l'exercice sont couvertes \u00e0 partir de ${euro(need)} de chiffre d'affaires ; le mod\u00e8le en pr\u00e9voit ${euro(revenue)} en ann\u00e9e ${ref + 1}. Au-del\u00e0 de ce seuil, chaque vente suppl\u00e9mentaire contribue int\u00e9gralement au r\u00e9sultat, d\u00e9duction faite de son co\u00fbt direct.`
      : `Les charges de l'exercice exigent ${euro(need)} de chiffre d'affaires pour \u00eatre couvertes ; le mod\u00e8le en pr\u00e9voit ${euro(revenue)} en ann\u00e9e ${ref + 1}. L'\u00e9cart se r\u00e9duit par le prix, par le volume, ou par une baisse des charges fixes \u2014 les trois leviers ne se valent pas : le prix agit imm\u00e9diatement, le volume suppose de la demande.`,
    meter: { part: share, label: `${Math.round(share * 100)} % du seuil atteint en ann\u00e9e ${ref + 1}`, seuil: need, prevu: revenue },
    figure: { label: 'Seuil annuel', value: euro(need), good: done },
  })
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 5. Ce qui reste sur 100 \u20ac \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

/** O\u00f9 part l'argent, sur cent euros factur\u00e9s. */
/**
 * Le poste qui explique le résultat.
 *
 * C'est la question que personne ne posait à l'écran : « pourquoi ce chiffre ».
 * Les cartes disaient combien on perd, à partir de quel seuil on gagnerait et
 * ce que représentent cent euros facturés — jamais quel poste, nommément, fait
 * pencher la balance. Celle-ci compare les trois blocs de charges, désigne le
 * plus lourd, dit sa part et ce qu'il faudrait pour l'absorber.
 */
function causeCard(r) {
  const p = r.pnl
  const i = Math.max(0, p.netResult.findIndex((v) => v > 0))
  const rev = n(p.revenue[i])
  const blocs = [
    { cle: 'team', nom: 'la masse salariale', montant: Math.abs(n(p.payroll[i])), page: 'equipe', quoi: 'les salaires et les cotisations' },
    { cle: 'buys', nom: 'les achats', montant: Math.abs(n(p.variableCost[i])), page: 'achats', quoi: 'ce que coûte chaque vente' },
    { cle: 'other', nom: 'les charges fixes', montant: Math.abs(n(p.external[i])) + Math.abs(n(p.duties[i])), page: 'achats', quoi: 'le loyer, le comptable, les logiciels, les assurances' },
  ].sort((a, b) => b.montant - a.montant)
  const total = blocs.reduce((a, x) => a + x.montant, 0)
  if (total <= 0) return null
  const tete = blocs[0]
  const part = Math.round((tete.montant / total) * 100)
  const couvre = rev > 0 ? Math.round((tete.montant / rev) * 100) : null

  return spec({ cle: 'poste',
    tone: couvre !== null && couvre > 100 ? 'bad' : couvre !== null && couvre > 60 ? 'watch' : 'good',
    kicker: 'Le poste qui pèse',
    title: `${tete.nom.charAt(0).toUpperCase()}${tete.nom.slice(1)} : ${euro(tete.montant)} par an`,
    ico: 'argent',
    body: couvre === null
      ? `En année ${i + 1}, ${tete.nom} représente ${part} % de tes charges — ${tete.quoi}. C'est le premier poste sur lequel agir, mais il manque un chiffre d'affaires pour dire s'il est tenable.`
      : `En année ${i + 1}, ${tete.nom} représente ${part} % de tes charges et absorbe ${couvre} % de ton chiffre d'affaires — ${tete.quoi}. ` + (couvre > 100
        ? `À elle seule, cette ligne coûte plus que tout ce que tu encaisses : aucune autre économie ne compensera tant qu'elle n'aura pas bougé.`
        : `Chaque euro gagné ailleurs passe d'abord par là.`),
    split: blocs.map((bl) => ({ label: bl.nom.replace('la ', '').replace('les ', ''), value: total ? Math.round((bl.montant / total) * 100) : 0, tone: bl.cle })),
    figure: { label: `Part de tes charges`, value: `${part} %`, good: part < 50 },
  })
}

function keepCard(r) {
  const i = Math.max(0, r.pnl.netResult.findIndex((v) => v > 0))
  const p = r.pnl
  const rev = n(p.revenue[i])
  if (rev <= 0) {
    return spec({ cle: 'sur100',
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

  return spec({ cle: 'sur100',
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
    return spec({ cle: 'croissance',
      tone: 'watch', kicker: 'La croissance', title: 'Trajectoire non calculable', ico: 'depart',
      body: "Le mod\u00e8le ne comporte aucun chiffre d'affaires : la trajectoire sur cinq ans ne peut pas \u00eatre \u00e9tablie. Un prix et un volume de ventes suffisent \u00e0 la faire appara\u00eetre.",
      figure: { label: 'Chiffre d\u2019affaires \u2014 ann\u00e9e 5', value: '\u2014', good: false },
    })
  }
  const mult = a1 > 0 ? a5 / a1 : null
  const yearly = a1 > 0 && a5 > 0 ? Math.pow(a5 / a1, 1 / 4) - 1 : null
  return spec({ cle: 'croissance',
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

/**
 * Une carte, sous forme de données.
 *
 * Chaque lecture renvoie son contenu — ton, surtitre, titre, texte, chiffre
 * et image à tracer — sans décider de sa forme : `card` le dessine pour la
 * synthèse d'origine, l'essai de forme le dessine autrement.
 */
const spec = (o) => o

function card({ tone, kicker, title, body, figure, bars, line, split, meter, ico, pourquoi }) {
  return h('section', { class: `plaincard is-${tone}` },
    h('header', { class: 'plaincard-head' },
      ico ? h('span', { class: 'plaincard-ico', html: icon(ico) }) : null,
      h('div', {},
        h('div', { class: 'plaincard-kicker' }, kicker),
        h('h3', { class: 'plaincard-title' }, title),
      ),
    ),
    h('p', { class: 'plaincard-body' }, body),
    pourquoi ? h('p', { class: 'plaincard-why' }, h('b', {}, 'Pourquoi c’est important · '), pourquoi) : null,
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

/**
 * Glossaire financier.
 *
 * Chaque notion est expliquée en trois temps : ce que c'est, comment Fizzy la
 * calcule, et ce qu'on en fait. L'objectif est qu'un étudiant sans bagage
 * comptable comprenne, sans qu'un consultant ait l'impression qu'on lui ment
 * par simplification.
 */

export const GLOSSARY = {
  pointMort: {
    title: 'Point mort (seuil de rentabilité)',
    what: "Le chiffre d'affaires à partir duquel votre entreprise cesse de perdre de l'argent. En dessous, chaque mois creuse le trou ; au-dessus, chaque euro vendu vous enrichit.",
    formula: 'Point mort = Charges fixes ÷ Taux de marge sur coûts variables',
    how: "Fizzy additionne tout ce que vous payez quel que soit votre volume de ventes — salaires, loyer, assurances, amortissements, intérêts d'emprunt — puis divise ce total par la part de chaque euro vendu qui reste après avoir payé les coûts directement liés à la vente.",
    use: "C'est le premier chiffre que regarde un banquier. S'il est très supérieur à votre prévision de ventes, votre modèle ne tient pas : soit vous augmentez vos prix, soit vous réduisez vos coûts fixes, soit vous améliorez votre marge.",
    watch: "Certaines charges fixes de Fizzy sont calculées en pourcentage du chiffre d'affaires. Le point mort varie donc légèrement d'une année sur l'autre : retenez l'ordre de grandeur, pas la décimale.",
  },
  ebitda: {
    title: "EBITDA — Excédent brut d'exploitation",
    what: "Ce que votre activité génère réellement, avant de tenir compte de la façon dont vous l'avez financée, de vos investissements passés et de l'impôt. C'est la mesure la plus proche de « est-ce que mon métier gagne de l'argent ? ».",
    formula: "EBITDA = Valeur ajoutée + Subventions − Impôts et taxes − Charges de personnel",
    how: "Fizzy part du chiffre d'affaires, retire les achats directement liés aux ventes (marge brute), puis les charges externes (valeur ajoutée), puis les impôts de production et la masse salariale chargée.",
    use: "L'EBITDA sert à comparer deux entreprises indépendamment de leur structure financière. C'est aussi la base de la plupart des valorisations : une société se négocie souvent en multiple de son EBITDA.",
    watch: "EBITDA n'est pas trésorerie. Vous pouvez afficher un EBITDA positif et manquer d'argent en banque si vos clients paient à 60 jours. Regardez toujours les deux ensemble.",
  },
  ebit: {
    title: "Résultat d'exploitation (EBIT)",
    what: "L'EBITDA diminué des amortissements. Autrement dit : ce que gagne l'activité une fois pris en compte l'usure de ce que vous avez acheté.",
    formula: "EBIT = EBITDA − Dotations aux amortissements",
    how: "Chaque investissement est étalé sur sa durée d'amortissement. Un ordinateur à 1 800 € amorti sur 3 ans pèse 50 € par mois dans vos comptes, même si vous l'avez payé en une fois.",
    use: "L'EBIT montre si votre modèle supporte le renouvellement de son outil de production. Un EBITDA positif mais un EBIT négatif signale une activité trop gourmande en capital.",
  },
  margeBrute: {
    title: 'Marge brute',
    what: "Ce qu'il reste de chaque euro vendu une fois payé ce que la vente a directement coûté : matières premières, achats de marchandises, sous-traitance de production, hébergement.",
    formula: "Marge brute = Chiffre d'affaires − Achats et charges variables",
    how: "Pour chaque offre, Fizzy multiplie les volumes par le coût unitaire que vous avez renseigné, puis le retire du chiffre d'affaires.",
    use: "Le taux de marge brute détermine tout le reste. À 80 %, chaque nouveau client finance largement vos frais fixes. À 15 %, il vous faut un volume considérable pour couvrir un seul salaire.",
  },
  valeurAjoutee: {
    title: 'Valeur ajoutée',
    what: "La richesse que votre entreprise crée réellement : ce qui reste après avoir payé tout ce qu'elle a acheté à l'extérieur.",
    formula: 'Valeur ajoutée = Marge brute − Charges externes',
    how: "Fizzy retire de la marge brute les loyers, honoraires, assurances, abonnements logiciels, déplacements et loyers de crédit-bail.",
    use: "C'est la grandeur que se partagent les salariés, l'État, les prêteurs et les actionnaires. Elle sert aussi d'assiette à la CVAE.",
  },
  bfr: {
    title: 'BFR — Besoin en fonds de roulement',
    what: "L'argent immobilisé en permanence dans le cycle d'exploitation : ce que vos clients vous doivent, plus votre stock, moins ce que vous devez à vos fournisseurs.",
    formula: 'BFR = Créances clients + Stocks + Créance de TVA − Dettes fournisseurs',
    how: "Fizzy suit mois par mois l'écart entre le chiffre d'affaires facturé et encaissé, ainsi qu'entre les achats engagés et payés, en appliquant les délais que vous avez saisis.",
    use: "Le BFR est un besoin de financement permanent : il faut le couvrir par du capital ou du crédit. Une entreprise rentable peut déposer le bilan parce qu'elle n'a pas financé son BFR.",
    watch: "Négocier un acompte client ou un délai fournisseur plus long réduit le BFR sans changer d'un euro votre rentabilité. C'est souvent le levier le plus rapide.",
  },
  tresorerie: {
    title: 'Trésorerie',
    what: "L'argent effectivement disponible sur le compte, mois par mois. La seule grandeur dont on meurt.",
    formula: 'Solde de fin de mois = Solde initial + Encaissements − Décaissements',
    how: "Fizzy applique les délais de paiement à chaque flux : le chiffre d'affaires de janvier encaissé à 30 jours arrive en février. La TVA est collectée puis reversée le mois suivant.",
    use: "Le point le plus bas de la courbe indique le financement minimum à réunir avant de démarrer. C'est le chiffre à présenter à votre banque.",
  },
  runway: {
    title: 'Autonomie financière (runway)',
    what: "Le nombre de mois que vous pouvez tenir avec la trésorerie disponible, au rythme de consommation actuel.",
    formula: 'Autonomie = Trésorerie disponible ÷ Consommation mensuelle nette',
    how: "Fizzy calcule la consommation moyenne des douze premiers mois déficitaires et la rapporte à la trésorerie de départ.",
    use: "En dessous de six mois, vous êtes en zone rouge : une levée de fonds prend rarement moins de temps. Douze à dix-huit mois est la cible habituelle après un tour de table.",
  },
  cac: {
    title: "CAC — Coût d'acquisition client",
    what: "Ce que vous dépensez en marketing pour convaincre un client de plus.",
    formula: 'CAC = Budget marketing total ÷ Nombre de clients acquis',
    how: "Fizzy déroule votre entonnoir : budget divisé par le coût du clic, multiplié par le taux de transformation en contact, puis par le taux de transformation en client.",
    use: "Comparez toujours le CAC à ce que rapporte un client. Un CAC de 300 € est excellent si le client rapporte 3 000 €, catastrophique s'il en rapporte 200.",
  },
  ltv: {
    title: 'Valeur client (LTV)',
    what: "La marge totale qu'un client vous rapporte sur toute la durée de sa relation avec vous.",
    formula: 'LTV = Revenu moyen par client × Taux de marge brute',
    how: "Fizzy rapporte le chiffre d'affaires total au nombre d'unités vendues, puis applique le taux de marge brute moyen de l'horizon.",
    use: "Le rapport LTV/CAC est l'indicateur roi de l'acquisition. En dessous de 1, vous perdez de l'argent à chaque client. Un rapport de 3 est considéré comme sain.",
  },
  superBrut: {
    title: 'Coût employeur (super brut)',
    what: "Ce qu'un salarié coûte réellement à l'entreprise : son salaire brut augmenté des cotisations patronales.",
    formula: 'Coût employeur = Salaire brut + Cotisations patronales − Réduction générale',
    how: "Fizzy applique le taux de cotisations correspondant au statut, puis retranche la réduction générale, dégressive entre le SMIC et 3 SMIC. Un salaire au SMIC coûte à peine plus que son brut ; au-delà de 3 SMIC, comptez environ 45 % de charges.",
    use: "C'est le seul chiffre qui compte pour votre budget. Raisonner en brut conduit à sous-estimer la masse salariale de 25 à 45 %.",
    watch: "Les taux dépendent de votre convention collective et de votre taux d'accident du travail. Ceux de Fizzy sont des moyennes de marché, ajustables dans les réglages.",
  },
  tva: {
    title: 'TVA',
    what: "Un impôt que vous collectez pour l'État sur vos ventes, et que vous récupérez sur vos achats. Vous ne reversez que la différence.",
    formula: 'TVA à reverser = TVA collectée sur les ventes − TVA déductible sur les achats',
    how: "Fizzy applique le taux de chaque offre aux encaissements, déduit la TVA des achats, investissements et charges, et reverse le solde le mois suivant. Si la TVA déductible dépasse la collectée, un crédit de TVA est remboursé.",
    use: "La TVA n'affecte pas votre résultat — tous les montants du business plan sont hors taxes. Elle affecte en revanche votre trésorerie, à cause du décalage d'un mois.",
  },
  is: {
    title: 'Impôt sur les sociétés',
    what: "L'impôt sur le bénéfice de l'entreprise.",
    formula: '15 % jusqu\'à 42 500 € de bénéfice, puis 25 %',
    how: "Le taux réduit de 15 % s'applique aux PME réalisant moins de 10 M€ de chiffre d'affaires, dont le capital est entièrement libéré et détenu à 75 % au moins par des personnes physiques. Fizzy impute d'abord les déficits des exercices antérieurs, sans limite jusqu'à 1 M€ puis à hauteur de 50 % au-delà.",
    use: "Les pertes des premières années réduisent mécaniquement l'impôt des années bénéficiaires. C'est pourquoi une startup déficitaire deux ans paie peu d'impôt la troisième.",
  },
  cir: {
    title: "CIR — Crédit d'impôt recherche",
    what: "Un remboursement de 30 % de vos dépenses de recherche, versé même si vous ne payez pas d'impôt.",
    formula: 'CIR = 30 % × (Salaires R&D + 43 % de forfait + amortissements + sous-traitance agréée)',
    how: "Fizzy retient la part du temps que vous avez déclarée en recherche pour chaque salarié, y ajoute un forfait de frais de fonctionnement de 43 %, les amortissements du matériel de recherche majorés de 75 %, et la sous-traitance agréée plafonnée à trois fois les autres dépenses. Les subventions perçues viennent en déduction.",
    use: "Pour une équipe de trois ingénieurs à plein temps sur de la R&D, le CIR représente souvent plus de 60 000 € par an — l'équivalent d'un salaire.",
    watch: "La qualification de « recherche » au sens fiscal est stricte : elle suppose une incertitude scientifique, pas un simple développement logiciel. Faites valider votre éligibilité avant de compter sur ce montant.",
  },
  cii: {
    title: "CII — Crédit d'impôt innovation",
    what: "Un crédit de 20 % sur les dépenses de conception de prototypes ou d'installations pilotes de produits nouveaux.",
    formula: 'CII = 20 % des dépenses éligibles, plafonnées à 400 000 € par an',
    how: "Fizzy applique le taux à la part du temps déclarée en innovation, majorée du forfait de frais de fonctionnement, dans la limite du plafond.",
    use: "Le CII est moins exigeant que le CIR : il vise l'innovation produit plutôt que la recherche scientifique. Les deux sont cumulables sur des dépenses distinctes.",
    watch: "Le CII entre dans le plafond européen des aides de minimis, fixé à 300 000 € sur trois exercices glissants. Fizzy écrête automatiquement le dépassement.",
  },
  jei: {
    title: 'JEI — Jeune entreprise innovante',
    what: "Un statut qui exonère de cotisations patronales les salariés affectés à la recherche.",
    formula: "Éligible si les dépenses de R&D représentent au moins 15 % des charges, et si l'entreprise a moins de 8 ans",
    how: "Fizzy calcule chaque année le rapport entre vos charges de recherche et vos charges totales, puis applique l'exonération sur la part de salaire inférieure à 4,5 SMIC.",
    use: "Pour une équipe de recherche, l'économie atteint fréquemment plusieurs dizaines de milliers d'euros par an.",
    watch: "L'exonération d'impôt sur les sociétés attachée au statut JEI a été supprimée pour les entreprises créées depuis 2024. Seule subsiste l'exonération de cotisations. Le seuil de dépenses de R&D a par ailleurs été relevé pour les créations les plus récentes.",
  },
  capaciteAutofinancement: {
    title: "CAF — Capacité d'autofinancement",
    what: "L'argent que l'activité dégage réellement sur l'année, avant décisions d'investissement et de financement.",
    formula: 'CAF = Résultat net + Dotations aux amortissements',
    how: "Les amortissements sont une charge comptable qui ne sort pas de la caisse : on les réintègre au résultat.",
    use: "La CAF mesure votre capacité à rembourser vos emprunts et à financer votre croissance sans lever d'argent. Les banques la comparent aux annuités de remboursement.",
  },
  bilan: {
    title: 'Bilan',
    what: "Une photographie du patrimoine de l'entreprise à la clôture : ce qu'elle possède à gauche, ce qu'elle doit et ce qui appartient aux associés à droite.",
    formula: 'Total actif = Total passif',
    how: "Fizzy construit le bilan à partir des flux : immobilisations nettes d'amortissements, créances, stocks et trésorerie à l'actif ; capital, résultats accumulés, emprunts et dettes au passif.",
    use: "Le bilan révèle la solidité : des capitaux propres négatifs signalent une entreprise techniquement en faillite, même si son activité est rentable.",
  },
  planFinancement: {
    title: 'Plan de financement',
    what: "La confrontation, année par année, de vos besoins durables et des ressources qui les couvrent.",
    formula: 'Excédent = Ressources − Emplois',
    how: "Les emplois regroupent les investissements, la variation du besoin en fonds de roulement et les remboursements d'emprunt. Les ressources regroupent les apports, emprunts, subventions et la capacité d'autofinancement.",
    use: "C'est la pièce que réclame systématiquement un financeur : elle démontre que le projet est finançable, pas seulement rentable.",
  },
  marginRate: {
    title: 'Taux de marge sur coûts variables',
    what: "La part de chaque euro encaissé qui reste disponible pour couvrir vos frais fixes.",
    formula: "Taux de marge = Marge brute ÷ Chiffre d'affaires",
    how: "Fizzy le calcule offre par offre puis en moyenne pondérée.",
    use: "C'est le multiplicateur du point mort. Passer de 40 % à 50 % de marge réduit votre point mort d'un cinquième, sans vendre une unité de plus.",
  },
}

export function lookup(key) { return GLOSSARY[key] || null }

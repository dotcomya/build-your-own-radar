/**
 * À quoi sert chaque partie, et pourquoi elle compte.
 *
 * Un prévisionnel se remplit dans le désordre et se perd vite : on saisit des
 * charges sans savoir ce qu'elles décident, on renseigne un délai de paiement
 * sans voir qu'il commande la trésorerie. Chaque partie porte donc trois
 * phrases — ce qu'elle fait, ce qu'elle décide ailleurs, ce qu'on regarde en
 * premier — et rien de plus : un mode d'emploi qui dépasse l'écran n'est pas lu.
 *
 * Le registre est celui d'un associé qui t’explique, pas d'un manuel.
 */

export const PART_GUIDES = {
  'tableau-de-bord': {
    role: "La synthèse de tout ce que tu as saisi ailleurs. Rien ne s'écrit ici : chaque chiffre vient d'une autre page et peut s'y corriger.",
    why: "C'est l'écran que regarde un banquier, un investisseur ou un associé. Six nombres suffisent à décider si ton projet mérite un deuxième rendez-vous : le chiffre d'affaires, ce qu'il en reste, le point mort, et combien d'argent il manque avant d'y arriver.",
    first: "La trésorerie au plus bas et sa date. Une entreprise rentable qui tombe à sec en mars ne verra pas avril.",
  },
  projet: {
    role: "Le cadre : ton métier, ton client type, ta date de démarrage et ta forme juridique. Quatre réponses qui adaptent tout le reste.",
    why: "Le métier fixe le vocabulaire, la TVA et les repères de marge. La forme juridique décide de ton statut social, donc du coût de ta rémunération. Le type de client commande les délais de paiement, donc la trésorerie.",
    first: "La forme juridique. C'est elle qui décide si tu coûtes 20 % ou 45 % de plus que ton brut à ton entreprise.",
  },
  offre: {
    role: "Ce que tu vends, à quel prix, à quel rythme, et quand tu es payé. Une offre peut être une vente à l'unité, un abonnement, ou les deux.",
    why: "C'est la source de tous les autres chiffres : le chiffre d'affaires, la marge, la TVA collectée, et surtout le besoin en fonds de roulement — car entre la livraison et l'encaissement, c'est toi qui finances le client.",
    first: "La marge unitaire. En dessous de 20 %, il faudra un volume considérable pour couvrir les frais fixes ; en dessous de zéro, chaque vente aggrave la perte.",
  },
  acquisition: {
    role: "Ce que tu dépenses pour trouver des clients, et combien tu en gagnes en échange.",
    why: "Sans cette partie, tes volumes de vente reposent sur une courbe de croissance affirmée sans justification — ce qu'un investisseur repère immédiatement. Relier un budget à une acquisition transforme une intention en mécanique.",
    first: "Le rapport entre ce qu'un client rapporte sur sa durée de vie et ce qu'il coûte à acquérir. Au-dessus de trois, tu peux accélérer ; en dessous de un, dépenser plus creuse plus vite.",
  },
  equipe: {
    role: "Qui travaille dans l'entreprise, à quel salaire brut annuel, à partir de quand — et ce que l'entreprise accorde à tout le monde.",
    why: "C'est presque toujours le premier poste de dépense, et le plus difficile à défaire. Un salaire brut ne dit pas ce qu'il coûte : selon le contrat et le statut, l'entreprise débourse 20 à 45 % de plus, et la mutuelle collective est obligatoire dès le premier salarié.",
    first: "Le coût annuel complet de chaque poste, et le mois d'arrivée. Décaler une embauche de trois mois déplace souvent le besoin de financement plus qu'une hausse de prix.",
  },
  achats: {
    role: "Tout ce qui tombe chaque mois que tu vendes ou non : loyer, comptable, logiciels, assurances — et le matériel durable, dont le coût s'étale sur sa durée d'usage.",
    why: "Ce sont elles qui fixent ton point mort. Chaque euro de charge fixe en plus, c'est du chiffre d'affaires supplémentaire à aller chercher avant de gagner le premier euro.",
    first: "Le total mensuel, et les charges que tu n'as pas encore saisies. L'oubli le plus fréquent n'est pas le loyer : c'est le comptable, l'assurance et les frais bancaires.",
  },
  financement: {
    role: "D'où vient l'argent : tes apports, les emprunts, les subventions, une levée de fonds, un compte courant d'associé.",
    why: "Une entreprise ne meurt pas d'un mauvais résultat, elle meurt de trésorerie. Cette partie répond à la seule question qu'une banque pose : combien te manque-t-il, et à quelle date.",
    first: "Le point bas de la courbe de trésorerie. C'est le montant à réunir et l'échéance à tenir — prévois une marge, un plan tendu à l'euro près ne survit à aucun imprévu.",
  },
  resultats: {
    role: "Les états financiers normalisés : compte de résultat, trésorerie, bilan, fiscalité — et ce qui te reste personnellement, une fois tout payé.",
    why: "C'est le format que comprennent un expert-comptable, une banque et un investisseur. Rien n'est à saisir ici : tout est calculé à partir de tes pages de saisie, ce qui garantit qu'aucune ligne ne se contredit.",
    first: "Le passage de l'EBE au résultat net. C'est là qu'on voit ce que coûtent vraiment les amortissements, les intérêts et l'impôt.",
  },
  'business-case': {
    role: "Le dossier prêt à envoyer : ton projet, les chiffres qui le soutiennent, et l'export en PowerPoint ou en tableur.",
    why: "Un prévisionnel juste mais impossible à transmettre ne sert à rien. Cette partie met en forme ce que tu as construit dans l'ordre où un lecteur extérieur l'attend.",
    first: "La cohérence entre ce que tu racontes et ce que les chiffres montrent. Un écart entre les deux est ce qu'un investisseur remarque en premier.",
  },
  reglages: {
    role: "Les hypothèses de fond : identité du projet, date de démarrage, taux et plafonds fiscaux, et tes scénarios enregistrés.",
    why: "Les valeurs fiscales sont revalorisées chaque année. Celles que Fynomia retient sont annoncées et modifiables : ton plan reste juste même quand la loi de finances bouge.",
    first: "La date de démarrage, qui décale tout le calendrier, et les valeurs marquées « à vérifier ».",
  },
}

export const guideFor = (pageKey) => PART_GUIDES[pageKey] || null

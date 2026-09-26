/**
 * Où en est le projet — et ce que ça change.
 *
 * Deux fondateurs ouvrent Fynomia le même jour. Le premier a une idée depuis
 * hier soir ; le second a signé son bail, embauché deux personnes et cherche
 * 60 000 € auprès de sa banque. Leur poser les mêmes questions dans le même
 * ordre, c'est faire perdre son temps à l'un et rater le sujet de l'autre.
 *
 * Quatre stades, donc. Ce n'est pas une décoration de parcours : le stade
 * réordonne ce que le guide propose. Celui qui cherche un financement voit
 * remonter son apport, son emprunt et sa forme juridique ; celui qui a une
 * idée voit d'abord son prix et ses volumes, parce que sans eux il n'a pas de
 * modèle, seulement une envie.
 *
 * Le classement par palier — fondations, crédibilité, finition — reste. Le
 * stade ne fait que remonter quelques lignes au-dessus de la mêlée. Personne
 * n'est enfermé : le stade se change d'un clic, et on peut toujours remplir ce
 * qu'on veut dans l'ordre qu'on veut.
 */

/**
 * `lift` liste les clés de la liste « affiner » que ce stade fait passer
 * devant, dans cet ordre. Tout le reste garde son rang habituel.
 */
export const STAGES = [
  {
    key: 'idee',
    label: 'J’ai une idée, rien de plus',
    hint: 'Rien n’est écrit, rien n’est déposé',
    cap: 'Savoir si ça tient debout',
    says: "On va d'abord répondre à une seule question : est-ce que ce que tu vends couvre ce que ça coûte ? Le reste peut attendre.",
    lift: ['offre', 'prix', 'cout', 'volumes', 'charges'],
    goLabel: 'Tester mon idée',
    go: { route: 'tableau-de-bord' },
  },
  {
    key: 'structure',
    label: 'Je structure mon projet',
    hint: 'Étude de marché, business plan, fournisseurs',
    cap: 'Rendre le modèle défendable',
    says: "Ton modèle existe. Ce qui manque, c'est ce qu'un lecteur extérieur vérifiera : ton coût de revient, tes charges, ta rémunération.",
    lift: ['cout', 'salaire', 'charges', 'acquisition', 'pitch'],
    goLabel: 'Voir mon business plan',
    go: { route: 'tableau-de-bord' },
  },
  {
    key: 'demarches',
    label: 'Je fais les démarches',
    hint: 'Création de société, compte pro, recherche de financement',
    cap: 'Tenir devant un financeur',
    says: "Un banquier regarde trois choses avant tout le reste : ton apport, ce que tu demandes, et ce que tu te verses. Posons-les.",
    lift: ['apport', 'emprunt', 'forme', 'salaire', 'capex', 'cout'],
    goLabel: 'Préparer mon dossier',
    go: { route: 'financement', view: 'sources', anchor: 'sources' },
  },
  {
    key: 'lance',
    label: 'Mon activité est lancée',
    hint: 'Je vends déjà, je veux piloter',
    cap: 'Piloter ce qui tourne',
    says: "Tu n'as plus à imaginer tes chiffres, tu les connais. Ce qui compte maintenant, c'est ta trésorerie, ton seuil et ta prochaine embauche.",
    lift: ['charges', 'equipe', 'cout', 'salaire', 'churn'],
    goLabel: 'Piloter mon activité',
    go: { route: 'tableau-de-bord' },
  },
]

/** Le stade du scénario courant. Aucun choix fait : on ne présume rien. */
export function stageOf(scenario) {
  return STAGES.find((s) => s.key === scenario?.meta?.stage) || null
}

/**
 * Le rang d'une ligne de la liste « affiner » pour ce stade.
 *
 * Les lignes remontées par le stade prennent les rangs négatifs, dans l'ordre
 * où le stade les cite. Les autres gardent 0 et restent classées par palier.
 */
export function liftRank(stage, key) {
  if (!stage) return 0
  const at = stage.lift.indexOf(key)
  return at < 0 ? 0 : at - stage.lift.length
}

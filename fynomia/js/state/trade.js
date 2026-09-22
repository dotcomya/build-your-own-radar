/**
 * Ce qu'on oublie, métier par métier.
 *
 * Un glacier ne cherche pas « une charge externe de 380 € » : il cherche à se
 * rappeler qu'il paie des cornets, des bacs, un contrat de maintenance sur sa
 * turbine et une facture d'électricité qui ne s'arrête jamais, parce que les
 * vitrines tournent la nuit. Un coiffeur pense shampoing, fauteuils, bacs de
 * lavage et blouses. Un spa pense eau, sauna, linge et produits de soin.
 *
 * Ces listes-là ne calculent rien. Elles nomment. Leur seul travail est de
 * montrer au fondateur qu'on sait de quoi il parle, et de lui éviter d'oublier
 * la ligne qui fera la différence entre un prévisionnel et un dossier crédible.
 *
 * Trois natures, et une phrase :
 *
 *   OFFRES   ce qu'on vend en plus de l'évidence — le café après le repas, la
 *            revente de produits chez le coiffeur, l'abonnement au spa ;
 *   CHARGES  ce qui tombe tous les mois, y compris indexé sur les ventes —
 *            un cornet coûte par glace vendue, pas par mois ;
 *   ACHATS   le matériel durable, celui qui s'amortit et qu'on sous-estime ;
 *   VEILLE   la phrase qu'un professionnel du métier dirait en premier.
 *
 * Les montants sont des ordres de grandeur pour un établissement qui démarre.
 * Ils sont là pour être corrigés, pas pour être crus : chaque suggestion arrive
 * dans le modèle comme une ligne ordinaire, que le fondateur modifie ensuite.
 *
 * Changer de métier change toute cette page : c'est `meta.sectorKey` qui la
 * commande, rien d'autre.
 */

/** Charges : `monthly` = montant fixe, `perUnit` = par vente, `pct` = part du CA. */
export const TRADE = {
  // ───────────────────────────── Tech ──────────────────────────────────────
  logiciel: {
    offers: [
      { label: 'Forfait de mise en route', price: 900, cost: 120, note: "Payé une fois, encaissé tout de suite : c'est lui qui finance l'acquisition." },
      { label: 'Offre équipe (par utilisateur)', price: 19, recurring: true, cost: 2.4 },
      { label: 'Support prioritaire', price: 149, recurring: true, cost: 30 },
    ],
    opex: [
      { label: 'Hébergement et bases de données', monthly: 320, why: "Croît avec les clients, pas avec le temps." },
      { label: 'Commission de paiement', pct: 0.015, why: "1,5 % sur chaque encaissement par carte. Invisible jusqu'au jour où le volume monte." },
      { label: 'Outils de l’équipe (code, design, support)', monthly: 240 },
      { label: 'Surveillance et sauvegardes', monthly: 90 },
      { label: 'Assurance responsabilité civile professionnelle', monthly: 95 },
    ],
    capex: [
      { label: 'Postes de travail', amount: 6000, years: 3 },
      { label: 'Dépôt de marque', amount: 1200, years: 5 },
    ],
    watch: "Ton coût serveur suit tes clients : mets-le en charge indexée, pas en montant fixe, sinon ta marge paraît meilleure qu'elle ne sera.",
  },

  developpeur: {
    offers: [
      { label: 'Forfait de maintenance mensuelle', price: 450, recurring: true, cost: 0, note: "Le revenu qui tient quand les missions s'arrêtent." },
      { label: 'Audit technique', price: 2400, cost: 0 },
      { label: 'Astreinte', price: 300, recurring: true, cost: 0 },
    ],
    opex: [
      { label: 'Comptable', monthly: 150 },
      { label: 'Assurance responsabilité civile professionnelle', monthly: 60, why: "Exigée par presque tous les donneurs d'ordre." },
      { label: 'Coworking ou bureau', monthly: 250 },
      { label: 'Licences et abonnements techniques', monthly: 120 },
      { label: 'Mutuelle et prévoyance du dirigeant', monthly: 180 },
    ],
    capex: [
      { label: 'Ordinateur et écrans', amount: 4000, years: 3 },
      { label: 'Siège et bureau', amount: 1400, years: 5 },
    ],
    watch: "Compte tes jours facturables, pas tes jours ouvrés : prospection, administratif et formation en mangent facilement un cinquième.",
  },

  conseil: {
    offers: [
      { label: 'Abonnement de suivi mensuel', price: 1500, recurring: true, cost: 0 },
      { label: 'Atelier de cadrage', price: 3500, cost: 200 },
      { label: 'Formation intra-entreprise', price: 2800, cost: 150, note: "Finançable par l'OPCO du client si tu es certifié Qualiopi." },
    ],
    opex: [
      { label: 'Déplacements et hébergement', monthly: 600, why: "Le poste que tout le monde oublie et qui suit le nombre de missions." },
      { label: 'Assurance responsabilité civile professionnelle', monthly: 90 },
      { label: 'Comptable', monthly: 220 },
      { label: 'Outils et abonnements documentaires', monthly: 140 },
      { label: 'Prospection et représentation', monthly: 250 },
    ],
    capex: [
      { label: 'Matériel informatique', amount: 3500, years: 3 },
      { label: 'Certification Qualiopi', amount: 2500, years: 3, note: "Ouvre le financement OPCO de tes formations." },
    ],
    watch: "Au-delà de 70 % du chiffre d'affaires sur un seul client, la relation peut être requalifiée — et sa fin te laisse sans revenu.",
  },

  // ───────────────────── Professions réglementées ──────────────────────────
  avocat: {
    offers: [
      { label: 'Abonnement conseil aux entreprises', price: 800, recurring: true, cost: 0 },
      { label: 'Consultation ponctuelle', price: 250, cost: 0 },
      { label: 'Honoraires de résultat', price: 4000, cost: 0, note: "Encaissés tard : surveille le décalage de trésorerie." },
    ],
    opex: [
      { label: 'Cotisation ordinale et CNBF', monthly: 480, why: "Obligatoire, due même sans chiffre d'affaires." },
      { label: 'Assurance responsabilité civile professionnelle', monthly: 180 },
      { label: 'Documentation juridique', monthly: 220 },
      { label: 'Secrétariat et téléphonie', monthly: 350 },
      { label: 'Loyer du cabinet', monthly: 1100 },
    ],
    capex: [
      { label: 'Aménagement du cabinet', amount: 18000, years: 9 },
      { label: 'Logiciel de gestion de dossiers', amount: 3000, years: 3 },
    ],
    watch: "Tes honoraires s'encaissent des mois après le travail. Le besoin en fonds de roulement est ton vrai sujet, pas la marge.",
  },

  medecin: {
    offers: [
      { label: 'Consultation de suivi', price: 30, cost: 0 },
      { label: 'Acte technique', price: 65, cost: 8 },
      { label: 'Téléconsultation', price: 25, cost: 0 },
    ],
    opex: [
      { label: 'Redevance au cabinet de groupe', pct: 0.12, why: "Souvent un pourcentage des honoraires, pas un loyer fixe." },
      { label: 'Cotisation ordinale et CARMF', monthly: 620 },
      { label: 'Assurance responsabilité civile professionnelle', monthly: 110 },
      { label: 'Secrétariat et prise de rendez-vous', monthly: 400 },
      { label: 'Consommables et petit matériel', monthly: 180 },
    ],
    capex: [
      { label: 'Équipement médical', amount: 22000, years: 7 },
      { label: 'Aménagement du cabinet', amount: 15000, years: 9 },
    ],
    watch: "Tes actes sont exonérés de TVA : tu ne récupères donc pas celle de tes achats. Raisonne toujours en montants TTC.",
  },

  kine: {
    offers: [
      { label: 'Séance à domicile', price: 40, cost: 3, note: "Indemnité de déplacement incluse ; le temps de trajet, lui, ne se facture pas." },
      { label: 'Bilan initial', price: 55, cost: 0 },
      { label: 'Cours collectif', price: 18, cost: 2 },
    ],
    opex: [
      { label: 'Cotisation ordinale et CARPIMKO', monthly: 480 },
      { label: 'Loyer ou redevance du cabinet', monthly: 900 },
      { label: 'Linge, consommables et désinfection', monthly: 140 },
      { label: 'Assurance responsabilité civile professionnelle', monthly: 70 },
      { label: 'Logiciel de télétransmission', monthly: 60 },
    ],
    capex: [
      { label: 'Tables et matériel de rééducation', amount: 14000, years: 7 },
      { label: 'Aménagement et accessibilité', amount: 12000, years: 9 },
    ],
    watch: "Ton plafond, c'est le nombre de patients dans une journée. La croissance passe par le tarif, les cours collectifs ou un associé — pas par le volume.",
  },

  dentiste: {
    offers: [
      { label: 'Prothèse et couronne', price: 550, cost: 190, note: "La marge dépend surtout du prix du prothésiste." },
      { label: 'Détartrage et prévention', price: 35, cost: 4 },
      { label: 'Implant', price: 1400, cost: 480 },
    ],
    opex: [
      { label: 'Laboratoire de prothèse', pct: 0.18, why: "Indexé sur les actes prothétiques : c'est le premier poste variable du cabinet." },
      { label: 'Consommables et stérilisation', monthly: 900 },
      { label: 'Assistante dentaire', monthly: 2200 },
      { label: 'Maintenance des équipements', monthly: 320 },
      { label: 'Cotisation ordinale et CARCDSF', monthly: 700 },
    ],
    capex: [
      { label: 'Fauteuil et unit', amount: 45000, years: 7 },
      { label: 'Radiologie panoramique', amount: 35000, years: 7 },
      { label: 'Stérilisation et autoclave', amount: 12000, years: 7 },
    ],
    watch: "Les soins conventionnés sont à tarif fixé ; la rentabilité se joue sur la prothèse et l'implantologie, donc sur le coût de ton laboratoire.",
  },

  // ─────────────────────── Commerce et restauration ────────────────────────
  restaurant: {
    offers: [
      { label: 'Menu du midi', price: 17, cost: 5.2, note: "Le volume de la semaine. Marge plus courte, rotation plus rapide." },
      { label: 'Boissons et café', price: 4.5, cost: 1.1, note: "Le poste le plus rentable de la carte, et le plus oublié dans un prévisionnel." },
      { label: 'Vente à emporter', price: 13, cost: 4 },
      { label: 'Privatisation et groupes', price: 900, cost: 300 },
    ],
    opex: [
      { label: 'Énergie — froid, cuisson, extraction', monthly: 750, why: "Les chambres froides tournent la nuit, l'été, et les jours de fermeture." },
      { label: 'Commission des plateformes de livraison', pct: 0.28, why: "Jusqu'à 30 % du ticket. Une commande livrée n'a pas la marge d'une commande en salle." },
      { label: 'Blanchisserie et entretien', monthly: 320 },
      { label: 'SACEM, SPRE et redevance audiovisuelle', monthly: 55, why: "Dues dès que de la musique est diffusée en salle." },
      { label: 'Contrôle hygiène et analyses HACCP', monthly: 90 },
      { label: 'Terminal de paiement et caisse', monthly: 160 },
    ],
    capex: [
      { label: 'Cuisine professionnelle et piano', amount: 55000, years: 7 },
      { label: 'Chambre froide et laverie', amount: 14000, years: 7 },
      { label: 'Mobilier et agencement de salle', amount: 35000, years: 9 },
      { label: 'Hotte et extraction', amount: 12000, years: 9 },
      { label: 'Droit au bail', amount: 60000, years: 0, note: "Ne s'amortit pas : il reste au bilan tant que tu exploites." },
    ],
    watch: "Matière plus personnel chargé sous 65 % du chiffre d'affaires : au-delà, aucun volume ne rattrape.",
  },

  glacier: {
    offers: [
      { label: 'Cornet deux boules', price: 4.5, cost: 0.95, note: "Le produit d'appel. La marge est dans le volume et la saison." },
      { label: 'Pot à emporter 500 ml', price: 9.5, cost: 2.6, note: "TVA 5,5 % : consommation différée, pas immédiate." },
      { label: 'Coupe glacée servie en salle', price: 8.5, cost: 2.1 },
      { label: 'Bûche glacée et commandes de fête', price: 32, cost: 9 },
      { label: 'Boisson chaude ou fraîche', price: 3.2, cost: 0.6, note: "Ce qui sauve novembre." },
    ],
    opex: [
      { label: 'Cornets, pots, cuillères et sachets', perUnit: 0.18, why: "Ça ne coûte rien par mois : ça coûte par glace vendue. Zéro en janvier, beaucoup en juillet." },
      { label: 'Électricité — vitrines et conservateurs', monthly: 620, why: "Les bacs restent à −18 °C toute l'année, même fermé. C'est la charge qui ne dort jamais." },
      { label: 'Lait, crème et fruits frais', pct: 0.22, why: "Indexé sur les ventes. Le prix du lait et de la vanille fait bouger ta marge sans prévenir." },
      { label: 'Maintenance des groupes froids', monthly: 180, why: "Un compresseur qui lâche en août coûte une saison, pas une réparation." },
      { label: 'Analyses microbiologiques et HACCP', monthly: 75 },
      { label: 'Loyer et charges', monthly: 1600 },
    ],
    capex: [
      { label: 'Turbine à glace et pasteurisateur', amount: 24000, years: 7, note: "Le cœur du métier. Neuf, il tient dix ans ; d'occasion, surveille le compresseur." },
      { label: 'Vitrine réfrigérée à bacs', amount: 13000, years: 7 },
      { label: 'Conservateur négatif de réserve', amount: 4500, years: 7 },
      { label: 'Laboratoire — inox, plonge, surgélateur', amount: 18000, years: 9 },
      { label: 'Enseigne et devanture', amount: 8000, years: 9 },
    ],
    watch: "Ton année n'est pas linéaire : quatre mois font souvent 65 % du chiffre. Saisis tes volumes mois par mois, sinon ta trésorerie de février sera une fiction.",
  },

  ecommerce: {
    offers: [
      { label: 'Panier moyen', price: 58, cost: 23 },
      { label: 'Abonnement ou réassort automatique', price: 29, recurring: true, cost: 11, note: "Divise ton coût d'acquisition par le nombre de commandes qu'il rapporte." },
      { label: 'Frais de port facturés', price: 5.9, cost: 5.2 },
    ],
    opex: [
      { label: 'Emballage et colisage', perUnit: 1.4, why: "Carton, calage, étiquette : par commande expédiée, pas par mois." },
      { label: 'Transport et livraison', perUnit: 5.2, why: "Le poste qui décide si ton panier moyen est rentable." },
      { label: 'Commission de la place de marché', pct: 0.15 },
      { label: 'Commission de paiement', pct: 0.015 },
      { label: 'Abonnement boutique et applications', monthly: 180 },
      { label: 'Retours et litiges', pct: 0.04, why: "Entre 3 et 10 % des ventes selon le produit. Le prêt-à-porter est en haut de la fourchette." },
    ],
    capex: [
      { label: 'Stock de lancement', amount: 25000, years: 0, note: "Ce n'est pas un investissement mais de la trésorerie immobilisée : il part en besoin en fonds de roulement." },
      { label: 'Photographie produit', amount: 4000, years: 3 },
      { label: 'Poste de préparation de commandes', amount: 3000, years: 5 },
    ],
    watch: "Tu n'achètes pas des ventes, tu achètes des clients. Si le coût d'acquisition dépasse la marge de la première commande, seul le réachat te sauve.",
  },

  fleuriste: {
    offers: [
      { label: 'Bouquet du jour', price: 28, cost: 11 },
      { label: 'Composition deuil et cérémonie', price: 95, cost: 34, note: "Marge supérieure, commande ferme, peu de perte." },
      { label: 'Abonnement floral entreprise', price: 120, recurring: true, cost: 45, note: "Le revenu régulier qui lisse les creux entre les fêtes." },
      { label: 'Plantes et contenants', price: 22, cost: 9 },
    ],
    opex: [
      { label: 'Achats de fleurs fraîches', pct: 0.38, why: "Indexé sur les ventes, avec les cours du marché aux fleurs par-dessus." },
      { label: 'Pertes et invendus', pct: 0.06, why: "Entre 5 et 12 % selon la saison. Une fleur ne se solde pas." },
      { label: 'Chambre froide — électricité', monthly: 210 },
      { label: 'Emballage, papier et rubans', perUnit: 0.8 },
      { label: 'Loyer et charges', monthly: 1300 },
    ],
    capex: [
      { label: 'Chambre froide vitrée', amount: 9000, years: 7 },
      { label: 'Agencement et présentoirs', amount: 14000, years: 9 },
      { label: 'Véhicule de livraison', amount: 15000, years: 5 },
    ],
    watch: "Trois dates font ton année : Saint-Valentin, fête des mères, Toussaint. Un prévisionnel lissé sur douze mois ne dit rien de ta trésorerie.",
  },

  commerce: {
    offers: [
      { label: 'Panier moyen en boutique', price: 42, cost: 19 },
      { label: 'Carte de fidélité ou abonnement', price: 15, recurring: true, cost: 2 },
      { label: 'Click and collect', price: 45, cost: 20 },
    ],
    opex: [
      { label: 'Loyer et charges locatives', monthly: 1800, why: "Vise moins de 10 % du chiffre d'affaires, sinon l'emplacement te mange." },
      { label: 'Démarque inconnue', pct: 0.012, why: "Vol, casse, erreurs de caisse : 1 à 2 % du chiffre, et ça ne se voit qu'à l'inventaire." },
      { label: 'Terminal de paiement et commissions', pct: 0.008 },
      { label: 'Énergie et éclairage', monthly: 380 },
      { label: 'Assurance multirisque et vitrine', monthly: 160 },
    ],
    capex: [
      { label: 'Agencement et mobilier', amount: 28000, years: 9 },
      { label: 'Caisse et système d’encaissement', amount: 4000, years: 5 },
      { label: 'Enseigne et vitrine', amount: 9000, years: 9 },
      { label: 'Stock de lancement', amount: 30000, years: 0, note: "Trésorerie immobilisée, pas un amortissement." },
    ],
    watch: "Ta rotation de stock commande ta trésorerie. Trente jours de stock sur un commerce à faible marge, c'est un découvert permanent.",
  },

  // ─────────────────────── Services aux particuliers ───────────────────────
  coiffeur: {
    offers: [
      { label: 'Coupe et brushing', price: 38, cost: 2.5 },
      { label: 'Couleur ou mèches', price: 68, cost: 11, note: "Le ticket qui fait la journée, et le produit qui coûte le plus." },
      { label: 'Revente de produits capillaires', price: 24, cost: 12, note: "8 à 12 % du chiffre, sans temps de travail en plus. Souvent ce qui rend le salon rentable." },
      { label: 'Forfait entretien mensuel', price: 45, recurring: true, cost: 6 },
    ],
    opex: [
      { label: 'Shampoings, colorations et soins', perUnit: 3.2, why: "Par prestation réalisée, pas par mois : un salon vide ne consomme rien." },
      { label: 'Eau et chauffe-eau des bacs', monthly: 190, why: "Un bac de lavage consomme plus que tout le reste du salon." },
      { label: 'Blouses, serviettes et blanchisserie', monthly: 130 },
      { label: 'Loyer et charges', monthly: 1400 },
      { label: 'Logiciel de réservation en ligne', monthly: 90 },
      { label: 'Formation continue de l’équipe', monthly: 150, why: "Une technique de couleur qui date de cinq ans se voit." },
    ],
    capex: [
      { label: 'Fauteuils de coupe', amount: 4800, years: 7, note: "Quatre postes environ. Chaque fauteuil supplémentaire appelle un salaire." },
      { label: 'Bacs de lavage et robinetterie', amount: 7000, years: 7 },
      { label: 'Agencement, miroirs et éclairage', amount: 22000, years: 9 },
      { label: 'Sèche-cheveux, casques et petit matériel', amount: 3500, years: 5 },
      { label: 'Enseigne et devanture', amount: 7000, years: 9 },
    ],
    watch: "Un fauteuil de plus, c'est un salaire chargé fixe. Simule l'embauche avant de la faire : le seuil de remplissage se calcule, il ne se sent pas.",
  },

  spa: {
    offers: [
      { label: 'Modelage 60 minutes', price: 85, cost: 9, note: "Le temps de cabine est ta vraie contrainte, pas le prix." },
      { label: 'Accès spa à la journée', price: 45, cost: 6 },
      { label: 'Abonnement mensuel', price: 120, recurring: true, cost: 14, note: "Ce qui lisse les mois creux et finance le personnel." },
      { label: 'Soin du visage', price: 75, cost: 12 },
      { label: 'Revente de cosmétiques', price: 48, cost: 22 },
    ],
    opex: [
      { label: 'Eau — bassin, douches, hammam', monthly: 480, why: "Un bassin se vidange, se renouvelle et s'évapore. La facture d'eau d'un spa n'a rien à voir avec celle d'un institut." },
      { label: 'Électricité — sauna, hammam, pompes', monthly: 950, why: "Un sauna monte à 90 °C et un hammam tourne en continu aux heures d'ouverture. C'est le premier poste fixe du métier." },
      { label: 'Traitement de l’eau et analyses', monthly: 260, why: "Chlore, brome, pH, analyses obligatoires : un contrôle sanitaire raté ferme l'établissement." },
      { label: 'Huiles, cosmétiques et consommables', perUnit: 4.5, why: "Par soin réalisé. Un lundi creux ne coûte pas de produit." },
      { label: 'Linge — peignoirs, serviettes, blanchisserie', monthly: 420, why: "Trois serviettes par client, lavées tous les jours." },
      { label: 'Maintenance — filtration, pompes, chaudière', monthly: 320 },
      { label: 'Loyer et charges', monthly: 2600 },
    ],
    capex: [
      { label: 'Sauna et hammam', amount: 32000, years: 9 },
      { label: 'Bassin, filtration et traitement d’eau', amount: 48000, years: 9 },
      { label: 'Cabines de soin et tables', amount: 16000, years: 7 },
      { label: 'Ventilation et déshumidification', amount: 18000, years: 9, note: "L'humidité détruit un bâtiment plus vite qu'on ne le croit. Ce poste ne se coupe pas." },
      { label: 'Vestiaires et agencement', amount: 25000, years: 9 },
    ],
    watch: "Tes charges fixes tournent même à vide : le sauna chauffe pour un client comme pour vingt. Ton seuil de rentabilité est haut, ton abonnement est la réponse.",
  },

  hebergement: {
    offers: [
      { label: 'Petit déjeuner', price: 12, cost: 3.5, note: "Trois prestations para-hôtelières font basculer ton meublé dans le champ de la TVA — et ouvrent la récupération sur tes achats." },
      { label: 'Ménage de fin de séjour', price: 45, cost: 25 },
      { label: 'Nuitée haute saison', price: 145, cost: 16, note: "Le même lit, vendu deux fois plus cher deux mois par an." },
      { label: 'Location de vélos ou d’équipement', price: 18, cost: 2 },
    ],
    opex: [
      { label: 'Commission des plateformes', pct: 0.16, why: "Airbnb, Booking : 15 à 20 % du prix payé par le voyageur. Et la TVA se calcule sur ce prix-là, pas sur ce qui te reste." },
      { label: 'Ménage et blanchisserie', perUnit: 22, why: "Par nuitée vendue, pas par mois : un mois vide ne coûte pas de linge." },
      { label: 'Énergie et eau', monthly: 320 },
      { label: 'Taxe de séjour reversée', pct: 0.03, why: "Collectée sur le voyageur et reversée à la commune : elle transite, elle ne t’appartient pas." },
      { label: 'Assurance et charges de copropriété', monthly: 480 },
      { label: 'Consommables d’accueil', perUnit: 3.5 },
    ],
    capex: [
      { label: 'Ameublement et décoration', amount: 28000, years: 7 },
      { label: 'Literie et linge de maison', amount: 9000, years: 5 },
      { label: 'Serrure connectée et accueil autonome', amount: 2500, years: 5 },
      { label: 'Travaux de mise aux normes', amount: 22000, years: 9 },
    ],
    watch: "Six chambres ne font pas six fois 365 nuitées. À 55 % de remplissage — déjà correct — tu vends la moitié de ce qu’un calcul naïf annonce. Saisis tes volumes mois par mois.",
  },

  boulangerie: {
    offers: [
      { label: 'Sandwichs et snacking du midi', price: 6.5, cost: 1.9, note: "La marge la plus élevée du magasin, sur le créneau où tout le monde passe." },
      { label: 'Pâtisserie', price: 9.5, cost: 3.1 },
      { label: 'Boissons et café', price: 2.2, cost: 0.4 },
      { label: 'Commandes de fête et pièces montées', price: 85, cost: 28 },
    ],
    opex: [
      { label: 'Farine, beurre et matières premières', pct: 0.28, why: "Indexé sur les ventes. Le cours du beurre et du blé fait bouger ta marge sans prévenir." },
      { label: 'Énergie — four et froid', monthly: 1250, why: "Le four tourne la nuit. C’est le premier poste fixe du métier, très loin devant le loyer." },
      { label: 'Invendus et pertes', pct: 0.05, why: "Trois à huit pour cent de la production part chaque soir. Ce n’est pas exceptionnel, c’est structurel." },
      { label: 'Emballages et sacs', perUnit: 0.09 },
      { label: 'Entretien du fournil et maintenance', monthly: 220 },
      { label: 'Analyses et contrôles sanitaires', monthly: 80 },
    ],
    capex: [
      { label: 'Four à pain', amount: 45000, years: 9, note: "L’investissement qui commande tout le reste. Son débit fixe ton chiffre d’affaires maximal." },
      { label: 'Pétrin et chambre de pousse', amount: 17000, years: 9 },
      { label: 'Vitrines réfrigérées et agencement', amount: 38000, years: 9 },
      { label: 'Laboratoire — inox et plonge', amount: 14000, years: 9 },
      { label: 'Droit au bail', amount: 80000, years: 0, note: "Ne s’amortit pas : il reste au bilan tant que tu exploites." },
    ],
    watch: "Ta production commence à quatre heures du matin : la masse salariale porte des majorations de nuit qu’un calcul au taux horaire de base ignore complètement.",
  },

  batiment: {
    offers: [
      { label: 'Dépannage et petites interventions', price: 180, cost: 45, note: "Payé tout de suite, sans devis : ce qui fait vivre la trésorerie entre deux chantiers." },
      { label: 'Contrat d’entretien annuel', price: 220, recurring: true, cost: 60 },
      { label: 'Chantier de rénovation', price: 12000, cost: 5600 },
    ],
    opex: [
      { label: 'Assurance décennale et RC pro', monthly: 320, why: "Obligatoire avant le premier chantier, due même sans chiffre d’affaires. C’est la ligne que les prévisionnels d’artisan oublient le plus." },
      { label: 'Véhicule — carburant, entretien, assurance', monthly: 480 },
      { label: 'Matériaux et fournitures', pct: 0.42, why: "Indexé sur les chantiers : c’est ton vrai coût de production, pas une charge fixe." },
      { label: 'Outillage et consommables', monthly: 260 },
      { label: 'Location de matériel et bennes', monthly: 340 },
      { label: 'Logiciel de devis et facturation', monthly: 60 },
    ],
    capex: [
      { label: 'Véhicule utilitaire', amount: 24000, years: 5 },
      { label: 'Outillage professionnel', amount: 12000, years: 5 },
      { label: 'Échafaudage et matériel de levage', amount: 8000, years: 7 },
      { label: 'Dépôt et rangement', amount: 6000, years: 9 },
    ],
    watch: "Tu achètes les matériaux au début et tu encaisses le solde à la réception. Entre les deux, c’est ta trésorerie qui finance le chantier : exige un acompte de 30 %.",
  },

  services: {
    offers: [
      { label: 'Forfait mensuel d’heures', price: 320, recurring: true, cost: 0, note: "Le revenu régulier qui remplit le planning et lisse la trésorerie." },
      { label: 'Intervention ponctuelle', price: 32, cost: 0 },
      { label: 'Majoration dimanche et jours fériés', price: 42, cost: 0 },
    ],
    opex: [
      { label: 'Déplacements des intervenants', perUnit: 2.4, why: "Par heure facturée. Entre deux interventions, l’intervenant est payé et rien n’est facturé." },
      { label: 'Assurance responsabilité civile professionnelle', monthly: 90 },
      { label: 'Logiciel de planning et télégestion', monthly: 120, why: "Obligatoire de fait pour justifier les heures auprès des financeurs publics." },
      { label: 'Produits et petit matériel', perUnit: 0.8 },
      { label: 'Recrutement et formation', monthly: 280, why: "Le turnover du secteur dépasse souvent 30 % par an : c’est une charge permanente, pas un coût de lancement." },
      { label: 'Bureau et administratif', monthly: 400 },
    ],
    capex: [
      { label: 'Véhicules de service', amount: 18000, years: 5 },
      { label: 'Matériel d’intervention', amount: 6000, years: 5 },
    ],
    watch: "Ton client paie 28 € de l’heure et en récupère la moitié en crédit d’impôt. C’est ton argument commercial, pas ton revenu : toi, tu encaisses bien 28 €.",
  },

  coach: {
    offers: [
      { label: 'Abonnement mensuel', price: 39, recurring: true, cost: 3 },
      { label: 'Cours collectif à l’unité', price: 15, cost: 2 },
      { label: 'Coaching individuel', price: 65, cost: 0 },
      { label: 'Carnet de dix séances', price: 130, cost: 15, note: "Encaissé d'avance : c'est de la trésorerie, et une dette de prestation." },
    ],
    opex: [
      { label: 'Loyer de la salle', monthly: 2200 },
      { label: 'Électricité, chauffage et ventilation', monthly: 450 },
      { label: 'Commission de prélèvement des abonnements', pct: 0.012 },
      { label: 'Musique — SACEM et SPRE', monthly: 70 },
      { label: 'Entretien et maintenance des machines', monthly: 280 },
      { label: 'Assurance et diplôme d’encadrement', monthly: 130 },
    ],
    capex: [
      { label: 'Matériel de musculation et cardio', amount: 45000, years: 7 },
      { label: 'Sol amortissant et miroirs', amount: 12000, years: 9 },
      { label: 'Vestiaires et douches', amount: 18000, years: 9 },
    ],
    watch: "Vendre un abonnement est facile ; le faire renouveler l'est moins. Une attrition de 5 % par mois vide ta salle en un an et demi.",
  },

  formation: {
    offers: [
      { label: 'Session inter-entreprises', price: 890, cost: 90, note: "Par participant. Le coût est presque fixe : le dixième inscrit est presque tout en marge." },
      { label: 'Formation intra sur mesure', price: 4500, cost: 400 },
      { label: 'Accès à la plateforme en ligne', price: 29, recurring: true, cost: 3 },
    ],
    opex: [
      { label: 'Location de salles', monthly: 600 },
      { label: 'Supports, impression et matériel pédagogique', perUnit: 12 },
      { label: 'Formateurs vacataires', pct: 0.25, why: "Indexé sur les sessions vendues : c'est ton vrai coût de production." },
      { label: 'Maintien de la certification Qualiopi', monthly: 180, why: "Sans elle, plus aucun financement OPCO ni CPF." },
      { label: 'Plateforme et outils pédagogiques', monthly: 150 },
    ],
    capex: [
      { label: 'Certification Qualiopi initiale', amount: 2500, years: 3 },
      { label: 'Production des contenus', amount: 15000, years: 3 },
      { label: 'Matériel de captation vidéo', amount: 5000, years: 3 },
    ],
    watch: "Les financeurs paient à 60 ou 90 jours après la fin de session. Tu avances la trésorerie de chaque formation.",
  },

  association: {
    offers: [
      { label: 'Adhésion annuelle', price: 25, cost: 0 },
      { label: 'Prestation de service facturée', price: 1200, cost: 200, note: "Attention : une activité lucrative significative peut faire basculer l'association dans le champ fiscal." },
      { label: 'Billetterie d’événement', price: 12, cost: 4 },
    ],
    opex: [
      { label: 'Loyer ou mise à disposition de locaux', monthly: 450 },
      { label: 'Assurance de l’association et des bénévoles', monthly: 90 },
      { label: 'Frais de mission des bénévoles', monthly: 180 },
      { label: 'Comptable et commissaire aux comptes', monthly: 220, why: "Un commissaire devient obligatoire au-delà de 153 000 € de subventions publiques." },
      { label: 'Communication et impression', monthly: 150 },
    ],
    capex: [
      { label: 'Matériel d’activité', amount: 8000, years: 5 },
      { label: 'Aménagement du local', amount: 12000, years: 9 },
    ],
    watch: "Tes subventions arrivent en décalé et ne sont jamais acquises deux ans de suite. Regarde ta trésorerie au mois, pas à l'année.",
  },
}

/** Ce que le métier courant suggère — rien du tout si le métier est inconnu. */
export function tradeFor(scenario) {
  return TRADE[scenario?.meta?.sectorKey] || null
}

/**
 * Le libellé d'une charge suggérée, dans l'unité du métier.
 *
 * « 0,18 € par cornet » se lit ; « perUnit: 0.18 » ne se lit pas.
 */
export function chargeShape(item, vocab) {
  if (item.perUnit !== undefined) {
    return { mode: 'perUnit', value: item.perUnit, say: `${money(item.perUnit)} par ${vocab?.one || 'unité'}` }
  }
  if (item.pct !== undefined) {
    return { mode: 'pctRevenue', value: item.pct, say: `${String(Math.round(item.pct * 1000) / 10).replace('.', ',')} % du chiffre d’affaires` }
  }
  return { mode: 'fixed', value: item.monthly || 0, say: `${money(item.monthly || 0)} par mois` }
}

const money = (v) => {
  const r = Math.round(v * 100) / 100
  // 4,5 € se lit « quatre euros cinquante » : les centimes s'écrivent à deux
  // chiffres, sinon un prix a l'air d'une approximation.
  const [ent, dec] = r.toFixed(Number.isInteger(r) ? 0 : 2).split('.')
  const groupe = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')
  return `${dec ? `${groupe},${dec}` : groupe} \u20ac`
}

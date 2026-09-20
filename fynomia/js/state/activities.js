/**
 * Ce que le fondateur répond quand on lui demande ce qu'il fait.
 *
 * Il ne dit pas « commerce de détail non alimentaire en magasin spécialisé ».
 * Il dit « pizzeria », « Airbnb », « salon de coiffure », « plombier ». Lui
 * présenter une liste de modèles économiques, c'est lui demander de faire
 * lui-même la traduction — et de deviner lequel lui ressemble.
 *
 * Deux niveaux, donc, comme on cherche vraiment : une famille large d'abord —
 * restauration, hébergement, bâtiment — puis le métier précis. Et par-dessus,
 * un champ de recherche qui court-circuite les deux pour qui sait déjà : taper
 * « piz » doit donner Pizzeria sans passer par Restauration.
 *
 * Derrière, chaque activité pointe vers un des modèles économiques de
 * `sectors.js`. Une pizzeria, une crêperie et un food truck partagent le même
 * moteur — couverts, ticket moyen, coût matière, prime cost — mais l'écran dit
 * « pizzeria », parce que c'est le mot du fondateur. Là où le métier change
 * vraiment le modèle, il a son propre secteur : un glacier n'est pas un
 * restaurant, un spa n'est pas un salon de coiffure.
 *
 * `unit` et `tagline` se surchargent quand le mot du métier diffère de celui du
 * modèle : un hôtel vend des nuitées, une auto-école vend des heures de
 * conduite, et aucun des deux ne vend des « couverts ».
 */

/** Les familles, dans l'ordre où on les montre. */
export const FAMILIES = [
  { key: 'restauration', label: 'Restauration', glyph: '☗' },
  { key: 'hebergement', label: 'Hébergement / Hôtellerie', glyph: '⌂' },
  { key: 'alimentaire', label: 'Commerce alimentaire', glyph: '▤' },
  { key: 'commerce', label: 'Commerce non-alimentaire', glyph: '▥' },
  { key: 'beaute', label: 'Beauté / Bien-être', glyph: '✿' },
  { key: 'sante', label: 'Santé', glyph: '✚' },
  { key: 'batiment', label: 'Bâtiment / Travaux / Artisanat', glyph: '◧' },
  { key: 'digital', label: 'Digital / Agence / Vente en ligne', glyph: '⌘' },
  { key: 'entreprises', label: 'Services aux entreprises', glyph: '▫' },
  { key: 'personne', label: 'À la personne / Famille', glyph: '◌' },
  { key: 'sport', label: 'Sport / Loisirs', glyph: '◎' },
  { key: 'savoir', label: 'Formation / Association', glyph: '✎' },
]

/**
 * Les activités. `in` liste les familles où elle apparaît — un traiteur se
 * cherche en restauration comme en commerce alimentaire, et le faire figurer
 * aux deux endroits coûte une ligne, pas une réflexion au fondateur.
 *
 * `say` ajoute les mots qu'on taperait sans les voir écrits : « airbnb » pour
 * une location saisonnière, « resto » pour un restaurant, « SaaS » pour un
 * logiciel en abonnement.
 */
export const ACTIVITIES = [
  // ── Restauration ─────────────────────────────────────────────────────────
  { key: 'restaurant', label: 'Restaurant', in: ['restauration'], sector: 'restaurant', say: 'resto' },
  { key: 'gastronomique', label: 'Restaurant gastronomique', in: ['restauration'], sector: 'restaurant' },
  { key: 'bistrot', label: 'Bistrot', in: ['restauration'], sector: 'restaurant' },
  { key: 'pizzeria', label: 'Pizzeria', in: ['restauration'], sector: 'restaurant', say: 'pizza' },
  { key: 'creperie', label: 'Crêperie', in: ['restauration'], sector: 'restaurant', say: 'crepe galette' },
  { key: 'fastfood', label: 'Fast food', in: ['restauration'], sector: 'restaurant', say: 'burger snack' },
  { key: 'rapide', label: 'Restauration rapide', in: ['restauration'], sector: 'restaurant', say: 'snack' },
  { key: 'foodtruck', label: 'Food truck', in: ['restauration'], sector: 'restaurant', say: 'camion' },
  { key: 'traiteur', label: 'Traiteur', in: ['restauration', 'alimentaire'], sector: 'restaurant',
    unit: { one: 'prestation', many: 'prestations', verb: 'servies', client: 'client' } },
  { key: 'bar', label: 'Bar / Brasserie', in: ['restauration'], sector: 'restaurant', say: 'pub biere' },
  { key: 'barvin', label: 'Bar à vin / à cocktails', in: ['restauration'], sector: 'restaurant', say: 'bar a vin cave' },
  { key: 'salondethe', label: 'Salon de thé / Coffee shop', in: ['restauration'], sector: 'restaurant', say: 'cafe brunch' },
  { key: 'darkkitchen', label: 'Dark kitchen / Livraison', in: ['restauration'], sector: 'restaurant', say: 'uber deliveroo' },
  { key: 'asiatique', label: 'Sushi / Cuisine du monde', in: ['restauration'], sector: 'restaurant' },
  { key: 'cantine', label: 'Cantine d’entreprise', in: ['restauration'], sector: 'restaurant', say: 'collective' },

  // ── Hébergement ──────────────────────────────────────────────────────────
  { key: 'chambredhote', label: 'Chambre d’hôtes', in: ['hebergement'], sector: 'hebergement', say: 'bnb' },
  { key: 'gite', label: 'Gîte', in: ['hebergement'], sector: 'hebergement' },
  { key: 'saisonniere', label: 'Location saisonnière', in: ['hebergement'], sector: 'hebergement', say: 'meuble tourisme' },
  { key: 'airbnb', label: 'Location Airbnb', in: ['hebergement'], sector: 'hebergement', say: 'airbnb courte duree' },
  { key: 'conciergerie', label: 'Conciergerie', in: ['hebergement'], sector: 'hebergement',
    unit: { one: 'logement géré', many: 'logements gérés', verb: 'sous mandat', client: 'propriétaire' } },
  { key: 'camping', label: 'Camping', in: ['hebergement'], sector: 'hebergement',
    unit: { one: 'emplacement', many: 'emplacements', verb: 'loués', client: 'vacancier' } },
  { key: 'hotel', label: 'Hôtel', in: ['hebergement'], sector: 'hebergement' },
  { key: 'hotelluxe', label: 'Hôtel de luxe', in: ['hebergement'], sector: 'hebergement' },
  { key: 'insolite', label: 'Hébergement insolite', in: ['hebergement'], sector: 'hebergement', say: 'cabane bulle yourte' },
  { key: 'auberge', label: 'Auberge de jeunesse', in: ['hebergement'], sector: 'hebergement', say: 'hostel' },

  // ── Commerce alimentaire ─────────────────────────────────────────────────
  { key: 'boulangerie', label: 'Boulangerie', in: ['alimentaire'], sector: 'boulangerie', say: 'pain' },
  { key: 'patisserie', label: 'Pâtisserie', in: ['alimentaire'], sector: 'boulangerie', say: 'gateau' },
  { key: 'chocolaterie', label: 'Chocolaterie / Confiserie', in: ['alimentaire'], sector: 'boulangerie' },
  { key: 'boucherie', label: 'Boucherie / Charcuterie', in: ['alimentaire'], sector: 'boulangerie', say: 'viande' },
  { key: 'glacier', label: 'Glacier', in: ['alimentaire', 'restauration'], sector: 'glacier', say: 'glace creme glacee' },
  { key: 'poissonnerie', label: 'Poissonnerie', in: ['alimentaire'], sector: 'commerce' },
  { key: 'fromagerie', label: 'Fromagerie / Crémerie', in: ['alimentaire'], sector: 'commerce' },
  { key: 'epicerie', label: 'Épicerie fine', in: ['alimentaire'], sector: 'commerce' },
  { key: 'caviste', label: 'Caviste', in: ['alimentaire'], sector: 'commerce', say: 'vin cave' },
  { key: 'primeur', label: 'Primeur', in: ['alimentaire'], sector: 'commerce', say: 'fruits legumes' },
  { key: 'superette', label: 'Supérette / Épicerie', in: ['alimentaire'], sector: 'commerce' },
  { key: 'torrefacteur', label: 'Torréfacteur', in: ['alimentaire'], sector: 'commerce', say: 'cafe' },
  { key: 'brasserieart', label: 'Brasserie artisanale', in: ['alimentaire'], sector: 'boulangerie', say: 'biere' },

  // ── Commerce non-alimentaire ─────────────────────────────────────────────
  { key: 'vetements', label: 'Boutique de vêtements', in: ['commerce'], sector: 'commerce', say: 'pret a porter mode' },
  { key: 'chaussures', label: 'Chaussures / Maroquinerie', in: ['commerce'], sector: 'commerce' },
  { key: 'bijouterie', label: 'Bijouterie', in: ['commerce'], sector: 'commerce' },
  { key: 'librairie', label: 'Librairie', in: ['commerce'], sector: 'commerce', say: 'livre' },
  { key: 'papeterie', label: 'Papeterie / Presse', in: ['commerce'], sector: 'commerce', say: 'tabac' },
  { key: 'sportshop', label: 'Magasin de sport', in: ['commerce'], sector: 'commerce' },
  { key: 'deco', label: 'Décoration / Maison', in: ['commerce'], sector: 'commerce', say: 'meuble ameublement' },
  { key: 'animalerie', label: 'Animalerie', in: ['commerce'], sector: 'commerce' },
  { key: 'conceptstore', label: 'Concept store', in: ['commerce'], sector: 'commerce' },
  { key: 'fleuriste', label: 'Fleuriste', in: ['commerce'], sector: 'fleuriste', say: 'fleur bouquet' },
  { key: 'jouets', label: 'Magasin de jouets', in: ['commerce'], sector: 'commerce' },
  { key: 'secondemain', label: 'Seconde main / Brocante', in: ['commerce'], sector: 'commerce', say: 'friperie occasion' },
  { key: 'opticien', label: 'Opticien', in: ['commerce', 'sante'], sector: 'commerce', say: 'lunettes' },

  // ── Beauté / Bien-être ───────────────────────────────────────────────────
  { key: 'coiffeur', label: 'Salon de coiffure', in: ['beaute'], sector: 'coiffeur', say: 'coiffure' },
  { key: 'barbier', label: 'Barbier', in: ['beaute'], sector: 'coiffeur', say: 'barbe' },
  { key: 'institut', label: 'Institut de beauté', in: ['beaute'], sector: 'spa', say: 'esthetique' },
  { key: 'spa', label: 'Spa / Centre de bien-être', in: ['beaute'], sector: 'spa', say: 'sauna hammam' },
  { key: 'onglerie', label: 'Onglerie', in: ['beaute'], sector: 'coiffeur', say: 'ongles manucure' },
  { key: 'tatouage', label: 'Salon de tatouage', in: ['beaute'], sector: 'coiffeur', say: 'tattoo piercing' },
  { key: 'massage', label: 'Massage bien-être', in: ['beaute'], sector: 'spa' },
  { key: 'epilation', label: 'Centre d’épilation', in: ['beaute'], sector: 'spa', say: 'laser' },

  // ── Santé ────────────────────────────────────────────────────────────────
  { key: 'generaliste', label: 'Médecin généraliste', in: ['sante'], sector: 'medecin' },
  { key: 'specialiste', label: 'Médecin spécialiste', in: ['sante'], sector: 'medecin' },
  { key: 'dentiste', label: 'Dentiste', in: ['sante'], sector: 'dentiste', say: 'chirurgien dentaire' },
  { key: 'orthodontiste', label: 'Orthodontiste', in: ['sante'], sector: 'dentiste' },
  { key: 'kine', label: 'Kinésithérapeute', in: ['sante'], sector: 'kine', say: 'kine' },
  { key: 'osteo', label: 'Ostéopathe', in: ['sante'], sector: 'kine' },
  { key: 'infirmier', label: 'Infirmier libéral', in: ['sante'], sector: 'kine', say: 'idel' },
  { key: 'sagefemme', label: 'Sage-femme', in: ['sante'], sector: 'kine' },
  { key: 'psy', label: 'Psychologue', in: ['sante'], sector: 'kine', say: 'psychotherapeute' },
  { key: 'dietetique', label: 'Diététicien / Nutritionniste', in: ['sante'], sector: 'kine' },
  { key: 'orthophoniste', label: 'Orthophoniste', in: ['sante'], sector: 'kine' },
  { key: 'podologue', label: 'Pédicure-podologue', in: ['sante'], sector: 'kine' },
  { key: 'laboratoire', label: 'Laboratoire d’analyses', in: ['sante'], sector: 'medecin', say: 'analyses medicales' },
  { key: 'veterinaire', label: 'Vétérinaire', in: ['sante'], sector: 'medecin', say: 'animaux' },

  // ── Bâtiment / Artisanat ─────────────────────────────────────────────────
  { key: 'plombier', label: 'Plombier', in: ['batiment'], sector: 'batiment', say: 'plomberie sanitaire' },
  { key: 'electricien', label: 'Électricien', in: ['batiment'], sector: 'batiment', say: 'electricite' },
  { key: 'macon', label: 'Maçon', in: ['batiment'], sector: 'batiment', say: 'maconnerie gros oeuvre' },
  { key: 'peintre', label: 'Peintre en bâtiment', in: ['batiment'], sector: 'batiment', say: 'peinture' },
  { key: 'menuisier', label: 'Menuisier', in: ['batiment'], sector: 'batiment', say: 'menuiserie bois' },
  { key: 'carreleur', label: 'Carreleur', in: ['batiment'], sector: 'batiment', say: 'carrelage' },
  { key: 'couvreur', label: 'Couvreur', in: ['batiment'], sector: 'batiment', say: 'toiture charpente' },
  { key: 'chauffagiste', label: 'Chauffagiste', in: ['batiment'], sector: 'batiment', say: 'pompe a chaleur clim' },
  { key: 'plaquiste', label: 'Plaquiste', in: ['batiment'], sector: 'batiment', say: 'placo cloison' },
  { key: 'serrurier', label: 'Serrurier / Métallier', in: ['batiment'], sector: 'batiment' },
  { key: 'paysagiste', label: 'Paysagiste', in: ['batiment'], sector: 'batiment', say: 'jardin espaces verts' },
  { key: 'renovation', label: 'Rénovation générale', in: ['batiment'], sector: 'batiment', say: 'tous corps d etat' },
  { key: 'isolation', label: 'Isolation / Rénovation énergétique', in: ['batiment'], sector: 'batiment', say: 'rge' },
  { key: 'ebeniste', label: 'Ébéniste / Agenceur', in: ['batiment'], sector: 'batiment' },
  { key: 'terrassement', label: 'Terrassement / TP', in: ['batiment'], sector: 'batiment' },

  // ── Digital / Agence / Vente en ligne ────────────────────────────────────
  { key: 'logiciel', label: 'Logiciel en abonnement', in: ['digital'], sector: 'logiciel', say: 'saas' },
  { key: 'application', label: 'Application mobile', in: ['digital'], sector: 'logiciel', say: 'app' },
  { key: 'developpeur', label: 'Développeur indépendant', in: ['digital'], sector: 'developpeur', say: 'freelance dev' },
  { key: 'agenceweb', label: 'Agence web', in: ['digital'], sector: 'conseil', say: 'site internet' },
  { key: 'agencecom', label: 'Agence de communication', in: ['digital'], sector: 'conseil' },
  { key: 'agencemarketing', label: 'Agence marketing', in: ['digital'], sector: 'conseil', say: 'growth seo ads' },
  { key: 'ecommerce', label: 'E-commerce', in: ['digital', 'commerce'], sector: 'ecommerce', say: 'boutique en ligne' },
  { key: 'marketplace', label: 'Marketplace', in: ['digital'], sector: 'ecommerce', say: 'place de marche' },
  { key: 'graphiste', label: 'Graphiste / Designer', in: ['digital'], sector: 'developpeur', say: 'ux ui design' },
  { key: 'communitymanager', label: 'Community manager', in: ['digital'], sector: 'developpeur', say: 'reseaux sociaux' },
  { key: 'photographe', label: 'Photographe', in: ['digital', 'sport'], sector: 'developpeur', say: 'photo' },
  { key: 'videaste', label: 'Vidéaste / Montage vidéo', in: ['digital'], sector: 'developpeur' },
  { key: 'drone', label: 'Pilote de drone', in: ['digital'], sector: 'developpeur' },

  // ── Services aux entreprises ─────────────────────────────────────────────
  { key: 'conseil', label: 'Cabinet de conseil', in: ['entreprises'], sector: 'conseil', say: 'consultant' },
  { key: 'comptable', label: 'Expert-comptable', in: ['entreprises'], sector: 'conseil' },
  { key: 'avocat', label: 'Avocat', in: ['entreprises'], sector: 'avocat', say: 'juridique' },
  { key: 'recrutement', label: 'Cabinet de recrutement', in: ['entreprises'], sector: 'conseil', say: 'rh chasseur de tete' },
  { key: 'bureaudetudes', label: 'Bureau d’études', in: ['entreprises', 'batiment'], sector: 'conseil' },
  { key: 'architecte', label: 'Architecte', in: ['entreprises', 'batiment'], sector: 'conseil' },
  { key: 'immobilier', label: 'Agent immobilier', in: ['entreprises'], sector: 'conseil', say: 'agence immo' },
  { key: 'courtier', label: 'Courtier', in: ['entreprises'], sector: 'conseil', say: 'assurance credit' },
  { key: 'traducteur', label: 'Traducteur / Rédacteur', in: ['entreprises'], sector: 'developpeur' },
  { key: 'nettoyage', label: 'Nettoyage professionnel', in: ['entreprises'], sector: 'services', say: 'proprete menage' },
  { key: 'securite', label: 'Sécurité / Gardiennage', in: ['entreprises'], sector: 'services' },

  // ── Services à la personne ───────────────────────────────────────────────
  { key: 'aidedomicile', label: 'Aide à domicile', in: ['personne'], sector: 'services', say: 'auxiliaire de vie' },
  { key: 'gardeenfants', label: 'Garde d’enfants', in: ['personne'], sector: 'services', say: 'nounou baby sitting' },
  { key: 'menagedomicile', label: 'Ménage à domicile', in: ['personne'], sector: 'services' },
  { key: 'jardinage', label: 'Jardinage à domicile', in: ['personne'], sector: 'services' },
  { key: 'seniors', label: 'Assistance aux personnes âgées', in: ['personne'], sector: 'services', say: 'dependance' },
  { key: 'petsitting', label: 'Garde d’animaux', in: ['personne'], sector: 'services', say: 'pet sitting' },
  { key: 'toilettage', label: 'Toilettage animalier', in: ['personne'], sector: 'services' },
  { key: 'coachdevie', label: 'Coach de vie', in: ['personne'], sector: 'coach', say: 'developpement personnel' },

  // ── Sport / Loisirs ──────────────────────────────────────────────────────
  { key: 'sallesport', label: 'Salle de sport', in: ['sport'], sector: 'coach', say: 'fitness musculation' },
  { key: 'coachsportif', label: 'Coach sportif', in: ['sport'], sector: 'coach', say: 'personal trainer' },
  { key: 'yoga', label: 'Studio de yoga', in: ['sport'], sector: 'coach' },
  { key: 'pilates', label: 'Studio de pilates', in: ['sport'], sector: 'coach' },
  { key: 'danse', label: 'École de danse', in: ['sport'], sector: 'coach' },
  { key: 'escalade', label: 'Salle d’escalade', in: ['sport'], sector: 'coach', say: 'bloc' },
  { key: 'escapegame', label: 'Escape game / Loisir indoor', in: ['sport'], sector: 'coach' },
  { key: 'padel', label: 'Club de padel / tennis', in: ['sport'], sector: 'coach' },
  { key: 'studio', label: 'Studio d’enregistrement', in: ['sport', 'digital'], sector: 'developpeur', say: 'musique' },

  // ── Formation / Association ──────────────────────────────────────────────
  { key: 'formation', label: 'Organisme de formation', in: ['savoir'], sector: 'formation', say: 'qualiopi opco' },
  { key: 'autoecole', label: 'Auto-école', in: ['savoir'], sector: 'formation',
    unit: { one: 'heure de conduite', many: 'heures de conduite', verb: 'vendues', client: 'élève' } },
  { key: 'ecole', label: 'École privée', in: ['savoir'], sector: 'formation' },
  { key: 'coursparticuliers', label: 'Cours particuliers', in: ['savoir', 'personne'], sector: 'formation', say: 'soutien scolaire' },
  { key: 'formationligne', label: 'Formation en ligne', in: ['savoir', 'digital'], sector: 'formation', say: 'e learning' },
  { key: 'coachpro', label: 'Coaching professionnel', in: ['savoir'], sector: 'conseil' },
  { key: 'association', label: 'Association', in: ['savoir'], sector: 'association', say: 'loi 1901 non lucratif' },
]

/* ─────────────────────────────── Recherche ──────────────────────────────── */

/* Un littéral d'expression régulière contenant des caractères combinants
   survit mal à la minification, qui n'échappe pas les littéraux. */
const MARKS = new RegExp('[\\u0300-\\u036f]', 'g')
const norm = (v) => String(v || '').toLowerCase().normalize('NFD').replace(MARKS, '').replace(/[^a-z0-9]+/g, ' ').trim()

export const familyOf = (key) => FAMILIES.find((f) => f.key === key) || null
export const getActivity = (key) => ACTIVITIES.find((a) => a.key === key) || null

/** Les activités d'une famille, dans l'ordre de la liste. */
export function activitiesOf(familyKey) {
  return ACTIVITIES.filter((a) => a.in.includes(familyKey))
}

/**
 * La recherche libre, qui traverse les deux niveaux.
 *
 * Elle classe : ce qui commence par ce qu'on tape d'abord, ce qui le contient
 * ensuite, et enfin ce qui ne correspond que par un synonyme. « bar » doit
 * donner Bar / Brasserie avant Barbier, et « med » doit donner les deux
 * médecins avant le laboratoire d'analyses.
 */
export function searchActivities(query, limit = 12) {
  const q = norm(query)
  if (q.length < 2) return []
  const scored = []
  for (const a of ACTIVITIES) {
    const label = norm(a.label)
    const say = norm(a.say || '')
    let score = -1
    if (label.startsWith(q)) score = 0
    else if (label.split(' ').some((w) => w.startsWith(q))) score = 1
    else if (label.includes(q)) score = 2
    else if (say.split(' ').some((w) => w.startsWith(q))) score = 3
    else if (say.includes(q)) score = 4
    if (score >= 0) scored.push({ ...a, score })
  }
  return scored.sort((x, y) => x.score - y.score || x.label.localeCompare(y.label, 'fr')).slice(0, limit)
}

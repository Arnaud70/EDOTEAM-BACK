import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const services = [
  { nom: 'Coiffure & Beauté', description: 'Coiffure, maquillage, soins esthétiques.', icon: 'Scissors' },
  { nom: 'Plomberie', description: 'Réparation de fuites, installation de sanitaires.', icon: 'Droplet' },
  { nom: 'Électricité', description: 'Dépannage électrique, installation de prises.', icon: 'Zap' },
  { nom: 'Ménage & Entretien', description: 'Nettoyage à domicile, repassage.', icon: 'Wind' },
  { nom: 'Dépannage Informatique', description: 'Réparation PC, installation de logiciels.', icon: 'Computer' },
  { nom: 'Jardinage', description: 'Tonte de pelouse, taille de haies, entretien de jardin.', icon: 'Flower' },
  { nom: 'Peinture', description: 'Peinture intérieure et extérieure, tapisserie.', icon: 'Brush' },
  { nom: 'Bricolage & Travaux', description: 'Petits travaux, montage de meubles.', icon: 'Hammer' },
  { nom: 'Garde d\'enfants', description: 'Baby-sitting, sortie d\'école, nounou.', icon: 'Baby' },
  { nom: 'Photographie', description: 'Shooting photo, couverture d\'événements.', icon: 'Camera' },
  { nom: 'Mécanique', description: 'Réparation auto/moto, entretien de véhicules.', icon: 'Wrench' },
  { nom: 'Couture & Retouches', description: 'Confection sur mesure, retouches vêtements.', icon: 'Scissors' },
  { nom: 'Soutien Scolaire', description: 'Cours particuliers, aide aux devoirs.', icon: 'Book' },
  { nom: 'Cuisine & Traiteur', description: 'Chef à domicile, préparation de repas.', icon: 'ChefHat' },
  { nom: 'Déménagement', description: 'Aide au déménagement, transport de meubles.', icon: 'Truck' },
  { nom: 'Coaching Sportif', description: 'Entraînement personnalisé, remise en forme.', icon: 'Activity' },
  { nom: 'Design & Graphisme', description: 'Création de logos, maquettes, flyers.', icon: 'PenTool' },
  { nom: 'Développement Web', description: 'Création de sites web, applications mobiles.', icon: 'Code' }
];

async function main() {
  console.log("Début de l'insertion des services...");
  
  let added = 0;
  for (const s of services) {
    const existing = await prisma.service.findUnique({ where: { nom: s.nom } });
    if (!existing) {
      await prisma.service.create({ data: s });
      console.log(`+ Ajouté : ${s.nom}`);
      added++;
    } else {
      console.log(`- Déjà existant : ${s.nom}`);
    }
  }
  
  console.log(`Terminé ! ${added} services ajoutés.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

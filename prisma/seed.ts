import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Stratégie de peuplement (Seeding) en cours...');

  // 1. Création des Services
  const services = [
    { nom: 'Plomberie', description: 'Réparation de fuites et installation de sanitaires', icon: 'Pipette' },
    { nom: 'Électricité', description: 'Installation et dépannage électrique', icon: 'Zap' },
    { nom: 'Ménage', description: 'Services de nettoyage professionnel', icon: 'Brush' },
    { nom: 'Jardinage', description: "Entretien d'espaces verts", icon: 'Flower' },
    { nom: 'Informatique', description: 'Dépannage et maintenance informatique', icon: 'Computer' },
    { nom: 'Climatisation', description: 'Installation et entretien de climatiseurs', icon: 'Wind' },
  ];

  for (const s of services) {
    await prisma.service.upsert({
      where: { nom: s.nom },
      update: {},
      create: s,
    });
  }
  console.log(`✅ Services créés : ${services.length} au total`);

  // 2. Création du Super Administrateur
  const adminEmail = 'arnaudakoenoafedikou@gmail.com';
  const adminPassword = '@Arnaud@62141#';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: hashedPassword,
      role: 'ADMIN',
      nom: 'AFEDIKOU',
      prenom: 'Akoèno Arnaud',
      emailVerified: true,
    },
    create: {
      email: adminEmail,
      nom: 'AFEDIKOU',
      prenom: 'Arnaud Akoèno',
      passwordHash: hashedPassword,
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  console.log('✅ Super Administrateur créé/vérifié');
  console.log(`   Email    : ${admin.email}`);
  console.log(`   Password : ${adminPassword}`);

  // 3. Création de quelques Prestataires de test (CDC v4.0 Validation)
  const providersData = [
    {
      email: 'jean.plombier@example.tg',
      nom: 'DA SILVA',
      prenom: 'Jean',
      bio: 'Expert en plomberie avec 10 ans d\'expérience. Intervention rapide 24/7.',
      titreProfessionnel: 'Maître Plombier',
      localisation: 'Lomé, quartier Adidogomé',
      role: 'PRESTATAIRE' as const,
      services: ['Plomberie'],
    },
    {
      email: 'marc.elec@example.tg',
      nom: 'MENSAH',
      prenom: 'Marc',
      bio: 'Installation électrique moderne et dépannage urgent.',
      titreProfessionnel: 'Électricien Certifié',
      localisation: 'Lomé, quartier Agoë',
      role: 'PRESTATAIRE' as const,
      services: ['Électricité'],
    },
    {
      email: 'aline.pro@example.tg',
      nom: 'KOFFI',
      prenom: 'Aline',
      bio: 'Service de nettoyage professionnel pour bureaux et résidences.',
      titreProfessionnel: 'Spécialiste Entretien',
      localisation: 'Lomé, quartier Deckon',
      role: 'PRESTATAIRE' as const,
      services: ['Ménage'],
    },
  ];

  const genericPassword = await bcrypt.hash('Provider123!', 10);

  for (const p of providersData) {
    const { services: providerServices, ...userData } = p;
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: { verificationStatus: 'VERIFIED' },
      create: {
        ...userData,
        passwordHash: genericPassword,
        emailVerified: true,
      },
    });

    // Associer aux services
    for (const serviceName of providerServices) {
      const service = await prisma.service.findUnique({ where: { nom: serviceName } });
      if (service) {
        await prisma.prestataireService.upsert({
          where: {
            prestataireId_serviceId: {
              prestataireId: user.id,
              serviceId: service.id,
            },
          },
          update: {},
          create: {
            prestataireId: user.id,
            serviceId: service.id,
            experience: 5,
          },
        });
      }
    }
  }

  console.log('✅ Prestataires de test créés');
  console.log('\n🎉 Seeding terminé avec succès !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

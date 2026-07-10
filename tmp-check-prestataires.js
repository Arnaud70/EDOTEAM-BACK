require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const providers = await prisma.user.findMany({
      where: { role: 'PRESTATAIRE', deletedAt: null },
      take: 20,
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        deletedAt: true,
        titreProfessionnel: true,
      },
    });
    console.log('count', providers.length);
    console.dir(providers, { depth: 5 });
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
})();
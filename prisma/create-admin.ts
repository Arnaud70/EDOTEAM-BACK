import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin@edoteam2025', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@edoteam.tg' },
    update: {},
    create: {
      email: 'admin@edoteam.tg',
      passwordHash,
      nom: 'Admin',
      prenom: 'edoteam',
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  console.log('\n✅ Compte Admin créé avec succès !');
  console.log('─────────────────────────────────');
  console.log(`📧 Email    : ${admin.email}`);
  console.log(`🔑 Password : Admin@edoteam2025`);
  console.log(`🎭 Rôle     : ${admin.role}`);
  console.log(`🆔 ID       : ${admin.id}`);
  console.log('─────────────────────────────────\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

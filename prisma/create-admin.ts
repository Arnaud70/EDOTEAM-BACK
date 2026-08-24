import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'arnaudakoenoafedikou@gmail.com';
  const adminPassword = '@Arnaud@62141#';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      nom: 'AFEDIKOU',
      prenom: 'Arnaud Akoèno',
      role: 'ADMIN',
      emailVerified: true,
    },
    create: {
      email: adminEmail,
      passwordHash,
      nom: 'AFEDIKOU',
      prenom: 'Arnaud Akoèno',
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  console.log('\n✅ Compte Super Admin créé avec succès !');
  console.log('─────────────────────────────────');
  console.log(`📧 Email    : ${admin.email}`);
  console.log(`🔑 Password : ${adminPassword}`);
  console.log(`🎭 Rôle     : ${admin.role}`);
  console.log(`🆔 ID       : ${admin.id}`);
  console.log('─────────────────────────────────\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

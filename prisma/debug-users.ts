import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Check all users
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, passwordHash: true }
  });

  console.log('\n📋 Utilisateurs dans la base de données :');
  console.log('─────────────────────────────────────────');
  for (const u of users) {
    console.log(`📧 ${u.email} | 🎭 ${u.role} | 🆔 ${u.id}`);
  }

  // Test password comparison for admin
  const admin = users.find(u => u.email === 'admin@edoteam.tg');
  if (admin) {
    const match = await bcrypt.compare('Admin@edoteam2025', admin.passwordHash);
    console.log(`\n🔑 Test du mot de passe admin : ${match ? '✅ CORRECT' : '❌ INCORRECT'}`);
  } else {
    console.log('\n⚠️ Admin non trouvé ! Recréation...');
    const passwordHash = await bcrypt.hash('Admin@edoteam2025', 10);
    await prisma.user.create({
      data: {
        email: 'admin@edoteam.tg',
        passwordHash,
        nom: 'Admin',
        prenom: 'edoteam',
        role: 'ADMIN',
        emailVerified: true,
      },
    });
    console.log('✅ Admin recréé !');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

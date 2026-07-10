require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
async function main() {
  const prisma = new PrismaClient();
  const services = await prisma.service.findMany();
  console.log(JSON.stringify(services, null, 2));
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

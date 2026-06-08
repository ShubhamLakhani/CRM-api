import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- RULES QUERY ---');
  const rules = await prisma.automationRule.findMany({
    include: {
      actions: true
    }
  });
  console.log('Rules count:', rules.length);
  console.log('Rules list:', JSON.stringify(rules, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });

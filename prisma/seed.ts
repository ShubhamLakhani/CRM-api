import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clear existing data in correct sequence
  await prisma.activity.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.deal.deleteMany({});
  await prisma.contact.deleteMany({});
  await prisma.company.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});

  console.log('🧹 Cleaned existing database records.');

  // 2. Create Organization (Tenant)
  const org = await prisma.organization.create({
    data: {
      name: 'Apex HQ',
      domain: 'apex.com',
    },
  });

  console.log('🏢 Created Tenant Organization: Apex HQ');

  // 3. Create demo users
  const salt = await bcrypt.genSalt(10);
  const demoPasswordHash = await bcrypt.hash('password123', salt);

  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@apex.com',
      passwordHash: demoPasswordHash,
      name: 'Sarah Connor',
      role: 'ADMIN',
      organizationId: org.id,
    },
  });

  const salesAgent = await prisma.user.create({
    data: {
      email: 'agent@apex.com',
      passwordHash: demoPasswordHash,
      name: 'John Doe',
      role: 'USER',
      organizationId: org.id,
    },
  });

  console.log('👤 Created demo users linked to Organization: Sarah Connor (ADMIN), John Doe (USER)');

  // 4. Create Companies
  const tesla = await prisma.company.create({
    data: {
      name: 'Tesla, Inc.',
      domain: 'tesla.com',
      industry: 'Automotive & Energy',
      employees: 140000,
      organizationId: org.id,
      createdById: demoUser.id,
    },
  });

  const microsoft = await prisma.company.create({
    data: {
      name: 'Microsoft Corp',
      domain: 'microsoft.com',
      industry: 'Software Enterprise',
      employees: 220000,
      organizationId: org.id,
      createdById: demoUser.id,
    },
  });

  const openai = await prisma.company.create({
    data: {
      name: 'OpenAI L.L.C.',
      domain: 'openai.com',
      industry: 'Artificial Intelligence',
      employees: 1200,
      organizationId: org.id,
      createdById: demoUser.id,
    },
  });

  console.log('🏢 Created demo companies: Tesla, Microsoft, OpenAI');

  // 5. Create Contacts
  const contactsData = [
    {
      name: 'Elon Musk',
      email: 'elon@tesla.com',
      phone: '+1 (555) 0199',
      status: 'CUSTOMER',
      companyId: tesla.id,
    },
    {
      name: 'Satya Nadella',
      email: 'satya@microsoft.com',
      phone: '+1 (555) 0122',
      status: 'CONTACTED',
      companyId: microsoft.id,
    },
    {
      name: 'Sam Altman',
      email: 'sam@openai.com',
      phone: '+1 (555) 0145',
      status: 'LEAD',
      companyId: openai.id,
    },
  ];

  const createdContacts = [];
  for (const c of contactsData) {
    const contact = await prisma.contact.create({
      data: {
        ...c,
        ownerId: demoUser.id,
        createdById: demoUser.id,
        organizationId: org.id,
      },
    });
    createdContacts.push(contact);
  }

  console.log(`📞 Created ${createdContacts.length} contacts.`);

  // 6. Create Deals
  const dealsData = [
    {
      title: 'Tesla Solar Roof Integration',
      value: 120000.0,
      stage: 'NEGOTIATION',
      contactId: createdContacts[0].id,
      companyId: tesla.id,
    },
    {
      title: 'Azure Cloud Migration Services',
      value: 450000.0,
      stage: 'PROPOSAL',
      contactId: createdContacts[1].id,
      companyId: microsoft.id,
    },
    {
      title: 'GPT-5 Enterprise Partnership',
      value: 850000.0,
      stage: 'WON',
      contactId: createdContacts[2].id,
      companyId: openai.id,
    },
  ];

  const createdDeals = [];
  for (const d of dealsData) {
    const deal = await prisma.deal.create({
      data: {
        ...d,
        ownerId: demoUser.id,
        createdById: demoUser.id,
        organizationId: org.id,
      },
    });
    createdDeals.push(deal);
  }

  console.log(`💼 Created ${createdDeals.length} deals.`);

  // 7. Create Activities
  const activitiesData = [
    {
      type: 'SYSTEM_UPDATE',
      description: 'Created account for Sarah Connor',
      userId: demoUser.id,
    },
    {
      type: 'CALL',
      description: 'Introductory discovery call with Elon Musk regarding solar roof software',
      contactId: createdContacts[0].id,
      dealId: createdDeals[0].id,
      userId: demoUser.id,
    },
    {
      type: 'MEETING',
      description: 'Proposal presentation with Satya Nadella and Azure stakeholders',
      contactId: createdContacts[1].id,
      dealId: createdDeals[1].id,
      userId: demoUser.id,
    },
    {
      type: 'EMAIL',
      description: 'Sent final contract documents for GPT-5 Enterprise Partnership',
      contactId: createdContacts[2].id,
      dealId: createdDeals[2].id,
      userId: demoUser.id,
    },
  ];

  for (const a of activitiesData) {
    await prisma.activity.create({
      data: {
        ...a,
        organizationId: org.id,
      },
    });
  }

  console.log('📝 Generated log entries and activity feed history.');
  console.log('✅ Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

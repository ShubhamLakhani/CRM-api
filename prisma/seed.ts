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
  await prisma.session.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.organizationMember.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.usageMetric.deleteMany({});
  await prisma.organization.deleteMany({});
  await prisma.subscriptionPlan.deleteMany({});

  console.log('🧹 Cleaned existing database records.');

  // Seed Plans
  console.log('🌱 Seeding subscription plans...');
  await prisma.subscriptionPlan.createMany({
    data: [
      {
        id: 'FREE',
        name: 'Free Plan',
        description: 'A free tier for evaluation and simple tasks',
        price: 0.0,
        maxUsers: 10,
        maxContacts: 50,
        maxDeals: 10,
        aiAssistant: false,
        emailSync: false,
        automation: false,
        clientPortal: false,
      },
      {
        id: 'STARTER',
        name: 'Starter Plan',
        description: 'Perfect for small teams getting started',
        price: 19.0,
        maxUsers: 20,
        maxContacts: 150,
        maxDeals: 30,
        aiAssistant: true,
        emailSync: false,
        automation: false,
        clientPortal: false,
      },
      {
        id: 'GROWTH',
        name: 'Growth Plan',
        description: 'Best for growing businesses needing automations',
        price: 49.0,
        maxUsers: 50,
        maxContacts: 1000,
        maxDeals: 150,
        aiAssistant: true,
        emailSync: true,
        automation: true,
        clientPortal: false,
      },
      {
        id: 'AGENCY',
        name: 'Agency Plan',
        description: 'Unlimited features for high volume businesses',
        price: 99.0,
        maxUsers: 100,
        maxContacts: 10000,
        maxDeals: 1000,
        aiAssistant: true,
        emailSync: true,
        automation: true,
        clientPortal: true,
      },
    ],
  });

  // 2. Create Organization, Subscription, and UsageMetric inside a transaction
  const org = await prisma.$transaction(async (tx) => {
    const newOrg = await tx.organization.create({
      data: {
        name: 'Apex HQ',
        slug: 'apex-hq',
      },
    });

    await tx.subscription.create({
      data: {
        organizationId: newOrg.id,
        planId: 'FREE',
        status: 'ACTIVE',
      },
    });

    await tx.usageMetric.createMany({
      data: [
        { organizationId: newOrg.id, metricKey: 'USERS', value: 2 },
        { organizationId: newOrg.id, metricKey: 'CONTACTS', value: 3 },
        { organizationId: newOrg.id, metricKey: 'DEALS', value: 3 },
      ],
    });

    return newOrg;
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
    },
  });

  const salesAgent = await prisma.user.create({
    data: {
      email: 'agent@apex.com',
      passwordHash: demoPasswordHash,
      name: 'John Doe',
      role: 'USER',
    },
  });

  // Update org owner
  await prisma.organization.update({
    where: { id: org.id },
    data: { ownerId: demoUser.id },
  });

  // Create organization members
  await prisma.organizationMember.create({
    data: {
      organizationId: org.id,
      userId: demoUser.id,
      roleId: 'ADMIN',
    },
  });

  await prisma.organizationMember.create({
    data: {
      organizationId: org.id,
      userId: salesAgent.id,
      roleId: 'USER',
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
      actorId: demoUser.id,
      entityType: 'user',
      entityId: demoUser.id,
      action: 'created',
      title: 'User Created',
      description: 'Created account for Sarah Connor',
    },
    {
      actorId: demoUser.id,
      entityType: 'deal',
      entityId: createdDeals[0].id,
      action: 'updated',
      title: 'Discovery Call Logs',
      description: 'Introductory discovery call with Elon Musk regarding solar roof software',
    },
    {
      actorId: demoUser.id,
      entityType: 'deal',
      entityId: createdDeals[1].id,
      action: 'updated',
      title: 'Proposal Presentation',
      description: 'Proposal presentation with Satya Nadella and Azure stakeholders',
    },
    {
      actorId: demoUser.id,
      entityType: 'deal',
      entityId: createdDeals[2].id,
      action: 'updated',
      title: 'Contract Sent',
      description: 'Sent final contract documents for GPT-5 Enterprise Partnership',
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

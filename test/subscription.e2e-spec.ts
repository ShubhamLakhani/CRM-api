import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';

describe('Subscription System (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let organizationId: string;
  let testDealId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Authenticate as the seeded admin user
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'demo@apex.com', password: 'password123' });

    adminToken = loginRes.body.accessToken;
    organizationId = loginRes.body.user.organizationId;

    // Set FREE/STARTER plan limits to be very low for testing limit enforcement
    await prisma.subscriptionPlan.update({
      where: { id: 'FREE' },
      data: { maxUsers: 1, maxContacts: 3, maxDeals: 3 },
    });
    await prisma.subscriptionPlan.update({
      where: { id: 'STARTER' },
      data: { maxUsers: 3, maxContacts: 100, maxDeals: 20 },
    });

    // Ensure organization starts on FREE plan for testing limits
    await prisma.subscription.update({
      where: { organizationId },
      data: { planId: 'FREE' },
    });
  });

  afterAll(async () => {
    // Clean up any test deals created in e2e tests
    if (testDealId) {
      await prisma.deal.delete({
        where: { id: testDealId },
      }).catch(() => {});
    }

    // Reset organization subscription to FREE plan
    await prisma.subscription.update({
      where: { organizationId },
      data: { planId: 'FREE' },
    });

    // Restore FREE/STARTER plan limits to default values for other tests
    await prisma.subscriptionPlan.update({
      where: { id: 'FREE' },
      data: { maxUsers: 10, maxContacts: 50, maxDeals: 10 },
    });
    await prisma.subscriptionPlan.update({
      where: { id: 'STARTER' },
      data: { maxUsers: 20, maxContacts: 150, maxDeals: 30 },
    });

    await app.close();
  });

  describe('REST APIs /subscription', () => {
    it('GET /subscription/current - should return current active subscription', async () => {
      const res = await request(app.getHttpServer())
        .get('/subscription/current')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body).toHaveProperty('id');
      expect(res.body.planId).toBe('FREE');
      expect(res.body.plan).toHaveProperty('name');
    });

    it('GET /subscription/usage - should return usage statistics', async () => {
      const res = await request(app.getHttpServer())
        .get('/subscription/usage')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body).toHaveProperty('users');
      expect(res.body).toHaveProperty('contacts');
      expect(res.body).toHaveProperty('deals');
      expect(res.body.deals.limit).toBe(3); // FREE plan limit
    });

    it('GET /subscription/plans - should return all plans', async () => {
      const res = await request(app.getHttpServer())
        .get('/subscription/plans')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(4); // FREE, STARTER, GROWTH, AGENCY
    });

    it('POST /subscription/change-plan - should change plan successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/subscription/change-plan')
        .send({ planId: 'STARTER' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.planId).toBe('STARTER');

      // Revert back to FREE for limit testing via prisma direct update
      await prisma.subscription.update({
        where: { organizationId },
        data: { planId: 'FREE' },
      });
    });
  });

  describe('Quota Limit Enforcement Integration', () => {
    it('should block creating a deal when FREE plan limit (3) is exceeded', async () => {
      // 1. Confirm we are on the FREE plan
      await prisma.subscription.update({
        where: { organizationId },
        data: { planId: 'FREE' },
      });

      // 2. Make sure we have 3 deals (limit is 3)
      const dealCount = await prisma.deal.count({
        where: { organizationId, deletedAt: null },
      });
      expect(dealCount).toBe(3);

      // 3. Trying to create a new deal should return 403 Forbidden
      const createRes = await request(app.getHttpServer())
        .post('/deals')
        .send({
          title: 'Exceeding Deal',
          value: 1000,
          stage: 'LEAD',
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(createRes.status).toBe(HttpStatus.FORBIDDEN);
      expect(createRes.body.message).toContain('Resource limit reached: cannot create deal');
    });

    it('should allow creating a deal after upgrading plan to STARTER (limit: 20)', async () => {
      // 1. Upgrade to STARTER plan
      const upgradeRes = await request(app.getHttpServer())
        .post('/subscription/change-plan')
        .send({ planId: 'STARTER' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(upgradeRes.status).toBe(HttpStatus.OK);

      // 2. Creating a new deal should now succeed
      const createRes = await request(app.getHttpServer())
        .post('/deals')
        .send({
          title: 'Allowed Deal on Starter',
          value: 5000,
          stage: 'LEAD',
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(createRes.status).toBe(HttpStatus.CREATED);
      expect(createRes.body).toHaveProperty('id');
      testDealId = createRes.body.id;
    });

    it('should prevent downgrading to FREE if current usage exceeds limits', async () => {
      // Current deal count is 4 (3 seeded + 1 created above), which exceeds FREE plan limit (3)
      const res = await request(app.getHttpServer())
        .post('/subscription/change-plan')
        .send({ planId: 'FREE' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body.message).toContain('Cannot change plan: current');
    });

    it('should verify database integrity (no organizations with NULL subscriptions)', async () => {
      // Direct translation of: SELECT organization LEFT JOIN subscription WHERE subscription IS NULL
      const orgsWithoutSubscription = await prisma.organization.findMany({
        where: {
          subscription: null,
        },
      });

      expect(orgsWithoutSubscription.length).toBe(0);
    });
  });
});

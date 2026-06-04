import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';

describe('Multi-Workspace Switching (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Wiping any leftover test records
    await prisma.session.deleteMany({
      where: {
        user: {
          email: {
            in: [
              'user_owner@test.com',
              'user_owner_b@test.com',
              'user_switch@test.com',
              'user_owner_persist_a@test.com',
              'user_owner_persist_b@test.com',
              'user_switch_persist@test.com',
            ],
          },
        },
      },
    });
    await prisma.deal.deleteMany({
      where: {
        owner: {
          email: {
            in: [
              'user_owner@test.com',
              'user_owner_b@test.com',
              'user_switch@test.com',
              'user_owner_persist_a@test.com',
              'user_owner_persist_b@test.com',
              'user_switch_persist@test.com',
            ],
          },
        },
      },
    });
    await prisma.organizationMember.deleteMany({
      where: {
        user: {
          email: {
            in: [
              'user_owner@test.com',
              'user_owner_b@test.com',
              'user_switch@test.com',
              'user_owner_persist_a@test.com',
              'user_owner_persist_b@test.com',
              'user_switch_persist@test.com',
            ],
          },
        },
      },
    });
    await prisma.organizationInvite.deleteMany({
      where: {
        email: {
          in: [
            'user_switch@test.com',
            'user_switch_persist@test.com',
          ],
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'user_owner@test.com',
            'user_owner_b@test.com',
            'user_switch@test.com',
            'user_owner_persist_a@test.com',
            'user_owner_persist_b@test.com',
            'user_switch_persist@test.com',
          ],
        },
      },
    });
  });

  afterAll(async () => {
    // Teardown database records created in tests
    await prisma.session.deleteMany({
      where: {
        user: {
          email: {
            in: [
              'user_owner@test.com',
              'user_owner_b@test.com',
              'user_switch@test.com',
              'user_owner_persist_a@test.com',
              'user_owner_persist_b@test.com',
              'user_switch_persist@test.com',
            ],
          },
        },
      },
    });
    await prisma.deal.deleteMany({
      where: {
        owner: {
          email: {
            in: [
              'user_owner@test.com',
              'user_owner_b@test.com',
              'user_switch@test.com',
              'user_owner_persist_a@test.com',
              'user_owner_persist_b@test.com',
              'user_switch_persist@test.com',
            ],
          },
        },
      },
    });
    await prisma.organizationMember.deleteMany({
      where: {
        user: {
          email: {
            in: [
              'user_owner@test.com',
              'user_owner_b@test.com',
              'user_switch@test.com',
              'user_owner_persist_a@test.com',
              'user_owner_persist_b@test.com',
              'user_switch_persist@test.com',
            ],
          },
        },
      },
    });
    await prisma.organizationInvite.deleteMany({
      where: {
        email: {
          in: [
            'user_switch@test.com',
            'user_switch_persist@test.com',
          ],
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'user_owner@test.com',
            'user_owner_b@test.com',
            'user_switch@test.com',
            'user_owner_persist_a@test.com',
            'user_owner_persist_b@test.com',
            'user_switch_persist@test.com',
          ],
        },
      },
    });
    await prisma.organization.deleteMany({
      where: {
        slug: {
          startsWith: 'test-org-',
        },
      },
    });

    await app.close();
  });

  describe('Switching workspace flow', () => {
    it('should verify roles, permissions, and visible data change on workspace switch', async () => {
      // 1. Create Org A Owner & invite user as MANAGER
      const resOwnerA = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user_owner@test.com',
          password: 'password123',
          name: 'Owner A',
        });
      const tokenOwnerA = resOwnerA.body.accessToken;
      const orgAId = resOwnerA.body.user.organizationId;

      const inviteResA = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          email: 'user_switch@test.com',
          roleId: 'MANAGER',
        });
      expect(inviteResA.status).toBe(HttpStatus.CREATED);
      const tokenA = inviteResA.body.token;

      // Register the switcher user
      const registerRes = await request(app.getHttpServer())
        .post('/invitations/register-and-accept')
        .send({
          token: tokenA,
          name: 'User Switcher',
          password: 'password123',
        });
      expect(registerRes.status).toBe(HttpStatus.CREATED);
      const cookieSwitcher = registerRes.headers['set-cookie'];
      let switcherToken = registerRes.body.accessToken;

      // 2. Create Org B Owner & invite user as VIEWER
      const resOwnerB = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user_owner_b@test.com',
          password: 'password123',
          name: 'Owner B',
        });
      const tokenOwnerB = resOwnerB.body.accessToken;
      const orgBId = resOwnerB.body.user.organizationId;

      const inviteResB = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${tokenOwnerB}`)
        .send({
          email: 'user_switch@test.com',
          roleId: 'VIEWER',
        });
      expect(inviteResB.status).toBe(HttpStatus.CREATED);
      const tokenB = inviteResB.body.token;

      // Accept second invitation
      const acceptResB = await request(app.getHttpServer())
        .post('/invitations/accept')
        .set('Authorization', `Bearer ${switcherToken}`)
        .send({ token: tokenB });
      expect(acceptResB.status).toBe(HttpStatus.OK);

      // 3. Query all memberships
      const membershipsRes = await request(app.getHttpServer())
        .get('/organizations/my-organizations')
        .set('Authorization', `Bearer ${switcherToken}`);

      expect(membershipsRes.status).toBe(HttpStatus.OK);
      expect(membershipsRes.body.length).toBe(2);
      
      const memberA = membershipsRes.body.find((m: any) => m.organizationId === orgAId);
      const memberB = membershipsRes.body.find((m: any) => m.organizationId === orgBId);
      
      expect(memberA.roleId).toBe('MANAGER');
      expect(memberB.roleId).toBe('VIEWER');

      // 4. Switch to Org A (MANAGER)
      const switchARes = await request(app.getHttpServer())
        .post('/organizations/switch')
        .set('Authorization', `Bearer ${switcherToken}`)
        .send({ organizationId: orgAId });

      expect(switchARes.status).toBe(HttpStatus.OK);
      expect(switchARes.body.user.activeOrganizationId).toBe(orgAId);
      expect(switchARes.body.user.activeOrganizationRole).toBe('MANAGER');
      expect(switchARes.body.user.permissions).toContain('deals.create');

      switcherToken = switchARes.body.accessToken;

      // Create a deal in Org A (should succeed since user is MANAGER)
      const dealRes = await request(app.getHttpServer())
        .post('/deals')
        .set('Authorization', `Bearer ${switcherToken}`)
        .send({
          title: 'Org A Enterprise Deal',
          value: 10000.0,
          stage: 'LEAD',
        });
      expect(dealRes.status).toBe(HttpStatus.CREATED);
      const dealId = dealRes.body.id;

      // 5. Switch to Org B (VIEWER)
      const switchBRes = await request(app.getHttpServer())
        .post('/organizations/switch')
        .set('Authorization', `Bearer ${switcherToken}`)
        .send({ organizationId: orgBId });

      expect(switchBRes.status).toBe(HttpStatus.OK);
      expect(switchBRes.body.user.activeOrganizationId).toBe(orgBId);
      expect(switchBRes.body.user.activeOrganizationRole).toBe('VIEWER');
      expect(switchBRes.body.user.permissions).not.toContain('deals.create');

      switcherToken = switchBRes.body.accessToken;

      // Attempt to create a deal in Org B (should fail since user is VIEWER)
      const failDealRes = await request(app.getHttpServer())
        .post('/deals')
        .set('Authorization', `Bearer ${switcherToken}`)
        .send({
          title: 'Org B Forbidden Deal',
          value: 500.0,
          stage: 'LEAD',
        });
      expect(failDealRes.status).toBe(HttpStatus.FORBIDDEN);

      // Verify that listing deals in Org B does NOT return the Org A deal (visible data isolation)
      const listDealsRes = await request(app.getHttpServer())
        .get('/deals')
        .set('Authorization', `Bearer ${switcherToken}`);

      expect(listDealsRes.status).toBe(HttpStatus.OK);
      const orgADeal = listDealsRes.body.data?.find((d: any) => d.id === dealId);
      expect(orgADeal).toBeUndefined(); // Cannot see Org A deal!

      // Cleanup deal
      await prisma.deal.delete({ where: { id: dealId } });
    });

    it('should persist active workspace context across session refreshes (page reloads)', async () => {
      // 1. Register a new user (automatically creates Org A with OWNER role)
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user_switch_persist@test.com',
          password: 'password123',
          name: 'User Switcher Persist',
        });
      expect(registerRes.status).toBe(HttpStatus.CREATED);
      const orgAId = registerRes.body.user.organizationId;
      let switcherCookie = registerRes.headers['set-cookie'];
      let switcherToken = registerRes.body.accessToken;

      // 2. Create another user and organization (Org B) to invite the first user
      const ownerBRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user_owner_persist_b@test.com',
          password: 'password123',
          name: 'Owner Persist B',
        });
      expect(ownerBRes.status).toBe(HttpStatus.CREATED);
      const tokenOwnerB = ownerBRes.body.accessToken;
      const orgBId = ownerBRes.body.user.organizationId;

      // Invite switcher as VIEWER to Org B
      const inviteResB = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${tokenOwnerB}`)
        .send({
          email: 'user_switch_persist@test.com',
          roleId: 'VIEWER',
        });
      expect(inviteResB.status).toBe(HttpStatus.CREATED);
      const tokenB = inviteResB.body.token;

      // Accept second invitation
      const acceptResB = await request(app.getHttpServer())
        .post('/invitations/accept')
        .set('Authorization', `Bearer ${switcherToken}`)
        .send({ token: tokenB });
      expect(acceptResB.status).toBe(HttpStatus.OK);

      // 3. Switch active organization to Org B
      const switchBRes = await request(app.getHttpServer())
        .post('/organizations/switch')
        .set('Authorization', `Bearer ${switcherToken}`)
        .set('Cookie', switcherCookie)
        .send({ organizationId: orgBId });
      
      expect(switchBRes.status).toBe(HttpStatus.OK);
      expect(switchBRes.body.user.activeOrganizationId).toBe(orgBId);
      expect(switchBRes.body.user.activeOrganizationRole).toBe('VIEWER');

      // Update cookie and token after rotation
      switcherCookie = switchBRes.headers['set-cookie'];
      switcherToken = switchBRes.body.accessToken;

      // 4. Perform session refresh WITHOUT passing organizationId in the body
      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', switcherCookie)
        .send({});

      expect(refreshRes.status).toBe(HttpStatus.OK);
      
      // Verify that active organization and role are persisted server-side from session record
      expect(refreshRes.body.user.activeOrganizationId).toBe(orgBId);
      expect(refreshRes.body.user.activeOrganizationRole).toBe('VIEWER');
      expect(refreshRes.body.user.role).toBe('VIEWER');
    });
  });
});

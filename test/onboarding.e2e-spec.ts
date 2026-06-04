import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';

describe('Onboarding Architecture (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Teardown database records created in tests
    await prisma.session.deleteMany({
      where: {
        user: {
          email: {
            in: [
              'signup_owner@test.com',
              'invite_manager@test.com',
              'invite_admin@test.com',
              'user_a@test.com',
              'user_b@test.com',
              'user_a_exist@test.com',
              'user_b_exist@test.com',
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
              'signup_owner@test.com',
              'invite_manager@test.com',
              'invite_admin@test.com',
              'user_a@test.com',
              'user_b@test.com',
              'user_a_exist@test.com',
              'user_b_exist@test.com',
            ],
          },
        },
      },
    });
    await prisma.organizationInvite.deleteMany({
      where: {
        email: {
          in: [
            'invite_manager@test.com',
            'invite_admin@test.com',
            'user_b@test.com',
            'user_b_exist@test.com',
          ],
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'signup_owner@test.com',
            'invite_manager@test.com',
            'invite_admin@test.com',
            'user_a@test.com',
            'user_b@test.com',
            'user_a_exist@test.com',
            'user_b_exist@test.com',
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

  describe('Workspace Creation Flow (Regular Signup)', () => {
    it('should assign OWNER role and set user as organization owner', async () => {
      const email = 'signup_owner@test.com';
      const name = 'Signup Owner';
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'password123',
          name,
        });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(email);
      expect(res.body.user.role).toBe('OWNER');

      // Verify database state
      const dbUser = await prisma.user.findUnique({
        where: { email },
      });
      expect(dbUser).toBeDefined();
      expect(dbUser?.role).toBe('OWNER');

      const dbMember = await prisma.organizationMember.findFirst({
        where: { userId: dbUser?.id },
        include: { organization: true },
      });
      expect(dbMember).toBeDefined();
      expect(dbMember?.roleId).toBe('OWNER');
      expect(dbMember?.organization.ownerId).toBe(dbUser?.id);
    });
  });

  describe('Invitation Signup Flow', () => {
    let ownerToken: string;
    let organizationId: string;

    beforeAll(async () => {
      // Create an owner to send invites
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user_a@test.com',
          password: 'password123',
          name: 'User A',
        });
      ownerToken = res.body.accessToken;
      organizationId = res.body.user.organizationId;
    });

    it('should create a MANAGER user and member when invited as MANAGER', async () => {
      const invitedEmail = 'invite_manager@test.com';
      
      // 1. Send invite
      const inviteRes = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: invitedEmail,
          roleId: 'MANAGER',
        });
      expect(inviteRes.status).toBe(HttpStatus.CREATED);
      const token = inviteRes.body.token;

      // 2. Accept invite & register
      const acceptRes = await request(app.getHttpServer())
        .post('/invitations/register-and-accept')
        .send({
          token,
          name: 'Invite Manager',
          password: 'password123',
        });

      expect(acceptRes.status).toBe(HttpStatus.CREATED);
      expect(acceptRes.body.user.role).toBe('MANAGER');

      // 3. Verify DB state
      const dbUser = await prisma.user.findUnique({
        where: { email: invitedEmail },
      });
      expect(dbUser?.role).toBe('MANAGER');

      const dbMember = await prisma.organizationMember.findFirst({
        where: { userId: dbUser?.id },
      });
      expect(dbMember?.roleId).toBe('MANAGER');
      expect(dbMember?.organizationId).toBe(organizationId);
    });

    it('should create an ADMIN user and member when invited as ADMIN', async () => {
      const invitedEmail = 'invite_admin@test.com';
      
      // 1. Send invite
      const inviteRes = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: invitedEmail,
          roleId: 'ADMIN',
        });
      expect(inviteRes.status).toBe(HttpStatus.CREATED);
      const token = inviteRes.body.token;

      // 2. Accept invite & register
      const acceptRes = await request(app.getHttpServer())
        .post('/invitations/register-and-accept')
        .send({
          token,
          name: 'Invite Admin',
          password: 'password123',
        });

      expect(acceptRes.status).toBe(HttpStatus.CREATED);
      expect(acceptRes.body.user.role).toBe('ADMIN');

      // 3. Verify DB state
      const dbUser = await prisma.user.findUnique({
        where: { email: invitedEmail },
      });
      expect(dbUser?.role).toBe('ADMIN');

      const dbMember = await prisma.organizationMember.findFirst({
        where: { userId: dbUser?.id },
      });
      expect(dbMember?.roleId).toBe('ADMIN');
      expect(dbMember?.organizationId).toBe(organizationId);
    });
  });

  describe('Existing User Invitation Flow', () => {
    it('should allow existing user to join organization with invited role without overwriting previous memberships and switch active organization', async () => {
      // 1. Register User A (Inviter)
      const resA = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user_a_exist@test.com',
          password: 'password123',
          name: 'User A Existing',
        });
      const tokenA = resA.body.accessToken;
      const orgAId = resA.body.user.organizationId;

      // 2. Register User B (Invited existing user)
      const resB = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user_b_exist@test.com',
          password: 'password123',
          name: 'User B Existing',
        });
      const tokenB = resB.body.accessToken;
      const orgBId = resB.body.user.organizationId;
      const cookieB = resB.headers['set-cookie'];

      // 3. User A invites User B to Org A as SALES
      const inviteRes = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          email: 'user_b_exist@test.com',
          roleId: 'SALES',
        });
      expect(inviteRes.status).toBe(HttpStatus.CREATED);
      const token = inviteRes.body.token;

      // 4. User B accepts invitation
      const acceptRes = await request(app.getHttpServer())
        .post('/invitations/accept')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ token });
      expect(acceptRes.status).toBe(HttpStatus.OK);

      // Verify invitation acceptedAt is populated
      const dbInvite = await prisma.organizationInvite.findUnique({
        where: { token },
      });
      expect(dbInvite?.acceptedAt).not.toBeNull();

      // 5. Verify User B has both memberships with correct roles
      const memberships = await prisma.organizationMember.findMany({
        where: { user: { email: 'user_b_exist@test.com' } },
        orderBy: { joinedAt: 'asc' },
      });

      expect(memberships.length).toBe(2);
      
      // Membership 1: Org B (OWNER)
      expect(memberships[0].organizationId).toBe(orgBId);
      expect(memberships[0].roleId).toBe('OWNER');

      // Membership 2: Org A (SALES)
      expect(memberships[1].organizationId).toBe(orgAId);
      expect(memberships[1].roleId).toBe('SALES');

      // 6. Verify active organization switches correctly on refresh
      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookieB)
        .send({ organizationId: orgAId });

      expect(refreshRes.status).toBe(HttpStatus.OK);
      expect(refreshRes.body.user.organizationId).toBe(orgAId);
      expect(refreshRes.body.user.role).toBe('SALES');
    });
  });
});

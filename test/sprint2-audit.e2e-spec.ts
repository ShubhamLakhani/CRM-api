import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';
import * as bcrypt from 'bcrypt';

describe('Sprint 2 Audit Findings (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let viewerToken: string;
  let managerToken: string;
  let organizationId: string;
  let testViewerId: string;
  let testManagerId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // 1. Authenticate as the seeded Admin user
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'demo@apex.com', password: 'password123' });

    adminToken = loginRes.body.accessToken;
    organizationId = loginRes.body.user.organizationId;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    // 2. Create a test Viewer user in the database
    const viewerUser = await prisma.user.create({
      data: {
        email: 'test_viewer@apex.com',
        name: 'Test Viewer',
        passwordHash,
        role: 'USER',
      },
    });
    testViewerId = viewerUser.id;

    // Add viewer to the organization with VIEWER role
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: viewerUser.id,
        roleId: 'VIEWER',
      },
    });

    // Authenticate as Viewer to get their token
    const viewerLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test_viewer@apex.com', password: 'password123' });
    
    viewerToken = viewerLoginRes.body.accessToken;

    // 3. Create a test Manager user in the database (for role hierarchy check)
    const managerUser = await prisma.user.create({
      data: {
        email: 'test_manager@apex.com',
        name: 'Test Manager',
        passwordHash,
        role: 'USER',
      },
    });
    testManagerId = managerUser.id;

    // Add manager to the organization with MANAGER role
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: managerUser.id,
        roleId: 'MANAGER',
      },
    });

    // Authenticate as Manager to get their token
    const managerLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test_manager@apex.com', password: 'password123' });
    
    managerToken = managerLoginRes.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup created test members & users
    await prisma.organizationMember.deleteMany({
      where: { userId: { in: [testViewerId, testManagerId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testViewerId, testManagerId] } },
    });

    await app.close();
  });

  describe('RBAC Security Enforcement', () => {
    it('should allow ADMIN to create a deal', async () => {
      const res = await request(app.getHttpServer())
        .post('/deals')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Test Enterprise Deal',
          value: 50000.0,
          stage: 'LEAD',
        });
      
      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.title).toBe('Test Enterprise Deal');

      // Cleanup
      await prisma.deal.delete({ where: { id: res.body.id } });
    });

    it('should forbid VIEWER from creating a deal', async () => {
      const res = await request(app.getHttpServer())
        .post('/deals')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          title: 'Unpermitted Deal',
          value: 10000.0,
          stage: 'LEAD',
        });
      
      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should forbid VIEWER from creating a company', async () => {
      const res = await request(app.getHttpServer())
        .post('/companies')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          name: 'Forbidden Corp',
          domain: 'forbidden.com',
        });
      
      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should forbid VIEWER from creating a task', async () => {
      const res = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          title: 'Forbidden Task',
        });
      
      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });
  });

  describe('Invitation Privilege Escalation (Role Hierarchy)', () => {
    it('should prevent MANAGER from inviting an ADMIN (privilege escalation)', async () => {
      const res = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          email: 'escalation_admin@test.com',
          roleId: 'ADMIN',
        });
      
      expect(res.status).toBe(HttpStatus.FORBIDDEN);
      expect(res.body.message).toContain('You cannot invite a user with a role higher than your own');
    });

    it('should allow MANAGER to invite a SALES user (same or lower hierarchy)', async () => {
      const res = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          email: 'sales_invited@test.com',
          roleId: 'SALES',
        });
      
      expect(res.status).toBe(HttpStatus.CREATED);

      // Cleanup
      await prisma.organizationInvite.delete({ where: { id: res.body.id } });
    });
  });

  describe('Invitation Concurrency & Replay Protection', () => {
    it('should prevent replay attacks on invitation acceptance', async () => {
      // 1. Remove the viewer's membership first so they are eligible to be invited
      await prisma.organizationMember.deleteMany({
        where: { userId: testViewerId },
      });

      // 2. Create a test invitation issued specifically to the viewer's email
      const inviteRes = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'test_viewer@apex.com',
          roleId: 'VIEWER',
        });
      
      expect(inviteRes.status).toBe(HttpStatus.CREATED);
      const token = inviteRes.body.token;

      // 3. Accept first time (should succeed and create membership)
      const acceptRes1 = await request(app.getHttpServer())
        .post('/invitations/accept')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ token });
      
      expect(acceptRes1.status).toBe(HttpStatus.OK);

      // 4. Try to accept a second time (replay attack) - should fail
      const acceptRes2 = await request(app.getHttpServer())
        .post('/invitations/accept')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ token });
      
      expect(acceptRes2.status).toBe(HttpStatus.BAD_REQUEST);
      expect(acceptRes2.body.message).toContain('already been accepted');

      // Cleanup invite
      await prisma.organizationInvite.delete({ where: { id: inviteRes.body.id } });
    });
  });

  describe('Company Performance Deal Aggregations', () => {
    it('should calculate company pipeline deal value correctly via DB-side aggregations', async () => {
      // Create a temporary company
      const company = await prisma.company.create({
        data: {
          name: 'Metrics Corp',
          organizationId,
          createdById: testViewerId,
        },
      });

      // Create two deals linked to the company
      const deal1 = await prisma.deal.create({
        data: {
          title: 'Deal 1',
          value: 25000.0,
          stage: 'LEAD',
          companyId: company.id,
          ownerId: testViewerId,
          createdById: testViewerId,
          organizationId,
        },
      });

      const deal2 = await prisma.deal.create({
        data: {
          title: 'Deal 2',
          value: 35000.0,
          stage: 'LEAD',
          companyId: company.id,
          ownerId: testViewerId,
          createdById: testViewerId,
          organizationId,
        },
      });

      // Query companies findAll
      const listRes = await request(app.getHttpServer())
        .get('/companies')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(listRes.status).toBe(HttpStatus.OK);
      const companyRecord = listRes.body.data.find((c: any) => c.id === company.id);
      expect(companyRecord).toBeDefined();
      expect(companyRecord.dealValue).toBe(60000.0); // 25k + 35k

      // Cleanup
      await prisma.deal.deleteMany({ where: { id: { in: [deal1.id, deal2.id] } } });
      await prisma.company.delete({ where: { id: company.id } });
    });
  });
});

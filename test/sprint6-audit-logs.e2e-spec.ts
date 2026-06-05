import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';
import * as bcrypt from 'bcrypt';

describe('Sprint 6 Audit Log Center (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let viewerToken: string;
  let organizationId: string;
  let testViewerId: string;
  let testLogId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // 1. Authenticate as the seeded Admin user (has audit.view permission)
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'demo@apex.com', password: 'password123' });

    adminToken = loginRes.body.accessToken;
    organizationId = loginRes.body.user.organizationId;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    // 2. Create a test Viewer user in the database (does NOT have audit.view permission)
    const viewerUser = await prisma.user.create({
      data: {
        email: 'audit_viewer@apex.com',
        name: 'Audit Viewer',
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
      .send({ email: 'audit_viewer@apex.com', password: 'password123' });
    
    viewerToken = viewerLoginRes.body.accessToken;

    // 3. Create a test AuditLog entry in the database
    const auditLog = await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'COMPANY',
        entityId: 'test-entity-uuid',
        before: null,
        after: { name: 'Acme Test Corp' },
        ipAddress: '192.168.1.1',
        organizationId,
        userId: viewerUser.id,
      },
    });
    testLogId = auditLog.id;
  });

  afterAll(async () => {
    // Cleanup audit logs created
    await prisma.auditLog.deleteMany({
      where: { entityId: 'test-entity-uuid' },
    });

    // Cleanup created test members & users
    await prisma.organizationMember.deleteMany({
      where: { userId: testViewerId },
    });
    await prisma.user.deleteMany({
      where: { id: testViewerId },
    });

    await app.close();
  });

  describe('Security and Authorization', () => {
    it('should forbid unauthenticated users from accessing audit logs', async () => {
      const res = await request(app.getHttpServer()).get('/audit-logs');
      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should forbid VIEWER role (no audit.view permission) from accessing audit logs', async () => {
      const res = await request(app.getHttpServer())
        .get('/audit-logs')
        .set('Authorization', `Bearer ${viewerToken}`);
      
      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should allow ADMIN role (has audit.view permission) to access audit logs', async () => {
      const res = await request(app.getHttpServer())
        .get('/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
    });
  });

  describe('Query Features (Pagination, Search, Filters)', () => {
    it('should filter logs by entityType', async () => {
      const res = await request(app.getHttpServer())
        .get('/audit-logs')
        .query({ entityType: 'COMPANY' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(HttpStatus.OK);
      const types = res.body.data.map((l: any) => l.entityType);
      types.forEach((type: string) => {
        expect(type).toBe('COMPANY');
      });
    });

    it('should filter logs by action', async () => {
      const res = await request(app.getHttpServer())
        .get('/audit-logs')
        .query({ action: 'CREATE' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(HttpStatus.OK);
      const actions = res.body.data.map((l: any) => l.action);
      actions.forEach((action: string) => {
        expect(action).toBe('CREATE');
      });
    });

    it('should search by term (matching ipAddress)', async () => {
      const res = await request(app.getHttpServer())
        .get('/audit-logs')
        .query({ search: '192.168.1.1' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].ipAddress).toBe('192.168.1.1');
    });
  });

  describe('CSV Export', () => {
    it('should allow ADMIN to export logs as CSV', async () => {
      const res = await request(app.getHttpServer())
        .get('/audit-logs/export')
        .query({ search: '192.168.1.1' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.header['content-type']).toContain('text/csv');
      expect(res.header['content-disposition']).toContain('attachment; filename="audit-logs.csv"');
      expect(res.text).toContain('timestamp,actor,entityType,action,before,after,ipAddress');
      expect(res.text).toContain('192.168.1.1');
      expect(res.text).toContain('COMPANY');
      expect(res.text).toContain('CREATE');
      expect(res.text).toContain('Audit Viewer (audit_viewer@apex.com)');
    });

    it('should forbid VIEWER from exporting logs as CSV', async () => {
      const res = await request(app.getHttpServer())
        .get('/audit-logs/export')
        .set('Authorization', `Bearer ${viewerToken}`);
      
      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });
  });

  describe('Get Single Log Detail', () => {
    it('should retrieve a single log details by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/audit-logs/${testLogId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.id).toBe(testLogId);
      expect(res.body.action).toBe('CREATE');
      expect(res.body.entityType).toBe('COMPANY');
      expect(res.body.user.email).toBe('audit_viewer@apex.com');
    });

    it('should return 404 for non-existent log ID', async () => {
      const res = await request(app.getHttpServer())
        .get('/audit-logs/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
    });
  });
});

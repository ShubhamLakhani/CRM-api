import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';
import * as bcrypt from 'bcrypt';
import { AutomationTrigger, AutomationActionType } from '@prisma/client';
import { EmailService } from './../src/email/email.service';

describe('Automations Subsystem (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let managerToken: string;
  let salesToken: string;
  let organizationId: string;

  let managerUserId: string;
  let salesUserId: string;
  let testRuleId: string;

  const mockEmailService = {
    sendEmail: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Clear any leftover automation rules and executions to ensure a clean test environment
    await prisma.automationExecution.deleteMany({});
    await prisma.automationAction.deleteMany({});
    await prisma.automationRule.deleteMany({});

    // 1. Authenticate as the seeded Admin user (Sarah Connor)
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'demo@apex.com', password: 'password123' });

    adminToken = loginRes.body.accessToken;
    organizationId = loginRes.body.user.organizationId;

    // 2. Authenticate as the seeded Sales user (John Doe)
    const salesLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'agent@apex.com', password: 'password123' });

    salesToken = salesLoginRes.body.accessToken;
    salesUserId = salesLoginRes.body.user.id;

    // 3. Create a test Manager user in the database
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    const managerUser = await prisma.user.create({
      data: {
        email: 'manager@apex.com',
        name: 'Manager User',
        passwordHash,
        role: 'USER',
      },
    });
    managerUserId = managerUser.id;

    // Add manager to the organization with MANAGER role
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: managerUser.id,
        roleId: 'MANAGER',
      },
    });

    // Authenticate as Manager
    const managerLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'manager@apex.com', password: 'password123' });

    managerToken = managerLoginRes.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup rules created
    if (testRuleId) {
      await prisma.automationRule.deleteMany({
        where: { id: testRuleId },
      });
    }

    // Cleanup manager members & users
    await prisma.organizationMember.deleteMany({
      where: { userId: managerUserId },
    });
    await prisma.user.deleteMany({
      where: { id: managerUserId },
    });

    await app.close();
  });

  describe('Security and Authorization (RBAC)', () => {
    it('should forbid unauthenticated requests from listing rules', async () => {
      const res = await request(app.getHttpServer()).get('/automations');
      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should forbid SALES role (no automations.view permission) from listing rules', async () => {
      const res = await request(app.getHttpServer())
        .get('/automations')
        .set('Authorization', `Bearer ${salesToken}`);
      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should allow MANAGER role (has automations.view permission) to list rules', async () => {
      const res = await request(app.getHttpServer())
        .get('/automations')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should allow ADMIN role (has automations.view permission) to list rules', async () => {
      const res = await request(app.getHttpServer())
        .get('/automations')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Rule CRUD Lifecycle (Admin)', () => {
    it('should allow ADMIN to create an automation rule', async () => {
      const res = await request(app.getHttpServer())
        .post('/automations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Create Task on Deal Won',
          triggerEvent: AutomationTrigger.DEAL_WON,
          isEnabled: true,
          actions: [
            {
              actionType: AutomationActionType.CREATE_TASK,
              configurationJson: {
                title: 'Onboard Client for {{deal.title}}',
                priority: 'HIGH',
                dueDateOffsetDays: 7,
                assigneeId: 'ACTOR',
              },
            },
          ],
        });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Create Task on Deal Won');
      expect(res.body.version).toBe(1);
      expect(res.body.actions.length).toBe(1);
      expect(res.body.actions[0].actionType).toBe(AutomationActionType.CREATE_TASK);

      testRuleId = res.body.id;
    });

    it('should forbid MANAGER from creating an automation rule', async () => {
      const res = await request(app.getHttpServer())
        .post('/automations')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Manager Rule Attempt',
          triggerEvent: AutomationTrigger.CONTACT_CREATED,
          actions: [
            {
              actionType: AutomationActionType.SEND_NOTIFICATION,
              configurationJson: { message: 'hi' },
            },
          ],
        });

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should allow ADMIN to read specific rule details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/automations/${testRuleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.id).toBe(testRuleId);
      expect(res.body.name).toBe('Create Task on Deal Won');
    });

    it('should allow ADMIN to update a rule and increment version', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/automations/${testRuleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Create Task on Deal Won (Updated)',
          isEnabled: false,
        });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.name).toBe('Create Task on Deal Won (Updated)');
      expect(res.body.isEnabled).toBe(false);
      expect(res.body.version).toBe(2); // Auto-incremented to 2
    });

    it('should forbid MANAGER from updating a rule', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/automations/${testRuleId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Manager Try Update',
        });

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should forbid MANAGER from deleting a rule', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/automations/${testRuleId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should allow ADMIN to delete the automation rule', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/automations/${testRuleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.success).toBe(true);

      // Verify deletion from db
      const deletedRule = await prisma.automationRule.findUnique({
        where: { id: testRuleId },
      });
      expect(deletedRule).toBeNull();

      testRuleId = null; // Clear so cleanup won't error
    });
  });

  describe('Rule Execution SEND_EMAIL Integration (E2E)', () => {
    let emailRuleId: string;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterEach(async () => {
      if (emailRuleId) {
        await prisma.automationRule.deleteMany({
          where: { id: emailRuleId },
        });
        emailRuleId = null;
      }
      await prisma.contact.deleteMany({
        where: { email: 'e2e-email-test@example.com' },
      });
      await prisma.automationExecution.deleteMany({
        where: { triggerEvent: AutomationTrigger.CONTACT_CREATED },
      });
    });

    it('should trigger SEND_EMAIL action, enqueue and process email job, updating execution to SUCCESS', async () => {
      const ruleRes = await request(app.getHttpServer())
        .post('/automations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Send E2E Email Test',
          triggerEvent: AutomationTrigger.CONTACT_CREATED,
          isEnabled: true,
          actions: [
            {
              actionType: AutomationActionType.SEND_EMAIL,
              configurationJson: {
                to: 'e2e-email-test@example.com',
                subject: 'E2E Subject for {{contact.name}}',
                body: 'Hello {{contact.name}}, this is a test.',
              },
            },
          ],
        });

      expect(ruleRes.status).toBe(HttpStatus.CREATED);
      emailRuleId = ruleRes.body.id;

      const contactRes = await request(app.getHttpServer())
        .post('/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Tony Stark',
          email: 'e2e-email-test@example.com',
          status: 'LEAD',
        });

      expect(contactRes.status).toBe(HttpStatus.CREATED);

      let execution: any = null;
      for (let i = 0; i < 25; i++) {
        execution = await prisma.automationExecution.findFirst({
          where: { ruleId: emailRuleId },
        });
        if (execution && execution.status === 'SUCCESS') {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Allow background queue worker a moment to process the queued email job
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(execution).toBeDefined();
      expect(execution.status).toBe('SUCCESS');
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'e2e-email-test@example.com',
          subject: 'E2E Subject for Tony Stark',
          html: 'Hello Tony Stark, this is a test.',
        }),
      );
    });
  });

  describe('Rule Execution Conditions Engine Integration (E2E)', () => {
    let matchRuleId: string;
    let failRuleId: string;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterEach(async () => {
      if (matchRuleId) {
        await prisma.automationRule.deleteMany({ where: { id: matchRuleId } });
        matchRuleId = null;
      }
      if (failRuleId) {
        await prisma.automationRule.deleteMany({ where: { id: failRuleId } });
        failRuleId = null;
      }
      await prisma.contact.deleteMany({
        where: { email: { in: ['match-condition@example.com', 'fail-condition@example.com'] } },
      });
      await prisma.automationExecution.deleteMany({
        where: { triggerEvent: AutomationTrigger.CONTACT_CREATED },
      });
    });

    it('should execute rule successfully when conditions match', async () => {
      const ruleRes = await request(app.getHttpServer())
        .post('/automations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Conditions Match Test',
          triggerEvent: AutomationTrigger.CONTACT_CREATED,
          isEnabled: true,
          conditionsJson: [
            { field: 'contact.name', operator: 'EQUALS', value: 'Clark Kent' },
          ],
          actions: [
            {
              actionType: AutomationActionType.SEND_EMAIL,
              configurationJson: {
                to: 'match-condition@example.com',
                subject: 'Match Test',
                body: 'Hello {{contact.name}}',
              },
            },
          ],
        });

      expect(ruleRes.status).toBe(HttpStatus.CREATED);
      matchRuleId = ruleRes.body.id;

      const contactRes = await request(app.getHttpServer())
        .post('/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Clark Kent',
          email: 'match-condition@example.com',
          status: 'LEAD',
        });

      expect(contactRes.status).toBe(HttpStatus.CREATED);

      let execution: any = null;
      for (let i = 0; i < 25; i++) {
        execution = await prisma.automationExecution.findFirst({
          where: { ruleId: matchRuleId },
        });
        if (execution && execution.status === 'SUCCESS') {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Allow background queue worker a moment to process the queued email job
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(execution).toBeDefined();
      expect(execution.status).toBe('SUCCESS');
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'match-condition@example.com',
          subject: 'Match Test',
          html: 'Hello Clark Kent',
        }),
      );
    });

    it('should skip rule execution when conditions fail', async () => {
      const ruleRes = await request(app.getHttpServer())
        .post('/automations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Conditions Fail Test',
          triggerEvent: AutomationTrigger.CONTACT_CREATED,
          isEnabled: true,
          conditionsJson: [
            { field: 'contact.name', operator: 'EQUALS', value: 'Bruce Wayne' },
          ],
          actions: [
            {
              actionType: AutomationActionType.SEND_EMAIL,
              configurationJson: {
                to: 'fail-condition@example.com',
                subject: 'Fail Test',
                body: 'Hello {{contact.name}}',
              },
            },
          ],
        });

      expect(ruleRes.status).toBe(HttpStatus.CREATED);
      failRuleId = ruleRes.body.id;

      const contactRes = await request(app.getHttpServer())
        .post('/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Arthur Curry',
          email: 'fail-condition@example.com',
          status: 'LEAD',
        });

      expect(contactRes.status).toBe(HttpStatus.CREATED);

      let execution: any = null;
      for (let i = 0; i < 25; i++) {
        execution = await prisma.automationExecution.findFirst({
          where: { ruleId: failRuleId },
        });
        if (execution && execution.status === 'SKIPPED') {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      expect(execution).toBeDefined();
      expect(execution.status).toBe('SKIPPED');
      expect(execution.metadata).toHaveProperty('skippedReason');
      expect((execution.metadata as any).skippedReason).toContain('Condition failed: [contact.name]');
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });
  });
});

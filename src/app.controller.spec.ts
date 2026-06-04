import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './database/prisma.service';
import { RedisService } from './redis/redis.service';
import { NotificationProducerService } from './queue/producers/notification-producer.service';

describe('AppController', () => {
  let appController: AppController;
  let mockPrismaService: any;
  let mockRedisService: any;
  let mockNotificationProducer: any;

  beforeEach(async () => {
    mockPrismaService = {
      $queryRaw: jest.fn().mockResolvedValue([{ '1': 1 }]),
    };

    mockRedisService = {
      getClient: jest.fn().mockReturnValue({
        ping: jest.fn().mockResolvedValue('PONG'),
      }),
    };

    mockNotificationProducer = {
      getQueue: jest.fn().mockReturnValue({
        getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 }),
      }),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: NotificationProducerService,
          useValue: mockNotificationProducer,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return system health status with postgres, redis, and bullmq indicators', async () => {
      const result = await appController.checkHealth();
      expect(result).toEqual(
        expect.objectContaining({
          status: 'UP',
          postgres: 'UP',
          redis: 'UP',
          bullmq: 'UP',
        }),
      );
    });

    it('should return DOWN status if one of the subsystems is down', async () => {
      mockRedisService.getClient.mockReturnValue({
        ping: jest.fn().mockRejectedValue(new Error('Connection timeout')),
      });

      const result = await appController.checkHealth();
      expect(result.status).toBe('DOWN');
      expect(result.redis).toBe('DOWN');
      expect(result.postgres).toBe('UP');
    });
  });
});


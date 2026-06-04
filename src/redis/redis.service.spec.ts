import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return {
      on: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      flushall: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      rpush: jest.fn(),
      lpop: jest.fn(),
      llen: jest.fn(),
      quit: jest.fn(),
    };
  });
});

describe('RedisService', () => {
  let service: RedisService;
  let mockConfigService: any;
  let mockRedisClient: any;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'redisHost') return 'localhost';
        if (key === 'redisPort') return 6379;
        return defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    mockRedisClient = service.getClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('caching', () => {
    it('should set and get values with deserialization', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({ value: 'cached' }));
      const result = await service.get<any>('test-key');
      expect(result).toEqual({ value: 'cached' });
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
    });

    it('should set raw strings and resolve them', async () => {
      mockRedisClient.get.mockResolvedValue('raw-string');
      const result = await service.get<string>('test-key');
      expect(result).toBe('raw-string');
    });

    it('should call set with stringified value', async () => {
      await service.set('test-key', { data: 'test' });
      expect(mockRedisClient.set).toHaveBeenCalledWith('test-key', JSON.stringify({ data: 'test' }));
    });

    it('should call set with TTL', async () => {
      await service.set('test-key', 'value', 3600);
      expect(mockRedisClient.set).toHaveBeenCalledWith('test-key', 'value', 'EX', 3600);
    });

    it('should delete a key', async () => {
      await service.del('test-key');
      expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
    });

    it('should check if key exists', async () => {
      mockRedisClient.exists.mockResolvedValue(1);
      const exists = await service.exists('test-key');
      expect(exists).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith('test-key');
    });
  });

  describe('session helpers', () => {
    it('should set and retrieve session data', async () => {
      const sessionData = { userId: '123' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(sessionData));
      
      await service.setSession('session-id', sessionData, 100);
      expect(mockRedisClient.set).toHaveBeenCalledWith('session:session-id', JSON.stringify(sessionData), 'EX', 100);

      const result = await service.getSession('session-id');
      expect(result).toEqual(sessionData);
    });

    it('should destroy session data', async () => {
      await service.destroySession('session-id');
      expect(mockRedisClient.del).toHaveBeenCalledWith('session:session-id');
    });
  });

  describe('rate limiting', () => {
    it('should increment key and set expire on first call', async () => {
      mockRedisClient.incr.mockResolvedValue(1);
      const count = await service.incrAndExpire('rate-limit-key', 60);
      expect(count).toBe(1);
      expect(mockRedisClient.incr).toHaveBeenCalledWith('rate-limit-key');
      expect(mockRedisClient.expire).toHaveBeenCalledWith('rate-limit-key', 60);
    });

    it('should not set expire on subsequent calls', async () => {
      mockRedisClient.incr.mockResolvedValue(2);
      const count = await service.incrAndExpire('rate-limit-key', 60);
      expect(count).toBe(2);
      expect(mockRedisClient.incr).toHaveBeenCalledWith('rate-limit-key');
      expect(mockRedisClient.expire).not.toHaveBeenCalled();
    });
  });

  describe('queues', () => {
    it('should push data to a queue', async () => {
      mockRedisClient.rpush.mockResolvedValue(1);
      const length = await service.pushToQueue('my-queue', { task: 1 });
      expect(length).toBe(1);
      expect(mockRedisClient.rpush).toHaveBeenCalledWith('queue:my-queue', JSON.stringify({ task: 1 }));
    });

    it('should pop data from a queue', async () => {
      mockRedisClient.lpop.mockResolvedValue(JSON.stringify({ task: 1 }));
      const result = await service.popFromQueue<any>('my-queue');
      expect(result).toEqual({ task: 1 });
      expect(mockRedisClient.lpop).toHaveBeenCalledWith('queue:my-queue');
    });

    it('should return queue length', async () => {
      mockRedisClient.llen.mockResolvedValue(5);
      const length = await service.getQueueLength('my-queue');
      expect(length).toBe(5);
      expect(mockRedisClient.llen).toHaveBeenCalledWith('queue:my-queue');
    });
  });
});

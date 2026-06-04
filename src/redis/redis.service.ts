import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('redisUrl');

    if (redisUrl) {
      this.logger.log('Initializing Redis client with connection string');
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
      });
    } else {
      const host = this.configService.get<string>('redisHost') || 'localhost';
      const port = this.configService.get<number>('redisPort') || 6379;
      const password = this.configService.get<string>('redisPassword');
      const db = this.configService.get<number>('redisDb') || 0;

      this.logger.log(`Initializing Redis client with configuration details - ${host}:${port} (db: ${db})`);
      this.client = new Redis({
        host,
        port,
        password,
        db,
        maxRetriesPerRequest: 3,
      });
    }

    this.client.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });

    this.client.on('connect', () => {
      this.logger.log('Successfully connected to Redis');
    });
  }

  // Caching Features
  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.set(key, stringValue, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, stringValue);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async flushall(): Promise<void> {
    await this.client.flushall();
  }

  // Session Helper Features
  async setSession(sessionId: string, data: any, ttlSeconds: number): Promise<void> {
    const key = `session:${sessionId}`;
    await this.set(key, data, ttlSeconds);
  }

  async getSession<T>(sessionId: string): Promise<T | null> {
    const key = `session:${sessionId}`;
    return this.get<T>(key);
  }

  async destroySession(sessionId: string): Promise<void> {
    const key = `session:${sessionId}`;
    await this.del(key);
  }

  // Rate Limiting Features
  async incrAndExpire(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, ttlSeconds);
    }
    return count;
  }

  // Queue Features
  async pushToQueue(queueName: string, data: any): Promise<number> {
    const key = `queue:${queueName}`;
    const stringValue = typeof data === 'string' ? data : JSON.stringify(data);
    return this.client.rpush(key, stringValue);
  }

  async popFromQueue<T>(queueName: string): Promise<T | null> {
    const key = `queue:${queueName}`;
    const data = await this.client.lpop(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  }

  async getQueueLength(queueName: string): Promise<number> {
    const key = `queue:${queueName}`;
    return this.client.llen(key);
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from Redis');
    await this.client.quit();
  }
}

export interface Config {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiration: string;
  redisUrl?: string;
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  redisDb: number;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword?: string;
  mailFrom: string;
}

export default (): Config => {
  const isTest = process.env.NODE_ENV === 'test';

  if (!isTest) {
    const requiredEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM'];
    for (const key of requiredEnv) {
      if (!process.env[key]) {
        throw new Error(`Config validation failed: Environment variable ${key} is missing`);
      }
    }
  }

  return {
    port: parseInt(process.env.PORT || '3001', 10),
    databaseUrl: process.env.DATABASE_URL || '',
    jwtSecret: process.env.JWT_SECRET || 'super-secret-crm-key-change-in-production',
    jwtExpiration: process.env.JWT_EXPIRATION || '7d',
    redisUrl: process.env.REDIS_URL,
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
    redisPassword: process.env.REDIS_PASSWORD,
    redisDb: parseInt(process.env.REDIS_DB || '0', 10),
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpUser: process.env.SMTP_USER || '',
    smtpPassword: process.env.SMTP_PASSWORD || '',
    mailFrom: process.env.MAIL_FROM || '',
  };
};

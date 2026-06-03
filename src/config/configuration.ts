export interface Config {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiration: string;
}

export default (): Config => ({
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-crm-key-change-in-production',
  jwtExpiration: process.env.JWT_EXPIRATION || '7d',
});

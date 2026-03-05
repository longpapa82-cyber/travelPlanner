import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as fs from 'fs';

function buildSslConfig():
  | false
  | { rejectUnauthorized: boolean; ca?: string } {
  if (process.env.DB_SSL === 'false') return false;
  if (process.env.DB_SSL !== 'true' && process.env.NODE_ENV !== 'production')
    return false;

  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
  const sslConfig: { rejectUnauthorized: boolean; ca?: string } = {
    rejectUnauthorized,
  };

  if (process.env.DB_SSL_CA) {
    sslConfig.ca = fs.readFileSync(process.env.DB_SSL_CA, 'utf8');
  }

  return sslConfig;
}

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'travelplanner',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    synchronize:
      process.env.NODE_ENV !== 'production' &&
      process.env.DB_SYNCHRONIZE !== 'false',
    migrationsRun: process.env.NODE_ENV === 'production',
    logging: process.env.NODE_ENV === 'development',
    ssl: buildSslConfig(),
    extra: {
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    },
  }),
);

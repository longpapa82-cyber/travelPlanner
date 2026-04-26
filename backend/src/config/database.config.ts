import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as fs from 'fs';

/**
 * V185 (Invariant 34): production fail-fast for required secrets.
 * Catches the V184 finding where DB_PASSWORD silently fell back to
 * 'postgres' default in misconfigured production environments. Without
 * this guard, a deploy with missing env would have started successfully
 * and connected to a non-existent local Postgres → silent crash on first
 * query. We fail loudly at module load instead.
 */
function requireEnvInProduction(name: string): string {
  const value = process.env[name];
  if (
    process.env.NODE_ENV === 'production' &&
    (!value || value.trim() === '')
  ) {
    throw new Error(
      `[Config] Required env "${name}" is missing or empty in production. ` +
        `Refusing to start with insecure defaults.`,
    );
  }
  return value || '';
}

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
    host: requireEnvInProduction('DB_HOST') || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: requireEnvInProduction('DB_USERNAME') || 'postgres',
    password: requireEnvInProduction('DB_PASSWORD') || 'postgres',
    database: requireEnvInProduction('DB_DATABASE') || 'travelplanner',
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

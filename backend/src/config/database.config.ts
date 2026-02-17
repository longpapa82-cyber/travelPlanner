import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

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
      process.env.DB_SYNCHRONIZE === 'true'
        ? true
        : process.env.NODE_ENV === 'development',
    migrationsRun:
      process.env.DB_SYNCHRONIZE === 'true'
        ? false
        : process.env.NODE_ENV === 'production',
    logging: process.env.NODE_ENV === 'development',
    ssl:
      process.env.DB_SSL === 'false'
        ? false
        : process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
  }),
);

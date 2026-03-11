import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type ApiProvider = 'openai' | 'locationiq' | 'openweather' | 'google_timezone';
export type ApiFeature = 'ai_trip' | 'geocoding' | 'weather' | 'timezone';
export type ApiStatus = 'success' | 'error';

@Entity('api_usage')
@Index(['createdAt'])
@Index(['provider'])
@Index(['provider', 'createdAt'])
export class ApiUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30 })
  provider: ApiProvider;

  @Column({ type: 'varchar', length: 30 })
  feature: ApiFeature;

  @Column({ type: 'varchar', length: 10, default: 'success' })
  status: ApiStatus;

  @Column({ type: 'int', nullable: true })
  inputTokens: number;

  @Column({ type: 'int', nullable: true })
  outputTokens: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  costUsd: number;

  @Column({ type: 'int', default: 0 })
  latencyMs: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  errorCode: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;
}

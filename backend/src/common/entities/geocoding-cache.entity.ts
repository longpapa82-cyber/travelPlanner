import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('geocoding_cache')
export class GeocodingCache {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  queryHash: string;

  @Column({ type: 'text' })
  query: string;

  @Column({ type: 'double precision' })
  latitude: number;

  @Column({ type: 'double precision' })
  longitude: number;

  @Column({ type: 'varchar', length: 20, default: 'google' })
  source: string;

  @Column({ type: 'real', default: 1.0 })
  confidence: number;

  @Index()
  @Column({ type: 'int', default: 1 })
  hitCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

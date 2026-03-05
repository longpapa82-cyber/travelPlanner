import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Activity } from './itinerary.entity';

/**
 * Pre-computed itinerary templates for instant trip generation.
 * Eliminates AI API calls for known destination+duration+style combos.
 *
 * Lookup key: destination (normalized) + durationDays + travelStyle + budgetLevel + language
 */
@Entity('itinerary_templates')
@Index(
  [
    'destinationNormalized',
    'durationDays',
    'travelStyle',
    'budgetLevel',
    'language',
  ],
  { unique: true },
)
@Index(['destinationNormalized', 'durationDays'])
@Index(['popularity'])
@Index(['lastVerifiedAt'])
export class ItineraryTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Display name, e.g. "Tokyo, Japan" */
  @Column({ type: 'varchar', length: 200 })
  destination: string;

  /** Lowercase, trimmed key for lookup: "tokyo" */
  @Column({ type: 'varchar', length: 200 })
  destinationNormalized: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  /** Trip length this template covers */
  @Column({ type: 'int' })
  durationDays: number;

  /** e.g. "cultural", "adventure", "relaxation", "default" */
  @Column({ type: 'varchar', length: 50, default: 'default' })
  travelStyle: string;

  /** e.g. "budget", "moderate", "luxury", "default" */
  @Column({ type: 'varchar', length: 50, default: 'default' })
  budgetLevel: string;

  /** "ko", "en", "ja" */
  @Column({ type: 'varchar', length: 10, default: 'ko' })
  language: string;

  /**
   * Full itinerary data: array of day objects, each containing activities.
   * Structure: [{ dayNumber: 1, activities: Activity[] }, ...]
   */
  @Column({ type: 'jsonb' })
  days: Array<{ dayNumber: number; activities: Activity[] }>;

  /** Extra metadata: source, model version, generation params */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  /** Schema version for future migrations */
  @Column({ type: 'int', default: 1 })
  version: number;

  /** When the AI originally generated this template */
  @Column({ type: 'timestamptz' })
  generatedAt: Date;

  /** Last time we confirmed this data is still valid */
  @Column({ type: 'timestamptz' })
  lastVerifiedAt: Date;

  /** Number of times this template was served to users */
  @Column({ type: 'int', default: 0 })
  popularity: number;

  /** Average user rating (0-5), null if unrated */
  @Column({ type: 'float', nullable: true })
  rating?: number;

  /** How many times this template was served as the primary result */
  @Column({ type: 'int', default: 0 })
  servedCount: number;

  /** How many times users significantly modified the template-based itinerary */
  @Column({ type: 'int', default: 0 })
  userModifiedCount: number;

  /**
   * Quality score: 0.0 (worst) to 1.0 (best).
   * Computed as 1 - (userModifiedCount / servedCount).
   * Null until first served.
   */
  @Column({ type: 'float', nullable: true })
  qualityScore?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

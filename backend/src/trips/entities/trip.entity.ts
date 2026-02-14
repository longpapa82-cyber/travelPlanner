import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Itinerary } from './itinerary.entity';

export enum TripStatus {
  UPCOMING = 'upcoming',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
}

@Entity('trips')
@Index(['userId', 'status'])
@Index(['userId', 'startDate'])
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 200 })
  destination: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({
    type: 'enum',
    enum: TripStatus,
    default: TripStatus.UPCOMING,
  })
  status: TripStatus;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'int', default: 1 })
  numberOfTravelers: number;

  @Column({ type: 'jsonb', nullable: true })
  preferences?: {
    budget?: string;
    travelStyle?: string;
    interests?: string[];
  };

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalBudget?: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  budgetCurrency: string;

  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  shareToken?: string;

  @Column({ type: 'varchar', nullable: true })
  coverImage?: string;

  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ type: 'timestamp', nullable: true })
  shareExpiresAt?: Date;

  @OneToMany(() => Itinerary, (itinerary) => itinerary.trip, {
    cascade: true,
  })
  itineraries: Itinerary[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

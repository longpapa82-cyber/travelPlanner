import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Trip } from './trip.entity';

export interface Activity {
  time: string;
  title: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  estimatedDuration?: number;
  estimatedCost?: number;
  actualCost?: number;
  currency?: string;
  type?: string;
  completed?: boolean;
  photos?: string[];
}

export interface WeatherInfo {
  temperature: number;
  condition: string;
  humidity?: number;
  windSpeed?: number;
  icon?: string;
}

@Entity('itineraries')
export class Itinerary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tripId: string;

  @ManyToOne(() => Trip, (trip) => trip.itineraries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tripId' })
  trip: Trip;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'int' })
  dayNumber: number;

  @Column({ type: 'jsonb', default: [] })
  activities: Activity[];

  @Column({ type: 'jsonb', nullable: true })
  weather?: WeatherInfo;

  @Column({ type: 'varchar', nullable: true })
  timezone?: string;

  @Column({ type: 'int', nullable: true })
  timezoneOffset?: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

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
import { Trip } from '../../trips/entities/trip.entity';
import { User } from '../../users/entities/user.entity';
import { ExpenseSplit } from './expense-split.entity';

export enum SplitMethod {
  EQUAL = 'equal',
  EXACT = 'exact',
}

export enum ExpenseCategory {
  FOOD = 'food',
  TRANSPORT = 'transport',
  ACCOMMODATION = 'accommodation',
  ACTIVITY = 'activity',
  SHOPPING = 'shopping',
  OTHER = 'other',
}

@Entity('expenses')
@Index(['tripId', 'date'])
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tripId: string;

  @ManyToOne(() => Trip, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tripId' })
  trip: Trip;

  @Column('uuid')
  paidByUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paidByUserId' })
  paidBy: User;

  @Column({ type: 'varchar', length: 200 })
  description: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({
    type: 'enum',
    enum: ExpenseCategory,
    default: ExpenseCategory.OTHER,
  })
  category: ExpenseCategory;

  @Column({ type: 'enum', enum: SplitMethod, default: SplitMethod.EQUAL })
  splitMethod: SplitMethod;

  @Column({ type: 'date' })
  date: string;

  @OneToMany(() => ExpenseSplit, (split) => split.expense, {
    cascade: true,
    eager: true,
  })
  splits: ExpenseSplit[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

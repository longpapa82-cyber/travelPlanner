import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Expense } from './expense.entity';
import { User } from '../../users/entities/user.entity';

@Entity('expense_splits')
export class ExpenseSplit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  expenseId: string;

  @ManyToOne(() => Expense, (expense) => expense.splits, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'expenseId' })
  expense: Expense;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ default: false })
  isSettled: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

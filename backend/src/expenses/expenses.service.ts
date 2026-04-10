import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense, SplitMethod } from './entities/expense.entity';
import { ExpenseSplit } from './entities/expense-split.entity';
import { Trip } from '../trips/entities/trip.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

export interface BalanceEntry {
  userId: string;
  userName: string;
  balance: number;
}

export interface SettlementEntry {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
}

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(ExpenseSplit)
    private readonly expenseSplitRepository: Repository<ExpenseSplit>,
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
  ) {}

  /**
   * Verify user has access to the trip (owner or collaborator)
   */
  private async verifyTripAccess(
    tripId: string,
    userId: string,
  ): Promise<Trip> {
    const trip = await this.tripRepository.findOne({
      where: { id: tripId },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    // Check if user is the trip owner
    if (trip.userId === userId) {
      return trip;
    }

    // Check if user is a collaborator
    const collaborator = await this.tripRepository.manager
      .createQueryBuilder()
      .select('c.id')
      .from('collaborators', 'c')
      .where('c.tripId = :tripId', { tripId })
      .andWhere('c.userId = :userId', { userId })
      .getRawOne();

    if (!collaborator) {
      throw new ForbiddenException('You do not have access to this trip');
    }

    return trip;
  }

  /**
   * Verify that a set of user IDs are all trip participants (owner or collaborators)
   */
  private async verifyTripParticipants(
    tripId: string,
    userIds: string[],
  ): Promise<void> {
    const trip = await this.tripRepository.findOne({
      where: { id: tripId },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    // Gather all valid participant IDs: owner + collaborators
    const collaborators = await this.tripRepository.manager
      .createQueryBuilder()
      .select('c.userId', 'userId')
      .from('collaborators', 'c')
      .where('c.tripId = :tripId', { tripId })
      .getRawMany();

    const validUserIds = new Set<string>([
      trip.userId,
      ...collaborators.map((c: { userId: string }) => c.userId),
    ]);

    for (const uid of userIds) {
      if (!validUserIds.has(uid)) {
        throw new BadRequestException(
          `User ${uid} is not a participant of this trip`,
        );
      }
    }
  }

  /**
   * Create a new expense with splits
   */
  async create(
    tripId: string,
    userId: string,
    dto: CreateExpenseDto,
  ): Promise<Expense> {
    await this.verifyTripAccess(tripId, userId);

    // Validate all referenced users are trip participants
    const allUserIds = [dto.paidByUserId, ...dto.splits.map((s) => s.userId)];
    const uniqueUserIds = [...new Set(allUserIds)];
    await this.verifyTripParticipants(tripId, uniqueUserIds);

    // Calculate split amounts
    const splitMethod = dto.splitMethod || SplitMethod.EQUAL;
    const splitEntries = this.calculateSplits(
      dto.amount,
      dto.splits,
      splitMethod,
    );

    // Create expense entity
    const expense = this.expenseRepository.create({
      tripId,
      paidByUserId: dto.paidByUserId,
      description: dto.description,
      amount: dto.amount,
      currency: dto.currency || 'USD',
      category: dto.category,
      splitMethod,
      date: dto.date,
      splits: splitEntries.map((entry) =>
        this.expenseSplitRepository.create({
          userId: entry.userId,
          amount: entry.amount,
          isSettled: false,
        }),
      ),
    });

    const saved = await this.expenseRepository.save(expense);

    this.logger.log(
      `Created expense ${saved.id} for trip ${tripId}: ${dto.description} (${dto.amount} ${dto.currency || 'USD'})`,
    );

    return this.findOne(tripId, saved.id, userId);
  }

  /**
   * Calculate split amounts based on split method
   */
  private calculateSplits(
    totalAmount: number,
    rawSplits: { userId: string; amount?: number }[],
    method: SplitMethod,
  ): { userId: string; amount: number }[] {
    // Deduplicate splits by userId to prevent double-counting
    const seen = new Set<string>();
    const splits = rawSplits.filter((s) => {
      if (seen.has(s.userId)) return false;
      seen.add(s.userId);
      return true;
    });

    if (method === SplitMethod.EQUAL) {
      const perPerson = Math.round((totalAmount / splits.length) * 100) / 100;
      // Handle rounding: give remainder to the first person
      const remainder =
        Math.round((totalAmount - perPerson * splits.length) * 100) / 100;

      return splits.map((s, index) => ({
        userId: s.userId,
        amount: index === 0 ? perPerson + remainder : perPerson,
      }));
    }

    // Exact method: validate that splits sum to total (using integer arithmetic)
    const splitTotalCents = splits.reduce(
      (sum, s) => sum + Math.round(Number(s.amount || 0) * 100),
      0,
    );
    const totalCents = Math.round(totalAmount * 100);

    if (Math.abs(splitTotalCents - totalCents) > 1) {
      // Allow 1 cent tolerance for rounding
      throw new BadRequestException(
        `Split amounts (${(splitTotalCents / 100).toFixed(2)}) do not match total amount (${(totalCents / 100).toFixed(2)})`,
      );
    }

    return splits.map((s) => ({
      userId: s.userId,
      amount: Number(s.amount || 0),
    }));
  }

  /**
   * Find all expenses for a trip
   */
  async findAll(tripId: string, userId: string): Promise<Expense[]> {
    await this.verifyTripAccess(tripId, userId);

    return this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoinAndSelect('expense.splits', 'split')
      .leftJoin('expense.paidBy', 'paidBy')
      .addSelect(['paidBy.id', 'paidBy.name', 'paidBy.profileImage'])
      .leftJoin('split.user', 'splitUser')
      .addSelect(['splitUser.id', 'splitUser.name', 'splitUser.profileImage'])
      .where('expense.tripId = :tripId', { tripId })
      .orderBy('expense.date', 'DESC')
      .addOrderBy('expense.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Find a single expense by ID
   */
  async findOne(
    tripId: string,
    expenseId: string,
    userId: string,
  ): Promise<Expense> {
    await this.verifyTripAccess(tripId, userId);

    const expense = await this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoinAndSelect('expense.splits', 'split')
      .leftJoin('expense.paidBy', 'paidBy')
      .addSelect(['paidBy.id', 'paidBy.name', 'paidBy.profileImage'])
      .leftJoin('split.user', 'splitUser')
      .addSelect(['splitUser.id', 'splitUser.name', 'splitUser.profileImage'])
      .where('expense.id = :expenseId AND expense.tripId = :tripId', {
        expenseId,
        tripId,
      })
      .getOne();

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return expense;
  }

  /**
   * Update an existing expense
   */
  async update(
    tripId: string,
    expenseId: string,
    userId: string,
    dto: UpdateExpenseDto,
  ): Promise<Expense> {
    await this.verifyTripAccess(tripId, userId);

    const expense = await this.expenseRepository.findOne({
      where: { id: expenseId, tripId },
      relations: ['splits'],
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    // If splits or amount are being updated, recalculate
    if (dto.splits || dto.amount !== undefined) {
      const newAmount =
        dto.amount !== undefined ? dto.amount : Number(expense.amount);
      const newSplits =
        dto.splits ||
        expense.splits.map((s) => ({
          userId: s.userId,
          amount: Number(s.amount),
        }));
      const newMethod = dto.splitMethod || expense.splitMethod;

      // Validate participants
      const allUserIds = [
        dto.paidByUserId || expense.paidByUserId,
        ...newSplits.map((s) => s.userId),
      ];
      const uniqueUserIds = [...new Set(allUserIds)];
      await this.verifyTripParticipants(tripId, uniqueUserIds);

      // Remove old splits
      await this.expenseSplitRepository.delete({ expenseId });

      // Calculate new splits
      const splitEntries = this.calculateSplits(
        newAmount,
        newSplits,
        newMethod,
      );

      // Create new splits
      const newSplitEntities = splitEntries.map((entry) =>
        this.expenseSplitRepository.create({
          expenseId,
          userId: entry.userId,
          amount: entry.amount,
          isSettled: false,
        }),
      );
      await this.expenseSplitRepository.save(newSplitEntities);
    }

    // Update expense fields (exclude splits from the update object)
    const { splits: _splits, ...updateFields } = dto;
    if (Object.keys(updateFields).length > 0) {
      await this.expenseRepository.update(expenseId, updateFields);
    }

    this.logger.log(`Updated expense ${expenseId} for trip ${tripId}`);

    return this.findOne(tripId, expenseId, userId);
  }

  /**
   * Delete an expense
   */
  async remove(
    tripId: string,
    expenseId: string,
    userId: string,
  ): Promise<void> {
    await this.verifyTripAccess(tripId, userId);

    const expense = await this.expenseRepository.findOne({
      where: { id: expenseId, tripId },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    await this.expenseRepository.remove(expense);

    this.logger.log(`Deleted expense ${expenseId} from trip ${tripId}`);
  }

  /**
   * Get balance summary for all participants in a trip.
   * Positive balance = others owe you, Negative balance = you owe others.
   */
  async getBalances(tripId: string, userId: string): Promise<BalanceEntry[]> {
    await this.verifyTripAccess(tripId, userId);

    const expenses = await this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoinAndSelect('expense.splits', 'split')
      .leftJoin('expense.paidBy', 'paidBy')
      .addSelect(['paidBy.id', 'paidBy.name', 'paidBy.profileImage'])
      .leftJoin('split.user', 'splitUser')
      .addSelect(['splitUser.id', 'splitUser.name', 'splitUser.profileImage'])
      .where('expense.tripId = :tripId', { tripId })
      .getMany();

    // Accumulate balances per user (only unsettled splits count)
    const balanceMap = new Map<string, { name: string; balance: number }>();

    for (const expense of expenses) {
      const payerId = expense.paidByUserId;
      const payerName = expense.paidBy?.name || 'Unknown';

      // Only count unsettled splits for balance calculation
      const unsettledSplits = expense.splits.filter((s) => !s.isSettled);
      const unsettledTotal = unsettledSplits.reduce(
        (sum, s) => sum + Number(s.amount),
        0,
      );

      // Payer gets +unsettledTotal (amount still owed to them)
      if (unsettledTotal > 0.01) {
        if (!balanceMap.has(payerId)) {
          balanceMap.set(payerId, { name: payerName, balance: 0 });
        }
        balanceMap.get(payerId)!.balance += unsettledTotal;
      }

      // Each unsettled split participant gets -splitAmount (they still owe)
      for (const split of unsettledSplits) {
        const splitUserId = split.userId;
        const splitUserName = split.user?.name || 'Unknown';
        const splitAmount = Number(split.amount);

        // Skip payer's own split — payer doesn't owe themselves
        if (splitUserId === payerId) continue;

        if (!balanceMap.has(splitUserId)) {
          balanceMap.set(splitUserId, { name: splitUserName, balance: 0 });
        }
        balanceMap.get(splitUserId)!.balance -= splitAmount;
      }
    }

    // Convert to array and sort by balance descending
    const balances: BalanceEntry[] = Array.from(balanceMap.entries())
      .map(([uid, data]) => ({
        userId: uid,
        userName: data.name,
        balance: Math.round(data.balance * 100) / 100,
      }))
      .sort((a, b) => b.balance - a.balance);

    return balances;
  }

  /**
   * Calculate minimum transactions to settle all debts.
   * Uses a greedy algorithm: match largest debtor with largest creditor.
   */
  async getSettlements(
    tripId: string,
    userId: string,
  ): Promise<SettlementEntry[]> {
    const balances = await this.getBalances(tripId, userId);

    // Separate creditors (positive balance) and debtors (negative balance)
    const creditors = balances
      .filter((b) => b.balance > 0.01)
      .map((b) => ({ ...b }))
      .sort((a, b) => b.balance - a.balance);

    const debtors = balances
      .filter((b) => b.balance < -0.01)
      .map((b) => ({ ...b, balance: Math.abs(b.balance) }))
      .sort((a, b) => b.balance - a.balance);

    const settlements: SettlementEntry[] = [];

    let ci = 0;
    let di = 0;

    while (ci < creditors.length && di < debtors.length) {
      const creditor = creditors[ci];
      const debtor = debtors[di];

      const transferAmount =
        Math.round(Math.min(creditor.balance, debtor.balance) * 100) / 100;

      if (transferAmount > 0.01) {
        settlements.push({
          fromUserId: debtor.userId,
          fromUserName: debtor.userName,
          toUserId: creditor.userId,
          toUserName: creditor.userName,
          amount: transferAmount,
        });
      }

      creditor.balance =
        Math.round((creditor.balance - transferAmount) * 100) / 100;
      debtor.balance =
        Math.round((debtor.balance - transferAmount) * 100) / 100;

      if (creditor.balance < 0.01) ci++;
      if (debtor.balance < 0.01) di++;
    }

    return settlements;
  }

  /**
   * Mark a specific split as settled for the current user
   */
  async settleUp(
    tripId: string,
    expenseId: string,
    userId: string,
  ): Promise<ExpenseSplit> {
    await this.verifyTripAccess(tripId, userId);

    const expense = await this.expenseRepository.findOne({
      where: { id: expenseId, tripId },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    const split = await this.expenseSplitRepository.findOne({
      where: { expenseId, userId },
    });

    if (!split) {
      throw new NotFoundException(
        'No split found for this user on this expense',
      );
    }

    if (split.isSettled) {
      throw new BadRequestException('This split is already settled');
    }

    split.isSettled = true;
    const saved = await this.expenseSplitRepository.save(split);

    this.logger.log(
      `User ${userId} settled split ${split.id} on expense ${expenseId}`,
    );

    return saved;
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Controller('trips/:tripId/expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  async create(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.create(tripId, userId, dto);
  }

  @Get()
  async findAll(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.expensesService.findAll(tripId, userId);
  }

  @Get('balances')
  async getBalances(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.expensesService.getBalances(tripId, userId);
  }

  @Get('settlements')
  async getSettlements(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.expensesService.getSettlements(tripId, userId);
  }

  @Get(':expenseId')
  async findOne(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.expensesService.findOne(tripId, expenseId, userId);
  }

  @Patch(':expenseId')
  async update(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(tripId, expenseId, userId, dto);
  }

  @Delete(':expenseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.expensesService.remove(tripId, expenseId, userId);
  }

  @Post(':expenseId/settle')
  async settleUp(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.expensesService.settleUp(tripId, expenseId, userId);
  }
}

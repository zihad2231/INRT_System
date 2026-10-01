import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { CreateExpenseDto } from './dto/create-expense.dto.js';
import { CreateFundDto } from './dto/create-fund.dto.js';
import { ListExpensesDto } from './dto/list-expenses.dto.js';
import { ListFundsDto } from './dto/list-funds.dto.js';
import { ListTransactionsDto } from './dto/list-transactions.dto.js';
import { UpdateExpenseDto } from './dto/update-expense.dto.js';
import { UpdateFundDto } from './dto/update-fund.dto.js';
import { FinanceService } from './finance.service.js';

@Controller('finance')
@UseGuards(SessionAuthGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('summary')
  async getSummary(@Req() request: AuthenticatedRequest) {
    return { success: true, data: await this.finance.getFinancialSummary(request.user) };
  }

  @Get('transactions')
  async listTransactions(@Req() request: AuthenticatedRequest, @Query() query: ListTransactionsDto) {
    return { success: true, data: await this.finance.listUnifiedTransactions(request.user, query) };
  }

  @Get('code-generator')
  async generateCode(
    @Req() request: AuthenticatedRequest,
    @Query('type') type?: string,
  ) {
    const prefix = type === 'EXPENSE' ? 'EXP' : 'FND';
    return {
      success: true,
      data: { code: await this.finance.generateTransactionCode(request.user.organizationId, prefix) },
    };
  }

  // --- FUNDS ---

  @Get('funds')
  async listFunds(@Req() request: AuthenticatedRequest, @Query() query: ListFundsDto) {
    return { success: true, data: await this.finance.listFunds(request.user, query) };
  }

  @Post('funds')
  async createFund(@Req() request: AuthenticatedRequest, @Body() dto: CreateFundDto) {
    return { success: true, data: await this.finance.createFund(request.user, dto) };
  }

  @Patch('funds/:id')
  async updateFund(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFundDto,
  ) {
    return { success: true, data: await this.finance.updateFund(request.user, id, dto) };
  }

  @Patch('funds/:id/void')
  async voidFund(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.finance.voidFund(request.user, id) };
  }

  // --- EXPENSES ---

  @Get('expenses')
  async listExpenses(@Req() request: AuthenticatedRequest, @Query() query: ListExpensesDto) {
    return { success: true, data: await this.finance.listExpenses(request.user, query) };
  }

  @Post('expenses')
  async createExpense(@Req() request: AuthenticatedRequest, @Body() dto: CreateExpenseDto) {
    return { success: true, data: await this.finance.createExpense(request.user, dto) };
  }

  @Patch('expenses/:id')
  async updateExpense(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return { success: true, data: await this.finance.updateExpense(request.user, id, dto) };
  }

  @Patch('expenses/:id/void')
  async voidExpense(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.finance.voidExpense(request.user, id) };
  }
}

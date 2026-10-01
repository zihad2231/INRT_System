import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  ExpenseCategory,
  Prisma,
  TransactionStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateExpenseDto } from './dto/create-expense.dto.js';
import type { CreateFundDto } from './dto/create-fund.dto.js';
import type { ListExpensesDto } from './dto/list-expenses.dto.js';
import type { ListFundsDto } from './dto/list-funds.dto.js';
import type { ListTransactionsDto } from './dto/list-transactions.dto.js';
import type { UpdateExpenseDto } from './dto/update-expense.dto.js';
import type { UpdateFundDto } from './dto/update-fund.dto.js';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private requireAdmin(actor: AuthenticatedUser) {
    const isAdmin =
      actor.roles.some((r) => ['SUPER_ADMIN', 'ADMIN'].includes(r)) ||
      actor.permissions.includes('FINANCE_MANAGE');
    if (!isAdmin) {
      throw new ForbiddenException({
        code: 'FINANCE_MANAGE_NOT_ALLOWED',
        message: 'Only admins have financial control access.',
      });
    }
  }

  async generateTransactionCode(organizationId: string, prefix: string): Promise<string> {
    const cleanPrefix = prefix.toUpperCase().slice(0, 3);
    let maxNum = 0;

    if (cleanPrefix === 'FND') {
      const existing = await this.prisma.fund.findMany({
        where: { organizationId, fundCode: { startsWith: cleanPrefix, mode: 'insensitive' } },
        select: { fundCode: true },
      });
      const regex = new RegExp(`^${cleanPrefix}(\\d+)$`, 'i');
      for (const item of existing) {
        const match = item.fundCode.match(regex);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    } else {
      const existing = await this.prisma.expense.findMany({
        where: { organizationId, expenseCode: { startsWith: cleanPrefix, mode: 'insensitive' } },
        select: { expenseCode: true },
      });
      const regex = new RegExp(`^${cleanPrefix}(\\d+)$`, 'i');
      for (const item of existing) {
        const match = item.expenseCode.match(regex);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }

    const nextNum = maxNum + 1;
    const padded = String(nextNum).padStart(3, '0');
    return `${cleanPrefix}${padded}`;
  }

  async getFinancialSummary(actor: AuthenticatedUser) {
    const orgId = actor.organizationId;

    const [fundAggregate, expenseAggregate, fundCount, expenseCount, categoryAggregates, projectExpensesRaw] =
      await Promise.all([
        this.prisma.fund.aggregate({
          where: { organizationId: orgId, status: TransactionStatus.VALID, deletedAt: null },
          _sum: { amount: true },
        }),
        this.prisma.expense.aggregate({
          where: { organizationId: orgId, status: TransactionStatus.VALID, deletedAt: null },
          _sum: { amount: true },
        }),
        this.prisma.fund.count({
          where: { organizationId: orgId, status: TransactionStatus.VALID, deletedAt: null },
        }),
        this.prisma.expense.count({
          where: { organizationId: orgId, status: TransactionStatus.VALID, deletedAt: null },
        }),
        this.prisma.expense.groupBy({
          by: ['category'],
          where: { organizationId: orgId, status: TransactionStatus.VALID, deletedAt: null },
          _sum: { amount: true },
          _count: { id: true },
        }),
        this.prisma.expense.groupBy({
          by: ['projectId'],
          where: {
            organizationId: orgId,
            status: TransactionStatus.VALID,
            deletedAt: null,
            projectId: { not: null },
          },
          _sum: { amount: true },
          _count: { id: true },
        }),
      ]);

    const totalFund = Number(fundAggregate._sum.amount ?? 0);
    const totalExpense = Number(expenseAggregate._sum.amount ?? 0);
    const currentBalance = totalFund - totalExpense;

    // Fetch project details for project-wise expenses
    const projectIds = projectExpensesRaw
      .map((p) => p.projectId)
      .filter((id): id is string => Boolean(id));

    const projects = projectIds.length
      ? await this.prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, projectCode: true, title: true },
        })
      : [];

    const projectMap = new Map(projects.map((p) => [p.id, p]));

    const projectExpenses = projectExpensesRaw.map((p) => ({
      projectId: p.projectId,
      project: p.projectId ? projectMap.get(p.projectId) ?? null : null,
      totalSpent: Number(p._sum.amount ?? 0),
      count: p._count.id,
    }));

    const categoryBreakdown = categoryAggregates.map((cat) => ({
      category: cat.category,
      totalSpent: Number(cat._sum.amount ?? 0),
      count: cat._count.id,
    }));

    return {
      totalFund,
      totalExpense,
      currentBalance,
      fundCount,
      expenseCount,
      categoryBreakdown,
      projectExpenses,
    };
  }

  // --- FUND METHODS ---

  async listFunds(actor: AuthenticatedUser, query: ListFundsDto) {
    const where: Prisma.FundWhereInput = {
      organizationId: actor.organizationId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { fundCode: { contains: query.search, mode: 'insensitive' } },
              { contributorName: { contains: query.search, mode: 'insensitive' } },
              { purpose: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.startDate || query.endDate
        ? {
            date: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [data, total] = await Promise.all([
      this.prisma.fund.findMany({
        where,
        include: {
          contributorUser: { select: { id: true, memberCode: true, fullName: true } },
          creator: { select: { id: true, memberCode: true, fullName: true } },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.fund.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createFund(actor: AuthenticatedUser, dto: CreateFundDto) {
    this.requireAdmin(actor);

    let code = dto.fundCode?.trim();
    if (!code) {
      code = await this.generateTransactionCode(actor.organizationId, 'FND');
    } else {
      const exists = await this.prisma.fund.findFirst({
        where: { organizationId: actor.organizationId, fundCode: code, deletedAt: null },
      });
      if (exists) {
        throw new BadRequestException({
          code: 'FUND_CODE_EXISTS',
          message: `Fund code '${code}' already exists.`,
        });
      }
    }

    const fund = await this.prisma.fund.create({
      data: {
        organizationId: actor.organizationId,
        fundCode: code,
        contributorName: dto.contributorName.trim(),
        contributorUserId: dto.contributorUserId || null,
        amount: dto.amount,
        date: new Date(dto.date),
        purpose: dto.purpose.trim(),
        paymentMethod: dto.paymentMethod?.trim() || 'CASH',
        receiptUrl: dto.receiptUrl?.trim() || null,
        notes: dto.notes?.trim() || null,
        status: TransactionStatus.VALID,
        createdBy: actor.id,
      },
      include: {
        contributorUser: { select: { id: true, memberCode: true, fullName: true } },
        creator: { select: { id: true, memberCode: true, fullName: true } },
      },
    });

    await this.audit.log({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.CREATE,
      entity: 'Fund',
      entityId: fund.id,
      newValue: fund,
    });

    return fund;
  }

  async updateFund(actor: AuthenticatedUser, id: string, dto: UpdateFundDto) {
    this.requireAdmin(actor);

    const existing = await this.prisma.fund.findFirst({
      where: { id, organizationId: actor.organizationId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException({ code: 'FUND_NOT_FOUND', message: 'Fund record was not found.' });
    }

    const updated = await this.prisma.fund.update({
      where: { id },
      data: {
        contributorName: dto.contributorName?.trim() ?? existing.contributorName,
        contributorUserId: dto.contributorUserId !== undefined ? dto.contributorUserId : existing.contributorUserId,
        amount: dto.amount ?? existing.amount,
        date: dto.date ? new Date(dto.date) : existing.date,
        purpose: dto.purpose?.trim() ?? existing.purpose,
        paymentMethod: dto.paymentMethod?.trim() ?? existing.paymentMethod,
        receiptUrl: dto.receiptUrl !== undefined ? dto.receiptUrl?.trim() || null : existing.receiptUrl,
        notes: dto.notes !== undefined ? dto.notes?.trim() || null : existing.notes,
      },
      include: {
        contributorUser: { select: { id: true, memberCode: true, fullName: true } },
        creator: { select: { id: true, memberCode: true, fullName: true } },
      },
    });

    await this.audit.log({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.UPDATE,
      entity: 'Fund',
      entityId: id,
      oldValue: existing,
      newValue: updated,
    });

    return updated;
  }

  async voidFund(actor: AuthenticatedUser, id: string) {
    this.requireAdmin(actor);

    const existing = await this.prisma.fund.findFirst({
      where: { id, organizationId: actor.organizationId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException({ code: 'FUND_NOT_FOUND', message: 'Fund record was not found.' });
    }

    const updated = await this.prisma.fund.update({
      where: { id },
      data: { status: TransactionStatus.VOIDED },
    });

    await this.audit.log({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.UPDATE,
      entity: 'Fund',
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: TransactionStatus.VOIDED },
    });

    return updated;
  }

  // --- EXPENSE METHODS ---

  async listExpenses(actor: AuthenticatedUser, query: ListExpensesDto) {
    const where: Prisma.ExpenseWhereInput = {
      organizationId: actor.organizationId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.search
        ? {
            OR: [
              { expenseCode: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
              { vendor: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.startDate || query.endDate
        ? {
            date: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: {
          project: { select: { id: true, projectCode: true, title: true } },
          creator: { select: { id: true, memberCode: true, fullName: true } },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createExpense(actor: AuthenticatedUser, dto: CreateExpenseDto) {
    this.requireAdmin(actor);

    if (dto.projectId) {
      const proj = await this.prisma.project.findFirst({
        where: { id: dto.projectId, organizationId: actor.organizationId, deletedAt: null },
      });
      if (!proj) {
        throw new BadRequestException({ code: 'PROJECT_NOT_FOUND', message: 'Project was not found.' });
      }
    }

    let code = dto.expenseCode?.trim();
    if (!code) {
      code = await this.generateTransactionCode(actor.organizationId, 'EXP');
    } else {
      const exists = await this.prisma.expense.findFirst({
        where: { organizationId: actor.organizationId, expenseCode: code, deletedAt: null },
      });
      if (exists) {
        throw new BadRequestException({
          code: 'EXPENSE_CODE_EXISTS',
          message: `Expense code '${code}' already exists.`,
        });
      }
    }

    const expense = await this.prisma.expense.create({
      data: {
        organizationId: actor.organizationId,
        expenseCode: code,
        title: dto.title.trim(),
        category: dto.category ?? ExpenseCategory.MISCELLANEOUS,
        amount: dto.amount,
        date: new Date(dto.date),
        projectId: dto.projectId || null,
        vendor: dto.vendor?.trim() || null,
        receiptUrl: dto.receiptUrl?.trim() || null,
        description: dto.description?.trim() || null,
        status: TransactionStatus.VALID,
        createdBy: actor.id,
      },
      include: {
        project: { select: { id: true, projectCode: true, title: true } },
        creator: { select: { id: true, memberCode: true, fullName: true } },
      },
    });

    await this.audit.log({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.CREATE,
      entity: 'Expense',
      entityId: expense.id,
      newValue: expense,
    });

    return expense;
  }

  async updateExpense(actor: AuthenticatedUser, id: string, dto: UpdateExpenseDto) {
    this.requireAdmin(actor);

    const existing = await this.prisma.expense.findFirst({
      where: { id, organizationId: actor.organizationId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException({ code: 'EXPENSE_NOT_FOUND', message: 'Expense record was not found.' });
    }

    if (dto.projectId) {
      const proj = await this.prisma.project.findFirst({
        where: { id: dto.projectId, organizationId: actor.organizationId, deletedAt: null },
      });
      if (!proj) {
        throw new BadRequestException({ code: 'PROJECT_NOT_FOUND', message: 'Project was not found.' });
      }
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        title: dto.title?.trim() ?? existing.title,
        category: dto.category ?? existing.category,
        amount: dto.amount ?? existing.amount,
        date: dto.date ? new Date(dto.date) : existing.date,
        projectId: dto.projectId !== undefined ? dto.projectId : existing.projectId,
        vendor: dto.vendor !== undefined ? dto.vendor?.trim() || null : existing.vendor,
        receiptUrl: dto.receiptUrl !== undefined ? dto.receiptUrl?.trim() || null : existing.receiptUrl,
        description: dto.description !== undefined ? dto.description?.trim() || null : existing.description,
      },
      include: {
        project: { select: { id: true, projectCode: true, title: true } },
        creator: { select: { id: true, memberCode: true, fullName: true } },
      },
    });

    await this.audit.log({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.UPDATE,
      entity: 'Expense',
      entityId: id,
      oldValue: existing,
      newValue: updated,
    });

    return updated;
  }

  async voidExpense(actor: AuthenticatedUser, id: string) {
    this.requireAdmin(actor);

    const existing = await this.prisma.expense.findFirst({
      where: { id, organizationId: actor.organizationId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException({ code: 'EXPENSE_NOT_FOUND', message: 'Expense record was not found.' });
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: { status: TransactionStatus.VOIDED },
    });

    await this.audit.log({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.UPDATE,
      entity: 'Expense',
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: TransactionStatus.VOIDED },
    });

    return updated;
  }

  // --- UNIFIED TRANSACTIONS LOG ---

  async listUnifiedTransactions(actor: AuthenticatedUser, query: ListTransactionsDto) {
    const orgId = actor.organizationId;
    const fetchFunds = !query.type || query.type === 'ALL' || query.type === 'FUND';
    const fetchExpenses = !query.type || query.type === 'ALL' || query.type === 'EXPENSE';

    const [funds, expenses] = await Promise.all([
      fetchFunds
        ? this.prisma.fund.findMany({
            where: {
              organizationId: orgId,
              deletedAt: null,
              ...(query.status ? { status: query.status } : {}),
              ...(query.search
                ? {
                    OR: [
                      { fundCode: { contains: query.search, mode: 'insensitive' } },
                      { contributorName: { contains: query.search, mode: 'insensitive' } },
                      { purpose: { contains: query.search, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
            include: { creator: { select: { fullName: true } } },
          })
        : Promise.resolve([]),
      fetchExpenses
        ? this.prisma.expense.findMany({
            where: {
              organizationId: orgId,
              deletedAt: null,
              ...(query.status ? { status: query.status } : {}),
              ...(query.search
                ? {
                    OR: [
                      { expenseCode: { contains: query.search, mode: 'insensitive' } },
                      { title: { contains: query.search, mode: 'insensitive' } },
                      { vendor: { contains: query.search, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
            include: { project: { select: { title: true } }, creator: { select: { fullName: true } } },
          })
        : Promise.resolve([]),
    ]);

    const formattedFunds = funds.map((f) => ({
      id: f.id,
      code: f.fundCode,
      type: 'FUND' as const,
      title: `${f.contributorName} — ${f.purpose}`,
      category: f.paymentMethod,
      amount: Number(f.amount),
      date: f.date,
      status: f.status,
      receiptUrl: f.receiptUrl,
      notes: f.notes,
      creatorName: f.creator.fullName,
    }));

    const formattedExpenses = expenses.map((e) => ({
      id: e.id,
      code: e.expenseCode,
      type: 'EXPENSE' as const,
      title: `${e.title}${e.vendor ? ` (${e.vendor})` : ''}`,
      category: e.category,
      amount: Number(e.amount),
      date: e.date,
      status: e.status,
      receiptUrl: e.receiptUrl,
      notes: e.description,
      projectTitle: e.project?.title,
      creatorName: e.creator.fullName,
    }));

    const combined = [...formattedFunds, ...formattedExpenses].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const paginated = combined.slice((page - 1) * limit, page * limit);

    return {
      data: paginated,
      meta: {
        page,
        limit,
        total: combined.length,
        totalPages: Math.ceil(combined.length / limit),
      },
    };
  }
}

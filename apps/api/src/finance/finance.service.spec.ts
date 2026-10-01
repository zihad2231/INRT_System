import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExpenseCategory, TransactionStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { FinanceService } from './finance.service.js';

const mockAdminUser: AuthenticatedUser = {
  id: 'admin-user-id',
  organizationId: 'org-1',
  memberCode: 'ADM-001',
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'Manager',
  fullName: 'Admin Financial Manager',
  profileImageUrl: null,
  bio: null,
  phone: null,
  roles: ['ADMIN'],
  permissions: ['FINANCE_MANAGE'],
  organization: { id: 'org-1', name: 'Test Org', slug: 'test-org', logoUrl: null },
  skills: [],
  researchAreas: [],
};

const mockRegularUser: AuthenticatedUser = {
  id: 'regular-user-id',
  organizationId: 'org-1',
  memberCode: 'USR-001',
  email: 'user@example.com',
  firstName: 'Regular',
  lastName: 'Member',
  fullName: 'Regular Member',
  profileImageUrl: null,
  bio: null,
  phone: null,
  roles: ['MEMBER'],
  permissions: [],
  organization: { id: 'org-1', name: 'Test Org', slug: 'test-org', logoUrl: null },
  skills: [],
  researchAreas: [],
};

describe('FinanceService', () => {
  let service: FinanceService;
  let prisma: any;
  let audit: any;
  let notifications: any;

  beforeEach(() => {
    prisma = {
      fund: {
        aggregate: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      expense: {
        aggregate: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      project: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
      },
    };

    audit = {
      log: vi.fn().mockResolvedValue(true),
    };

    notifications = {
      createNotification: vi.fn().mockResolvedValue(true),
    };

    service = new FinanceService(prisma as any, audit as any, notifications as any);
  });

  describe('Authorization', () => {
    it('should throw ForbiddenException if regular user attempts admin actions', async () => {
      await expect(
        service.createFund(mockRegularUser, {
          contributorName: 'Sponsor X',
          amount: 5000,
          date: '2026-10-01',
          purpose: 'Lab Sponsorship',
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.createExpense(mockRegularUser, {
          title: 'Component purchase',
          amount: 1200,
          date: '2026-10-01',
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(service.voidFund(mockRegularUser, 'fund-1')).rejects.toThrow(ForbiddenException);
      await expect(service.voidExpense(mockRegularUser, 'exp-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Financial Calculations', () => {
    it('should correctly calculate current balance as totalFund - totalExpense', async () => {
      prisma.fund.aggregate.mockResolvedValue({ _sum: { amount: 150000.5 } });
      prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 45000.25 } });
      prisma.fund.count.mockResolvedValue(5);
      prisma.expense.count.mockResolvedValue(12);
      prisma.expense.groupBy
        .mockResolvedValueOnce([
          { category: 'HARDWARE', _sum: { amount: 30000 }, _count: { id: 8 } },
          { category: 'COMPONENTS', _sum: { amount: 15000.25 }, _count: { id: 4 } },
        ])
        .mockResolvedValueOnce([
          { projectId: 'proj-1', _sum: { amount: 20000 }, _count: { id: 5 } },
        ]);

      prisma.project.findMany.mockResolvedValue([
        { id: 'proj-1', projectCode: 'PRJ001', title: 'Autonomous Rover' },
      ]);

      const summary = await service.getFinancialSummary(mockAdminUser);

      expect(summary.totalFund).toBe(150000.5);
      expect(summary.totalExpense).toBe(45000.25);
      expect(summary.currentBalance).toBe(105000.25);
      expect(summary.fundCount).toBe(5);
      expect(summary.expenseCount).toBe(12);
      expect(summary.categoryBreakdown).toHaveLength(2);
      expect(summary.projectExpenses).toHaveLength(1);
      expect(summary.projectExpenses[0].project?.projectCode).toBe('PRJ001');
    });
  });

  describe('Transaction Code Generation', () => {
    it('should generate FND001 when no previous funds exist', async () => {
      prisma.fund.findMany.mockResolvedValue([]);
      const code = await service.generateTransactionCode('org-1', 'FND');
      expect(code).toBe('FND001');
    });

    it('should increment maximum code when funds exist', async () => {
      prisma.fund.findMany.mockResolvedValue([
        { fundCode: 'FND001' },
        { fundCode: 'FND005' },
        { fundCode: 'FND002' },
      ]);
      const code = await service.generateTransactionCode('org-1', 'FND');
      expect(code).toBe('FND006');
    });

    it('should generate EXP001 for expenses correctly', async () => {
      prisma.expense.findMany.mockResolvedValue([{ expenseCode: 'EXP001' }]);
      const code = await service.generateTransactionCode('org-1', 'EXP');
      expect(code).toBe('EXP002');
    });
  });

  describe('Fund Operations', () => {
    it('should create a new fund and log audit event when called by admin', async () => {
      prisma.fund.findFirst.mockResolvedValue(null);
      prisma.fund.create.mockResolvedValue({
        id: 'fund-100',
        fundCode: 'FND001',
        contributorName: 'Alumni Association',
        amount: 25000,
        status: TransactionStatus.VALID,
      });

      const fund = await service.createFund(mockAdminUser, {
        contributorName: 'Alumni Association',
        amount: 25000,
        date: '2026-10-01',
        purpose: 'Annual Grant',
      });

      expect(fund.fundCode).toBe('FND001');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          entity: 'Fund',
          entityId: 'fund-100',
        }),
      );
    });

    it('should throw BadRequestException if explicit fund code already exists', async () => {
      prisma.fund.findFirst.mockResolvedValue({ id: 'existing-fund' });

      await expect(
        service.createFund(mockAdminUser, {
          fundCode: 'FND001',
          contributorName: 'Donor B',
          amount: 5000,
          date: '2026-10-01',
          purpose: 'Donation',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should void a fund transaction and audit the status update', async () => {
      prisma.fund.findFirst.mockResolvedValue({
        id: 'fund-1',
        organizationId: 'org-1',
        status: TransactionStatus.VALID,
      });
      prisma.fund.update.mockResolvedValue({
        id: 'fund-1',
        status: TransactionStatus.VOIDED,
      });

      const result = await service.voidFund(mockAdminUser, 'fund-1');

      expect(result.status).toBe(TransactionStatus.VOIDED);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          entity: 'Fund',
          entityId: 'fund-1',
          newValue: { status: TransactionStatus.VOIDED },
        }),
      );
    });
  });

  describe('Expense Operations', () => {
    it('should create an expense linked to a project', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1', title: 'Rover Project' });
      prisma.expense.findFirst.mockResolvedValue(null);
      prisma.expense.create.mockResolvedValue({
        id: 'exp-50',
        expenseCode: 'EXP001',
        title: 'Sensor Kit',
        amount: 1500,
        projectId: 'proj-1',
        status: TransactionStatus.VALID,
      });

      const expense = await service.createExpense(mockAdminUser, {
        title: 'Sensor Kit',
        amount: 1500,
        date: '2026-10-01',
        projectId: 'proj-1',
        category: ExpenseCategory.COMPONENT_PURCHASE,
      });

      expect(expense.expenseCode).toBe('EXP001');
      expect(expense.projectId).toBe('proj-1');
      expect(audit.log).toHaveBeenCalled();
    });

    it('should throw BadRequestException if referenced project does not exist', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.createExpense(mockAdminUser, {
          title: 'Sensor Kit',
          amount: 1500,
          date: '2026-10-01',
          projectId: 'invalid-proj-id',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should void an expense transaction', async () => {
      prisma.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        organizationId: 'org-1',
        status: TransactionStatus.VALID,
      });
      prisma.expense.update.mockResolvedValue({
        id: 'exp-1',
        status: TransactionStatus.VOIDED,
      });

      const result = await service.voidExpense(mockAdminUser, 'exp-1');
      expect(result.status).toBe(TransactionStatus.VOIDED);
    });
  });

  describe('Unified Transaction Timeline', () => {
    it('should merge funds and expenses into a unified ledger view', async () => {
      prisma.fund.findMany.mockResolvedValue([
        {
          id: 'f-1',
          fundCode: 'FND001',
          contributorName: 'Grant',
          purpose: 'Research',
          paymentMethod: 'BANK_TRANSFER',
          amount: 10000,
          date: new Date('2026-09-01'),
          status: TransactionStatus.VALID,
          receiptUrl: null,
          notes: 'Approved',
          creator: { fullName: 'Admin' },
        },
      ]);

      prisma.expense.findMany.mockResolvedValue([
        {
          id: 'e-1',
          expenseCode: 'EXP001',
          title: 'Raspberry Pi 5',
          vendor: 'TechShop',
          category: 'HARDWARE',
          amount: 8000,
          date: new Date('2026-09-05'),
          status: TransactionStatus.VALID,
          receiptUrl: 'https://i.ibb.co/xyz/receipt.jpg',
          description: 'Project hardware',
          project: { title: 'AI Assistant' },
          creator: { fullName: 'Admin' },
        },
      ]);

      const result = await service.listUnifiedTransactions(mockAdminUser, { type: 'ALL' });

      expect(result.data).toHaveLength(2);
      const fundItem = result.data.find((item) => item.type === 'FUND');
      const expenseItem = result.data.find((item) => item.type === 'EXPENSE');

      expect(fundItem?.code).toBe('FND001');
      expect(fundItem?.amount).toBe(10000);

      expect(expenseItem?.code).toBe('EXP001');
      expect(expenseItem?.amount).toBe(8000);
      expect(expenseItem?.projectTitle).toBe('AI Assistant');
    });
  });
});

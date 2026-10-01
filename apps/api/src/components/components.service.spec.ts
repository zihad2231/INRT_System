import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ComponentAllocationStatus, ComponentRequestStatus, ComponentStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { ComponentsService } from './components.service.js';

const mockAdminUser: AuthenticatedUser = {
  id: 'admin-user-id',
  organizationId: 'org-1',
  memberCode: 'ADM-001',
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
  fullName: 'Admin User',
  profileImageUrl: null,
  bio: null,
  phone: null,
  roles: ['ADMIN'],
  permissions: ['COMPONENT_MANAGE'],
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
  lastName: 'User',
  fullName: 'Regular User',
  profileImageUrl: null,
  bio: null,
  phone: null,
  roles: ['MEMBER'],
  permissions: [],
  organization: { id: 'org-1', name: 'Test Org', slug: 'test-org', logoUrl: null },
  skills: [],
  researchAreas: [],
};

describe('ComponentsService', () => {
  let service: ComponentsService;
  let prisma: any;
  let audit: any;
  let notifications: any;

  beforeEach(() => {
    prisma = {
      component: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      componentRequest: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      componentAllocation: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      project: {
        findFirst: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(prisma)),
    };

    audit = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    notifications = {
      create: vi.fn().mockResolvedValue(undefined),
    };

    service = new ComponentsService(prisma, audit, notifications);
  });

  it('allows Admin to create component with Total = Available', async () => {
    prisma.component.findFirst.mockResolvedValue(null);
    prisma.component.create.mockResolvedValue({
      id: 'comp-1',
      organizationId: 'org-1',
      componentCode: 'ESP32-01',
      name: 'ESP32 Microcontroller',
      category: 'Electronics',
      totalQuantity: 10,
      availableQuantity: 10,
      allocatedQuantity: 0,
      status: ComponentStatus.AVAILABLE,
    });

    const result = await service.createComponent(mockAdminUser, {
      componentCode: 'ESP32-01',
      name: 'ESP32 Microcontroller',
      category: 'Electronics',
      totalQuantity: 10,
    });

    expect(result.totalQuantity).toBe(10);
    expect(result.availableQuantity).toBe(10);
    expect(result.allocatedQuantity).toBe(0);
    expect(audit.log).toHaveBeenCalled();
  });

  it('prevents regular users from creating components', async () => {
    await expect(
      service.createComponent(mockRegularUser, {
        componentCode: 'ESP32-01',
        name: 'ESP32 Microcontroller',
        category: 'Electronics',
        totalQuantity: 10,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows user to submit component request', async () => {
    prisma.component.findFirst.mockResolvedValue({
      id: 'comp-1',
      organizationId: 'org-1',
      name: 'ESP32',
      availableQuantity: 5,
    });

    prisma.componentRequest.create.mockResolvedValue({
      id: 'req-1',
      componentId: 'comp-1',
      requestedBy: mockRegularUser.id,
      requestedQuantity: 2,
      status: ComponentRequestStatus.PENDING,
    });

    const result = await service.createRequest(mockRegularUser, {
      componentId: 'comp-1',
      requestedQuantity: 2,
      purpose: 'IoT Experiment',
    });

    expect(result.requestedQuantity).toBe(2);
    expect(result.status).toBe(ComponentRequestStatus.PENDING);
  });

  it('approves request and updates inventory preserving Total = Available + Allocated', async () => {
    prisma.componentRequest.findFirst.mockResolvedValue({
      id: 'req-1',
      organizationId: 'org-1',
      componentId: 'comp-1',
      requestedBy: mockRegularUser.id,
      requestedQuantity: 3,
      status: ComponentRequestStatus.PENDING,
    });

    prisma.component.findFirst.mockResolvedValue({
      id: 'comp-1',
      totalQuantity: 10,
      availableQuantity: 10,
      allocatedQuantity: 0,
      status: ComponentStatus.AVAILABLE,
    });

    prisma.component.update.mockResolvedValue({});
    prisma.componentRequest.update.mockResolvedValue({ id: 'req-1', status: ComponentRequestStatus.APPROVED });
    prisma.componentAllocation.create.mockResolvedValue({ id: 'alloc-1', quantity: 3 });

    const result = await service.approveRequest(mockAdminUser, 'req-1', { comment: 'Approved for research' });

    expect(prisma.component.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          availableQuantity: 7,
          allocatedQuantity: 3,
          status: ComponentStatus.PARTIALLY_AVAILABLE,
        }),
      }),
    );
    expect(notifications.create).toHaveBeenCalled();
  });

  it('returns allocation and releases inventory', async () => {
    prisma.componentAllocation.findFirst.mockResolvedValue({
      id: 'alloc-1',
      organizationId: 'org-1',
      componentId: 'comp-1',
      userId: mockRegularUser.id,
      quantity: 3,
      status: ComponentAllocationStatus.ACTIVE,
      notes: 'Testing',
    });

    prisma.component.findFirst.mockResolvedValue({
      id: 'comp-1',
      totalQuantity: 10,
      availableQuantity: 7,
      allocatedQuantity: 3,
      status: ComponentStatus.PARTIALLY_AVAILABLE,
    });

    prisma.component.update.mockResolvedValue({});
    prisma.componentAllocation.update.mockResolvedValue({
      id: 'alloc-1',
      status: ComponentAllocationStatus.RETURNED,
    });

    const result = await service.returnAllocation(mockAdminUser, 'alloc-1', { notes: 'Returned in good condition' });

    expect(prisma.component.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          availableQuantity: 10,
          allocatedQuantity: 0,
          status: ComponentStatus.AVAILABLE,
        }),
      }),
    );
    expect(result.status).toBe(ComponentAllocationStatus.RETURNED);
  });
});

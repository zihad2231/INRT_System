import {
  PaperAssignmentStatus,
  ProjectPaperStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { PapersService } from './papers.service.js';

const member: AuthenticatedUser = {
  id: 'member-id',
  organizationId: 'org-a',
  memberCode: 'INT-000001',
  email: 'member@example.com',
  firstName: 'Research',
  lastName: 'Member',
  fullName: 'Research Member',
  profileImageUrl: null,
  bio: null,
  phone: null,
  organization: { id: 'org-a', name: 'Organization A', slug: 'org-a', logoUrl: null },
  roles: ['MEMBER'],
  permissions: ['PAPER_VIEW', 'PAPER_ASSIGN'],
  skills: [],
  researchAreas: [],
};

const makePrisma = () => ({
  project: { findFirst: vi.fn() },
  projectPaper: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
  },
  paper: { findFirst: vi.fn(), create: vi.fn() },
  paperIdentifier: { findFirst: vi.fn() },
  paperAssignment: { findFirst: vi.fn(), create: vi.fn() },
  paperAssignmentConflict: { create: vi.fn() },
  researchArea: { findFirst: vi.fn() },
  user: { findFirst: vi.fn() },
  $transaction: vi.fn(),
});

const visibleProject = (prisma: ReturnType<typeof makePrisma>) =>
  prisma.project.findFirst.mockResolvedValue({ id: 'project-id' });

describe('PapersService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let papersService: PapersService;

  beforeEach(() => {
    prisma = makePrisma();
    papersService = new PapersService(prisma as never);
    visibleProject(prisma);
  });

  it('normalizes paper title and DOI before the central registry lookup', async () => {
    prisma.paperIdentifier.findFirst.mockResolvedValue(null);
    prisma.paper.findFirst.mockResolvedValue(null);
    prisma.paper.create.mockResolvedValue({ id: 'paper-id', identifiers: [] });
    const tx = {
      paperAssignment: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
      projectPaper: { upsert: vi.fn().mockResolvedValue({ id: 'link-id' }) },
    };
    tx.paperAssignment.create.mockResolvedValue({ id: 'assignment-id' });
    prisma.$transaction.mockImplementation((callback) => callback(tx));

    await papersService.addToProject(member, 'project-id', {
      title: 'AI–Based Detection of Rice Disease!',
      identifiers: [{ type: 'doi', value: 'https://doi.org/10.1234/ABC.1' }],
    });

    expect(prisma.paper.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-a', normalizedTitle: 'ai based detection of rice disease' },
      }),
    );
    expect(prisma.paper.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          normalizedTitle: 'ai based detection of rice disease',
          doi: 'https://doi.org/10.1234/ABC.1',
        }),
      }),
    );
    expect(tx.projectPaper.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          projectId: 'project-id',
          paperId: 'paper-id',
          status: ProjectPaperStatus.ACTIVE,
        }),
      }),
    );
  });

  it('blocks a second primary reader and records the conflict after transaction rollback', async () => {
    prisma.paper.findFirst.mockResolvedValue({
      id: 'paper-id',
      title: 'Paper X',
      researchAreaId: null,
      identifiers: [],
    });
    const readerAssignment = {
      id: 'assignment-id',
      userId: 'other-member-id',
      status: PaperAssignmentStatus.READING,
      progressPercent: new Prisma.Decimal(64),
      startedAt: new Date('2026-09-01T00:00:00Z'),
      user: {
        id: 'other-member-id',
        memberCode: 'INT-000002',
        fullName: 'Current Reader',
        teamMemberships: [{ team: { id: 'team-id', name: 'AI Team', teamCode: 'AI' } }],
      },
    };
    const tx = {
      paperAssignment: { findFirst: vi.fn().mockResolvedValue(readerAssignment), create: vi.fn() },
      projectPaper: { upsert: vi.fn() },
      paperAssignmentConflict: { create: vi.fn() },
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    prisma.paperAssignment.findFirst.mockResolvedValue(readerAssignment);

    await expect(
      papersService.addToProject(member, 'project-id', { paperId: 'paper-id' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'PAPER_ALREADY_ASSIGNED',
        details: expect.objectContaining({
          memberId: 'INT-000002',
          name: 'Current Reader',
          progress: 64,
        }),
      }),
    });

    expect(tx.paperAssignmentConflict.create).not.toHaveBeenCalled();
    expect(prisma.paperAssignmentConflict.create).toHaveBeenCalledWith({
      data: {
        projectId: 'project-id',
        paperId: 'paper-id',
        requestedBy: 'member-id',
        existingAssignmentId: 'assignment-id',
        resolution: 'BLOCKED',
      },
    });
  });

  it('rejects papers outside the caller organization', async () => {
    prisma.paper.findFirst.mockResolvedValue(null);

    await expect(
      papersService.addToProject(member, 'project-id', { paperId: 'foreign-paper-id' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PAPER_NOT_FOUND' }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('validates assignment targets are active members of the current organization', async () => {
    prisma.projectPaper.findFirst.mockResolvedValue({ id: 'link-id' });
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      papersService.assignPrimaryReader(member, 'project-id', 'paper-id', 'foreign-user'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_ASSIGNMENT_USER' }),
    });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'foreign-user',
        organizationId: 'org-a',
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true },
    });
  });

  it('returns the existing assignment when the same primary reader is assigned again', async () => {
    prisma.projectPaper.findFirst.mockResolvedValue({ id: 'link-id' });
    prisma.user.findFirst.mockResolvedValue({ id: 'member-id' });
    const existing = {
      id: 'same-reader-assignment',
      userId: 'member-id',
      status: PaperAssignmentStatus.READING,
    };
    prisma.paperAssignment.findFirst.mockResolvedValue(existing);

    await expect(
      papersService.assignPrimaryReader(member, 'project-id', 'paper-id', 'member-id'),
    ).resolves.toBe(existing);
    expect(prisma.paperAssignment.create).not.toHaveBeenCalled();
    expect(prisma.paperAssignmentConflict.create).not.toHaveBeenCalled();
  });

  it('catches the database unique-index race when assigning a primary reader', async () => {
    prisma.projectPaper.findFirst.mockResolvedValue({ id: 'link-id' });
    prisma.user.findFirst.mockResolvedValue({ id: 'target-user' });
    prisma.paperAssignment.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prisma.paperAssignment.findFirst.mockResolvedValue({
      id: 'existing-assignment',
      userId: 'other-user',
      status: PaperAssignmentStatus.READING,
      progressPercent: new Prisma.Decimal(10),
      startedAt: null,
      user: {
        id: 'other-user',
        memberCode: 'INT-000003',
        fullName: 'Existing Reader',
        teamMemberships: [],
      },
    });

    await expect(
      papersService.assignPrimaryReader(member, 'project-id', 'paper-id', 'target-user'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PAPER_ALREADY_ASSIGNED' }),
    });
    expect(prisma.paperAssignmentConflict.create).toHaveBeenCalled();
  });
});

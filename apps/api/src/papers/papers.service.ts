import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaperAssignmentStatus,
  PaperAssignmentType,
  PaperConflictResolution,
  Prisma,
  ProjectPaperStatus,
  UserStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AddProjectPaperDto } from './dto/add-project-paper.dto.js';
import type { ListPapersDto } from './dto/list-papers.dto.js';

const ACTIVE_ASSIGNMENT_STATUSES: PaperAssignmentStatus[] = [
  PaperAssignmentStatus.ASSIGNED,
  PaperAssignmentStatus.READING,
  PaperAssignmentStatus.EXTRACTING,
  PaperAssignmentStatus.SUBMITTED,
  PaperAssignmentStatus.REVIEW,
  PaperAssignmentStatus.REVISION_REQUIRED,
  PaperAssignmentStatus.APPROVED,
];

const assignmentWithReader = {
  user: {
    select: {
      id: true,
      memberCode: true,
      fullName: true,
      teamMemberships: {
        where: { isActive: true },
        select: { team: { select: { id: true, name: true, teamCode: true } } },
      },
    },
  },
  assigner: { select: { id: true, fullName: true } },
} satisfies Prisma.PaperAssignmentInclude;

@Injectable()
export class PapersService {
  constructor(private readonly prisma: PrismaService) {}

  async listProjectPapers(
    actor: AuthenticatedUser,
    projectId: string,
    query: ListPapersDto,
  ) {
    await this.assertProjectVisible(actor, projectId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ProjectPaperWhereInput = {
      projectId,
      project: { organizationId: actor.organizationId },
    };

    const [records, total] = await Promise.all([
      this.prisma.projectPaper.findMany({
        where,
        include: {
          paper: {
            include: {
              researchArea: { select: { id: true, name: true } },
              assignments: {
                where: {
                  assignmentType: PaperAssignmentType.PRIMARY_READER,
                  status: { in: ACTIVE_ASSIGNMENT_STATUSES },
                },
                include: assignmentWithReader,
                take: 1,
              },
            },
          },
        },
        orderBy: { addedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.projectPaper.count({ where }),
    ]);

    return {
      data: records,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async addToProject(
    actor: AuthenticatedUser,
    projectId: string,
    dto: AddProjectPaperDto,
  ) {
    // Any project member can add papers to their project.
    // Project visibility is enforced by assertProjectVisible below.
    await this.assertProjectVisible(actor, projectId);

    const data = await this.resolvePaperIdentity(actor, dto);
    if (
      data.researchAreaId &&
      !(await this.prisma.researchArea.findFirst({
        where: {
          id: data.researchAreaId,
          organizationId: actor.organizationId,
          status: 'ACTIVE',
        },
        select: { id: true },
      }))
    ) {
      throw new BadRequestException({
        code: 'INVALID_RESEARCH_AREA',
        message: 'The research area is unavailable in this organization.',
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const currentReader = await tx.paperAssignment.findFirst({
          where: {
            projectId,
            paperId: data.paperId,
            assignmentType: PaperAssignmentType.PRIMARY_READER,
            status: { in: ACTIVE_ASSIGNMENT_STATUSES },
          },
          include: assignmentWithReader,
          orderBy: { createdAt: 'asc' },
        });

        if (currentReader && currentReader.userId !== actor.id) {
          throw new ConflictException({
            code: 'PAPER_ALREADY_ASSIGNED',
            message: 'This paper is already being read by another member.',
            details: this.toReaderDetails(currentReader),
          });
        }

        const projectPaper = await tx.projectPaper.upsert({
          where: { projectId_paperId: { projectId, paperId: data.paperId } },
          create: {
            projectId,
            paperId: data.paperId,
            addedBy: actor.id,
            status: ProjectPaperStatus.ACTIVE,
          },
          update: { status: ProjectPaperStatus.ACTIVE },
        });

        let assignment = currentReader;
        if (!assignment) {
          assignment = await tx.paperAssignment.create({
            data: {
              projectId,
              paperId: data.paperId,
              userId: actor.id,
              assignedBy: actor.id,
              assignmentType: PaperAssignmentType.PRIMARY_READER,
              status: PaperAssignmentStatus.ASSIGNED,
            },
            include: assignmentWithReader,
          });
        }

        return {
          projectPaper,
          paper: data.paper,
          assignment,
          createdPaper: data.createdPaper,
        };
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        const response = error.getResponse();
        if (
          typeof response === 'object' &&
          response !== null &&
          'code' in response &&
          response.code === 'PAPER_ALREADY_ASSIGNED'
        ) {
          const existing = await this.findAssignmentConflict(projectId, data.paperId);
          if (existing) {
            await this.recordAssignmentConflict(projectId, data.paperId, actor.id, existing.id);
          }
        }
        throw error;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2003')
      ) {
        const conflict = await this.findAssignmentConflict(projectId, data.paperId);
        if (conflict && conflict.userId !== actor.id) {
          throw new ConflictException({
            code: 'PAPER_ALREADY_ASSIGNED',
            message: 'This paper is already being read by another member.',
            details: this.toReaderDetails(conflict),
          });
        }
        if (error.code === 'P2002') {
          throw new ConflictException({
            code: 'PAPER_ALREADY_IN_PROJECT',
            message: 'This paper already exists in the project registry.',
          });
        }
      }
      throw error;
    }
  }

  async assignPrimaryReader(
    actor: AuthenticatedUser,
    projectId: string,
    paperId: string,
    userId: string,
  ) {
    if (!actor.permissions.includes('PAPER_ASSIGN')) {
      throw new ForbiddenException({
        code: 'PAPER_ASSIGN_NOT_ALLOWED',
        message: 'You are not allowed to assign papers.',
      });
    }
    await this.assertProjectVisible(actor, projectId);

    const [paperLink, targetUser] = await Promise.all([
      this.prisma.projectPaper.findFirst({
        where: { projectId, paperId, project: { organizationId: actor.organizationId } },
        select: { id: true },
      }),
      this.prisma.user.findFirst({
        where: {
          id: userId,
          organizationId: actor.organizationId,
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
        select: { id: true },
      }),
    ]);
    if (!paperLink) throw this.paperNotFound();
    if (!targetUser) {
      throw new BadRequestException({
        code: 'INVALID_ASSIGNMENT_USER',
        message: 'The assignee must be an active user in this organization.',
      });
    }

    const currentReader = await this.findAssignmentConflict(projectId, paperId);
    if (currentReader) {
      if (currentReader.userId === userId) return currentReader;
      await this.recordAssignmentConflict(projectId, paperId, actor.id, currentReader.id);
      throw new ConflictException({
        code: 'PAPER_ALREADY_ASSIGNED',
        message: 'This paper is already being read by another member.',
        details: this.toReaderDetails(currentReader),
      });
    }

    try {
      return await this.prisma.paperAssignment.create({
        data: {
          projectId,
          paperId,
          userId,
          assignedBy: actor.id,
          assignmentType: PaperAssignmentType.PRIMARY_READER,
          status: PaperAssignmentStatus.ASSIGNED,
        },
        include: assignmentWithReader,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const currentReader = await this.findAssignmentConflict(projectId, paperId);
        if (currentReader) {
          if (currentReader.userId === userId) return currentReader;
          await this.recordAssignmentConflict(projectId, paperId, actor.id, currentReader.id);
          throw new ConflictException({
            code: 'PAPER_ALREADY_ASSIGNED',
            message: 'This paper is already being read by another member.',
            details: this.toReaderDetails(currentReader),
          });
        }
      }
      throw error;
    }
  }

  private async resolvePaperIdentity(
    actor: AuthenticatedUser,
    dto: AddProjectPaperDto,
  ) {
    if (dto.paperId) {
      const paper = await this.prisma.paper.findFirst({
        where: { id: dto.paperId, organizationId: actor.organizationId },
        include: { identifiers: true },
      });
      if (!paper) throw this.paperNotFound();
      return { paperId: paper.id, paper, createdPaper: false, researchAreaId: paper.researchAreaId };
    }

    const title = dto.title?.trim();
    if (!title) {
      throw new BadRequestException({
        code: 'PAPER_TITLE_REQUIRED',
        message: 'Provide either an existing paper ID or a title.',
      });
    }
    const normalizedTitle = this.normalizeTitle(title);
    const identifiers = (dto.identifiers ?? []).map((identifier) => ({
      type: identifier.type.trim().toUpperCase(),
      value: identifier.value.trim(),
      normalizedValue: this.normalizeIdentifier(identifier.type, identifier.value),
    }));
    if (dto.canonicalUrl) {
      identifiers.push({
        type: 'URL',
        value: dto.canonicalUrl,
        normalizedValue: this.normalizeUrl(dto.canonicalUrl),
      });
    }

    const identifierMatch = identifiers.length
      ? await this.prisma.paperIdentifier.findFirst({
          where: {
            OR: identifiers.flatMap(({ type, normalizedValue }) => [
              { identifierType: type, normalizedValue },
            ]),
            paper: { organizationId: actor.organizationId },
          },
          include: { paper: { include: { identifiers: true } } },
        })
      : null;
    const exactMatch =
      identifierMatch?.paper ??
      (await this.prisma.paper.findFirst({
        where: { organizationId: actor.organizationId, normalizedTitle },
        include: { identifiers: true },
      }));

    if (exactMatch) {
      return {
        paperId: exactMatch.id,
        paper: exactMatch,
        createdPaper: false,
        researchAreaId: exactMatch.researchAreaId,
      };
    }

    const doi = identifiers.find((identifier) => identifier.type === 'DOI')?.value;
    const canonicalUrl =
      dto.canonicalUrl ?? identifiers.find((identifier) => identifier.type === 'URL')?.value;
    try {
      const paper = await this.prisma.paper.create({
        data: {
          organizationId: actor.organizationId,
          paperCode: `PAP-${crypto.randomUUID()}`,
          title,
          normalizedTitle,
          authors: dto.authors ?? Prisma.JsonNull,
          publicationYear: dto.publicationYear,
          doi,
          canonicalUrl,
          researchAreaId: dto.researchAreaId,
          abstract: dto.abstract ?? null,
          journalName: dto.journalName ?? null,
          publisher: dto.publisher ?? null,
          pdfUrl: dto.pdfUrl ?? null,
          imageUrl: dto.imageUrl ?? null,
          metadata: dto.metadata ?? Prisma.JsonNull,
          createdBy: actor.id,
          identifiers: identifiers.length
            ? { create: identifiers.map(({ type, value, normalizedValue }) => ({
                identifierType: type,
                identifierValue: value,
                normalizedValue,
              })) }
            : undefined,
        },
        include: { identifiers: true },
      });
      return { paperId: paper.id, paper, createdPaper: true, researchAreaId: paper.researchAreaId };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await this.prisma.paper.findFirst({
          where: {
            organizationId: actor.organizationId,
            OR: [
              { normalizedTitle },
              ...(doi ? [{ doi }] : []),
              ...(canonicalUrl ? [{ canonicalUrl }] : []),
            ],
          },
          include: { identifiers: true },
        });
        if (duplicate) {
          return {
            paperId: duplicate.id,
            paper: duplicate,
            createdPaper: false,
            researchAreaId: duplicate.researchAreaId,
          };
        }
        throw new ConflictException({
          code: 'PAPER_IDENTIFIER_IN_USE',
          message: 'One of the supplied paper identifiers is already registered.',
        });
      }
      throw error;
    }
  }

  private normalizeTitle(title: string): string {
    return title
      .normalize('NFKC')
      .toLocaleLowerCase('en')
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/[\u2010-\u2015\u2212]/g, '-')
      .replace(/[\p{P}\p{S}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeIdentifier(type: string, value: string): string {
    const normalized = value.trim().normalize('NFKC');
    return type.trim().toUpperCase() === 'DOI'
      ? normalized.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').toLowerCase()
      : normalized.toLowerCase();
  }

  private normalizeUrl(value: string): string {
    try {
      const url = new URL(value);
      url.hash = '';
      url.hostname = url.hostname.toLowerCase();
      if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
      return url.toString().replace(/\/$/, '').toLowerCase();
    } catch {
      return value.trim().toLowerCase();
    }
  }

  private async assertProjectVisible(actor: AuthenticatedUser, projectId: string) {
    const organizationWide = actor.roles.some((role) =>
      ['SUPER_ADMIN', 'ADMIN'].includes(role),
    );
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: actor.organizationId,
        deletedAt: null,
        ...(!organizationWide
          ? {
              OR: [
                { ownerId: actor.id },
                { members: { some: { userId: actor.id } } },
                {
                  teams: {
                    some: {
                      team: {
                        members: { some: { userId: actor.id, isActive: true } },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project was not found.',
      });
    }
  }

  private async findAssignmentConflict(projectId: string, paperId: string) {
    return this.prisma.paperAssignment.findFirst({
      where: {
        projectId,
        paperId,
        assignmentType: PaperAssignmentType.PRIMARY_READER,
        status: { in: ACTIVE_ASSIGNMENT_STATUSES },
      },
      include: assignmentWithReader,
      orderBy: { createdAt: 'asc' },
    });
  }

  private async recordAssignmentConflict(
    projectId: string,
    paperId: string,
    requestedBy: string,
    existingAssignmentId: string,
  ) {
    await this.prisma.paperAssignmentConflict.create({
      data: {
        projectId,
        paperId,
        requestedBy,
        existingAssignmentId,
        resolution: PaperConflictResolution.BLOCKED,
      },
    });
  }

  private paperNotFound() {
    return new NotFoundException({
      code: 'PAPER_NOT_FOUND',
      message: 'Paper was not found in this organization.',
    });
  }

  private toReaderDetails(assignment: {
    id: string;
    status: PaperAssignmentStatus;
    progressPercent: Prisma.Decimal;
    startedAt: Date | null;
    user: {
      id: string;
      memberCode: string;
      fullName: string;
      teamMemberships: Array<{ team: { id: string; name: string; teamCode: string } }>;
    };
  }) {
    return {
      assignmentId: assignment.id,
      memberId: assignment.user.memberCode,
      name: assignment.user.fullName,
      team: assignment.user.teamMemberships[0]?.team ?? null,
      status: assignment.status,
      startedAt: assignment.startedAt,
      progress: Number(assignment.progressPercent),
    };
  }
}

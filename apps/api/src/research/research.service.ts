import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaperAssignmentStatus,
  Prisma,
  ResearchAnswerType,
  ResearchSubmissionStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateQuestionSetDto } from './dto/create-question-set.dto.js';
import type {
  ReviewResearchDto,
  SubmitResearchDto,
} from './dto/submit-research.dto.js';

const questionSetInclude = {
  questions: { orderBy: { displayOrder: 'asc' as const } },
};

@Injectable()
export class ResearchService {
  constructor(private readonly prisma: PrismaService) {}

  async createQuestionSet(actor: AuthenticatedUser, dto: CreateQuestionSetDto) {
    if (!actor.permissions.includes('PROJECT_MANAGE')) {
      throw new ForbiddenException({
        code: 'QUESTION_SET_MANAGE_NOT_ALLOWED',
        message: 'You are not allowed to create research question sets.',
      });
    }
    const questionCodes = dto.questions.map((question) => question.questionCode.trim().toUpperCase());
    if (new Set(questionCodes).size !== questionCodes.length) {
      throw new BadRequestException({
        code: 'DUPLICATE_QUESTION_CODE',
        message: 'Question codes must be unique within a question set.',
      });
    }

    if (dto.projectId) await this.assertProjectVisible(actor, dto.projectId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const set = await tx.questionSet.create({
          data: {
            organizationId: actor.organizationId,
            name: dto.name.trim(),
            description: dto.description?.trim() || null,
            createdBy: actor.id,
            questions: {
              create: dto.questions.map((question, index) => ({
                questionCode: question.questionCode.trim().toUpperCase(),
                questionText: question.questionText.trim(),
                description: question.description?.trim() || null,
                answerType: question.answerType,
                isRequired: question.isRequired ?? false,
                displayOrder: question.displayOrder ?? index,
                excelColumn: question.excelColumn?.trim() || null,
                validationRules: question.validationRules as Prisma.InputJsonValue | undefined,
                options: question.options as Prisma.InputJsonValue | undefined,
              })),
            },
          },
          include: questionSetInclude,
        });

        if (dto.projectId) {
          await tx.projectQuestionSet.create({
            data: { projectId: dto.projectId, questionSetId: set.id },
          });
        }
        return set;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'QUESTION_CODE_ALREADY_EXISTS',
          message: 'A question code already exists in this question set.',
        });
      }
      throw error;
    }
  }

  async listProjectQuestions(actor: AuthenticatedUser, projectId: string) {
    await this.assertProjectVisible(actor, projectId);
    const questionSets = await this.prisma.projectQuestionSet.findMany({
      where: { projectId, project: { organizationId: actor.organizationId } },
      include: {
        questionSet: {
          include: questionSetInclude,
        },
      },
      orderBy: { assignedAt: 'asc' },
    });
    return questionSets.map(({ questionSet }) => questionSet);
  }

  async assignQuestionSet(
    actor: AuthenticatedUser,
    projectId: string,
    questionSetId: string,
  ) {
    if (!actor.permissions.includes('PROJECT_MANAGE')) {
      throw new ForbiddenException({
        code: 'QUESTION_SET_MANAGE_NOT_ALLOWED',
        message: 'You are not allowed to assign research question sets.',
      });
    }
    await this.assertProjectVisible(actor, projectId);
    const [set, existing] = await Promise.all([
      this.prisma.questionSet.findFirst({
        where: { id: questionSetId, organizationId: actor.organizationId, status: 'ACTIVE' },
        select: { id: true },
      }),
      this.prisma.projectQuestionSet.findUnique({
        where: { projectId_questionSetId: { projectId, questionSetId } },
        select: { id: true },
      }),
    ]);
    if (!set) throw this.questionSetNotFound();
    if (existing) return existing;
    return this.prisma.projectQuestionSet.create({
      data: { projectId, questionSetId },
      include: { questionSet: { include: questionSetInclude } },
    });
  }

  async saveResponses(
    actor: AuthenticatedUser,
    projectId: string,
    paperId: string,
    dto: SubmitResearchDto,
  ) {
    await this.assertProjectVisible(actor, projectId);
    const [projectPaper, assignment] = await Promise.all([
      this.prisma.projectPaper.findFirst({
      where: {
        projectId,
        paperId,
        status: 'ACTIVE',
        project: { organizationId: actor.organizationId },
      },
      select: { id: true },
      }),
      this.prisma.paperAssignment.findFirst({
        where: {
          projectId,
          paperId,
          userId: actor.id,
          assignmentType: 'PRIMARY_READER',
          status: {
            in: [
              PaperAssignmentStatus.ASSIGNED,
              PaperAssignmentStatus.READING,
              PaperAssignmentStatus.EXTRACTING,
              PaperAssignmentStatus.REVISION_REQUIRED,
            ],
          },
        },
        select: { id: true },
      }),
    ]);
    if (!projectPaper) {
      throw new NotFoundException({
        code: 'PROJECT_PAPER_NOT_FOUND',
        message: 'The active paper was not found in this project.',
      });
    }
    if (!assignment) {
      throw new ForbiddenException({
        code: 'PAPER_ASSIGNMENT_REQUIRED',
        message: 'You must be the active primary reader to submit research responses.',
      });
    }

    const distinctQuestionIds = [...new Set(dto.answers.map((answer) => answer.questionId))];
    if (distinctQuestionIds.length !== dto.answers.length) {
      throw new BadRequestException({
        code: 'DUPLICATE_ANSWER_QUESTION',
        message: 'Submit at most one answer per question.',
      });
    }

    const questions = await this.prisma.researchQuestion.findMany({
      where: {
        id: { in: distinctQuestionIds },
        questionSet: {
          organizationId: actor.organizationId,
          status: 'ACTIVE',
          projects: { some: { projectId } },
        },
      },
    });
    if (questions.length !== distinctQuestionIds.length) {
      throw new BadRequestException({
        code: 'QUESTION_NOT_ASSIGNED_TO_PROJECT',
        message: 'Every answer must refer to a question assigned to this project.',
      });
    }

    if (dto.submit) {
      const requiredQuestions = await this.prisma.researchQuestion.findMany({
        where: {
          isRequired: true,
          questionSet: {
            organizationId: actor.organizationId,
            status: 'ACTIVE',
            projects: { some: { projectId } },
          },
        },
        select: { id: true, questionCode: true },
      });
      const answerIds = new Set(distinctQuestionIds);
      const missing = requiredQuestions
        .filter((question) => !answerIds.has(question.id))
        .map((question) => question.questionCode);
      if (missing.length) {
        throw new BadRequestException({
          code: 'REQUIRED_ANSWERS_MISSING',
          message: 'All required research questions must be answered before submission.',
          details: { questionCodes: missing },
        });
      }
    }

    const questionMap = new Map(questions.map((question) => [question.id, question]));
    const validationErrors = dto.answers.flatMap((answer) => {
      const question = questionMap.get(answer.questionId)!;
      const supplied = [answer.text, answer.number, answer.boolean, answer.date, answer.json, answer.multiSelect]
        .filter((value) => value !== undefined).length;
      const expected = this.answerCount(answer, question.answerType);
      const errors: string[] = [];
      if (supplied !== expected) errors.push(`${question.questionCode}: answer shape does not match ${question.answerType}`);
      if (question.isRequired && !this.hasAnswer(answer, question.answerType)) {
        errors.push(`${question.questionCode}: answer is required`);
      }
      if (question.answerType === ResearchAnswerType.SELECT || question.answerType === ResearchAnswerType.MULTI_SELECT) {
        const options = Array.isArray(question.options) ? question.options : [];
        const selectValue = answer.json?.value;
        const choices = answer.multiSelect ?? (typeof selectValue === 'string' ? [selectValue] : []);
        if (choices.some((choice) => !options.includes(choice))) errors.push(`${question.questionCode}: answer contains an unavailable option`);
      }
      return errors;
    });
    if (validationErrors.length) {
      throw new BadRequestException({
        code: 'INVALID_RESEARCH_ANSWERS',
        message: 'One or more research answers are invalid.',
        details: { errors: validationErrors },
      });
    }

    const latest = await this.prisma.researchSubmission.findFirst({
      where: { projectId, paperId, submittedBy: actor.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;
    const status = dto.submit
      ? ResearchSubmissionStatus.SUBMITTED
      : ResearchSubmissionStatus.DRAFT;

    return this.prisma.$transaction(async (tx) => {
      const responses = await Promise.all(
        dto.answers.map((answer) => {
          const question = questionMap.get(answer.questionId)!;
          const answerText = question.answerType === ResearchAnswerType.TEXT || question.answerType === ResearchAnswerType.LONG_TEXT || question.answerType === ResearchAnswerType.URL
            ? answer.text
            : undefined;
          return tx.researchResponse.create({
            data: {
              projectId,
              paperId,
              questionId: answer.questionId,
              userId: actor.id,
              answerText,
              answerNumber: answer.number,
              answerBoolean: answer.boolean,
              answerDate: answer.date ? new Date(answer.date) : undefined,
              answerJson:
                answer.json !== undefined
                  ? (answer.json as Prisma.InputJsonValue)
                  : answer.multiSelect !== undefined
                    ? (answer.multiSelect as Prisma.InputJsonValue)
                    : undefined,
              version,
              status: status,
            },
          });
        }),
      );
      const submission = await tx.researchSubmission.create({
        data: {
          projectId,
          paperId,
          submittedBy: actor.id,
          status,
          version,
          submittedAt: dto.submit ? new Date() : null,
        },
      });
      if (dto.submit) {
        await tx.paperAssignment.updateMany({
          where: {
            projectId,
            paperId,
            userId: actor.id,
            assignmentType: 'PRIMARY_READER',
            status: { in: [PaperAssignmentStatus.ASSIGNED, PaperAssignmentStatus.READING, PaperAssignmentStatus.EXTRACTING] },
          },
          data: { status: PaperAssignmentStatus.SUBMITTED },
        });
      }
      return { submission, responses };
    });
  }

  async getResponses(
    actor: AuthenticatedUser,
    projectId: string,
    paperId: string,
  ) {
    await this.assertProjectVisible(actor, projectId);
    const [projectPaper, assignment] = await Promise.all([
      this.prisma.projectPaper.findFirst({
        where: {
          projectId,
          paperId,
          status: 'ACTIVE',
          project: { organizationId: actor.organizationId },
        },
        select: { id: true },
      }),
      this.prisma.paperAssignment.findFirst({
        where: {
          projectId,
          paperId,
          userId: actor.id,
          assignmentType: 'PRIMARY_READER',
        },
        select: { id: true },
      }),
    ]);
    if (!projectPaper) {
      throw new NotFoundException({
        code: 'PROJECT_PAPER_NOT_FOUND',
        message: 'The paper was not found in this project.',
      });
    }
    if (!assignment) {
      throw new ForbiddenException({
        code: 'PAPER_ASSIGNMENT_REQUIRED',
        message: 'Only the assigned primary reader can view these responses.',
      });
    }

    const [responses, submission] = await Promise.all([
      this.prisma.researchResponse.findMany({
        where: { projectId, paperId, userId: actor.id },
        orderBy: [{ version: 'desc' }, { updatedAt: 'desc' }],
        distinct: ['questionId'],
        include: { question: true },
      }),
      this.prisma.researchSubmission.findFirst({
        where: { projectId, paperId, submittedBy: actor.id },
        orderBy: { version: 'desc' },
      }),
    ]);
    return { responses, submission };
  }

  async reviewSubmission(
    actor: AuthenticatedUser,
    projectId: string,
    submissionId: string,
    dto: ReviewResearchDto,
    approve: boolean,
  ) {
    if (!actor.permissions.includes('PAPER_REVIEW')) {
      throw new ForbiddenException({
        code: 'PAPER_REVIEW_NOT_ALLOWED',
        message: 'You are not allowed to review research submissions.',
      });
    }
    await this.assertProjectVisible(actor, projectId);
    const submission = await this.prisma.researchSubmission.findFirst({
      where: { id: submissionId, projectId, project: { organizationId: actor.organizationId } },
    });
    if (!submission) {
      throw new NotFoundException({
        code: 'RESEARCH_SUBMISSION_NOT_FOUND',
        message: 'Research submission was not found.',
      });
    }
    if (
      submission.status !== ResearchSubmissionStatus.SUBMITTED &&
      submission.status !== ResearchSubmissionStatus.UNDER_REVIEW
    ) {
      throw new ConflictException({
        code: 'SUBMISSION_NOT_REVIEWABLE',
        message: 'This submission is not awaiting review.',
      });
    }

    const status = approve
      ? ResearchSubmissionStatus.APPROVED
      : ResearchSubmissionStatus.REVISION_REQUIRED;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.researchSubmission.update({
        where: { id: submissionId },
        data: {
          status,
          reviewedBy: actor.id,
          reviewedAt: new Date(),
          reviewComment: dto.comment.trim(),
        },
      });
      await tx.paperAssignment.updateMany({
        where: { projectId, paperId: submission.paperId, userId: submission.submittedBy },
        data: {
          status: approve ? PaperAssignmentStatus.APPROVED : PaperAssignmentStatus.REVISION_REQUIRED,
          ...(dto.progressPercent !== undefined ? { progressPercent: dto.progressPercent } : {}),
        },
      });
      return updated;
    });
  }

  private answerCount(
    answer: SubmitResearchDto['answers'][number],
    type: ResearchAnswerType,
  ): number {
    switch (type) {
      case ResearchAnswerType.TEXT:
      case ResearchAnswerType.LONG_TEXT:
      case ResearchAnswerType.URL:
        return Number(answer.text !== undefined);
      case ResearchAnswerType.NUMBER:
        return Number(answer.number !== undefined);
      case ResearchAnswerType.BOOLEAN:
        return Number(answer.boolean !== undefined);
      case ResearchAnswerType.DATE:
        return Number(answer.date !== undefined);
      case ResearchAnswerType.SELECT:
        return Number(answer.json?.value !== undefined);
      case ResearchAnswerType.MULTI_SELECT:
        return Number(answer.multiSelect !== undefined);
    }
  }

  private hasAnswer(answer: SubmitResearchDto['answers'][number], type: ResearchAnswerType): boolean {
    switch (type) {
      case ResearchAnswerType.TEXT:
      case ResearchAnswerType.LONG_TEXT:
      case ResearchAnswerType.URL:
        return Boolean(answer.text?.trim());
      case ResearchAnswerType.NUMBER:
        return answer.number !== undefined;
      case ResearchAnswerType.BOOLEAN:
        return answer.boolean !== undefined;
      case ResearchAnswerType.DATE:
        return Boolean(answer.date);
      case ResearchAnswerType.SELECT:
        return Boolean(answer.json?.value);
      case ResearchAnswerType.MULTI_SELECT:
        return Boolean(answer.multiSelect?.length);
    }
  }

  private async assertProjectVisible(actor: AuthenticatedUser, projectId: string) {
    const organizationWide = actor.roles.some((role) => ['SUPER_ADMIN', 'ADMIN'].includes(role));
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
                { teams: { some: { team: { members: { some: { userId: actor.id, isActive: true } } } } } },
              ],
            }
          : {}),
      },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: 'Project was not found.' });
    }
  }

  private questionSetNotFound() {
    return new NotFoundException({ code: 'QUESTION_SET_NOT_FOUND', message: 'Question set was not found.' });
  }
}

import { ResearchAnswerType, ResearchSubmissionStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { ResearchService } from './research.service.js';

const actor: AuthenticatedUser = {
  id: 'reader-id',
  organizationId: 'org-a',
  memberCode: 'INT-000001',
  email: 'reader@example.com',
  fullName: 'Research Reader',
  profileImageUrl: null,
  organization: { id: 'org-a', name: 'Organization A', slug: 'org-a', logoUrl: null },
  roles: ['MEMBER'],
  permissions: ['PAPER_ASSIGN', 'PAPER_VIEW', 'PROJECT_MANAGE'],
};

const makePrisma = () => ({
  project: { findFirst: vi.fn() },
  questionSet: { create: vi.fn(), findFirst: vi.fn() },
  projectQuestionSet: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  researchQuestion: { findMany: vi.fn() },
  projectPaper: { findFirst: vi.fn() },
  paperAssignment: { findFirst: vi.fn(), updateMany: vi.fn() },
  researchSubmission: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  researchResponse: { create: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
});

describe('ResearchService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let researchService: ResearchService;

  beforeEach(() => {
    prisma = makePrisma();
    researchService = new ResearchService(prisma as never);
    prisma.project.findFirst.mockResolvedValue({ id: 'project-id' });
  });

  it('creates a question set and assigns it to a project transactionally', async () => {
    const tx = {
      questionSet: { create: vi.fn().mockResolvedValue({ id: 'set-id', questions: [] }) },
      projectQuestionSet: { create: vi.fn().mockResolvedValue({ id: 'assignment-id' }) },
    };
    prisma.$transaction.mockImplementation((callback) => callback(tx));

    await researchService.createQuestionSet(actor, {
      name: 'Paper extraction',
      projectId: 'project-id',
      questions: [
        {
          questionCode: 'Q1',
          questionText: 'Which dataset was used?',
          answerType: ResearchAnswerType.LONG_TEXT,
          isRequired: true,
        },
      ],
    });

    expect(tx.questionSet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-a',
          createdBy: 'reader-id',
          questions: {
            create: [
              expect.objectContaining({
                questionCode: 'Q1',
                answerType: ResearchAnswerType.LONG_TEXT,
                isRequired: true,
                displayOrder: 0,
              }),
            ],
          },
        }),
      }),
    );
    expect(tx.projectQuestionSet.create).toHaveBeenCalledWith({
      data: { projectId: 'project-id', questionSetId: 'set-id' },
    });
  });

  it('rejects duplicate question codes before writing', async () => {
    await expect(
      researchService.createQuestionSet(actor, {
        name: 'Duplicate form',
        questions: [
          { questionCode: 'q1', questionText: 'First', answerType: ResearchAnswerType.TEXT },
          { questionCode: 'Q1', questionText: 'Second', answerType: ResearchAnswerType.TEXT },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'DUPLICATE_QUESTION_CODE' }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires an active primary reader before saving research answers', async () => {
    prisma.projectPaper.findFirst.mockResolvedValue({ id: 'project-paper-id' });
    prisma.paperAssignment.findFirst.mockResolvedValue(null);

    await expect(
      researchService.saveResponses(actor, 'project-id', 'paper-id', {
        submit: false,
        answers: [],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PAPER_ASSIGNMENT_REQUIRED' }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires every mandatory question on final submission', async () => {
    prisma.projectPaper.findFirst.mockResolvedValue({ id: 'project-paper-id' });
    prisma.paperAssignment.findFirst.mockResolvedValue({ id: 'assignment-id' });
    prisma.researchQuestion.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'required-question', questionCode: 'Q1' }]);

    await expect(
      researchService.saveResponses(actor, 'project-id', 'paper-id', {
        submit: true,
        answers: [],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'REQUIRED_ANSWERS_MISSING',
        details: { questionCodes: ['Q1'] },
      }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('validates typed answers and saves a draft response version', async () => {
    prisma.projectPaper.findFirst.mockResolvedValue({ id: 'project-paper-id' });
    prisma.paperAssignment.findFirst.mockResolvedValue({ id: 'assignment-id' });
    prisma.researchQuestion.findMany.mockResolvedValue([
      {
        id: 'question-id',
        questionCode: 'Q1',
        answerType: ResearchAnswerType.LONG_TEXT,
        isRequired: true,
        options: null,
      },
    ]);
    prisma.researchSubmission.findFirst.mockResolvedValue(null);
    const tx = {
      researchResponse: { create: vi.fn().mockResolvedValue({ id: 'response-id' }) },
      researchSubmission: { create: vi.fn().mockResolvedValue({ id: 'submission-id' }) },
      paperAssignment: { updateMany: vi.fn() },
    };
    prisma.$transaction.mockImplementation((callback) => callback(tx));

    const result = await researchService.saveResponses(actor, 'project-id', 'paper-id', {
      submit: false,
      answers: [{ questionId: 'question-id', text: 'Dataset Alpha' }],
    });

    expect(result.submission).toEqual({ id: 'submission-id' });
    expect(tx.researchResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'project-id',
          paperId: 'paper-id',
          questionId: 'question-id',
          answerText: 'Dataset Alpha',
          version: 1,
          status: ResearchSubmissionStatus.DRAFT,
        }),
      }),
    );
    expect(tx.paperAssignment.updateMany).not.toHaveBeenCalled();
  });

  it('submits validated answers and moves the primary-reader assignment to review', async () => {
    prisma.projectPaper.findFirst.mockResolvedValue({ id: 'project-paper-id' });
    prisma.paperAssignment.findFirst.mockResolvedValue({ id: 'assignment-id' });
    prisma.researchQuestion.findMany
      .mockResolvedValueOnce([
        {
          id: 'question-id',
          questionCode: 'Q1',
          answerType: ResearchAnswerType.BOOLEAN,
          isRequired: true,
          options: null,
        },
      ])
      .mockResolvedValueOnce([{ id: 'question-id', questionCode: 'Q1' }]);
    prisma.researchSubmission.findFirst.mockResolvedValue({ version: 1 });
    const tx = {
      researchResponse: { create: vi.fn().mockResolvedValue({ id: 'response-id' }) },
      researchSubmission: {
        create: vi.fn().mockResolvedValue({ id: 'submission-id', status: ResearchSubmissionStatus.SUBMITTED }),
      },
      paperAssignment: { updateMany: vi.fn() },
    };
    prisma.$transaction.mockImplementation((callback) => callback(tx));

    await researchService.saveResponses(actor, 'project-id', 'paper-id', {
      submit: true,
      answers: [{ questionId: 'question-id', boolean: false }],
    });

    expect(tx.researchResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          answerBoolean: false,
          version: 2,
          status: ResearchSubmissionStatus.SUBMITTED,
        }),
      }),
    );
    expect(tx.paperAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'reader-id' }),
        data: { status: 'SUBMITTED' },
      }),
    );
  });

  it('returns latest saved answers only to the assigned primary reader', async () => {
    prisma.projectPaper.findFirst.mockResolvedValue({ id: 'project-paper-id' });
    prisma.paperAssignment.findFirst.mockResolvedValue({ id: 'assignment-id' });
    prisma.researchResponse.findMany.mockResolvedValue([{ id: 'latest-response' }]);
    prisma.researchSubmission.findFirst.mockResolvedValue({ id: 'latest-submission' });

    await expect(
      researchService.getResponses(actor, 'project-id', 'paper-id'),
    ).resolves.toEqual({
      responses: [{ id: 'latest-response' }],
      submission: { id: 'latest-submission' },
    });
    expect(prisma.researchResponse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'project-id', paperId: 'paper-id', userId: 'reader-id' },
        distinct: ['questionId'],
      }),
    );
  });
});

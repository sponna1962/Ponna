// Tool Layer (Specification v3, §1.2, BINDING). Fixed names, fixed
// input/output shapes, plain TypeScript, zero dependency on any provider
// SDK — the same contracts work unmodified no matter which
// ProviderAdapter is active. Phase 1 scope only (per the agreed phased
// plan): get_question, get_my_mistakes, get_my_performance_summary.
// start_mini_test, get_exam_syllabus, get_exam_eligibility, and
// search_current_info are later phases.
//
// Every function here is scoped to the CALLING student's own userId,
// passed in by the Orchestrator from the authenticated session — never
// accepted as an argument the AI could set itself. This is what makes
// "the AI can only see its own conversation's student's data" true
// structurally, not just by convention.

import { prisma } from '../../lib/prisma';
import { ToolDefinition } from './provider-adapter';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_question',
    description: "Fetch one specific PONNA question by its id — the question text, options, correct answer, and explanation if one exists. Use this whenever the student asks about a specific question (e.g. 'explain this question', 'why was I wrong').",
    parameters: {
      type: 'object',
      properties: { questionId: { type: 'string', description: 'The PONNA question id' } },
      required: ['questionId'],
    },
  },
  {
    name: 'get_my_mistakes',
    description: "Fetch the student's own current Review Mistakes list (questions they previously answered wrong and have not yet corrected). Use this when the student asks to analyze their mistakes or weak areas.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_my_performance_summary',
    description: "Fetch the student's own tracked performance summary (accuracy and question count, overall and by difficulty). Use this for performance analysis or 'what should I study' type questions.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'find_exam',
    description: "Look up a TNPSC/TNTET exam by name (e.g. 'Group IV', 'Group I', 'TNTET') to get its exact id, needed before calling get_exam_info or get_exam_syllabus. Always call this FIRST when the student mentions an exam by name, before assuming you know which exam they mean.",
    parameters: {
      type: 'object',
      properties: { examName: { type: 'string', description: "The exam name as the student said it, e.g. 'Group 4' or 'TNTET'" } },
      required: ['examName'],
    },
  },
  {
    name: 'get_exam_info',
    description: "Fetch PONNA's verified, admin-checked exam information for one specific exam (application dates, exam date, paper pattern, eligibility, important notes) -- each fact includes its source and the date it was last verified. THIS is the only source of truth for exam schedule/dates/pattern/eligibility -- never answer these from your own memory, since they change over time and PONNA's verified data may not cover everything. If a fact isn't returned, say plainly that it's not on file rather than guessing.",
    parameters: {
      type: 'object',
      properties: { subCategoryId: { type: 'string', description: 'The exam id, from find_exam' } },
      required: ['subCategoryId'],
    },
  },
  {
    name: 'get_exam_syllabus',
    description: "Fetch the official Subject -> Topic syllabus structure for one specific exam. Use this when discussing what the student needs to study for a specific exam.",
    parameters: {
      type: 'object',
      properties: { subCategoryId: { type: 'string', description: 'The exam id, from find_exam' } },
      required: ['subCategoryId'],
    },
  },
];

export class ToolLayerError extends Error {}

export async function executeTool(userId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
  switch (toolName) {
    case 'get_question': {
      const questionId = args.questionId as string;
      if (!questionId) throw new ToolLayerError('questionId is required');
      const q = await prisma.question.findUnique({
        where: { id: questionId },
        select: {
          questionText: true,
          optionA: true,
          optionB: true,
          optionC: true,
          optionD: true,
          correctOption: true,
          explanationTa: true,
          explanationEn: true,
          language: true,
        },
      });
      if (!q) throw new ToolLayerError('Question not found');
      return q;
    }

    case 'get_my_mistakes': {
      const rows = await prisma.mistakeReview.findMany({
        where: { userId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { question: { select: { questionText: true, subject: { select: { name: true } } } } },
      });
      return rows.map((r) => ({ questionId: r.questionId, questionText: r.question.questionText, subject: r.question.subject?.name ?? null }));
    }

    case 'get_my_performance_summary': {
      const rows = await prisma.userPerformanceSummary.findMany({ where: { userId } });
      return rows.map((r) => ({ bucket: r.bucket, questionsAnswered: r.questionsAnswered, correctAnswers: r.correctAnswers, averagePercent: r.averagePercent }));
    }

    case 'find_exam': {
      const examName = (args.examName as string) ?? '';
      const matches = await prisma.examSubCategory.findMany({
        where: { studentVisible: true, name: { contains: examName, mode: 'insensitive' } },
        select: { id: true, name: true },
        take: 5,
      });
      if (matches.length === 0) return { found: false, message: `No exam matching "${examName}" found in PONNA.` };
      return { found: true, matches };
    }

    case 'get_exam_info': {
      const subCategoryId = args.subCategoryId as string;
      if (!subCategoryId) throw new ToolLayerError('subCategoryId is required');
      const facts = await prisma.verifiedExamFact.findMany({
        where: { subCategoryId },
        select: { factType: true, value: true, sourceUrl: true, verifiedAt: true },
        orderBy: { verifiedAt: 'desc' },
      });
      if (facts.length === 0) {
        return { hasVerifiedInfo: false, message: 'No verified exam information is on file for this exam yet in PONNA -- direct the student to the official TNPSC notification for schedule/eligibility details.' };
      }
      return { hasVerifiedInfo: true, facts };
    }

    case 'get_exam_syllabus': {
      const subCategoryId = args.subCategoryId as string;
      if (!subCategoryId) throw new ToolLayerError('subCategoryId is required');
      const subjects = await prisma.syllabusSubject.findMany({
        where: { subCategoryId },
        include: { topics: { select: { name: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      return subjects.map((s) => ({ subject: s.name, topics: s.topics.map((t) => t.name) }));
    }

    default:
      throw new ToolLayerError(`Unknown tool: ${toolName}`);
  }
}

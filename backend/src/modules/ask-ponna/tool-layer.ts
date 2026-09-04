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

    default:
      throw new ToolLayerError(`Unknown tool: ${toolName}`);
  }
}

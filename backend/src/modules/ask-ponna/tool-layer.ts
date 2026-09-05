// Tool Layer (Specification v3, §1.2, BINDING). Fixed names, fixed
// input/output shapes, plain TypeScript, zero dependency on any provider
// SDK — the same contracts work unmodified no matter which
// ProviderAdapter is active.
//
// Every function here is scoped to the CALLING student's own userId,
// passed in by the Orchestrator from the authenticated session — never
// accepted as an argument the AI could set itself. This is what makes
// "the AI can only see its own conversation's student's data" true
// structurally, not just by convention.

import { prisma } from '../../lib/prisma';
import { ToolDefinition } from './provider-adapter';
import { isFactStale } from './verification-tiers';
import { searchCurrentInfo } from './live-search-adapter';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_my_profile',
    description: "Fetch the student's own name and stated highest qualification (if any). ALWAYS call this at the very start of a conversation so you can greet the student by name -- never ask for their name, it's already known. When discussing exam preparation, use the qualification here to CONFIRM with the student rather than asking fresh (e.g. 'I see you're a graduate -- is that still right?') -- only ask outright if this returns no qualification on file.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'start_diagnostic',
    description: "Starts (or resumes) the student's one-time diagnostic 'warm-up' quiz -- a short, low-pressure set of questions to get a rough sense of their level. Call this only after the student has agreed to try it (never force it), ideally after they've named a target exam so the questions can be scoped to that exam's syllabus. Frame it as a relaxed warm-up, never as a 'test' -- no pressure, just curiosity. If they've already completed this before, this tool will say so -- don't offer it again in that case.",
    parameters: {
      type: 'object',
      properties: { subCategoryId: { type: 'string', description: "The chosen exam's id, from find_exam, to scope questions to that syllabus. Omit for a general mixed sample." } },
      required: [],
    },
  },
  {
    name: 'get_diagnostic_next_question',
    description: "Fetch the next unanswered question in the student's in-progress diagnostic warm-up. Present the question text, then list the four options using your normal [[OPTIONS: ...]] marker so the student can tap one. Returns null/done when there are no more questions -- call complete_diagnostic then.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'submit_diagnostic_answer',
    description: 'Submit the student\'s tapped answer for the current diagnostic question. Returns whether it was correct -- you may give brief, encouraging feedback either way (this is a low-pressure warm-up, not a graded test), then call get_diagnostic_next_question for the next one.',
    parameters: {
      type: 'object',
      properties: { selectedOption: { type: 'string', enum: ['A', 'B', 'C', 'D'], description: 'The option letter the student picked' } },
      required: ['selectedOption'],
    },
  },
  {
    name: 'complete_diagnostic',
    description: 'Call once every diagnostic question has been answered. Returns a per-subject breakdown -- present it warmly as a rough starting impression (explicitly not a precise accuracy figure, since it is only ~12 questions), then naturally continue into personalised next-step advice.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
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
  {
    name: 'get_exam_full_info',
    description: "Fetch the FULL structured exam information for one specific exam -- posts covered, department/service, age limit/relaxation, exam stages, paper structure, selection process, vacancy count, hall ticket/answer key/result status, application dates, reservation info, and any other verified facts on file. Each fact includes isOfficialConfirmed (true = admin-confirmed against an official source; false = tentative/expected) and whether it is stale (only ever true for genuinely time-varying facts -- dates, vacancy, hall ticket, answer key, result, application window -- never for stable facts like syllabus or eligibility). If a stale time-sensitive fact is returned, call search_current_info to check for a more current value before answering. Never state a fact's official/tentative status incorrectly -- always relay exactly what this tool says.",
    parameters: {
      type: 'object',
      properties: { subCategoryId: { type: 'string', description: 'The exam id, from find_exam' } },
      required: ['subCategoryId'],
    },
  },
  {
    name: 'get_current_affairs',
    description: "Fetch PONNA's verified current-affairs items (Tier 1 source), most recent first. Each item has the news itself (headline, summary, source) kept SEPARATE from PONNA's own exam-relevance note -- present both, never blend them into one sentence as if the news source said the exam-relevance part. If nothing recent enough is returned, call search_current_info for a live check.",
    parameters: {
      type: 'object',
      properties: { date: { type: 'string', description: 'Optional specific date (YYYY-MM-DD) to look up; omit for most recent items' } },
      required: [],
    },
  },
  {
    name: 'get_ponna_faq',
    description: "Fetch PONNA's own canonical answers about its features (Review Mistakes, Daily Challenge, Subject Preference, Annual Plan, etc.). ALWAYS use this instead of describing PONNA's own features from your own general understanding -- it may be outdated. If nothing matches, say you're not sure how that specific feature works rather than guessing.",
    parameters: {
      type: 'object',
      properties: { featureKey: { type: 'string', description: "Optional specific feature key if known (e.g. 'review_mistakes', 'daily_challenge'); omit to get the full list" } },
      required: [],
    },
  },
  {
    name: 'suitable_exam_finder',
    description: "Given the student's stated qualification (and optionally age), returns candidate TNPSC/TNTET exams that MAY be suitable, each with its on-file eligibility fact (if any) and whether that fact is officially confirmed. This is a GUIDED SUGGESTION tool, never a final eligibility verdict -- always present results as 'candidates to verify', explicitly naming what still needs official confirmation. Never say a student 'IS eligible' from this alone.",
    parameters: {
      type: 'object',
      properties: {
        qualification: { type: 'string', description: "The student's stated qualification, e.g. '10th', '12th', 'Degree', 'PG'" },
        age: { type: 'number', description: "Optional -- the student's age, if they've shared it" },
      },
      required: ['qualification'],
    },
  },
  {
    name: 'search_current_info',
    description: "Live web search for a time-sensitive question (Tier 3) when PONNA's verified data (get_exam_full_info/get_current_affairs) is missing or flagged stale. Prioritizes official exam-authority sources automatically -- the response tells you whether the result IS from an official source or not. If isOfficialSource is true, you may present it as reasonably current official information (still note it came from a live check, not PONNA's own verified database). If false, you MUST present it as 'தற்போதைய web தகவல் (அதிகாரப்பூர்வமாக உறுதிப்படுத்தப்படவில்லை)' -- never implied as officially confirmed. If available is false, tell the student this couldn't be checked right now and to verify with the official notification -- never guess instead.",
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'A focused search query, e.g. "TNPSC Group IV 2026 exam date"' } },
      required: ['query'],
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

    case 'get_my_profile': {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, highestQualification: true, educationStatus: true } });
      return { name: user.name, educationStatus: user.educationStatus, highestQualification: user.highestQualification };
    }

    case 'start_diagnostic': {
      const existing = await prisma.diagnosticAttempt.findUnique({ where: { userId } });
      if (existing?.completedAt) return { status: 'already_completed' };
      if (existing) return { status: 'resumed' }; // in-progress, unanswered questions already exist -- just continue with get_diagnostic_next_question

      const subCategoryId = args.subCategoryId as string | undefined;
      const questions = await prisma.question.findMany({
        where: subCategoryId ? { status: 'PUBLISHED', authorityTags: { some: { subCategoryId } } } : { status: 'PUBLISHED' },
        take: 12,
        orderBy: { createdAt: 'asc' },
      });
      if (questions.length < 12) return { status: 'error', message: 'Not enough published questions available yet for this warm-up.' };

      await prisma.diagnosticAttempt.create({
        data: { userId, answers: { create: questions.map((q, i) => ({ questionId: q.id, sequenceNumber: i + 1 })) } },
      });
      return { status: 'started', totalQuestions: questions.length };
    }

    case 'get_diagnostic_next_question': {
      const attempt = await prisma.diagnosticAttempt.findUnique({ where: { userId } });
      if (!attempt) throw new ToolLayerError('No diagnostic in progress -- call start_diagnostic first.');
      const next = await prisma.diagnosticAnswer.findFirst({
        where: { attemptId: attempt.id, selectedOption: null },
        orderBy: { sequenceNumber: 'asc' },
        include: { question: { select: { questionText: true, optionA: true, optionB: true, optionC: true, optionD: true } } },
      });
      if (!next) return { done: true };
      return {
        done: false,
        sequenceNumber: next.sequenceNumber,
        questionText: next.question.questionText,
        optionA: next.question.optionA,
        optionB: next.question.optionB,
        optionC: next.question.optionC,
        optionD: next.question.optionD,
      };
    }

    case 'submit_diagnostic_answer': {
      const attempt = await prisma.diagnosticAttempt.findUnique({ where: { userId } });
      if (!attempt) throw new ToolLayerError('No diagnostic in progress -- call start_diagnostic first.');
      const current = await prisma.diagnosticAnswer.findFirst({
        where: { attemptId: attempt.id, selectedOption: null },
        orderBy: { sequenceNumber: 'asc' },
      });
      if (!current) throw new ToolLayerError('No unanswered diagnostic question to submit for -- call complete_diagnostic.');

      const question = await prisma.question.findUniqueOrThrow({ where: { id: current.questionId } });
      const selectedOption = args.selectedOption as string;
      const isCorrect = question.correctOption === selectedOption;

      await prisma.diagnosticAnswer.update({
        where: { id: current.id },
        data: { selectedOption: selectedOption as any, isCorrect, answeredAt: new Date() },
      });
      return { isCorrect };
    }

    case 'complete_diagnostic': {
      const attempt = await prisma.diagnosticAttempt.findUnique({
        where: { userId },
        include: { answers: { include: { question: { include: { subject: true } } } } },
      });
      if (!attempt) throw new ToolLayerError('No diagnostic in progress -- call start_diagnostic first.');

      await prisma.diagnosticAttempt.update({ where: { id: attempt.id }, data: { completedAt: new Date() } });

      const bySubject = new Map<string, { correct: number; total: number }>();
      for (const a of attempt.answers) {
        const key = a.question.subject?.name ?? 'General';
        const entry = bySubject.get(key) ?? { correct: 0, total: 0 };
        entry.total += 1;
        if (a.isCorrect) entry.correct += 1;
        bySubject.set(key, entry);
      }
      return {
        totalCorrect: attempt.answers.filter((a) => a.isCorrect).length,
        totalQuestions: attempt.answers.length,
        bySubject: Array.from(bySubject.entries()).map(([subject, v]) => ({ subject, correct: v.correct, total: v.total })),
      };
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

    case 'get_exam_full_info': {
      const subCategoryId = args.subCategoryId as string;
      if (!subCategoryId) throw new ToolLayerError('subCategoryId is required');
      const facts = await prisma.verifiedExamFact.findMany({
        where: { subCategoryId },
        select: { factType: true, value: true, sourceUrl: true, verifiedAt: true, isOfficialConfirmed: true },
        orderBy: { verifiedAt: 'desc' },
      });
      if (facts.length === 0) {
        return { hasVerifiedInfo: false, message: 'No verified exam information is on file for this exam yet in PONNA -- direct the student to the official TNPSC notification, or call search_current_info for a live check.' };
      }
      return {
        hasVerifiedInfo: true,
        facts: facts.map((f) => ({ ...f, isStale: isFactStale(f.factType, f.verifiedAt) })),
      };
    }

    case 'get_current_affairs': {
      const dateStr = args.date as string | undefined;
      const items = await prisma.currentAffairsItem.findMany({
        where: dateStr ? { date: new Date(dateStr) } : undefined,
        orderBy: { date: 'desc' },
        take: 10,
        select: { date: true, headline: true, summary: true, sourceUrl: true, examRelevanceNote: true, verifiedAt: true },
      });
      if (items.length === 0) {
        return { hasItems: false, message: 'No verified current affairs items found for this -- call search_current_info for a live check.' };
      }
      // Current affairs are always time-sensitive -- a >30-day-old item
      // should prompt a live check for anything freshly asked about.
      const mostRecentIsStale = (Date.now() - items[0].date.getTime()) / (1000 * 60 * 60 * 24) > 30;
      return { hasItems: true, mostRecentIsStale, items };
    }

    case 'get_ponna_faq': {
      const featureKey = args.featureKey as string | undefined;
      const rows = await prisma.ponnaFeatureFAQ.findMany({ where: featureKey ? { featureKey } : undefined });
      if (rows.length === 0) return { found: false };
      return { found: true, entries: rows.map((r) => ({ featureKey: r.featureKey, question: r.question, answer: r.answer })) };
    }

    case 'suitable_exam_finder': {
      const exams = await prisma.examSubCategory.findMany({
        where: { studentVisible: true },
        select: { id: true, name: true },
      });
      const withEligibility = await Promise.all(
        exams.map(async (exam) => {
          const eligibilityFact = await prisma.verifiedExamFact.findFirst({
            where: { subCategoryId: exam.id, factType: 'ELIGIBILITY' },
            select: { value: true, isOfficialConfirmed: true, verifiedAt: true },
          });
          return {
            examId: exam.id,
            examName: exam.name,
            eligibilityOnFile: eligibilityFact
              ? { value: eligibilityFact.value, isOfficialConfirmed: eligibilityFact.isOfficialConfirmed, verifiedAt: eligibilityFact.verifiedAt }
              : null,
          };
        }),
      );
      return {
        studentQualification: args.qualification,
        studentAge: args.age ?? null,
        candidates: withEligibility,
        reminder: 'These are candidates to discuss, not a final eligibility verdict -- always tell the student which eligibility facts still need official confirmation.',
      };
    }

    case 'search_current_info': {
      const query = args.query as string;
      if (!query) throw new ToolLayerError('query is required');
      return searchCurrentInfo(query);
    }

    default:
      throw new ToolLayerError(`Unknown tool: ${toolName}`);
  }
}

// Mistake-Driven Smart Revision (Sept 2026) — PONNA's differentiated
// alternative to a competitor's static, one-size-fits-all revision
// notes. Every student gets a DIFFERENT summary, generated from their
// OWN actual mistakes (Review Mistakes' pending questions) -- grouped
// by Subject, with the correct answer as context so the AI explains the
// concept the student actually got wrong, not a generic topic overview.
// A competitor without this app's per-student mistake-tracking depth
// (Review Mistakes has existed here since the finalized requirements)
// cannot replicate this the same way.
//
// On-demand, not auto-generated in the background: a student explicitly
// asks for this (a button on the Review Mistakes page), since it's one
// real Gemini call per request -- generating it unprompted for every
// student on every page load would be wasteful cost for a summary many
// students may not look at that session.

import { prisma } from '../../lib/prisma';
import { MistakeReviewStatus } from '@prisma/client';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.7-flash';

// Cap the number of mistakes fed into one prompt -- a student with
// hundreds of pending mistakes still gets a useful, focused summary
// from their most recent ones, not an unbounded (and unreadable) essay.
const MAX_MISTAKES_PER_REQUEST = 25;

export class SmartRevisionError extends Error {}

export class SmartRevisionService {
  async generate(userId: string): Promise<{ summary: string; questionCount: number; subjectCount: number }> {
    if (!GEMINI_API_KEY) throw new SmartRevisionError('GEMINI_API_KEY is not set.');

    const mistakes = await prisma.mistakeReview.findMany({
      where: { userId, status: MistakeReviewStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      take: MAX_MISTAKES_PER_REQUEST,
      include: {
        question: {
          select: {
            questionText: true,
            optionA: true,
            optionB: true,
            optionC: true,
            optionD: true,
            correctOption: true,
            explanationTa: true,
            explanationEn: true,
            subject: { select: { name: true } },
          },
        },
      },
    });

    if (mistakes.length === 0) {
      throw new SmartRevisionError('No pending mistakes to review right now -- nothing to summarize.');
    }

    const bySubject = new Map<string, typeof mistakes>();
    for (const m of mistakes) {
      const subjectName = m.question.subject?.name ?? 'Other';
      const list = bySubject.get(subjectName) ?? [];
      list.push(m);
      bySubject.set(subjectName, list);
    }

    const promptSections = Array.from(bySubject.entries())
      .map(([subject, items]) => {
        const questionsText = items
          .map((m, i) => {
            const q = m.question;
            const correctText = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }[q.correctOption];
            const explanation = q.explanationTa ?? q.explanationEn ?? '';
            return `${i + 1}. Q: ${q.questionText}\nCorrect answer: ${correctText}${explanation ? `\nExplanation: ${explanation}` : ''}`;
          })
          .join('\n\n');
        return `Subject: ${subject}\n${questionsText}`;
      })
      .join('\n\n---\n\n');

    const prompt = `A student got these exam-prep questions wrong. Write a SHORT, encouraging revision summary in Tamil (mixing in English technical terms naturally where a Tamil student would), organized by Subject as a heading followed by 2-4 bullet points per subject covering the SPECIFIC concepts these particular wrong answers show the student needs to review -- not a generic topic overview, but focused on what THESE questions reveal. Keep the whole summary readable in under a minute. End with one short encouraging line.

${promptSections}

Respond with ONLY the revision summary text (plain text, using bullet markers and subject names as headings) -- no JSON, no markdown fences, no preamble.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2000 },
      }),
    });

    if (!response.ok) {
      throw new SmartRevisionError(`Gemini API error: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!summary) throw new SmartRevisionError('Gemini returned an empty response.');

    return { summary: summary.trim(), questionCount: mistakes.length, subjectCount: bySubject.size };
  }
}

export const smartRevisionService = new SmartRevisionService();

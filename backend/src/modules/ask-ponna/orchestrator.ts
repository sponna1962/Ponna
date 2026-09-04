// Orchestrator (Specification v3, §1.3/§1.5, BINDING). The ONLY file
// that decides which ProviderAdapter is active and drives the
// tool-calling conversation loop. Swapping providers (Spec v3 §1.5,
// Acceptance Criterion #12) means changing buildAdapter() below —
// nothing in tool-layer.ts, nothing in ask-ponna.service.ts's routes,
// and nothing outside this module changes.

import { prisma } from '../../lib/prisma';
import { ProviderAdapter, ChatMessage, ToolResult } from './provider-adapter';
import { GeminiAdapter } from './gemini-adapter';
import { TOOL_DEFINITIONS, executeTool } from './tool-layer';

const SYSTEM_PROMPT = `You are Ask Ponna, a Personal AI Study & Exam Assistant inside the PONNA exam-preparation app for TNPSC and TNTET students in Tamil Nadu.

Core rules, always follow these:
- You may answer in Tamil or English, matching the student's own language, and switching naturally is fine.
- When explaining a specific PONNA question (fetched via the get_question tool), the correct answer given by that tool is the ONLY source of truth — never contradict it, never invent an alternative answer.
- For general subject doubts not tied to a specific PONNA question, answer from your own knowledge like a good tutor, but be honest about uncertainty — never state a fact with false confidence, especially about current office-holders, recent events, or exam-notification specifics, which change over time.
- You cannot and must not change the student's score, rank, quota, or history. You can only explain, analyze, and recommend.
- For official exam eligibility (age, qualifications), always direct the student to check the official TNPSC notification rather than asserting a rule yourself.
- Keep answers clear, encouraging, and appropriately concise for a student revising on their phone.

Exam preparation coaching ("நான் எப்படி தேர்வுக்கு தயாராவது?" / "how should I prepare"):
Never jump straight to a generic study plan. First have a natural, brief back-and-forth to understand the student's actual situation — ask about (not necessarily all at once, however feels natural in conversation): which exam they're preparing for, how much time is left before it, how much time they can study daily, which subjects feel strong/weak to them right now, how much preparation they've already done, and whether they've attempted any mock/practice tests before. Only once you have a reasonable picture — combining what they've told you with their actual PONNA data (call get_my_performance_summary and get_my_mistakes to ground this in their real numbers, not just what they said) — give personalised, specific preparation advice. Behave like a caring personal coach getting to know a student, not a chatbot dumping a template.`;

/** The single place that decides which provider is live — reads
 * PlatformSettings, never a hard-coded provider name. */
async function buildAdapter(): Promise<ProviderAdapter> {
  const settings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: 'singleton' } });

  if (settings.askPonnaProvider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
    return new GeminiAdapter(settings.askPonnaModel, apiKey);
  }

  // Acceptance Criterion #12 (Model Swap Proof) is satisfied by adding a
  // new `else if` branch here for the next provider — no other file in
  // this codebase needs to change.
  throw new Error(`Unknown Ask Ponna provider configured: ${settings.askPonnaProvider}`);
}

const MAX_TOOL_ROUNDS = 4; // safety ceiling — never loop indefinitely on tool calls

export async function runConversationTurn(userId: string, history: ChatMessage[]): Promise<{ text: string; toolCallsUsed: string[] }> {
  const adapter = await buildAdapter();
  const toolCallsUsed: string[] = [];
  let pendingToolResults: ToolResult[] | undefined = undefined;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await adapter.sendMessage({
      systemPrompt: SYSTEM_PROMPT,
      history,
      tools: TOOL_DEFINITIONS,
      pendingToolResults,
    });

    if (response.type === 'text') {
      return { text: response.text, toolCallsUsed };
    }

    // response.type === 'tool_calls' — execute each via the Tool Layer,
    // always scoped to THIS conversation's userId, never anything the
    // model itself supplied.
    const results: ToolResult[] = [];
    for (const call of response.toolCalls) {
      toolCallsUsed.push(call.name);
      try {
        const result = await executeTool(userId, call.name, call.arguments);
        results.push({ toolCallId: call.id, name: call.name, result });
      } catch (err: any) {
        results.push({ toolCallId: call.id, name: call.name, result: { error: err.message ?? 'Tool execution failed' } });
      }
    }
    pendingToolResults = results;
  }

  throw new Error('Ask Ponna could not produce a final answer within the tool-call limit.');
}

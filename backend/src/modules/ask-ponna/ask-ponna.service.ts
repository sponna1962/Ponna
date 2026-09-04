// Ask Ponna Service — conversation persistence + fair-use limit
// enforcement (finalized requirement: "Gemini free-tier limits must NOT
// be treated as unlimited"). Calls the Orchestrator for the actual AI
// turn; has no idea which provider is behind it (Spec v3 §1.3).

import { AskPonnaMessageRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { runConversationTurn } from './orchestrator';
import { ChatMessage } from './provider-adapter';

export class AskPonnaLimitError extends Error {}
export class AskPonnaAccessError extends Error {}

export class AskPonnaService {
  private async hasPaidAccess(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isTestAccount: true } });
    if (user?.isTestAccount) return true;
    const activeSub = await prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', cycleEnd: { gt: new Date() }, plan: { isFree: false } },
    });
    return !!activeSub;
  }

  /** Configurable, per-tier daily message cap (finalized requirement) —
   * counts today's USER-role messages across all of this student's
   * conversations. Test Accounts bypass entirely, same pattern as every
   * other limit on this platform. */
  private async checkDailyLimit(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isTestAccount: true } });
    if (user?.isTestAccount) return;

    const settings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: 'singleton' } });
    const isPaid = await this.hasPaidAccess(userId);
    const limit = isPaid ? settings.askPonnaDailyLimitPaid : settings.askPonnaDailyLimitFree;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const sentToday = await prisma.askPonnaMessage.count({
      where: {
        role: AskPonnaMessageRole.USER,
        createdAt: { gte: startOfToday },
        conversation: { userId },
      },
    });

    if (sentToday >= limit) {
      throw new AskPonnaLimitError(`Daily Ask Ponna message limit reached (${limit}/day). Please try again tomorrow.`);
    }
  }

  async listConversations(userId: string) {
    return prisma.askPonnaConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, updatedAt: true, createdAt: true },
    });
  }

  async getConversation(userId: string, conversationId: string) {
    const convo = await prisma.askPonnaConversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!convo || convo.userId !== userId) throw new Error('Conversation not found.');
    return convo;
  }

  async deleteConversation(userId: string, conversationId: string) {
    const convo = await prisma.askPonnaConversation.findUnique({ where: { id: conversationId } });
    if (!convo || convo.userId !== userId) throw new Error('Conversation not found.');
    await prisma.askPonnaMessage.deleteMany({ where: { conversationId } });
    await prisma.askPonnaConversation.delete({ where: { id: conversationId } });
  }

  /** Sends one user message (optionally starting a new conversation),
   * runs it through the Orchestrator, persists both the user message and
   * the assistant's reply, returns the reply. */
  async sendMessage(userId: string, conversationId: string | null, userMessage: string) {
    if (!(await this.hasPaidAccess(userId))) {
      throw new AskPonnaAccessError('Ask Ponna requires an active Annual Plan.');
    }
    await this.checkDailyLimit(userId);

    let convo = conversationId ? await prisma.askPonnaConversation.findUnique({ where: { id: conversationId } }) : null;
    if (convo && convo.userId !== userId) throw new Error('Conversation not found.');
    if (!convo) {
      convo = await prisma.askPonnaConversation.create({
        data: { userId, title: userMessage.slice(0, 60) },
      });
    }

    const priorMessages = await prisma.askPonnaMessage.findMany({
      where: { conversationId: convo.id },
      orderBy: { createdAt: 'asc' },
    });

    await prisma.askPonnaMessage.create({
      data: { conversationId: convo.id, role: AskPonnaMessageRole.USER, content: userMessage },
    });

    const history: ChatMessage[] = [
      ...priorMessages.map((m) => ({ role: m.role === AskPonnaMessageRole.USER ? ('user' as const) : ('assistant' as const), content: m.content })),
      { role: 'user', content: userMessage },
    ];

    const { text, toolCallsUsed } = await runConversationTurn(userId, history);

    await prisma.askPonnaMessage.create({
      data: {
        conversationId: convo.id,
        role: AskPonnaMessageRole.ASSISTANT,
        content: text,
        toolCallsUsed: toolCallsUsed.length > 0 ? toolCallsUsed : undefined,
      },
    });
    await prisma.askPonnaConversation.update({ where: { id: convo.id }, data: { updatedAt: new Date() } });

    return { conversationId: convo.id, reply: text, toolCallsUsed };
  }
}

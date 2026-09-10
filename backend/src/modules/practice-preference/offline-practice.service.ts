// Offline Practice (Sept 2026, dedicated phase) — download a fixed pack
// of questions (with full content, including answers/explanations, since
// there's no server round-trip available offline) for the student to
// practice with no network, then sync the answers back once reconnected.
//
// Mirrors session.service.ts's own startSession() pattern deliberately —
// same allocation.buildSessionQuestionIds() (no-repeat aware) and same
// quota.reserveQuota() (deducted at DOWNLOAD time, not sync time) — this
// is a separate flow (OfflinePack, not QuizSession) but reuses the exact
// same underlying question-picking and quota mechanisms rather than
// reinventing them.

import { CorrectOption } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { QuotaService, QuotaExceededError } from '../quota/quota.service';
import { AllocationService } from '../questions/allocation.service';
import { PracticePreferenceService } from './practice-preference.service';
import { backfillStreakForDates } from './streak.service';
import { MistakeReviewService } from '../questions/mistake-review.service';

const PACK_SIZE = 20;

const quota = new QuotaService();
const allocation = new AllocationService();
const preferenceService = new PracticePreferenceService();
const mistakeReview = new MistakeReviewService();

export class OfflinePracticeService {
  /** Creates a new pack for this student — reuses their saved Practice
   * Preference exactly like a normal session start. Deducts quota
   * immediately (same reservation call a normal session uses), so a
   * student can't download a pack and also practice online in parallel
   * for double quota. Returns full question content, including the
   * correct answer and explanation, for offline use.
   *
   * Idempotent: if this student already has an ACTIVE (unsynced) pack,
   * that SAME pack is returned — quota is never deducted twice for a
   * duplicate/retried download request. A student gets a genuinely new
   * pack only after fully syncing (or the pack is otherwise cleared) —
   * one active pack at a time, matching the frontend's own IndexedDB
   * design. */
  async createPack(userId: string) {
    const existing = await prisma.offlinePack.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return this.formatPackResponse(existing.id);
    }

    const preference = await preferenceService.get(userId);
    if (!preference) {
      throw new Error('No practice preference saved yet — complete Practice Setup first.');
    }

    const remainingQuota = await quota.getRemainingQuota(userId, preference.selections as any);
    if (remainingQuota <= 0) {
      const blocked = await quota.getBlockedReason(userId, preference.selections as any);
      throw new QuotaExceededError(blocked.reason, blocked.code as any);
    }

    const taxonomyFilter = preferenceService.resolveTaxonomyFilter(preference.selections as any);
    const singleSubCategoryId = preferenceService.extractSingleSubCategoryId(preference.selections as any);
    const subjectTopicPreference = singleSubCategoryId
      ? await prisma.studentSubjectTopicPreference.findUnique({
          where: { userId_subCategoryId: { userId, subCategoryId: singleSubCategoryId } },
          select: { subjectIds: true, topicIds: true },
        })
      : null;

    const questionIds = await allocation.buildSessionQuestionIds(
      userId,
      preference.mode,
      Math.min(remainingQuota, PACK_SIZE),
      preference.language,
      taxonomyFilter,
      subjectTopicPreference,
    );
    if (questionIds.length === 0) {
      throw new Error('No eligible questions match your Practice Preferences right now. Try widening your selections in Change Preferences.');
    }

    const quotaResult = await quota.reserveQuota(userId, questionIds.length, preference.selections as any);
    if (!quotaResult.allowed) {
      throw new QuotaExceededError(quotaResult.reason ?? 'Quota exceeded', quotaResult.code);
    }

    const pack = await prisma.offlinePack.create({
      data: {
        userId,
        items: {
          create: questionIds.map((questionId, i) => ({ questionId, sequenceNumber: i + 1 })),
        },
      },
    });

    return this.formatPackResponse(pack.id);
  }

  /** Full question content for a pack's items, keyed by their existing
   * sequenceNumber — shared by both the freshly-created path and the
   * idempotent "already have an active pack" path above, so both return
   * identically-shaped data. */
  private async formatPackResponse(packId: string) {
    const items = await prisma.offlinePackItem.findMany({
      where: { packId },
      orderBy: { sequenceNumber: 'asc' },
      select: {
        sequenceNumber: true,
        question: {
          select: {
            id: true,
            questionText: true,
            optionA: true,
            optionB: true,
            optionC: true,
            optionD: true,
            correctOption: true,
            explanationTa: true,
            explanationEn: true,
            language: true,
            difficulty: true,
          },
        },
      },
    });

    return {
      packId,
      questions: items.map((item) => ({ sequenceNumber: item.sequenceNumber, ...item.question })),
    };
  }

  /** Syncs offline-recorded answers back. Each answer's `answeredAt` is
   * the DEVICE's own recorded timestamp — used for streak backfill,
   * never the sync moment. Records into UserQuestionHistory (so
   * Performance/ranking reflect offline practice too) and Review
   * Mistakes (same as a normal wrong answer would) — everything else
   * (quota, no-repeat) was already settled at download time and is
   * untouched here. Safe to call multiple times for the same pack (e.g.
   * a partial sync that got interrupted) — already-synced items are
   * skipped. */
  /** Sept 2026 (BINDING) — server-side validation of a claimed offline
   * answer time. Never blindly trusts the device's clock: a valid
   * answeredAt must fall between this pack's own download time
   * (createdAt — can't have answered before downloading) and the moment
   * of this sync call (can't claim a future date). Anything outside that
   * window is clamped to the nearer boundary rather than trusted as-is —
   * this is what closes the "change my phone's clock to fake a longer
   * streak" gap. */
  private clampAnsweredAt(claimed: Date, packCreatedAt: Date, syncTime: Date): Date {
    if (Number.isNaN(claimed.getTime())) return syncTime;
    if (claimed < packCreatedAt) return packCreatedAt;
    if (claimed > syncTime) return syncTime;
    return claimed;
  }

  async syncPack(userId: string, packId: string, answers: { questionId: string; selectedOption: CorrectOption; answeredAt: string }[]) {
    const pack = await prisma.offlinePack.findUniqueOrThrow({
      where: { id: packId },
      include: { items: true },
    });
    if (pack.userId !== userId) throw new Error('This offline pack does not belong to you.');

    const syncTime = new Date();
    const itemByQuestionId = new Map(pack.items.map((i) => [i.questionId, i]));
    const activityDates: Date[] = [];

    for (const answer of answers) {
      const item = itemByQuestionId.get(answer.questionId);
      if (!item || item.synced) continue; // not part of this pack, or already synced — idempotent re-sync

      const question = await prisma.question.findUniqueOrThrow({ where: { id: answer.questionId }, select: { correctOption: true, difficulty: true } });
      const isCorrect = question.correctOption === answer.selectedOption;
      const answeredAtClient = this.clampAnsweredAt(new Date(answer.answeredAt), pack.createdAt, syncTime);

      await prisma.offlinePackItem.update({
        where: { id: item.id },
        data: { selectedOption: answer.selectedOption, isCorrect, answeredAtClient, synced: true },
      });

      // Same permanent record normal Practice writes, so Performance/
      // ranking reflect offline answers too — upsert per the model's own
      // repetition policy (unique on userId+questionId).
      await prisma.userQuestionHistory.upsert({
        where: { userId_questionId: { userId, questionId: answer.questionId } },
        create: { userId, questionId: answer.questionId, difficulty: question.difficulty ?? 'MEDIUM', modeTakenIn: 'MIXED', answeredCorrectly: isCorrect, answeredAt: answeredAtClient },
        update: { answeredCorrectly: isCorrect, answeredAt: answeredAtClient },
      });

      if (!isCorrect) {
        await mistakeReview.recordMistake(userId, answer.questionId).catch(() => {});
      }

      const istDate = new Date(Date.UTC(answeredAtClient.getUTCFullYear(), answeredAtClient.getUTCMonth(), answeredAtClient.getUTCDate()));
      activityDates.push(istDate);
    }

    if (activityDates.length > 0) {
      await backfillStreakForDates(userId, activityDates);
    }

    const remaining = await prisma.offlinePackItem.count({ where: { packId, synced: false } });
    if (remaining === 0) {
      await prisma.offlinePack.update({ where: { id: packId }, data: { status: 'SYNCED', syncedAt: new Date() } });
    }

    return { synced: answers.length, remaining };
  }
}

export const offlinePracticeService = new OfflinePracticeService();

// Platform Settings Service — implements §7.7 (Repetition & Allocation
// Settings) plus the AI threshold and ranking eligibility settings that live
// in the same singleton row. This is the single source of truth every other
// service (allocation, classification, ranking) reads from — changing a
// value here takes effect immediately, no deploy required.

import { prisma } from '../../lib/prisma';

const EDITABLE_FIELDS = [
  'repetitionStrategy',
  'repeatAfterDays',
  'caMaxFor5Q',
  'caMaxFor20Q',
  'caMaxFor50Q',
  'caRecencyWindowDays',
  'aiConfidenceThreshold',
  'rankingEligibilityMinQuestions',
  'sessionInactivityHours',
  'dailyQuizEnabled',
  'dailyQuizDefaultPublishTime',
  'brainChallengeEnabled',
  'brainChallengeDefaultPublishTime',
  'subjectTopicPreferenceWeightPercent',
  'askPonnaEnabled',
  'askPonnaProvider',
  'askPonnaModel',
  'askPonnaDailyLimitFree',
  'askPonnaDailyLimitPaid',
  'whatsappReminderEnabled',
  'whatsappTemplateName',
  'whatsappReminderInactivityDays',
] as const;

export class SettingsService {
  async get() {
    return prisma.platformSettings.findUniqueOrThrow({ where: { id: 'singleton' } });
  }

  async update(patch: Record<string, unknown>) {
    const data: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) {
      if (field in patch) data[field] = patch[field];
    }
    return prisma.platformSettings.update({ where: { id: 'singleton' }, data });
  }
}

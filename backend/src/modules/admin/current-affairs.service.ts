// Current Affairs — admin management (Ask Ponna Master Requirement,
// Spec v4/v5, BINDING). Tier 1 source for current-affairs questions;
// search_current_info (Tier 3) is the live-search fallback when nothing
// recent enough exists here.

import { prisma } from '../../lib/prisma';

export class CurrentAffairsService {
  async list(limit = 20) {
    return prisma.currentAffairsItem.findMany({ orderBy: { date: 'desc' }, take: limit });
  }

  async create(data: { date: string; headline: string; summary: string; sourceUrl?: string; examRelevanceNote?: string; verifiedAt: string }) {
    return prisma.currentAffairsItem.create({
      data: {
        date: new Date(data.date),
        headline: data.headline.trim(),
        summary: data.summary.trim(),
        sourceUrl: data.sourceUrl?.trim() || null,
        examRelevanceNote: data.examRelevanceNote?.trim() || null,
        verifiedAt: new Date(data.verifiedAt),
      },
    });
  }

  async delete(id: string) {
    await prisma.currentAffairsItem.delete({ where: { id } });
  }
}

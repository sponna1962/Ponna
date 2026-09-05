// PONNA Feature FAQ — admin management (Ask Ponna Master Requirement
// §15, Spec v4/v5, BINDING). Canonical Q&A about PONNA's own features,
// so Ask Ponna paraphrases verified answers rather than describing
// features from its own possibly-stale understanding.

import { prisma } from '../../lib/prisma';

export class PonnaFaqService {
  async list(featureKey?: string) {
    return prisma.ponnaFeatureFAQ.findMany({
      where: featureKey ? { featureKey } : undefined,
      orderBy: { featureKey: 'asc' },
    });
  }

  async create(data: { featureKey: string; question: string; answer: string }) {
    return prisma.ponnaFeatureFAQ.create({
      data: { featureKey: data.featureKey.trim(), question: data.question.trim(), answer: data.answer.trim() },
    });
  }

  async update(id: string, data: { question?: string; answer?: string }) {
    return prisma.ponnaFeatureFAQ.update({
      where: { id },
      data: {
        ...(data.question !== undefined ? { question: data.question.trim() } : {}),
        ...(data.answer !== undefined ? { answer: data.answer.trim() } : {}),
      },
    });
  }

  async delete(id: string) {
    await prisma.ponnaFeatureFAQ.delete({ where: { id } });
  }
}

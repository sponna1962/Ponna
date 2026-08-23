// Profile Service — implements the profile-completion requirement:
//   - Initial signup stays minimal: name + phone/OTP only (see student-auth.service.ts)
//   - District, City/Town/Village, and Preparing For (multiple) are only
//     REQUIRED when the student tries to view Rank or pay for a plan —
//     never forced at signup, and free practice / basic score viewing never
//     require them.
//
// "Profile complete" is a derived boolean, not a stored flag, so it can
// never drift out of sync with the underlying fields.

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export function isProfileComplete(user: {
  district: string | null;
  cityTownVillage: string | null;
  preparingFor: string[];
}): boolean {
  return !!user.district && !!user.cityTownVillage && user.preparingFor.length > 0;
}

export class ProfileService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { plan: true },
          orderBy: { cycleStart: 'desc' },
          take: 1,
        },
      },
    });

    const activeSub = user.subscriptions[0];

    return {
      name: user.name,
      phone: user.phone,
      district: user.district,
      cityTownVillage: user.cityTownVillage,
      preparingFor: user.preparingFor,
      preferredLang: user.preferredLang,
      profileComplete: isProfileComplete(user),
      planCode: activeSub?.plan.code ?? 'FREE',
      planName: activeSub?.plan.name ?? 'Free',
      planExpiresAt: activeSub?.cycleEnd ?? null,
    };
  }

  /** Only the profile-completion fields (and name) are editable here — phone is fixed by Firebase auth. */
  async updateProfile(
    userId: string,
    data: { name?: string; district?: string; cityTownVillage?: string; preparingFor?: string[] },
  ) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.district !== undefined ? { district: data.district } : {}),
        ...(data.cityTownVillage !== undefined ? { cityTownVillage: data.cityTownVillage } : {}),
        ...(data.preparingFor !== undefined ? { preparingFor: data.preparingFor } : {}),
      },
    });
    return { profileComplete: isProfileComplete(updated) };
  }
}

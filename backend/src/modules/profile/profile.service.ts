// Profile Service — finalized Profile redesign. Personal Information +
// Education only; Subscription info lives in My Plans, exam selection in
// Start Practice (never duplicated here). Initial signup stays minimal
// (name + phone/OTP only, see student-auth.service.ts) — every field below
// is only REQUIRED at the application layer (isProfileComplete), gated the
// same way as before: never forced at signup, only when the student tries
// to view Rank or pay for a plan.
//
// Education/Date of Birth are stored in structured fields for FUTURE
// personalization only — explicitly NOT used anywhere to restrict exam
// access or drive a recommendation system (finalized requirement).

import { PrismaClient, EducationStatus } from '@prisma/client';
const prisma = new PrismaClient();

export function isProfileComplete(user: {
  name: string | null;
  dateOfBirth: Date | null;
  email: string | null;
  whatsappNumber: string | null;
  district: string | null;
  cityTownVillage: string | null;
  educationStatus: EducationStatus | null;
  currentClass: string | null;
  courseOrDegree: string | null;
  yearOfStudy: string | null;
  highestQualification: string | null;
}): boolean {
  const baseComplete =
    !!user.name &&
    !!user.dateOfBirth &&
    !!user.email &&
    !!user.whatsappNumber &&
    !!user.district &&
    !!user.cityTownVillage &&
    !!user.educationStatus;
  if (!baseComplete) return false;

  // Exactly one detail field is required, matching the chosen status.
  if (user.educationStatus === 'SCHOOL_STUDENT') return !!user.currentClass;
  if (user.educationStatus === 'COLLEGE_STUDENT') return !!user.courseOrDegree && !!user.yearOfStudy;
  if (user.educationStatus === 'COMPLETED_STUDIES') return !!user.highestQualification;
  return false;
}

export class ProfileService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    return {
      name: user.name,
      phone: user.phone,
      photoUrl: user.photoUrl,
      dateOfBirth: user.dateOfBirth,
      email: user.email,
      whatsappNumber: user.whatsappNumber,
      district: user.district,
      cityTownVillage: user.cityTownVillage,
      educationStatus: user.educationStatus,
      currentClass: user.currentClass,
      courseOrDegree: user.courseOrDegree,
      yearOfStudy: user.yearOfStudy,
      highestQualification: user.highestQualification,
      profileComplete: isProfileComplete(user),
    };
  }

  /** Phone is fixed by Firebase auth — never editable here. */
  async updateProfile(
    userId: string,
    data: {
      name?: string;
      dateOfBirth?: string; // ISO date string from the form; converted to a real Date below
      email?: string;
      whatsappNumber?: string;
      district?: string;
      cityTownVillage?: string;
      educationStatus?: EducationStatus | '';
      currentClass?: string;
      courseOrDegree?: string;
      yearOfStudy?: string;
      highestQualification?: string;
    },
  ) {
    // Switching educationStatus clears the OTHER two detail fields — a
    // student who was College and switches to School shouldn't leave a
    // stale courseOrDegree/yearOfStudy sitting in the database.
    const educationClears: Record<string, object> = {
      SCHOOL_STUDENT: { courseOrDegree: null, yearOfStudy: null, highestQualification: null },
      COLLEGE_STUDENT: { currentClass: null, highestQualification: null },
      COMPLETED_STUDIES: { currentClass: null, courseOrDegree: null, yearOfStudy: null },
    };

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.dateOfBirth !== undefined ? { dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null } : {}),
        ...(data.email !== undefined ? { email: data.email || null } : {}),
        ...(data.whatsappNumber !== undefined ? { whatsappNumber: data.whatsappNumber } : {}),
        ...(data.district !== undefined ? { district: data.district } : {}),
        ...(data.cityTownVillage !== undefined ? { cityTownVillage: data.cityTownVillage } : {}),
        ...(data.educationStatus !== undefined
          ? { educationStatus: data.educationStatus || null, ...(data.educationStatus ? educationClears[data.educationStatus] : {}) }
          : {}),
        ...(data.currentClass !== undefined ? { currentClass: data.currentClass } : {}),
        ...(data.courseOrDegree !== undefined ? { courseOrDegree: data.courseOrDegree } : {}),
        ...(data.yearOfStudy !== undefined ? { yearOfStudy: data.yearOfStudy } : {}),
        ...(data.highestQualification !== undefined ? { highestQualification: data.highestQualification } : {}),
      },
    });
    return { profileComplete: isProfileComplete(updated) };
  }
}

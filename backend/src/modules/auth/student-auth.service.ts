// Student Auth Service — implements §4.1 (Account) using Firebase Phone Auth.
//
// Flow: the frontend uses Firebase's client SDK to send/verify the OTP
// directly with Firebase (Google's servers) — this backend never sees the
// OTP itself. Once Firebase confirms the phone number, the frontend gets a
// Firebase ID token and sends it here. We verify that token server-side
// (proves it's genuinely from Firebase, not spoofed), then find-or-create
// the User record and issue our OWN JWT for the student's session — kept
// separate from Firebase's token so the rest of the app (quiz, dashboard,
// quota) only ever needs to understand one auth scheme.

import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

let firebaseInitialized = false;
function ensureFirebaseInitialized() {
  if (firebaseInitialized) return;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountJson) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY is not set — student login is unavailable until this is configured.',
    );
  }
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
  });
  firebaseInitialized = true;
}

export class StudentAuthService {
  /**
   * Verifies a Firebase ID token (obtained by the frontend after successful
   * OTP verification), then finds or creates the matching User by phone
   * number, and issues our own session JWT.
   */
  async loginWithFirebaseToken(firebaseIdToken: string) {
    ensureFirebaseInitialized();

    const decoded = await admin.auth().verifyIdToken(firebaseIdToken);
    const phone = decoded.phone_number;
    if (!phone) {
      throw new Error('Firebase token did not include a verified phone number');
    }

    const user = await prisma.user.upsert({
      where: { phone },
      create: { phone },
      update: {}, // nothing to update on repeat logins — just fetch existing record
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    return { token, userId: user.id };
  }
}

// ── Express middleware — mirrors staff-auth.service.ts's pattern ──────────

export interface StudentAuthedRequest extends Request {
  studentUserId?: string;
}

export function requireStudentAuth(req: StudentAuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { userId: string };
    req.studentUserId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

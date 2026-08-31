// Student Auth Service — Phone OTP (unchanged) + Google Sign-In (new),
// both via Firebase, with secure account-linking between them.
//
// Core design decision (finalized requirement): the Firebase UID is the
// ONE canonical identity key. A single Firebase Auth user can have BOTH a
// Phone credential and a Google credential attached (via Firebase's own
// linkWithPopup, called client-side while already signed in) — linking
// never changes the uid, so once linked, either provider's token resolves
// to the exact same uid, and therefore the exact same User row here.
//
// What this deliberately does NOT do: silently merge two separate accounts
// just because their email/phone happen to match. A Google sign-in whose
// email matches an existing PHONE-only account's profile email is treated
// as a genuine conflict to hand back to the student to resolve safely (log
// in with Phone, then link Google from Profile) — never an automatic merge.

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

/** Thrown when a Google sign-in's email matches an existing account that
 * isn't linked to this Google identity yet — the safe conflict response
 * instead of an automatic merge. */
export class AccountLinkingConflictError extends Error {
  constructor() {
    super(
      'An account with this email already exists. Please log in with Phone OTP, then connect Google from your Profile to link the two.',
    );
    this.name = 'AccountLinkingConflictError';
  }
}

export class StudentAuthService {
  /**
   * Verifies a Firebase ID token (Phone OTP or Google — both arrive the
   * same shape) and finds or creates the matching User, resolving by
   * Firebase uid first (the canonical key).
   */
  async loginWithFirebaseToken(firebaseIdToken: string) {
    ensureFirebaseInitialized();

    const decoded = await admin.auth().verifyIdToken(firebaseIdToken);
    const uid = decoded.uid;
    const phone = decoded.phone_number ?? null;
    const email = decoded.email ?? null;

    // 1. Already-known Firebase identity (whichever provider they used to
    // sign in this time — Phone and Google both resolve here once linked).
    let user = await prisma.user.findUnique({ where: { firebaseUid: uid } });
    if (user) {
      return this.issueSession(user.id);
    }

    if (phone) {
      // 2a. Phone sign-in, uid not seen before — backward-compat backfill
      // for accounts created before firebaseUid existed on this schema:
      // same phone number, no uid recorded yet. Never creates a conflict
      // (phone numbers are inherently unique per Firebase project already).
      const existingByPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingByPhone) {
        user = await prisma.user.update({ where: { id: existingByPhone.id }, data: { firebaseUid: uid } });
        return this.issueSession(user.id);
      }
      // Brand-new phone — normal signup.
      user = await prisma.user.create({ data: { firebaseUid: uid, phone } });
      return this.issueSession(user.id);
    }

    if (email) {
      // 2b. Google sign-in, uid not seen before. If an existing account's
      // PROFILE email matches but it has no firebaseUid of its own linked
      // yet (i.e. a Phone-only account whose student typed this same email
      // into Profile), this is exactly the case the finalized requirement
      // says must NOT auto-merge — hand it back as a conflict instead.
      const existingByEmail = await prisma.user.findUnique({ where: { email } });
      if (existingByEmail && !existingByEmail.firebaseUid) {
        throw new AccountLinkingConflictError();
      }
      // No conflicting account — genuinely new Google-only signup.
      user = await prisma.user.create({ data: { firebaseUid: uid, email } });
      return this.issueSession(user.id);
    }

    throw new Error('Firebase token included neither a phone number nor an email — cannot identify the student.');
  }

  /**
   * Links a Google credential to the CURRENTLY authenticated student's
   * account. Called after the frontend has already run Firebase's
   * `linkWithPopup(auth.currentUser, googleProvider)` client-side — which
   * keeps the same Firebase uid, so this is mostly a confirmation + Profile
   * email capture, not a re-authentication. Still independently re-verifies
   * the token server-side (never trust a client-reported "it worked").
   */
  async linkGoogleAccount(studentUserId: string, firebaseIdToken: string) {
    ensureFirebaseInitialized();

    const decoded = await admin.auth().verifyIdToken(firebaseIdToken);
    const uid = decoded.uid;
    const email = decoded.email;
    if (!email) {
      throw new Error('This Firebase token has no Google email — nothing to link.');
    }

    const self = await prisma.user.findUniqueOrThrow({ where: { id: studentUserId } });

    // Genuine conflict: this Google identity (uid) is already the
    // canonical identity of a DIFFERENT account than the one currently
    // logged in — e.g. they previously did a fresh "Continue with Google"
    // with this same Google account, creating a separate student record.
    // Firebase's own linkWithPopup would normally catch this client-side
    // (auth/credential-already-in-use) before we even get here, but we
    // never trust that alone — re-checked server-side too.
    if (self.firebaseUid && self.firebaseUid !== uid) {
      throw new Error(
        'This Google account is linked to a different PONNA account than the one you are logged in as. Please contact support to resolve this.',
      );
    }
    const other = await prisma.user.findUnique({ where: { firebaseUid: uid } });
    if (other && other.id !== self.id) {
      throw new Error('This Google account is already linked to a different PONNA account.');
    }

    await prisma.user.update({
      where: { id: self.id },
      data: {
        firebaseUid: uid,
        // Only fills Profile's email if it was empty — linking never
        // overwrites something the student already typed themselves.
        email: self.email ?? email,
      },
    });
    return { linked: true };
  }

  private issueSession(userId: string) {
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
    return { token, userId };
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

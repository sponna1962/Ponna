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

/** Thrown when this login is from a genuinely new device and the account
 * already has 2 registered devices (finalized requirement) — carries the
 * existing devices so the frontend can offer "remove one to continue"
 * without needing a real session token yet. */
export class DeviceLimitReachedError extends Error {
  devices: { deviceId: string; label: string | null; lastSeenAt: Date }[];
  constructor(devices: { deviceId: string; label: string | null; lastSeenAt: Date }[]) {
    super('This account is already signed in on 2 devices. Remove one to continue on this device.');
    this.name = 'DeviceLimitReachedError';
    this.devices = devices;
  }
}

const MAX_DEVICES_PER_ACCOUNT = 2;

export class StudentAuthService {
  /**
   * Verifies a Firebase ID token (Phone OTP or Google — both arrive the
   * same shape) and finds or creates the matching User, resolving by
   * Firebase uid first (the canonical key). `deviceId` is the CLIENT's
   * persisted device identifier (see Device model) — required so the
   * 2-device cap and single-active-session enforcement can register this
   * login. Throws DeviceLimitReachedError instead of issuing a session
   * when this is a genuinely new (3rd+) device.
   */
  async loginWithFirebaseToken(firebaseIdToken: string, deviceId: string, deviceLabel?: string, ip?: string) {
    ensureFirebaseInitialized();

    const decoded = await admin.auth().verifyIdToken(firebaseIdToken);
    const uid = decoded.uid;
    const phone = decoded.phone_number ?? null;
    const email = decoded.email ?? null;
    // Google's account photo (OIDC "picture" claim) — auto-captured on
    // first Google sign-in only, see the photoUrl backfill below and on
    // create. A student's own later upload (Part B) always takes
    // precedence once set; this never overwrites a non-null photoUrl.
    const googlePicture = decoded.picture ?? null;

    // 1. Already-known Firebase identity (whichever provider they used to
    // sign in this time — Phone and Google both resolve here once linked).
    let user = await prisma.user.findUnique({ where: { firebaseUid: uid } });
    if (user) {
      if (!user.photoUrl && googlePicture) {
        user = await prisma.user.update({ where: { id: user.id }, data: { photoUrl: googlePicture } });
      }
      if (ip) await prisma.user.update({ where: { id: user.id }, data: { lastLoginIp: ip } });
      await this.registerDevice(user.id, deviceId, deviceLabel);
      return this.issueSession(user.id);
    }

    if (phone) {
      // 2a. Phone sign-in, uid not seen before — backward-compat backfill
      // for accounts created before firebaseUid existed on this schema:
      // same phone number, no uid recorded yet. Never creates a conflict
      // (phone numbers are inherently unique per Firebase project already).
      const existingByPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingByPhone) {
        user = await prisma.user.update({ where: { id: existingByPhone.id }, data: { firebaseUid: uid, ...(ip ? { lastLoginIp: ip } : {}) } });
        await this.registerDevice(user.id, deviceId, deviceLabel);
        return this.issueSession(user.id);
      }
      // Brand-new phone — normal signup. signupIp captured once, here,
      // never overwritten again (see the suspicious-usage sweep's
      // account-clustering signal, anti-abuse.service.ts).
      user = await prisma.user.create({ data: { firebaseUid: uid, phone, signupIp: ip, lastLoginIp: ip } });
      await this.registerDevice(user.id, deviceId, deviceLabel);
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
      user = await prisma.user.create({ data: { firebaseUid: uid, email, photoUrl: googlePicture, signupIp: ip, lastLoginIp: ip } });
      await this.registerDevice(user.id, deviceId, deviceLabel);
      return this.issueSession(user.id);
    }

    throw new Error('Firebase token included neither a phone number nor an email — cannot identify the student.');
  }

  /**
   * Registers this login's device (or updates lastSeenAt if it's already
   * known) — throws DeviceLimitReachedError before touching anything if
   * this is a genuinely new device and the account is already at the cap.
   * Called on every successful login, before issueSession.
   */
  private async registerDevice(userId: string, deviceId: string, label?: string) {
    const existing = await prisma.device.findUnique({ where: { userId_deviceId: { userId, deviceId } } });
    if (existing) {
      await prisma.device.update({ where: { id: existing.id }, data: { lastSeenAt: new Date(), ...(label ? { label } : {}) } });
      return;
    }

    const count = await prisma.device.count({ where: { userId } });
    if (count >= MAX_DEVICES_PER_ACCOUNT) {
      const devices = await prisma.device.findMany({
        where: { userId },
        select: { deviceId: true, label: true, lastSeenAt: true },
        orderBy: { lastSeenAt: 'asc' },
      });
      throw new DeviceLimitReachedError(devices);
    }

    await prisma.device.create({ data: { userId, deviceId, label } });
    await prisma.user.update({ where: { id: userId }, data: { totalDeviceRegistrations: { increment: 1 } } });
  }

  /** Lists a student's registered devices — "My Devices" settings page. */
  async listDevices(userId: string) {
    return prisma.device.findMany({ where: { userId }, orderBy: { lastSeenAt: 'desc' } });
  }

  /**
   * Removes one device — used both from the logged-in "My Devices" page
   * (studentUserId already known) and from the login-time "device limit
   * reached" flow (student isn't logged in yet, so re-verifies the SAME
   * Firebase ID token they just tried to log in with, rather than trusting
   * a client-supplied userId).
   */
  async removeDevice(userId: string, deviceId: string) {
    await prisma.device.deleteMany({ where: { userId, deviceId } });
  }

  async removeDeviceViaFirebaseToken(firebaseIdToken: string, deviceIdToRemove: string) {
    ensureFirebaseInitialized();
    const decoded = await admin.auth().verifyIdToken(firebaseIdToken);
    const user = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
    if (!user) throw new Error('No account found for this Firebase identity.');
    await this.removeDevice(user.id, deviceIdToRemove);
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
        // Same rule as first-time Google sign-in — only captured if no
        // photo is set yet, never overwrites a manual upload.
        photoUrl: self.photoUrl ?? decoded.picture ?? undefined,
      },
    });
    return { linked: true };
  }

  /**
   * Links a verified phone number to the CURRENTLY authenticated student's
   * account (finalized requirement — Free Preview requires a verified
   * phone, and a Google-only account has none by default). Mirrors
   * linkGoogleAccount: the frontend runs Firebase's own
   * `linkWithPhoneNumber(auth.currentUser, ...)` client-side first (same
   * uid, now with a phone_number claim), then this re-verifies the
   * resulting token server-side and syncs it onto the User row — never
   * trusts a client-reported "it worked" alone.
   */
  async linkPhoneNumber(studentUserId: string, firebaseIdToken: string) {
    ensureFirebaseInitialized();

    const decoded = await admin.auth().verifyIdToken(firebaseIdToken);
    const uid = decoded.uid;
    const phone = decoded.phone_number;
    if (!phone) {
      throw new Error('This Firebase token has no verified phone number — nothing to link.');
    }

    const self = await prisma.user.findUniqueOrThrow({ where: { id: studentUserId } });

    if (self.firebaseUid && self.firebaseUid !== uid) {
      throw new Error('This phone number is linked to a different PONNA account than the one you are logged in as. Please contact support to resolve this.');
    }
    // The phone-uniqueness constraint itself is what makes "one phone = one
    // Free Preview" hold — if this exact number is already SOME other
    // account's phone, that's a genuine conflict, not a re-link (Firebase
    // would normally resolve a repeat OTP verification back to that OTHER
    // account's uid instead, so this case is rare, but never silently
    // overwritten either way).
    const other = await prisma.user.findUnique({ where: { phone } });
    if (other && other.id !== self.id) {
      throw new Error('This phone number is already linked to a different PONNA account.');
    }

    await prisma.user.update({
      where: { id: self.id },
      data: { firebaseUid: uid, phone: self.phone ?? phone },
    });
    return { linked: true };
  }

  private async issueSession(userId: string) {
    // Single-active-session enforcement (finalized requirement) —
    // incrementing sessionVersion here invalidates whatever token was
    // issued to any OTHER device, since requireStudentAuth below rejects
    // any token whose embedded version doesn't match the CURRENT value.
    const user = await prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
    const token = jwt.sign({ userId, sessionVersion: user.sessionVersion }, JWT_SECRET, { expiresIn: '30d' });
    return { token, userId };
  }
}

// ── Express middleware — mirrors staff-auth.service.ts's pattern ──────────

export interface StudentAuthedRequest extends Request {
  studentUserId?: string;
}

export async function requireStudentAuth(req: StudentAuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { userId: string; sessionVersion: number };
    // Single-active-session check (finalized requirement) — a token from a
    // device that has since been superseded by a newer login elsewhere
    // fails here with a specific code the frontend recognizes, rather than
    // a generic "invalid token" — see studentFetch.ts on the frontend.
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { sessionVersion: true } });
    if (!user || user.sessionVersion !== payload.sessionVersion) {
      return res.status(401).json({ error: 'This account was logged in on another device.', code: 'SESSION_INVALIDATED' });
    }
    req.studentUserId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Staff Auth Service — implements §3 (User Roles) and §7.8 (Staff & Roles).
// Multiple admin/staff accounts from day one, each with SUPER_ADMIN,
// CONTENT_ADMIN, or VIEWER_STAFF role. This is a minimal JWT-based scheme;
// swap bcrypt rounds / JWT secret handling for production hardening.

import { StaffRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export class StaffAuthService {
  async createStaff(email: string, password: string, role: StaffRole, createdBy?: string) {
    const passwordHash = await bcrypt.hash(password, 10);
    return prisma.staffUser.create({
      data: { email, passwordHash, role, createdBy },
      select: { id: true, email: true, role: true, active: true, createdAt: true },
    });
  }

  async login(email: string, password: string) {
    const staff = await prisma.staffUser.findUnique({ where: { email } });
    if (!staff || !staff.active) throw new Error('Invalid credentials');

    const valid = await bcrypt.compare(password, staff.passwordHash);
    if (!valid) throw new Error('Invalid credentials');

    const token = jwt.sign({ staffId: staff.id, role: staff.role }, JWT_SECRET, { expiresIn: '12h' });
    return { token, role: staff.role };
  }

  async listStaff() {
    return prisma.staffUser.findMany({
      select: { id: true, email: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deactivateStaff(id: string) {
    return prisma.staffUser.update({ where: { id }, data: { active: false } });
  }
}

// ── Express middleware ────────────────────────────────────────────

export interface AuthedRequest extends Request {
  staff?: { staffId: string; role: StaffRole };
}

export function requireStaffAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { staffId: string; role: StaffRole };
    req.staff = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Role gate — e.g. requireRole('SUPER_ADMIN', 'CONTENT_ADMIN') allows either. */
export function requireRole(...allowed: StaffRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.staff || !allowed.includes(req.staff.role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }
    next();
  };
}

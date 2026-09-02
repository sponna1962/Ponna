// Shared PrismaClient singleton — EVERY service file should import
// `prisma` from here instead of doing its own `new PrismaClient()`.
//
// Why this matters: each PrismaClient instance opens and maintains its own
// connection pool to Postgres. Before this file existed, 19 separate
// service files each did their own `new PrismaClient()`, meaning the app
// was potentially holding open ~19x more database connections than
// necessary — wasteful at any traffic level, and a real risk of hitting
// Postgres's max_connections limit as concurrent usage grows (Render's
// Postgres tiers cap this fairly low). One shared instance means one
// shared pool, reused across every request.
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

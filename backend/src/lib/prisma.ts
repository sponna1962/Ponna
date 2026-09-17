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

const basePrisma = new PrismaClient();

function syllabusDownloadUrl(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);
    if (url.hostname === 'res.cloudinary.com') {
      // Keep the Cloudinary asset private to the implementation. Ask Ponna
      // exposes a same-origin download endpoint that returns a real PDF with
      // Content-Disposition: attachment, which is reliable on Android Chrome.
      return `/api/ask-ponna/syllabus-download?url=${encodeURIComponent(url.toString())}`;
    }
    return sourceUrl;
  } catch {
    return sourceUrl;
  }
}

// Ask Ponna's syllabus tool asks for only `sourceUrl` from the current
// ELIGIBILITY fact. Older verified facts may point to the official TNPSC
// document, while the actual syllabus PDF uploaded to PONNA is stored on
// Cloudinary. For this narrow lookup, prefer the PONNA-hosted PDF when one
// exists, while retaining the original result as a fallback.
export const prisma = basePrisma.$extends({
  name: 'preferPonnaSyllabusPdf',
  query: {
    verifiedExamFact: {
      async findFirst({ args, query }) {
        const where = (args as any).where;
        const select = (args as any).select;
        const isSyllabusPdfLookup =
          where?.factType === 'ELIGIBILITY' &&
          where?.sourceUrl?.not === null &&
          typeof where?.subCategoryId === 'string' &&
          select?.sourceUrl === true &&
          Object.keys(select).every((key) => key === 'sourceUrl');

        if (!isSyllabusPdfLookup) return query(args);

        const ponnaPdf = await query({
          ...args,
          where: {
            ...where,
            sourceUrl: { contains: 'res.cloudinary.com' },
          },
        });

        if (ponnaPdf?.sourceUrl) {
          return { ...ponnaPdf, sourceUrl: syllabusDownloadUrl(ponnaPdf.sourceUrl) };
        }
        return query(args);
      },
    },
  },
});

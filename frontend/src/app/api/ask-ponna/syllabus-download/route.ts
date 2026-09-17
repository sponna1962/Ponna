import { NextRequest } from 'next/server';

const CLOUDINARY_HOST = 'res.cloudinary.com';

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url');
  if (!rawUrl) return new Response('Missing PDF URL', { status: 400 });

  let source: URL;
  try {
    source = new URL(rawUrl);
  } catch {
    return new Response('Invalid PDF URL', { status: 400 });
  }

  // Only proxy PONNA's Cloudinary-hosted files. Never turn this endpoint
  // into an open URL fetcher/proxy for arbitrary websites.
  if (source.protocol !== 'https:' || source.hostname !== CLOUDINARY_HOST) {
    return new Response('Only PONNA-hosted Cloudinary PDFs are supported', { status: 400 });
  }

  // Force Cloudinary to send the original asset as an attachment. The
  // PONNA asset is currently stored as an extensionless raw file, so we
  // validate the actual bytes below instead of trusting Cloudinary's MIME
  // type (which can otherwise be text/plain/octet-stream on Android).
  source.pathname = source.pathname.includes('/upload/')
    ? source.pathname.replace('/upload/', '/upload/fl_attachment/')
    : source.pathname;

  try {
    const upstream = await fetch(source.toString(), { cache: 'no-store' });
    if (!upstream.ok) {
      return new Response('PDF is not available', { status: upstream.status });
    }

    const bytes = new Uint8Array(await upstream.arrayBuffer());
    // Every normal PDF starts with the ASCII signature %PDF-. This lets us
    // safely correct a missing/wrong upstream MIME type without accepting
    // arbitrary text as a PDF.
    const signature = new TextDecoder().decode(bytes.slice(0, 5));
    if (signature !== '%PDF-') {
      return new Response('The hosted file is not a valid PDF', { status: 502 });
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="ponna-syllabus.pdf"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Unable to download the PDF', { status: 502 });
  }
}

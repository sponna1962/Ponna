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

  // Force Cloudinary to send the original PDF as an attachment. This is
  // more reliable on Android Chrome than relying on the HTML download
  // attribute for a cross-origin URL.
  source.pathname = source.pathname.includes('/upload/')
    ? source.pathname.replace('/upload/', '/upload/fl_attachment/')
    : source.pathname;

  try {
    const upstream = await fetch(source.toString(), { cache: 'no-store' });
    if (!upstream.ok) {
      return new Response('PDF is not available', { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') || 'application/pdf';
    if (!contentType.toLowerCase().includes('pdf')) {
      return new Response('The hosted file is not a PDF', { status: 502 });
    }

    const originalName = decodeURIComponent(source.pathname.split('/').pop() || 'ponna-syllabus.pdf')
      .replace(/^fl_attachment\//, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = originalName.toLowerCase().endsWith('.pdf') ? originalName : `${originalName}.pdf`;

    return new Response(await upstream.arrayBuffer(), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return new Response('Unable to download the PDF', { status: 502 });
  }
}

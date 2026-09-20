import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/dashboard/',
        '/profile/',
        '/devices/',
        '/diagnostic/',
        '/login/',
        '/shared/',
        '/quiz/',
        '/live-exam/',
        '/adaptive-mock/',
        '/offline-practice/',
        '/mistakes/',
        '/home/',
        '/api/',
      ],
    },
    sitemap: 'https://www.ponna.in/sitemap.xml',
  }
}

// next.config.js — enables PWA support per §4.6 (installable, service-worker cached)
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

module.exports = withPWA({
  reactStrictMode: true,
  // Speed: let phones keep static images for a week instead of re-downloading.
  async headers() {
    const longCache = [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }];
    return [
      { source: '/home/:path*', headers: longCache },
      { source: '/:file(ponna-hero-woman.*|logo.*|brand-mark.png)', headers: longCache },
    ];
  },
});

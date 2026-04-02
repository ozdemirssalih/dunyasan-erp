/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['npnulyilaivagorzrfgw.supabase.co'],
    unoptimized: false,
  },
  reactStrictMode: false, // Disable double-render in dev, faster
  poweredByHeader: false,
  compress: true,
  // Vercel Pro: Edge caching headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
      {
        source: '/dashboard/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-cache, no-store, must-revalidate',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'lh3.googleusercontent.com', // Google profile images
      'lh4.googleusercontent.com',
      'lh5.googleusercontent.com',
      'lh6.googleusercontent.com',
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
        pathname: '**',
      },
    ],
  },
}

module.exports = nextConfig
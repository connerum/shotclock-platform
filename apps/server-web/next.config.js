/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@shotclock/shared',
    '@shotclock/display-core',
    '@shotclock/sports-core',
  ],
};

module.exports = nextConfig;

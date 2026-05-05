/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@shotclock/shared',
    '@shotclock/display-core',
    '@shotclock/sports-core',
  ],
};

module.exports = nextConfig;

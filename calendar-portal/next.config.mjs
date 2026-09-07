/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pg'],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

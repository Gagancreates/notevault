/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ["unpdf", "pg"] },
};
export default nextConfig;

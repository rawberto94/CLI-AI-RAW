/** @type {import('next').NextConfig} */
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  
  // Only build API routes
  pageExtensions: ['api.ts', 'api.tsx', 'route.ts', 'route.js'],
  
  // Skip static generation
  output: 'standalone',
  
  experimental: {
    externalDir: true,
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'readable-stream/passthrough': 'readable-stream/lib/_stream_passthrough.js',
    };
    return config;
  },
};

export default nextConfig;

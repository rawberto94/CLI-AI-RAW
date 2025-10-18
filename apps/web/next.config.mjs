/** @type {import('next').NextConfig} */
import path from "path";
import { fileURLToPath } from "url";
import bundleAnalyzer from "@next/bundle-analyzer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Temporary: unblock build while React 19 + framer-motion typings are stabilized
    ignoreBuildErrors: true,
  },
  output: "standalone",

  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  // Disable problematic experimental features completely
  experimental: {
    // webpackBuildWorker causes issues in 15.1.0
    webpackBuildWorker: false,
    externalDir: true,
    // Allow Server Actions from Codespaces forwarded requests
    serverActions: {
      allowedOrigins: [
        "localhost:3005",
        "*.app.github.dev",
        "zany-journey-69w67jw7vvwj347jg-3005.app.github.dev",
      ],
    },
  },

  // Minimal webpack configuration
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@/packages": path.resolve(__dirname, "..", "..", "packages"),
      "@/packages/clients": path.resolve(
        __dirname,
        "..",
        "..",
        "packages",
        "clients"
      ),
      "@/packages/clients/db": path.resolve(
        __dirname,
        "..",
        "..",
        "packages",
        "clients",
        "db"
      ),
      "@/packages/clients/db/src": path.resolve(
        __dirname,
        "..",
        "..",
        "packages",
        "clients",
        "db",
        "src"
      ),
      "@/apps": path.resolve(__dirname, ".."),
      "@/apps/core": path.resolve(__dirname, "..", "core"),
      "@/core": path.resolve(__dirname, "..", "core"),
    };

    // Ignore pdfjs binary files on client side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        worker_threads: false,
        canvas: false,
      };
    }

    // Handle binary files from pdfjs-dist
    config.module.rules.push({
      test: /\.node$/,
      use: "null-loader",
    });

    return config;
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);

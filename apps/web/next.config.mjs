/** @type {import('next').NextConfig} */
import path from "path";
import { fileURLToPath } from "url";
import bundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";

function isNextBuildProcess() {
  const argv = process.argv ?? [];
  const argvString = argv.join(' ');
  return (
    argv.includes('build') ||
    argvString.includes(' next build') ||
    argvString.includes('next build') ||
    argvString.includes('next/dist/bin/next build') ||
    argvString.includes('next/dist/build')
  );
}

// Keep production builds clean by silencing server-side logs that can fire during
// Next's "Collecting page data" phase (child processes won't always match argv heuristics).
if (isNextBuildProcess()) {
  if (!process.env.LOG_LEVEL) {
    process.env.LOG_LEVEL = 'silent';
  }
  // Signal to @repo/workers to skip worker initialization during build
  process.env.NEXT_BUILD = 'true';
}

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
    // Type checking done via turbo task
    ignoreBuildErrors: true,
  },
  output: "standalone",
  
  // External packages that should not be bundled (native modules)
  serverExternalPackages: [
    'ssh2',
    'ssh2-sftp-client',
    'cpu-features',
    'sharp',
    '@prisma/client',
    '@repo/db',
    'pino',
    'pino-pretty',
    'bullmq',
    'ioredis',
    'perf_hooks',
    'crypto',
  ],
  
  // Optimized static generation
  staticPageGenerationTimeout: 300,
  generateBuildId: async () => {
    return process.env.GIT_COMMIT_SHA || `build-${Date.now()}`;
  },

  // Transpile workspace packages
  transpilePackages: ["@repo/data-orchestration", "@repo/utils", "@repo/workers", "@repo/agents"],

  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [],
  },

  // Optimized dev server
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 2,
  },
  
  // No source maps in production
  productionBrowserSourceMaps: false,

  // Turbopack configuration (dev only)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },

  experimental: {
    // Enable for Next.js 15.5+
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
    externalDir: true,
    // Optimized package imports - reduces bundle size significantly
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'recharts',
      '@radix-ui/react-icons',
      'date-fns',
      '@tanstack/react-table',
      'react-hook-form',
      '@hookform/resolvers',
      'class-variance-authority',
      'clsx',
    ],
    // Server Actions configuration
    serverActions: {
      bodySizeLimit: '2mb',
      allowedOrigins: [
        process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).host : '',
        ...(process.env.NODE_ENV === 'development' ? [
          "localhost:3005",
          "*.app.github.dev",
        ] : []),
      ].filter(Boolean),
    },
  },

  // Logging
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },

  // Minimal webpack configuration
  webpack: (config, { isServer, dev, webpack }) => {
    // Avoid noisy warnings for ESM packages that use top-level await (e.g. pdfjs-dist)
    // by declaring async/await support in the target environment.
    config.output.environment = {
      ...(config.output.environment || {}),
      asyncFunction: true,
    };

    // Improve dev server stability and HMR
    if (dev && !isServer) {
      // Disable problematic lazy compilation
      config.experiments = {
        ...config.experiments,
        lazyCompilation: false,
      };
      
      // Use filesystem cache for better stability
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename],
        },
        // Add compression to reduce memory usage
        compression: 'gzip',
      };
      
      // Improve HMR stability with better watch options
      config.watchOptions = {
        ...config.watchOptions,
        poll: false,
        aggregateTimeout: 300,
        ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**'],
      };

      // Improve HMR plugin configuration
      const existingHotModuleReplacementPlugin = config.plugins.find(
        (plugin) => plugin.constructor.name === 'HotModuleReplacementPlugin'
      );
      
      if (!existingHotModuleReplacementPlugin) {
        config.plugins.push(new webpack.HotModuleReplacementPlugin());
      }

      // Add better error overlay configuration
      config.devServer = {
        ...config.devServer,
        client: {
          overlay: {
            errors: true,
            warnings: false,
            runtimeErrors: false,
          },
          reconnect: 5,
        },
      };
    }

    // Only apply optimizations in development mode to reduce memory usage
    if (process.env.NODE_ENV !== 'production') {
      config.optimization = {
        ...config.optimization,
        minimize: false,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          maxSize: 244000, // Split large chunks
          cacheGroups: {
            default: false,
            vendors: false,
            commons: {
              name: 'commons',
              minChunks: 2,
              priority: 20,
              reuseExistingChunk: true,
            },
            lib: {
              test: /[\\/]node_modules[\\/]/,
              name(module) {
                const match = module.context?.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/);
                if (!match) return 'lib.unknown';
                const packageName = match[1];
                return `lib.${packageName.replace('@', '')}`;
              },
              priority: 10,
            },
          },
          maxInitialRequests: 25,
          minSize: 20000,
        },
      };
      
      // Reduce module resolution overhead
      config.resolve.symlinks = false;
    }

    // Mark problematic packages as external to prevent webpack from bundling them
    // These packages have symlinks to TypeScript sources which cause parse errors
    if (!isServer) {
      const externals = ['clients-db', 'clients-storage', 'clients-openai', 'clients-queue', 'clients-rag'];
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push(({ request }, callback) => {
          if (request && externals.some((ext) => request.startsWith(ext))) {
            return callback(null, 'commonjs ' + request);
          }
          callback();
        });
      }
    }

    // Create alias for data-orchestration src paths to point to dist
    const dataOrchPath = path.resolve(__dirname, "..", "..", "packages", "data-orchestration");
    
    // Custom resolver to redirect src imports to dist
    config.resolve.plugins = config.resolve.plugins || [];
    config.resolve.plugins.push({
      apply(resolver) {
        const target = resolver.ensureHook("resolve");
        resolver
          .getHook("resolve")
          .tapAsync("DataOrchestrationResolver", (request, resolveContext, callback) => {
            if (request.request) {
              // Handle various import patterns
              const patterns = [
                { from: /^data-orchestration\/src\/(.+)$/, to: (match) => path.join(dataOrchPath, "dist", match[1]) },
                { from: /^@\/packages\/data-orchestration\/src\/(.+)$/, to: (match) => path.join(dataOrchPath, "dist", match[1]) },
                { from: /^\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/packages\/data-orchestration\/src\/(.+)$/, to: (match) => path.join(dataOrchPath, "dist", match[1]) },
              ];
              
              for (const pattern of patterns) {
                const match = request.request.match(pattern.from);
                if (match) {
                  const newRequest = {
                    ...request,
                    request: pattern.to(match),
                  };
                  return resolver.doResolve(target, newRequest, null, resolveContext, callback);
                }
              }
            }
            callback();
          });
      },
    });
    
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // Fix LangChain 0.3.x compatibility with Zod 3.x
      "zod/v3": "zod",
      "zod/v4/core": "zod",
      "data-orchestration/services": path.join(dataOrchPath, "dist", "services", "index.js"),
      "data-orchestration": path.join(dataOrchPath, "dist", "index.js"),
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
    } else {
      // Server-side: ensure 'self' is defined for webpack runtime
      config.resolve.fallback = {
        ...config.resolve.fallback,
      };
      
      // Add plugin to define 'self' on the server
      config.plugins.push(
        new webpack.DefinePlugin({
          'self': 'globalThis',
        })
      );
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
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io wss: ws:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join("; "),
          },
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
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
      {
        // Cache static assets aggressively
        source: "/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(withBundleAnalyzer(nextConfig));

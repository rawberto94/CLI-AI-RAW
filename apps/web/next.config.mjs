/** @type {import('next').NextConfig} */
import path from "path";
import crypto from "crypto";
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
  
  // Skip failing pages during static generation
  staticPageGenerationTimeout: 120,
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },

  // Transpile workspace packages
  transpilePackages: ["data-orchestration"],

  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 1 year
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Reduce memory usage during development
  onDemandEntries: {
    maxInactiveAge: 15 * 1000, // Reduced from 25s to 15s
    pagesBufferLength: 1, // Reduced from 2 to 1
  },
  
  // Aggressive memory optimization
  productionBrowserSourceMaps: false,

  // Disable problematic experimental features completely
  // Turbopack configuration for better performance
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },

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
  webpack: (config, { isServer, dev, webpack }) => {
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
                const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
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
        config.externals.push(
          (context, request, callback) => {
            if (externals.some(ext => request.startsWith(ext))) {
              return callback(null, 'commonjs ' + request);
            }
            callback();
          }
        );
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

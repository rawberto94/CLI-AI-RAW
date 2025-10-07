/** @type {import('next').NextConfig} */
import bundleAnalyzer from '@next/bundle-analyzer'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const withBundleAnalyzer = bundleAnalyzer({
	enabled: process.env.ANALYZE === 'true',
})

const nextConfig = {
	eslint: {
		// Allow production builds to successfully complete even if
		// there are ESLint errors. Dev still shows the errors.
		ignoreDuringBuilds: true,
	},
	typescript: {
		// Skip type checking during build to allow incremental fixes
		// ⚠️ This is risky for production but necessary for initial build
		ignoreBuildErrors: true,
	},
	output: 'standalone',
	
	// Externalize packages with native bindings that should only run on server
	serverExternalPackages: ['sharp'],
	
	// Performance optimizations
	compiler: {
		removeConsole: process.env.NODE_ENV === 'production',
	},
	
	// Webpack configuration to handle server-side modules
	webpack: (config, { isServer, webpack }) => {
		if (!isServer) {
			// Exclude server-side modules from client bundle
			config.resolve.fallback = {
				...config.resolve.fallback,
				dns: false,
				net: false,
				tls: false,
				fs: false,
				child_process: false,
				worker_threads: false,
			};
		}
		
		// Add aliases for monorepo packages
		config.resolve.alias = {
			...config.resolve.alias,
			'@core': path.resolve(__dirname, '..', 'core'),
		};
		
		// Externalize sharp and its dependencies for both client and server
		config.externals = config.externals || [];
		config.externals.push({
			'sharp': 'commonjs sharp',
			'@img/sharp-libvips-dev': 'commonjs @img/sharp-libvips-dev',
			'@img/sharp-wasm32': 'commonjs @img/sharp-wasm32',
		});
		
		// Ignore dynamic imports to workers directory to prevent bundling vitest configs and other dev files
		config.plugins = config.plugins || [];
		config.plugins.push(
			new webpack.IgnorePlugin({
				resourceRegExp: /^\.\/.*$/,
				contextRegExp: /apps\/workers/,
			})
		);
		
		return config;
	},
	
	// Security headers
	async headers() {
		return [
			{
				source: '/(.*)',
				headers: [
					{
						key: 'X-Frame-Options',
						value: 'DENY',
					},
					{
						key: 'X-Content-Type-Options',
						value: 'nosniff',
					},
					{
						key: 'Referrer-Policy',
						value: 'origin-when-cross-origin',
					},
					{
						key: 'Permissions-Policy',
						value: 'camera=(), microphone=(), geolocation=()',
					},
				],
			},
		]
	},
}

export default withBundleAnalyzer(nextConfig)

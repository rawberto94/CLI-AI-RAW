/** @type {import('next').NextConfig} */
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
	enabled: process.env.ANALYZE === 'true',
})

const nextConfig = {
	eslint: {
		// Allow production builds to successfully complete even if
		// there are ESLint errors. Dev still shows the errors.
		ignoreDuringBuilds: true,
	},
	output: 'standalone',
	
	// Performance optimizations
	compiler: {
		removeConsole: process.env.NODE_ENV === 'production',
	},
	
	// Webpack configuration to handle server-side modules
	webpack: (config, { isServer }) => {
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

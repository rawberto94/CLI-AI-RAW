/** @type {import('next').NextConfig} */
const nextConfig = {
	eslint: {
		// Allow production builds to successfully complete even if
		// there are ESLint errors. Dev still shows the errors.
		ignoreDuringBuilds: true,
	},
}

export default nextConfig

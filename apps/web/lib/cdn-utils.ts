/**
 * CDN Helper Utilities for Production Deployment
 * 
 * Provides utilities for:
 * - Generating signed URLs for protected assets
 * - Cache invalidation
 * - Asset URL generation with CDN prefixes
 * - CloudFront/Cloudflare compatibility
 */

import { createHmac } from 'crypto';

// =============================================================================
// Configuration
// =============================================================================

interface CDNConfig {
  provider: 'cloudflare' | 'cloudfront' | 'none';
  baseUrl: string;
  signingKeyId?: string;
  signingKey?: string;
  defaultCacheTTL: number;
}

function getCDNConfig(): CDNConfig {
  const provider = process.env.CDN_PROVIDER as CDNConfig['provider'] || 'none';
  
  return {
    provider,
    baseUrl: process.env.CDN_BASE_URL || '',
    signingKeyId: process.env.CDN_SIGNING_KEY_ID,
    signingKey: process.env.CDN_SIGNING_KEY,
    defaultCacheTTL: parseInt(process.env.CDN_DEFAULT_TTL || '86400', 10), // 24 hours
  };
}

// =============================================================================
// Asset URL Generation
// =============================================================================

/**
 * Generate a CDN URL for a static asset
 */
export function getCDNUrl(path: string): string {
  const config = getCDNConfig();
  
  if (config.provider === 'none' || !config.baseUrl) {
    // No CDN configured, return as-is
    return path;
  }
  
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${config.baseUrl}${normalizedPath}`;
}

/**
 * Generate optimized image URL with CDN transformations
 */
export function getOptimizedImageUrl(
  src: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'auto' | 'webp' | 'avif' | 'png' | 'jpg';
  } = {}
): string {
  const config = getCDNConfig();
  
  if (config.provider === 'none' || !config.baseUrl) {
    return src;
  }
  
  const { width, height, quality = 80, format = 'auto' } = options;
  
  if (config.provider === 'cloudflare') {
    // Cloudflare Image Resizing
    const params: string[] = [];
    if (width) params.push(`width=${width}`);
    if (height) params.push(`height=${height}`);
    params.push(`quality=${quality}`);
    if (format !== 'auto') params.push(`format=${format}`);
    
    const transformPath = `/cdn-cgi/image/${params.join(',')}`;
    return `${config.baseUrl}${transformPath}${src}`;
  }
  
  if (config.provider === 'cloudfront') {
    // CloudFront with Lambda@Edge or CloudFront Functions for image optimization
    const params = new URLSearchParams();
    if (width) params.set('w', width.toString());
    if (height) params.set('h', height.toString());
    params.set('q', quality.toString());
    if (format !== 'auto') params.set('f', format);
    
    return `${config.baseUrl}${src}?${params.toString()}`;
  }
  
  return src;
}

// =============================================================================
// Signed URLs for Protected Content
// =============================================================================

/**
 * Generate a signed URL for CloudFront
 */
function generateCloudFrontSignedUrl(
  url: string,
  expiresAt: Date,
  keyPairId: string,
  privateKey: string
): string {
  // CloudFront signed URLs use RSA-SHA1
  // This is a simplified implementation - production should use AWS SDK
  const policy = JSON.stringify({
    Statement: [
      {
        Resource: url,
        Condition: {
          DateLessThan: {
            'AWS:EpochTime': Math.floor(expiresAt.getTime() / 1000),
          },
        },
      },
    ],
  });
  
  const encodedPolicy = Buffer.from(policy).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '~')
    .replace(/=/g, '_');
  
  // Sign with private key (simplified - use @aws-sdk/cloudfront-signer in production)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cryptoModule = require('crypto');
  const sign = cryptoModule.createSign('RSA-SHA1');
  sign.update(policy);
  const signature = sign.sign(privateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '~')
    .replace(/=/g, '_');
  
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}Policy=${encodedPolicy}&Signature=${signature}&Key-Pair-Id=${keyPairId}`;
}

/**
 * Generate a signed URL for Cloudflare
 */
function generateCloudflareSignedUrl(
  url: string,
  expiresAt: Date,
  secretKey: string
): string {
  const expiry = Math.floor(expiresAt.getTime() / 1000);
  const urlObj = new URL(url);
  
  // Add expiry to URL
  urlObj.searchParams.set('exp', expiry.toString());
  
  // Generate token
  const stringToSign = `${urlObj.pathname}${urlObj.search}`;
  const hmac = createHmac('sha256', secretKey);
  hmac.update(stringToSign);
  const token = hmac.digest('hex');
  
  urlObj.searchParams.set('token', token);
  
  return urlObj.toString();
}

/**
 * Generate a signed URL for protected content (e.g., contract documents)
 */
export function generateSignedUrl(
  path: string,
  options: {
    expiresInSeconds?: number;
    clientIp?: string;
  } = {}
): string {
  const config = getCDNConfig();
  const { expiresInSeconds = 3600 } = options; // Default 1 hour
  
  if (config.provider === 'none' || !config.signingKey) {
    // No signing configured, return regular CDN URL
    return getCDNUrl(path);
  }
  
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  const fullUrl = getCDNUrl(path);
  
  if (config.provider === 'cloudfront' && config.signingKeyId) {
    return generateCloudFrontSignedUrl(
      fullUrl,
      expiresAt,
      config.signingKeyId,
      config.signingKey
    );
  }
  
  if (config.provider === 'cloudflare') {
    return generateCloudflareSignedUrl(
      fullUrl,
      expiresAt,
      config.signingKey
    );
  }
  
  return fullUrl;
}

// =============================================================================
// Cache Invalidation
// =============================================================================

interface InvalidationResult {
  success: boolean;
  invalidationId?: string;
  error?: string;
}

/**
 * Invalidate CDN cache for specific paths
 */
export async function invalidateCache(
  paths: string[]
): Promise<InvalidationResult> {
  const config = getCDNConfig();
  
  if (config.provider === 'none') {
    return { success: true };
  }
  
  try {
    if (config.provider === 'cloudfront') {
      return await invalidateCloudFrontCache(paths);
    }
    
    if (config.provider === 'cloudflare') {
      return await invalidateCloudflareCache(paths);
    }
    
    return { success: false, error: `Unknown CDN provider: ${config.provider}` };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function invalidateCloudFrontCache(paths: string[]): Promise<InvalidationResult> {
  const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;
  
  if (!distributionId) {
    return { success: false, error: 'CLOUDFRONT_DISTRIBUTION_ID not configured' };
  }
  
  // Use AWS SDK in production
  // This is a simplified implementation
  const response = await fetch(
    `https://cloudfront.amazonaws.com/2020-05-31/distribution/${distributionId}/invalidation`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        // Add AWS signature headers
      },
      body: `
        <InvalidationBatch>
          <CallerReference>${Date.now()}</CallerReference>
          <Paths>
            <Quantity>${paths.length}</Quantity>
            <Items>
              ${paths.map(p => `<Path>${p}</Path>`).join('')}
            </Items>
          </Paths>
        </InvalidationBatch>
      `,
    }
  );
  
  if (response.ok) {
    const text = await response.text();
    const idMatch = text.match(/<Id>([^<]+)<\/Id>/);
    return { success: true, invalidationId: idMatch?.[1] };
  }
  
  return { success: false, error: `CloudFront API error: ${response.status}` };
}

async function invalidateCloudflareCache(paths: string[]): Promise<InvalidationResult> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const config = getCDNConfig();
  
  if (!zoneId || !apiToken) {
    return { success: false, error: 'Cloudflare credentials not configured' };
  }
  
  // Convert paths to full URLs
  const urls = paths.map(p => `${config.baseUrl}${p}`);
  
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files: urls }),
    }
  );
  
  const data = await response.json();
  
  if (data.success) {
    return { success: true, invalidationId: data.result?.id };
  }
  
  return {
    success: false,
    error: data.errors?.[0]?.message || 'Cloudflare API error',
  };
}

/**
 * Invalidate all cached content (use sparingly!)
 */
export async function invalidateAllCache(): Promise<InvalidationResult> {
  const config = getCDNConfig();
  
  if (config.provider === 'cloudfront') {
    return invalidateCache(['/*']);
  }
  
  if (config.provider === 'cloudflare') {
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    
    if (!zoneId || !apiToken) {
      return { success: false, error: 'Cloudflare credentials not configured' };
    }
    
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ purge_everything: true }),
      }
    );
    
    const data = await response.json();
    return { success: data.success };
  }
  
  return { success: true };
}

// =============================================================================
// Cache-Control Header Utilities
// =============================================================================

export const CacheProfiles = {
  // Static assets that rarely change
  immutable: 'public, max-age=31536000, immutable',
  
  // Assets that change occasionally (fonts, images)
  static: 'public, max-age=86400, stale-while-revalidate=604800',
  
  // Dynamic content that can be cached briefly
  dynamic: 'public, max-age=60, stale-while-revalidate=300',
  
  // Per-user content
  private: 'private, max-age=300, must-revalidate',
  
  // Never cache
  noCache: 'no-store, no-cache, must-revalidate, proxy-revalidate',
} as const;

/**
 * Get appropriate cache headers based on content type
 */
export function getCacheHeaders(
  contentType: 'static' | 'dynamic' | 'private' | 'immutable' | 'none',
  options: {
    maxAge?: number;
    staleWhileRevalidate?: number;
    etag?: string;
  } = {}
): Record<string, string> {
  const headers: Record<string, string> = {};
  
  if (contentType === 'none') {
    headers['Cache-Control'] = CacheProfiles.noCache;
    return headers;
  }
  
  if (options.maxAge !== undefined) {
    const base = contentType === 'private' ? 'private' : 'public';
    let value = `${base}, max-age=${options.maxAge}`;
    if (options.staleWhileRevalidate) {
      value += `, stale-while-revalidate=${options.staleWhileRevalidate}`;
    }
    headers['Cache-Control'] = value;
  } else {
    headers['Cache-Control'] = CacheProfiles[contentType];
  }
  
  if (options.etag) {
    headers['ETag'] = options.etag;
  }
  
  return headers;
}

// =============================================================================
// Asset Preloading
// =============================================================================

/**
 * Generate preload link headers for critical assets
 */
export function getPreloadHeaders(assets: {
  path: string;
  as: 'script' | 'style' | 'font' | 'image';
  crossOrigin?: boolean;
}[]): string {
  return assets
    .map(({ path, as, crossOrigin }) => {
      const url = getCDNUrl(path);
      let header = `<${url}>; rel=preload; as=${as}`;
      if (crossOrigin) {
        header += '; crossorigin';
      }
      return header;
    })
    .join(', ');
}

// =============================================================================
// S3 Direct Upload URLs
// =============================================================================

/**
 * Generate a presigned URL for direct upload to S3
 * (For use with CloudFront + S3 origin)
 */
export async function getS3UploadUrl(
  key: string,
  options: {
    contentType: string;
    expiresInSeconds?: number;
    maxSizeBytes?: number;
  }
): Promise<{ uploadUrl: string; cdnUrl: string }> {
  // In production, use @aws-sdk/s3-request-presigner
  const bucket = process.env.S3_UPLOAD_BUCKET;
  const region = process.env.AWS_REGION || 'us-east-1';
  const { contentType, expiresInSeconds = 3600 } = options;
  
  if (!bucket) {
    throw new Error('S3_UPLOAD_BUCKET not configured');
  }
  
  // This is a placeholder - use AWS SDK in production
  // const command = new PutObjectCommand({
  //   Bucket: bucket,
  //   Key: key,
  //   ContentType: contentType,
  // });
  // const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
  
  const uploadUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  const cdnUrl = getCDNUrl(`/${key}`);
  
  return { uploadUrl, cdnUrl };
}

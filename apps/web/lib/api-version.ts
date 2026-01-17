/**
 * API Versioning Middleware
 * 
 * Supports three versioning methods (in priority order):
 * 1. Accept header: application/vnd.contigo.v1+json
 * 2. X-API-Version header: v1
 * 3. Query parameter: ?api_version=v1
 */

import { NextRequest, NextResponse } from 'next/server';

// Supported API versions
export const API_VERSIONS = ['v1', 'v2'] as const;
export type APIVersion = (typeof API_VERSIONS)[number];

// Current and minimum supported versions
export const CURRENT_VERSION: APIVersion = 'v2';
export const MINIMUM_VERSION: APIVersion = 'v1';

// Version deprecation info
export const VERSION_STATUS: Record<APIVersion, 'current' | 'deprecated' | 'beta'> = {
  v1: 'deprecated',
  v2: 'current',
};

// Deprecation dates
export const DEPRECATION_DATES: Partial<Record<APIVersion, string>> = {
  v1: '2025-07-01',
};

/**
 * Extract API version from request
 */
export function getAPIVersion(request: NextRequest): APIVersion {
  // 1. Check Accept header (highest priority)
  const accept = request.headers.get('accept') || '';
  const acceptMatch = accept.match(/vnd\.contigo\.(v\d+)/);
  if (acceptMatch && isValidVersion(acceptMatch[1])) {
    return acceptMatch[1] as APIVersion;
  }
  
  // 2. Check X-API-Version header
  const headerVersion = request.headers.get('x-api-version');
  if (headerVersion && isValidVersion(headerVersion)) {
    return headerVersion as APIVersion;
  }
  
  // 3. Check query parameter (lowest priority)
  const queryVersion = request.nextUrl.searchParams.get('api_version');
  if (queryVersion && isValidVersion(queryVersion)) {
    return queryVersion as APIVersion;
  }
  
  // Default to current version
  return CURRENT_VERSION;
}

/**
 * Check if a version string is valid
 */
export function isValidVersion(version: string): version is APIVersion {
  return API_VERSIONS.includes(version as APIVersion);
}

/**
 * Check if a version is deprecated
 */
export function isDeprecated(version: APIVersion): boolean {
  return VERSION_STATUS[version] === 'deprecated';
}

/**
 * Get days until version sunset
 */
export function getDaysUntilSunset(version: APIVersion): number | null {
  const sunsetDate = DEPRECATION_DATES[version];
  if (!sunsetDate) return null;
  
  const sunset = new Date(sunsetDate);
  const now = new Date();
  const diffTime = sunset.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Add version-related headers to response
 */
export function addVersionHeaders(
  response: NextResponse,
  version: APIVersion
): NextResponse {
  // Always include current version info
  response.headers.set('X-API-Version', version);
  response.headers.set('X-API-Current-Version', CURRENT_VERSION);
  response.headers.set('X-API-Supported-Versions', API_VERSIONS.join(', '));
  
  // Add deprecation warning if needed
  if (isDeprecated(version)) {
    const sunsetDate = DEPRECATION_DATES[version];
    
    // RFC 8594 Deprecation header
    response.headers.set('Deprecation', 'true');
    
    if (sunsetDate) {
      // RFC 8594 Sunset header
      response.headers.set('Sunset', new Date(sunsetDate).toUTCString());
      
      const daysUntilSunset = getDaysUntilSunset(version);
      response.headers.set(
        'X-API-Deprecation-Notice',
        `API version ${version} is deprecated and will be removed on ${sunsetDate} (${daysUntilSunset} days). Please migrate to ${CURRENT_VERSION}.`
      );
    }
    
    // Link to migration docs
    response.headers.set(
      'Link',
      `</docs/api/migration/${version}-to-${CURRENT_VERSION}>; rel="deprecation"`
    );
  }
  
  return response;
}

/**
 * Create a versioned response helper
 */
export function createVersionedResponse<T>(
  data: T,
  version: APIVersion,
  options: {
    status?: number;
    headers?: Record<string, string>;
  } = {}
): NextResponse {
  const response = NextResponse.json(data, {
    status: options.status || 200,
    headers: options.headers,
  });
  
  return addVersionHeaders(response, version);
}

/**
 * Version router - routes to version-specific handlers
 */
export function versionRouter<T>(
  version: APIVersion,
  handlers: Partial<Record<APIVersion, () => T | Promise<T>>>
): T | Promise<T> {
  // Try exact version first
  if (handlers[version]) {
    return handlers[version]!();
  }
  
  // Fall back to current version
  if (handlers[CURRENT_VERSION]) {
    return handlers[CURRENT_VERSION]!();
  }
  
  throw new Error(`No handler found for API version ${version}`);
}

/**
 * HOC for versioned API routes
 */
export function withVersioning<T extends (...args: any[]) => Promise<NextResponse>>(
  handlers: Partial<Record<APIVersion, T>>
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const version = getAPIVersion(request);
    
    // Check if version is supported
    if (!isValidVersion(version)) {
      return NextResponse.json(
        {
          error: 'Unsupported API version',
          message: `Version '${version}' is not supported. Supported versions: ${API_VERSIONS.join(', ')}`,
          currentVersion: CURRENT_VERSION,
        },
        { status: 400 }
      );
    }
    
    // Get the appropriate handler
    const handler = handlers[version] || handlers[CURRENT_VERSION];
    
    if (!handler) {
      return NextResponse.json(
        { error: 'Internal server error', message: 'No handler for version' },
        { status: 500 }
      );
    }
    
    // Execute handler
    const response = await handler(request, ...args);
    
    // Add version headers
    return addVersionHeaders(response, version);
  };
}

/**
 * Response transformer for version differences
 */
export interface VersionTransformer<TInput, TOutput> {
  version: APIVersion;
  transform: (data: TInput) => TOutput;
}

export function transformForVersion<TInput, TOutput>(
  data: TInput,
  version: APIVersion,
  transformers: VersionTransformer<TInput, TOutput>[]
): TOutput {
  const transformer = transformers.find((t) => t.version === version);
  
  if (!transformer) {
    // Return data as-is if no transformer (assumes TInput === TOutput for current version)
    return data as unknown as TOutput;
  }
  
  return transformer.transform(data);
}

// Example usage in types
export interface ContractResponseV1 {
  data: any[];
  total: number;
}

export interface ContractResponseV2 {
  data: any[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  links: {
    self: string;
    next: string | null;
    prev: string | null;
  };
}

// Transformer example
export const contractResponseTransformers: VersionTransformer<
  ContractResponseV2,
  ContractResponseV1 | ContractResponseV2
>[] = [
  {
    version: 'v1',
    transform: (data) => ({
      data: data.data,
      total: data.meta.total,
    }),
  },
];

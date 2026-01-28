/**
 * Accessible Image Component
 * 
 * A wrapper around next/image that enforces accessibility best practices:
 * - Required alt text
 * - Automatic optimization
 * - Loading states
 * - Error handling with fallback
 * - Blur placeholder support
 */

'use client';

import React, { useState, memo, useCallback } from 'react';
import NextImage, { ImageProps as NextImageProps } from 'next/image';
import { cn } from '@/lib/utils';
import { ImageOff, Loader2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface AccessibleImageProps extends Omit<NextImageProps, 'alt'> {
  /**
   * Alternative text description for the image (REQUIRED for accessibility)
   * - Use descriptive text for informative images
   * - Use empty string "" for decorative images
   */
  alt: string;
  
  /**
   * Whether this is a decorative image (will add role="presentation")
   */
  decorative?: boolean;
  
  /**
   * Show loading skeleton while image loads
   */
  showLoadingSkeleton?: boolean;
  
  /**
   * Custom fallback content when image fails to load
   */
  fallback?: React.ReactNode;
  
  /**
   * Fallback image URL when main image fails
   */
  fallbackSrc?: string;
  
  /**
   * Container className (wraps the image)
   */
  containerClassName?: string;
  
  /**
   * Aspect ratio for the container (e.g., "16/9", "4/3", "1/1")
   */
  aspectRatio?: string;
  
  /**
   * Additional description for screen readers (aria-describedby)
   */
  description?: string;
  
  /**
   * Callback when image loads successfully
   */
  onLoadSuccess?: () => void;
  
  /**
   * Callback when image fails to load
   */
  onLoadError?: (error: Error) => void;
}

// ============================================================================
// Loading Skeleton
// ============================================================================

const LoadingSkeleton = memo(function LoadingSkeleton({ 
  className 
}: { 
  className?: string 
}) {
  return (
    <div 
      className={cn(
        'absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse',
        className
      )}
      aria-hidden="true"
    >
      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
    </div>
  );
});

// ============================================================================
// Error Fallback
// ============================================================================

const ErrorFallback = memo(function ErrorFallback({ 
  alt,
  className 
}: { 
  alt: string;
  className?: string 
}) {
  return (
    <div 
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center bg-gray-100 text-gray-400',
        className
      )}
      role="img"
      aria-label={`Failed to load image: ${alt}`}
    >
      <ImageOff className="w-8 h-8 mb-2" aria-hidden="true" />
      <span className="text-xs text-center px-2">Image unavailable</span>
    </div>
  );
});

// ============================================================================
// Accessible Image Component
// ============================================================================

export const AccessibleImage = memo(function AccessibleImage({
  src,
  alt,
  decorative = false,
  showLoadingSkeleton = true,
  fallback,
  fallbackSrc,
  containerClassName,
  aspectRatio,
  description,
  onLoadSuccess,
  onLoadError,
  className,
  ...props
}: AccessibleImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  
  const descriptionId = description ? `img-desc-${Math.random().toString(36).substr(2, 9)}` : undefined;
  
  const handleLoad = useCallback(() => {
    setIsLoading(false);
    onLoadSuccess?.();
  }, [onLoadSuccess]);
  
  const handleError = useCallback(() => {
    setIsLoading(false);
    
    // Try fallback src if available
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setIsLoading(true);
      return;
    }
    
    setHasError(true);
    onLoadError?.(new Error(`Failed to load image: ${typeof src === 'string' ? src : 'StaticImport'}`));
  }, [fallbackSrc, currentSrc, src, onLoadError]);
  
  // Alt text validation removed - handled by TypeScript and accessibility linting
  
  // For decorative images, use empty alt and role="presentation"
  const accessibilityProps = decorative
    ? { alt: '', role: 'presentation' as const, 'aria-hidden': true as const }
    : { alt, 'aria-describedby': descriptionId };
  
  return (
    <div 
      className={cn(
        'relative overflow-hidden',
        aspectRatio && `aspect-[${aspectRatio}]`,
        containerClassName
      )}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {/* Hidden description for screen readers */}
      {description && (
        <span id={descriptionId} className="sr-only">
          {description}
        </span>
      )}
      
      {/* Loading skeleton */}
      {showLoadingSkeleton && isLoading && !hasError && (
        <LoadingSkeleton />
      )}
      
      {/* Error state */}
      {hasError && (
        fallback || <ErrorFallback alt={alt} />
      )}
      
      {/* Main image */}
      {!hasError && (
        <NextImage
          src={currentSrc}
          className={cn(
            'transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100',
            className
          )}
          onLoad={handleLoad}
          onError={handleError}
          {...accessibilityProps}
          {...props}
        />
      )}
    </div>
  );
});

// ============================================================================
// Avatar Image (Specialized for user avatars)
// ============================================================================

export interface AvatarImageProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
};

const sizePx = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

export const AvatarImage = memo(function AvatarImage({
  src,
  name,
  size = 'md',
  className,
}: AvatarImageProps) {
  const [hasError, setHasError] = useState(false);
  
  // Get initials from name
  const initials = name
    .split(' ')
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  
  // Generate consistent color from name
  const colorIndex = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 6;
  const colors = [
    'bg-violet-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-purple-500',
  ];
  
  if (!src || hasError) {
    return (
      <div
        className={cn(
          'rounded-full flex items-center justify-center text-white font-medium',
          sizeClasses[size],
          colors[colorIndex],
          className
        )}
        role="img"
        aria-label={`Avatar for ${name}`}
      >
        {initials}
      </div>
    );
  }
  
  return (
    <div className={cn('relative rounded-full overflow-hidden', sizeClasses[size], className)}>
      <NextImage
        src={src}
        alt={`Avatar for ${name}`}
        width={sizePx[size]}
        height={sizePx[size]}
        className="object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
});

// ============================================================================
// Logo Image (Specialized for company logos)
// ============================================================================

export interface LogoImageProps {
  src?: string | null;
  companyName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const logoSizes = {
  sm: { width: 32, height: 32 },
  md: { width: 48, height: 48 },
  lg: { width: 64, height: 64 },
};

export const LogoImage = memo(function LogoImage({
  src,
  companyName,
  size = 'md',
  className,
}: LogoImageProps) {
  const [hasError, setHasError] = useState(false);
  
  if (!src || hasError) {
    // Fallback to first letter of company name
    return (
      <div
        className={cn(
          'rounded-lg bg-gray-100 flex items-center justify-center font-semibold text-gray-600',
          size === 'sm' && 'w-8 h-8 text-sm',
          size === 'md' && 'w-12 h-12 text-lg',
          size === 'lg' && 'w-16 h-16 text-xl',
          className
        )}
        role="img"
        aria-label={`Logo for ${companyName}`}
      >
        {companyName[0]?.toUpperCase() || '?'}
      </div>
    );
  }
  
  return (
    <div className={cn('relative', className)}>
      <NextImage
        src={src}
        alt={`Logo for ${companyName}`}
        width={logoSizes[size].width}
        height={logoSizes[size].height}
        className="object-contain"
        onError={() => setHasError(true)}
      />
    </div>
  );
});

// ============================================================================
// Thumbnail Image (Specialized for document thumbnails)
// ============================================================================

export interface ThumbnailImageProps {
  src?: string | null;
  title: string;
  type?: 'document' | 'image' | 'video';
  aspectRatio?: '1/1' | '4/3' | '16/9';
  className?: string;
  onClick?: () => void;
}

export const ThumbnailImage = memo(function ThumbnailImage({
  src,
  title,
  type = 'document',
  aspectRatio = '4/3',
  className,
  onClick,
}: ThumbnailImageProps) {
  const [hasError, setHasError] = useState(false);
  
  const iconMap = {
    document: '📄',
    image: '🖼️',
    video: '🎬',
  };
  
  if (!src || hasError) {
    return (
      <div
        className={cn(
          'bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400',
          onClick && 'cursor-pointer hover:bg-gray-200 transition-colors',
          className
        )}
        style={{ aspectRatio }}
        role="img"
        aria-label={`Thumbnail for ${title}`}
        onClick={onClick}
        onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        <span className="text-3xl mb-2" aria-hidden="true">{iconMap[type]}</span>
        <span className="text-xs text-center px-2 line-clamp-2">{title}</span>
      </div>
    );
  }
  
  return (
    <div 
      className={cn(
        'relative rounded-lg overflow-hidden group',
        onClick && 'cursor-pointer',
        className
      )}
      style={{ aspectRatio }}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `View ${title}` : undefined}
    >
      <NextImage
        src={src}
        alt={`Thumbnail for ${title}`}
        fill
        className="object-cover transition-transform group-hover:scale-105"
        onError={() => setHasError(true)}
      />
      {onClick && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" aria-hidden="true" />
      )}
    </div>
  );
});

// ============================================================================
// Export
// ============================================================================

export default AccessibleImage;

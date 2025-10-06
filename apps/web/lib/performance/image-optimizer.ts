/**
 * Image Optimization Utilities
 * Optimizes image loading and rendering
 */

export interface ImageOptimizationConfig {
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  sizes?: string;
  priority?: boolean;
  loading?: 'lazy' | 'eager';
}

/**
 * Generate optimized image props for Next.js Image component
 */
export function getOptimizedImageProps(
  src: string,
  config?: ImageOptimizationConfig
) {
  return {
    src,
    quality: config?.quality || 75,
    format: config?.format || 'webp',
    sizes: config?.sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
    priority: config?.priority || false,
    loading: config?.loading || 'lazy',
  };
}

/**
 * Generate responsive image sizes
 */
export function generateResponsiveSizes(breakpoints: Record<string, number>) {
  return Object.entries(breakpoints)
    .map(([bp, width]) => `(max-width: ${bp}) ${width}px`)
    .join(', ');
}

/**
 * Preload critical images
 */
export function preloadImage(src: string): void {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  document.head.appendChild(link);
}

/**
 * Lazy load images with Intersection Observer
 */
export class LazyImageLoader {
  private observer: IntersectionObserver | null = null;
  private images = new Set<HTMLImageElement>();

  constructor(options?: IntersectionObserverInit) {
    if (typeof window === 'undefined') return;

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          this.loadImage(img);
        }
      });
    }, options || { rootMargin: '50px' });
  }

  observe(img: HTMLImageElement): void {
    if (!this.observer) return;
    this.images.add(img);
    this.observer.observe(img);
  }

  unobserve(img: HTMLImageElement): void {
    if (!this.observer) return;
    this.images.delete(img);
    this.observer.unobserve(img);
  }

  private loadImage(img: HTMLImageElement): void {
    const src = img.dataset.src;
    if (src) {
      img.src = src;
      img.removeAttribute('data-src');
      this.unobserve(img);
    }
  }

  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.images.clear();
    }
  }
}

/**
 * Generate blur placeholder for images
 */
export function generateBlurDataURL(width: number = 10, height: number = 10): string {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas) return '';

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Create gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#f3f4f6');
  gradient.addColorStop(1, '#e5e7eb');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  return canvas.toDataURL();
}

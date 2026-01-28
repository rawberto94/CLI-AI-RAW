export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <div className="flex flex-col items-center gap-6" role="status" aria-live="polite">
        {/* Logo with pulse animation */}
        <div className="relative motion-safe:animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-400 to-purple-500 rounded-3xl blur-2xl opacity-20 dark:opacity-30 scale-150" />
          {/* Inline SVG Logo - Stacked Bars */}
          <svg 
            width="120" 
            height="120" 
            viewBox="0 0 48 48" 
            className="relative z-10"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="barGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7C3AED" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
              <linearGradient id="barGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#A78BFA" />
              </linearGradient>
              <linearGradient id="barGrad3" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#A78BFA" />
                <stop offset="100%" stopColor="#C4B5FD" />
              </linearGradient>
            </defs>
            <g transform="translate(8, 10)">
              <rect x="0" y="0" width="32" height="8" rx="4" fill="url(#barGrad1)" />
              <rect x="0" y="12" width="32" height="8" rx="4" fill="url(#barGrad2)" />
              <rect x="0" y="24" width="32" height="8" rx="4" fill="url(#barGrad3)" />
            </g>
          </svg>
        </div>
        
        {/* ConTigo Text */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-violet-600 dark:text-violet-400">con</span>
            <span className="text-slate-800 dark:text-slate-200">tigo</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Loading your contract intelligence...</p>
        </div>
        
        {/* Loading dots with reduced motion support */}
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="w-2 h-2 rounded-full bg-violet-500 motion-safe:animate-bounce motion-reduce:opacity-75" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-violet-600 motion-safe:animate-bounce motion-reduce:opacity-75" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-violet-500 motion-safe:animate-bounce motion-reduce:opacity-75" style={{ animationDelay: '300ms' }} />
        </div>
        
        {/* Screen reader text */}
        <span className="sr-only">Loading content, please wait...</span>
      </div>
    </div>
  );
}

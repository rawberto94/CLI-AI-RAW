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
            <g transform="translate(4, 8)">
              <rect x="0" y="0" width="40" height="9" rx="4.5" fill="#6D28D9" />
              <rect x="0" y="13" width="40" height="9" rx="4.5" fill="#8B5CF6" />
              <rect x="0" y="26" width="40" height="9" rx="4.5" fill="#C4B5FD" />
            </g>
          </svg>
        </div>
        
        {/* ConTigo Text */}
        <div className="text-center">
          <h1 className="text-3xl tracking-tight">
            <span className="font-bold text-violet-700 dark:text-violet-400">con</span>
            <span className="font-light text-slate-800 dark:text-slate-200">tigo</span>
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

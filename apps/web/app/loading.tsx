export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-gradient-to-br from-slate-50 to-white">
      <div className="flex flex-col items-center gap-6">
        {/* Logo with pulse animation */}
        <div className="relative animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-r from-teal-400 to-cyan-500 rounded-3xl blur-2xl opacity-20 scale-150" />
          {/* Inline SVG Logo */}
          <svg 
            width="120" 
            height="120" 
            viewBox="0 0 100 100" 
            className="relative z-10"
          >
            <defs>
              <linearGradient id="docGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2DD4BF" />
                <stop offset="100%" stopColor="#0F766E" />
              </linearGradient>
              <linearGradient id="penGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0F766E" />
                <stop offset="100%" stopColor="#065F5B" />
              </linearGradient>
            </defs>
            <rect x="10" y="5" width="55" height="70" rx="8" fill="url(#docGrad)" />
            <rect x="20" y="18" width="22" height="6" rx="3" fill="white" opacity="0.9" />
            <rect x="20" y="32" width="35" height="6" rx="3" fill="white" opacity="0.9" />
            <rect x="20" y="46" width="18" height="6" rx="3" fill="white" opacity="0.7" />
            <g transform="translate(55, 55) rotate(-45)">
              <rect x="-6" y="0" width="12" height="35" rx="2" fill="url(#penGrad)" />
              <polygon points="-6,35 0,48 6,35" fill="url(#penGrad)" />
              <rect x="-5" y="3" width="10" height="5" rx="1" fill="#065F5B" />
            </g>
          </svg>
        </div>
        
        {/* ConTigo Text */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-slate-800">Con</span>
            <span className="text-teal-600">Tigo</span>
          </h1>
          <p className="text-sm text-slate-500 mt-2">Loading your contract intelligence...</p>
        </div>
        
        {/* Loading dots */}
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-teal-600 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

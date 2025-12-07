export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-gradient-to-br from-slate-50 to-white">
      <div className="flex flex-col items-center gap-6">
        {/* Logo with pulse animation */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-teal-400 to-cyan-500 rounded-3xl blur-2xl opacity-20 animate-pulse scale-150" />
          <img 
            src="/logo-final.png" 
            alt="ConTigo" 
            className="h-40 w-40 relative z-10 animate-pulse"
          />
        </div>
        
        {/* Loading text */}
        <div className="text-center">
          <p className="text-sm text-slate-500">Loading your contract intelligence...</p>
        </div>
        
        {/* Loading dots */}
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

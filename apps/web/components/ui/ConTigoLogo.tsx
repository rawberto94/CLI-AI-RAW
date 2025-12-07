'use client';

import Link from 'next/link';

interface ConTigoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export function ConTigoLogo({ size = 'md', showText = true, className = '' }: ConTigoLogoProps) {
  const sizes = {
    sm: { icon: 'w-8 h-8', text: 'text-lg', pen: 'w-3 h-3' },
    md: { icon: 'w-10 h-10', text: 'text-xl', pen: 'w-4 h-4' },
    lg: { icon: 'w-12 h-12', text: 'text-2xl', pen: 'w-5 h-5' },
    xl: { icon: 'w-16 h-16', text: 'text-3xl', pen: 'w-6 h-6' },
  };

  const s = sizes[size];

  return (
    <Link href="/" className={`flex items-center gap-2.5 group ${className}`}>
      {/* Document + Pen Icon */}
      <div className={`relative ${s.icon} flex-shrink-0`}>
        {/* Document */}
        <div className="absolute inset-0 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg shadow-md group-hover:shadow-lg transition-shadow">
          {/* Document lines */}
          <div className="absolute top-[20%] left-[15%] right-[25%] h-[8%] bg-white/90 rounded-full" />
          <div className="absolute top-[38%] left-[15%] right-[15%] h-[8%] bg-white/90 rounded-full" />
          <div className="absolute top-[56%] left-[15%] right-[35%] h-[8%] bg-white/70 rounded-full" />
        </div>
        
        {/* Pen */}
        <div className="absolute -bottom-1 -right-1 transform rotate-[-45deg]">
          <div className="relative">
            {/* Pen body */}
            <div className={`${s.pen} bg-gradient-to-b from-teal-600 to-teal-800 rounded-t-sm`} 
                 style={{ clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)' }}>
            </div>
            {/* Pen tip */}
            <div className="w-0 h-0 mx-auto"
                 style={{ 
                   borderLeft: '4px solid transparent',
                   borderRight: '4px solid transparent',
                   borderTop: '6px solid #0f766e'
                 }}>
            </div>
          </div>
        </div>
      </div>

      {/* Text */}
      {showText && (
        <span className={`font-bold ${s.text} tracking-tight`}>
          <span className="text-slate-800">Con</span>
          <span className="text-teal-600">Tigo</span>
        </span>
      )}
    </Link>
  );
}

// Inline SVG version for better quality
export function ConTigoLogoSVG({ size = 'md', showText = true, className = '' }: ConTigoLogoProps) {
  const sizes = {
    sm: { height: 32, fontSize: 18 },
    md: { height: 40, fontSize: 22 },
    lg: { height: 48, fontSize: 26 },
    xl: { height: 64, fontSize: 32 },
  };

  const s = sizes[size];
  // Use unique IDs to avoid conflicts when multiple logos on page
  const gradientId = `docGrad_${size}`;
  const penGradientId = `penGrad_${size}`;

  return (
    <Link href="/" className={`flex items-center gap-2.5 group ${className}`}>
      {/* SVG Icon */}
      <svg 
        width={s.height} 
        height={s.height} 
        viewBox="0 0 100 100" 
        className="flex-shrink-0 group-hover:scale-105 transition-transform"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2DD4BF" />
            <stop offset="100%" stopColor="#0F766E" />
          </linearGradient>
          <linearGradient id={penGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0F766E" />
            <stop offset="100%" stopColor="#065F5B" />
          </linearGradient>
        </defs>
        
        {/* Document body */}
        <rect x="10" y="5" width="55" height="70" rx="8" fill={`url(#${gradientId})`} />
        
        {/* Document lines */}
        <rect x="20" y="18" width="22" height="6" rx="3" fill="white" opacity="0.9" />
        <rect x="20" y="32" width="35" height="6" rx="3" fill="white" opacity="0.9" />
        <rect x="20" y="46" width="18" height="6" rx="3" fill="white" opacity="0.7" />
        
        {/* Pen */}
        <g transform="translate(55, 55) rotate(-45)">
          <rect x="-6" y="0" width="12" height="35" rx="2" fill={`url(#${penGradientId})`} />
          <polygon points="-6,35 0,48 6,35" fill={`url(#${penGradientId})`} />
          <rect x="-5" y="3" width="10" height="5" rx="1" fill="#065F5B" />
        </g>
      </svg>

      {/* Text */}
      {showText && (
        <span className="font-bold tracking-tight" style={{ fontSize: s.fontSize }}>
          <span className="text-slate-800">Con</span>
          <span className="text-teal-600">Tigo</span>
        </span>
      )}
    </Link>
  );
}

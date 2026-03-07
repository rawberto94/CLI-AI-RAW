'use client';

/**
 * Avatar & Avatar Group Components
 * User avatars with fallbacks, status, and grouping
 */

import React from 'react';
import { motion } from 'framer-motion';
import { User, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type AvatarStatus = 'online' | 'offline' | 'busy' | 'away';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  icon?: LucideIcon;
  className?: string;
  ring?: boolean;
  ringColor?: string;
}

interface AvatarGroupProps {
  avatars: AvatarProps[];
  max?: number;
  size?: AvatarSize;
  className?: string;
}

// ============================================================================
// Utilities
// ============================================================================

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-20 h-20 text-xl',
};

const statusColors: Record<AvatarStatus, string> = {
  online: 'bg-violet-500',
  offline: 'bg-slate-400',
  busy: 'bg-red-500',
  away: 'bg-amber-500',
};

const statusSizes: Record<AvatarSize, string> = {
  xs: 'w-1.5 h-1.5 border',
  sm: 'w-2 h-2 border',
  md: 'w-2.5 h-2.5 border-2',
  lg: 'w-3 h-3 border-2',
  xl: 'w-4 h-4 border-2',
  '2xl': 'w-5 h-5 border-2',
};

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '';
  const firstPart = parts[0];
  const lastPart = parts[parts.length - 1];
  if (parts.length === 1 && firstPart) return firstPart.charAt(0).toUpperCase();
  if (firstPart && lastPart) {
    return (firstPart.charAt(0) + lastPart.charAt(0)).toUpperCase();
  }
  return '';
}

function getColorFromName(name: string): string {
  const colors = [
    'bg-rose-500',
    'bg-pink-500',
    'bg-fuchsia-500',
    'bg-violet-500',
    'bg-violet-500',
    'bg-violet-500',
    'bg-violet-500',
    'bg-sky-500',
    'bg-violet-500',
    'bg-violet-500',
    'bg-violet-500',
    'bg-green-500',
    'bg-lime-500',
    'bg-yellow-500',
    'bg-amber-500',
    'bg-orange-500',
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length] ?? 'bg-slate-500';
}

// ============================================================================
// Avatar Component
// ============================================================================

export function Avatar({
  src,
  alt,
  name,
  size = 'md',
  status,
  icon: Icon,
  className,
  ring = false,
  ringColor = 'ring-white',
}: AvatarProps) {
  const [imgError, setImgError] = React.useState(false);
  const showImage = src && !imgError;
  const initials = name ? getInitials(name) : '';
  const bgColor = name ? getColorFromName(name) : 'bg-slate-300';

  return (
    <div className={cn('relative inline-block', className)}>
      <div
        className={cn(
          'rounded-full flex items-center justify-center overflow-hidden',
          sizeClasses[size],
          ring && `ring-2 ${ringColor}`,
          !showImage && bgColor
        )}
      >
        {showImage ? (
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : initials ? (
          <span className="font-medium text-white">{initials}</span>
        ) : Icon ? (
          <Icon className="w-1/2 h-1/2 text-white" />
        ) : (
          <User className="w-1/2 h-1/2 text-slate-400" />
        )}
      </div>

      {/* Status indicator */}
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-white',
            statusColors[status],
            statusSizes[size]
          )}
        />
      )}
    </div>
  );
}

// ============================================================================
// Avatar Group
// ============================================================================

export function AvatarGroup({
  avatars,
  max = 4,
  size = 'md',
  className,
}: AvatarGroupProps) {
  const visibleAvatars = avatars.slice(0, max);
  const remainingCount = avatars.length - max;

  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {visibleAvatars.map((avatar, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
        >
          <Avatar {...avatar} size={size} ring ringColor="ring-white" />
        </motion.div>
      ))}

      {remainingCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: max * 0.05 }}
          className={cn(
            'rounded-full bg-slate-200 flex items-center justify-center ring-2 ring-white',
            sizeClasses[size]
          )}
        >
          <span className="font-medium text-slate-600">+{remainingCount}</span>
        </motion.div>
      )}
    </div>
  );
}

// ============================================================================
// Avatar with Name
// ============================================================================

interface AvatarWithNameProps extends AvatarProps {
  subtitle?: string;
  nameClassName?: string;
  subtitleClassName?: string;
  layout?: 'horizontal' | 'vertical';
}

export function AvatarWithName({
  subtitle,
  nameClassName,
  subtitleClassName,
  layout = 'horizontal',
  ...avatarProps
}: AvatarWithNameProps) {
  return (
    <div
      className={cn(
        'flex items-center',
        layout === 'horizontal' ? 'gap-3' : 'flex-col gap-2 text-center'
      )}
    >
      <Avatar {...avatarProps} />
      <div>
        {avatarProps.name && (
          <p
            className={cn(
              'font-medium text-slate-900',
              nameClassName
            )}
          >
            {avatarProps.name}
          </p>
        )}
        {subtitle && (
          <p
            className={cn(
              'text-sm text-slate-500',
              subtitleClassName
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Editable Avatar
// ============================================================================

interface EditableAvatarProps extends AvatarProps {
  onUpload: (file: File) => void;
}

export function EditableAvatar({
  onUpload,
  size = 'xl',
  ...avatarProps
}: EditableAvatarProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
    }
  };

  return (
    <div className="relative group">
      <Avatar {...avatarProps} size={size} />
      
      {/* Edit overlay */}
      <button
        onClick={() => inputRef.current?.click()}
        className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        aria-label="Change avatar"
      >
        <span className="text-white text-xs font-medium">Edit</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
        aria-label="Upload avatar image"
      />
    </div>
  );
}

'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Users, Wifi, WifiOff } from 'lucide-react';
import { useWebSocket, type Presence } from '@/contexts/websocket-context';
import { cn } from '@/lib/utils';

interface PresenceIndicatorProps {
  maxAvatars?: number;
  showConnectionStatus?: boolean;
  className?: string;
}

export function PresenceIndicator({
  maxAvatars = 5,
  showConnectionStatus = true,
  className,
}: PresenceIndicatorProps) {
  const { connected, presence } = useWebSocket();
  const collaborators = Array.from(presence.values());
  const visibleCollaborators = collaborators.slice(0, maxAvatars);
  const hiddenCount = collaborators.length - maxAvatars;

  if (collaborators.length === 0 && !showConnectionStatus) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showConnectionStatus && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
                connected 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-500'
              )}>
                {connected ? (
                  <Wifi className="h-3 w-3" />
                ) : (
                  <WifiOff className="h-3 w-3" />
                )}
                <span className="hidden sm:inline">
                  {connected ? 'Live' : 'Offline'}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {connected 
                ? 'Real-time collaboration active' 
                : 'Not connected - changes will sync when online'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {collaborators.length > 0 && (
        <div className="flex items-center">
          <Users className="h-4 w-4 text-muted-foreground mr-1" />
          <div className="flex -space-x-2">
            {visibleCollaborators.map((user) => (
              <CollaboratorAvatar key={user.userId} user={user} />
            ))}
            {hiddenCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium">
                      +{hiddenCount}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      {collaborators.slice(maxAvatars).map((user) => (
                        <div key={user.userId} className="flex items-center gap-2">
                          <div 
                            className="h-2 w-2 rounded-full" 
                            style={{ backgroundColor: user.color }}
                          />
                          <span>{user.name}</span>
                        </div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CollaboratorAvatar({ user }: { user: Presence }) {
  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
            <Avatar 
              className="h-8 w-8 border-2 border-background"
              style={{ borderColor: user.color }}
            >
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback 
                className="text-xs"
                style={{ backgroundColor: user.color, color: 'white' }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            {/* Online indicator */}
            <span 
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500"
              aria-hidden="true"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-col gap-1">
            <span className="font-medium">{user.name}</span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =====================
// Cursor Overlay Component
// =====================

interface CursorOverlayProps {
  containerRef: React.RefObject<HTMLElement>;
}

export function CursorOverlay({ containerRef }: CursorOverlayProps) {
  const { presence } = useWebSocket();
  const collaborators = Array.from(presence.values()).filter(u => u.cursor);

  if (collaborators.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {collaborators.map((user) => (
        user.cursor && (
          <div
            key={user.userId}
            className="absolute transition-all duration-100"
            style={{
              left: user.cursor.x,
              top: user.cursor.y,
              transform: 'translate(-2px, -2px)',
            }}
          >
            {/* Cursor pointer */}
            <svg
              width="24"
              height="36"
              viewBox="0 0 24 36"
              fill="none"
              style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
            >
              <path
                d="M5.65376 12.456H0.5L0.5 0.5L13.6428 13.6428L5.65376 13.6428L5.65376 12.456Z"
                fill={user.color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            {/* Name label */}
            <div
              className="absolute left-4 top-5 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: user.color }}
            >
              {user.name.split(' ')[0]}
            </div>
          </div>
        )
      ))}
    </div>
  );
}

// =====================
// Selection Highlight Component
// =====================

interface SelectionHighlightProps {
  textRef: React.RefObject<HTMLElement>;
}

export function SelectionHighlight({ textRef }: SelectionHighlightProps) {
  const { presence } = useWebSocket();
  const collaborators = Array.from(presence.values()).filter(u => u.selection);

  // This is a simplified version - in production, you'd need to 
  // calculate the actual text positions for highlighting
  if (collaborators.length === 0 || !textRef.current) {
    return null;
  }

  return (
    <>
      {collaborators.map((user) => (
        user.selection && (
          <div
            key={`selection-${user.userId}`}
            className="pointer-events-none absolute"
            style={{
              backgroundColor: `${user.color}33`, // 20% opacity
              // Position would be calculated based on text ranges
            }}
          />
        )
      ))}
    </>
  );
}

/**
 * ScrollArea Component
 * Simple scrollable area wrapper
 */

import * as React from 'react';

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div ref={ref} className={`overflow-auto ${className}`} {...props}>
        {children}
      </div>
    );
  }
);

ScrollArea.displayName = 'ScrollArea';

"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface InteractiveCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  clickable?: boolean;
  selectable?: boolean;
  selected?: boolean;
  status?: "success" | "warning" | "error" | "info";
  onSelect?: () => void;
}

const statusColors = {
  success: "border-l-success",
  warning: "border-l-warning",
  error: "border-l-destructive",
  info: "border-l-primary",
};

const InteractiveCard = React.forwardRef<HTMLDivElement, InteractiveCardProps>(
  (
    {
      hoverable = true,
      clickable = false,
      selectable = false,
      selected = false,
      status,
      onSelect,
      className,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (selectable && onSelect) {
        onSelect();
      }
      if (clickable && onClick) {
        onClick(e);
      }
    };

    const CardWrapper = hoverable ? motion.div : "div";

    return (
      <CardWrapper
        {...(hoverable
          ? {
              whileHover: { y: -4, boxShadow: "0 12px 24px -8px rgba(0,0,0,0.15)" },
              whileTap: clickable ? { scale: 0.98 } : undefined,
              transition: { duration: 0.2 },
            }
          : {})}
      >
        <Card
          ref={ref}
          className={cn(
            "transition-all duration-200 relative",
            (clickable || selectable) && "cursor-pointer",
            hoverable && "hover:shadow-lg",
            status && `border-l-4 ${statusColors[status]}`,
            selected && "ring-2 ring-primary ring-offset-2",
            className
          )}
          onClick={handleClick}
          {...props}
        >
          {selectable && (
            <div className="absolute top-4 right-4 z-10">
              <input
                type="checkbox"
                checked={selected}
                onChange={onSelect}
                onClick={(e) => e.stopPropagation()}
                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
                aria-label="Select card"
              />
            </div>
          )}
          {children}
        </Card>
      </CardWrapper>
    );
  }
);

InteractiveCard.displayName = "InteractiveCard";

export { InteractiveCard };
export type { InteractiveCardProps };

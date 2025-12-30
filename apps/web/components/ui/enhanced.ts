/**
 * Enhanced UI Components Exports
 * Centralized exports for the new enhanced components
 */

// Button enhancements (adds success, gradient, glass variants)
export { Button, buttonVariants } from "./button";
export type { ButtonProps } from "./button";

// Interactive Card - cards with hover, selection, and status
export { InteractiveCard } from "./interactive-card";
export type { InteractiveCardProps } from "./interactive-card";

// Stat Card - KPI cards with trends and icons
export { StatCard } from "./stat-card";
export type { StatCardProps } from "./stat-card";

// Search Input - already existed with advanced features!
export { default as SearchInput } from "./search-input";
export { useDebouncedSearch } from "./search-input";
export type { SearchInputProps, UseDebouncedSearchOptions, UseDebouncedSearchReturn } from "./search-input";

// Re-export existing components for convenience
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";
export { Input } from "./input";
export { Badge } from "./badge";

/**
 * ============================================================================
 * CONTIGO DESIGN SYSTEM STANDARDS
 * ============================================================================
 * 
 * This file documents the standardized design tokens and patterns used across
 * the application. Follow these guidelines for consistent UI/UX.
 * 
 * Last Updated: January 2026
 */

// ============================================================================
// TYPOGRAPHY SCALE
// ============================================================================

export const TYPOGRAPHY = {
  // Page Titles - Main page headers
  pageTitle: 'text-3xl font-bold', // 30px, 700 weight
  
  // Section Headers - Major content sections
  sectionTitle: 'text-2xl font-bold', // 24px, 700 weight
  
  // Card Titles - Card header text
  cardTitle: 'text-lg font-semibold', // 18px, 600 weight (via CardTitle component)
  
  // Stat Card Values - Large numbers in stat cards
  statValue: 'text-2xl font-bold', // 24px, 700 weight
  
  // Stat Card Labels - Description under stat values
  statLabel: 'text-xs text-muted-foreground', // 12px, muted color
  
  // Body Text - Regular content
  body: 'text-sm', // 14px
  bodyLarge: 'text-base', // 16px
  
  // Helper/Caption Text
  helper: 'text-xs text-muted-foreground', // 12px, muted
  caption: 'text-[10px]', // 10px - micro badges only
  
  // Table Headers
  tableHeader: 'text-[11px] font-medium uppercase tracking-wide',
} as const;

// ============================================================================
// SPACING STANDARDS
// ============================================================================

export const SPACING = {
  // Card Content Padding - Standard for all CardContent
  cardPadding: 'p-5', // 20px - STANDARD
  cardPaddingCompact: 'p-4', // 16px - Dense tables/lists only
  
  // Section Spacing - Between major sections
  sectionGap: 'space-y-6', // 24px between sections
  
  // Grid Gaps - For stat cards and content grids
  gridGap: 'gap-5', // 20px - STANDARD for all grids
  gridGapCompact: 'gap-4', // 16px - Dense grids only
  
  // Inner Content Spacing
  contentGap: 'space-y-4', // 16px within cards
  
  // Container Padding
  containerPaddingX: 'px-4 sm:px-6 lg:px-8',
  containerPaddingY: 'py-6 lg:py-8',
} as const;

// ============================================================================
// ICON SIZES
// ============================================================================

export const ICON_SIZES = {
  // Page Header Icons - Main title icons
  pageHeader: 'w-8 h-8', // 32px
  
  // Stat Card Icons - In stat card containers
  statCard: 'w-6 h-6', // 24px - STANDARD
  
  // List Item Icons - In tables/lists
  listItem: 'w-4 h-4', // 16px
  
  // Button Icons - Inside buttons
  button: 'w-4 h-4', // 16px
  
  // Tiny Indicators - Badges, small status
  tiny: 'w-3 h-3', // 12px
  
  // Micro Indicators - Very small status dots
  micro: 'w-2.5 h-2.5', // 10px
} as const;

// ============================================================================
// CONTAINER WIDTHS
// ============================================================================

export const CONTAINERS = {
  // Main Pages - Dashboard, contracts list, etc.
  mainPage: 'max-w-[1600px]', // 1600px
  
  // Detail Pages - Contract detail, settings
  detailPage: 'max-w-[1600px]', // 1600px
  
  // Settings/Forms - Focused content
  formPage: 'max-w-4xl', // 896px
  
  // Full Width - Tables, wide content
  fullWidth: 'max-w-[1600px]',
} as const;

// ============================================================================
// GRID PATTERNS
// ============================================================================

export const GRIDS = {
  // Stat Cards - 5 columns max
  statsGrid: 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5',
  
  // Content Cards - 3 columns max
  contentGrid: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  
  // Two Column Layout
  twoColumn: 'grid grid-cols-1 lg:grid-cols-2',
  
  // Detail Grid - Main + Sidebar
  detailLayout: 'grid grid-cols-1 lg:grid-cols-3',
} as const;

// ============================================================================
// COMPONENT STANDARDS
// ============================================================================

export const COMPONENTS = {
  // Stat Card Pattern
  statCard: {
    container: 'p-5',
    icon: 'w-6 h-6',
    value: 'text-2xl font-bold',
    label: 'text-xs text-muted-foreground',
    iconContainer: 'p-2 rounded-lg',
  },
  
  // Filter Bar Pattern
  filterBar: {
    container: 'p-5',
    searchInput: 'pl-9 min-w-[200px]',
    selectWidth: 'w-[160px]',
  },
  
  // List Item Pattern
  listItem: {
    container: 'p-4 hover:bg-muted/50 rounded-lg transition-colors',
    icon: 'w-4 h-4',
    title: 'font-medium text-sm',
    subtitle: 'text-xs text-muted-foreground',
  },
} as const;

// ============================================================================
// COLOR PATTERNS
// ============================================================================

export const COLORS = {
  // Status Colors
  status: {
    success: {
      bg: 'bg-green-100',
      text: 'text-green-600',
      border: 'border-green-300',
    },
    warning: {
      bg: 'bg-amber-100',
      text: 'text-amber-600',
      border: 'border-amber-300',
    },
    error: {
      bg: 'bg-red-100',
      text: 'text-red-600',
      border: 'border-red-300',
    },
    info: {
      bg: 'bg-violet-100',
      text: 'text-violet-600',
      border: 'border-violet-300',
    },
  },
  
  // Priority Colors
  priority: {
    critical: 'text-red-600 bg-red-100',
    high: 'text-orange-600 bg-orange-100',
    medium: 'text-amber-600 bg-amber-100',
    low: 'text-green-600 bg-green-100',
  },
} as const;

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/*
STAT CARD EXAMPLE:
```tsx
<Card>
  <CardContent className="p-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <div className="p-2 rounded-lg bg-violet-50">
        <Icon className="w-6 h-6 text-violet-600" />
      </div>
    </div>
  </CardContent>
</Card>
```

GRID LAYOUT EXAMPLE:
```tsx
<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
  {stats.map(stat => <StatCard key={stat.id} {...stat} />)}
</div>
```

FILTER BAR EXAMPLE:
```tsx
<Card>
  <CardContent className="p-5">
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search..." className="pl-9" />
      </div>
      <Select>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Filter" />
        </SelectTrigger>
        <SelectContent>...</SelectContent>
      </Select>
    </div>
  </CardContent>
</Card>
```
*/

export default {
  TYPOGRAPHY,
  SPACING,
  ICON_SIZES,
  CONTAINERS,
  GRIDS,
  COMPONENTS,
  COLORS,
};

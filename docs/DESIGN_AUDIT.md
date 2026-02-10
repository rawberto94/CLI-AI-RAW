# ConTigo Design Audit — Full Application Review

> **Scope**: Landing page, 8 marketing pages, 156 app pages, 125 UI components, design system  
> **Date**: Phase 13 Production Readiness Audit  
> **Status**: Complete audit with prioritized improvement plan

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Marketing / Landing Pages](#2-marketing--landing-pages)
3. [Core App Pages](#3-core-app-pages)
4. [Design System & Component Library](#4-design-system--component-library)
5. [Cross-Cutting Issues](#5-cross-cutting-issues)
6. [Improvement Plan](#6-improvement-plan)

---

## 1. Executive Summary

### Scope Audited

| Area | Count |
|------|-------|
| Page files (`page.tsx`) | 156 |
| Layout files (`layout.tsx`) | 7 |
| Marketing pages | 9 (root + 8 under `(marketing)/`) |
| Core app pages (deep audit) | 14 highest-traffic pages |
| UI components (`components/ui/`) | 125 files |
| Domain component folders | 143 top-level directories |

### Overall Score: **C+** (Functional but inconsistent, significant technical debt)

| Dimension | Grade | Summary |
|-----------|-------|---------|
| **Visual Design** | B | Polished violet/purple aesthetic with rich gradients and Framer Motion — when it works |
| **Design Consistency** | D | THREE distinct design systems across marketing pages; app pages vary in color primaries, header patterns, backgrounds |
| **Dark Mode** | D | Infrastructure exists (CSS vars, ThemeProvider, `next-themes`) but ~50% of pages break or are light-only |
| **Accessibility** | C | Some excellent pages (workflows) but most lack ARIA, skip-link target is broken, reduced-motion inconsistent |
| **Performance** | C- | Massive monolith files (4,991 / 3,479 / 1,643 lines), 12 loading components, heavy animations, 40+ icon imports per page |
| **SEO** | F (marketing) / N/A (app) | Root landing page is `'use client'` with zero metadata — SEO is DEAD on the most important page |
| **Code Quality** | C | Good primitives (Radix + cva), but extreme file sizes, 3-4 component variants per concept, significant duplication |
| **Mobile** | B- | Generally responsive via Tailwind breakpoints, but some overflow issues and missing mobile navs on marketing pages |

### Top 5 Urgent Issues

| # | Issue | Impact |
|---|-------|--------|
| 1 | Root landing page `'use client'` — no SSR, no metadata | SEO is broken on the most important page |
| 2 | 4 monolith page files (Templates 4,991L, Contracts 3,479L, Landing 1,643L, Pricing 1,132L) | Unmaintainable, massive bundles |
| 3 | Admin page has ZERO dark mode support | Completely unreadable when user enables dark mode |
| 4 | No shared marketing layout — 8 separate header/footer/nav implementations | Brand inconsistency, massive code duplication |
| 5 | Broken AI color tokens (`--ai-primary` through `--ai-danger` undefined in CSS vars) | `ai.*` Tailwind classes render as invisible `hsl()` |

---

## 2. Marketing / Landing Pages

### 2.1 Architecture Overview

| Page | Lines | Type | Metadata | Dark Mode | Nav |
|------|-------|------|----------|-----------|-----|
| **Root `/`** | 1,643 | `'use client'` | **NONE** | None | Floating pill |
| **Pricing** | 1,132 | `'use client'` | **NONE** | None | Traditional sticky |
| **Features** | 365 | Server | ✅ | Hardcoded dark | Standard fixed |
| **About** | 303 | `'use client'` (unnecessary) | **NONE** | Hardcoded dark | Standard fixed |
| **Contact** | 341 | `'use client'` | **NONE** | Hardcoded dark | Standard fixed |
| **Security** | 350 | Server | ✅ | Hardcoded dark | Minimal (no nav links) |
| **Terms** | 229 | Server | ✅ | Hardcoded dark | Minimal (no nav links) |
| **Privacy** | 253 | Server | ✅ | Hardcoded dark | Minimal (no nav links) |
| **Home** | 5 | Server | N/A | N/A | N/A (redirect to `/`) |

### 2.2 THREE Different Design Systems

| Group | Pages | Background | Logo | Color Accent |
|-------|-------|-----------|------|-------------|
| **System A** (Light) | Root `/` | White | Stacked bars SVG | violet-600 |
| **System B** (Light) | Pricing | White | Stacked bars (diff gradient IDs) | violet-600 |
| **System C** (Dark) | Features, About, Contact, Security, Terms, Privacy | slate-950 | FileText icon in box | purple-500 / violet-500 |

A user navigating between pages experiences **jarring visual mismatch** — light animated root → dark static features page.

### 2.3 Critical Issues (P0)

1. **Root page `'use client'` kills SEO** — Most important page has no `metadata` export, no SSR. Search engines see an empty shell.
2. **Pricing page `'use client'` with no metadata** — High-value conversion page invisible to SEO.
3. **About page `'use client'` for zero interactivity** — Unnecessarily blocks SSR.
4. **No shared `(marketing)/layout.tsx`** — Each page reinvents header (~30-60 lines), footer, and page wrapper. 8 separate implementations.

### 2.4 Important Issues (P1)

5. **`#main-content` skip link target doesn't exist** — Root layout has skip-to-content link but no page wraps content in `<main id="main-content">`.
6. **FAQ accordion lacks ARIA** — `FAQItem` missing `aria-expanded`, `aria-controls`, `role="region"`.
7. **MobileMenu lacks focus trap and keyboard dismissal** — Accessibility violation.
8. **Floating nav has no `<nav>` landmark** — Screen readers can't identify navigation.
9. **Privacy Shield reference invalidated** — Terms page references EU-US Privacy Shield (struck down 2020 by Schrems II). Legal liability.
10. **Broken CSS string in pricing** — Line 1078 has escaped backslash in className.

### 2.5 Moderate Issues (P2)

11. **1,643-line monolith root page** — ~15 inline components (GradientOrb, ParticleField, AnimatedGrid, GlowCard, TiltCard, ShimmerButton, MorphingBlob, AnimatedCounter, FAQItem, FeatureCard, etc.).
12. **No dark mode on any marketing page** — Despite ThemeProvider and CSS variables being fully configured.
13. **Fake form submission on pricing** — `setTimeout(1500)` with success message but no API call.
14. **Contact cards not actionable** — Email not a `mailto:` link, chat/sales have no action.
15. **ParticleField hydration mismatch** — `Math.random()` in render causes React warnings.
16. **Duplicate keyframe definitions** — `float`, `shimmer` defined in both `page.tsx` `<style>` blocks AND `globals.css`.
17. **Color inconsistency** — violet/purple primary but amber FAQ, rose support section, fuchsia hero gradient.
18. **Security/Terms/Privacy pages have no nav links** — Can't navigate to Features, Pricing, etc.

### 2.6 Minor Issues (P3)

19. **`/home` route 302-redirects to `/`** — Should be `permanentRedirect` or removed (wastes crawl budget).
20. **Pointless gradients** — `from-violet-600 to-violet-600` produces no gradient.
21. **Placeholder illustrations** — Giant icons at 20% opacity, not real screenshots/mockups.
22. **Fabricated stats on About page** — "500+ customers", "10M+ contracts" for a startup.
23. **`whitespace-pre-line` in Terms** — Bullet points as literal `•` instead of semantic `<ul>/<li>`.
24. **Privacy page is marketing summary** — Not a real legal document; cards/bullets instead of numbered legal sections.

---

## 3. Core App Pages

### 3.1 Page Size Overview

| Page | Lines | Verdict |
|------|-------|---------|
| **Templates** | 4,991 | **CRITICAL** — largest file, 30+ useState hooks |
| **Contracts list** | 3,479 | **CRITICAL** — needs decomposition into 10+ components |
| **Contract detail** | 1,537 | Large but has started extracting child components |
| **Contract upload** | 1,121 | Moderate — should extract upload logic |
| **Admin** | 955 | Large — zero dark mode |
| **Sign In** | 990 | Bloated — inline particles, orbs, testimonials, SSO icons |
| **Sign Up** | 943 | Nearly identical to Sign In — duplicates FloatingParticles, GradientOrbs, SSO icons |
| **Workflows** | 711 | **Best quality reference** — proper dark mode, ARIA, reduced motion |
| **Dashboard** | 663 | Good dark mode, but hardcoded placeholder data |
| **Notifications** | 575 | Good dark mode, proper semantic HTML |
| **Analytics** | ~230 | Clean, delegates to AnalyticsHub |
| **Search** | ~160 | Clean, ErrorBoundary, good dark mode |
| **Settings** (client) | 856 | Good dark mode, proper `aria-current` |
| **Rate Cards** | 7 | Just a redirect to `/rate-cards/dashboard` |

### 3.2 Dark Mode Support by Page

| Status | Pages |
|--------|-------|
| ✅ **Excellent** | Workflows (best reference implementation) |
| ✅ **Good** | Dashboard, Analytics, Search, Settings, Notifications |
| ⚠️ **Partial** | Contract detail (depends on child components) |
| ❌ **Poor** | Contracts list (badges/rows light-only), Upload (file icons), Templates (category colors) |
| ❌ **None** | **Admin** (entire page light-only), Sign In (form panel), Sign Up (form panel) |

### 3.3 Per-Page Issues

#### Dashboard (663 lines)

- **P3**: Hardcoded placeholder data ("Sample Contract 1-4") instead of real data
- **P3**: Static "+12%" badge not derived from actual data
- **P2**: KPI card icons lack `aria-hidden="true"` (decorative icons read by screen readers)
- **P3**: Quick action gradient `from-violet-500 to-violet-500` produces no gradient

#### Contracts List (3,479 lines)

- **P0**: 3,479 lines — extreme maintainability problem
- **P1**: `SignatureStatusBadge` and `DocumentTypeBadge` use hardcoded light-mode-only colors (`bg-green-50`, `text-green-700`, `bg-amber-50`) — no `dark:` variants
- **P1**: `ContractRowSkeleton` uses `bg-white` with no dark variant
- **P2**: `CompactContractRow` uses `bg-white`, `text-slate-800` without dark counterparts
- **P2**: `AnimatedCounter` duplicated here vs sign-in page
- **P3**: ~40 Lucide icons imported, many unused

#### Contract Detail (1,537 lines)

- **P1**: Still too large despite child component extraction
- **P2**: 20+ `useState` hooks — complex state surface
- **P3**: Keyboard shortcuts (1-4 keys) lack discoverability

#### Contract Upload (1,121 lines)

- **P1**: `getFileIcon()` uses hardcoded colors with no dark variants
- **P2**: Upload progress simulation is artificial (`for (let i = 10; i <= 50; i += 10)`)
- **P3**: Good `useDropzone` integration

#### Admin (955 lines)

- **P0**: **ZERO dark mode** — `bg-gradient-to-br from-slate-50 via-white to-slate-100`, `bg-white/90`, `text-gray-900` throughout. Completely unreadable in dark mode.
- **P1**: `AIAccuracyDashboard` all hardcoded light colors
- **P1**: Subscription card uses `indigo` instead of `violet` — inconsistent primary
- **P2**: Uses `confirm()` for remove member — should use proper Radix `AlertDialog`

#### Sign In (990 lines)

- **P0**: 990 lines for a sign-in page — contains FloatingParticles, GradientOrbs, WavePattern, AnimatedCounter, TestimonialCarousel, 3 SSO icon components all inline
- **P1**: Form panel has no dark mode: `bg-gradient-to-br from-slate-50 via-white to-purple-50/30`
- **P2**: Hardcoded demo credentials (`admin@contigo.com` / `Admin123!`) as default values
- **P2**: Native `<input type="checkbox">` for Remember Me instead of Radix Checkbox
- **P3**: Copyright says "© 2025" — should be dynamic

#### Sign Up (943 lines)

- **P0**: Same bloat — FloatingParticles, GradientOrbs, 3 SSO icons all duplicated from Sign In
- **P1**: FloatingParticles does NOT check `prefers-reduced-motion` (Sign In version DOES)
- **P1**: Form side no dark mode
- **P2**: Uses `useState()` as an effect for invite token check — should be `useEffect`

#### Templates (4,991 lines)

- **P0**: **LARGEST FILE IN THE ENTIRE APP** — 30+ useState hooks. Must be decomposed urgently.
- **P1**: `categoryColors` uses hardcoded `bg-violet-50`, `text-violet-700` — no dark variants
- **P1**: `getHealthScoreColor` hardcoded light-mode classes
- **P2**: Feature bloat — many state variables for cloud sync, scheduling, dependencies, audit trail appear partially implemented

#### Workflows (711 lines) — **BEST REFERENCE**

- ✅ Best dark mode: consistent `dark:` on every element
- ✅ Best accessibility: `aria-hidden="true"` on decorative icons, `aria-label` on buttons, `motion-reduce:` classes
- ✅ Proper Suspense fallback
- **P2**: Uses `indigo` instead of pure `violet` (`text-indigo-300`, `text-indigo-400`)

---

## 4. Design System & Component Library

### 4.1 Tailwind Config (Well-Structured)

- **Color system**: HSL CSS variable tokens (shadcn/ui pattern) — `background`, `foreground`, `primary`, `secondary`, `muted`, `accent`, `destructive`, plus 5 chart colors and AI-specific tokens
- **Dark mode**: `darkMode: ["class"]` with complete `.dark` CSS variable definitions
- **Primary**: Violet (`262 83% 58%` light / `262 83% 65%` dark)
- **Dark backgrounds**: Purple-tinted (`260 20% 6%`, `260 20% 8%`) — cohesive
- **Animations**: 6 keyframes via config + `tailwindcss-animate` plugin

### 4.2 Global CSS (1,090 lines — Issues)

| Issue | Severity | Detail |
|-------|----------|--------|
| **Broken AI tokens** | Critical | `--ai-primary` through `--ai-danger` referenced in Tailwind config but **never defined** in CSS. The `ai.*` Tailwind classes produce invisible `hsl()` values. |
| **`fade-in` defined 3 times** | Major | Three separate `@keyframes fade-in` with three different `translateY` values (20px, 8px, 0). Last definition wins, making earlier ones dead code. |
| **Duplicate animations** | Major | `slide-up`, `scale-in` defined twice with different timings. `shimmer` defined twice with different behavior. `stagger-children` fully duplicated. |
| **`.btn-primary` uses BLUE** | Major | `@layer components` defines buttons with `bg-blue-600` / `ring-blue-500` while React `Button` component uses violet. Split personality. |
| **`design-system.tsx` uses SKY BLUE** | Moderate | Exports `#0ea5e9` (sky-500) as primary color, contradicting the violet theme. |
| **Unused CSS classes** | Moderate | Large `@layer components` block (btn, badge, card, table CSS classes) likely unused since pages import React components. |

### 4.3 Component Library (125 UI Files — Bloated)

**Core primitives are high quality:**

- `Button` — cva + Radix Slot + 10 variants + loading state + dark mode + focus ring ✅
- `Card` — Full dark mode + hover transition ✅
- `Badge` — 10 variants + dark mode ✅
- `Input` — Dark mode + violet focus ring + `aria-invalid` error state ✅
- `Dialog` — Radix + size variants + enter/exit animations ✅
- `Select` — Radix + dark mode + consistent violet focus ✅

**Severe duplication problem:**

| Concept | Variants That Exist |
|---------|--------------------|
| **Loading** | `loading`, `loading-button`, `loading-skeleton`, `loading-skeletons`, `loading-states`, `loading-examples`, `page-loading`, `animated-skeletons`, `skeleton`, `skeleton-loader`, `skeletons`, `spinner` — **12 overlapping files** |
| **Cards** | `card`, `animated-card`, `enhanced-card`, `interactive-card`, `interactive-cards`, `stat-card`, `success-card` — **7 variants** |
| **Design system** | `design-system.tsx` (sky blue), `professional-design-system.tsx` (868 lines), `enhanced.ts` barrel |
| **Data mode** | `DataModeBanner.tsx` + `data-mode-banner.tsx`, `DataModeToggle.tsx` + `data-mode-toggle.tsx` — **duplicate casing pairs** |
| **Error handling** | `error/` + `error-boundary/` + `errors/` — 3 directories |
| **Toasts** | `toast/` + `toast-system/` + `undo-toast/` — 3 directories |

**Barrel file coverage**: `components/ui/index.ts` only exports ~15 of 125 components. Most are dead or orphaned.

### 4.4 Layout Components

- `AppLayout` / `DashboardLayout` / `ContractLayout` / `AILayout` exist in [components/layout/AppLayout.tsx](apps/web/components/layout/AppLayout.tsx)
- **Critical**: `AppLayout` header uses **hardcoded light-only colors** (`bg-white/80`, `text-slate-900`, `text-slate-700`) — **ZERO `dark:` variants**. The shared layout shell breaks in dark mode.
- Only 3 pages use `DashboardLayout` — most pages have no shared layout wrapper.
- `ResponsiveExamples.tsx` is a demo file living in the production layout directory.

---

## 5. Cross-Cutting Issues

### 5.1 Design Consistency

| Aspect | Reality |
|--------|---------|
| **Primary color** | Dashboard/Contracts: `violet`, Analytics: `purple/pink`, Admin: `purple/indigo`, Settings: `slate`, Workflows: `indigo`, Marketing: 3 different systems |
| **Header pattern** | `text-4xl` gradient (analytics, search) vs `text-3xl` (admin, settings) vs layout wrapper (dashboard) |
| **Page backgrounds** | Dashboard: via layout, Admin: `slate-50/white/slate-100`, Workflows: `slate-50/purple-50`, Notifications: `slate-50/white/slate-50` — all different |
| **Loading states** | 12 loading components but pages use different ones; some use `RefreshCw animate-spin`, others `DashboardSkeleton`, others custom skeletons |
| **Breadcrumbs** | Used in analytics, search, notifications, settings — NOT in dashboard, contracts, admin |

### 5.2 Accessibility Summary

| Issue | Severity | Pages Affected |
|-------|----------|----------------|
| Skip link `#main-content` targets nothing | P1 | ALL pages |
| `prefers-reduced-motion` inconsistently respected | P1 | Sign Up particles don't check; Sign In does |
| Decorative icons missing `aria-hidden="true"` | P2 | Dashboard, Admin, Contracts, Analytics, Upload |
| `confirm()` for destructive actions | P2 | Admin (remove member) |
| Color-only status indicators | P2 | Contract badges, template health scores |
| FAQ/MobileMenu lack ARIA patterns | P1 | Root landing page |
| Native checkbox instead of Radix | P2 | Sign In (Remember Me) |

### 5.3 Color Accessibility

| Combination | Contrast Ratio | WCAG AA | Location |
|-------------|---------------|---------|----------|
| `text-gray-400` on `slate-950` | 6.3:1 | ✅ AA / ❌ AAA | Features, Security pages |
| `text-slate-500` on `bg-gray-50` | ~3.2:1 | **❌ Fails AA** | Pricing footer |
| `text-violet-600` on `bg-white` | ~4.6:1 | Large text only | CTA buttons text |

### 5.4 Framer Motion Duplication

Identical `containerVariants` / `itemVariants` stagger animation objects are copy-pasted across **8+ pages**. Should be extracted to a shared `lib/animations.ts`.

### 5.5 Component Duplication Across Pages

| Component | Duplicated In |
|-----------|--------------|
| `FloatingParticles` | Sign In, Sign Up (different implementations) |
| `GradientOrbs` | Sign In, Sign Up |
| `AnimatedCounter` | Root landing, Sign In, Contracts list |
| `MobileMenu` | Root landing, Pricing (different widths) |
| `FAQItem` | Root landing (may also exist elsewhere) |
| SSO Icons (Google, Microsoft, GitHub) | Sign In, Sign Up (verbatim duplicates) |

---

## 6. Improvement Plan

### Phase A — Critical SEO & Breaking Fixes (P0)

**Estimated effort: 2-3 days**

| # | Fix | File(s) | Impact |
|---|-----|---------|--------|
| A1 | Convert root landing page to Server Component, extract client interactivity to child components, add `metadata` export | `app/page.tsx` | SEO restored on most important page |
| A2 | Convert pricing page to Server Component + `metadata`, move interactive state to client child components | `app/(marketing)/pricing/page.tsx` | SEO on conversion page |
| A3 | Remove `'use client'` from About page (zero interactivity), add `metadata` | `app/(marketing)/about/page.tsx` | SEO fix |
| A4 | Add `metadata` to Contact page or convert to server component with client form child | `app/(marketing)/contact/page.tsx` | SEO fix |
| A5 | Add dark mode to Admin page — add `dark:` variants to all 955 lines of classes | `app/admin/page.tsx` | Dark mode usable |
| A6 | Define missing AI color CSS variables in globals.css | `app/globals.css` | `ai.*` Tailwind classes work |

### Phase B — Design System Unification (P0-P1)

**Estimated effort: 3-4 days**

| # | Fix | File(s) | Impact |
|---|-----|---------|--------|
| B1 | Create shared `(marketing)/layout.tsx` with unified header, footer, nav, and `<main id="main-content">` | `app/(marketing)/layout.tsx` + all 8 marketing pages | Eliminates 8 header/footer duplicates, fixes skip link |
| B2 | Standardize marketing pages to ONE design system (recommend light-mode System A with violet-600) | All marketing pages | Brand consistency |
| B3 | Fix `.btn-primary` CSS class to use violet instead of blue, or remove unused CSS button classes | `app/globals.css` | No color split personality |
| B4 | Fix `design-system.tsx` to use violet primary instead of sky-blue, or delete if unused | `components/ui/design-system.tsx` | Correct tokens |
| B5 | Standardize all app pages to `violet` primary — replace ad-hoc `indigo`, `purple/pink`, `slate` usage | Multiple app pages | Consistent brand |
| B6 | Deduplicate animation keyframes in globals.css — keep ONE definition per animation | `app/globals.css` | Predictable animations |
| B7 | Fix `AppLayout` header to support dark mode | `components/layout/AppLayout.tsx` | Layout doesn't break in dark mode |

### Phase C — Component Decomposition (P0-P1)

**Estimated effort: 4-5 days**

| # | Fix | File(s) | Impact |
|---|-----|---------|--------|
| C1 | **Templates page (4,991L)** — Extract into ~15 components: TemplateGrid, TemplateList, TemplateFilters, TemplateCard, VersionHistory, ComparisonView, BulkActions, ImportExport, CloudSync, Scheduling, Dependencies, AuditTrail, SmartTags, AnalyticsPanel | `app/templates/page.tsx` → `app/templates/components/` | Maintainability |
| C2 | **Contracts list (3,479L)** — Extract: ContractFilters, ContractGrid, ContractRow, ContractPreview, BulkActions, StatusBadges, ProcessingTracker, HeroDashboard, Pagination | `app/contracts/page.tsx` → `app/contracts/components/` | Maintainability |
| C3 | **Root landing page (1,643L)** — Extract all ~15 inline components to `components/marketing/`: Hero, FeatureGrid, HowItWorks, AIPipeline, Stats, FAQ, Pricing Preview, Footer, MobileMenu, etc. | `app/page.tsx` → `components/marketing/` | Bundle size, reuse |
| C4 | **Auth pages (~1,900L combined)** — Extract shared: `AuthLayout`, `FloatingParticles`, `GradientOrbs`, `SSOButtons`, `AuthForm`. Sign In and Sign Up become ~100-150 lines each. | `app/auth/signin/page.tsx`, `app/auth/signup/page.tsx` → `app/auth/components/` | Eliminates duplication |
| C5 | Extract shared Framer Motion variants to `lib/animations.ts` | New file + 8+ pages | Eliminates 8 copy-paste animation objects |

### Phase D — Dark Mode Completion (P1)

**Estimated effort: 2-3 days**

| # | Fix | Pages | Impact |
|---|-----|-------|--------|
| D1 | Admin page — full dark mode pass | `app/admin/page.tsx` | Readable in dark |
| D2 | Auth form panels — add `dark:` variants | Sign In + Sign Up | Auth usable in dark |
| D3 | Contracts list badges/rows — add `dark:` variants to `SignatureStatusBadge`, `DocumentTypeBadge`, `CompactContractRow`, `ContractRowSkeleton` | `app/contracts/page.tsx` | Contracts readable in dark |
| D4 | Upload file icons — add `dark:` variants to `getFileIcon()` | `app/contracts/upload/page.tsx` | Upload usable in dark |
| D5 | Templates category colors + health scores — add `dark:` variants | `app/templates/page.tsx` | Templates usable in dark |
| D6 | Marketing pages — add theme-aware `dark:` classes (or at minimum make hardcoded dark pages toggle-aware) | All marketing pages | Marketing respects user preference |

### Phase E — Accessibility Fixes (P1-P2)

**Estimated effort: 2 days**

| # | Fix | Impact |
|---|-----|--------|
| E1 | Add `<main id="main-content">` to all page layouts or the shared layout | Skip link works (WCAG 2.4.1) |
| E2 | Add `aria-expanded`, `aria-controls`, `role="region"` to FAQ accordion | Screen reader support |
| E3 | Add focus trap + keyboard dismiss (Escape) to MobileMenu | Keyboard navigation |
| E4 | Wrap floating nav in `<nav aria-label="Main">` landmark | Screen reader landmark navigation |
| E5 | Add `aria-hidden="true"` to all decorative Lucide icons across app | Reduces screen reader noise |
| E6 | Fix `prefers-reduced-motion` in Sign Up FloatingParticles (matches Sign In) | Vestibular safety |
| E7 | Replace `confirm()` with Radix `AlertDialog` in Admin | Consistent, accessible confirmation |
| E8 | Replace native checkbox with Radix Checkbox in Sign In | Component consistency |
| E9 | Add text/icon alternatives to color-only status indicators | WCAG 1.4.1 |

### Phase F — Performance & Code Quality (P2)

**Estimated effort: 2-3 days**

| # | Fix | Impact |
|---|-----|--------|
| F1 | Audit and remove unused Lucide icon imports across all pages | Smaller bundles |
| F2 | Remove unused components from `components/ui/` — consolidate 12 loading variants to 2-3, 7 card variants to 2-3 | Smaller library, less confusion |
| F3 | Delete `ResponsiveExamples.tsx` from production layout directory | Clean production code |
| F4 | Remove duplicate casing files (`DataModeBanner.tsx` vs `data-mode-banner.tsx`) | No import confusion |
| F5 | Consolidate `error/` + `error-boundary/` + `errors/` directories | Single error handling pattern |
| F6 | Consolidate `toast/` + `toast-system/` + `undo-toast/` directories | Single toast pattern |
| F7 | Update barrel file `components/ui/index.ts` to export all active components | Components discoverable |
| F8 | Remove artificial upload progress simulation | Honest UX |
| F9 | Remove hardcoded demo credentials from Sign In default values | Security hygiene |

### Phase G — Content & Legal Fixes (P2-P3)

**Estimated effort: 1 day**

| # | Fix | Impact |
|---|-----|--------|
| G1 | Remove Privacy Shield reference from Terms page (invalidated 2020) | Legal accuracy |
| G2 | Fix broken CSS string in Pricing page line 1078 | Rendering fix |
| G3 | Make Contact email a `mailto:` link, add actions to chat/sales cards | Functional contact page |
| G4 | Replace fabricated stats on About page with realistic or generic phrasing | Credibility |
| G5 | Convert Terms `whitespace-pre-line` bullet points to semantic `<ul>/<li>` | Accessibility + structure |
| G6 | Fix copyright year to be dynamic (`new Date().getFullYear()`) | Always current |
| G7 | Change `/home` redirect from `redirect` to `permanentRedirect` | SEO crawl budget |
| G8 | Replace placeholder feature illustrations with real screenshots or proper illustrations | Professional appearance |
| G9 | Wire up Pricing form to actual API endpoint (or remove the fake submission) | Honest UX |
| G10 | Replace same-color "gradients" (`violet-600 to violet-600`) with actual gradients or solid colors | Intentional design |

### Phase H — Component Library Cleanup (P2-P3)

**Estimated effort: 2-3 days**

| # | Fix | Impact |
|---|-----|--------|
| H1 | Audit which of the 125 `components/ui/` files are actually imported — delete dead components | Smaller codebase |
| H2 | Consolidate loading: keep `skeleton.tsx`, `loading-button.tsx`, `spinner.tsx` — delete the other 9 | Single loading pattern |
| H3 | Consolidate cards: keep `card.tsx`, `stat-card.tsx` — delete the other 5 | Single card pattern |
| H4 | Delete or merge `professional-design-system.tsx` (868L) — it's a parallel system | No confusion |
| H5 | Remove unused `@layer components` CSS button/badge/card/table classes from globals.css (if React components are used everywhere) | Smaller CSS bundle, no conflicts |
| H6 | Extend `DashboardLayout` (or create new shared `AppPageLayout`) usage to all app pages | Consistent page structure |

---

## Implementation Priority

```
Week 1:  Phase A (Critical SEO + breaks)
         Phase B (Design system unification)

Week 2:  Phase C (Component decomposition — start with Templates + Contracts)
         Phase D (Dark mode completion)

Week 3:  Phase E (Accessibility)
         Phase F (Performance & code quality)

Week 4:  Phase G (Content & legal)
         Phase H (Component library cleanup)
```

### Quick Wins (< 30 minutes each)

1. Add `metadata` to About, Contact pages (2 min each)
2. Remove `'use client'` from About page (1 min)
3. Define AI CSS variables in globals.css (5 min)
4. Fix `.btn-primary` blue → violet in globals.css (2 min)
5. Fix copyright year to dynamic (2 min)
6. Change `/home` to `permanentRedirect` (1 min)
7. Add `aria-hidden="true"` to decorative icons (10 min per page)
8. Delete `ResponsiveExamples.tsx` (1 min)
9. Fix broken CSS string in pricing (2 min)
10. Remove Privacy Shield reference (5 min)

### Reference Implementation

The **Workflows page** (`app/workflows/page.tsx`, 711 lines) is the gold standard for how all pages should be built:

- Consistent `dark:` variants on every element
- `aria-hidden="true"` on decorative icons
- `aria-label` on all interactive elements
- `motion-reduce:` and `motion-safe:` Tailwind classes
- Proper Suspense fallback
- Reasonable file size (711 lines)
- Uses shared Radix components

All new pages and refactors should follow this pattern.

---

## Appendix: Full Page Inventory

<details>
<summary>All 156 pages + 7 layouts</summary>

### Marketing (9 pages, 1 layout)

- `app/page.tsx` — Root landing
- `app/(marketing)/layout.tsx` — Empty pass-through
- `app/(marketing)/home/page.tsx` — Redirect to /
- `app/(marketing)/about/page.tsx`
- `app/(marketing)/contact/page.tsx`
- `app/(marketing)/features/page.tsx`
- `app/(marketing)/pricing/page.tsx`
- `app/(marketing)/privacy/page.tsx`
- `app/(marketing)/security/page.tsx`
- `app/(marketing)/terms/page.tsx`

### Auth (5 pages, 1 layout)

- `app/auth/layout.tsx`
- `app/auth/signin/page.tsx`
- `app/auth/signup/page.tsx`
- `app/auth/error/page.tsx`
- `app/auth/forgot-password/page.tsx`
- `app/auth/reset-password/page.tsx`

### Core App (140+ pages across ~40 sections)

- `app/dashboard/page.tsx` + `layout.tsx`
- `app/contracts/` — 18 pages (list, [id], upload, drafting, analytics, compare, obligations, etc.)
- `app/rate-cards/` — 21 pages (dashboard, [id], analytics, compare, import, etc.)
- `app/admin/` — 14 pages (users, roles, settings, audit, tenants, etc.)
- `app/analytics/` — 9 pages (dashboard, contracts, performance, trends, etc.)
- `app/settings/` — 6 pages (profile, security, notifications, integrations, etc.)
- `app/workflows/` — 4 pages (queue, builder, templates, etc.)
- `app/reports/` — 4 pages (dashboard, builder, scheduled, etc.)
- `app/ai/` — 4 pages (insights, chat, analysis, etc.)
- `app/templates/page.tsx`
- `app/search/page.tsx`
- `app/notifications/page.tsx`
- `app/import/` — 5 pages
- `app/generate/` — 3 pages
- Plus 30+ standalone pages (approvals, audit-logs, automation, benchmarks, clauses, collaborate, compare, compliance, deadlines, forecast, governance, intelligence, jobs, knowledge-graph, monitoring, obligations, offline, platform, portal, processing-status, renewals, risk, runs, suppliers, team, tour, ui-enhanced, ui-features, ui-showcase, upload, use-cases)

</details>

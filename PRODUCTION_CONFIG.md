# Production Configuration

Production-ready configuration for the Contract Intelligence System.

## Performance Monitoring

### Bundle Analysis
```bash
# Analyze bundle size and dependencies
pnpm perf:analyze
```

### Lighthouse CI
```bash
# Run performance, accessibility, and SEO checks
pnpm lighthouse
```

### Dead Code Detection
```bash
# Find unused code and dependencies
pnpm deadcode
```

## Error Tracking

### Sentry Configuration
Set these environment variables:
```
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
SENTRY_ORG=your_org
SENTRY_PROJECT=your_project
SENTRY_AUTH_TOKEN=your_auth_token
```

### Health Monitoring
- Health check endpoint: `/api/health`
- Includes system metrics, API connectivity, and version info

## Security

### Headers
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff  
- Referrer-Policy: origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()

### Content Security Policy
Configure CSP headers in `next.config.mjs` for your domain requirements.

## CI/CD Workflows

### Core Type Check (Required)
- Runs on every PR touching web code
- Validates strict TypeScript on core surfaces
- Fast feedback loop (~2-3 minutes)

### Full Strict Type Check (Optional)
- Manual trigger or label-based (`run-full-strict`)
- Validates entire codebase with strict rules
- Longer feedback loop for comprehensive checking

### Performance Monitoring
- Lighthouse CI runs on web changes
- Performance, accessibility, SEO, and best practices
- Results stored and tracked over time

## Production Deployment

### Environment Variables
```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://your-api-domain.com
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
SENTRY_AUTH_TOKEN=your_sentry_token
ANALYZE=false  # Set to true for bundle analysis
```

### Build Process
```bash
# Standard production build
pnpm --filter web build

# Build with bundle analysis
pnpm --filter web build:analyze
```

### Health Checks
- Web health: `GET /api/health`
- API health: `GET /healthz` (backend)
- Include these in your load balancer/container orchestrator

## Quality Gates

### Pre-deployment Checklist
- [ ] Core strict type check passes
- [ ] No critical ESLint errors
- [ ] Lighthouse scores > 80% (performance, accessibility, SEO)
- [ ] No high-severity security vulnerabilities
- [ ] Dead code scan reviewed
- [ ] Bundle size within acceptable limits

### Performance Budgets
- Initial page load: < 3s
- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1
- Bundle size: Monitor with `@next/bundle-analyzer`

## Monitoring Commands
```bash
# Type safety
pnpm type-check:web:strict:core  # Core surfaces
pnpm type-check:web:strict:full  # Full project

# Code quality  
pnpm lint                        # ESLint
pnpm deadcode                    # Unused code
pnpm lighthouse                  # Performance

# Security
pnpm security:audit             # Dependency vulnerabilities
```
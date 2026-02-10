# Contributing to ConTigo

Thank you for your interest in contributing to ConTigo. This document outlines our development workflow, code standards, and pull request process.

---

## Table of Contents

1. [Development Setup](#development-setup)
2. [Branch Strategy](#branch-strategy)
3. [Code Standards](#code-standards)
4. [Commit Conventions](#commit-conventions)
5. [Pull Request Process](#pull-request-process)
6. [Testing Requirements](#testing-requirements)
7. [Documentation](#documentation)
8. [Security](#security)

---

## Development Setup

### Prerequisites

- Node.js ≥ 22
- pnpm ≥ 8.9
- Docker & Docker Compose
- PostgreSQL 16 (via Docker)
- Redis 7 (via Docker)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/rawberto94/CLI-AI-RAW.git
cd CLI-AI-RAW

# Install dependencies
pnpm install

# Copy environment configuration
cp .env.example .env
# Edit .env with your local values

# Start infrastructure services
docker compose -f docker-compose.dev.yml up -d

# Generate Prisma client and run migrations
pnpm db:generate
pnpm db:migrate

# Start development server
pnpm dev
```

### Useful Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server (Turbopack) |
| `pnpm dev:all` | Start web + workers + websocket |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint check |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run E2E tests |
| `pnpm db:studio` | Open Prisma Studio |

---

## Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Production-ready code. Protected; requires PR review. |
| `develop` | Integration branch. Features merge here first. |
| `feature/<name>` | New features (e.g., `feature/rate-card-export`) |
| `fix/<name>` | Bug fixes (e.g., `fix/contract-upload-timeout`) |
| `hotfix/<name>` | Urgent production fixes |
| `docs/<name>` | Documentation-only changes |

### Rules

- Never push directly to `main` or `develop`
- All changes go through pull requests
- Branches must be up to date with target before merging
- Delete branches after merge

---

## Code Standards

### TypeScript

- **Strict mode** enabled (`strict: true` in tsconfig)
- Use **explicit types** for function parameters and return types
- Prefer `interface` over `type` for object shapes
- Use `const` by default; `let` only when reassignment is needed
- No `any` — use `unknown` and narrow with type guards
- Use Zod schemas (in `packages/schemas`) for runtime validation

### React / Next.js

- **Server Components** by default; add `'use client'` only when needed
- Use the **App Router** patterns (not Pages Router)
- Prefer **Server Actions** for mutations
- Use `Suspense` boundaries for async data loading
- Keep components < 200 lines; extract hooks and utilities

### Styling

- **Tailwind CSS** for all styling — no inline styles or CSS modules
- Use **Radix UI** primitives for accessible components
- Follow the existing design system in `apps/web/components/ui/`
- Use `cn()` utility for conditional class merging

### File Naming

| Type | Convention | Example |
|---|---|---|
| Components | PascalCase | `ContractCard.tsx` |
| Pages / routes | kebab-case directories | `app/contracts/[id]/page.tsx` |
| Utilities | camelCase | `formatCurrency.ts` |
| Constants | UPPER_SNAKE_CASE | `MAX_UPLOAD_SIZE` |
| Types | PascalCase | `ContractStatus.ts` |

### Import Order

1. Node.js built-ins (`path`, `fs`)
2. External packages (`react`, `next`, `@tanstack/react-query`)
3. Internal packages (`@contigo/db`, `@contigo/utils`)
4. Relative imports (`./components`, `../lib`)

---

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code restructuring, no behaviour change |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build, CI, tooling changes |
| `security` | Security-related changes |

### Examples

```
feat(contracts): add bulk contract upload via CSV
fix(ai): handle timeout on large document extraction
docs(readme): update tech stack to reflect PostgreSQL migration
refactor(workers): extract queue configuration to shared config
security(auth): enforce CSRF token on all mutation endpoints
```

---

## Pull Request Process

### Before Submitting

1. **Rebase** on the latest target branch
2. **Run checks locally:**

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```

3. **Verify no regressions** in related functionality
4. **Update documentation** if behaviour changes

### PR Template

```markdown
## What

Brief description of the change.

## Why

Context and motivation.

## How

Implementation approach and key decisions.

## Testing

- [ ] Unit tests added/updated
- [ ] E2E tests added/updated (if user-facing)
- [ ] Manual testing completed

## Checklist

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] Documentation updated
- [ ] No `console.log` left in code
- [ ] No hardcoded secrets or credentials
```

### Review Criteria

- Code is clear and well-structured
- Types are explicit, not `any`
- Error handling is appropriate
- No security regressions
- Performance impact is acceptable
- Tests cover the change
- Documentation is updated

---

## Testing Requirements

### Unit Tests (Vitest)

- All new utility functions must have tests
- All new API route handlers must have tests
- All new Zod schemas must have validation tests
- Target: >80% coverage for new code

### E2E Tests (Playwright)

- All new user-facing workflows must have E2E coverage
- Test both happy path and key error states
- Use test fixtures for authentication

### Running Tests

```bash
# Unit tests
pnpm test

# E2E tests (requires running dev server)
pnpm test:e2e

# E2E with visual test runner
pnpm test:e2e:ui

# Type checking
pnpm typecheck
```

---

## Documentation

- Update `docs/TECHNICAL_DOCUMENTATION.md` for API or architecture changes
- Update `docs/USER_ONBOARDING.md` for user-facing feature changes
- Update `docs/FAQ.md` if the change affects customer-facing behaviour
- Add entries to `CHANGELOG.md` for notable changes
- Keep `docs/INDEX.md` up to date when adding new docs

---

## Security

- **Never** commit secrets, API keys, or credentials
- Use `.env` files (never committed) for sensitive configuration
- Report vulnerabilities via [SECURITY.md](SECURITY.md), **not** as public issues
- All external input must be validated (use Zod schemas)
- All database queries must use parameterised queries (Prisma handles this)
- New endpoints must include rate limiting and authentication checks

---

## Questions?

Open a discussion or reach out to the engineering team at **<dev@contigo-app.ch>**.

---

*ConTigo GmbH — Zurich, Switzerland*

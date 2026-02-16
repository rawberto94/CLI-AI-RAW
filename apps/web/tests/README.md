# End-to-End (E2E) Tests

This directory contains comprehensive E2E tests for critical user workflows in the Contract Intelligence Platform using Playwright.

## Test Coverage

### 1. Contract Upload Flow (`contract-upload.e2e.spec.ts`)

Tests the complete contract upload workflow:

- Navigate to upload page
- Select and upload contract files (PDF, TXT, etc.)
- Monitor upload progress
- Verify redirect to contract details page
- Verify artifacts are generated
- Verify contract appears in contracts list
- Handle upload errors gracefully
- Support multiple file formats

**Requirements Covered**: 8.3 - E2E tests for key user journeys

### 2. Rate Card Creation Flow (`rate-card-creation.e2e.spec.ts`)

Tests the complete rate card creation workflow:

- Navigate to rate cards page
- Open rate card creation form
- Fill in rate card details (supplier, role, rate, currency, location)
- Submit and verify creation
- Verify rate card appears in list
- Validate required fields
- Support CSV import for bulk creation
- Edit existing rate cards

**Requirements Covered**: 8.3 - E2E tests for key user journeys

### 3. Benchmarking Flow (`benchmarking.e2e.spec.ts`)

Tests the complete benchmarking workflow:

- Navigate to benchmarking page
- Apply filters to select rate cards
- View benchmark calculations (median, mean, percentiles)
- Compare rates across suppliers
- Identify savings opportunities
- Export benchmark reports
- Display market intelligence insights
- Calculate percentile rankings

**Requirements Covered**: 8.3 - E2E tests for key user journeys

### 4. Real-Time Updates Flow (`realtime-updates.e2e.spec.ts`)

Tests the real-time update functionality:

- Establish SSE connection
- Monitor connection status indicators
- Verify updates are received in real-time
- Test automatic reconnection after network interruption
- Verify cache invalidation triggers UI updates
- Show real-time notifications for events
- Update rate card benchmarks in real-time
- Handle multiple concurrent updates
- Maintain connection across page navigation

**Requirements Covered**: 8.3 - E2E tests for key user journeys, 1.1-1.5 - Real-time system requirements

### 5. Contract Renewal Workflow (`12-renewals.e2e.spec.ts`)

Tests the complete contract renewal workflow:

- Dashboard renewals KPI and quick actions
- Navigation to renewals page
- Renewal wizard flow (5 steps)
- Contract detail page renewal actions
- Renewal analytics page
- Notification settings for renewals
- API integration for renewal creation

**Requirements Covered**: 8.3 - E2E tests for key user journeys, Contract lifecycle management

### 6. Contract Generation Workflow (`13-contract-generation.e2e.spec.ts`)

Tests the complete contract generation workflow:

- Template selection and browsing
- Contract generation wizard
- Variable filling and form completion
- Draft management
- Clause library integration
- Contract preview and download

**Requirements Covered**: 8.3 - E2E tests for key user journeys, Document generation

### 7. Approval Workflows (`14-approval-workflows.e2e.spec.ts`)

Tests the complete approval workflow:

- Approval queue management
- Workflow automation builder
- Bulk approval actions
- Workflow templates (Standard, Quick, Comprehensive, Renewal)
- Submit for approval flow
- Workflow statistics

**Requirements Covered**: 8.3 - E2E tests for key user journeys, Approval workflow management

## Prerequisites

### 1. Install Dependencies

```bash
cd apps/web
npm install @playwright/test
npx playwright install
```

### 2. Environment Setup

Ensure the following services are running:

- **Database**: PostgreSQL (default port 5432)
- **Web Server**: Next.js app (default port 3000 or 3002)
- **API Server**: Backend API (if separate, default port 3001)

### 3. Environment Variables

Create or update `.env` file in project root:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Running Tests

### Run all E2E tests:

```bash
cd apps/web
npx playwright test
```

### Run specific test file:

```bash
npx playwright test tests/contract-upload.e2e.spec.ts
npx playwright test tests/rate-card-creation.e2e.spec.ts
npx playwright test tests/benchmarking.e2e.spec.ts
npx playwright test tests/realtime-updates.e2e.spec.ts
```

### Run tests in headed mode (see browser):

```bash
npx playwright test --headed
```

### Run tests in debug mode:

```bash
npx playwright test --debug
```

### Run tests with UI:

```bash
npx playwright test --ui
```

### Run specific test by name:

```bash
npx playwright test -g "should upload contract"
```

### Run tests in specific browser:

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Configuration

Tests are configured in `playwright.config.ts` with:

- **Base URL**: `http://localhost:3002` (configurable)
- **Timeout**: 30 seconds per test
- **Retries**: 2 retries in CI, 0 locally
- **Headless**: true (can be overridden with `--headed`)
- **Trace**: Captured on first retry
- **Screenshots**: Captured on failure
- **Video**: Retained on failure

## Test Data

Tests use isolated tenant IDs to avoid conflicts:

- `test-tenant-e2e-upload` - Contract upload tests
- `test-tenant-e2e-ratecard` - Rate card creation tests
- `test-tenant-e2e-benchmark` - Benchmarking tests
- `test-tenant-e2e-realtime` - Real-time updates tests

Test data is created via API calls and should be cleaned up automatically.

## Debugging

### View test report:

```bash
npx playwright show-report
```

### View trace for failed test:

```bash
npx playwright show-trace trace.zip
```

### Enable verbose logging:

```bash
DEBUG=pw:api npx playwright test
```

### Take screenshots during test:

```typescript
await page.screenshot({ path: 'screenshot.png' });
```

### Pause test execution:

```typescript
await page.pause();
```

## CI/CD Integration

### GitHub Actions Example:

```yaml
- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npx playwright test
  
- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Best Practices

1. **Use data-testid attributes**: Add `data-testid` attributes to key elements for reliable selection
2. **Wait for network idle**: Use `waitForLoadState('networkidle')` after navigation
3. **Handle timing issues**: Use `waitForSelector` and `waitForTimeout` appropriately
4. **Isolate tests**: Each test should be independent and not rely on other tests
5. **Clean up data**: Remove test data after tests complete
6. **Use API for setup**: Create test data via API rather than UI when possible
7. **Handle flakiness**: Use retries and proper waits to handle timing issues
8. **Test real scenarios**: Focus on actual user workflows, not implementation details

## Troubleshooting

### Tests fail with "Target closed" error

- Ensure the web server is running
- Check that the base URL in `playwright.config.ts` is correct
- Verify no port conflicts

### Tests timeout

- Increase timeout in `playwright.config.ts`
- Check network connectivity
- Verify services are running and responsive

### Elements not found

- Add `data-testid` attributes to elements
- Use more flexible selectors (e.g., `text=/pattern/i`)
- Wait for elements to be visible before interacting

### Real-time tests fail

- Verify SSE endpoint is accessible
- Check that event bus is running
- Ensure cache invalidation is working

### Rate limiting errors

- Use unique tenant IDs for each test
- Add delays between API calls if needed
- Check rate limit configuration

## Requirements Fulfilled

These E2E tests fulfill the following production readiness requirements:

- **Requirement 8.3**: End-to-end tests for key user journeys
- **Requirement 8.1**: Integration tests for all critical user workflows
- **Requirement 1.1-1.5**: Real-time system functionality verification
- **Requirement 3.1-3.5**: Error handling and recovery testing
- **Requirement 10.1-10.5**: User experience validation

## Coverage Goals

- **Critical Flows**: 100% coverage of top 4 user journeys
- **Happy Paths**: All primary workflows tested
- **Error Handling**: Key error scenarios covered
- **Real-Time**: SSE connection and updates verified
- **Cross-Browser**: Tests run on Chromium (can be extended to Firefox, WebKit)

## Next Steps

1. Add more edge case scenarios
2. Implement visual regression testing
3. Add performance metrics collection
4. Extend to mobile viewport testing
5. Add accessibility testing with axe-core
6. Implement parallel test execution
7. Add test data factories for easier setup
8. Create custom Playwright fixtures for common operations

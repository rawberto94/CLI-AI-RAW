# API Integration Tests

This directory contains comprehensive integration tests for all API endpoints in the Contract Intelligence Platform.

## Test Coverage

### 1. API Endpoints (`api-endpoints.test.ts`)

- Health check endpoints (`/api/health`, `/api/health/detailed`, `/api/health/database`)
- Contracts API with pagination, search, and filtering
- Monitoring API endpoints
- Error handling and validation
- Response headers and security

### 2. Event Emissions (`event-emissions.test.ts`)

- Contract creation, update, and completion events
- Event bus reliability and error handling
- Multiple listeners and event ordering
- Event data integrity

### 3. Authentication & Authorization (`authentication-authorization.test.ts`)

- Tenant isolation and data access control
- Input validation and SQL injection prevention
- XSS attack prevention
- Rate limiting enforcement
- Security headers (CSP, X-Content-Type-Options, X-Frame-Options)
- CORS handling
- Request validation

### 4. Error Responses (`error-responses.test.ts`)

- 404 Not Found errors
- 400 Bad Request validation errors
- 429 Rate Limit errors
- 500 Internal Server errors
- Consistent error response format
- Request ID tracking
- Timeout handling
- Concurrent request handling
- Edge cases and special characters

## Prerequisites

1. **Database**: Ensure PostgreSQL is running and accessible
2. **Environment Variables**: Set up `.env` file in the project root with:

   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/dbname
   ```

3. **API Server**: For full integration tests, the API server should be running:

   ```bash
   npm run dev
   ```

## Running Tests

### Run all integration tests:

```bash
cd packages/data-orchestration
npm test -- --run test/integration
```

### Run specific test file:

```bash
npm test -- --run test/integration/api-endpoints.test.ts
npm test -- --run test/integration/event-emissions.test.ts
npm test -- --run test/integration/authentication-authorization.test.ts
npm test -- --run test/integration/error-responses.test.ts
```

### Run with coverage:

```bash
npm test -- --run test/integration --coverage
```

### Watch mode (for development):

```bash
npm test -- test/integration
```

## Test Configuration

Tests are configured in `vitest.config.ts` with:

- 10 second default timeout
- Node environment
- Setup file for environment variables
- Coverage reporting

## Test Data

Tests create isolated test data using unique tenant IDs:

- `test-tenant-api` - API endpoint tests
- `test-tenant-events` - Event emission tests
- `test-tenant-auth` - Authentication tests
- `test-tenant-errors` - Error response tests

All test data is cleaned up after tests complete.

## Notes

- **Rate Limiting**: Some tests intentionally trigger rate limits by making many rapid requests
- **Timeouts**: Long-running tests (load tests, concurrent requests) have extended timeouts (30s)
- **API Server**: Most tests require the API server to be running at `http://localhost:3000`
- **Database**: Tests require a real database connection (not mocked)

## Troubleshooting

### Database Connection Errors

If you see `DATABASE_URL not found` errors:

1. Ensure `.env` file exists in project root
2. Verify `DATABASE_URL` is set correctly
3. Check database is running and accessible

### API Server Not Running

If tests fail with connection errors:

1. Start the API server: `npm run dev`
2. Verify server is running at `http://localhost:3000`
3. Check server logs for errors

### Rate Limit Failures

If rate limit tests fail:

1. Ensure rate limiting middleware is enabled
2. Check rate limit configuration in `apps/web/lib/middleware/rate-limit.middleware.ts`
3. Adjust test expectations if rate limits have changed

## Requirements Covered

These integration tests fulfill the following production readiness requirements:

- **Requirement 8.1**: Integration tests for all critical user workflows
- **Requirement 8.4**: Comprehensive test coverage for business logic
- **Requirement 5.1**: Input validation and sanitization testing
- **Requirement 5.2**: Rate limiting verification
- **Requirement 5.3**: Security headers validation
- **Requirement 3.1-3.5**: Error handling and recovery testing
- **Requirement 2.1**: Health check endpoint testing

# Environment Variables Documentation

## Overview

This document provides comprehensive documentation for all environment variables used in the Contract Intelligence Platform. Each variable includes its purpose, required/optional status, default value, and example configuration.

---

## Table of Contents

1. [Core Application Configuration](#core-application-configuration)
2. [Database Configuration](#database-configuration)
3. [AI Service Configuration](#ai-service-configuration)
4. [Security Configuration](#security-configuration)
5. [File Storage Configuration](#file-storage-configuration)
6. [Monitoring & Observability](#monitoring--observability)
7. [Feature Flags](#feature-flags)
8. [Performance Configuration](#performance-configuration)
9. [RAG Integration Configuration](#rag-integration-configuration)
10. [Unified Orchestration Configuration](#unified-orchestration-configuration)
11. [Development Configuration](#development-configuration)
12. [Quick Reference](#quick-reference)

---

## Core Application Configuration

### NODE_ENV
- **Purpose**: Specifies the application environment
- **Required**: Yes
- **Type**: String
- **Valid Values**: `development`, `staging`, `production`
- **Default**: `development`
- **Example**: `NODE_ENV=production`
- **Notes**: 
  - Controls logging verbosity, error handling, and optimization
  - In production, enables minification and disables debug features
  - Affects caching strategies and security headers

### PORT
- **Purpose**: Port number for the web application
- **Required**: No
- **Type**: Number
- **Default**: `3000`
- **Example**: `PORT=3000`
- **Notes**: 
  - Must be available and not in use by another service
  - Common ports: 3000 (dev), 8080 (staging), 80/443 (production)

### LOG_LEVEL
- **Purpose**: Controls logging verbosity
- **Required**: No
- **Type**: String
- **Valid Values**: `debug`, `info`, `warn`, `error`
- **Default**: `info`
- **Example**: `LOG_LEVEL=info`
- **Notes**:
  - `debug`: Verbose logging for development
  - `info`: Standard operational logging
  - `warn`: Only warnings and errors
  - `error`: Only errors
  - Production should use `info` or `warn`

### NEXT_PUBLIC_API_URL
- **Purpose**: Public-facing API URL for client-side requests
- **Required**: Yes (for production)
- **Type**: String (URL)
- **Default**: `http://localhost:8080`
- **Example**: `NEXT_PUBLIC_API_URL=https://api.your-domain.com`
- **Notes**:
  - Must be accessible from client browsers
  - Include protocol (http/https)
  - No trailing slash

---

## Database Configuration

### DATABASE_URL
- **Purpose**: PostgreSQL database connection string
- **Required**: Yes
- **Type**: String (Connection URL)
- **Format**: `postgresql://[user]:[password]@[host]:[port]/[database]?[params]`
- **Example**: 
  ```
  DATABASE_URL="postgresql://postgres:password@localhost:5432/contract_intelligence?connection_limit=10&pool_timeout=20"
  ```
- **Notes**:
  - **Security**: Never commit this to version control
  - **Connection Pooling**: Include `connection_limit` parameter (recommended: 10-20)
  - **Timeout**: Include `pool_timeout` parameter (recommended: 20 seconds)
  - **SSL**: For production, add `sslmode=require`
  - **Performance**: Use connection pooling for better performance
  - **Example with SSL**: 
    ```
    postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20&sslmode=require
    ```

### DB_PASSWORD
- **Purpose**: Database password (used in Docker Compose)
- **Required**: Yes (for Docker deployments)
- **Type**: String
- **Default**: `postgres` (development only)
- **Example**: `DB_PASSWORD=your_secure_password_here`
- **Notes**:
  - Use strong passwords (16+ characters, mixed case, numbers, symbols)
  - Different from DATABASE_URL password in some deployments
  - Rotate regularly in production

---

## AI Service Configuration

### OPENAI_API_KEY
- **Purpose**: OpenAI API key for AI-powered features
- **Required**: Yes (for AI features)
- **Type**: String
- **Format**: `sk-...`
- **Example**: `OPENAI_API_KEY=sk-proj-abc123...`
- **Notes**:
  - Obtain from https://platform.openai.com/api-keys
  - **Security**: Never commit to version control
  - **Security**: Never expose in client-side code
  - Monitor usage to avoid unexpected costs
  - Set usage limits in OpenAI dashboard
  - Required for: contract analysis, artifact generation, AI insights

### OPENAI_MODEL
- **Purpose**: Specifies which OpenAI model to use
- **Required**: No
- **Type**: String
- **Valid Values**: `gpt-4`, `gpt-4-turbo`, `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`
- **Default**: `gpt-4o-mini`
- **Example**: `OPENAI_MODEL=gpt-4o-mini`
- **Notes**:
  - `gpt-4o-mini`: Cost-effective, fast, good for most tasks
  - `gpt-4o`: More capable, higher cost
  - `gpt-4-turbo`: Balance of speed and capability
  - Consider cost vs. quality tradeoffs
  - Can be overridden per-request in code

### ANALYSIS_USE_LLM
- **Purpose**: Enable/disable LLM-based analysis
- **Required**: No
- **Type**: Boolean
- **Valid Values**: `true`, `false`
- **Default**: `true`
- **Example**: `ANALYSIS_USE_LLM=true`
- **Notes**:
  - Set to `false` to use rule-based analysis only
  - Reduces costs but may reduce accuracy
  - Useful for testing without API costs

---

## Security Configuration

### JWT_SECRET
- **Purpose**: Secret key for signing JWT tokens
- **Required**: Yes
- **Type**: String
- **Minimum Length**: 32 characters
- **Example**: `JWT_SECRET=your-jwt-secret-here-generate-a-strong-random-string`
- **Generation**: 
  ```bash
  openssl rand -base64 32
  ```
- **Notes**:
  - **Critical**: Must be kept secret
  - **Critical**: Never commit to version control
  - Use different secrets for each environment
  - Rotate periodically (requires re-authentication of all users)
  - Changing this invalidates all existing tokens

### SESSION_SECRET
- **Purpose**: Secret key for session encryption
- **Required**: Yes
- **Type**: String
- **Minimum Length**: 32 characters
- **Example**: `SESSION_SECRET=your-session-secret-here-generate-a-strong-random-string`
- **Generation**: 
  ```bash
  openssl rand -base64 32
  ```
- **Notes**:
  - **Critical**: Must be kept secret
  - Different from JWT_SECRET
  - Rotate periodically
  - Changing this logs out all users

### ALLOWED_ORIGINS
- **Purpose**: CORS allowed origins for API requests
- **Required**: No
- **Type**: String (comma-separated URLs)
- **Default**: `http://localhost:3000`
- **Example**: `ALLOWED_ORIGINS=https://app.your-domain.com,https://admin.your-domain.com`
- **Notes**:
  - Multiple origins separated by commas
  - Include protocol (http/https)
  - No trailing slashes
  - Wildcard (*) not recommended for production

---

## File Storage Configuration

### UPLOAD_DIR
- **Purpose**: Directory path for uploaded files
- **Required**: No
- **Type**: String (Path)
- **Default**: `./uploads`
- **Example**: `UPLOAD_DIR=/var/app/uploads`
- **Notes**:
  - Must have write permissions
  - Should be outside web root for security
  - Consider using object storage (S3) for production
  - Ensure adequate disk space

### MAX_FILE_SIZE
- **Purpose**: Maximum file upload size in bytes
- **Required**: No
- **Type**: Number
- **Default**: `104857600` (100MB)
- **Example**: `MAX_FILE_SIZE=104857600`
- **Notes**:
  - 100MB = 104857600 bytes
  - 50MB = 52428800 bytes
  - Must align with nginx/proxy limits
  - Consider storage costs when increasing

### S3_ENDPOINT
- **Purpose**: S3-compatible storage endpoint
- **Required**: No (Yes for S3 storage)
- **Type**: String (URL)
- **Example**: `S3_ENDPOINT=http://minio:9000`
- **Notes**:
  - For MinIO or S3-compatible storage
  - Include protocol and port
  - AWS S3: Use region-specific endpoint

### S3_BUCKET
- **Purpose**: S3 bucket name for file storage
- **Required**: No (Yes for S3 storage)
- **Type**: String
- **Default**: `contracts`
- **Example**: `S3_BUCKET=contract-intelligence-prod`
- **Notes**:
  - Bucket must exist before deployment
  - Use environment-specific buckets
  - Configure appropriate permissions

### AWS_ACCESS_KEY_ID
- **Purpose**: AWS/S3 access key
- **Required**: No (Yes for S3 storage)
- **Type**: String
- **Example**: `AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE`
- **Notes**:
  - **Security**: Never commit to version control
  - Use IAM roles when possible
  - Limit permissions to required actions only

### AWS_SECRET_ACCESS_KEY
- **Purpose**: AWS/S3 secret key
- **Required**: No (Yes for S3 storage)
- **Type**: String
- **Example**: `AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`
- **Notes**:
  - **Security**: Never commit to version control
  - Rotate regularly
  - Use IAM roles when possible

---

## Monitoring & Observability

### SENTRY_DSN
- **Purpose**: Sentry error tracking DSN
- **Required**: No (Recommended for production)
- **Type**: String (URL)
- **Example**: `SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/7654321`
- **Notes**:
  - Obtain from Sentry project settings
  - Enables automatic error reporting
  - Configure sample rate to control costs
  - Set environment tags for filtering

### APPINSIGHTS_CONNECTION_STRING
- **Purpose**: Azure Application Insights connection string
- **Required**: No
- **Type**: String
- **Example**: `APPINSIGHTS_CONNECTION_STRING=InstrumentationKey=abc-123-def-456`
- **Notes**:
  - For Azure-based deployments
  - Alternative to Sentry
  - Provides performance monitoring

### ENABLE_HEALTH_CHECKS
- **Purpose**: Enable/disable health check endpoints
- **Required**: No
- **Type**: Boolean
- **Valid Values**: `true`, `false`
- **Default**: `true`
- **Example**: `ENABLE_HEALTH_CHECKS=true`
- **Notes**:
  - Should always be `true` in production
  - Used by load balancers and monitoring

---

## Feature Flags

### ENABLE_AI_FEATURES
- **Purpose**: Enable/disable AI-powered features
- **Required**: No
- **Type**: Boolean
- **Valid Values**: `true`, `false`
- **Default**: `true`
- **Example**: `ENABLE_AI_FEATURES=true`
- **Notes**:
  - Set to `false` to disable all AI features
  - Useful for cost control or testing
  - Requires OPENAI_API_KEY when enabled

### ENABLE_TENANT_WARNINGS
- **Purpose**: Enable/disable tenant isolation warnings
- **Required**: No
- **Type**: Boolean
- **Valid Values**: `true`, `false`
- **Default**: `true`
- **Example**: `ENABLE_TENANT_WARNINGS=true`
- **Notes**:
  - Logs warnings when tenant context is missing
  - Useful for debugging multi-tenant issues
  - Can be disabled in production after validation

### RAG_ENABLED
- **Purpose**: Enable/disable RAG (Retrieval-Augmented Generation)
- **Required**: No
- **Type**: Boolean
- **Valid Values**: `true`, `false`
- **Default**: `true`
- **Example**: `RAG_ENABLED=true`
- **Notes**:
  - Requires Chroma DB when enabled
  - Enhances AI responses with context
  - Can be disabled to reduce complexity

---

## Performance Configuration

### SLOW_QUERY_THRESHOLD
- **Purpose**: Threshold for logging slow database queries (milliseconds)
- **Required**: No
- **Type**: Number
- **Default**: `1000`
- **Example**: `SLOW_QUERY_THRESHOLD=1000`
- **Notes**:
  - Queries exceeding this time are logged
  - Lower values increase log volume
  - Typical values: 500-2000ms

### CIRCUIT_BREAKER_THRESHOLD
- **Purpose**: Number of failures before circuit breaker opens
- **Required**: No
- **Type**: Number
- **Default**: `5`
- **Example**: `CIRCUIT_BREAKER_THRESHOLD=5`
- **Notes**:
  - Protects against cascading failures
  - Higher values = more tolerance for failures
  - Lower values = faster failure detection

### CIRCUIT_BREAKER_RESET_TIMEOUT
- **Purpose**: Time before circuit breaker attempts reset (milliseconds)
- **Required**: No
- **Type**: Number
- **Default**: `60000` (60 seconds)
- **Example**: `CIRCUIT_BREAKER_RESET_TIMEOUT=60000`
- **Notes**:
  - Time to wait before retrying failed service
  - Balance between recovery time and load

### WORKER_CONCURRENCY
- **Purpose**: Number of concurrent jobs per worker
- **Required**: No
- **Type**: Number
- **Default**: `3`
- **Example**: `WORKER_CONCURRENCY=3`
- **Notes**:
  - Higher values = more throughput but more memory
  - Adjust based on available resources
  - Typical values: 2-5

### WORKER_REPLICAS
- **Purpose**: Number of worker instances to run
- **Required**: No
- **Type**: Number
- **Default**: `3`
- **Example**: `WORKER_REPLICAS=3`
- **Notes**:
  - For Docker Compose deployments
  - Scale based on workload
  - Each replica uses WORKER_CONCURRENCY jobs

---

## RAG Integration Configuration

### RAG_INTEGRATION_ENABLED
- **Purpose**: Enable/disable RAG integration
- **Required**: No
- **Type**: Boolean
- **Valid Values**: `true`, `false`
- **Default**: `true`
- **Example**: `RAG_INTEGRATION_ENABLED=true`
- **Notes**:
  - Master switch for RAG features
  - Requires CHROMA_URL when enabled

### RAG_AUTO_INDEX
- **Purpose**: Automatically index contracts on upload
- **Required**: No
- **Type**: Boolean
- **Valid Values**: `true`, `false`
- **Default**: `true`
- **Example**: `RAG_AUTO_INDEX=true`
- **Notes**:
  - Enables automatic indexing pipeline
  - Can be disabled for manual indexing control

### RAG_MAX_RETRIES
- **Purpose**: Maximum retry attempts for failed indexing
- **Required**: No
- **Type**: Number
- **Default**: `3`
- **Example**: `RAG_MAX_RETRIES=3`
- **Notes**:
  - Number of retry attempts before giving up
  - Typical values: 2-5

### RAG_RETRY_DELAY_MS
- **Purpose**: Delay between retry attempts (milliseconds)
- **Required**: No
- **Type**: Number
- **Default**: `5000` (5 seconds)
- **Example**: `RAG_RETRY_DELAY_MS=5000`
- **Notes**:
  - Exponential backoff applied automatically
  - Initial delay before first retry

### RAG_TIMEOUT_MS
- **Purpose**: Timeout for RAG operations (milliseconds)
- **Required**: No
- **Type**: Number
- **Default**: `30000` (30 seconds)
- **Example**: `RAG_TIMEOUT_MS=30000`
- **Notes**:
  - Prevents hanging operations
  - Adjust based on document size

### RAG_FAIL_SILENTLY
- **Purpose**: Continue upload flow even if RAG indexing fails
- **Required**: No
- **Type**: Boolean
- **Valid Values**: `true`, `false`
- **Default**: `true`
- **Example**: `RAG_FAIL_SILENTLY=true`
- **Notes**:
  - `true`: Upload succeeds even if indexing fails
  - `false`: Upload fails if indexing fails
  - Recommended: `true` for better UX

### CHROMA_URL
- **Purpose**: Chroma vector database URL
- **Required**: No (Yes if RAG enabled)
- **Type**: String (URL)
- **Default**: `http://localhost:8000`
- **Example**: `CHROMA_URL=http://chroma:8000`
- **Notes**:
  - Required when RAG_INTEGRATION_ENABLED=true
  - Include protocol and port
  - Ensure Chroma is accessible

---

## Unified Orchestration Configuration

### ENABLE_ANALYTICAL_SYNC
- **Purpose**: Enable analytical intelligence synchronization
- **Required**: No
- **Type**: Boolean
- **Valid Values**: `true`, `false`
- **Default**: `true`
- **Example**: `ENABLE_ANALYTICAL_SYNC=true`

### ENABLE_RATE_CARD_SYNC
- **Purpose**: Enable rate card benchmarking synchronization
- **Required**: No
- **Type**: Boolean
- **Valid Values**: `true`, `false`
- **Default**: `true`
- **Example**: `ENABLE_RATE_CARD_SYNC=true`

### ENABLE_DATA_STANDARDIZATION
- **Purpose**: Enable automatic data standardization
- **Required**: No
- **Type**: Boolean
- **Valid Values**: `true`, `false`
- **Default**: `true`
- **Example**: `ENABLE_DATA_STANDARDIZATION=true`

### ENABLE_SAVINGS_DETECTION
- **Purpose**: Enable automatic savings opportunity detection
- **Required**: No
- **Type**: Boolean
- **Valid Values**: `true`, `false`
- **Default**: `true`
- **Example**: `ENABLE_SAVINGS_DETECTION=true`

### ENABLE_TAXONOMY_ENRICHMENT
- **Purpose**: Enable taxonomy-based data enrichment
- **Required**: No
- **Type**: Boolean
- **Valid Values**: `true`, `false`
- **Default**: `true`
- **Example**: `ENABLE_TAXONOMY_ENRICHMENT=true`

### ENABLE_WORKFLOW_AUTOMATION
- **Purpose**: Enable workflow automation features
- **Required**: No
- **Type**: Boolean
- **Valid Values**: `true`, `false`
- **Default**: `true`
- **Example**: `ENABLE_WORKFLOW_AUTOMATION=true`

### ENABLE_INTELLIGENCE_ENGINE
- **Purpose**: Enable intelligence engine features
- **Required**: No
- **Type**: Boolean
- **Valid Values**: `true`, `false`
- **Default**: `true`
- **Example**: `ENABLE_INTELLIGENCE_ENGINE=true`

---

## Development Configuration

### PRETTY_LOGS
- **Purpose**: Enable pretty-printed logs in development
- **Required**: No
- **Type**: Boolean
- **Valid Values**: `true`, `false`
- **Default**: `true`
- **Example**: `PRETTY_LOGS=true`
- **Notes**:
  - Only affects development environment
  - Production should use structured JSON logs

### ENABLE_QUERY_LOGGING
- **Purpose**: Enable database query logging
- **Required**: No
- **Type**: Boolean
- **Valid Values**: `true`, `false`
- **Default**: `false`
- **Example**: `ENABLE_QUERY_LOGGING=false`
- **Notes**:
  - Useful for debugging
  - Can be very verbose
  - **Never enable in production** (performance impact)

---

## Quick Reference

### Minimal Production Configuration

```bash
# Core
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20&sslmode=require

# AI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Security
JWT_SECRET=<generate-with-openssl-rand-base64-32>
SESSION_SECRET=<generate-with-openssl-rand-base64-32>

# Monitoring (Recommended)
SENTRY_DSN=https://...@sentry.io/...
ENABLE_HEALTH_CHECKS=true
```

### Environment-Specific Configurations

#### Development
```bash
NODE_ENV=development
LOG_LEVEL=debug
PRETTY_LOGS=true
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/contract_intelligence
OPENAI_API_KEY=sk-...
JWT_SECRET=dev-secret-not-for-production
SESSION_SECRET=dev-session-secret
```

#### Staging
```bash
NODE_ENV=staging
LOG_LEVEL=info
DATABASE_URL=postgresql://user:pass@staging-db:5432/contract_intelligence?connection_limit=10
OPENAI_API_KEY=sk-...
JWT_SECRET=<strong-random-secret>
SESSION_SECRET=<strong-random-secret>
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_API_URL=https://staging-api.your-domain.com
```

#### Production
```bash
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL=postgresql://user:pass@prod-db:5432/contract_intelligence?connection_limit=20&pool_timeout=20&sslmode=require
OPENAI_API_KEY=sk-...
JWT_SECRET=<strong-random-secret>
SESSION_SECRET=<strong-random-secret>
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_API_URL=https://api.your-domain.com
ALLOWED_ORIGINS=https://app.your-domain.com
```

---

## Security Best Practices

1. **Never commit .env files** to version control
2. **Use different secrets** for each environment
3. **Rotate secrets regularly** (quarterly recommended)
4. **Use strong random values** for all secrets (32+ characters)
5. **Limit access** to production environment variables
6. **Use secret management** tools (AWS Secrets Manager, HashiCorp Vault)
7. **Audit access** to environment variables regularly
8. **Encrypt backups** containing environment variables

---

## Validation

### Required Variables Check

```bash
# Check all required variables are set
required_vars=(
  "NODE_ENV"
  "DATABASE_URL"
  "OPENAI_API_KEY"
  "JWT_SECRET"
  "SESSION_SECRET"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "ERROR: $var is not set"
    exit 1
  fi
done

echo "All required variables are set"
```

### Connection Test

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Test OpenAI API
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

---

## Troubleshooting

### Issue: "DATABASE_URL is not defined"
**Solution**: Ensure .env file exists and DATABASE_URL is set

### Issue: "Invalid OpenAI API key"
**Solution**: Verify OPENAI_API_KEY is correct and has not expired

### Issue: "JWT token invalid"
**Solution**: Ensure JWT_SECRET matches across all instances

### Issue: "CORS error"
**Solution**: Add frontend URL to ALLOWED_ORIGINS

---

## Additional Resources

- [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md)
- [Database Migrations Guide](./DATABASE_MIGRATIONS.md)
- [External Dependencies Guide](./EXTERNAL_DEPENDENCIES.md)
- [Security Best Practices](../../SYSTEM_ARCHITECTURE.md#security)

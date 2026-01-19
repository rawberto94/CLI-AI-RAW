# Secrets Management Strategy

## Overview
This guide covers secrets management for production deployment of the Contract Intelligence Platform.

## Secrets Categories

### 1. Database Credentials
- `POSTGRES_PASSWORD` - PostgreSQL password
- `DATABASE_URL` - Full PostgreSQL connection string

### 2. Authentication
- `AUTH_SECRET` - NextAuth JWT signing secret (32+ characters)
- `NEXTAUTH_URL` - Full application URL for NextAuth

### 3. External Services
- `OPENAI_API_KEY` - OpenAI API key for AI features
- `MINIO_ROOT_USER` - MinIO admin username (production)
- `MINIO_ROOT_PASSWORD` - MinIO admin password (production)

### 4. Application Secrets
- `JWT_SECRET` - Application JWT signing secret
- `ENCRYPTION_KEY` - Data encryption key (if implemented)

## Deployment Strategies

### Option 1: GitHub Secrets (Recommended for GitHub Actions)

```yaml
# In GitHub repository settings -> Secrets and variables -> Actions
secrets:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  AUTH_SECRET: ${{ secrets.AUTH_SECRET }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}
  MINIO_ROOT_USER: ${{ secrets.MINIO_ROOT_USER }}
  MINIO_ROOT_PASSWORD: ${{ secrets.MINIO_ROOT_PASSWORD }}
```

Required GitHub Secrets:
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_SECRET` - NextAuth secret (generate with `openssl rand -base64 32`)
- `OPENAI_API_KEY` - OpenAI API key
- `POSTGRES_PASSWORD` - Database password
- `MINIO_ROOT_USER` - MinIO admin username
- `MINIO_ROOT_PASSWORD` - MinIO admin password

### Option 2: AWS Secrets Manager (Production Recommended)

```typescript
// Example: lib/secrets.ts
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: process.env.AWS_REGION });

export async function getSecret(secretName: string): Promise<string> {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);
  return response.SecretString || "";
}
```

Secrets structure in AWS:
```json
{
  "contract-intelligence/production/database": {
    "url": "postgresql://...",
    "password": "..."
  },
  "contract-intelligence/production/auth": {
    "secret": "...",
    "nextauth_url": "https://..."
  },
  "contract-intelligence/production/openai": {
    "api_key": "sk-..."
  }
}
```

### Option 3: HashiCorp Vault (Enterprise)

```bash
# Store secrets
vault kv put secret/contract-intelligence/production \
  database_url="postgresql://..." \
  auth_secret="..." \
  openai_api_key="sk-..."

# Retrieve in application
vault kv get -field=database_url secret/contract-intelligence/production
```

### Option 4: Docker Secrets (Docker Swarm)

```yaml
# docker-compose.prod.yml
services:
  web:
    secrets:
      - database_url
      - auth_secret
      - openai_api_key
    environment:
      DATABASE_URL_FILE: /run/secrets/database_url
      AUTH_SECRET_FILE: /run/secrets/auth_secret

secrets:
  database_url:
    external: true
  auth_secret:
    external: true
  openai_api_key:
    external: true
```

Create secrets:
```bash
echo "postgresql://..." | docker secret create database_url -
echo "secret123" | docker secret create auth_secret -
echo "sk-..." | docker secret create openai_api_key -
```

## Secret Generation

### Generate AUTH_SECRET (NextAuth)
```bash
openssl rand -base64 32
```

### Generate Database Password
```bash
openssl rand -base64 24
```

### Generate MinIO Credentials
```bash
# Username (20 characters)
openssl rand -hex 10

# Password (40 characters)
openssl rand -base64 30
```

## Environment Variables

### Production .env Template
```bash
# Database
POSTGRES_DB=contract_intelligence
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<GENERATE_SECURE_PASSWORD>
DATABASE_URL=postgresql://postgres:<PASSWORD>@postgres:5432/contract_intelligence

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# MinIO / S3
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ROOT_USER=<GENERATE_SECURE_USERNAME>
MINIO_ROOT_PASSWORD=<GENERATE_SECURE_PASSWORD>
S3_BUCKET=contracts
MINIO_USE_SSL=false

# NextAuth
AUTH_SECRET=<GENERATE_WITH_OPENSSL>
NEXTAUTH_URL=https://your-production-domain.com

# OpenAI
OPENAI_API_KEY=sk-...

# Features
RAG_INTEGRATION_ENABLED=true
NODE_ENV=production

# Container Images (for CI/CD)
WEB_IMAGE=ghcr.io/yourorg/cli-ai-raw/web:latest
WORKERS_IMAGE=ghcr.io/yourorg/cli-ai-raw/workers:latest

# Logging
LOG_LEVEL=info
```

## Security Best Practices

### 1. Never Commit Secrets
- Add `.env*` to `.gitignore`
- Use `.env.example` for template
- Scan commits with `git-secrets` or `truffleHog`

### 2. Rotate Secrets Regularly
```bash
# Quarterly rotation schedule
- Database passwords: Every 90 days
- API keys: Every 180 days
- JWT secrets: Every 365 days
```

### 3. Use Different Secrets Per Environment
```
development/.env
staging/.env
production/.env
```

### 4. Restrict Access
- Use IAM roles for service-to-service communication
- Implement least privilege principle
- Audit secret access logs

### 5. Encrypt at Rest
- Use encrypted volumes for database
- Enable S3/MinIO encryption
- Store backups in encrypted form

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Deploy to production
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    AUTH_SECRET: ${{ secrets.AUTH_SECRET }}
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: |
    docker compose -f docker-compose.prod.yml up -d
```

### AWS ECS Task Definition
```json
{
  "containerDefinitions": [{
    "secrets": [
      {
        "name": "DATABASE_URL",
        "valueFrom": "arn:aws:secretsmanager:region:account:secret:db-url"
      },
      {
        "name": "AUTH_SECRET",
        "valueFrom": "arn:aws:secretsmanager:region:account:secret:auth-secret"
      }
    ]
  }]
}
```

## Secrets Verification

Before deployment, verify all required secrets:
```bash
#!/bin/bash
# scripts/verify-secrets.sh

REQUIRED_SECRETS=(
  "DATABASE_URL"
  "AUTH_SECRET"
  "OPENAI_API_KEY"
  "POSTGRES_PASSWORD"
  "MINIO_ROOT_USER"
  "MINIO_ROOT_PASSWORD"
)

for secret in "${REQUIRED_SECRETS[@]}"; do
  if [ -z "${!secret}" ]; then
    echo "ERROR: $secret is not set"
    exit 1
  fi
done

echo "All required secrets are set"
```

## Emergency Procedures

### Secret Compromise
1. Immediately rotate compromised secret
2. Update all instances using the secret
3. Review access logs for unauthorized usage
4. Document incident for audit trail

### Lost Secrets
1. Use backup recovery procedure
2. Generate new secrets if backup unavailable
3. Update all dependent services
4. Test thoroughly before marking resolved

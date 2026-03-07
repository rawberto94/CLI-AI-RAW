# CDN Configuration Guide

## Overview

This guide covers CDN setup for production deployment to improve performance and reduce server load when scaling to many clients.

## Recommended CDN Providers

| Provider | Best For | Pricing |
|----------|----------|---------|
| **Cloudflare** | All-in-one (CDN + WAF + DDoS) | Free tier available |
| **AWS CloudFront** | AWS ecosystem integration | Pay-per-use |
| **Vercel Edge** | Next.js deployments | Included with Vercel |
| **Fastly** | Real-time purging | Enterprise |

---

## 1. Cloudflare Configuration

### DNS Setup

```
# Point your domain to Cloudflare
A    contigo.app    → [Your Origin IP]
AAAA contigo.app    → [Your Origin IPv6]
CNAME www           → contigo.app
```

### Page Rules

```yaml
# Static Assets - Maximum caching
URL: *contigo.app/_next/static/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
  - Browser Cache TTL: 1 year

# API Routes - No caching (handled by app)
URL: *contigo.app/api/*
Settings:
  - Cache Level: Bypass
  - Disable Apps: On
  
# Document Downloads - Cache on edge
URL: *contigo.app/api/contracts/*/download
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 hour
  - Origin Cache Control: On
```

### Cache Rules (Terraform)

```hcl
resource "cloudflare_ruleset" "cache_rules" {
  zone_id = var.zone_id
  name    = "Cache Rules"
  kind    = "zone"
  phase   = "http_request_cache_settings"

  rules {
    action = "set_cache_settings"
    action_parameters {
      cache = true
      edge_ttl {
        mode    = "override_origin"
        default = 2592000  # 30 days
      }
      browser_ttl {
        mode    = "override_origin"
        default = 31536000 # 1 year
      }
    }
    expression = "(http.request.uri.path matches \"^/_next/static/\")"
    description = "Cache Next.js static assets"
  }

  rules {
    action = "set_cache_settings"
    action_parameters {
      cache = false
    }
    expression = "(http.request.uri.path matches \"^/api/\" and not http.request.uri.path matches \"^/api/contracts/.*/download\")"
    description = "Bypass cache for API routes"
  }
}
```

### Security Headers (Transform Rules)

```yaml
# Add security headers via Cloudflare
Response Headers:
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## 2. AWS CloudFront Configuration

### Distribution Settings

```yaml
# cloudfront-distribution.yaml
Origins:
  - DomainName: origin.contigo.app
    Id: AppOrigin
    CustomOriginConfig:
      HTTPSPort: 443
      OriginProtocolPolicy: https-only
      OriginSSLProtocols: [TLSv1.2]
    OriginCustomHeaders:
      - HeaderName: X-Origin-Verify
        HeaderValue: ${ORIGIN_VERIFY_SECRET}

  - DomainName: ${S3_BUCKET}.s3.amazonaws.com
    Id: DocumentsOrigin
    S3OriginConfig:
      OriginAccessIdentity: origin-access-identity/cloudfront/${OAI_ID}

CacheBehaviors:
  # Static Assets
  - PathPattern: /_next/static/*
    TargetOriginId: AppOrigin
    CachePolicyId: 658327ea-f89d-4fab-a63d-7e88639e58f6  # CachingOptimized
    Compress: true
    ViewerProtocolPolicy: redirect-to-https

  # API Routes
  - PathPattern: /api/*
    TargetOriginId: AppOrigin
    CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad  # CachingDisabled
    OriginRequestPolicyId: 216adef6-5c7f-47e4-b989-5492eafa07d3  # AllViewer
    ViewerProtocolPolicy: redirect-to-https
    AllowedMethods: [GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE]

  # Contract Documents
  - PathPattern: /documents/*
    TargetOriginId: DocumentsOrigin
    CachePolicyId: 658327ea-f89d-4fab-a63d-7e88639e58f6
    Compress: true
    ViewerProtocolPolicy: redirect-to-https
    TrustedSigners: [self]  # Signed URLs required

DefaultCacheBehavior:
  TargetOriginId: AppOrigin
  CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad  # CachingDisabled
  ViewerProtocolPolicy: redirect-to-https
```

### Signed URLs for Documents

```typescript
// lib/cloudfront-signer.ts
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';

const CLOUDFRONT_KEY_PAIR_ID = process.env.CLOUDFRONT_KEY_PAIR_ID!;
const CLOUDFRONT_PRIVATE_KEY = process.env.CLOUDFRONT_PRIVATE_KEY!;

export function getSignedDocumentUrl(
  documentPath: string,
  expiresIn: number = 3600 // 1 hour
): string {
  const url = `https://${process.env.CLOUDFRONT_DOMAIN}/documents/${documentPath}`;
  
  return getSignedUrl({
    url,
    keyPairId: CLOUDFRONT_KEY_PAIR_ID,
    privateKey: CLOUDFRONT_PRIVATE_KEY,
    dateLessThan: new Date(Date.now() + expiresIn * 1000).toISOString(),
  });
}
```

---

## 3. S3 Configuration for Documents

### Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFrontAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity ${OAI_ID}"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::contigo-documents/*"
    }
  ]
}
```

### CORS Configuration

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["https://contigo.app", "https://*.contigo.app"],
    "ExposeHeaders": ["ETag", "Content-Length"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 4. Cache Invalidation Strategy

### Application-Level Invalidation

```typescript
// lib/cdn-invalidation.ts
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';

const cloudfront = new CloudFrontClient({ region: process.env.AWS_REGION });

export async function invalidateCache(paths: string[]): Promise<void> {
  await cloudfront.send(new CreateInvalidationCommand({
    DistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: `inv-${Date.now()}`,
      Paths: {
        Quantity: paths.length,
        Items: paths,
      },
    },
  }));
}

// Usage examples
export const CacheInvalidation = {
  // Invalidate specific contract
  contract: (id: string) => invalidateCache([
    `/api/contracts/${id}`,
    `/api/contracts/${id}/*`,
  ]),
  
  // Invalidate contracts list
  contractsList: () => invalidateCache(['/api/contracts']),
  
  // Invalidate all tenant data
  tenant: (tenantId: string) => invalidateCache([`/api/*`]),
};
```

### Surrogate Keys (Fastly/Cloudflare Enterprise)

```typescript
// Add surrogate keys to responses for targeted invalidation
response.headers.set('Surrogate-Key', `tenant:${tenantId} contract:${contractId}`);

// Purge by surrogate key
await fetch(`https://api.fastly.com/service/${SERVICE_ID}/purge/tenant:${tenantId}`, {
  method: 'POST',
  headers: { 'Fastly-Key': API_KEY },
});
```

---

## 5. Environment Variables

```bash
# .env.production

# Cloudflare
CLOUDFLARE_ZONE_ID=your-zone-id
CLOUDFLARE_API_TOKEN=your-api-token

# CloudFront
CLOUDFRONT_DISTRIBUTION_ID=E1234567890ABC
CLOUDFRONT_DOMAIN=d1234567890.cloudfront.net
CLOUDFRONT_KEY_PAIR_ID=K1234567890ABC
CLOUDFRONT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"

# S3
AWS_REGION=eu-central-1
S3_DOCUMENTS_BUCKET=contigo-documents
```

---

## 6. Monitoring & Metrics

### Cloudflare Analytics API

```typescript
// lib/cdn-metrics.ts
export async function getCDNMetrics(since: Date): Promise<CDNMetrics> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/analytics/dashboard`,
    {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    }
  );
  
  const data = await response.json();
  return {
    requests: data.totals.requests.all,
    bandwidth: data.totals.bandwidth.all,
    cacheHitRatio: data.totals.requests.cached / data.totals.requests.all,
    threats: data.totals.threats.all,
  };
}
```

### Cache Hit Ratio Targets

| Resource Type | Target Hit Ratio |
|---------------|------------------|
| Static Assets | > 99% |
| API (cacheable) | > 80% |
| Documents | > 90% |
| Dynamic Pages | N/A (no cache) |

---

## 7. Performance Checklist

- [ ] CDN configured with correct cache behaviors
- [ ] Static assets cached for 1 year with immutable
- [ ] API routes bypass CDN cache (app controls caching)
- [ ] Documents served via signed URLs
- [ ] CORS configured correctly
- [ ] Cache invalidation integrated with app
- [ ] Security headers applied at CDN level
- [ ] Compression enabled (Brotli/gzip)
- [ ] HTTP/2 or HTTP/3 enabled
- [ ] Monitoring dashboard set up

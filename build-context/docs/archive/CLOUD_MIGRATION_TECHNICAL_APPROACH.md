# ConTigo Platform - Cloud Migration Technical Approach

> **Document Version:** 1.0  
> **Last Updated:** January 2026  
> **Classification:** Technical Architecture Document

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture Assessment](#current-architecture-assessment)
3. [Target Cloud Architecture](#target-cloud-architecture)
4. [Migration Strategy](#migration-strategy)
5. [Cloud Provider Comparison](#cloud-provider-comparison)
6. [AWS Reference Architecture](#aws-reference-architecture)
7. [Azure Reference Architecture](#azure-reference-architecture)
8. [GCP Reference Architecture](#gcp-reference-architecture)
9. [Kubernetes Deployment](#kubernetes-deployment)
10. [Database Migration](#database-migration)
11. [Storage Migration](#storage-migration)
12. [Security & Compliance](#security--compliance)
13. [CI/CD Pipeline](#cicd-pipeline)
14. [Monitoring & Observability](#monitoring--observability)
15. [Cost Optimization](#cost-optimization)
16. [Disaster Recovery](#disaster-recovery)
17. [Migration Timeline](#migration-timeline)
18. [Risk Assessment](#risk-assessment)
19. [Rollback Strategy](#rollback-strategy)

---

## Executive Summary

This document outlines the comprehensive technical approach for migrating the ConTigo Contract Intelligence Platform to cloud infrastructure. The migration aims to achieve:

- **99.99% availability** through multi-region deployment
- **50% reduction** in infrastructure costs through auto-scaling
- **Enhanced security** with cloud-native security services
- **Global performance** with edge caching and CDN
- **Simplified operations** through managed services

### Migration Principles

| Principle | Description |
|-----------|-------------|
| **Lift & Shift First** | Minimize initial changes for faster migration |
| **Refactor Iteratively** | Optimize for cloud-native after migration |
| **Zero Downtime** | Blue-green deployment for seamless transition |
| **Security First** | Implement cloud security from day one |
| **Cost Awareness** | Right-size resources and implement FinOps |

---

## Current Architecture Assessment

### Existing Infrastructure

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CURRENT ON-PREMISE / DEV SETUP                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Next.js    │    │   Workers    │    │  WebSocket   │          │
│  │   App:3005   │    │   Service    │    │  Server:3001 │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│         │                   │                   │                   │
│         └───────────────────┼───────────────────┘                   │
│                             │                                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  PostgreSQL  │    │    Redis     │    │    MinIO     │          │
│  │    :5432     │    │    :6379     │    │    :9000     │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Inventory

| Component | Technology | Resource Requirements | Cloud Target |
|-----------|------------|----------------------|--------------|
| Web Application | Next.js 15 | 4 vCPU, 8GB RAM | Container Service |
| Background Workers | Node.js/BullMQ | 2 vCPU, 4GB RAM | Container Service |
| WebSocket Server | Socket.IO | 2 vCPU, 4GB RAM | Container/Managed |
| Database | PostgreSQL 15 | 4 vCPU, 16GB RAM | Managed Database |
| Cache | Redis 7 | 2 vCPU, 8GB RAM | Managed Cache |
| Object Storage | MinIO | 500GB+ | Cloud Storage |
| AI Processing | OpenAI API | External API | Same |

### Current Pain Points

- ❌ Single point of failure (no HA)
- ❌ Manual scaling during peak loads
- ❌ Limited geographic distribution
- ❌ Complex backup and DR processes
- ❌ Security patching overhead
- ❌ Infrastructure management burden

---

## Target Cloud Architecture

### Cloud-Native Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CLOUD-NATIVE TARGET ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                              EDGE LAYER                                  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │     CDN     │  │     WAF     │  │   DDoS      │  │    DNS      │    │   │
│  │  │  (Global)   │  │  Firewall   │  │ Protection  │  │  (GeoDNS)   │    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         COMPUTE LAYER (Kubernetes)                       │   │
│  │                                                                          │   │
│  │  ┌─────────────────────────┐    ┌─────────────────────────┐            │   │
│  │  │    REGION A (Primary)   │    │   REGION B (Secondary)  │            │   │
│  │  │  ┌───────┐ ┌───────┐   │    │  ┌───────┐ ┌───────┐   │            │   │
│  │  │  │ Web   │ │ Web   │   │    │  │ Web   │ │ Web   │   │            │   │
│  │  │  │ Pod 1 │ │ Pod 2 │   │    │  │ Pod 1 │ │ Pod 2 │   │            │   │
│  │  │  └───────┘ └───────┘   │    │  └───────┘ └───────┘   │            │   │
│  │  │  ┌───────┐ ┌───────┐   │    │  ┌───────┐ ┌───────┐   │            │   │
│  │  │  │Worker │ │Worker │   │    │  │Worker │ │Worker │   │            │   │
│  │  │  │ Pod 1 │ │ Pod 2 │   │    │  │ Pod 1 │ │ Pod 2 │   │            │   │
│  │  │  └───────┘ └───────┘   │    │  └───────┘ └───────┘   │            │   │
│  │  └─────────────────────────┘    └─────────────────────────┘            │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                            DATA LAYER                                    │   │
│  │                                                                          │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │   │
│  │  │   PostgreSQL    │  │   Redis Cluster │  │  Object Storage │         │   │
│  │  │   (Primary)     │  │   (Multi-AZ)    │  │    (Global)     │         │   │
│  │  │       │         │  │                 │  │                 │         │   │
│  │  │       ▼         │  │                 │  │                 │         │   │
│  │  │   PostgreSQL    │  │                 │  │                 │         │   │
│  │  │   (Read Replica)│  │                 │  │                 │         │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Architecture Benefits

| Benefit | Description |
|---------|-------------|
| **High Availability** | Multi-region active-active deployment |
| **Auto-scaling** | Horizontal pod autoscaling based on load |
| **Global Performance** | CDN edge caching for static assets |
| **Managed Services** | Reduced operational overhead |
| **Security** | Cloud-native security services |
| **Cost Efficiency** | Pay-per-use, spot instances for workers |

---

## Migration Strategy

### Phased Approach

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MIGRATION PHASES                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 1              Phase 2              Phase 3              Phase 4      │
│  ─────────            ─────────            ─────────            ─────────    │
│  FOUNDATION           LIFT & SHIFT         OPTIMIZE             ENHANCE      │
│                                                                              │
│  ┌─────────┐          ┌─────────┐          ┌─────────┐          ┌─────────┐ │
│  │ Setup   │          │ Migrate │          │ Refactor│          │ Advanced│ │
│  │ Cloud   │    →     │ Apps &  │    →     │ to Cloud│    →     │ Features│ │
│  │ Infra   │          │ Data    │          │ Native  │          │         │ │
│  └─────────┘          └─────────┘          └─────────┘          └─────────┘ │
│                                                                              │
│  • VPC/Network        • Containerize       • Implement HPA      • ML Pipeline│
│  • IAM Setup          • Database Migrate   • Add Read Replicas  • Real-time  │
│  • Secrets Mgmt       • Storage Migrate    • Implement CDN      • Analytics  │
│  • CI/CD Pipeline     • DNS Cutover        • Optimize Costs     • Multi-tenancy│
│                                                                              │
│  Week 1-2             Week 3-6             Week 7-10            Week 11-14   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Migration Patterns

| Pattern | Use Case | Risk Level |
|---------|----------|------------|
| **Rehost (Lift & Shift)** | Initial migration, minimal changes | Low |
| **Replatform** | Containerize, use managed databases | Medium |
| **Refactor** | Cloud-native optimizations | High |
| **Repurchase** | Switch to SaaS alternatives | Low |
| **Retire** | Decommission unused components | Low |

---

## Cloud Provider Comparison

### Feature Matrix

| Feature | AWS | Azure | GCP |
|---------|-----|-------|-----|
| **Kubernetes** | EKS | AKS | GKE |
| **Managed PostgreSQL** | RDS/Aurora | Azure Database | Cloud SQL |
| **Managed Redis** | ElastiCache | Azure Cache | Memorystore |
| **Object Storage** | S3 | Blob Storage | Cloud Storage |
| **CDN** | CloudFront | Azure CDN | Cloud CDN |
| **Serverless** | Lambda/Fargate | Functions/Container Apps | Cloud Run |
| **AI/ML** | SageMaker/Bedrock | Azure OpenAI | Vertex AI |
| **Pricing** | Pay-as-you-go | Pay-as-you-go | Pay-as-you-go |
| **Global Regions** | 33 | 60+ | 37 |

### Recommendation

**Primary Choice: AWS** - Selected based on:

- Mature Kubernetes (EKS) ecosystem
- Aurora PostgreSQL for scalability
- Extensive AI/ML integrations
- Team familiarity
- Cost optimization tools (Savings Plans, Spot)

**Alternative: Azure** - If Microsoft ecosystem preferred:

- Azure OpenAI Service integration
- Active Directory integration
- Enterprise support agreements

---

## AWS Reference Architecture

### Complete AWS Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AWS REFERENCE ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌───────────────────────────────────────────────────────────────────────┐     │
│   │  Route 53 (DNS) → CloudFront (CDN) → WAF → ALB                        │     │
│   └───────────────────────────────────────────────────────────────────────┘     │
│                                        │                                         │
│   ┌────────────────────────────────────┼────────────────────────────────────┐   │
│   │                            VPC (10.0.0.0/16)                            │   │
│   │                                    │                                    │   │
│   │   ┌────────────────────────────────┼────────────────────────────────┐  │   │
│   │   │             PUBLIC SUBNETS (10.0.1.0/24, 10.0.2.0/24)           │  │   │
│   │   │                                │                                │  │   │
│   │   │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │  │   │
│   │   │   │     ALB     │    │   NAT GW    │    │   Bastion   │        │  │   │
│   │   │   │  (Internet  │    │    (AZ-A)   │    │    Host     │        │  │   │
│   │   │   │   Facing)   │    │             │    │             │        │  │   │
│   │   │   └─────────────┘    └─────────────┘    └─────────────┘        │  │   │
│   │   └────────────────────────────────┼────────────────────────────────┘  │   │
│   │                                    │                                    │   │
│   │   ┌────────────────────────────────┼────────────────────────────────┐  │   │
│   │   │           PRIVATE SUBNETS (10.0.10.0/24, 10.0.11.0/24)          │  │   │
│   │   │                                │                                │  │   │
│   │   │   ┌─────────────────────────────────────────────────────────┐  │  │   │
│   │   │   │                    EKS CLUSTER                          │  │  │   │
│   │   │   │                                                         │  │  │   │
│   │   │   │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │  │  │   │
│   │   │   │  │ Web App │  │ Workers │  │WebSocket│  │ Ingress │   │  │  │   │
│   │   │   │  │(3 pods) │  │(2 pods) │  │(2 pods) │  │Controller│   │  │  │   │
│   │   │   │  └─────────┘  └─────────┘  └─────────┘  └─────────┘   │  │  │   │
│   │   │   │                                                         │  │  │   │
│   │   │   └─────────────────────────────────────────────────────────┘  │  │   │
│   │   └────────────────────────────────────────────────────────────────┘  │   │
│   │                                    │                                    │   │
│   │   ┌────────────────────────────────┼────────────────────────────────┐  │   │
│   │   │           DATABASE SUBNETS (10.0.20.0/24, 10.0.21.0/24)         │  │   │
│   │   │                                │                                │  │   │
│   │   │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │  │   │
│   │   │   │   Aurora    │    │ ElastiCache │    │   OpenSearch│        │  │   │
│   │   │   │ PostgreSQL  │    │   Redis     │    │   (Logs)    │        │  │   │
│   │   │   │  (Multi-AZ) │    │  (Cluster)  │    │             │        │  │   │
│   │   │   └─────────────┘    └─────────────┘    └─────────────┘        │  │   │
│   │   └────────────────────────────────────────────────────────────────┘  │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  S3 (Documents)  │  ECR (Images)  │  Secrets Manager  │  CloudWatch     │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### AWS Services Mapping

| Component | AWS Service | Configuration |
|-----------|-------------|---------------|
| **Compute** | EKS (Kubernetes) | m6i.xlarge nodes, 3-10 nodes |
| **Database** | Aurora PostgreSQL | db.r6g.xlarge, Multi-AZ |
| **Cache** | ElastiCache Redis | cache.r6g.large, Cluster Mode |
| **Storage** | S3 | Intelligent-Tiering |
| **CDN** | CloudFront | Global edge locations |
| **Load Balancer** | ALB | Application Load Balancer |
| **DNS** | Route 53 | Latency-based routing |
| **Secrets** | Secrets Manager | Automatic rotation |
| **Monitoring** | CloudWatch + X-Ray | Full observability |
| **Security** | WAF, Shield, GuardDuty | DDoS protection |

### Terraform Configuration (AWS)

```hcl
# terraform/aws/main.tf

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "contigo-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
  }
}

# VPC
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "contigo-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.10.0/24", "10.0.11.0/24", "10.0.12.0/24"]
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  database_subnets = ["10.0.20.0/24", "10.0.21.0/24", "10.0.22.0/24"]

  enable_nat_gateway     = true
  single_nat_gateway     = false
  one_nat_gateway_per_az = true

  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Environment = "production"
    Project     = "contigo"
  }
}

# EKS Cluster
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "19.0.0"

  cluster_name    = "contigo-eks"
  cluster_version = "1.28"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    general = {
      desired_size = 3
      min_size     = 2
      max_size     = 10

      instance_types = ["m6i.xlarge"]
      capacity_type  = "ON_DEMAND"
    }
    
    workers = {
      desired_size = 2
      min_size     = 1
      max_size     = 5

      instance_types = ["m6i.large"]
      capacity_type  = "SPOT"
      
      labels = {
        workload = "workers"
      }
    }
  }

  tags = {
    Environment = "production"
  }
}

# Aurora PostgreSQL
module "aurora" {
  source  = "terraform-aws-modules/rds-aurora/aws"
  version = "8.0.0"

  name           = "contigo-aurora"
  engine         = "aurora-postgresql"
  engine_version = "15.4"
  instance_class = "db.r6g.xlarge"
  instances = {
    primary = {}
    reader  = {}
  }

  vpc_id               = module.vpc.vpc_id
  db_subnet_group_name = module.vpc.database_subnet_group_name
  security_group_rules = {
    eks_ingress = {
      source_security_group_id = module.eks.cluster_security_group_id
    }
  }

  storage_encrypted   = true
  apply_immediately   = true
  monitoring_interval = 60

  tags = {
    Environment = "production"
  }
}

# ElastiCache Redis
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "contigo-redis"
  description          = "Redis cluster for ConTigo"
  node_type            = "cache.r6g.large"
  num_cache_clusters   = 3
  
  engine               = "redis"
  engine_version       = "7.0"
  port                 = 6379
  
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  automatic_failover_enabled = true
  multi_az_enabled           = true
}

# S3 Bucket for Documents
resource "aws_s3_bucket" "documents" {
  bucket = "contigo-documents-${data.aws_caller_identity.current.account_id}"
  
  tags = {
    Environment = "production"
  }
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  
  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "alb"
    
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }
  
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    
    forwarded_values {
      query_string = true
      cookies {
        forward = "all"
      }
    }
  }
  
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.main.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}
```

---

## Azure Reference Architecture

### Azure Services Mapping

| Component | Azure Service | Configuration |
|-----------|---------------|---------------|
| **Compute** | AKS | Standard_D4s_v3, 3-10 nodes |
| **Database** | Azure Database for PostgreSQL Flexible | GP_Standard_D4s_v3 |
| **Cache** | Azure Cache for Redis | Premium P1, Cluster |
| **Storage** | Blob Storage | Hot tier, GRS |
| **CDN** | Azure CDN | Microsoft Standard |
| **Load Balancer** | Application Gateway | WAF v2 |
| **DNS** | Azure DNS | Traffic Manager |
| **Secrets** | Key Vault | Premium tier |
| **Monitoring** | Azure Monitor + App Insights | Full APM |

### Azure Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AZURE REFERENCE ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Azure Front Door (CDN + WAF) → Application Gateway → AKS Cluster           │
│                                        │                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      VIRTUAL NETWORK (10.0.0.0/16)                  │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐   │    │
│  │  │                    AKS CLUSTER                               │   │    │
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │   │    │
│  │  │  │ Web App │  │ Workers │  │WebSocket│  │ Ingress │        │   │    │
│  │  │  │  Pods   │  │  Pods   │  │  Pods   │  │  NGINX  │        │   │    │
│  │  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │   │    │
│  │  └─────────────────────────────────────────────────────────────┘   │    │
│  │                                                                      │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │    │
│  │  │ Azure PostgreSQL │  │  Azure Redis     │  │  Blob Storage    │ │    │
│  │  │   Flexible       │  │   Premium        │  │    (Documents)   │ │    │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Key Vault │ Container Registry │ Azure Monitor │ Log Analytics             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## GCP Reference Architecture

### GCP Services Mapping

| Component | GCP Service | Configuration |
|-----------|-------------|---------------|
| **Compute** | GKE | e2-standard-4, 3-10 nodes |
| **Database** | Cloud SQL PostgreSQL | db-custom-4-16384 |
| **Cache** | Memorystore Redis | Standard, 5GB |
| **Storage** | Cloud Storage | Standard, Multi-region |
| **CDN** | Cloud CDN | Global |
| **Load Balancer** | Cloud Load Balancing | HTTPS LB |
| **DNS** | Cloud DNS | Global |
| **Secrets** | Secret Manager | Automatic |
| **Monitoring** | Cloud Monitoring + Trace | Full APM |

---

## Kubernetes Deployment

### Helm Chart Structure

```
helm/contigo/
├── Chart.yaml
├── values.yaml
├── values-production.yaml
├── values-staging.yaml
├── templates/
│   ├── _helpers.tpl
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── web-deployment.yaml
│   ├── web-service.yaml
│   ├── web-hpa.yaml
│   ├── workers-deployment.yaml
│   ├── workers-hpa.yaml
│   ├── websocket-deployment.yaml
│   ├── websocket-service.yaml
│   ├── ingress.yaml
│   ├── networkpolicy.yaml
│   └── pdb.yaml
└── charts/
    └── redis/
```

### Web Application Deployment

```yaml
# templates/web-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "contigo.fullname" . }}-web
  labels:
    {{- include "contigo.labels" . | nindent 4 }}
    app.kubernetes.io/component: web
spec:
  replicas: {{ .Values.web.replicaCount }}
  selector:
    matchLabels:
      {{- include "contigo.selectorLabels" . | nindent 6 }}
      app.kubernetes.io/component: web
  template:
    metadata:
      labels:
        {{- include "contigo.selectorLabels" . | nindent 8 }}
        app.kubernetes.io/component: web
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3005"
    spec:
      serviceAccountName: {{ include "contigo.serviceAccountName" . }}
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
        - name: web
          image: "{{ .Values.web.image.repository }}:{{ .Values.web.image.tag }}"
          imagePullPolicy: {{ .Values.web.image.pullPolicy }}
          ports:
            - name: http
              containerPort: 3005
              protocol: TCP
          env:
            - name: NODE_ENV
              value: production
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: {{ include "contigo.fullname" . }}-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: {{ include "contigo.fullname" . }}-secrets
                  key: redis-url
            - name: NEXTAUTH_SECRET
              valueFrom:
                secretKeyRef:
                  name: {{ include "contigo.fullname" . }}-secrets
                  key: nextauth-secret
            - name: OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: {{ include "contigo.fullname" . }}-secrets
                  key: openai-api-key
          livenessProbe:
            httpGet:
              path: /api/health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /api/ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          resources:
            {{- toYaml .Values.web.resources | nindent 12 }}
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app.kubernetes.io/component: web
                topologyKey: kubernetes.io/hostname
```

### Horizontal Pod Autoscaler

```yaml
# templates/web-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "contigo.fullname" . }}-web
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "contigo.fullname" . }}-web
  minReplicas: {{ .Values.web.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.web.autoscaling.maxReplicas }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
        - type: Pods
          value: 4
          periodSeconds: 15
      selectPolicy: Max
```

### Values Configuration

```yaml
# values-production.yaml
global:
  environment: production
  domain: contigo.example.com

web:
  replicaCount: 3
  image:
    repository: ecr.aws/contigo/web
    tag: latest
    pullPolicy: Always
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 2000m
      memory: 4Gi
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 20

workers:
  replicaCount: 2
  image:
    repository: ecr.aws/contigo/workers
    tag: latest
  resources:
    requests:
      cpu: 250m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 2Gi
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10

websocket:
  replicaCount: 2
  image:
    repository: ecr.aws/contigo/websocket
    tag: latest
  resources:
    requests:
      cpu: 250m
      memory: 512Mi
    limits:
      cpu: 500m
      memory: 1Gi

ingress:
  enabled: true
  className: nginx
  annotations:
    kubernetes.io/tls-acme: "true"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "100m"
  hosts:
    - host: contigo.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: contigo-tls
      hosts:
        - contigo.example.com
```

---

## Database Migration

### Migration Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DATABASE MIGRATION STRATEGY                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 1: Setup                Phase 2: Sync              Phase 3: Cutover   │
│  ─────────────────             ─────────────               ───────────────   │
│                                                                              │
│  ┌─────────────┐              ┌─────────────┐              ┌─────────────┐  │
│  │  Provision  │              │  Configure  │              │   Switch    │  │
│  │  Cloud DB   │      →       │  Replication│      →       │   Traffic   │  │
│  └─────────────┘              └─────────────┘              └─────────────┘  │
│                                                                              │
│  • Create Aurora              • Setup DMS                  • Stop writes    │
│  • Configure VPC              • Full data copy             • Verify sync    │
│  • Security groups            • Enable CDC                 • DNS cutover    │
│  • Parameter groups           • Monitor lag                • Verify app     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### AWS DMS Configuration

```hcl
# Database Migration Service
resource "aws_dms_replication_instance" "main" {
  replication_instance_id     = "contigo-dms"
  replication_instance_class  = "dms.r5.large"
  allocated_storage           = 100
  
  vpc_security_group_ids = [aws_security_group.dms.id]
  replication_subnet_group_id = aws_dms_replication_subnet_group.main.id
  
  multi_az                    = true
  publicly_accessible         = false
  
  tags = {
    Environment = "migration"
  }
}

resource "aws_dms_endpoint" "source" {
  endpoint_id   = "source-postgresql"
  endpoint_type = "source"
  engine_name   = "postgres"
  
  server_name   = var.source_db_host
  port          = 5432
  database_name = "contigo"
  username      = var.source_db_user
  password      = var.source_db_password
  
  ssl_mode = "require"
}

resource "aws_dms_endpoint" "target" {
  endpoint_id   = "target-aurora"
  endpoint_type = "target"
  engine_name   = "aurora-postgresql"
  
  server_name   = module.aurora.cluster_endpoint
  port          = 5432
  database_name = "contigo"
  username      = var.aurora_master_username
  password      = var.aurora_master_password
  
  ssl_mode = "require"
}

resource "aws_dms_replication_task" "migration" {
  replication_task_id      = "contigo-full-migration"
  migration_type           = "full-load-and-cdc"
  replication_instance_arn = aws_dms_replication_instance.main.replication_instance_arn
  source_endpoint_arn      = aws_dms_endpoint.source.endpoint_arn
  target_endpoint_arn      = aws_dms_endpoint.target.endpoint_arn
  
  table_mappings = jsonencode({
    rules = [{
      rule-type = "selection"
      rule-id   = "1"
      rule-name = "all-tables"
      object-locator = {
        schema-name = "public"
        table-name  = "%"
      }
      rule-action = "include"
    }]
  })
  
  replication_task_settings = jsonencode({
    TargetMetadata = {
      FullLobMode            = true
      LobMaxSize             = 64
      SupportLobs           = true
      TaskRecoveryTableEnabled = true
    }
    FullLoadSettings = {
      TargetTablePrepMode = "DO_NOTHING"
    }
    Logging = {
      EnableLogging = true
    }
  })
}
```

### Data Validation Script

```bash
#!/bin/bash
# scripts/validate-migration.sh

echo "=== Database Migration Validation ==="

# Compare row counts
echo "Comparing row counts..."
SOURCE_COUNT=$(psql $SOURCE_DB_URL -t -c "SELECT COUNT(*) FROM contracts")
TARGET_COUNT=$(psql $TARGET_DB_URL -t -c "SELECT COUNT(*) FROM contracts")

if [ "$SOURCE_COUNT" == "$TARGET_COUNT" ]; then
  echo "✓ Contracts: $SOURCE_COUNT rows (match)"
else
  echo "✗ Contracts: Source=$SOURCE_COUNT, Target=$TARGET_COUNT (MISMATCH)"
  exit 1
fi

# Compare checksums
echo "Comparing data checksums..."
SOURCE_CHECKSUM=$(psql $SOURCE_DB_URL -t -c "SELECT MD5(STRING_AGG(id::text, '')) FROM contracts ORDER BY id")
TARGET_CHECKSUM=$(psql $TARGET_DB_URL -t -c "SELECT MD5(STRING_AGG(id::text, '')) FROM contracts ORDER BY id")

if [ "$SOURCE_CHECKSUM" == "$TARGET_CHECKSUM" ]; then
  echo "✓ Checksum verified"
else
  echo "✗ Checksum mismatch"
  exit 1
fi

# Check replication lag
echo "Checking replication lag..."
LAG=$(aws dms describe-replication-tasks \
  --filters Name=replication-task-arn,Values=$TASK_ARN \
  --query 'ReplicationTasks[0].ReplicationTaskStats.CDCLatencySource' \
  --output text)

if [ "$LAG" -lt 60 ]; then
  echo "✓ Replication lag: ${LAG}s"
else
  echo "⚠ High replication lag: ${LAG}s"
fi

echo "=== Validation Complete ==="
```

---

## Storage Migration

### S3 Migration from MinIO

```python
# scripts/migrate-storage.py

import boto3
from minio import Minio
import concurrent.futures
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Source (MinIO)
minio_client = Minio(
    endpoint=os.environ['MINIO_ENDPOINT'],
    access_key=os.environ['MINIO_ACCESS_KEY'],
    secret_key=os.environ['MINIO_SECRET_KEY'],
    secure=True
)

# Target (S3)
s3_client = boto3.client('s3')
S3_BUCKET = os.environ['S3_BUCKET']

def migrate_object(obj):
    """Migrate single object from MinIO to S3"""
    try:
        # Download from MinIO
        data = minio_client.get_object('documents', obj.object_name)
        
        # Upload to S3
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=obj.object_name,
            Body=data.read(),
            ContentType=obj.content_type,
            Metadata={
                'migrated-from': 'minio',
                'original-etag': obj.etag
            }
        )
        
        logger.info(f"Migrated: {obj.object_name}")
        return True
    except Exception as e:
        logger.error(f"Failed: {obj.object_name} - {e}")
        return False

def main():
    # List all objects
    objects = list(minio_client.list_objects('documents', recursive=True))
    total = len(objects)
    logger.info(f"Total objects to migrate: {total}")
    
    # Parallel migration
    success = 0
    failed = 0
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(migrate_object, obj): obj for obj in objects}
        
        for future in concurrent.futures.as_completed(futures):
            if future.result():
                success += 1
            else:
                failed += 1
            
            if (success + failed) % 100 == 0:
                logger.info(f"Progress: {success + failed}/{total}")
    
    logger.info(f"Migration complete: {success} success, {failed} failed")

if __name__ == "__main__":
    main()
```

---

## Security & Compliance

### Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SECURITY ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         PERIMETER SECURITY                          │   │
│  │  WAF │ DDoS Protection │ Rate Limiting │ Bot Protection            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         NETWORK SECURITY                            │   │
│  │  VPC │ Security Groups │ NACLs │ Private Subnets │ VPN             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        APPLICATION SECURITY                         │   │
│  │  TLS 1.3 │ OIDC Auth │ RBAC │ API Keys │ JWT Tokens                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          DATA SECURITY                              │   │
│  │  Encryption at Rest │ Encryption in Transit │ Key Management       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        MONITORING & AUDIT                           │   │
│  │  CloudTrail │ GuardDuty │ Security Hub │ Audit Logs                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Security Controls

| Layer | Control | Implementation |
|-------|---------|----------------|
| **Edge** | WAF | AWS WAF with managed rules |
| **Edge** | DDoS | AWS Shield Standard/Advanced |
| **Network** | Isolation | Private subnets, no public IPs |
| **Network** | Firewall | Security groups, NACLs |
| **Compute** | Container Security | Read-only root filesystem |
| **Compute** | Pod Security | Pod Security Standards |
| **Data** | Encryption at Rest | KMS-managed keys |
| **Data** | Encryption in Transit | TLS 1.3 everywhere |
| **Identity** | Authentication | OIDC with MFA |
| **Identity** | Authorization | RBAC, least privilege |
| **Audit** | Logging | CloudTrail, application logs |
| **Audit** | Monitoring | GuardDuty, Security Hub |

### Compliance Requirements

| Standard | Status | Controls |
|----------|--------|----------|
| **SOC 2 Type II** | Required | Access control, encryption, monitoring |
| **GDPR** | Required | Data residency, deletion, consent |
| **HIPAA** | Optional | BAA, encryption, audit logs |
| **ISO 27001** | Planned | Information security management |

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloud

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: contigo
  EKS_CLUSTER: contigo-eks

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run tests
        run: pnpm test:unit
      
      - name: Type check
        run: pnpm typecheck

  build:
    needs: test
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.build.outputs.image-tag }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Login to ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2
      
      - name: Build and push image
        id: build
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG -t $ECR_REGISTRY/$ECR_REPOSITORY:latest .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
          echo "image-tag=$IMAGE_TAG" >> $GITHUB_OUTPUT

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Update kubeconfig
        run: aws eks update-kubeconfig --name $EKS_CLUSTER --region $AWS_REGION
      
      - name: Deploy to staging
        run: |
          helm upgrade --install contigo ./helm/contigo \
            --namespace staging \
            --create-namespace \
            -f ./helm/contigo/values-staging.yaml \
            --set web.image.tag=${{ needs.build.outputs.image-tag }} \
            --set workers.image.tag=${{ needs.build.outputs.image-tag }} \
            --wait --timeout 10m
      
      - name: Run smoke tests
        run: |
          kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=contigo -n staging --timeout=300s
          curl -sf https://staging.contigo.example.com/api/health

  deploy-production:
    needs: [build, deploy-staging]
    runs-on: ubuntu-latest
    environment: production
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Update kubeconfig
        run: aws eks update-kubeconfig --name $EKS_CLUSTER --region $AWS_REGION
      
      - name: Deploy to production (Blue-Green)
        run: |
          # Deploy to green environment
          helm upgrade --install contigo-green ./helm/contigo \
            --namespace production \
            -f ./helm/contigo/values-production.yaml \
            --set web.image.tag=${{ needs.build.outputs.image-tag }} \
            --set ingress.enabled=false \
            --wait --timeout 15m
          
          # Run production smoke tests
          kubectl exec -n production deployment/contigo-green-web -- curl -sf localhost:3005/api/health
          
          # Switch traffic to green
          kubectl patch ingress contigo -n production \
            --type=json \
            -p='[{"op":"replace","path":"/spec/rules/0/http/paths/0/backend/service/name","value":"contigo-green-web"}]'
          
          # Scale down blue after verification
          sleep 60
          helm uninstall contigo-blue -n production --ignore-not-found
          
          # Rename green to blue for next deployment
          helm upgrade --install contigo-blue ./helm/contigo \
            --namespace production \
            -f ./helm/contigo/values-production.yaml \
            --set web.image.tag=${{ needs.build.outputs.image-tag }}
```

---

## Monitoring & Observability

### Observability Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        OBSERVABILITY ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │    Metrics   │  │    Logs      │  │    Traces    │  │   Alerts     │    │
│  │  (Prometheus)│  │ (CloudWatch) │  │   (X-Ray)    │  │  (PagerDuty) │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│         │                  │                 │                 │            │
│         └──────────────────┼─────────────────┼─────────────────┘            │
│                            │                 │                               │
│                    ┌───────┴─────────────────┴───────┐                      │
│                    │         GRAFANA DASHBOARD       │                      │
│                    │   (Unified Observability UI)    │                      │
│                    └─────────────────────────────────┘                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Metrics & SLIs

| Metric | SLI | Target SLO |
|--------|-----|------------|
| **Availability** | Successful requests / Total requests | 99.9% |
| **Latency (P50)** | Median response time | < 200ms |
| **Latency (P99)** | 99th percentile response time | < 1s |
| **Error Rate** | 5xx errors / Total requests | < 0.1% |
| **Throughput** | Requests per second | > 1000 RPS |

### CloudWatch Dashboards

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "title": "Request Rate",
        "metrics": [
          ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", "contigo-alb"]
        ],
        "period": 60,
        "stat": "Sum"
      }
    },
    {
      "type": "metric",
      "properties": {
        "title": "Response Time",
        "metrics": [
          ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", "contigo-alb"]
        ],
        "period": 60,
        "stat": "p99"
      }
    },
    {
      "type": "metric",
      "properties": {
        "title": "Error Rate",
        "metrics": [
          ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", "contigo-alb"]
        ],
        "period": 60,
        "stat": "Sum"
      }
    },
    {
      "type": "metric",
      "properties": {
        "title": "Database Connections",
        "metrics": [
          ["AWS/RDS", "DatabaseConnections", "DBClusterIdentifier", "contigo-aurora"]
        ],
        "period": 60,
        "stat": "Average"
      }
    }
  ]
}
```

### Alerting Rules

```yaml
# prometheus/alerts.yaml
groups:
  - name: contigo-alerts
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) 
          / sum(rate(http_requests_total[5m])) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
          description: Error rate is {{ $value | humanizePercentage }}
      
      - alert: HighLatency
        expr: |
          histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High latency detected
          description: P99 latency is {{ $value }}s
      
      - alert: PodCrashLooping
        expr: |
          increase(kube_pod_container_status_restarts_total[1h]) > 5
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: Pod is crash looping
          description: Pod {{ $labels.pod }} has restarted {{ $value }} times
      
      - alert: DatabaseConnectionsHigh
        expr: |
          aws_rds_database_connections_average > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Database connections high
          description: {{ $value }} connections (80% capacity)
```

---

## Cost Optimization

### Cost Breakdown Estimate

| Service | Monthly Cost (Estimate) | Optimization |
|---------|------------------------|--------------|
| **EKS Cluster** | $73 | Fixed cost |
| **EC2 (Compute)** | $800-2000 | Spot instances, right-sizing |
| **RDS Aurora** | $400-800 | Reserved instances |
| **ElastiCache** | $200-400 | Reserved nodes |
| **S3 Storage** | $50-200 | Intelligent-Tiering |
| **CloudFront** | $100-300 | Cache optimization |
| **Data Transfer** | $200-500 | VPC endpoints |
| **Total** | ~$2000-4500/month | |

### Cost Optimization Strategies

```hcl
# Spot instances for workers
resource "aws_eks_node_group" "workers_spot" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "workers-spot"
  
  capacity_type = "SPOT"
  instance_types = ["m6i.large", "m5.large", "m5a.large"]
  
  scaling_config {
    desired_size = 2
    max_size     = 10
    min_size     = 0
  }
  
  labels = {
    "workload-type" = "batch"
    "spot" = "true"
  }
  
  taint {
    key    = "spot"
    value  = "true"
    effect = "NO_SCHEDULE"
  }
}

# Reserved capacity for production
resource "aws_rds_reserved_db_instance" "aurora" {
  offering_id = data.aws_rds_reserved_db_instance_offering.aurora.offering_id
  count       = 2  # Primary + replica
}

# S3 Intelligent Tiering
resource "aws_s3_bucket_intelligent_tiering_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  name   = "EntireObjectStorage"
  
  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }
  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = 90
  }
}
```

---

## Disaster Recovery

### DR Strategy: Pilot Light

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DISASTER RECOVERY ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   PRIMARY REGION (us-east-1)              DR REGION (us-west-2)             │
│   ──────────────────────────              ─────────────────────             │
│                                                                              │
│   ┌─────────────────────┐                 ┌─────────────────────┐           │
│   │   ACTIVE WORKLOAD   │                 │   PILOT LIGHT       │           │
│   │   ┌─────┐ ┌─────┐   │                 │   (Scaled Down)     │           │
│   │   │ EKS │ │ EKS │   │                 │   ┌─────┐           │           │
│   │   │ Pod │ │ Pod │   │                 │   │ EKS │ (0 pods)  │           │
│   │   └─────┘ └─────┘   │                 │   └─────┘           │           │
│   └─────────────────────┘                 └─────────────────────┘           │
│                                                                              │
│   ┌─────────────────────┐   Replication   ┌─────────────────────┐           │
│   │  Aurora Primary     │ ───────────────→│  Aurora Read        │           │
│   │  (Writer)           │   Async         │  Replica            │           │
│   └─────────────────────┘                 └─────────────────────┘           │
│                                                                              │
│   ┌─────────────────────┐   Replication   ┌─────────────────────┐           │
│   │  S3 Bucket          │ ───────────────→│  S3 Bucket          │           │
│   │  (Documents)        │   Cross-Region  │  (Replica)          │           │
│   └─────────────────────┘                 └─────────────────────┘           │
│                                                                              │
│   RPO: < 1 minute                         RTO: < 30 minutes                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### DR Runbook

```bash
#!/bin/bash
# scripts/dr-failover.sh

echo "=== DISASTER RECOVERY FAILOVER ==="
echo "Starting failover to DR region..."

# 1. Promote Aurora replica to primary
echo "Step 1: Promoting Aurora replica..."
aws rds failover-global-cluster \
  --global-cluster-identifier contigo-global \
  --target-db-cluster-identifier contigo-dr-cluster \
  --region us-west-2

# 2. Scale up DR EKS cluster
echo "Step 2: Scaling up DR workloads..."
kubectl config use-context arn:aws:eks:us-west-2:ACCOUNT:cluster/contigo-dr

helm upgrade contigo ./helm/contigo \
  --namespace production \
  -f ./helm/contigo/values-dr.yaml \
  --set web.replicaCount=3 \
  --set workers.replicaCount=2

# 3. Update DNS to point to DR region
echo "Step 3: Updating DNS..."
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "contigo.example.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "'$DR_ALB_ZONE_ID'",
          "DNSName": "'$DR_ALB_DNS'",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# 4. Verify services
echo "Step 4: Verifying services..."
sleep 60
curl -sf https://contigo.example.com/api/health

echo "=== FAILOVER COMPLETE ==="
```

### Backup Strategy

| Data | Backup Frequency | Retention | Storage |
|------|------------------|-----------|---------|
| **Database** | Continuous (Aurora) | 35 days | Automated |
| **Database Snapshots** | Daily | 30 days | Cross-region |
| **S3 Documents** | Continuous (replication) | Indefinite | Cross-region |
| **Configuration** | On change (GitOps) | Indefinite | Git |
| **Secrets** | Daily | 30 days | AWS Backup |

---

## Migration Timeline

### 14-Week Migration Schedule

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MIGRATION TIMELINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Week 1-2: FOUNDATION                                                        │
│  ├─ Day 1-3: Cloud account setup, IAM policies                              │
│  ├─ Day 4-6: VPC, networking, security groups                               │
│  ├─ Day 7-10: CI/CD pipeline setup                                          │
│  └─ Day 11-14: Terraform infrastructure as code                             │
│                                                                              │
│  Week 3-4: CONTAINERIZATION                                                  │
│  ├─ Day 1-4: Dockerize all services                                         │
│  ├─ Day 5-7: Create Helm charts                                             │
│  └─ Day 8-14: Test in staging environment                                   │
│                                                                              │
│  Week 5-6: DATABASE MIGRATION                                                │
│  ├─ Day 1-3: Provision Aurora cluster                                       │
│  ├─ Day 4-7: Setup DMS replication                                          │
│  ├─ Day 8-10: Full data migration                                           │
│  └─ Day 11-14: Validation and testing                                       │
│                                                                              │
│  Week 7-8: STORAGE & CACHE MIGRATION                                         │
│  ├─ Day 1-4: S3 bucket setup and migration                                  │
│  ├─ Day 5-7: ElastiCache cluster setup                                      │
│  └─ Day 8-14: Application configuration updates                             │
│                                                                              │
│  Week 9-10: STAGING DEPLOYMENT                                               │
│  ├─ Day 1-5: Deploy to EKS staging                                          │
│  ├─ Day 6-10: Integration testing                                           │
│  └─ Day 11-14: Performance testing                                          │
│                                                                              │
│  Week 11-12: PRODUCTION PREPARATION                                          │
│  ├─ Day 1-5: Security audit                                                 │
│  ├─ Day 6-8: Load testing                                                   │
│  ├─ Day 9-11: DR testing                                                    │
│  └─ Day 12-14: Runbook documentation                                        │
│                                                                              │
│  Week 13: PRODUCTION CUTOVER                                                 │
│  ├─ Day 1-2: Final sync and validation                                      │
│  ├─ Day 3: DNS cutover (low-traffic window)                                 │
│  ├─ Day 4-5: Monitoring and stabilization                                   │
│  └─ Day 6-7: Decommission old infrastructure                                │
│                                                                              │
│  Week 14: OPTIMIZATION                                                       │
│  ├─ Day 1-3: Cost optimization                                              │
│  ├─ Day 4-5: Performance tuning                                             │
│  └─ Day 6-7: Documentation and training                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Risk Assessment

### Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Data loss during migration** | Low | Critical | Continuous replication, validation scripts |
| **Extended downtime** | Medium | High | Blue-green deployment, quick rollback |
| **Performance degradation** | Medium | Medium | Load testing, right-sizing |
| **Security vulnerabilities** | Low | Critical | Security audit, WAF rules |
| **Cost overrun** | Medium | Medium | Budget alerts, reserved capacity |
| **Skill gaps** | Medium | Medium | Training, documentation |
| **Vendor lock-in** | Low | Medium | Cloud-agnostic where possible |

### Risk Mitigation Checklist

- [ ] Backup all data before migration
- [ ] Test rollback procedures
- [ ] Document all configuration
- [ ] Train operations team
- [ ] Set up monitoring before cutover
- [ ] Plan for off-hours cutover
- [ ] Have vendor support on standby
- [ ] Communicate with stakeholders

---

## Rollback Strategy

### Rollback Triggers

| Condition | Action |
|-----------|--------|
| Error rate > 5% for 10 minutes | Automatic rollback |
| P99 latency > 5s for 5 minutes | Alert + manual decision |
| Database connectivity issues | Immediate rollback |
| Security incident detected | Immediate rollback |

### Rollback Procedure

```bash
#!/bin/bash
# scripts/rollback.sh

echo "=== INITIATING ROLLBACK ==="

# 1. Switch DNS back to original infrastructure
echo "Step 1: Switching DNS..."
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://dns-rollback.json

# 2. Scale down cloud infrastructure
echo "Step 2: Scaling down cloud..."
kubectl scale deployment --all --replicas=0 -n production

# 3. Verify original services
echo "Step 3: Verifying original services..."
curl -sf https://contigo-original.example.com/api/health

# 4. Document incident
echo "Step 4: Creating incident report..."
cat > incident-report.md << EOF
# Rollback Incident Report
Date: $(date)
Reason: [TO BE FILLED]
Duration: [TO BE FILLED]
Impact: [TO BE FILLED]
Root Cause: [TO BE FILLED]
Action Items: [TO BE FILLED]
EOF

echo "=== ROLLBACK COMPLETE ==="
echo "Please complete the incident report at incident-report.md"
```

---

## Appendix

### A. Environment Variables

```bash
# Production Environment Variables
DATABASE_URL=postgresql://user:pass@contigo-aurora.cluster-xxx.us-east-1.rds.amazonaws.com:5432/contigo
REDIS_URL=rediss://contigo-redis.xxx.cache.amazonaws.com:6379
S3_BUCKET=contigo-documents-123456789
S3_REGION=us-east-1
NEXTAUTH_URL=https://contigo.example.com
NEXTAUTH_SECRET=<secret>
OPENAI_API_KEY=<key>
```

### B. Useful Commands

```bash
# Check cluster status
kubectl get nodes
kubectl get pods -n production

# View logs
kubectl logs -f deployment/contigo-web -n production

# Scale deployment
kubectl scale deployment contigo-web --replicas=5 -n production

# Database connection
kubectl exec -it deployment/contigo-web -n production -- psql $DATABASE_URL
```

### C. Contact & Escalation

| Role | Contact | Escalation Time |
|------|---------|-----------------|
| **On-call Engineer** | PagerDuty | Immediate |
| **Platform Lead** | <platform-lead@example.com> | 15 minutes |
| **CTO** | <cto@example.com> | 30 minutes |
| **AWS Support** | Enterprise Support | As needed |

---

<div align="center">

**ConTigo Platform** - Cloud Migration Technical Approach

Document maintained by Platform Engineering Team

</div>

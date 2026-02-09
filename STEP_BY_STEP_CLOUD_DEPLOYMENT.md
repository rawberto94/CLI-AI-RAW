# Step-by-Step Cloud Deployment Guide 🚀

> **DEPRECATED:** See [docs/TECHNICAL_DOCUMENTATION.md](docs/TECHNICAL_DOCUMENTATION.md) §14 (Deployment) for current deployment documentation. Retained for historical reference only.

---

## Complete Beginner's Guide to Deploying ConTigo to the Cloud

---

## Table of Contents

1. [Understanding Cloud Deployment](#1-understanding-cloud-deployment)
2. [Do I Need Virtual Machines?](#2-do-i-need-virtual-machines)
3. [Choosing Your Deployment Path](#3-choosing-your-deployment-path)
4. [Prerequisites Checklist](#4-prerequisites-checklist)
5. [Option A: Single VM Deployment (Simplest)](#5-option-a-single-vm-deployment)
6. [Option B: Container-Based Deployment (Recommended)](#6-option-b-container-based-deployment)
7. [Option C: Managed Services (Production)](#7-option-c-managed-services)
8. [Step-by-Step Azure Deployment](#8-step-by-step-azure-deployment)
9. [Step-by-Step AWS Deployment](#9-step-by-step-aws-deployment)
10. [Step-by-Step Google Cloud Deployment](#10-step-by-step-google-cloud-deployment)
11. [Post-Deployment Checklist](#11-post-deployment-checklist)
12. [Cost Estimation](#12-cost-estimation)
13. [Troubleshooting Guide](#13-troubleshooting-guide)

---

## 1. Understanding Cloud Deployment

### What Does "Cloud Deployment" Mean?

Cloud deployment means running your application on servers managed by cloud providers (like Azure, AWS, or Google Cloud) instead of on your local computer. This allows:

- ✅ **24/7 Availability** - Your app runs all the time
- ✅ **Scalability** - Handle more users as needed
- ✅ **Reliability** - Automatic backups and redundancy
- ✅ **Security** - Enterprise-grade security features
- ✅ **Global Access** - Users can access from anywhere

### Your Application Architecture

ConTigo consists of these components that need to be deployed:

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR APPLICATION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Next.js    │  │  Background  │  │     WebSocket        │   │
│  │  Web App     │  │   Workers    │  │      Server          │   │
│  │  (Port 3000) │  │  (Agents)    │  │    (Port 3001)       │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│         │                 │                    │                  │
│         └─────────────────┼────────────────────┘                  │
│                           │                                       │
│  ┌────────────────────────┴────────────────────────┐             │
│  │                    Shared Services               │             │
│  ├─────────────────┬──────────────────────────────┤             │
│  │   PostgreSQL    │          Redis               │             │
│  │   Database      │          Cache               │             │
│  │   (pgvector)    │         & Queues             │             │
│  └─────────────────┴──────────────────────────────┘             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Do I Need Virtual Machines?

### Short Answer: **Not Necessarily!**

There are THREE main approaches to cloud deployment:

| Approach | Complexity | Cost | Best For |
|----------|------------|------|----------|
| **Virtual Machines (VMs)** | Medium | 💰💰 | Traditional deployments, full control |
| **Containers (Docker)** | Medium | 💰💰 | Consistent environments, easy scaling |
| **Managed Services (PaaS)** | Low | 💰💰💰 | Fastest deployment, least maintenance |

### Understanding Your Options

#### 🖥️ **Option 1: Virtual Machines (IaaS)**
You rent a computer in the cloud and manage everything yourself.

```
┌─────────────────────────────────────────────┐
│              Virtual Machine                 │
│  ┌─────────────────────────────────────┐    │
│  │  Operating System (Linux/Windows)   │    │
│  │  ┌──────────────────────────────┐   │    │
│  │  │  Your App + Dependencies     │   │    │
│  │  │  • Node.js                   │   │    │
│  │  │  • PostgreSQL                │   │    │
│  │  │  • Redis                     │   │    │
│  │  │  • ConTigo                   │   │    │
│  │  └──────────────────────────────┘   │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  YOU MANAGE: OS, security, updates, app     │
└─────────────────────────────────────────────┘
```

**Pros:**
- Full control over everything
- Can customize anything
- Similar to your local setup

**Cons:**
- You manage OS updates, security patches
- More complex setup
- Scaling requires manual configuration

---

#### 🐳 **Option 2: Containers (Recommended)**
Package your app in Docker containers and run them on managed container services.

```
┌─────────────────────────────────────────────────────────────┐
│                  Container Platform (AKS/ECS)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Container   │  │  Container   │  │    Container     │   │
│  │  ┌────────┐  │  │  ┌────────┐  │  │  ┌────────────┐  │   │
│  │  │Web App │  │  │  │Workers │  │  │  │ WebSocket  │  │   │
│  │  └────────┘  │  │  └────────┘  │  │  └────────────┘  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│                                                              │
│  PLATFORM MANAGES: Scaling, restarts, load balancing        │
│  YOU MANAGE: Container images, configuration                 │
└─────────────────────────────────────────────────────────────┘
```

**Pros:**
- Consistent across environments
- Easy scaling
- Less infrastructure management

**Cons:**
- Need to learn Docker basics
- Container registry required

---

#### ☁️ **Option 3: Managed Services (PaaS)**
Let the cloud provider handle almost everything.

```
┌─────────────────────────────────────────────────────────────┐
│                   Managed Services                           │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Azure App    │  │ Managed      │  │  Managed         │   │
│  │ Service      │  │ PostgreSQL   │  │  Redis           │   │
│  │              │  │              │  │                  │   │
│  │ Upload code →│  │ Just works → │  │  Just works →    │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│                                                              │
│  PROVIDER MANAGES: Everything except your code               │
│  YOU MANAGE: Application code, configuration                 │
└─────────────────────────────────────────────────────────────┘
```

**Pros:**
- Fastest deployment
- Automatic updates and patches
- Built-in monitoring

**Cons:**
- Less control
- Can be more expensive
- Potential vendor lock-in

---

## 3. Choosing Your Deployment Path

### Decision Flowchart

```
                            START
                              │
                              ▼
              ┌───────────────────────────────┐
              │  What's your team's          │
              │  technical experience?        │
              └───────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
      ┌───────────┐    ┌───────────┐    ┌───────────┐
      │ Beginner  │    │Intermediate│   │ Advanced  │
      │ (Dev only)│    │ (DevOps)  │    │ (Platform)│
      └───────────┘    └───────────┘    └───────────┘
            │                 │                 │
            ▼                 ▼                 ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ Single VM +  │  │ Container    │  │ Kubernetes   │
    │ Docker Comp. │  │ Services     │  │ (AKS/EKS)    │
    │              │  │ (ECS/ACI)    │  │              │
    │ EASIEST      │  │ BALANCED     │  │ SCALABLE     │
    └──────────────┘  └──────────────┘  └──────────────┘
```

### My Recommendation

| Scenario | Recommended Approach |
|----------|---------------------|
| **Testing/Development** | Single VM with Docker Compose |
| **Small business (<50 users)** | Single VM or Azure Container Apps |
| **Medium business (50-500 users)** | Container services (ECS/ACI) |
| **Enterprise (500+ users)** | Kubernetes (AKS/EKS/GKE) |

---

## 4. Prerequisites Checklist

Before you start, ensure you have:

### ✅ Accounts & Access
- [ ] Cloud provider account (Azure/AWS/GCP)
- [ ] Credit card linked (for billing)
- [ ] Domain name (e.g., `yourcompany.com`)
- [ ] OpenAI API key (for AI features)

### ✅ Local Setup
- [ ] Git installed
- [ ] Docker Desktop installed (for building images)
- [ ] Cloud CLI installed (Azure CLI, AWS CLI, or gcloud)

### ✅ Project Ready
- [ ] Code pushed to Git repository
- [ ] `.env.example` file configured
- [ ] All tests passing locally

### Install Cloud CLI Tools

```bash
# For Azure
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
az login

# For AWS
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
aws configure

# For Google Cloud
curl https://sdk.cloud.google.com | bash
gcloud init
```

---

## 5. Option A: Single VM Deployment

**Best for:** Testing, small teams, limited budget

### Step 1: Create a Virtual Machine

#### On Azure:
```bash
# Login to Azure
az login

# Create a resource group
az group create --name contigo-rg --location eastus

# Create the VM (Ubuntu 22.04, 4 cores, 16GB RAM)
az vm create \
  --resource-group contigo-rg \
  --name contigo-vm \
  --image Ubuntu2204 \
  --size Standard_D4s_v3 \
  --admin-username azureuser \
  --generate-ssh-keys \
  --public-ip-sku Standard

# Open required ports
az vm open-port --resource-group contigo-rg --name contigo-vm --port 80
az vm open-port --resource-group contigo-rg --name contigo-vm --port 443
az vm open-port --resource-group contigo-rg --name contigo-vm --port 3000

# Get the public IP
az vm show -d -g contigo-rg -n contigo-vm --query publicIps -o tsv
```

#### On AWS:
```bash
# Create a key pair
aws ec2 create-key-pair --key-name contigo-key --query 'KeyMaterial' --output text > contigo-key.pem
chmod 400 contigo-key.pem

# Create the instance (Ubuntu 22.04, t3.xlarge = 4 cores, 16GB)
aws ec2 run-instances \
  --image-id ami-0c7217cdde317cfec \
  --instance-type t3.xlarge \
  --key-name contigo-key \
  --security-group-ids sg-xxx \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=contigo-vm}]'

# Get instance details
aws ec2 describe-instances --filters "Name=tag:Name,Values=contigo-vm"
```

### Step 2: Connect to Your VM

```bash
# For Azure
ssh azureuser@<VM_PUBLIC_IP>

# For AWS
ssh -i contigo-key.pem ubuntu@<VM_PUBLIC_IP>
```

### Step 3: Install Docker on the VM

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again for group changes
exit
ssh azureuser@<VM_PUBLIC_IP>

# Verify installation
docker --version
docker-compose --version
```

### Step 4: Clone and Configure Your App

```bash
# Clone your repository
git clone https://github.com/YOUR_USERNAME/CLI-AI-RAW.git
cd CLI-AI-RAW

# Create environment file
cp .env.example .env

# Edit environment variables
nano .env
```

### Step 5: Configure Environment Variables

Edit the `.env` file with production values:

```bash
# Database (will use Docker PostgreSQL)
DATABASE_URL=postgresql://postgres:STRONG_PASSWORD_HERE@postgres:5432/contigo

# Redis (will use Docker Redis)
REDIS_URL=redis://redis:6379

# Security - GENERATE NEW SECRETS!
JWT_SECRET=$(openssl rand -hex 64)
SESSION_SECRET=$(openssl rand -hex 64)
NEXTAUTH_SECRET=$(openssl rand -hex 64)

# Your domain
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_WS_URL=wss://yourdomain.com/ws

# OpenAI (for AI features)
OPENAI_API_KEY=sk-your-openai-key
```

### Step 6: Deploy with Docker Compose

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d --build

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 7: Setup SSL Certificate

```bash
# Install Certbot
sudo apt install certbot -y

# Get SSL certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Setup auto-renewal
sudo crontab -e
# Add: 0 0 * * * certbot renew --quiet
```

### Step 8: Point Your Domain

1. Go to your domain registrar (e.g., GoDaddy, Namecheap, Cloudflare)
2. Add an A record:
   - **Name:** `@` (or leave blank)
   - **Type:** `A`
   - **Value:** Your VM's public IP address
   - **TTL:** 3600

---

## 6. Option B: Container-Based Deployment

**Best for:** Production workloads, need for scaling

### Step 1: Build Docker Images

```bash
# Build production images locally
docker build -t contigo-web:latest .
docker build -t contigo-workers:latest -f Dockerfile.workers .
docker build -t contigo-websocket:latest -f Dockerfile.websocket .
```

### Step 2: Push to Container Registry

#### Azure Container Registry:
```bash
# Create Azure Container Registry
az acr create --resource-group contigo-rg --name contigoacr --sku Basic

# Login to ACR
az acr login --name contigoacr

# Tag and push images
docker tag contigo-web:latest contigoacr.azurecr.io/contigo-web:latest
docker tag contigo-workers:latest contigoacr.azurecr.io/contigo-workers:latest
docker tag contigo-websocket:latest contigoacr.azurecr.io/contigo-websocket:latest

docker push contigoacr.azurecr.io/contigo-web:latest
docker push contigoacr.azurecr.io/contigo-workers:latest
docker push contigoacr.azurecr.io/contigo-websocket:latest
```

#### AWS ECR:
```bash
# Create ECR repository
aws ecr create-repository --repository-name contigo-web
aws ecr create-repository --repository-name contigo-workers

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag contigo-web:latest <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/contigo-web:latest
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/contigo-web:latest
```

### Step 3: Deploy Container Service

See sections 8-10 for cloud-specific instructions.

---

## 7. Option C: Managed Services (Production)

**Best for:** Enterprise deployments, minimal maintenance

This option uses fully managed services:

| Component | Azure | AWS | GCP |
|-----------|-------|-----|-----|
| Web App | Azure App Service | Elastic Beanstalk | Cloud Run |
| Database | Azure PostgreSQL | RDS PostgreSQL | Cloud SQL |
| Cache | Azure Redis | ElastiCache | Memorystore |
| Storage | Azure Blob | S3 | Cloud Storage |
| Queue | Azure Service Bus | SQS | Cloud Tasks |

See sections 8-10 for detailed setup.

---

## 8. Step-by-Step Azure Deployment

### Complete Azure Deployment (30-45 minutes)

#### Step 1: Initial Setup (5 minutes)

```bash
# Login to Azure
az login

# Set your subscription
az account set --subscription "Your Subscription Name"

# Create resource group
az group create --name contigo-prod-rg --location westeurope
```

#### Step 2: Create Database (10 minutes)

```bash
# Create PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group contigo-prod-rg \
  --name contigo-db-prod \
  --location westeurope \
  --admin-user contigoadmin \
  --admin-password 'YourStrongPassword123!' \
  --sku-name Standard_B2s \
  --tier Burstable \
  --storage-size 32 \
  --version 15 \
  --yes

# Enable pgvector extension
az postgres flexible-server parameter set \
  --resource-group contigo-prod-rg \
  --server-name contigo-db-prod \
  --name azure.extensions \
  --value vector

# Create database
az postgres flexible-server db create \
  --resource-group contigo-prod-rg \
  --server-name contigo-db-prod \
  --database-name contigo

# Get connection string
echo "DATABASE_URL=postgresql://contigoadmin:YourStrongPassword123!@contigo-db-prod.postgres.database.azure.com:5432/contigo?sslmode=require"
```

#### Step 3: Create Redis Cache (5 minutes)

```bash
# Create Redis
az redis create \
  --resource-group contigo-prod-rg \
  --name contigo-redis-prod \
  --location westeurope \
  --sku Basic \
  --vm-size C1

# Get access keys
az redis list-keys --resource-group contigo-prod-rg --name contigo-redis-prod
```

#### Step 4: Create Container Registry (5 minutes)

```bash
# Create ACR
az acr create \
  --resource-group contigo-prod-rg \
  --name contigoacrprod \
  --sku Basic

# Enable admin
az acr update --name contigoacrprod --admin-enabled true

# Get credentials
az acr credential show --name contigoacrprod
```

#### Step 5: Push Docker Images (10 minutes)

```bash
# Login to ACR
az acr login --name contigoacrprod

# Build and push (from your local machine)
cd /workspaces/CLI-AI-RAW

# Build images
docker build -t contigoacrprod.azurecr.io/web:v1 .
docker build -t contigoacrprod.azurecr.io/workers:v1 -f Dockerfile.workers .

# Push images
docker push contigoacrprod.azurecr.io/web:v1
docker push contigoacrprod.azurecr.io/workers:v1
```

#### Step 6: Deploy to Azure Container Apps (10 minutes)

```bash
# Create Container Apps Environment
az containerapp env create \
  --resource-group contigo-prod-rg \
  --name contigo-env-prod \
  --location westeurope

# Deploy the web app
az containerapp create \
  --resource-group contigo-prod-rg \
  --name contigo-web \
  --environment contigo-env-prod \
  --image contigoacrprod.azurecr.io/web:v1 \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 5 \
  --registry-server contigoacrprod.azurecr.io \
  --env-vars \
    DATABASE_URL=secretref:db-url \
    REDIS_URL=secretref:redis-url \
    NEXTAUTH_SECRET=secretref:auth-secret \
    NODE_ENV=production

# Get the URL
az containerapp show \
  --resource-group contigo-prod-rg \
  --name contigo-web \
  --query properties.configuration.ingress.fqdn -o tsv
```

#### Step 7: Configure Custom Domain (Optional)

```bash
# Add custom domain
az containerapp hostname add \
  --resource-group contigo-prod-rg \
  --name contigo-web \
  --hostname yourdomain.com

# Bind SSL certificate
az containerapp hostname bind \
  --resource-group contigo-prod-rg \
  --name contigo-web \
  --hostname yourdomain.com \
  --environment contigo-env-prod \
  --validation-method CNAME
```

---

## 9. Step-by-Step AWS Deployment

### Complete AWS Deployment (45-60 minutes)

#### Step 1: Initial Setup

```bash
# Configure AWS CLI
aws configure
# Enter: Access Key, Secret Key, Region (us-east-1), Output (json)

# Create VPC (or use default)
aws ec2 describe-vpcs --filters "Name=is-default,Values=true"
```

#### Step 2: Create RDS PostgreSQL

```bash
# Create subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name contigo-db-subnet \
  --db-subnet-group-description "Contigo DB subnet" \
  --subnet-ids subnet-xxx subnet-yyy

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier contigo-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.4 \
  --master-username contigo \
  --master-user-password YourStrongPassword123 \
  --allocated-storage 50 \
  --db-name contigo \
  --publicly-accessible \
  --backup-retention-period 7

# Wait for database to be available
aws rds wait db-instance-available --db-instance-identifier contigo-db

# Get endpoint
aws rds describe-db-instances \
  --db-instance-identifier contigo-db \
  --query 'DBInstances[0].Endpoint.Address' -o text
```

#### Step 3: Create ElastiCache Redis

```bash
# Create cache cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id contigo-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1

# Get endpoint
aws elasticache describe-cache-clusters \
  --cache-cluster-id contigo-redis \
  --show-cache-node-info
```

#### Step 4: Create ECR and Push Images

```bash
# Create repository
aws ecr create-repository --repository-name contigo-web

# Get login credentials
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com

# Build and push
docker build -t contigo-web .
docker tag contigo-web:latest \
  $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com/contigo-web:latest
docker push \
  $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com/contigo-web:latest
```

#### Step 5: Deploy with ECS Fargate

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name contigo-cluster

# Register task definition (create task-definition.json first)
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster contigo-cluster \
  --service-name contigo-web \
  --task-definition contigo-web:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

---

## 10. Step-by-Step Google Cloud Deployment

### Complete GCP Deployment (30-45 minutes)

#### Step 1: Initial Setup

```bash
# Login to GCP
gcloud auth login

# Create project
gcloud projects create contigo-prod --name="ConTigo Production"
gcloud config set project contigo-prod

# Enable required APIs
gcloud services enable \
  cloudsql.googleapis.com \
  run.googleapis.com \
  redis.googleapis.com \
  artifactregistry.googleapis.com
```

#### Step 2: Create Cloud SQL PostgreSQL

```bash
# Create instance
gcloud sql instances create contigo-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-4096 \
  --region=europe-west1 \
  --storage-size=50GB \
  --storage-auto-increase

# Set password
gcloud sql users set-password postgres \
  --instance=contigo-db \
  --password=YourStrongPassword123

# Create database
gcloud sql databases create contigo --instance=contigo-db
```

#### Step 3: Create Memorystore Redis

```bash
gcloud redis instances create contigo-redis \
  --size=1 \
  --region=europe-west1 \
  --redis-version=redis_7_0
```

#### Step 4: Deploy to Cloud Run

```bash
# Build with Cloud Build
gcloud builds submit --tag gcr.io/contigo-prod/web

# Deploy
gcloud run deploy contigo-web \
  --image gcr.io/contigo-prod/web \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --add-cloudsql-instances contigo-prod:europe-west1:contigo-db \
  --set-env-vars "DATABASE_URL=postgresql://postgres:YourPassword@/contigo?host=/cloudsql/contigo-prod:europe-west1:contigo-db"
```

---

## 11. Post-Deployment Checklist

### ✅ Verification Steps

```bash
# 1. Check application health
curl https://yourdomain.com/api/health

# 2. Verify database connection
# In your app, run migrations
npx prisma migrate deploy

# 3. Test authentication
# Try logging in through the UI

# 4. Check background workers
# View worker logs

# 5. Test file upload
# Upload a contract document

# 6. Verify WebSocket connection
# Check real-time notifications
```

### ✅ Security Checklist

- [ ] All secrets stored in Key Vault/Secrets Manager
- [ ] HTTPS enabled with valid certificate
- [ ] Database not publicly accessible
- [ ] Strong passwords (16+ characters)
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Content Security Policy headers

### ✅ Monitoring Setup

```bash
# Azure: Enable Application Insights
az monitor app-insights component create \
  --app contigo-insights \
  --location westeurope \
  --resource-group contigo-prod-rg

# AWS: Enable CloudWatch
# (Automatically enabled with ECS)

# GCP: Enable Cloud Monitoring
gcloud services enable monitoring.googleapis.com
```

---

## 12. Cost Estimation

### Monthly Cost Breakdown (Approximate)

| Service | Azure | AWS | GCP |
|---------|-------|-----|-----|
| Web App (2 instances) | $60-120 | $70-140 | $50-100 |
| PostgreSQL (Basic) | $25-50 | $30-60 | $25-50 |
| Redis (Basic) | $20-40 | $15-30 | $25-40 |
| Storage (50GB) | $5-10 | $5-10 | $5-10 |
| **Total/Month** | **$110-220** | **$120-240** | **$105-200** |

### Cost Saving Tips

1. **Use Reserved Instances** - Save 30-70% with 1-3 year commitments
2. **Right-size Resources** - Start small, scale as needed
3. **Use Spot/Preemptible** - For non-critical workers
4. **Enable Auto-scaling** - Only pay for what you use
5. **Use Free Tiers** - Azure/AWS/GCP offer free credits

---

## 13. Troubleshooting Guide

### Common Issues

#### ❌ Application Won't Start

```bash
# Check logs
docker-compose logs -f web

# Common causes:
# - Missing environment variables
# - Database connection failed
# - Port already in use

# Fix: Verify .env file and database connectivity
```

#### ❌ Database Connection Failed

```bash
# Test connection
psql "postgresql://user:pass@host:5432/dbname?sslmode=require"

# Common causes:
# - Wrong credentials
# - Firewall blocking connection
# - SSL mode mismatch

# Fix: Check firewall rules, verify credentials
```

#### ❌ Redis Connection Failed

```bash
# Test connection
redis-cli -h hostname -p 6379 ping

# Common causes:
# - Wrong host/port
# - Authentication required

# Fix: Check REDIS_URL format
```

#### ❌ Build Out of Memory

```bash
# Increase Node memory
export NODE_OPTIONS="--max-old-space-size=8192"

# Or use cloud build with more resources
```

### Getting Help

1. **Check Logs** - Always start here
2. **Review Documentation** - See other .md files in this repo
3. **Search Issues** - Check GitHub issues
4. **Ask Community** - Stack Overflow, Discord

---

## Quick Reference Commands

```bash
# === AZURE ===
az login                          # Login
az group list                     # List resource groups
az containerapp list              # List container apps
az monitor activity-log list      # View activity logs

# === AWS ===
aws sts get-caller-identity       # Verify login
aws ecs list-clusters             # List ECS clusters
aws logs describe-log-groups      # View log groups
aws rds describe-db-instances     # List databases

# === GCP ===
gcloud auth list                  # Check auth
gcloud run services list          # List Cloud Run services
gcloud sql instances list         # List databases
gcloud logging read               # View logs

# === DOCKER ===
docker ps                         # Running containers
docker-compose ps                 # Compose services status
docker logs -f <container>        # Follow container logs
docker exec -it <container> bash  # Shell into container
```

---

## Summary: Your Path to Cloud

1. **Choose your approach** based on team skill and scale needs
2. **Set up infrastructure** using the step-by-step guides
3. **Deploy your application** with Docker or managed services
4. **Configure monitoring** and alerts
5. **Go live** with confidence!

**Need more help?** Check the other documentation files:
- [CLOUD_DEPLOYMENT_GUIDE.md](./CLOUD_DEPLOYMENT_GUIDE.md) - Detailed infrastructure code
- [AZURE_DEPLOYMENT_CHECKLIST.md](./AZURE_DEPLOYMENT_CHECKLIST.md) - Azure-specific checklist
- [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) - Production best practices
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Pre-deployment verification

---

**Last Updated:** January 2025  
**Author:** ConTigo Platform Team

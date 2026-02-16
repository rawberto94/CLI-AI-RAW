# ConTigo - Scaling Up Guide

> **DEPRECATED:** Superseded by [docs/ROADMAP_SCALING.md](docs/ROADMAP_SCALING.md). Retained for historical reference only.

---

## Why No VMs or Kubernetes for Pilot?

### The Short Answer

**Azure Container Apps = Serverless containers that auto-scale.**

You get the benefits of containers without managing infrastructure.

| Approach              | You Manage                          | Cost (Pilot) | Complexity |
| --------------------- | ----------------------------------- | ------------ | ---------- |
| **VMs**               | OS, patches, scaling, load balancer | ~$100-200/mo | High       |
| **Kubernetes (AKS)**  | Cluster, nodes, networking, ingress | ~$150-300/mo | Very High  |
| **Container Apps** ✅ | Just your app                       | ~$75-85/mo   | Low        |

### What Container Apps Handles For You

```
Traditional (VMs/K8s)          Container Apps
─────────────────────          ──────────────
✗ Provision VMs                ✓ Automatic
✗ Install Docker               ✓ Automatic
✗ Configure networking         ✓ Automatic
✗ Set up load balancer         ✓ Automatic
✗ Manage SSL certificates      ✓ Automatic
✗ Handle auto-scaling          ✓ Automatic
✗ Apply security patches       ✓ Automatic
```

### When to Upgrade

| Stage          | Users | Recommended             | Monthly Cost |
| -------------- | ----- | ----------------------- | ------------ |
| **Pilot**      | 1-5   | Container Apps          | ~$75-85      |
| **Growing**    | 5-20  | Container Apps (scaled) | ~$150-200    |
| **Enterprise** | 50+   | Consider AKS            | ~$500-1000   |

---

## Can I Migrate Later? Yes!

The migration path is straightforward because **your app is already containerized**.

### From Container Apps → Kubernetes (AKS)

```
Same Docker image
     ↓
Container Apps  ───→  AKS
     ↓                 ↓
Same database         Same database
Same Redis            Same Redis
Same storage          Same storage
```

**What changes:**

- Deployment config (Bicep → Helm/K8s manifests)
- ~1-2 days of work

**What stays the same:**

- Your application code
- Docker image
- Database
- All integrations

### Migration Checklist

When you're ready to move to Kubernetes:

1. [ ] Create AKS cluster
2. [ ] Deploy same Docker image
3. [ ] Point to same PostgreSQL/Redis
4. [ ] Update DNS
5. [ ] Done!

---

## Why Start with Container Apps?

### 1. Cost Efficiency

```
Pilot with AKS:     ~$200-300/month (min 2 nodes)
Pilot with CA:      ~$75-85/month   (pay per use)
                    ─────────────────
Savings:            ~$125-215/month
```

### 2. Operational Simplicity

- No cluster management
- No node patching
- No ingress controller setup
- No certificate management

### 3. Same Capabilities for Pilot

- ✅ Custom domains
- ✅ HTTPS/SSL
- ✅ Auto-scaling (0-10 replicas)
- ✅ Environment variables & secrets
- ✅ Health checks
- ✅ Logging & monitoring

### 4. Zero Lock-in

Your app is a standard Docker container. It runs anywhere:

- Azure Container Apps ✅ (current)
- Azure Kubernetes Service
- AWS ECS/EKS
- Google Cloud Run
- Any Docker host

---

## Scaling Roadmap

### Phase 1: Pilot (Now)

```
┌─────────────────────────────────┐
│     Azure Container Apps        │
│  ┌───────────┐                  │
│  │  ConTigo  │  1 vCPU, 2GB     │
│  │    Web    │  1-2 replicas    │
│  └───────────┘                  │
└─────────────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
PostgreSQL   Redis
  B1ms       Basic
```

**Cost: ~$75-85/month**

### Phase 2: Growing (5-20 clients)

```
┌─────────────────────────────────┐
│     Azure Container Apps        │
│  ┌───────────┐                  │
│  │  ConTigo  │  2 vCPU, 4GB     │
│  │    Web    │  2-5 replicas    │
│  └───────────┘                  │
└─────────────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
PostgreSQL   Redis
  D2s_v3     Standard
```

**Cost: ~$150-200/month**

### Phase 3: Enterprise (50+ clients)

```
┌─────────────────────────────────────────┐
│        Azure Kubernetes Service         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
│  │   Web   │  │   Web   │  │ Workers │  │
│  │ Pod x3  │  │ Pod x3  │  │ Pod x2  │  │
│  └─────────┘  └─────────┘  └─────────┘  │
│            Load Balancer                │
└─────────────────────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
PostgreSQL   Redis
  HA Mode    Premium
```

**Cost: ~$500-1000/month**

---

## Quick Commands for Scaling

### Scale Up Container Apps (No Migration Needed)

```bash
# Double resources
az containerapp update \
  --name ca-contigo-web \
  --resource-group rg-contigo-pilot \
  --cpu 2 \
  --memory 4Gi

# Add more replicas
az containerapp update \
  --name ca-contigo-web \
  --resource-group rg-contigo-pilot \
  --min-replicas 2 \
  --max-replicas 10
```

### Upgrade Database

```bash
# From B1ms to D2s_v3
az postgres flexible-server update \
  --resource-group rg-contigo-pilot \
  --name YOUR-POSTGRES-NAME \
  --sku-name Standard_D2s_v3
```

---

## Summary

| Question              | Answer                                          |
| --------------------- | ----------------------------------------------- |
| Do I need VMs?        | **No** - Container Apps manages compute         |
| Do I need Kubernetes? | **Not yet** - Overkill for pilot                |
| Can I migrate later?  | **Yes** - Same Docker image works everywhere    |
| When to migrate?      | **50+ clients** or complex microservices needs  |
| Is there lock-in?     | **No** - Standard containers, standard Postgres |

**Start simple. Scale when needed. Don't over-engineer.**

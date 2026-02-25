# ConTigo - Technology Onboarding Guide

> **DEPRECATED:** Superseded by [docs/USER_ONBOARDING.md](docs/USER_ONBOARDING.md) and [docs/TECHNICAL_DOCUMENTATION.md](docs/TECHNICAL_DOCUMENTATION.md). Retained for historical reference only.

> **For:** Roberto (Founder)  
> **Goal:** Understand the tech and launch your pilot  
> **Reading time:** 10 minutes

---

## Part 1: Explain It Like I'm 5

### What is ConTigo?

```
📄 Client has contracts (PDFs, Word docs)
        ↓
   They upload to ConTigo
        ↓
🤖 AI reads and extracts important stuff
   (dates, amounts, parties, obligations)
        ↓
📊 Client sees organized dashboard
   (search, filter, get alerts)
```

**You built a robot that reads contracts so humans don't have to.**

---

### Where Does It Run?

Think of it like renting an apartment vs building a house:

```
🏗️ Building a house (VMs/Kubernetes)
   - You buy land
   - You build foundation
   - You install plumbing
   - You maintain everything
   - Expensive, complicated

🏢 Renting an apartment (Container Apps) ← YOU'RE DOING THIS
   - Someone else built the building
   - You just move in your furniture (your app)
   - They handle maintenance
   - You pay monthly rent
   - Simple, affordable
```

**Your app is the furniture. Azure is the apartment building.**

---

### How Do Clients Use It?

```
1. Client opens browser
2. Types: app.contigo.ch (or Azure URL)
3. Internet magic happens:

   Browser → Internet → Azure Building → Your Apartment → Your App

4. Your app responds with the website
5. Client sees login page
```

**It's like calling a pizza place:**

- You dial the number (URL)
- Phone company connects you (Internet/DNS)
- Pizza place answers (Your app)
- You order pizza (Upload contract)
- They deliver (AI extracts data)

---

### What Are All These Services?

| Service            | Like...        | What It Does                    |
| ------------------ | -------------- | ------------------------------- |
| **Container Apps** | Apartment      | Runs your app                   |
| **PostgreSQL**     | Filing Cabinet | Stores all data                 |
| **Redis**          | Sticky Notes   | Remembers things quickly        |
| **Blob Storage**   | Storage Unit   | Keeps uploaded files            |
| **OpenAI**         | Smart Friend   | Reads and understands contracts |

```
┌─────────────────────────────────────────┐
│              Your App                    │
│                                          │
│   "Hey PostgreSQL, save this contract"   │
│   "Hey Redis, remember this user"        │
│   "Hey OpenAI, what does this say?"      │
│   "Hey Storage, keep this PDF"           │
│                                          │
└─────────────────────────────────────────┘
```

---

## Part 2: What You Have Now

### ✅ Already Done

| Component              | Status      | Description                      |
| ---------------------- | ----------- | -------------------------------- |
| **Application Code**   | ✅ Complete | Next.js app with all features    |
| **Docker Image**       | ✅ Ready    | App packaged and ready to deploy |
| **Database Schema**    | ✅ Complete | All tables and relations defined |
| **AI Integration**     | ✅ Working  | OpenAI extracts contract data    |
| **Deployment Scripts** | ✅ Ready    | One-click Azure deployment       |
| **Documentation**      | ✅ Complete | Guides for everything            |

### 📁 Your Key Files

```
CLI-AI-RAW/
├── apps/web/                    ← Your main app
├── infrastructure/azure/
│   ├── pilot-minimal.bicep      ← What to create in Azure
│   └── deploy-pilot.sh          ← Script that does everything
├── Dockerfile.production        ← How to package your app
├── DEPLOYMENT_GUIDE_COMPLETE.md ← Detailed instructions
├── SCALING_UP.md                ← When/how to grow
└── QUICK_START.md               ← Getting started
```

---

## Part 3: Your Next Steps

### Step 1: Get Your Accounts Ready (30 minutes)

| Account    | Action                  | Link                                                                 |
| ---------- | ----------------------- | -------------------------------------------------------------------- |
| **Azure**  | Sign up (free to start) | [portal.azure.com](https://portal.azure.com)                         |
| **OpenAI** | Get API key             | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **GitHub** | You already have this   | [github.com](https://github.com)                                     |

**After this step you'll have:**

- Azure account with payment method
- OpenAI API key (starts with `sk-`)
- GitHub account (already have: rawberto94)

---

### Step 2: Install Tools (15 minutes)

On your Mac/PC, install:

```bash
# Azure CLI - talks to Azure
brew install azure-cli        # Mac
# or download from https://aka.ms/installazurecliwindows  # Windows

# Docker - packages your app
# Download from https://www.docker.com/products/docker-desktop

# Verify they work
az --version
docker --version
```

**After this step you'll have:**

- `az` command working
- Docker Desktop running

---

### Step 3: Deploy to Azure (10 minutes)

```bash
# 1. Open terminal in your project folder
cd CLI-AI-RAW

# 2. Login to Azure (opens browser)
az login

# 3. Set your OpenAI key
export OPENAI_API_KEY="sk-your-key-here"

# 4. Run the magic script
cd infrastructure/azure
chmod +x deploy-pilot.sh
./deploy-pilot.sh
```

**What happens:**

```
Script runs...
├── Creates resource group in Azure
├── Creates PostgreSQL database
├── Creates Redis cache
├── Creates storage for files
├── Creates Container App
├── Connects everything together
└── Gives you a URL!

🎉 Done! Your app is live at:
   https://ca-contigo-web.switzerlandnorth.azurecontainerapps.io
```

---

### Step 4: Build and Push Your App (5 minutes)

```bash
# Go back to project root
cd ../..

# Build your app into a Docker image
./scripts/build-and-push.sh
```

**What happens:**

```
Script runs...
├── Packages your code into a container
├── Uploads it to GitHub's container registry
└── Azure pulls it and runs it

🎉 Your app is now running!
```

---

### Step 5: Set Up Database (2 minutes)

```bash
# The deploy script showed you a DATABASE_URL
# Copy it and run migrations

export DATABASE_URL="postgresql://contigoadmin:PASSWORD@HOST:5432/contigo?sslmode=require"
pnpm prisma migrate deploy
```

**What happens:**

```
Creates all the tables...
├── Users
├── Contracts
├── Tenants
├── Workflows
└── etc.

🎉 Database is ready!
```

---

### Step 6: Create Your Admin Account (2 minutes)

```bash
# Create the first user
pnpm cli user:create \
  --email roberto@contigo.ch \
  --password "YourSecurePassword123!" \
  --role ADMIN \
  --name "Roberto"
```

---

### Step 7: Test It! (5 minutes)

1. Open browser
2. Go to your URL (from deploy output)
3. Login with the admin account you created
4. Upload a test contract
5. Watch AI extract the data

**🎉 Congratulations! Your app is LIVE!**

---

## Part 4: After Launch Checklist

### Week 1: Stabilize

- [ ] Test all features with pilot client
- [ ] Monitor for errors (check logs)
- [ ] Collect feedback

```bash
# View logs
./scripts/view-logs.sh -f
```

### Week 2-4: Polish

- [ ] Fix any bugs found
- [ ] Add custom domain (optional)
- [ ] Set up email notifications (optional)

### Month 2+: Grow

- [ ] Onboard more clients
- [ ] Scale resources if needed
- [ ] Consider additional features

---

## Part 5: Common Questions

### "How much will it cost?"

```
Monthly costs:
├── Azure services:  ~$75-85/month
├── OpenAI API:      ~$5-20/month (depends on usage)
└── Domain (opt):    ~$1/month
                     ─────────────
Total:               ~$80-105/month
```

### "What if something breaks?"

```bash
# Check if app is running
curl https://YOUR-URL/api/health

# View logs
./scripts/view-logs.sh -f

# Restart app
az containerapp revision restart \
  --name ca-contigo-web \
  --resource-group rg-contigo-pilot
```

### "How do I update the app?"

```bash
# Make changes to code
# Then:
./scripts/build-and-push.sh
./scripts/update-app.sh
```

### "Can I stop it to save money?"

```bash
# Stop (saves ~$40/month)
./scripts/manage-resources.sh stop

# Start again
./scripts/manage-resources.sh start
```

### "What if I get lots of clients?"

```bash
# Scale up (takes 30 seconds)
az containerapp update \
  --name ca-contigo-web \
  --resource-group rg-contigo-pilot \
  --cpu 2 \
  --memory 4Gi \
  --max-replicas 5
```

---

## Part 6: Quick Reference Card

### Daily Commands

| Task         | Command                                |
| ------------ | -------------------------------------- |
| Check health | `curl https://YOUR-URL/api/health`     |
| View logs    | `./scripts/view-logs.sh -f`            |
| Check status | `./scripts/manage-resources.sh status` |

### Maintenance Commands

| Task              | Command                                                  |
| ----------------- | -------------------------------------------------------- |
| Update app        | `./scripts/build-and-push.sh && ./scripts/update-app.sh` |
| Backup database   | `./scripts/backup-database.sh`                           |
| Stop (save money) | `./scripts/manage-resources.sh stop`                     |
| Start             | `./scripts/manage-resources.sh start`                    |

### Emergency Commands

| Task         | Command                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------ |
| Restart app  | `az containerapp revision restart --name ca-contigo-web --resource-group rg-contigo-pilot` |
| Check errors | `./scripts/view-logs.sh --system`                                                          |

---

## Summary: Your Journey

```
TODAY
  │
  ├─→ Get accounts (Azure, OpenAI)
  │
  ├─→ Install tools (az, docker)
  │
  ├─→ Run deploy script
  │
  ├─→ Build and push image
  │
  ├─→ Create admin user
  │
  ▼
🎉 APP IS LIVE!
  │
  ├─→ Test with pilot client
  │
  ├─→ Collect feedback
  │
  ├─→ Iterate and improve
  │
  ▼
🚀 GROW YOUR BUSINESS
```

---

**You've got this! The hard part (building the app) is done. Now it's just following the steps
above.**

Questions? Check:

- [DEPLOYMENT_GUIDE_COMPLETE.md](DEPLOYMENT_GUIDE_COMPLETE.md) - Detailed deployment
- [SCALING_UP.md](SCALING_UP.md) - Growing your infrastructure
- [QUICK_START.md](QUICK_START.md) - Local development

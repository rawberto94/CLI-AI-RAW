# 🎨 Visual Quick Start Guide

## 🎯 Your Goal: Get Running in 3 Steps

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Step 1: Configure    Step 2: Setup    Step 3: Start     │
│      (2 min)             (3 min)          (1 min)          │
│                                                             │
│        ↓                    ↓                 ↓             │
│                                                             │
│   Update .env    →    .\run.ps1 setup  →  .\run.ps1 start │
│                                                             │
│                                                             │
│                    Total Time: 6 minutes                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Step 1: Configure .env (2 minutes)

### What to Update

```
┌──────────────────────────────────────────────────────────┐
│  .env File                                               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ❌ OPENAI_API_KEY=sk-your-openai-api-key-here         │
│     ↓                                                    │
│  ✅ OPENAI_API_KEY=sk-abc123...xyz789                   │
│                                                          │
│  ❌ JWT_SECRET=your-jwt-secret-here                     │
│     ↓                                                    │
│  ✅ JWT_SECRET=dGhpc2lzYXNlY3JldGtleQ==                 │
│                                                          │
│  ❌ SESSION_SECRET=your-session-secret-here             │
│     ↓                                                    │
│  ✅ SESSION_SECRET=YW5vdGhlcnNlY3JldGtleQ==             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### How to Get Values

```
┌─────────────────────────────────────────────────────────┐
│  1. OpenAI API Key                                      │
│     → Visit: https://platform.openai.com/api-keys       │
│     → Click "Create new secret key"                     │
│     → Copy the key (starts with sk-)                    │
│                                                         │
│  2. JWT Secret                                          │
│     → Open PowerShell                                   │
│     → Run: openssl rand -base64 32                      │
│     → Copy the output                                   │
│                                                         │
│  3. Session Secret                                      │
│     → Open PowerShell                                   │
│     → Run: openssl rand -base64 32                      │
│     → Copy the output                                   │
└─────────────────────────────────────────────────────────┘
```

## 🔧 Step 2: Setup (3 minutes)

### Run Setup Command

```powershell
.\run.ps1 setup
```

### What Happens

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  🔍 Checking prerequisites...                          │
│     ✓ Node.js: v20.x.x                                 │
│     ✓ npm: v10.x.x                                     │
│     ✓ Docker: 24.x.x                                   │
│     ✓ Docker Compose: v2.x.x                           │
│                                                         │
│  📦 Installing dependencies...                          │
│     ✓ Root dependencies installed                      │
│     ✓ Web app dependencies installed                   │
│     ✓ Package dependencies installed                   │
│                                                         │
│  🗄️  Setting up database...                            │
│     ✓ Prisma client generated                          │
│     ✓ Database schema ready                            │
│                                                         │
│  ✅ Setup complete!                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Step 3: Start (1 minute)

### Run Start Command

```powershell
.\run.ps1 start
```

### What Happens

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  🚀 Starting services...                               │
│                                                         │
│  1. Starting Docker services...                         │
│     ✓ PostgreSQL started (port 5432)                   │
│     ✓ Redis started (port 6379)                        │
│                                                         │
│  2. Waiting for services to be ready...                │
│     ✓ PostgreSQL is ready                              │
│     ✓ Redis is ready                                   │
│                                                         │
│  3. Running database migrations...                      │
│     ✓ Migrations completed                             │
│                                                         │
│  4. Starting Next.js application...                     │
│     ✓ Application started                              │
│                                                         │
│  ╔═══════════════════════════════════════════════════╗ │
│  ║   APPLICATION RUNNING                             ║ │
│  ╚═══════════════════════════════════════════════════╝ │
│                                                         │
│  🌐 Open: http://localhost:3005                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 🎉 Success! What You Have Now

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    YOUR RUNNING SYSTEM                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                                                     │  │
│  │         Browser (http://localhost:3005)            │  │
│  │                                                     │  │
│  └────────────────────┬────────────────────────────────┘  │
│                       │                                    │
│                       ▼                                    │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                                                     │  │
│  │         Next.js Application (Port 3005)            │  │
│  │         • Frontend (React)                         │  │
│  │         • API Routes                               │  │
│  │         • AI Integration                           │  │
│  │                                                     │  │
│  └────────┬──────────────────────┬─────────────────────┘  │
│           │                      │                        │
│           ▼                      ▼                        │
│  ┌──────────────────┐   ┌──────────────────┐            │
│  │   PostgreSQL     │   │   Redis Cache    │            │
│  │   (Port 5432)    │   │   (Port 6379)    │            │
│  │                  │   │                  │            │
│  │  • Contracts     │   │  • Sessions      │            │
│  │  • Artifacts     │   │  • Cache         │            │
│  │  • Analytics     │   │  • Job Queue     │            │
│  └──────────────────┘   └──────────────────┘            │
│           │                                               │
│           ▼                                               │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                                                     │  │
│  │         OpenAI API (GPT-4 / GPT-4o-mini)           │  │
│  │         • Contract Analysis                        │  │
│  │         • Metadata Extraction                      │  │
│  │         • AI Chat                                  │  │
│  │                                                     │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 🎨 What You Can Do Now

### 1. Upload Contracts

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Navigate to: http://localhost:3005/contracts          │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │                                                   │ │
│  │   📄 Drag & Drop Files Here                      │ │
│  │                                                   │ │
│  │   Supported: PDF, DOCX, DOC                      │ │
│  │   Max Size: 100MB                                │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  What Happens:                                          │
│  1. File uploaded to local storage                      │
│  2. AI extracts metadata                                │
│  3. Artifacts generated                                 │
│  4. Data stored in PostgreSQL                           │
│  5. Indexed for RAG search                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2. View Analytics

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  📊 Supplier Analytics                                  │
│     → /analytics/suppliers                              │
│     • Performance metrics                               │
│     • Spending analysis                                 │
│     • Risk assessment                                   │
│                                                         │
│  📅 Renewal Radar                                       │
│     → /analytics/renewals                               │
│     • Upcoming renewals                                 │
│     • Contract timelines                                │
│     • Renewal recommendations                           │
│                                                         │
│  💰 Savings Pipeline                                    │
│     → /analytics/savings                                │
│     • Cost savings opportunities                        │
│     • Optimization suggestions                          │
│     • Savings tracking & analysis                       │
│                                                         │
│  📈 Rate Benchmarking                                   │
│     → /analytics/rate-intelligence                      │
│     • Rate comparisons                                  │
│     • Market analysis                                   │
│     • Pricing trends                                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3. Use RAG Chat

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  💬 RAG Chat Interface                                  │
│     → /rag/chat                                         │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │                                                   │ │
│  │  You: What are the payment terms in the          │ │
│  │       Acme Corp contract?                        │ │
│  │                                                   │ │
│  │  AI: Based on the Acme Corp contract dated      │ │
│  │      2024-01-15, the payment terms are:          │ │
│  │      • Net 30 days                               │ │
│  │      • 2% discount for early payment             │ │
│  │      • Late fee: 1.5% per month                  │ │
│  │                                                   │ │
│  │  Sources: [Acme Corp Contract, Page 3]          │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Features:                                              │
│  • Ask questions about any contract                     │
│  • Get AI-powered answers with sources                  │
│  • Search across all documents                          │
│  • Context-aware responses                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 🔍 Verify Everything Works

### Health Checks

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  1. Application Health                                  │
│     → http://localhost:3005/api/health                  │
│                                                         │
│     Expected Response:                                  │
│     {                                                   │
│       "status": "healthy",                              │
│       "timestamp": "2024-01-15T10:30:00Z",             │
│       "services": {                                     │
│         "database": "connected",                        │
│         "redis": "connected",                           │
│         "openai": "configured"                          │
│       }                                                 │
│     }                                                   │
│                                                         │
│  2. Database Health                                     │
│     → http://localhost:3005/api/health/database         │
│                                                         │
│  3. Orchestration Status                                │
│     → http://localhost:3005/api/orchestration/status    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Command Line Check

```powershell
.\run.ps1 status
```

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  📊 Service Status                                      │
│                                                         │
│  Docker Services:                                       │
│  ✓ contract-intelligence-postgres-dev    Up            │
│  ✓ contract-intelligence-redis-dev       Up            │
│                                                         │
│  Application Status:                                    │
│  ✓ Application is running (http://localhost:3005)      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 🎯 Quick Reference Card

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║                   QUICK REFERENCE                         ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  COMMANDS                                                 ║
║  ─────────────────────────────────────────────────────    ║
║  Start:      .\run.ps1 start                             ║
║  Stop:       .\run.ps1 stop                              ║
║  Restart:    .\run.ps1 restart                           ║
║  Status:     .\run.ps1 status                            ║
║  Logs:       .\run.ps1 logs                              ║
║  Dev Mode:   .\run.ps1 dev                               ║
║                                                           ║
║  URLS                                                     ║
║  ─────────────────────────────────────────────────────    ║
║  App:        http://localhost:3005                       ║
║  Health:     http://localhost:3005/api/health            ║
║  Contracts:  http://localhost:3005/contracts             ║
║  Analytics:  http://localhost:3005/analytics             ║
║  RAG Chat:   http://localhost:3005/rag/chat              ║
║                                                           ║
║  SERVICES                                                 ║
║  ─────────────────────────────────────────────────────    ║
║  PostgreSQL: localhost:5432                              ║
║  Redis:      localhost:6379                              ║
║  Next.js:    localhost:3005                              ║
║                                                           ║
║  CREDENTIALS                                              ║
║  ─────────────────────────────────────────────────────    ║
║  DB User:    postgres                                    ║
║  DB Pass:    postgres                                    ║
║  DB Name:    contracts                                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

## 🐛 Quick Troubleshooting

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Problem: Docker not running                            │
│  Solution: Start Docker Desktop                         │
│                                                         │
│  Problem: Port already in use                           │
│  Solution: Change PORT in .env to 3006                  │
│                                                         │
│  Problem: Cannot connect to database                    │
│  Solution: Run .\run.ps1 restart                        │
│                                                         │
│  Problem: OpenAI API error                              │
│  Solution: Check API key and credits                    │
│                                                         │
│  Problem: Module not found                              │
│  Solution: Run .\run.ps1 setup again                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 🎉 You're All Set!

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│              🎉 CONGRATULATIONS! 🎉                     │
│                                                         │
│  Your Contract Intelligence Platform is running!        │
│                                                         │
│  Next Steps:                                            │
│  1. Open http://localhost:3005                          │
│  2. Upload your first contract                          │
│  3. Explore the analytics dashboards                    │
│  4. Try the RAG chat interface                          │
│                                                         │
│  Need Help?                                             │
│  • Read: QUICK_START.md                                 │
│  • Read: RUN_GUIDE.md                                   │
│  • Check: http://localhost:3005/api/health              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

**Ready to start?** Run `.\run.ps1 start` and open http://localhost:3005 🚀

# 🎯 Run System - Complete Package

## Overview

This is your **complete run system** for the Contract Intelligence Platform. Everything you need to get started is here.

## 🚀 Quick Start (Choose Your Path)

### Path 1: Super Quick (For Experienced Users)
1. Update `.env` with API key and secrets
2. Run `.\run.ps1 setup`
3. Run `.\run.ps1 start`
4. Open http://localhost:3005

### Path 2: Guided (For First-Time Users)
1. Read **[START_HERE_EASY_RUN.md](./START_HERE_EASY_RUN.md)**
2. Follow the 3-step process
3. Verify everything works

### Path 3: Visual (For Visual Learners)
1. Read **[VISUAL_QUICK_START.md](./VISUAL_QUICK_START.md)**
2. Follow the diagrams
3. Check the visual verification steps

## 📚 Documentation Structure

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   START HERE                                            │
│   ├─ README_RUN_SYSTEM.md (this file)                  │
│   └─ START_HERE_EASY_RUN.md                            │
│                                                         │
│   QUICK GUIDES                                          │
│   ├─ VISUAL_QUICK_START.md (visual guide)              │
│   └─ QUICK_START.md (5-minute guide)                   │
│                                                         │
│   COMPLETE REFERENCE                                    │
│   ├─ RUN_GUIDE.md (comprehensive)                      │
│   ├─ EASY_RUN_SUMMARY.md (summary)                     │
│   └─ COMPLETE_RUN_SYSTEM.md (final summary)            │
│                                                         │
│   EXECUTABLE FILES                                      │
│   ├─ run.ps1 (PowerShell script)                       │
│   ├─ START.bat (double-click launcher)                 │
│   └─ .env (configuration file)                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 📖 Which Document Should I Read?

### If you want to...

**Get started in 5 minutes**  
→ Read **[QUICK_START.md](./QUICK_START.md)**

**See visual diagrams and step-by-step**  
→ Read **[VISUAL_QUICK_START.md](./VISUAL_QUICK_START.md)**

**Understand everything in detail**  
→ Read **[RUN_GUIDE.md](./RUN_GUIDE.md)**

**Get a quick overview**  
→ Read **[START_HERE_EASY_RUN.md](./START_HERE_EASY_RUN.md)**

**See what was created**  
→ Read **[COMPLETE_RUN_SYSTEM.md](./COMPLETE_RUN_SYSTEM.md)**

**Just start the app**  
→ Double-click **START.bat** or run `.\run.ps1 start`

## 🎯 Files You'll Use

### Primary Files

| File | Purpose | When to Use |
|------|---------|-------------|
| `run.ps1` | Main control script | Daily usage |
| `.env` | Configuration | Setup & customization |
| `START.bat` | Quick launcher | Quick starts |

### Documentation Files

| File | Purpose | When to Read |
|------|---------|--------------|
| `START_HERE_EASY_RUN.md` | Getting started | First time |
| `VISUAL_QUICK_START.md` | Visual guide | Learning |
| `QUICK_START.md` | Quick reference | Quick starts |
| `RUN_GUIDE.md` | Complete guide | Deep dive |
| `COMPLETE_RUN_SYSTEM.md` | Summary | Overview |

## 🔧 Available Commands

```powershell
# Essential Commands
.\run.ps1 start    # Start everything
.\run.ps1 stop     # Stop everything
.\run.ps1 status   # Check what's running

# Setup & Maintenance
.\run.ps1 setup    # First-time setup
.\run.ps1 restart  # Restart everything
.\run.ps1 clean    # Clean everything

# Development
.\run.ps1 dev      # Dev mode (hot reload)
.\run.ps1 logs     # View logs
```

## ✅ Prerequisites

Before you start, ensure you have:

- ✅ **Node.js** (v18+) - [Download](https://nodejs.org/)
- ✅ **Docker Desktop** - [Download](https://www.docker.com/)
- ✅ **OpenAI API Key** - [Get one](https://platform.openai.com/api-keys)

## 🎨 What You Get

### Services
- **PostgreSQL** (port 5432) - Database
- **Redis** (port 6379) - Cache
- **Next.js** (port 3005) - Application

### Features
- Contract upload & processing
- AI-powered metadata extraction
- Supplier analytics
- Renewal tracking
- Savings detection
- Rate benchmarking
- RAG chat interface
- Intelligence dashboard

## 🔍 Quick Verification

After starting, check:

```powershell
# Check status
.\run.ps1 status

# Check health
# Open: http://localhost:3005/api/health

# Check application
# Open: http://localhost:3005
```

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Docker not running | Start Docker Desktop |
| Port in use | Change `PORT` in `.env` |
| Can't connect to DB | Run `.\run.ps1 restart` |
| OpenAI error | Check API key |
| Module not found | Run `.\run.ps1 setup` |

## 📋 Configuration Quick Reference

### Required Updates in .env

```bash
# 1. OpenAI API Key (REQUIRED)
OPENAI_API_KEY=sk-your-actual-key-here

# 2. JWT Secret (REQUIRED)
# Generate with: openssl rand -base64 32
JWT_SECRET=your-generated-secret

# 3. Session Secret (REQUIRED)
# Generate with: openssl rand -base64 32
SESSION_SECRET=your-generated-secret
```

### Pre-Configured (No Changes Needed)

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/contracts
REDIS_URL=redis://localhost:6379
PORT=3005
NODE_ENV=development
```

## 🎯 Recommended Reading Order

### For First-Time Users

1. **[START_HERE_EASY_RUN.md](./START_HERE_EASY_RUN.md)** (5 min)
   - Overview of what was created
   - Quick start steps
   - What you can do

2. **[VISUAL_QUICK_START.md](./VISUAL_QUICK_START.md)** (10 min)
   - Visual step-by-step guide
   - Service architecture diagrams
   - Feature demonstrations

3. **[QUICK_START.md](./QUICK_START.md)** (5 min)
   - Quick reference
   - Common tasks
   - Troubleshooting

### For Experienced Users

1. **[QUICK_START.md](./QUICK_START.md)** (2 min)
   - Get the essentials
   - Start immediately

2. **[RUN_GUIDE.md](./RUN_GUIDE.md)** (as needed)
   - Reference for specific tasks
   - Advanced configuration
   - Deployment guide

### For Managers/Stakeholders

1. **[COMPLETE_RUN_SYSTEM.md](./COMPLETE_RUN_SYSTEM.md)** (10 min)
   - What was delivered
   - System capabilities
   - Success metrics

## 💡 Pro Tips

### Daily Development
```powershell
# Start in dev mode (hot reload)
.\run.ps1 dev

# Check status anytime
.\run.ps1 status

# View logs for debugging
.\run.ps1 logs
```

### Quick Checks
```powershell
# Health check
curl http://localhost:3005/api/health

# Database health
curl http://localhost:3005/api/health/database

# Orchestration status
curl http://localhost:3005/api/orchestration/status
```

### Clean Restart
```powershell
# If something goes wrong
.\run.ps1 clean
.\run.ps1 setup
.\run.ps1 start
```

## 🎉 Success Checklist

After setup, you should be able to:

- [ ] Run `.\run.ps1 start` successfully
- [ ] Access http://localhost:3005
- [ ] See the dashboard
- [ ] Upload a contract
- [ ] View extracted metadata
- [ ] Access analytics pages
- [ ] Use RAG chat
- [ ] Check health endpoint

## 🆘 Getting Help

### Documentation
- **Quick Start**: [QUICK_START.md](./QUICK_START.md)
- **Visual Guide**: [VISUAL_QUICK_START.md](./VISUAL_QUICK_START.md)
- **Complete Guide**: [RUN_GUIDE.md](./RUN_GUIDE.md)

### Health Checks
- Application: http://localhost:3005/api/health
- Database: http://localhost:3005/api/health/database
- Orchestration: http://localhost:3005/api/orchestration/status

### Commands
```powershell
.\run.ps1 status  # Check services
.\run.ps1 logs    # View logs
```

## 🎯 Quick Reference Card

```
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   CONTRACT INTELLIGENCE PLATFORM                      ║
║   Quick Reference                                     ║
║                                                       ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║   COMMANDS                                            ║
║   ─────────────────────────────────────────────────   ║
║   Start:      .\run.ps1 start                        ║
║   Stop:       .\run.ps1 stop                         ║
║   Status:     .\run.ps1 status                       ║
║   Logs:       .\run.ps1 logs                         ║
║   Dev Mode:   .\run.ps1 dev                          ║
║                                                       ║
║   URLS                                                ║
║   ─────────────────────────────────────────────────   ║
║   App:        http://localhost:3005                  ║
║   Health:     http://localhost:3005/api/health       ║
║   Contracts:  http://localhost:3005/contracts        ║
║   Analytics:  http://localhost:3005/analytics        ║
║   RAG Chat:   http://localhost:3005/rag/chat         ║
║                                                       ║
║   SERVICES                                            ║
║   ─────────────────────────────────────────────────   ║
║   PostgreSQL: localhost:5432                         ║
║   Redis:      localhost:6379                         ║
║   Next.js:    localhost:3005                         ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

## 🚀 Ready to Start?

Choose your path:

**Quick Start**  
```powershell
.\run.ps1 start
```

**Guided Start**  
Read [START_HERE_EASY_RUN.md](./START_HERE_EASY_RUN.md)

**Visual Start**  
Read [VISUAL_QUICK_START.md](./VISUAL_QUICK_START.md)

---

**Welcome to the Contract Intelligence Platform!** 🎉

Your complete run system is ready. Pick a guide above and get started!

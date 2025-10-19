# 🚀 Complete System Setup Guide

## One-Stop Setup for the Entire Platform

This guide covers setup for the complete contract intelligence platform with RAG, analytics, and all features.

---

## 📋 Prerequisites

### Required
1. **Docker Desktop** - For databases and services
   - Download: https://www.docker.com/products/docker-desktop
   - Verify: `docker --version`

2. **Node.js 18+** - For running the application
   - Download: https://nodejs.org/
   - Verify: `node --version`

3. **OpenAI API Key** - For AI features
   - Get one: https://platform.openai.com/api-keys
   - Cost: ~$30-50/month for typical usage

---

## 🚀 Quick Setup (10 Minutes)

### Windows
```powershell
.\scripts\setup.ps1
```

### Linux/Mac
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

This will:
1. ✅ Install all dependencies
2. ✅ Start Docker services (Chroma DB, MySQL)
3. ✅ Create and configure .env file
4. ✅ Apply all database migrations
5. ✅ Seed example data
6. ✅ Run health checks
7. ✅ Start the application

---

## 🎯 What You Get

### Infrastructure (All Local)
- **Chroma DB** (Port 8000) - Vector storage for RAG
- **MySQL** (Port 3306) - Main database with 25+ tables
- **Next.js App** (Port 3000) - Web application

### Features
- ✅ **Contract Management** - Upload, process, analyze contracts
- ✅ **RAG System** - AI-powered contract intelligence
  - 11 services (vector search, knowledge graph, multi-modal, etc.)
  - 4 dashboards (chat, intelligence, insights, observability)
  - 14 API endpoints
- ✅ **Analytics** - Advanced analytics and reporting
- ✅ **Rate Intelligence** - Rate card analysis and benchmarking
- ✅ **UX Features** - Keyboard shortcuts, celebrations, metrics

### Database Tables (25+)
- Contract tables (contracts, artifacts, metadata)
- RAG tables (18 tables for graph, learning, observability, security)
- Analytics tables (intelligence, rate cards, taxonomy)
- UX tables (preferences, layouts, metrics)

---

## 📊 Access Points

After setup, visit:

### Main Application
- **Home**: http://localhost:3000
- **Contracts**: http://localhost:3000/contracts
- **Analytics**: http://localhost:3000/analytics
- **Taxonomy**: http://localhost:3000/taxonomy

### RAG Dashboards
- **Chat**: http://localhost:3000/rag/chat
- **Intelligence**: http://localhost:3000/rag/intelligence
- **Insights**: http://localhost:3000/rag/insights
- **Observability**: http://localhost:3000/rag/observability

### Analytics Dashboards
- **Intelligence**: http://localhost:3000/analytics/intelligence
- **Rate Intelligence**: http://localhost:3000/analytics/rate-intelligence
- **Enhanced Dashboard**: http://localhost:3000/analytics/enhanced-dashboard

### Health Checks
- **API Health**: http://localhost:3000/api/health
- **Database Health**: http://localhost:3000/api/health/database

---

## 🔧 Manual Setup (If Needed)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Docker Services
```bash
# Chroma DB (Vector Store)
docker run -d -p 8000:8000 --name chroma chromadb/chroma

# MySQL (Main Database)
docker run -d \
  --name mysql-rag \
  -e MYSQL_ROOT_PASSWORD=ragpassword \
  -e MYSQL_DATABASE=rag_system \
  -p 3306:3306 \
  mysql:8.0
```

### 3. Configure Environment
Create `.env` file:
```bash
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# Database Configuration
DATABASE_URL=mysql://root:ragpassword@localhost:3306/rag_system

# Chroma DB Configuration
CHROMA_URL=http://localhost:8000

# Application Configuration
NODE_ENV=development
PORT=3000
```

### 4. Apply Database Migrations
```bash
cd packages/data-orchestration
npx prisma migrate deploy
cd ../..
```

### 5. Seed Example Data (Optional)
```bash
cd packages/data-orchestration
npx ts-node src/scripts/seed-rag-data.ts
cd ../..
```

### 6. Start Application
```bash
npm run dev
```

---

## ✅ Verify Setup

### Run Health Check
```powershell
# Windows
.\scripts\verify.ps1

# Linux/Mac
./scripts/verify.sh
```

### Manual Verification
```bash
# Check Chroma DB
curl http://localhost:8000/api/v1/heartbeat

# Check MySQL
docker exec mysql-rag mysql -u root -pragpassword -e "SELECT 1;"

# Check Application
curl http://localhost:3000/api/health

# Check Database Tables
docker exec mysql-rag mysql -u root -pragpassword rag_system -e "SHOW TABLES;"
```

---

## 🗄️ Database Management

### View Data
```bash
# Connect to MySQL
docker exec -it mysql-rag mysql -u root -pragpassword rag_system

# View tables
SHOW TABLES;

# View contracts
SELECT * FROM contracts LIMIT 10;

# View RAG data
SELECT * FROM rag_graph_nodes LIMIT 10;
SELECT * FROM rag_feedback ORDER BY created_at DESC LIMIT 10;
```

### Backup Database
```bash
docker exec mysql-rag mysqldump -u root -pragpassword rag_system > backup.sql
```

### Restore Database
```bash
docker exec -i mysql-rag mysql -u root -pragpassword rag_system < backup.sql
```

---

## 🛠️ Troubleshooting

### Docker Services Not Starting
```bash
# Check if ports are in use
lsof -i :8000  # Chroma DB
lsof -i :3306  # MySQL
lsof -i :3000  # Application

# Remove old containers
docker rm -f chroma mysql-rag

# Start fresh
docker run -d -p 8000:8000 --name chroma chromadb/chroma
docker run -d --name mysql-rag -e MYSQL_ROOT_PASSWORD=ragpassword -e MYSQL_DATABASE=rag_system -p 3306:3306 mysql:8.0
```

### Application Won't Start
```bash
# Clear cache
rm -rf .next node_modules

# Reinstall
npm install

# Start
npm run dev
```

### Database Connection Errors
```bash
# Check DATABASE_URL in .env
cat .env | grep DATABASE_URL

# Test connection
docker exec mysql-rag mysql -u root -pragpassword -e "SELECT 1;"
```

---

## 💰 Cost Estimate

### Local Infrastructure
- **Docker**: Free
- **Chroma DB**: Free
- **MySQL**: Free
- **Total**: $0/month

### OpenAI API
- **Per contract**: ~$0.01
- **Per query**: ~$0.02-0.05
- **Typical usage** (1K contracts, 5K queries): ~$30-50/month

---

## 📚 Documentation

### Quick References
- **README.md** - Project overview
- **.env.example** - Environment configuration template
- **packages/data-orchestration/prisma/schema.prisma** - Database schema

### API Documentation
All API endpoints are documented in their respective route files under `apps/web/app/api/`

---

## 🎉 You're Ready!

After setup, you have:
- ✅ Complete contract intelligence platform
- ✅ Advanced RAG system with 11 services
- ✅ 4 RAG dashboards
- ✅ Analytics and reporting
- ✅ Rate intelligence
- ✅ All running locally

**Start using the platform:**
```bash
npm run dev
# Visit: http://localhost:3000
```

---

## 🛑 Stop Services

```bash
# Stop Docker services
docker stop chroma mysql-rag

# Remove Docker services
docker rm chroma mysql-rag

# Stop application
# Press Ctrl+C in the terminal running npm run dev
```

---

**Need help?** Check the troubleshooting section or review the code in the repository.

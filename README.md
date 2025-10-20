# 🚀 Contract Intelligence Platform

Enterprise contract management and intelligence platform with advanced RAG, analytics, and AI-powered insights.

---

## ⚡ **NEW: One-Command Complete Setup!**

### Run This Once and You're Done:

```powershell
# Windows (PowerShell)
.\setup-complete.ps1

# Mac/Linux (Bash)
chmod +x setup-complete.sh && ./setup-complete.sh
```

**What it does**: Installs everything, configures database, sets up AI, and starts the server!

**See**: `START_HERE.md` for details

---

## ⚡ Quick Start (Alternative)

### Automated Setup (Recommended)

```bash
# Windows
.\scripts\setup.ps1

# Linux/Mac
chmod +x scripts/setup.sh
./scripts/setup.sh
```

This will:
1. Install all dependencies
2. Start Docker services (Chroma DB, MySQL)
3. Configure environment
4. Apply database migrations
5. Seed example data
6. Run health checks

Then visit: **http://localhost:3000**

### Manual Setup

See [SETUP.md](SETUP.md) for detailed instructions.

---

## 🎯 What You Get

### Core Features
- **Contract Management** - Upload, process, and analyze contracts
- **AI-Powered Search** - Semantic search across all contracts
- **Advanced Analytics** - Comprehensive reporting and insights
- **Rate Intelligence** - Rate card analysis and benchmarking

### RAG System (11 Services)
- **Vector Search** - Semantic contract search
- **Knowledge Graph** - Entity relationships and networks
- **Multi-Modal** - Tables, images, and mixed content
- **Cross-Contract Intelligence** - Pattern detection and risk correlation
- **Analytics Integration** - Natural language analytics queries
- **Federated Search** - Unified search across all sources
- **Learning System** - Continuous improvement from feedback
- **Observability** - Real-time monitoring and metrics
- **Security** - Access control, rate limiting, audit logs

### Dashboards
- **Main App**: http://localhost:3000
- **RAG Chat**: http://localhost:3000/rag/chat
- **Intelligence**: http://localhost:3000/rag/intelligence
- **Insights**: http://localhost:3000/rag/insights
- **Observability**: http://localhost:3000/rag/observability
- **Analytics**: http://localhost:3000/analytics

---

## 🏗️ Architecture

### Technology Stack
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, Prisma ORM
- **Databases**: MySQL (main), Chroma DB (vector store)
- **AI**: OpenAI GPT-4, LangChain
- **Infrastructure**: Docker, Docker Compose

### Project Structure
```
├── apps/
│   ├── web/              # Next.js web application
│   ├── api/              # API services
│   └── workers/          # Background workers
├── packages/
│   ├── data-orchestration/  # Core services and RAG
│   ├── clients/          # Database clients
│   └── utils/            # Shared utilities
├── scripts/              # Setup and utility scripts
└── docs/                 # Documentation
```

See [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) for detailed architecture.

---

## 📊 Database

### Tables (25+)
- **Contracts** - Main contract data
- **Artifacts** - Extracted contract artifacts
- **RAG** - 18 tables for knowledge graph, learning, observability
- **Analytics** - Intelligence and rate card data
- **UX** - User preferences and metrics

### Migrations
All migrations are in `packages/data-orchestration/prisma/migrations/`

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific tests
npm test -- rag-integration.test.ts

# Run smoke tests
node scripts/smoke-test.mjs
```

---

## 🛠️ Development

### Start Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Run Production Build
```bash
npm start
```

---

## 📚 Documentation

- **[SETUP.md](SETUP.md)** - Complete setup guide
- **[SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)** - Architecture details
- **API Documentation** - See route files in `apps/web/app/api/`

---

## 🔧 Configuration

### Environment Variables
Copy `.env.example` to `.env` and configure:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your-key-here

# Database Configuration
DATABASE_URL=mysql://user:pass@localhost:3306/db

# Chroma DB Configuration
CHROMA_URL=http://localhost:8000

# Application Configuration
NODE_ENV=development
PORT=3000
```

---

## 🐳 Docker Services

### Start Services
```bash
# Chroma DB (Vector Store)
docker run -d -p 8000:8000 --name chroma chromadb/chroma

# MySQL (Main Database)
docker run -d --name mysql-rag \
  -e MYSQL_ROOT_PASSWORD=ragpassword \
  -e MYSQL_DATABASE=rag_system \
  -p 3306:3306 \
  mysql:8.0
```

### Stop Services
```bash
docker stop chroma mysql-rag
```

### Remove Services
```bash
docker rm chroma mysql-rag
```

---

## 💰 Cost Estimate

### Local Infrastructure
- **Docker**: Free
- **Chroma DB**: Free
- **MySQL**: Free

### OpenAI API
- **Per contract**: ~$0.01
- **Per query**: ~$0.02-0.05
- **Typical usage** (1K contracts, 5K queries): ~$30-50/month

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

---

## 📝 License

[Your License Here]

---

## 🆘 Support

For issues and questions:
1. Check [SETUP.md](SETUP.md) for troubleshooting
2. Review [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)
3. Open an issue on GitHub

---

**Built with ❤️ for intelligent contract management**

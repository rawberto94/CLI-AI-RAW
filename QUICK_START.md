# 🚀 Quick Start Guide

Get the Contract Intelligence Platform running in 5 minutes!

## Prerequisites

Before you begin, ensure you have:

- ✅ **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- ✅ **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)
- ✅ **OpenAI API Key** - [Get one here](https://platform.openai.com/api-keys)

## 🎯 Quick Start (3 Steps)

### Step 1: Configure Environment

1. Open the `.env` file in the root directory
2. Update these **REQUIRED** values:

```bash
# Get your API key from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-actual-api-key-here

# Generate secrets (run these commands in PowerShell):
# openssl rand -base64 32
JWT_SECRET=your-generated-jwt-secret-here
SESSION_SECRET=your-generated-session-secret-here
```

### Step 2: Setup Project (First Time Only)

```powershell
.\run.ps1 setup
```

This will:
- Install all dependencies
- Setup the database schema
- Prepare the application

### Step 3: Start Everything

```powershell
.\run.ps1 start
```

This will:
- Start PostgreSQL database
- Start Redis cache
- Run database migrations
- Start the Next.js application

**That's it!** 🎉

Open your browser to: **http://localhost:3005**

## 📋 Available Commands

```powershell
# Start all services
.\run.ps1 start

# Stop all services
.\run.ps1 stop

# Restart all services
.\run.ps1 restart

# Check service status
.\run.ps1 status

# View logs
.\run.ps1 logs

# Development mode (with hot reload)
.\run.ps1 dev

# Clean everything (removes data!)
.\run.ps1 clean
```

## 🔍 Verify Installation

After starting, check these endpoints:

1. **Application**: http://localhost:3005
2. **Health Check**: http://localhost:3005/api/health
3. **Database**: PostgreSQL on localhost:5432
4. **Redis**: Redis on localhost:6379

## 🎨 What You Can Do

### 1. Upload Contracts
- Navigate to the Contracts page
- Drag & drop PDF/DOCX files
- AI automatically extracts metadata

### 2. View Analytics
- **Supplier Analytics**: Analyze supplier performance
- **Renewal Radar**: Track upcoming renewals
- **Savings Pipeline**: Identify cost savings
- **Rate Benchmarking**: Compare rates across contracts

### 3. Use RAG Chat
- Ask questions about your contracts
- Get AI-powered insights
- Search across all documents

### 4. Explore Intelligence
- View procurement insights
- Analyze spending patterns
- Get compliance reports

## 🔧 Configuration Options

### Database

The default configuration uses Docker PostgreSQL:
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/contracts
```

### AI Model

Change the OpenAI model:
```bash
OPENAI_MODEL=gpt-4o-mini  # Fast and cost-effective
# or
OPENAI_MODEL=gpt-4        # More powerful
```

### File Storage

Local storage (default):
```bash
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=104857600  # 100MB
```

For cloud storage (AWS S3), uncomment and configure:
```bash
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

## 🐛 Troubleshooting

### Port Already in Use

If port 3005 is busy, change it in `.env`:
```bash
PORT=3006
NEXT_PUBLIC_APP_URL=http://localhost:3006
```

### Docker Not Running

Start Docker Desktop before running the application.

### Database Connection Failed

1. Check Docker is running: `docker ps`
2. Check PostgreSQL is healthy: `docker logs contract-intelligence-postgres-dev`
3. Restart services: `.\run.ps1 restart`

### OpenAI API Errors

1. Verify your API key is correct
2. Check you have credits: https://platform.openai.com/usage
3. Ensure no extra spaces in the `.env` file

### Missing Dependencies

Run setup again:
```powershell
.\run.ps1 clean
.\run.ps1 setup
```

## 📚 Next Steps

### Learn More

- **[User Guides](./docs/)** - Detailed feature documentation
- **[API Documentation](./docs/API_DOCUMENTATION.md)** - API reference
- **[System Architecture](./SYSTEM_ARCHITECTURE.md)** - Technical overview

### Advanced Features

1. **RAG Integration** - See [RAG_INTEGRATION_GUIDE.md](./RAG_INTEGRATION_GUIDE.md)
2. **Procurement Intelligence** - See [PROCUREMENT_INTELLIGENCE_README.md](./PROCUREMENT_INTELLIGENCE_README.md)
3. **Data Orchestration** - See [UNIFIED_ORCHESTRATION_COMPLETE.md](./UNIFIED_ORCHESTRATION_COMPLETE.md)

### Development

For development with hot reload:
```powershell
.\run.ps1 dev
```

This enables:
- Automatic code reloading
- Detailed error messages
- Query logging
- Pretty console output

## 🔐 Security Notes

### Production Deployment

Before deploying to production:

1. ✅ Use strong, unique secrets (32+ characters)
2. ✅ Enable HTTPS/TLS
3. ✅ Restrict CORS origins
4. ✅ Use environment-specific database credentials
5. ✅ Enable rate limiting
6. ✅ Configure monitoring (Sentry)
7. ✅ Setup automated backups
8. ✅ Use cloud storage (S3/Azure)

### Environment Variables

Never commit `.env` files to version control!

The `.gitignore` already excludes:
- `.env`
- `.env.local`
- `.env.*.local`

## 💡 Tips

### Performance

- Use Redis caching (enabled by default)
- Enable compression for large files
- Configure connection pooling
- Use cloud storage for production

### Data Management

- Backup database regularly
- Monitor disk space
- Clean old uploads periodically
- Archive processed contracts

### Monitoring

Enable monitoring in `.env`:
```bash
ENABLE_PERFORMANCE_MONITORING=true
ENABLE_ERROR_TRACKING=true
SENTRY_DSN=your-sentry-dsn
```

## 🆘 Getting Help

### Check Status

```powershell
.\run.ps1 status
```

### View Logs

```powershell
.\run.ps1 logs
```

### Health Check

Visit: http://localhost:3005/api/health

### Common Issues

1. **"Cannot connect to database"**
   - Ensure Docker is running
   - Check `docker ps` shows PostgreSQL container
   - Verify DATABASE_URL in `.env`

2. **"OpenAI API error"**
   - Check API key is valid
   - Verify you have credits
   - Check rate limits

3. **"Port already in use"**
   - Change PORT in `.env`
   - Or stop other services using the port

4. **"Module not found"**
   - Run `.\run.ps1 setup` again
   - Delete `node_modules` and reinstall

## 🎯 Success Checklist

After setup, you should be able to:

- ✅ Access http://localhost:3005
- ✅ See the dashboard
- ✅ Upload a contract
- ✅ View extracted metadata
- ✅ Access analytics pages
- ✅ Use RAG chat
- ✅ View health check: http://localhost:3005/api/health

## 📞 Support

- **Documentation**: Check the `/docs` folder
- **Issues**: Create a GitHub issue
- **Questions**: Check existing documentation first

---

**Ready to start?** Run `.\run.ps1 start` and open http://localhost:3005 🚀

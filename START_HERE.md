# 🚀 START HERE - Quick Setup Guide

## One-Command Setup

### For Windows (PowerShell):
```powershell
.\setup-complete.ps1
```

### For Mac/Linux (Bash):
```bash
chmod +x setup-complete.sh
./setup-complete.sh
```

## What the Script Does

The automated setup script will:

1. ✅ Check prerequisites (Node.js, pnpm, PostgreSQL)
2. ✅ Install all dependencies
3. ✅ Setup environment variables (.env)
4. ✅ Configure database schema
5. ✅ Generate Prisma client
6. ✅ Run database migrations
7. ✅ Create upload directories
8. ✅ Verify everything is working
9. ✅ Optionally start the dev server

**Time**: ~5 minutes (mostly automated)

## Manual Setup (If Preferred)

If you prefer to run commands manually:

```bash
# 1. Install dependencies
pnpm install

# 2. Setup environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# 3. Setup database
cd packages/clients/db
pnpm prisma generate
pnpm prisma migrate deploy
cd ../../..

# 4. Start server
pnpm dev
```

## After Setup

1. **Open browser**: http://localhost:3000
2. **Upload a PDF contract**
3. **Wait 15-30 seconds**
4. **View real AI-generated artifacts!**

## Need Help?

- **Complete Guide**: `COMPLETE_SETUP_GUIDE.md`
- **OpenAI Setup**: `SETUP_OPENAI_GUIDE.md`
- **Troubleshooting**: `LIMITATIONS_FIXED_SUMMARY.md`

## What You Get

✅ All 6 artifacts improved with AI
✅ Real PDF text extraction
✅ Real AI analysis (with OpenAI key)
✅ Cost savings identification
✅ Beautiful UI with real data
✅ Dashboard analytics
✅ Quality scoring

**Ready to go!** 🎉

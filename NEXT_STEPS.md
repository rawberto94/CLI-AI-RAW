# 🎯 Next Steps - Launch Your Codespace

## Step 1: Push to GitHub

```bash
# Stage all changes
git add .

# Commit the changes
git commit -m "Configure project for GitHub Codespaces

- Updated devcontainer for Codespaces compatibility
- Added PostgreSQL, Redis, and MinIO services
- Created setup and launch scripts
- Added comprehensive documentation"

# Push to GitHub
git push origin main
```

## Step 2: Create Your Codespace

### Via GitHub Web Interface:

1. Go to your repository on GitHub
2. Click the green **"Code"** button
3. Select the **"Codespaces"** tab
4. Click **"Create codespace on main"**

### Via GitHub CLI (if installed):

```bash
gh codespace create
```

## Step 3: Wait for Setup

The codespace will automatically:
- ✅ Install Node.js 20
- ✅ Install pnpm
- ✅ Install project dependencies
- ✅ Initialize PostgreSQL with pgvector
- ✅ Create database and user
- ✅ Set up environment files

**This takes about 2-3 minutes**

## Step 4: Launch the Application

Once the codespace is ready:

```bash
# Option 1: Use the launch script (recommended)
./launch.sh

# Option 2: Manual start
bash .devcontainer/start-services.sh
pnpm dev
```

## Step 5: Access Your App

1. Look for the **"PORTS"** tab in VS Code (bottom panel)
2. Find port **3002** (Web App)
3. Click the **globe icon** 🌐 to open in browser

Or wait for the automatic popup notification!

## 🎉 You're Done!

Your Contract Intelligence Platform is now running in GitHub Codespaces.

---

## Quick Reference

### Essential Commands

```bash
# Start everything
./launch.sh

# Start services only
npm run services

# Start dev server only
pnpm dev

# Check service status
docker ps
sudo service postgresql status

# View logs
docker logs codespaces-redis
docker logs codespaces-minio
```

### Ports

| Service | Port | Access |
|---------|------|--------|
| Web App | 3002 | Public (auto-forwarded) |
| API | 3001 | Private |
| PostgreSQL | 5432 | Private |
| Redis | 6379 | Private |
| MinIO API | 9000 | Private |
| MinIO Console | 9001 | Public |

### Environment Variables

Your `.env` file is already configured with:
- ✅ OpenAI API key
- ✅ Database connection
- ✅ Redis connection
- ✅ MinIO configuration

---

## Troubleshooting

### Services won't start?
```bash
bash .devcontainer/start-services.sh
```

### Port conflicts?
```bash
lsof -i :3002
kill -9 <PID>
```

### Need to reset?
```bash
docker-compose -f .devcontainer/docker-compose.codespaces.yml down
sudo service postgresql restart
./launch.sh
```

---

## Documentation

- 📘 [QUICK_START.md](./QUICK_START.md) - Quick reference guide
- 📗 [CODESPACES_SETUP.md](./CODESPACES_SETUP.md) - Detailed setup guide
- 📕 [MIGRATION_COMPLETE.md](./MIGRATION_COMPLETE.md) - What changed
- 📙 [README.md](./README.md) - Project documentation

---

## Tips

💡 **Codespace Machine Type**: Default is 2-core. For better performance, use 4-core or 8-core.

💡 **Prebuilds**: Set up prebuilds in your repo settings to make codespace creation even faster.

💡 **Dotfiles**: Add your personal dotfiles repo in GitHub settings for automatic customization.

💡 **Extensions**: All recommended VS Code extensions are pre-installed.

---

**Ready to code!** 🚀

Push your changes and create your first codespace.

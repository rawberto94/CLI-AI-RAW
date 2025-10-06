# Quick Start - GitHub Codespaces

## 🚀 Launch in 3 Steps

### 1. Create Codespace
- Go to your GitHub repository
- Click **Code** → **Codespaces** → **Create codespace on main**
- Wait 2-3 minutes for automatic setup

### 2. Configure API Key
```bash
# Edit .env file
nano .env

# Update this line:
OPENAI_API_KEY=sk-your-actual-key-here
```
Press `Ctrl+X`, then `Y`, then `Enter` to save.

### 3. Launch Everything
```bash
./launch.sh
```

That's it! Your app will be running on port 3002.

---

## 📋 Common Commands

```bash
# Start services only (PostgreSQL, Redis, MinIO)
npm run services

# Start development server
pnpm dev

# Run both at once
./launch.sh

# Check what's running
docker ps
sudo service postgresql status

# View logs
docker logs codespaces-redis
docker logs codespaces-minio
```

---

## 🌐 Access Your App

1. Click the **PORTS** tab in VS Code
2. Find port **3002** (Web App)
3. Click the globe icon to open in browser

Or use the popup notification that appears automatically.

---

## 🔧 Troubleshooting

### Services not starting?
```bash
# Restart everything
bash .devcontainer/start-services.sh
```

### Port already in use?
```bash
# Kill the process
lsof -i :3002
kill -9 <PID>
```

### Need to reset?
```bash
# Stop all services
docker-compose -f .devcontainer/docker-compose.codespaces.yml down
sudo service postgresql stop

# Start fresh
./launch.sh
```

---

## 📚 More Info

- Full setup guide: [CODESPACES_SETUP.md](./CODESPACES_SETUP.md)
- Project documentation: [README.md](./README.md)

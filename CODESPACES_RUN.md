# Running in GitHub Codespaces

## 🚀 Quick Start (One Command)

Once your Codespace is open and setup is complete:

```bash
./launch.sh
```

This will start everything and keep running in the foreground.

---

## 🔄 Keep Running Persistently (Background)

To keep the app running even when you close the terminal:

```bash
./start-persistent.sh
```

This uses PM2 to manage the process. The app will:
- ✅ Auto-restart if it crashes
- ✅ Keep running in the background
- ✅ Survive terminal closures

### PM2 Commands

```bash
# Check status
pm2 status

# View logs (live)
pm2 logs

# View logs (last 100 lines)
pm2 logs --lines 100

# Restart the app
pm2 restart all

# Stop the app
pm2 stop all

# Remove from PM2
pm2 delete all
```

---

## 📋 Manual Start (Step by Step)

If you want to start services manually:

### 1. Start Backend Services

```bash
bash .devcontainer/start-services.sh
```

This starts:
- Redis (port 6379)
- MinIO (ports 9000, 9001)

### 2. Start the Application

```bash
cd apps/web
pnpm dev
```

Or from the root:

```bash
pnpm dev
```

---

## 🔍 Check What's Running

### Check Docker Containers

```bash
docker ps
```

You should see:
- `codespaces-redis`
- `codespaces-minio`

### Check Ports

```bash
# Check what's listening on ports
lsof -i :3002  # Web app
lsof -i :3001  # API
lsof -i :6379  # Redis
lsof -i :9000  # MinIO
```

### View Logs

```bash
# Docker service logs
docker logs codespaces-redis
docker logs codespaces-minio

# If using PM2
pm2 logs

# If running in foreground, logs are in the terminal
```

---

## 🌐 Access Your Application

### In Codespaces

1. Click the **PORTS** tab (bottom panel)
2. Find port **3002** (Web App)
3. Click the 🌐 globe icon to open in browser

### Port Forwarding

Codespaces automatically forwards these ports:
- **3002** - Web Application (public)
- **3001** - API Server (private)
- **9001** - MinIO Console (private)
- **6379** - Redis (private)
- **9000** - MinIO API (private)

---

## 🛑 Stop Everything

### Stop PM2 Process

```bash
pm2 stop all
pm2 delete all
```

### Stop Docker Services

```bash
docker compose -f .devcontainer/docker-compose.codespaces.yml down
```

### Stop Everything at Once

```bash
pm2 delete all 2>/dev/null
docker compose -f .devcontainer/docker-compose.codespaces.yml down
```

---

## 🔄 Restart Everything

```bash
# Stop everything
pm2 delete all 2>/dev/null
docker compose -f .devcontainer/docker-compose.codespaces.yml down

# Start again
./start-persistent.sh
```

---

## 🐛 Troubleshooting

### Services won't start

```bash
# Check Docker is running
docker ps

# Restart Docker services
docker compose -f .devcontainer/docker-compose.codespaces.yml restart
```

### Port already in use

```bash
# Find what's using the port
lsof -i :3002

# Kill the process
kill -9 <PID>
```

### App crashes immediately

```bash
# Check logs
pm2 logs

# Check environment
cat .env

# Verify dependencies
pnpm install
```

### Can't access the app

1. Check the PORTS tab in VS Code
2. Make sure port 3002 is forwarded
3. Try clicking the globe icon again
4. Check if the app is actually running: `pm2 status`

---

## 💡 Tips

### Keep Codespace Alive

Codespaces auto-sleep after 30 minutes of inactivity. To prevent this:
- Keep the browser tab open
- Interact with the terminal occasionally
- Or upgrade to a paid plan for longer timeouts

### Save Resources

If you're not actively developing:
```bash
pm2 stop all
docker compose -f .devcontainer/docker-compose.codespaces.yml stop
```

### View Real-time Logs

```bash
# PM2 logs (if using persistent mode)
pm2 logs --lines 50

# Docker logs
docker logs -f codespaces-redis
docker logs -f codespaces-minio
```

---

## 📊 Monitoring

### Check Resource Usage

```bash
# Docker stats
docker stats

# PM2 monitoring
pm2 monit
```

### Health Checks

```bash
# Check Redis
docker exec codespaces-redis redis-cli ping

# Check MinIO
curl http://localhost:9000/minio/health/live

# Check Web App
curl http://localhost:3002
```

---

## 🎯 Recommended Workflow

1. **Start Codespace** - Wait for auto-setup
2. **Run persistent mode** - `./start-persistent.sh`
3. **Develop** - Make changes, they'll auto-reload
4. **Check logs** - `pm2 logs` when needed
5. **Stop when done** - `pm2 stop all` to save resources

---

For more help, see:
- [START_HERE.md](./START_HERE.md)
- [QUICK_START.md](./QUICK_START.md)
- [CODESPACES_SETUP.md](./CODESPACES_SETUP.md)

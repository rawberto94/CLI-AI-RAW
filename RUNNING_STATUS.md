# Contract Intelligence Platform - Quick Reference

## 🚀 Application is Now Running with Auto-Restart!

### Current Status
- ✅ **PostgreSQL**: Running on port 5432
- ✅ **Redis**: Running on port 6379  
- ✅ **Next.js App**: Running on port 3005
- ✅ **Keepalive Monitor**: Running (auto-restarts if app crashes)

### 🌐 Access
- **Application URL**: http://localhost:3005
- **Status**: The server will automatically restart if it stops!

## 📋 Management Commands

### Quick Status Check
```bash
./manage.sh status
```

### Start Everything
```bash
./manage.sh start
```

### Stop Everything
```bash
./manage.sh stop
```

### Restart Everything
```bash
./manage.sh restart
```

### View Logs
```bash
# Application logs
./manage.sh logs

# Keepalive monitor logs
./manage.sh logs keepalive
```

## 🔄 Auto-Restart Feature

The keepalive monitor checks the application every 10 seconds and automatically restarts it if:
- The server stops responding
- The process crashes
- Port 3005 becomes unavailable

## 📝 Log Files
- **Application logs**: `/tmp/app.log`
- **Keepalive logs**: `/tmp/keepalive.log`

## 🛠 Manual Operations

### Check if app is running
```bash
ps aux | grep "next dev" | grep -v grep
curl -I http://localhost:3005
```

### Kill the app manually
```bash
pkill -f "next dev"
```

### Start app manually (without keepalive)
```bash
./run-persistent.sh
```

## 📊 Docker Services

### View Docker logs
```bash
docker compose -f docker-compose.dev.yml logs -f
```

### Restart Docker services
```bash
docker compose -f docker-compose.dev.yml restart
```

### Stop Docker services
```bash
docker compose -f docker-compose.dev.yml down
```

## 🎯 What Was Fixed

1. **Persistent Startup**: Created `run-persistent.sh` to start the app in the background
2. **Auto-Restart Monitor**: Created `keepalive.sh` that monitors and restarts the app automatically
3. **Easy Management**: Created `manage.sh` for simple control of all services
4. **Environment Loading**: Fixed environment variable loading issue
5. **NODE_ENV**: Set to "development" for proper Next.js operation

## ✅ Server Will Stay Running!

The application now has:
- Background execution (won't stop when terminal closes)
- Automatic restart on failure
- Health monitoring every 10 seconds
- Persistent logs for debugging

**Your server is now self-healing and will stay online! 🎉**

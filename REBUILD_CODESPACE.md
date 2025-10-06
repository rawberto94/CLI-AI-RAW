# Rebuild Codespace with Docker Support

Your Codespace needs to be rebuilt to enable Docker for Redis and MinIO.

## Option 1: Quick Start (No Docker)

Run the app without Docker services:

```bash
./start-simple.sh
```

This will work immediately but with limited features:
- ✅ App runs on port 3002
- ✅ File uploads work (stored locally)
- ⚠️  No background processing
- ⚠️  No Redis caching
- ⚠️  No MinIO object storage

## Option 2: Rebuild with Full Features

To enable Redis and MinIO, rebuild your Codespace:

### Steps:

1. **Open Command Palette**
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)

2. **Type and select:**
   ```
   Codespaces: Rebuild Container
   ```

3. **Wait 3-5 minutes** for rebuild

4. **After rebuild, run:**
   ```bash
   ./fix-and-start.sh
   ```

### What Rebuild Does:

- ✅ Installs Docker-in-Docker
- ✅ Enables Redis container
- ✅ Enables MinIO container
- ✅ Full background processing
- ✅ Proper file storage

## Current Status

Your Codespace is running but Docker daemon is not available. This is because the devcontainer was created before Docker-in-Docker was added to the configuration.

## Recommendation

**For now:** Use `./start-simple.sh` to get started quickly

**Later:** Rebuild the container when you need full features

---

## Quick Commands

```bash
# Start without Docker (works now)
./start-simple.sh

# Check what's running
pm2 status

# View logs
pm2 logs

# Stop app
pm2 stop all
```

# Custom Dev Server Guide

The custom development server (`dev-server.js`) provides production-ready memory management, rate limiting, and health monitoring for Next.js applications.

## Quick Start

### Standard Launch

```bash
chmod +x start-dev.sh check-health.sh
./start-dev.sh
```

### Using npm/pnpm

```bash
pnpm dev:custom
```

### Check Server Health

```bash
./check-health.sh
```

## Features

### 1. Memory Management

- **Soft Limit**: Throttles new requests when memory exceeds threshold
- **Hard Limit**: Triggers graceful restart if memory continues to grow
- **Automatic GC**: Forces garbage collection at soft limit
- **Recovery Buffer**: Hysteresis to prevent rapid on/off cycling

### 2. Rate Limiting

- Per-IP request tracking
- Configurable time windows
- Automatic cleanup of old entries

### 3. Connection Management

- Concurrent request limits
- Request timeouts (30s default)
- Graceful connection handling

### 4. Health Endpoints

#### `/api/health`

Basic health check with uptime and memory pressure status:

```bash
curl http://localhost:3005/api/health
```

Response:

```json
{
  "status": "ok",
  "uptime": 123.45,
  "activeRequests": 5,
  "memoryPressure": {
    "pressureActive": false,
    "lastTriggeredAt": 0,
    "forcedRestartScheduled": false
  },
  "timestamp": "2025-11-16T12:00:00.000Z"
}
```

#### `/api/runtime-info`

Detailed runtime diagnostics:

```bash
curl http://localhost:3005/api/runtime-info
```

Response:

```json
{
  "memory": {
    "heapUsed": 1234567890,
    "heapTotal": 2345678901,
    "rss": 3456789012
  },
  "memoryState": {
    "pressureActive": false,
    "lastTriggeredAt": 0,
    "forcedRestartScheduled": false
  },
  "lastSnapshotPath": null,
  "snapshotEnabled": false
}
```

#### Heap Snapshots (Optional)

Enable heap snapshots for debugging:

```bash
ALLOW_HEAP_SNAPSHOT=1 ./start-dev.sh
```

Then capture a snapshot:

```bash
curl "http://localhost:3005/api/runtime-info?snapshot=1"
```

The snapshot will be saved to `/tmp/heap-<timestamp>.heapsnapshot` and can be analyzed in Chrome DevTools.

## Configuration

All settings are configurable via environment variables:

### Memory Settings

```bash
# Soft limit - starts throttling requests (MB)
MEMORY_SOFT_LIMIT_MB=6144

# Hard limit - triggers restart (MB)
MEMORY_HARD_LIMIT_MB=7168

# Recovery buffer - hysteresis margin (MB)
MEMORY_RECOVERY_BUFFER_MB=512

# Time to wait before forced restart (ms)
FORCE_SHUTDOWN_DELAY_MS=10000

# Memory check interval (ms)
MEMORY_CHECK_INTERVAL_MS=30000
```

### Connection Settings

```bash
# Maximum concurrent requests
MAX_CONCURRENT_REQUESTS=100

# Rate limit window (ms)
RATE_LIMIT_WINDOW_MS=60000

# Max requests per window per IP
MAX_REQUESTS_PER_WINDOW=1000
```

### Server Settings

```bash
# Server host
HOST=0.0.0.0

# Server port
PORT=3005

# Node.js max heap size (MB)
MAX_OLD_SPACE_SIZE=8192

# Max HTTP header size (bytes)
MAX_HTTP_HEADER_SIZE=80000
```

### Cleanup Settings

```bash
# Cleanup interval for rate limit entries (ms)
CLEANUP_INTERVAL_MS=120000

# Memory pressure cooldown (ms)
MEMORY_PRESSURE_COOLDOWN_MS=120000
```

## Example Configurations

### Development (Low Memory)

```bash
MAX_OLD_SPACE_SIZE=4096 \
MEMORY_SOFT_LIMIT_MB=3072 \
MEMORY_HARD_LIMIT_MB=3584 \
./start-dev.sh
```

### Production (High Traffic)

```bash
MAX_OLD_SPACE_SIZE=8192 \
MEMORY_SOFT_LIMIT_MB=6144 \
MEMORY_HARD_LIMIT_MB=7168 \
MAX_CONCURRENT_REQUESTS=200 \
MAX_REQUESTS_PER_WINDOW=2000 \
./start-dev.sh
```

### Debug Mode (With Heap Snapshots)

```bash
ALLOW_HEAP_SNAPSHOT=1 \
MAX_OLD_SPACE_SIZE=8192 \
./start-dev.sh
```

## Monitoring

### Watch Memory in Real-Time

The server logs memory usage every 30 seconds:

```
[Memory] Heap: 2048/4096MB, RSS: 3072MB, Active Requests: 15
```

### Health Checks in Scripts

```bash
# Simple health check
if curl -sf http://localhost:3005/api/health > /dev/null; then
  echo "Server is healthy"
fi

# Check for memory pressure
if curl -s http://localhost:3005/api/health | grep -q '"pressureActive":true'; then
  echo "Server under memory pressure!"
fi
```

### Load Testing

```bash
# Simple load test
for i in {1..100}; do
  curl -s http://localhost:3005/api/health &
done
wait

# Check results
./check-health.sh
```

## Troubleshooting

### Port Already in Use

```bash
# The script automatically handles this, but manual cleanup:
lsof -ti:3005 | xargs kill -9
```

### High Memory Usage

1. Check current usage: `./check-health.sh`
2. Enable heap snapshots: `ALLOW_HEAP_SNAPSHOT=1`
3. Capture snapshot: `curl "http://localhost:3005/api/runtime-info?snapshot=1"`
4. Analyze in Chrome DevTools (Memory > Load Profile)

### Server Keeps Restarting

- Lower `MEMORY_HARD_LIMIT_MB`
- Increase `MAX_OLD_SPACE_SIZE`
- Check for memory leaks in application code

### Rate Limit Errors

Increase limits:

```bash
MAX_REQUESTS_PER_WINDOW=2000 \
RATE_LIMIT_WINDOW_MS=60000 \
./start-dev.sh
```

## npm Scripts

Add these to your workflow:

```json
{
  "scripts": {
    "dev:custom": "NODE_OPTIONS=\"--expose-gc --max-old-space-size=8192\" node dev-server.js",
    "dev:low-mem": "MAX_OLD_SPACE_SIZE=4096 MEMORY_SOFT_LIMIT_MB=3072 ./start-dev.sh",
    "dev:debug": "ALLOW_HEAP_SNAPSHOT=1 ./start-dev.sh",
    "health": "./check-health.sh"
  }
}
```

## Production Deployment

For production, use PM2 or similar process manager:

```bash
pm2 start dev-server.js \
  --name "next-app" \
  --node-args="--expose-gc --max-old-space-size=8192" \
  --env PORT=3005 \
  --env MEMORY_SOFT_LIMIT_MB=6144 \
  --env MEMORY_HARD_LIMIT_MB=7168
```

Or with Docker:

```dockerfile
CMD ["node", "--expose-gc", "--max-old-space-size=8192", "dev-server.js"]
```

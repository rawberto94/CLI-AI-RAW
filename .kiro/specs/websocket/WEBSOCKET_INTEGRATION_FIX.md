# WebSocket Integration - Critical Fix Required

## 🔴 Issue Identified

The WebSocket implementation exists but **Socket.IO dependencies are missing** from package.json!

### Current Status:
- ✅ WebSocket server code exists (`apps/web/server.js`)
- ✅ WebSocket hooks exist (`apps/web/lib/websocket/`)
- ✅ Components using WebSocket exist
- ❌ **Socket.IO dependencies NOT installed**
- ❌ **WebSocket server NOT running**

---

## 🔧 Required Fixes

### 1. Install Socket.IO Dependencies

Add to `apps/web/package.json`:

```json
{
  "dependencies": {
    "socket.io": "^4.7.2",
    "socket.io-client": "^4.7.2"
  }
}
```

### 2. Update Server Start Script

The custom server (`apps/web/server.js`) needs to be used instead of default Next.js server.

**Current** (`apps/web/package.json`):
```json
{
  "scripts": {
    "dev": "next dev -H 0.0.0.0 -p 3005",
    "start": "next start"
  }
}
```

**Should be**:
```json
{
  "scripts": {
    "dev": "node server.js",
    "dev:next": "next dev -H 0.0.0.0 -p 3005",
    "start": "NODE_ENV=production node server.js",
    "start:next": "next start"
  }
}
```

---

## 📋 Complete Fix Steps

### Step 1: Install Dependencies

```bash
cd apps/web
npm install socket.io@^4.7.2 socket.io-client@^4.7.2
# or
pnpm add socket.io@^4.7.2 socket.io-client@^4.7.2
```

### Step 2: Update package.json Scripts

Update `apps/web/package.json` scripts section.

### Step 3: Restart Server

```bash
# Stop current server (Ctrl+C)

# Start with WebSocket support
cd apps/web
npm run dev
# or
pnpm dev
```

### Step 4: Verify WebSocket Connection

Check browser console for:
```
Socket connected: <socket-id>
User <user-id> authenticated
```

---

## 🧪 Testing WebSocket

### Test 1: Check Server Logs

When server starts, you should see:
```
> Ready on http://0.0.0.0:3005
> WebSocket server ready on ws://0.0.0.0:3005/api/socket
```

### Test 2: Check Browser Console

Open any page with WebSocket usage and check console:
```javascript
// Should see:
Socket connected: abc123
User demo-user-id authenticated
```

### Test 3: Test Progress Updates

Upload a contract and watch for real-time progress updates in the UI.

---

## 📍 Where WebSocket is Used

### 1. Batch Upload Queue
**File**: `apps/web/components/upload/BatchUploadQueue.tsx`
**Usage**: Real-time upload progress tracking

### 2. Multi-Stage Progress
**File**: `apps/web/components/progress/MultiStageProgress.tsx`
**Usage**: Contract processing progress updates

### 3. Background Jobs Panel
**File**: `apps/web/components/background-jobs/BackgroundJobsPanel.tsx`
**Usage**: Background job status updates

---

## 🔍 Verification Checklist

After applying fixes:

- [ ] Socket.IO dependencies installed
- [ ] Server starts with custom server.js
- [ ] WebSocket server initializes
- [ ] Browser connects to WebSocket
- [ ] Authentication works
- [ ] Progress updates received
- [ ] Background jobs update in real-time

---

## 🚨 Current Impact

### What's NOT Working:
- ❌ Real-time progress updates during contract upload
- ❌ Live background job status updates
- ❌ Real-time notifications
- ❌ Multi-stage progress tracking

### What Still Works:
- ✅ Contract upload (without real-time progress)
- ✅ Background jobs (without real-time updates)
- ✅ All other features

---

## 📝 Implementation Details

### WebSocket Server Architecture

```
┌─────────────────────────────────────────┐
│         Custom Next.js Server           │
│            (server.js)                  │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │   Next.js    │  │   Socket.IO     │ │
│  │   HTTP       │  │   WebSocket     │ │
│  │   Server     │  │   Server        │ │
│  └──────────────┘  └─────────────────┘ │
│         │                   │           │
└─────────┼───────────────────┼───────────┘
          │                   │
          ▼                   ▼
    HTTP Requests      WebSocket Events
```

### Event Flow

```
1. Client connects → Socket.IO handshake
2. Client authenticates → Join user room
3. Client subscribes → Join job/topic room
4. Server emits event → Sent to room subscribers
5. Client receives → Update UI
```

### Room Structure

- `user:{userId}` - User-specific events
- `job:{jobId}` - Job-specific progress
- `background-jobs:{userId}` - User's background jobs

---

## 🎯 Quick Fix Commands

```bash
# 1. Install dependencies
cd apps/web
pnpm add socket.io@^4.7.2 socket.io-client@^4.7.2

# 2. Update scripts (manual edit of package.json)

# 3. Restart server
pnpm dev

# 4. Test in browser
# Open http://localhost:3005
# Check console for "Socket connected"
```

---

## 📚 Related Files

### Server Files:
- `apps/web/server.js` - Custom server with Socket.IO
- `apps/web/lib/websocket/socket-server.ts` - Server utilities
- `apps/web/lib/websocket/emit.ts` - Event emitters

### Client Files:
- `apps/web/lib/websocket/use-socket.ts` - React hooks
- `apps/web/components/upload/BatchUploadQueue.tsx` - Usage example
- `apps/web/components/progress/MultiStageProgress.tsx` - Usage example
- `apps/web/components/background-jobs/BackgroundJobsPanel.tsx` - Usage example

---

## ✅ After Fix is Applied

### Expected Behavior:

1. **Server Startup**:
   ```
   ✅ Environment validation passed
   🚀 Initializing Unified Orchestration Service...
   ✅ Unified Orchestration Service initialized
   > Ready on http://0.0.0.0:3005
   > WebSocket server ready on ws://0.0.0.0:3005/api/socket
   ```

2. **Client Connection**:
   ```
   Socket connected: abc123def456
   User demo-user-id authenticated
   Socket abc123def456 subscribed to job job-789
   ```

3. **Progress Updates**:
   ```
   Progress update emitted for job job-789: extraction - 25%
   Progress update emitted for job job-789: extraction - 50%
   Progress update emitted for job job-789: extraction - 75%
   Progress update emitted for job job-789: extraction - 100%
   ```

---

## 🔄 Migration Path

### For Existing Deployments:

1. **Development**:
   - Install dependencies
   - Update scripts
   - Restart dev server

2. **Staging**:
   - Update package.json
   - Run `pnpm install`
   - Update start command
   - Restart service

3. **Production**:
   - Schedule maintenance window
   - Update dependencies
   - Update start command
   - Deploy and restart
   - Monitor WebSocket connections

---

## 📞 Support

### If WebSocket Still Not Working:

1. **Check Dependencies**:
   ```bash
   npm list socket.io socket.io-client
   ```

2. **Check Server Logs**:
   Look for "WebSocket server ready" message

3. **Check Browser Console**:
   Look for connection errors

4. **Check Firewall**:
   Ensure WebSocket port is open

5. **Check CORS**:
   Verify CORS settings in server.js

---

**Status**: 🔴 **CRITICAL - REQUIRES IMMEDIATE FIX**
**Priority**: **HIGH**
**Impact**: Real-time features not working
**Effort**: 5-10 minutes to fix

---

**Created**: October 21, 2025
**Last Updated**: October 21, 2025

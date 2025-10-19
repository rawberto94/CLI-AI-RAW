/**
 * Custom Next.js Server with Socket.IO Support
 * 
 * This custom server enables WebSocket support via Socket.IO
 * alongside Next.js's standard HTTP server.
 */

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'

// Validate environment variables before starting (after NODE_ENV is set)
try {
  // Load environment validator
  const { validateEnvironmentOrThrow } = require('../../packages/data-orchestration/src/utils/env-validator')
  validateEnvironmentOrThrow()
  console.log('✅ Environment validation passed')
} catch (error) {
  console.error('❌ Environment validation failed:')
  console.error(error.message)
  console.error('\nPlease check your .env file and ensure all required variables are set.')
  console.error('See .env.example for reference.\n')
  process.exit(1)
}
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.PORT || '3005', 10)

// Initialize Next.js app
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(async () => {
  // Initialize Unified Orchestration
  try {
    console.log('🚀 Initializing Unified Orchestration Service...')
    const { unifiedOrchestrationService } = require('../../packages/data-orchestration/src/services/unified-orchestration.service')
    await unifiedOrchestrationService.initialize()
    console.log('✅ Unified Orchestration Service initialized')
    console.log('   → All systems are now connected and orchestrated!')
  } catch (error) {
    console.error('⚠️  Failed to initialize orchestration:', error.message)
    console.error('   → System will continue but integrations may not work')
  }

  // Create HTTP server
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Initialize Socket.IO
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${port}`,
      methods: ['GET', 'POST'],
      credentials: true
    },
    path: '/api/socket',
    transports: ['websocket', 'polling']
  })

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // Handle authentication
    socket.on('authenticate', async (data) => {
      try {
        // TODO: Implement actual authentication
        socket.data.userId = data.userId
        socket.data.authenticated = true

        // Join user-specific room
        socket.join(`user:${data.userId}`)

        socket.emit('authenticated', { success: true })
        console.log(`User ${data.userId} authenticated`)
      } catch (error) {
        socket.emit('authentication_error', { error: 'Authentication failed' })
      }
    })

    // Subscribe to specific job updates
    socket.on('subscribe:job', (jobId) => {
      if (!socket.data.authenticated) {
        socket.emit('error', { message: 'Not authenticated' })
        return
      }

      socket.join(`job:${jobId}`)
      console.log(`Socket ${socket.id} subscribed to job ${jobId}`)
    })

    // Unsubscribe from job updates
    socket.on('unsubscribe:job', (jobId) => {
      socket.leave(`job:${jobId}`)
      console.log(`Socket ${socket.id} unsubscribed from job ${jobId}`)
    })

    // Subscribe to background jobs
    socket.on('subscribe:background-jobs', () => {
      if (!socket.data.authenticated) {
        socket.emit('error', { message: 'Not authenticated' })
        return
      }

      const userId = socket.data.userId
      socket.join(`background-jobs:${userId}`)
      console.log(`Socket ${socket.id} subscribed to background jobs for user ${userId}`)
    })

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error)
    })
  })

  // Make io instance available globally for API routes
  global.io = io

  // Start server
  httpServer
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
      console.log(`> WebSocket server ready on ws://${hostname}:${port}/api/socket`)
    })
})

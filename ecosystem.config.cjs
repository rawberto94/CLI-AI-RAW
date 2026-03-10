/**
 * PM2 Ecosystem Configuration
 * Production-ready process management with auto-restart and monitoring
 */
module.exports = {
  apps: [
    // === DEVELOPMENT ===
    {
      name: 'contigo-web-dev',
      cwd: './apps/web',
      script: 'pnpm',
      args: 'run dev',
      env: {
        NODE_ENV: 'development',
        PORT: 3002
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    
    // === PRODUCTION WEB APP ===
    {
      name: 'contigo-web',
      cwd: './apps/web',
      script: 'node_modules/.bin/next',
      args: 'start',
      instances: 'max', // Use all available CPUs
      exec_mode: 'cluster', // Enable cluster mode for load balancing
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Reliability settings
      autorestart: true,
      max_restarts: 50, // Max restarts before giving up
      min_uptime: '30s', // Min time to consider app successfully started
      restart_delay: 5000, // Delay between restarts (5 seconds)
      exp_backoff_restart_delay: 100, // Exponential backoff starting point
      
      // Memory management
      max_memory_restart: '1G', // Restart if memory exceeds 1GB
      
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      merge_logs: true,
      
      // Graceful shutdown
      kill_timeout: 35000, // Wait 35s before force kill (must exceed app's 30s shutdown timeout)
      wait_ready: false, // Next.js standalone doesn't call process.send('ready')
      listen_timeout: 30000, // Max time to wait for ready signal
      
      // Health monitoring
      instance_var: 'INSTANCE_ID'
    },
    
    // === PRODUCTION WORKERS ===
    {
      name: 'contigo-workers',
      cwd: './packages/workers',
      script: 'dist/index.js',
      instances: 2, // Run 2 worker instances
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production'
      },
      autorestart: true,
      max_restarts: 100, // Workers can restart more frequently
      min_uptime: '10s',
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: '2G', // Workers may need more memory
      
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/workers-error.log',
      out_file: './logs/workers-out.log',
      merge_logs: true,
      
      kill_timeout: 30000, // Give workers more time to finish jobs
    },
    
    // === WEBSOCKET SERVER ===
    {
      name: 'contigo-websocket',
      cwd: './apps/web',
      script: 'dist/server/start-websocket.js',
      instances: 1, // Single instance for WebSocket
      env_production: {
        NODE_ENV: 'production',
        WS_PORT: 3001
      },
      autorestart: true,
      max_restarts: 50,
      min_uptime: '30s',
      restart_delay: 5000,
      max_memory_restart: '512M',
      
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/websocket-error.log',
      out_file: './logs/websocket-out.log',
      merge_logs: true,
      
      kill_timeout: 15000
    },
    
    // === CONTRACT SOURCE SYNC WORKER ===
    {
      name: 'contigo-contract-sync',
      cwd: './packages/workers',
      script: 'dist/contract-source-sync-worker.js',
      instances: 1, // Single instance for sync operations
      env_production: {
        NODE_ENV: 'production',
        REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379'
      },
      autorestart: true,
      max_restarts: 50,
      min_uptime: '30s',
      restart_delay: 5000,
      max_memory_restart: '1G',
      
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/contract-sync-error.log',
      out_file: './logs/contract-sync-out.log',
      merge_logs: true,
      
      kill_timeout: 60000, // Allow time to finish current sync
      
      // Watch for source changes
      watch: false
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: ['server1.example.com'],
      ref: 'origin/main',
      repo: 'git@github.com:rawberto94/CLI-AI-RAW.git',
      path: '/var/www/contigo',
      'pre-deploy-local': '',
      'post-deploy': 'pnpm install && pnpm build && pm2 reload ecosystem.config.cjs --env production',
      'pre-setup': ''
    }
  }
};

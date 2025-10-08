module.exports = {
  apps: [
    {
      name: 'contract-intelligence-web',
      cwd: './apps/web',
      script: 'npm',
      args: 'run dev',
      env: {
        NODE_ENV: 'development',
        PORT: 3002
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};

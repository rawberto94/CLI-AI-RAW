#!/usr/bin/env node
// 🚀 Unified Contract Intelligence Launcher
// 
// Detects environment (local Docker vs GitHub Codespaces) and provides
// intelligent orchestration for infrastructure, database, and services
//
// Usage:
//   pnpm launch                 # full: infra + db + kill-ports + api+web+workers
//   pnpm launch api             # only API dev
//   pnpm launch web             # only Web dev  
//   pnpm launch workers         # only Workers dev
//   pnpm launch both            # API + Web dev (skip infra/db if already running)
//   pnpm launch start           # build + start all in production mode
//   pnpm launch start api       # build + start API only (prod)
//   pnpm launch start web       # build + start Web only (prod)
//   pnpm launch start workers   # build + start Workers only (prod)
//   pnpm launch health          # health checks only
//   pnpm launch stop            # free ports 3001/3002/3003
//   pnpm launch setup           # setup environment and dependencies
//   pnpm launch env             # show detected environment and config
//
// Flags:
//   --no-infra  --no-db  --open  --worker-only  --direct  --codespaces  --local

import { execSync, spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import readline from 'node:readline';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

// 🔍 Environment Detection
function detectEnvironment() {
  // Check for Codespaces environment variables
  const isCodespaces = !!(
    process.env.CODESPACES || 
    process.env.CODESPACE_NAME ||
    process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
  );
  
  // Check for Docker availability (local development)
  let hasDocker = false;
  try {
    execSync('docker --version', { stdio: 'ignore' });
    hasDocker = true;
  } catch {
    hasDocker = false;
  }

  // Check if we're in a dev container
  const isDevContainer = !!(
    process.env.DEVCONTAINER ||
    existsSync('/.dockerenv') ||
    existsSync('/workspace')
  );

  return {
    isCodespaces,
    isDevContainer,
    hasDocker,
    isLocal: !isCodespaces && !isDevContainer,
    platform: process.platform,
  };
}

const ENV = detectEnvironment();

// 🛠️ Environment-specific configuration
function getEnvironmentConfig() {
  if (ENV.isCodespaces || ENV.isDevContainer) {
    return {
      // Codespaces/DevContainer environment
      DATABASE_URL: 'postgresql://postgres:postgres@postgres:5432/contract_intelligence',
      REDIS_URL: 'redis://redis:6379',
      S3_ENDPOINT: 'http://minio:9000',
      S3_ACCESS_KEY_ID: 'minioadmin', 
      S3_SECRET_ACCESS_KEY: 'minioadmin',
      S3_BUCKET: 'contracts',
      MINIO_ENDPOINT: 'minio:9000',
      MINIO_ACCESS_KEY: 'minioadmin',
      MINIO_SECRET_KEY: 'minioadmin',
      MINIO_BUCKET: 'contracts',
      NEXT_PUBLIC_API_URL: 'http://localhost:3001',
      DEMO_API_KEY: 'demo-board-2025',
      NODE_ENV: 'development',
      needsInfra: false, // Services provided by docker-compose in devcontainer
    };
  } else {
    return {
      // Local Docker environment
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/contract_intelligence',
      REDIS_URL: 'redis://localhost:6379',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY_ID: 'minioadmin',
      S3_SECRET_ACCESS_KEY: 'minioadmin', 
      S3_BUCKET: 'contracts',
      NEXT_PUBLIC_API_URL: 'http://localhost:3001',
      DEMO_API_KEY: 'demo-board-2025',
      NODE_ENV: 'development',
      needsInfra: true, // Need to start Docker services locally
    };
  }
}

// Provide sane defaults for local infra when env vars are missing.
function childEnv(overrides = {}) {
  const config = getEnvironmentConfig();
  return {
    ...process.env,
    ...config,
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    ...overrides,
  };
}

function sh(cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT, shell: true, ...opts });
    return true;
  } catch {
    return false;
  }
}

async function waitHttp(url, timeoutMs = 30000, intervalMs = 800) {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < timeoutMs) {
    attempt++;
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return true;
    } catch {
      // Connection failed, continue retrying
    }
    const backoff = Math.min(intervalMs * Math.pow(1.15, attempt), 3000);
    await sleep(backoff);
  }
  return false;
}

async function startInfra() {
  const config = getEnvironmentConfig();
  
  if (!config.needsInfra) {
    console.log('\n[infra] Running in Codespaces/DevContainer - infrastructure provided');
    return;
  }

  console.log('\n[infra] Starting infrastructure (Docker Compose)…');
  
  if (!ENV.hasDocker) {
    console.warn('⚠️  Docker not available. Please install Docker or use GitHub Codespaces.');
    console.log('💡 Alternative: Create a GitHub Codespace for zero-setup development');
    return false;
  }

  const success = sh('docker compose -f infra/docker-compose.yml up -d');
  if (!success) {
    console.error('❌ Failed to start Docker infrastructure');
    return false;
  }

  await sleep(1500);
  
  // Wait for Postgres to be ready
  console.log('[infra] Waiting for PostgreSQL to be ready…');
  let pgReady = false;
  for (let i = 0; i < 20; i++) {
    const ok = sh('docker compose -f infra/docker-compose.yml exec -T postgres sh -c "pg_isready -U postgres"', { stdio: 'ignore' });
    if (ok) { 
      pgReady = true;
      break; 
    }
    await sleep(1000);
  }

  if (!pgReady) {
    console.warn('⚠️  PostgreSQL health check timed out - continuing anyway');
  }

  // Setup MinIO bucket
  console.log('[infra] Configuring MinIO storage…');
  const minioOk = sh('docker compose -f infra/docker-compose.yml exec -T minio sh -c "mc alias set local http://localhost:9000 minioadmin minioadmin && mc mb -p local/contracts || true"', { stdio: 'ignore' });
  if (!minioOk) {
    console.warn('[infra] MinIO bucket setup failed (optional)');
  }

  return true;
}

async function setupEnvironment() {
  console.log('\n🛠️  Environment Setup');
  console.log('━'.repeat(50));
  
  const config = getEnvironmentConfig();
  
  // Create .env files if needed
  await createEnvFiles(config);
  
  // Install dependencies
  console.log('📦 Installing dependencies…');
  const installOk = sh('pnpm install');
  if (!installOk) {
    console.error('❌ Failed to install dependencies');
    return false;
  }

  // Start infrastructure if needed
  if (config.needsInfra) {
    const infraOk = await startInfra();
    if (!infraOk) {
      console.error('❌ Infrastructure setup failed');
      return false;
    }
  } else {
    console.log('✅ Infrastructure provided by environment');
  }

  // Setup database
  console.log('🗄️  Setting up database…');
  const dbOk = sh('pnpm db:push');
  if (!dbOk) {
    console.warn('⚠️  Database setup failed - check connection');
  }

  console.log('✅ Environment setup complete!');
  return true;
}

async function createEnvFiles(config) {
  console.log('📝 Creating environment files…');

  // Root .env
  if (!existsSync(join(ROOT, '.env'))) {
    const rootEnv = `# Contract Intelligence Environment
# Generated by launcher on ${new Date().toISOString()}

# Database
DATABASE_URL=${config.DATABASE_URL}

# Redis  
REDIS_URL=${config.REDIS_URL}

# MinIO/S3
S3_ENDPOINT=${config.S3_ENDPOINT}
S3_ACCESS_KEY_ID=${config.S3_ACCESS_KEY_ID}
S3_SECRET_ACCESS_KEY=${config.S3_SECRET_ACCESS_KEY}
S3_BUCKET=${config.S3_BUCKET}

# Development
NODE_ENV=${config.NODE_ENV}
DEMO_API_KEY=${config.DEMO_API_KEY}

# Ports
API_PORT=3001
WEB_PORT=3002
WORKERS_PORT=3003
`;
    writeFileSync(join(ROOT, '.env'), rootEnv);
    console.log('   ✅ Created .env');
  }

  // API .env
  const apiEnvPath = join(ROOT, 'apps/api/.env');
  if (!existsSync(apiEnvPath)) {
    writeFileSync(apiEnvPath, `# API Environment
DATABASE_URL=${config.DATABASE_URL}
REDIS_URL=${config.REDIS_URL}
S3_ENDPOINT=${config.S3_ENDPOINT}
S3_ACCESS_KEY_ID=${config.S3_ACCESS_KEY_ID}
S3_SECRET_ACCESS_KEY=${config.S3_SECRET_ACCESS_KEY}
S3_BUCKET=${config.S3_BUCKET}
DEMO_API_KEY=${config.DEMO_API_KEY}
NODE_ENV=${config.NODE_ENV}
`);
    console.log('   ✅ Created apps/api/.env');
  }

  // Web .env.local
  const webEnvPath = join(ROOT, 'apps/web/.env.local');
  if (!existsSync(webEnvPath)) {
    writeFileSync(webEnvPath, `# Web Environment
NEXT_PUBLIC_API_URL=${config.NEXT_PUBLIC_API_URL}
NEXTAUTH_URL=http://localhost:3002
NEXTAUTH_SECRET=development-secret-key-change-in-production
`);
    console.log('   ✅ Created apps/web/.env.local');
  }
}

function showEnvironmentInfo() {
  console.log('\n🔍 Environment Information');
  console.log('━'.repeat(50));
  console.log(`Platform: ${ENV.platform}`);
  console.log(`Environment: ${ENV.isCodespaces ? 'GitHub Codespaces' : ENV.isDevContainer ? 'Dev Container' : 'Local'}`);
  console.log(`Docker Available: ${ENV.hasDocker ? '✅' : '❌'}`);
  console.log(`Infrastructure Mode: ${getEnvironmentConfig().needsInfra ? 'Local Docker' : 'Container Services'}`);
  
  const config = getEnvironmentConfig();
  console.log('\n📋 Configuration:');
  console.log(`  Database: ${config.DATABASE_URL}`);
  console.log(`  Redis: ${config.REDIS_URL}`);
  console.log(`  S3/MinIO: ${config.S3_ENDPOINT}`);
  console.log(`  API URL: ${config.NEXT_PUBLIC_API_URL}`);
  console.log(`  Demo API Key: ${config.DEMO_API_KEY ? '✅ Set' : '❌ Missing'}`);
}

function dbPush() {
  console.log('\n[db] Syncing database schema…');
  const ok = sh('pnpm --filter clients-db db:push');
  if (!ok) console.warn('[db] DB push failed or skipped. Check apps/api/.env');
}

function killPorts() {
  console.log('\n[ports] Freeing 3001 (API), 3002 (Web), and 3003 (Workers)…');
  // Use a BSD/macOS-safe pattern (no GNU-specific -r). If no PIDs, xargs will not invoke kill.
  sh("lsof -ti :3001 | xargs kill -9 2>/dev/null || true");
  sh("lsof -ti :3002 | xargs kill -9 2>/dev/null || true");
  sh("lsof -ti :3003 | xargs kill -9 2>/dev/null || true");
}

function startApi(envOverrides = {}) {
  console.log('\n[api] Starting API dev at :3001…');
  const child = spawn('pnpm', ['dev'], {
    cwd: `${ROOT}/apps/api`,
    stdio: 'inherit',
    shell: true,
    env: childEnv({ ...envOverrides }),
  });
  child.on('exit', (c, s) => console.log(`[api] exited (code=${c}, signal=${s})`));
  return child;
}

function startWeb(envOverrides = {}) {
  console.log('\n[web] Starting Web dev at :3002…');
  const child = spawn('pnpm', ['dev'], { cwd: `${ROOT}/apps/web`, stdio: 'inherit', shell: true, env: childEnv(envOverrides) });
  child.on('exit', (c, s) => console.log(`[web] exited (code=${c}, signal=${s})`));
  return child;
}

function buildApi() {
  console.log('\n[api] Building API…');
  return sh('pnpm --filter api build');
}

function buildWeb() {
  console.log('\n[web] Building Web…');
  return sh('pnpm --filter web build');
}

function startApiProd(envOverrides = {}) {
  console.log('\n[api] Starting API (prod) at :3001…');
  const child = spawn('pnpm', ['start'], {
    cwd: `${ROOT}/apps/api`,
    stdio: 'inherit',
    shell: true,
  env: childEnv(envOverrides),
  });
  child.on('exit', (c, s) => console.log(`[api] exited (code=${c}, signal=${s})`));
  return child;
}

function startWebProd(envOverrides = {}) {
  console.log('\n[web] Starting Web (prod) at :3002…');
  // Use explicit port to match dev port
  const child = spawn('pnpm', ['start:3002'], { cwd: `${ROOT}/apps/web`, stdio: 'inherit', shell: true, env: childEnv(envOverrides) });
  child.on('exit', (c, s) => console.log(`[web] exited (code=${c}, signal=${s})`));
  return child;
}

function startWorkersDev(envOverrides = {}) {
  console.log('\n[workers] Starting Workers dev…');
  const child = spawn('pnpm', ['dev'], { cwd: `${ROOT}/apps/workers`, stdio: 'inherit', shell: true, env: childEnv(envOverrides) });
  child.on('exit', (c, s) => console.log(`[workers] exited (code=${c}, signal=${s})`));
  return child;
}

function startWorkersProd(envOverrides = {}) {
  console.log('\n[workers] Starting Workers (prod)…');
  const child = spawn('pnpm', ['start'], { cwd: `${ROOT}/apps/workers`, stdio: 'inherit', shell: true, env: childEnv(envOverrides) });
  child.on('exit', (c, s) => console.log(`[workers] exited (code=${c}, signal=${s})`));
  return child;
}

async function health(openBrowser = false) {
  const apiUrl = 'http://localhost:3001/healthz';
  const webUrl = 'http://localhost:3002/api/web-health';
  const apiOk = await waitHttp(apiUrl, 60000);
  const webOk = await waitHttp(webUrl, 60000);
  console.log(`\n[health] API=${apiOk ? 'OK' : 'timeout'} (${apiUrl}) | Web=${webOk ? 'OK' : 'timeout'} (${webUrl})`);
  if (openBrowser && webOk) sh('open http://localhost:3002/');
}

function printHelp() {
  console.log('🚀 Contract Intelligence Launcher');
  console.log('━'.repeat(50));
  console.log('Universal launcher with automatic environment detection\n');
  
  console.log('Usage: pnpm launch [command] [options]\n');
  
  console.log('Commands:');
  console.log('  <none>          Start full development environment (default)');
  console.log('  api             Start API server only');
  console.log('  web             Start Web server only');
  console.log('  workers         Start Workers only');
  console.log('  both            Start API + Web (skip infra if running)');
  console.log('  start           Build and start in production mode');
  console.log('  start api       Build and start API only (production)');
  console.log('  start web       Build and start Web only (production)');
  console.log('  start workers   Build and start Workers only (production)');
  console.log('  health          Run health checks');
  console.log('  stop            Stop all services and free ports');
  console.log('  setup           Setup environment and dependencies');
  console.log('  env             Show environment info and configuration');
  console.log('  help            Show this help\n');
  
  console.log('Options:');
  console.log('  --no-infra      Skip infrastructure startup');
  console.log('  --no-db         Skip database setup');
  console.log('  --open          Open browser after startup');
  console.log('  --worker-only   Force worker-only processing (API)');
  console.log('  --direct        Force direct extraction (API)');
  console.log('  --codespaces    Force Codespaces environment mode');
  console.log('  --local         Force local Docker environment mode\n');
  
  console.log('Environment Detection:');
  console.log('  • Local:        Uses Docker Compose for infrastructure');
  console.log('  • Codespaces:   Uses pre-configured container services');
  console.log('  • Dev Container: Uses Docker Compose services\n');
  
  console.log('Examples:');
  console.log('  pnpm launch              # Full development environment');
  console.log('  pnpm launch setup        # One-time environment setup');
  console.log('  pnpm launch api --open   # API only with browser');
  console.log('  pnpm launch start        # Production build and start');
  console.log('  pnpm launch env          # Show current configuration');
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args.find(a => !a.startsWith('--')) || 'both';
  const subcmd = args.filter(a => !a.startsWith('--'))[1];
  const noInfra = args.includes('--no-infra');
  const noDb = args.includes('--no-db');
  const open = args.includes('--open');
  const flagWorkerOnly = args.includes('--worker-only');
  const flagDirect = args.includes('--direct');
  const forceCodespaces = args.includes('--codespaces');
  const forceLocal = args.includes('--local');

  // Override environment detection if requested
  if (forceCodespaces) {
    ENV.isCodespaces = true;
    ENV.isLocal = false;
  } else if (forceLocal) {
    ENV.isCodespaces = false;
    ENV.isLocal = true;
  }

  // Determine override for API extraction mode
  const analysisDirectOverride = flagDirect ? 'true' : (flagWorkerOnly ? 'false' : undefined);
  const apiEnvOverride = analysisDirectOverride ? { ANALYSIS_DIRECT_EXTRACTION: analysisDirectOverride } : {};

  console.log('🚀 Contract Intelligence Launcher');
  console.log('━'.repeat(50));
  console.log(`Environment: ${ENV.isCodespaces ? 'GitHub Codespaces' : ENV.isDevContainer ? 'Dev Container' : 'Local'}`);
  console.log(`Repository: ${ROOT}`);
  console.log('');

  // Handle commands
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printHelp();
    return;
  }

  if (cmd === 'env') {
    showEnvironmentInfo();
    return;
  }

  if (cmd === 'setup') {
    const success = await setupEnvironment();
    if (success) {
      console.log('\n🎉 Setup complete! You can now run:');
      console.log('  pnpm launch         # Start development environment');
      console.log('  pnpm launch health  # Check service health');
      console.log('  pnpm launch env     # Show configuration');
    }
    process.exit(success ? 0 : 1);
  }

  if (cmd === 'stop') {
    killPorts();
    return;
  }

  // Start infrastructure and database setup (unless skipped)
  if (!noInfra) {
    const infraStarted = await startInfra();
    if (!infraStarted && getEnvironmentConfig().needsInfra) {
      console.error('❌ Infrastructure startup failed');
      process.exit(1);
    }
  }
  
  if (!noDb) {
    dbPush();
  }
  
  killPorts();

  // Individual service commands
  if (cmd === 'api') {
    console.log('🔧 Starting API development server…');
    const api = startApi(apiEnvOverride);
    // Start workers alongside API for better development experience
    try { 
      startWorkersDev(apiEnvOverride); 
    } catch (error) {
      console.warn('⚠️  Workers startup failed:', error.message);
    }
    await health(open);
    api.on('exit', () => process.exit(0));
    if (open) {
      sh('open http://localhost:3001/docs || open http://localhost:3001/healthz');
    }
    return;
  }

  if (cmd === 'web') {
    console.log('🌐 Starting Web development server…');
    const web = startWeb(apiEnvOverride);
    await health(open);
    web.on('exit', () => process.exit(0));
    if (open) {
      sh('open http://localhost:3002/');
    }
    return;
  }

  if (cmd === 'workers') {
    console.log('⚙️  Starting Workers development server…');
    const workers = startWorkersDev(apiEnvOverride);
    workers.on('exit', () => process.exit(0));
    process.on('SIGINT', () => workers.kill('SIGINT'));
    process.on('SIGTERM', () => workers.kill('SIGTERM'));
    return;
  }

  if (cmd === 'health') {
    await health(open);
    return;
  }

  // Production start flow
  if (cmd === 'start') {
    console.log('🏭 Production Mode');
    
    if (subcmd === 'api') {
      console.log('🔧 Building and starting API (production)…');
      const ok = buildApi();
      if (!ok) { 
        console.error('❌ API build failed'); 
        process.exit(1); 
      }
      const api = startApiProd(apiEnvOverride);
      try { 
        startWorkersProd(); 
      } catch (error) {
        console.warn('⚠️  Workers startup failed:', error.message);
      }
      await health(open);
      api.on('exit', () => process.exit(0));
      return;
    }

    if (subcmd === 'web') {
      console.log('🌐 Building and starting Web (production)…');
      const ok = buildWeb();
      if (!ok) { 
        console.error('❌ Web build failed'); 
        process.exit(1); 
      }
      const web = startWebProd();
      await health(open);
      web.on('exit', () => process.exit(0));
      return;
    }

    if (subcmd === 'workers') {
      console.log('⚙️  Starting Workers (production)…');
      const workers = startWorkersProd();
      await health(open);
      workers.on('exit', () => process.exit(0));
      return;
    }

    // Build and start everything in production
    console.log('🔨 Building all services…');
    const okApi = buildApi();
    const okWeb = buildWeb();
    if (!okApi || !okWeb) {
      console.error('❌ Build failed. Check logs above.');
      process.exit(1);
    }

    console.log('🚀 Starting all services (production)…');
    const api = startApiProd(apiEnvOverride);
    const web = startWebProd();
    try { 
      startWorkersProd(); 
    } catch (error) {
      console.warn('⚠️  Workers startup failed:', error.message);
    }
    
    await health(open);
    const exit = () => process.exit(0);
    api.on('exit', exit);
    web.on('exit', exit);
    return;
  }

  // Default: both (full development environment)
  console.log('🔥 Starting full development environment…');
  console.log('   API: http://localhost:3001');
  console.log('   Web: http://localhost:3002');
  console.log('   Workers: background processing');
  
  const useCodespacesMode = ENV.isCodespaces || ENV.isDevContainer;
  const scriptName = useCodespacesMode ? 'dev:codespaces' : 'dev:local';
  
  console.log(`\n🎯 Using ${useCodespacesMode ? 'Codespaces' : 'Local'} configuration…`);
  
  const child = spawn('pnpm', [scriptName], {
    stdio: 'inherit',
    shell: true,
    cwd: ROOT,
    env: childEnv(apiEnvOverride),
  });

  // Fire health checks in background
  health(open).catch(() => {});

  child.on('exit', (code, signal) => {
    console.log(`\n✅ Development environment ended (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
    process.exit(typeof code === 'number' ? code : 0);
  });

  // Interactive menu for TTY environments
  if (process.stdin.isTTY && process.stdout.isTTY && process.argv.length <= 2) {
    const rl = readline.createInterface({ 
      input: process.stdin, 
      output: process.stdout 
    });
    rl.on('SIGINT', () => rl.close());
    
    setTimeout(() => {
      rl.question('\n💡 Press Enter to open Web interface, or type q to quit: ', (ans) => {
        if (!ans.trim()) {
          sh('open http://localhost:3002/');
        }
        rl.close();
      });
    }, 3000);
  }
}

main().catch((e) => {
  console.error('Launcher failed:', e);
  process.exit(1);
});

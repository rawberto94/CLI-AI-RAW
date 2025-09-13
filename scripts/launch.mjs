#!/usr/bin/env node
// Orchestrated launcher: infra (docker), DB push, kill stale ports, then start API/Web/Workers
// Usage:
//   pnpm launch                 # full: infra + db + kill-ports + api+web
//   pnpm launch api             # only API dev
//   pnpm launch web             # only Web dev
//   pnpm launch both            # API + Web dev (skip infra/db if already running)
//   pnpm launch start           # build + start API/Web in production mode
//   pnpm launch start api       # build + start API only (prod)
//   pnpm launch start web       # build + start Web only (prod)
//   pnpm launch health          # health checks only
//   pnpm launch stop            # free ports 3001/3002
// Flags:
//   --no-infra  --no-db  --open

import { execSync, spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import readline from 'node:readline';

const ROOT = process.cwd();

// Provide sane defaults for local infra when env vars are missing.
function childEnv(overrides = {}) {
  return {
    ...process.env,
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    S3_ENDPOINT: process.env.S3_ENDPOINT || 'http://localhost:9000',
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID || 'minioadmin',
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY || 'minioadmin',
    S3_BUCKET: process.env.S3_BUCKET || 'contracts',
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  // Ensure Web can reach API without extra setup
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  DEMO_API_KEY: process.env.DEMO_API_KEY || 'demo-board-2025',
    ...overrides,
  };
}

function sh(cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT, shell: true, ...opts });
    return true;
  } catch (e) {
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
    } catch (e) {}
    const backoff = Math.min(intervalMs * Math.pow(1.15, attempt), 3000);
    await sleep(backoff);
  }
  return false;
}

async function startInfra() {
  console.log('\n[infra] Starting infra (docker compose)…');
  const hasDocker = sh('docker --version');
  if (!hasDocker) {
    console.warn('Docker not available. Skipping infra startup. Make sure Postgres/Redis/MinIO are running.');
    return;
  }
  sh('docker compose -f infra/docker-compose.yml up -d');
  await sleep(1500);
  // Wait for Postgres to be ready
  console.log('[infra] Waiting for Postgres to be ready…');
  // Try a few times to run a simple psql command inside the container
  for (let i = 0; i < 20; i++) {
    const ok = sh('docker compose -f infra/docker-compose.yml exec -T postgres sh -lc "pg_isready -U postgres"');
    if (ok) { break; }
    await sleep(1000);
  }
  console.log('[infra] Ensuring MinIO bucket exists (contracts)…');
  const okMinio = sh('docker compose -f infra/docker-compose.yml exec -T minio sh -lc "mc alias set local http://localhost:9000 minioadmin minioadmin && mc mb -p local/contracts || true"');
  if (!okMinio) console.warn('[infra] Could not configure MinIO bucket automatically (optional).');
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

function startWorkers(envOverrides = {}) {
  console.log('\n[workers] Starting workers…');
  const child = spawn('pnpm', ['dev'], {
    cwd: `${ROOT}/apps/workers`,
    stdio: 'inherit',
    shell: true,
    env: childEnv({ ...envOverrides }),
  });
  child.on('exit', (c, s) => console.log(`[workers] exited (code=${c}, signal=${s})`));
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
  console.log(`Usage: pnpm launch [api|web|workers|both|health|stop|start [api|web|workers]] [--no-infra] [--no-db] [--open] [--worker-only|--direct]\n`);
  console.log(`Flags:`);
  console.log(`  --worker-only   Force worker-only processing (sets ANALYSIS_DIRECT_EXTRACTION=false for API)`);
  console.log(`  --direct        Force direct extraction in API (ANALYSIS_DIRECT_EXTRACTION=true)`);
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
  // Determine override for API extraction mode
  const analysisDirectOverride = flagDirect ? 'true' : (flagWorkerOnly ? 'false' : undefined);
  const apiEnvOverride = analysisDirectOverride ? { ANALYSIS_DIRECT_EXTRACTION: analysisDirectOverride } : {};

  console.log('--- Launcher: contract-intelligence ---');
  console.log('Repo:', ROOT);

  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printHelp();
    return;
  }

  if (cmd === 'stop') {
    killPorts();
    return;
  }

  if (!noInfra) await startInfra();
  if (!noDb) dbPush();
  killPorts();

  if (cmd === 'api') {
  const api = startApi(apiEnvOverride);
  // Optionally start workers in dev when focusing API only
  try { startWorkersDev(apiEnvOverride); } catch {}
    await health(open);
    api.on('exit', () => process.exit(0));
  if (open) sh('open http://localhost:3001/docs || open http://localhost:3001/healthz');
    return;
  }
  if (cmd === 'web') {
    const web = startWeb(apiEnvOverride);
    await health(open);
    web.on('exit', () => process.exit(0));
  if (open) sh('open http://localhost:3002/');
    return;
  }
  if (cmd === 'health') {
    await health(open);
    return;
  }

  if (cmd === 'workers') {
    const workers = startWorkersDev(apiEnvOverride);
    // keep process alive while workers run
    workers.on('exit', () => process.exit(0));
    process.on('SIGINT', () => workers.kill('SIGINT'));
    process.on('SIGTERM', () => workers.kill('SIGTERM'));
    return;
  }

  // Production start flow
  if (cmd === 'start') {
    // If user specified a second positional arg, honor it
    if (subcmd === 'api') {
      const ok = buildApi();
      if (!ok) { console.error('[api] Build failed'); process.exit(1); }
  const api = startApiProd(apiEnvOverride);
  try { startWorkersProd(); } catch {}
      await health(open);
      api.on('exit', () => process.exit(0));
      return;
    }
    if (subcmd === 'web') {
      const ok = buildWeb();
      if (!ok) { console.error('[web] Build failed'); process.exit(1); }
      const web = startWebProd();
      await health(open);
      web.on('exit', () => process.exit(0));
      return;
    }
    if (subcmd === 'workers') {
      const workers = startWorkersProd();
      await health(open);
      workers.on('exit', () => process.exit(0));
      return;
    }

  console.log('\n[start] Building API + Web…');
    const okApi = buildApi();
    const okWeb = buildWeb();
    if (!okApi || !okWeb) {
      console.error('[start] Build failed. Check logs above.');
      process.exit(1);
    }
  console.log('\n[start] Starting API + Web + Workers (prod)…');
  const api = startApiProd(apiEnvOverride);
  const web = startWebProd();
  try { startWorkersProd(); } catch {}
    await health(open);
    const exit = () => process.exit(0);
    api.on('exit', exit);
    web.on('exit', exit);
    return;
  }

  // Default: both
  console.log('\n[both] Starting API + Web…');
  // Use the existing concurrent runner; propagate env overrides to API/Web/Workers
  const child = spawn('pnpm', ['dev:local'], {
    stdio: 'inherit',
    shell: true,
    cwd: ROOT,
    env: childEnv(apiEnvOverride),
  });
  // Fire health checks in background
  health(open).catch(() => {});
  child.on('exit', (code, signal) => {
    console.log(`\nDev processes ended (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
    process.exit(typeof code === 'number' ? code : 0);
  });

  // Optional: interactive quick menu when launched without args in a TTY
  if (process.stdin.isTTY && process.stdout.isTTY && process.argv.length <= 2) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.on('SIGINT', () => rl.close());
    rl.question('\nPress Enter to open Web, or type q to quit: ', (ans) => {
      if (!ans.trim()) sh('open http://localhost:3002/');
      rl.close();
    });
  }
}

main().catch((e) => {
  console.error('Launcher failed:', e);
  process.exit(1);
});

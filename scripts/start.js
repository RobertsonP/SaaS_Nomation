#!/usr/bin/env node
/**
 * Nomation Hybrid Mode Startup Script
 * Starts databases in Docker, runs backend + frontend natively.
 */

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

const ROOT = path.resolve(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');

function log(msg) { console.log(`  ${msg}`); }
function ok(msg) { console.log(`  [OK] ${msg}`); }
function err(msg) { console.error(`  [ERROR] ${msg}`); }
function warn(msg) { console.warn(`  [WARNING] ${msg}`); }

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', timeout: 30000, ...opts }).trim();
  } catch (e) {
    return null;
  }
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => { server.close(); resolve(false); });
    server.listen(port, '127.0.0.1');
  });
}

async function waitForPort(port, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortInUse(port)) return true;
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

function killPort(port) {
  try {
    const output = execSync(`netstat -ano | findstr ":${port} " | findstr "LISTENING"`, { encoding: 'utf8', stdio: 'pipe' });
    const lines = output.trim().split('\n');
    for (const line of lines) {
      const pid = line.trim().split(/\s+/).pop();
      if (pid && pid !== '0') {
        run(`taskkill /PID ${pid} /F`);
      }
    }
  } catch (e) { /* no process on port */ }
}

function writeLauncher(filename, title, workDir, envVars, command) {
  const batPath = path.join(ROOT, filename);
  const lines = [
    '@echo off',
    `title ${title}`,
    `cd /d "${workDir}"`,
  ];
  for (const [key, val] of Object.entries(envVars)) {
    lines.push(`set ${key}=${val}`);
  }
  lines.push('echo.');
  lines.push(`echo   ${title}`);
  lines.push('echo.');
  lines.push(command);
  fs.writeFileSync(batPath, lines.join('\r\n') + '\r\n');
  return batPath;
}

async function main() {
  console.log('');
  console.log('===============================================');
  console.log('  NOMATION - HYBRID MODE STARTUP');
  console.log('===============================================');
  console.log('');

  // Step 1: Prerequisites
  log('[1/8] Checking prerequisites...');

  if (!run('docker --version')) {
    err('Docker is not installed or Docker Desktop is not running!');
    process.exit(1);
  }
  ok('Docker is available');

  if (!run('node --version')) {
    err('Node.js is not installed!');
    process.exit(1);
  }
  ok('Node.js is available');

  if (!run('npm --version')) {
    err('npm is not installed!');
    process.exit(1);
  }
  ok('npm is available');

  // Step 2: Kill conflicts
  log('');
  log('[2/8] Stopping old processes...');
  run('taskkill /FI "WINDOWTITLE eq Nomation Backend*" /F');
  run('taskkill /FI "WINDOWTITLE eq Nomation Frontend*" /F');
  killPort(3001);
  killPort(3002);
  ok('Conflicts cleared');

  // Step 3: Start databases
  log('');
  log('[3/8] Starting databases (PostgreSQL + Redis)...');
  const dockerUp = run('docker compose -f docker-compose.dev.yml up -d', { cwd: ROOT, timeout: 60000 });
  if (dockerUp === null) {
    err('Failed to start databases! Is Docker Desktop running?');
    process.exit(1);
  }

  // Wait for PostgreSQL
  log('     Waiting for PostgreSQL...');
  for (let i = 0; i < 30; i++) {
    const ready = run('docker exec nomation-dev-postgres pg_isready -U nomation_user -d nomation');
    if (ready !== null) break;
    if (i === 29) { err('PostgreSQL failed to start within 30 seconds!'); process.exit(1); }
    await new Promise(r => setTimeout(r, 1000));
  }
  ok('PostgreSQL is ready');

  // Wait for Redis
  log('     Waiting for Redis...');
  for (let i = 0; i < 15; i++) {
    const pong = run('docker exec nomation-dev-redis redis-cli ping');
    if (pong && pong.includes('PONG')) break;
    if (i === 14) { err('Redis failed to start within 15 seconds!'); process.exit(1); }
    await new Promise(r => setTimeout(r, 1000));
  }
  ok('Redis is ready');

  // Step 4: Create .env files
  log('');
  log('[4/8] Configuring environment...');

  const backendEnv = [
    'DATABASE_URL=postgresql://nomation_user:nomation_password@localhost:5432/nomation',
    'JWT_SECRET=nomation-secret-key-2024-ultra-secure-development-only',
    'REDIS_HOST=localhost',
    'REDIS_PORT=6379',
    'REDIS_PASSWORD=',
    'NODE_ENV=development',
    'PORT=3002',
    'CORS_ORIGIN=http://localhost:3001',
    'PLAYWRIGHT_BROWSERS_PATH=0',
    'PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=false',
  ].join('\n') + '\n';

  fs.writeFileSync(path.join(BACKEND, '.env'), backendEnv);
  fs.writeFileSync(path.join(FRONTEND, '.env'), 'VITE_API_URL=http://localhost:3002\n');
  ok('Environment files created');

  // Step 5: Install dependencies
  log('');
  log('[5/8] Checking dependencies...');

  if (!fs.existsSync(path.join(BACKEND, 'node_modules', '@nestjs', 'core'))) {
    log('     Installing backend dependencies...');
    execSync('npm install', { cwd: BACKEND, stdio: 'inherit' });
    ok('Backend dependencies installed');
  } else {
    ok('Backend dependencies present');
  }

  if (!fs.existsSync(path.join(FRONTEND, 'node_modules', 'vite'))) {
    log('     Installing frontend dependencies...');
    execSync('npm install', { cwd: FRONTEND, stdio: 'inherit' });
    ok('Frontend dependencies installed');
  } else {
    ok('Frontend dependencies present');
  }

  // Playwright browsers
  const playwrightCheck = run('npx playwright install --dry-run chromium', { cwd: BACKEND, env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' } });
  if (playwrightCheck === null) {
    log('     Installing Playwright Chromium browser...');
    execSync('npx playwright install chromium', { cwd: BACKEND, stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' } });
    ok('Playwright Chromium installed');
  } else {
    ok('Playwright browsers present');
  }

  // Step 6: Prisma
  log('');
  log('[6/8] Running database migrations...');

  const prismaEnv = { ...process.env, DATABASE_URL: 'postgresql://nomation_user:nomation_password@localhost:5432/nomation' };
  run('npx prisma generate', { cwd: BACKEND, env: prismaEnv, timeout: 30000 });
  ok('Prisma client generated');

  run('npx prisma db push --accept-data-loss', { cwd: BACKEND, env: prismaEnv, timeout: 30000 });
  ok('Database schema synchronized');

  // Step 7: Start Backend — write a launcher .bat and open it in a new window
  log('');
  log('[7/8] Starting Backend API on port 3002...');

  const backendBat = writeLauncher('_run_backend.bat', 'Nomation Backend', BACKEND, {
    DATABASE_URL: 'postgresql://nomation_user:nomation_password@localhost:5432/nomation',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    REDIS_PASSWORD: '',
    JWT_SECRET: 'nomation-secret-key-2024-ultra-secure-development-only',
    PORT: '3002',
    CORS_ORIGIN: 'http://localhost:3001',
    NODE_ENV: 'development',
    PLAYWRIGHT_BROWSERS_PATH: '0',
  }, 'npm run dev');

  exec(`start "" "${backendBat}"`);

  log('     Waiting for backend (up to 60s)...');
  const backendReady = await waitForPort(3002, 60000);
  if (backendReady) {
    ok('Backend is running on port 3002');
  } else {
    warn('Backend may still be starting — check the Backend terminal window');
  }

  // Step 8: Start Frontend — same approach
  log('');
  log('[8/8] Starting Frontend on port 3001...');

  const frontendBat = writeLauncher('_run_frontend.bat', 'Nomation Frontend', FRONTEND, {
    VITE_API_URL: 'http://localhost:3002',
  }, 'npm run dev');

  exec(`start "" "${frontendBat}"`);

  log('     Waiting for frontend (up to 15s)...');
  const frontendReady = await waitForPort(3001, 15000);
  if (frontendReady) {
    ok('Frontend is running on port 3001');
  } else {
    warn('Frontend may still be starting — check the Frontend terminal window');
  }

  // Done
  console.log('');
  console.log('===============================================');
  console.log('  NOMATION STARTED SUCCESSFULLY');
  console.log('===============================================');
  console.log('');
  console.log('  Frontend:    http://localhost:3001');
  console.log('  Backend:     http://localhost:3002');
  console.log('  PostgreSQL:  localhost:5432');
  console.log('  Redis:       localhost:6379');
  console.log('');
  console.log('  To stop everything: run new_stop.bat');
  console.log('');

  // Open browser
  exec('start http://localhost:3001');
}

main().catch(e => {
  console.error('');
  console.error('STARTUP FAILED:', e.message);
  console.error('');
  process.exit(1);
});

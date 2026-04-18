#!/usr/bin/env node
/**
 * Nomation Stop Script
 * Kills backend/frontend processes and stops Docker databases.
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', timeout: 15000, ...opts }).trim();
  } catch (e) {
    return null;
  }
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

console.log('');
console.log('===============================================');
console.log('  NOMATION - STOPPING ALL SERVICES');
console.log('===============================================');
console.log('');

console.log('  [1/3] Stopping Backend and Frontend...');
run('taskkill /FI "WINDOWTITLE eq Nomation Backend*" /F');
run('taskkill /FI "WINDOWTITLE eq Nomation Frontend*" /F');
killPort(3001);
killPort(3002);
console.log('  [OK] App processes stopped');

console.log('');
console.log('  [2/3] Stopping databases (PostgreSQL + Redis)...');
execSync('docker compose -f docker-compose.dev.yml down', { cwd: ROOT, stdio: 'inherit' });
console.log('  [OK] Databases stopped');

console.log('');
console.log('  [3/3] Cleanup complete.');
console.log('');
console.log('===============================================');
console.log('  NOMATION STOPPED');
console.log('===============================================');
console.log('');
console.log('  Database data is preserved in Docker volumes.');
console.log('  To start again:     double-click new_start.bat');
console.log('  To delete all data: docker compose -f docker-compose.dev.yml down -v');
console.log('');

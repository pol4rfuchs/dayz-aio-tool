import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const frontendRoot = join(root, 'apps', 'frontend');
const logDir = join(root, 'logs');
mkdirSync(logDir, { recursive: true });

process.chdir(root);
process.env.DAYZ_AIO_LOG_DIR = process.env.DAYZ_AIO_LOG_DIR || logDir;
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.COREPACK_ENABLE_DOWNLOAD_PROMPT = '0';
process.env.npm_config_build_from_source = 'false';
process.env.npm_config_fund = 'false';
process.env.npm_config_audit = 'false';

const envFile = join(root, 'apps', 'backend', '.env');
const backendEntry = join(root, 'apps', 'backend', 'dist', 'server.js');
const frontendViteEntry = join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const rootViteEntry = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const viteEntry = existsSync(frontendViteEntry) ? frontendViteEntry : rootViteEntry;
const frontendDist = join(frontendRoot, 'dist', 'index.html');

function fail(message) {
  console.error(`[DayZ AIO Service] ${message}`);
  process.exit(1);
}

if (!existsSync(envFile)) fail('apps/backend/.env missing. Run install-windows.bat first.');
if (!existsSync(backendEntry)) fail('Backend build output missing. Run install-windows.bat first.');
if (!existsSync(viteEntry)) fail('Vite CLI missing in apps/frontend/node_modules or root node_modules. Run install-windows.bat first.');
if (!existsSync(frontendDist)) fail('Frontend build output missing. Run install-windows.bat first.');

const children = [];
let shuttingDown = false;

function openLog(name) {
  return createWriteStream(join(logDir, name), { flags: 'a' });
}

function startManaged(name, command, args, options = {}) {
  const stdout = openLog(`${name}-service.out.log`);
  const stderr = openLog(`${name}-service.err.log`);
  const child = spawn(command, args, {
    cwd: root,
    env: process.env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  child.stdout?.pipe(stdout);
  child.stderr?.pipe(stderr);

  child.on('exit', (code, signal) => {
    stdout.end();
    stderr.end();
    if (!shuttingDown) {
      console.error(`[DayZ AIO Service] ${name} exited unexpectedly with code=${code} signal=${signal}`);
      void shutdown(`${name}-exit`, 1);
    }
  });

  children.push({ name, child, supportsIpc: options.supportsIpc === true });
  console.log(`[DayZ AIO Service] Started ${name} pid=${child.pid}`);
  return child;
}

startManaged('backend', process.execPath, [backendEntry], {
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  supportsIpc: true,
});

startManaged('frontend', process.execPath, [viteEntry, 'preview', '--host', '0.0.0.0', '--port', '3100', '--strictPort'], {
  cwd: frontendRoot,
  env: {
    ...process.env,
    VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || 'http://localhost:8090',
  },
});

async function terminateChild(entry, timeoutMs = 12000) {
  const { name, child, supportsIpc } = entry;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  const exitedPromise = new Promise((resolveExit) => {
    const timer = setTimeout(() => resolveExit(false), timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolveExit(true);
    });
  });

  if (supportsIpc && child.connected) {
    console.log(`[DayZ AIO Service] Sending IPC shutdown to ${name} pid=${child.pid}`);
    try {
      child.send({ type: 'dayz-aio.shutdown', reason: 'service-stop' });
    } catch (error) {
      console.error(`[DayZ AIO Service] Failed to send IPC shutdown to ${name}:`, error);
    }
  } else {
    console.log(`[DayZ AIO Service] Sending SIGTERM to ${name} pid=${child.pid}`);
    try {
      child.kill('SIGTERM');
    } catch (error) {
      console.error(`[DayZ AIO Service] Failed to signal ${name}:`, error);
    }
  }

  const exited = await exitedPromise;
  if (!exited) {
    console.error(`[DayZ AIO Service] ${name} did not exit after ${timeoutMs}ms; forcing process tree termination.`);
    await forceKillTree(child.pid);
  }
}

function forceKillTree(pid) {
  return new Promise((resolveKill) => {
    if (process.platform === 'win32') {
      const killer = spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      killer.once('exit', () => resolveKill());
      killer.once('error', () => resolveKill());
      return;
    }
    try { process.kill(pid, 'SIGKILL'); } catch {}
    resolveKill();
  });
}

async function shutdown(reason, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[DayZ AIO Service] Shutdown requested: ${reason}`);

  for (const entry of [...children].reverse()) {
    await terminateChild(entry);
  }

  console.log('[DayZ AIO Service] Shutdown complete.');
  process.exit(exitCode);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGHUP', () => void shutdown('SIGHUP'));
process.on('uncaughtException', (error) => {
  console.error('[DayZ AIO Service] uncaughtException', error);
  void shutdown('uncaughtException', 1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[DayZ AIO Service] unhandledRejection', reason);
  void shutdown('unhandledRejection', 1);
});

console.log('[DayZ AIO Service] Backend:  http://localhost:8090/health');
console.log('[DayZ AIO Service] Frontend: http://localhost:3100');

setInterval(() => {
  // Keep the supervisor alive while child processes run.
}, 60_000).unref();

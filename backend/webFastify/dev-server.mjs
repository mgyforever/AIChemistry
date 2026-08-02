/**
 * Development server entrypoint for initialized Fastify + TypeScript projects.
 *
 * This script is copied into new projects as dev-server.mjs and is invoked
 * via the `npm run dev` script to provide a fast, opinionated dev workflow.
 *
 * Responsibilities:
 * - Ensure dependencies are installed and TypeScript is present
 * - Run the TypeScript compiler in watch mode for rapid feedback
 * - Start the compiled Fastify server from dist/src/index.js
 * - Implement port auto-discovery and strict PORT semantics
 * - Provide clear, concise console output for developers
 *
 * @supports docs/stories/003.0-DEVELOPER-DEV-SERVER.story.md REQ-DEV-START-FAST REQ-DEV-PORT-AUTO REQ-DEV-PORT-STRICT REQ-DEV-CLEAN-LOGS
 * @supports docs/stories/008.0-DEVELOPER-LOGS-MONITOR.story.md REQ-LOG-DEV-PRETTY REQ-LOG-LEVEL-CONFIG
 */
import { spawn } from 'node:child_process';
import { watch, accessSync } from 'node:fs';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 3000;
const HOST = '0.0.0.0';

/**
 * Structured error type for dev server failures.
 *
 * @supports docs/stories/003.0-DEVELOPER-DEV-SERVER.story.md REQ-DEV-PORT-AUTO REQ-DEV-PORT-STRICT REQ-DEV-CLEAN-LOGS
 */
export class DevServerError extends Error {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = 'DevServerError';
  }
}

/**
 * Resolve the project root directory for the initialized project.
 *
 * @supports docs/stories/003.0-DEVELOPER-DEV-SERVER.story.md REQ-DEV-START-FAST
 * @returns {string} Absolute path to the project root.
 */
function getProjectRoot() {
  const thisFilePath = fileURLToPath(import.meta.url);
  return path.dirname(thisFilePath);
}

/**
 * Check that package.json exists in the project root.
 *
 * @supports docs/stories/003.0-DEVELOPER-DEV-SERVER.story.md REQ-DEV-START-FAST
 */
async function assertPackageJsonExists(projectRoot) {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  try {
    await fs.access(packageJsonPath);
  } catch {
    console.error(
      'dev-server: package.json not found. Did you run this from an initialized project?',
    );
    process.exitCode = 1;
    process.exit(1);
  }
}

/**
 * Check if a given port is available on HOST.
 *
 * @param {number} port
 * @returns {Promise<boolean>}
 *
 * @supports docs/stories/003.0-DEVELOPER-DEV-SERVER.story.md REQ-DEV-PORT-AUTO REQ-DEV-PORT-STRICT
 */
async function isPortAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => {
        resolve(true);
      });
    });

    server.listen(port, HOST);
  });
}

/**
 * Find the first available port starting at DEFAULT_PORT.
 *
 * @param {number} startPort
 * @returns {Promise<number>}
 *
 * @supports docs/stories/003.0-DEVELOPER-DEV-SERVER.story.md REQ-DEV-PORT-AUTO
 */
async function findAvailablePort(startPort) {
  let port = startPort;
  // Upper bound is arbitrary but generous for dev usage.
  const maxPort = 65535;

  while (port <= maxPort) {
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
    port += 1;
  }

  throw new DevServerError(
    `No available ports found in range ${startPort}-${maxPort} on host ${HOST}`,
  );
}

/**
 * Resolve the dev server port, applying strict PORT semantics and auto-discovery.
 *
 * - If env.PORT is set: validate integer range, ensure availability on HOST.
 *   Throw DevServerError if invalid or unavailable.
 * - If env.PORT is not set: find a free port starting at DEFAULT_PORT, set env.PORT.
 *
 * @param {NodeJS.ProcessEnv} env
 * @returns {Promise<{ port: number; mode: 'auto' | 'strict' }>}
 *
 * @throws {DevServerError}
 *
 * @supports docs/stories/003.0-DEVELOPER-DEV-SERVER.story.md REQ-DEV-PORT-AUTO REQ-DEV-PORT-STRICT REQ-DEV-CLEAN-LOGS
 */
export async function resolveDevServerPort(env) {
  const rawPort = env.PORT;

  if (rawPort != null && rawPort !== '') {
    const port = Number.parseInt(rawPort, 10);

    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new DevServerError(
        `Invalid PORT value "${rawPort}". PORT must be an integer between 1 and 65535.`,
      );
    }

    const available = await isPortAvailable(port);
    if (!available) {
      throw new DevServerError(
        `Requested PORT ${port} is already in use on host ${HOST}. Set PORT to a free port or unset it to enable auto-discovery.`,
      );
    }

    env.PORT = String(port);
    return { port, mode: 'strict' };
  }

  const port = await findAvailablePort(DEFAULT_PORT);
  env.PORT = String(port);
  return { port, mode: 'auto' };
}

/**
 * Start the TypeScript compiler in watch mode.
 *
 * This relies on the initialized project having TypeScript installed and a
 * tsconfig.json that outputs compiled code to dist/.
 *
 * Returns a Promise that resolves when the initial compilation completes.
 *
 * @param {string} projectRoot
 * @param {(data: string) => void} onOutput - Callback for all output (for logging/forwarding)
 * @returns {Promise<import('node:child_process').ChildProcess>} Promise that resolves to the tsc process after initial compilation
 *
 * @supports docs/stories/003.0-DEVELOPER-DEV-SERVER.story.md REQ-DEV-TYPESCRIPT-WATCH REQ-DEV-ERROR-DISPLAY REQ-DEV-INITIAL-COMPILE
 */
function startTypeScriptWatch(projectRoot, onOutput) {
  return new Promise((resolve, reject) => {
    const tscCliPath = path.join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc');
    const tsc = spawn(process.execPath, [tscCliPath, '--watch', '--preserveWatchOutput'], {
      cwd: projectRoot,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let initialCompilationComplete = false;

    const handleOutput = data => {
      const text = data.toString();
      onOutput(text);

      // Detect initial compilation completion
      // TypeScript outputs "Found X errors. Watching for file changes." after compilation
      if (
        !initialCompilationComplete &&
        /Found \d+ errors?\. Watching for file changes\./.test(text)
      ) {
        initialCompilationComplete = true;
        resolve(tsc);
      }
    };

    tsc.stdout?.on('data', handleOutput);
    tsc.stderr?.on('data', handleOutput);

    tsc.on('error', error => {
      if (!initialCompilationComplete) {
        reject(error);
      } else {
        console.error('dev-server: TypeScript watcher error:', error);
      }
    });

    tsc.on('exit', (code, signal) => {
      if (!initialCompilationComplete) {
        reject(
          new Error(
            `TypeScript watcher exited before initial compilation completed (code: ${code}, signal: ${signal})`,
          ),
        );
      }
    });
  });
}

/**
 * Start the compiled Fastify server from dist/src/index.js.
 *
 * For the initial implementation, this delegates to `node dist/src/index.js`
 * and relies on the generated server to implement / and /health routes.
 * Port selection is handled by the application itself (via PORT env). This
 * launcher ensures the relevant environment variables are set and logs the
 * effective port for clarity.
 *
 * @param {string} projectRoot
 * @param {NodeJS.ProcessEnv} env
 * @param {number} port
 * @param {'auto' | 'strict'} mode
 *
 * @supports docs/stories/003.0-DEVELOPER-DEV-SERVER.story.md REQ-DEV-START-FAST REQ-DEV-PORT-AUTO REQ-DEV-PORT-STRICT REQ-DEV-CLEAN-LOGS
 */
function startCompiledServer(projectRoot, env, port, mode) {
  const distEntry = path.join(projectRoot, 'dist', 'src', 'index.js');

  const isDev = env.NODE_ENV !== 'production';
  const args = [distEntry];

  // In development, try to use pino-pretty for human-readable logs
  // If pino-pretty is not available, Node will fall back to standard logging
  if (isDev) {
    const pinoPrettyPath = path.join(projectRoot, 'node_modules', 'pino-pretty', 'index.js');
    try {
      // Synchronous check to avoid async complexity in spawn path
      accessSync(pinoPrettyPath);
      args.unshift('-r', 'pino-pretty');
    } catch {
      // pino-pretty not found; continue without it (logs will be JSON)
      console.log('dev-server: pino-pretty not found, using JSON log output');
    }
  }

  const modeLabel =
    mode === 'auto' ? '(auto-discovered from DEFAULT_PORT)' : '(from PORT environment variable)';

  console.log(
    `dev-server: starting Fastify server on http://localhost:${port} (host ${HOST}) ${modeLabel}`,
  );

  const node = spawn(process.execPath, args, {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
  });

  node.on('error', error => {
    console.error('dev-server: Failed to start Fastify server:', error);
  });

  return node;
}

/**
 * Start a watcher that hot-reloads the compiled server when dist/src/index.js changes.
 *
 * @param {string} projectRoot
 * @param {NodeJS.ProcessEnv} env
 * @param {number} port
 * @param {'auto' | 'strict'} mode
 * @param {() => import('node:child_process').ChildProcess | undefined} getServerProcess
 * @param {(newServer: import('node:child_process').ChildProcess) => void} setServerProcess
 * @returns {() => void} Function to stop the watcher.
 *
 * @supports docs/stories/003.0-DEVELOPER-DEV-SERVER.story.md REQ-DEV-HOT-RELOAD REQ-DEV-CLEAN-LOGS
 */
function startHotReloadWatcher(projectRoot, env, port, mode, getServerProcess, setServerProcess) {
  const distSrcDir = path.join(projectRoot, 'dist', 'src');
  const targetFile = 'index.js';

  /** @type {import('node:fs').FSWatcher | undefined} */
  let watcher;
  let stopped = false;
  let restarting = false;
  let pendingChange = false;

  const restartServer = () => {
    if (restarting) {
      pendingChange = true;
      return;
    }
    restarting = true;
    pendingChange = false;

    const current = getServerProcess();
    const doStart = () => {
      const newServer = startCompiledServer(projectRoot, env, port, mode);
      setServerProcess(newServer);
      restarting = false;
      if (pendingChange && !stopped) {
        pendingChange = false;
        restartServer();
      }
    };

    console.log('dev-server: detected change in compiled output, restarting server...');

    if (current && !current.killed) {
      current.once('exit', () => {
        if (stopped) {
          restarting = false;
          pendingChange = false;
          return;
        }
        doStart();
      });
      try {
        current.kill('SIGINT');
      } catch {
        doStart();
      }
    } else {
      doStart();
    }
  };

  fs.mkdir(distSrcDir, { recursive: true })
    .catch(() => {})
    .finally(() => {
      try {
        watcher = watch(
          distSrcDir,
          {
            persistent: true,
          },
          (eventType, filename) => {
            if (stopped) return;
            if (!filename) return;
            if (filename !== targetFile) return;
            if (eventType !== 'change' && eventType !== 'rename') return;
            restartServer();
          },
        );
      } catch {
        // If the watcher cannot be started, skip hot reload silently.
      }
    });

  return () => {
    stopped = true;
    if (watcher) {
      try {
        watcher.close();
      } catch {
        // ignore
      }
      watcher = undefined;
    }
  };
}

/**
 * Main dev-server workflow.
 *
 * @supports docs/stories/003.0-DEVELOPER-DEV-SERVER.story.md REQ-DEV-START-FAST REQ-DEV-PORT-AUTO REQ-DEV-PORT-STRICT REQ-DEV-TYPESCRIPT-WATCH
 */
async function main() {
  const projectRoot = getProjectRoot();
  await assertPackageJsonExists(projectRoot);

  const env = { ...process.env };

  let resolvedPort;
  let mode;
  try {
    const result = await resolveDevServerPort(env);
    resolvedPort = result.port;
    mode = result.mode;
  } catch (error) {
    if (error instanceof DevServerError) {
      console.error(`dev-server: ${error.message}`);
      process.exit(1);
    } else {
      console.error('dev-server: unexpected error while resolving port:', error);
      process.exit(1);
    }
  }

  const skipTscWatch = env.DEV_SERVER_SKIP_TSC_WATCH === '1';

  if (skipTscWatch) {
    console.log(
      'dev-server: DEV_SERVER_SKIP_TSC_WATCH=1, skipping TypeScript watcher (test mode).',
    );
  } else {
    console.log('dev-server: starting TypeScript compiler in watch mode...');
  }

  /** @type {import('node:child_process').ChildProcess | undefined} */
  let tscProcess;
  /** @type {import('node:child_process').ChildProcess | undefined} */
  let serverProcess;
  /** @type {(() => void) | undefined} */
  let stopHotReload;

  if (!skipTscWatch) {
    // Wait for initial TypeScript compilation to complete before starting server
    try {
      tscProcess = await startTypeScriptWatch(projectRoot, output => {
        // Forward TypeScript output to console
        process.stdout.write(output);
      });
      console.log('dev-server: initial TypeScript compilation complete.');
    } catch (error) {
      console.error('dev-server: Failed to start TypeScript watcher:', error);
      process.exit(1);
    }
  }

  // Start the server now that compilation is complete (or skipped in test mode)
  console.log('dev-server: launching Fastify server from dist/src/index.js...');
  serverProcess = startCompiledServer(projectRoot, env, resolvedPort, mode);
  stopHotReload = startHotReloadWatcher(
    projectRoot,
    env,
    resolvedPort,
    mode,
    () => serverProcess,
    newServer => {
      serverProcess = newServer;
    },
  );

  /**
   * Handle shutdown signals and terminate child processes gracefully.
   *
   * @supports docs/stories/003.0-DEVELOPER-DEV-SERVER.story.md REQ-DEV-GRACEFUL-STOP
   */
  function handleSignal(signal) {
    console.log(`dev-server: received ${signal}, shutting down...`);

    if (stopHotReload) {
      try {
        stopHotReload();
      } catch {
        // ignore errors during shutdown
      }
      stopHotReload = undefined;
    }

    if (tscProcess && !tscProcess.killed) {
      try {
        tscProcess.kill('SIGINT');
      } catch {
        // ignore errors during shutdown
      }
    }

    if (serverProcess && !serverProcess.killed) {
      try {
        serverProcess.kill('SIGINT');
      } catch {
        // ignore errors during shutdown
      }
    }

    process.exit(0);
  }

  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));
}

// ESM-safe entrypoint guard: run main() only when executed directly.
const thisFilePath = fileURLToPath(import.meta.url);

// When executed directly via `node dev-server.mjs` (or an absolute path
// to this file), process.argv[1] will point at this script. We avoid
// strict path equality here because some platforms (e.g. macOS) may use
// different but equivalent paths (/var vs /private/var). A suffix check
// is sufficient to distinguish direct execution from module import.
if (process.argv[1] && process.argv[1].endsWith(path.basename(thisFilePath))) {
  main().catch(error => {
    console.error('dev-server: unexpected error:', error);
    process.exit(1);
  });
}

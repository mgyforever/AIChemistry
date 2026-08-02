/**
 * Minimal Fastify "Hello World" server for initialized projects.
 *
 * This file is copied into new projects as src/index.ts during
 * template initialization.
 *
 * @supports docs/stories/001.0-DEVELOPER-TEMPLATE-INIT.story.md REQ-INIT-FASTIFY-HELLO
 * @supports docs/stories/002.0-DEVELOPER-DEV-SERVER.story.md REQ-DEV-START-FAST
 * @supports docs/stories/002.0-DEVELOPER-DEV-SERVER.story.md REQ-DEV-CLEAN-LOGS
 * @supports docs/stories/005.0-DEVELOPER-SECURITY-HEADERS.story.md REQ-SEC-HELMET-DEFAULT
 * @supports docs/stories/005.0-DEVELOPER-SECURITY-HEADERS.story.md REQ-SEC-HEADERS-PRESENT
 * @supports docs/stories/008.0-DEVELOPER-LOGS-MONITOR.story.md REQ-LOG-STRUCTURED-JSON REQ-LOG-PINO-INTEGRATED REQ-LOG-LEVELS-SUPPORT REQ-LOG-ERROR-STACKS REQ-LOG-AUTO-REQUEST REQ-LOG-LEVEL-CONFIG REQ-LOG-PROD-JSON
 */
import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import authPlugin from './plugins/auth.js';
import responsePlugin from './plugins/response.js';
import routesPlugin, { API_BASE_URL } from './routes/index.js';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const defaultLogLevel = nodeEnv === 'production' ? 'info' : 'debug';
const logLevel = process.env.LOG_LEVEL ?? defaultLogLevel;
const port = Number(process.env.PORT ?? 3000);
const host = '0.0.0.0';

/**
 * Build and configure a Fastify server instance.
 *
 * This function encapsulates server construction so it can be reused by
 * tests, CLIs, and other tooling without automatically starting a listener.
 *
 * Responsibilities:
 * - Configure structured JSON logging with env-driven log level.
 * - Register security headers via @fastify/helmet.
 * - Define basic application routes.
 *
 * @returns A fully configured, but not yet listening, Fastify instance.
 *
 * @supports docs/stories/001.0-DEVELOPER-TEMPLATE-INIT.story.md REQ-INIT-FASTIFY-HELLO
 * @supports docs/stories/002.0-DEVELOPER-DEV-SERVER.story.md REQ-DEV-START-FAST
 * @supports docs/stories/002.0-DEVELOPER-DEV-SERVER.story.md REQ-DEV-CLEAN-LOGS
 * @supports docs/stories/005.0-DEVELOPER-SECURITY-HEADERS.story.md REQ-SEC-HELMET-DEFAULT
 * @supports docs/stories/005.0-DEVELOPER-SECURITY-HEADERS.story.md REQ-SEC-HEADERS-PRESENT
 * @supports docs/stories/008.0-DEVELOPER-LOGS-MONITOR.story.md REQ-LOG-STRUCTURED-JSON REQ-LOG-PINO-INTEGRATED REQ-LOG-LEVELS-SUPPORT REQ-LOG-ERROR-STACKS REQ-LOG-AUTO-REQUEST REQ-LOG-LEVEL-CONFIG REQ-LOG-PROD-JSON
 */
export async function buildServer(): Promise<FastifyInstance> {
  // Implements structured JSON logging with env-driven log level configuration.
  const fastify = Fastify({
    logger: {
      level: logLevel,
    },
  });

  // @supports docs/stories/005.0-DEVELOPER-SECURITY-HEADERS.story.md REQ-SEC-HELMET-DEFAULT
  // @supports docs/stories/005.0-DEVELOPER-SECURITY-HEADERS.story.md REQ-SEC-HEADERS-PRESENT
  await fastify.register(helmet);

  // 统一接口响应格式（Result 模板）
  await fastify.register(responsePlugin);

  // JWT 认证插件
  await fastify.register(authPlugin);

  // 所有 API 路由统一挂载在 API_BASE_URL（/chemistry）前缀下
  await fastify.register(routesPlugin, { prefix: API_BASE_URL });

  return fastify;
}

/**
 * Start the Fastify HTTP server.
 *
 * This function builds the server via {@link buildServer}, starts listening
 * on the configured host and port, and logs the bound address.
 *
 * It is safe to call from CLIs or other tooling; it returns the started
 * Fastify instance for further integration (e.g., graceful shutdown).
 *
 * @returns The started Fastify instance.
 *
 * @supports docs/stories/001.0-DEVELOPER-TEMPLATE-INIT.story.md REQ-INIT-FASTIFY-HELLO
 * @supports docs/stories/002.0-DEVELOPER-DEV-SERVER.story.md REQ-DEV-START-FAST
 * @supports docs/stories/002.0-DEVELOPER-DEV-SERVER.story.md REQ-DEV-CLEAN-LOGS
 * @supports docs/stories/008.0-DEVELOPER-LOGS-MONITOR.story.md REQ-LOG-STRUCTURED-JSON REQ-LOG-PINO-INTEGRATED REQ-LOG-LEVELS-SUPPORT REQ-LOG-ERROR-STACKS REQ-LOG-AUTO-REQUEST REQ-LOG-LEVEL-CONFIG REQ-LOG-PROD-JSON
 */
export async function startServer(): Promise<FastifyInstance> {
  const fastify = await buildServer();

  try {
    const address = await fastify.listen({ port, host });
    // address is a string like "http://127.0.0.1:3000"
    console.log(`Server listening at ${address}`);
    return fastify;
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

/**
 * ESM entrypoint guard.
 *
 * When this module is executed directly via Node, start the HTTP server.
 * When it is imported, do not automatically start the server.
 *
 * @supports docs/stories/002.0-DEVELOPER-DEV-SERVER.story.md REQ-DEV-START-FAST
 */
const isDirectEntrypoint = (() => {
  if (typeof process === 'undefined' || typeof process.argv === 'undefined') {
    return false;
  }

  // In ESM, there is no __filename, so derive it from import.meta.url.
  const currentFile = fileURLToPath(import.meta.url);
  const entryFile = process.argv[1] && path.resolve(process.argv[1]);

  return entryFile !== undefined && path.resolve(currentFile) === entryFile;
})();

if (isDirectEntrypoint) {
  // Fire and forget; errors are handled inside startServer().
  void startServer();
}
/**
 * Example TypeScript tests for the generated Fastify server.
 *
 * This file is copied into new projects as src/index.test.ts during
 * template initialization.
 *
 * It provides a minimal, fast-running test that exercises the generated
 * Fastify instance using Fastify's built-in inject() helper so that
 * `npm test` in a freshly generated project immediately executes and
 * passes real tests.
 *
 * @supports docs/stories/004.0-DEVELOPER-TESTS-RUN.story.md REQ-TEST-ALL-PASS REQ-TEST-FAST-EXEC REQ-TEST-TYPESCRIPT REQ-TEST-EXAMPLES REQ-TEST-CLEAR-OUTPUT
 */
import { describe, it, expect } from 'vitest';

import { buildServer } from './index.js';

describe('Generated Fastify server (Story 004.0) [REQ-TEST-EXAMPLES]', () => {
  it('responds with status ok on GET /chemistry/health', async () => {
    const fastify = await buildServer();

    const response = await fastify.inject({
      method: 'GET',
      url: '/chemistry/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      message: 'success',
      data: { status: 'ok' },
    });

    await fastify.close();
  });
});
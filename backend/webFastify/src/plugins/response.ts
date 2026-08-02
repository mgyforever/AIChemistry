/**
 * 统一接口响应格式插件。
 *
 * 通过 preSerialization 钩子自动将所有接口的 JSON 响应包装为 Result 模板：
 * - 2xx 响应         → { status: 'ok', message, data }
 * - 4xx/5xx 响应     → { status: 'error', message, data: null }
 * - 处理器抛出的异常 → 由 setErrorHandler 统一包装为 error 响应
 *
 * 约定：
 * - 新增接口无需手动包装，返回普通对象即可自动生效。
 * - 若处理器中的响应对象带 message 字段，将作为 Result.message，
 *   其余字段放入 data；没有其他字段时 data 为 null。
 * - 若需完全自定义，处理器直接返回 new Result(...)，不会被二次包装。
 */
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { Result } from './result.js';

const responsePlugin: FastifyPluginAsync = async fastify => {
  fastify.addHook('preSerialization', async (request, reply, payload) => {
    // 已是 Result 的响应不重复包装
    if (payload instanceof Result) {
      return payload;
    }
    // 仅包装 JSON 对象响应，字符串 / Buffer / 流等原样透传
    if (payload === null || payload === undefined || typeof payload !== 'object') {
      return payload;
    }

    const body = payload as Record<string, unknown>;
    const rawMessage = typeof body.message === 'string' ? body.message : undefined;

    // 错误状态码 → error 响应
    if (reply.statusCode >= 400) {
      return new Result('error', rawMessage ?? '请求失败', null);
    }

    // 成功响应：提取 message 字段作为提示信息，其余内容放入 data
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (key !== 'message') {
        data[key] = value;
      }
    }

    return new Result(
      'ok',
      rawMessage ?? 'success',
      Object.keys(data).length > 0 ? data : null,
    );
  });

  // 统一异常处理：处理器抛出的错误也包装为 Result 结构
  fastify.setErrorHandler(async (error, request, reply) => {
    const err = error as Error & { statusCode?: number };
    const statusCode = err.statusCode ?? 500;
    const message = err.message ?? '服务器内部错误';
    reply.code(statusCode).send(new Result('error', message, null));
  });
};

export default fp(responsePlugin);

/**
 * 路由聚合插件与全局 API 基础路径。
 *
 * 所有接口统一挂载在 API_BASE_URL（/chemistry）前缀之下。
 * 后续新增接口时，只需在 routesPlugin 中注册对应路由插件，
 * 前缀会自动继承，无需在各路由文件中重复书写。
 */
import type { FastifyPluginAsync } from 'fastify';
import authRoutes from './auth.js';

/** 全局 API 基础路径，所有接口统一使用此前缀。 */
export const API_BASE_URL = '/chemistry';

/**
 * 所有 API 路由的聚合插件（在 index.ts 中以 API_BASE_URL 为前缀注册）。
 *
 * 新增业务路由示例：
 *   await fastify.register(userRoutes);      // 最终路径 /chemistry/user/...
 *   await fastify.register(experimentRoutes); // 最终路径 /chemistry/experiment/...
 */
export const routesPlugin: FastifyPluginAsync = async fastify => {
  // 根接口
  fastify.get('/', async () => {
    return { message: 'Hello World from Fastify + TypeScript!' } as const;
  });

  // 健康检查
  fastify.get('/health', async () => {
    return { status: 'ok' } as const;
  });

  // 认证接口（/chemistry/auth/*）
  await fastify.register(authRoutes, { prefix: '/auth' });
};

export default routesPlugin;

/**
 * JWT 认证插件。
 *
 * - 注册 @fastify/jwt（签发 / 校验 JWT），密钥来自环境变量 JWT_SECRET。
 * - 提供 fastify.authenticate 预处理器钩子：校验令牌有效性，
 *   并与数据库 users.token 比对（登录时写入、登出时清空）。
 */
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyPluginAsync, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { User } from './models.js';

/** JWT 载荷：仅包含用户身份信息，不放入敏感字段。 */
export interface JwtPayload {
  id: number;
  username: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: preHandlerHookHandler;
  }
}

/** 从 Authorization 请求头中提取 Bearer 令牌原文。 */
function getRawToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length);
}

const authPlugin: FastifyPluginAsync = async fastify => {
  await fastify.register(jwt, {
    // 生产环境必须通过环境变量 JWT_SECRET 注入强随机密钥。
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    sign: { expiresIn: '7d' },
  });

  /**
   * 认证预处理器：校验 JWT 是否有效，且与数据库中记录的当前令牌一致。
   *
   * 校验通过后，request.user 为 { id, username }。
   * 校验失败返回 401。
   */
  fastify.decorate('authenticate', async (request: FastifyRequest, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ message: '未授权：无效或过期的令牌' });
    }

    const { id } = request.user;
    const user = await User.findByPk(id);
    if (!user || !user.token || user.token !== getRawToken(request)) {
      return reply.code(401).send({ message: '未授权：令牌已失效，请重新登录' });
    }
  });
};

export default fp(authPlugin);
